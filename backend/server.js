const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const path = require('node:path');
const { createRunner } = require('./judge');
const MAX_JOBS = 4, MAX_BYTES = 65536;
const languages = ['python', 'cpp', 'java'];
const boundedString = value => typeof value === 'string' && Buffer.byteLength(value) <= MAX_BYTES;

async function openDatabase(filename) {
    const connection = new DatabaseSync(filename);
    const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    const db = {
        exec: async sql => connection.exec(sql),
        run: async (sql, ...values) => connection.prepare(sql).run(...params(values)),
        get: async (sql, ...values) => connection.prepare(sql).get(...params(values)),
        all: async (sql, ...values) => connection.prepare(sql).all(...params(values)),
        close: async () => connection.close(),
    };
    await db.exec(`PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS problems (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT,
            description TEXT, difficulty TEXT, test_cases TEXT, samples TEXT NOT NULL DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, problem_id INTEGER, code TEXT,
            language TEXT, verdict TEXT, execution_time INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    const columns = await db.all('PRAGMA table_info(problems)');
    if (!columns.some(c => c.name === 'samples')) await db.exec("ALTER TABLE problems ADD COLUMN samples TEXT NOT NULL DEFAULT '[]'");
    await db.run("UPDATE submissions SET verdict = 'Internal Error' WHERE verdict IN ('Pending', 'Running')");
    const { count } = await db.get('SELECT COUNT(*) AS count FROM problems');
    if (!count) await db.run('INSERT INTO problems(title,description,difficulty,test_cases,samples) VALUES(?,?,?,?,?)', [
        'A + B Problem', 'Given two integers A and B, print their sum.', 'Easy',
        JSON.stringify([{ input: '1 2', expected: '3' }, { input: '10 20', expected: '30' }]),
        JSON.stringify([{ input: '1 2', output: '3' }]),
    ]);
    return db;
}

function createApp({ db, runner, token = '' }) {
    const app = express(); app.disable('x-powered-by');
    let jobs = 0, chain = Promise.resolve(), closing = false, healthy = true;
    const configured = Buffer.byteLength(token) >= 32;
    const digest = text => createHash('sha256').update(text).digest();
    const authorized = (req, res, next) => {
        if (!configured) return res.status(503).json({ error: 'Judging is disabled. Ask the owner to configure access.' });
        const header = req.get('authorization') || '';
        if (!header.startsWith('Bearer ') || !timingSafeEqual(digest(header.slice(7)), digest(token)))
            return res.status(401).json({ error: 'Enter a valid judge access token.' });
        next();
    };
    app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
    app.get('/api/health', (req, res) => res.json({ judging: configured && runner.isReady() && !closing && healthy }));
    app.get('/api/problems', async (req, res) => res.json(await db.all('SELECT id,title,difficulty FROM problems')));
    app.get('/api/problems/:id', async (req, res) => {
        const problem = await db.get('SELECT id,title,description,difficulty,samples FROM problems WHERE id=?', req.params.id);
        if (!problem) return res.status(404).json({ error: 'Problem not found' });
        res.json({ ...problem, samples: JSON.parse(problem.samples).map(s => ({ input: s.input, output: s.output })) });
    });
    app.post('/api/submit', authorized, express.json({ limit: '80kb', inflate: false }), async (req, res) => {
        if (closing || !healthy || !runner.isReady()) return res.status(503).json({ error: 'The isolated judge is unavailable. Try after the owner restarts it.' });
        const { problemId, code, language } = req.body || {};
        if (!Number.isSafeInteger(problemId) || problemId <= 0 || !boundedString(code) || !code.trim() || !languages.includes(language))
            return res.status(400).json({ error: 'Choose a problem and language, and enter at most 64 KiB of source code.' });
        if (jobs >= MAX_JOBS) return res.status(429).set('Retry-After', '15').json({ error: 'Judge queue is full. Please try again shortly.' });
        jobs++;
        let queued = false;
        try {
            const problem = await db.get('SELECT test_cases FROM problems WHERE id=?', problemId);
            if (!problem) return res.status(404).json({ error: 'Problem not found' });
            const cases = JSON.parse(problem.test_cases);
            if (!Array.isArray(cases) || !cases.length || cases.length > 10 || cases.some(tc => !boundedString(tc.input) || !boundedString(tc.expected))) throw new Error('Invalid tests');
            const id = randomUUID();
            await db.run('INSERT INTO submissions(id,problem_id,code,language,verdict,execution_time) VALUES(?,?,?,?,?,?)', [id, problemId, code, language, 'Pending', 0]);
            chain = chain.then(async () => {
                let verdict = 'Internal Error', executionTime = 0;
                try {
                    await db.run("UPDATE submissions SET verdict='Running' WHERE id=?", id);
                    const started = Date.now();
                    for (const tc of cases) {
                        if (Date.now() - started > 60000) throw new Error('Job budget exceeded');
                        const result = await runner.runCode(code, language, tc.input);
                        executionTime = Math.max(executionTime, result.executionTime);
                        verdict = result.status === 'OK' ? (result.output.trim() === tc.expected.trim() ? 'Accepted' : 'Wrong Answer') : result.status;
                        if (verdict !== 'Accepted') break;
                    }
                } catch { verdict = 'Internal Error'; }
                finally { await db.run('UPDATE submissions SET verdict=?,execution_time=? WHERE id=?', verdict, executionTime, id); }
            }).catch(error => { healthy = false; console.error('Cannot persist judge result:', error.message); }).finally(() => jobs--);
            queued = true;
            res.status(202).json({ submissionId: id, status: 'Pending' });
        } finally { if (!queued) jobs--; }
    });
    app.get('/api/submissions/:id', authorized, async (req, res) => {
        if (!healthy) return res.status(503).json({ error: 'Result storage failed. Contact the owner before submitting again.' });
        const submission = await db.get('SELECT id,problem_id,language,verdict,execution_time,timestamp FROM submissions WHERE id=?', req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        res.json(submission);
    });
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = error.type === 'entity.too.large' ? 413 : [400, 415].includes(error.status) ? error.status : 500;
        res.status(status).json({ error: status === 500 ? 'Internal error. Please contact the owner.' : 'Invalid or oversized request body.' });
    });
    return { app, drain: () => { closing = true; return chain; }, idle: () => chain };
}

async function main() {
    // Bind first: a second process must not reset the first process's jobs/workers.
    let service, db;
    const server = require('node:http').createServer((req, res) => {
        if (service) return service.app(req, res);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Judge is starting. Please retry shortly.' }));
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5000, '127.0.0.1', resolve); });
    try {
        db = await openDatabase(path.join(__dirname, 'database.sqlite'));
        const runner = createRunner({ enabled: process.env.JUDGE_ENABLED === 'true' });
        await runner.initialize();
        service = createApp({ db, runner, token: process.env.JUDGE_ACCESS_TOKEN });
        console.log(`Brainsoft-OJ: http://127.0.0.1:5000; runner ${runner.isReady() ? 'ready' : 'disabled'}`);
    } catch (error) { server.close(); await db?.close(); throw error; }
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
        server.close(); await service.drain(); await db.close();
    });
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createApp, openDatabase };
