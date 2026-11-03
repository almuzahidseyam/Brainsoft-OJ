const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp, openDatabase } = require('../server');
const TOKEN = 'test-access-token-not-a-real-secret-123456';

async function setup(t, { runCode = async () => ({ status: 'OK', output: '3', executionTime: 1 }), token = TOKEN, ready = true } = {}) {
    const db = await openDatabase(':memory:');
    const service = createApp({ db, token, runner: { runCode, isReady: () => ready } });
    const server = service.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { await service.drain(); await new Promise(resolve => server.close(resolve)); await db.close(); });
    const request = async (url, body, auth = TOKEN) => {
        const r = await fetch(base + '/api' + url, { method: body === undefined ? 'GET' : 'POST',
            headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: r.status, data: await r.json(), headers: r.headers };
    };
    return { db, service, request };
}
const submission = { problemId: 1, code: 'print(3)', language: 'python' };

test('problem DTO exposes samples, never hidden cases or expected answers', async t => {
    const { db, request } = await setup(t);
    await db.run('UPDATE problems SET test_cases=?', JSON.stringify([{ input: 'SECRET_INPUT', expected: 'SECRET_EXPECTED' }]));
    const detail = await request('/problems/1');
    assert.equal(detail.status, 200);
    assert.deepEqual(Object.keys(detail.data).sort(), ['description','difficulty','id','samples','title']);
    assert.deepEqual(detail.data.samples, [{ input: '1 2', output: '3' }]);
    assert.ok(!JSON.stringify(detail.data).includes('SECRET'));
    assert.equal(detail.headers.get('access-control-allow-origin'), null);
    assert.equal((await request('/problems/999')).status, 404);
});

test('missing/short token disables judging and wrong/missing token cannot submit or inspect', async t => {
    const disabled = await setup(t, { token: '' });
    assert.equal((await disabled.request('/submit', submission)).status, 503);
    assert.equal((await disabled.request('/health')).data.judging, false);
    const active = await setup(t);
    for (const token of ['', 'wrong']) {
        assert.equal((await active.request('/submit', submission, token)).status, 401);
        assert.equal((await active.request('/submissions/id', undefined, token)).status, 401);
    }
});

test('unavailable runner rejects before storing a submission', async t => {
    const { db, request } = await setup(t, { ready: false });
    assert.equal((await request('/submit', submission)).status, 503);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM submissions')).n, 0);
});

test('source/id/language and total request size are bounded', async t => {
    const { request } = await setup(t);
    for (const changed of [{ problemId: '1' }, { problemId: -1 }, { code: {} }, { code: '' }, { language: 'sh' }, { code: 'আ'.repeat(24000) }])
        assert.equal((await request('/submit', { ...submission, ...changed })).status, 400);
    assert.equal((await request('/submit', { ...submission, code: 'a'.repeat(90000) })).status, 413);
    assert.equal((await request('/submit', { ...submission, problemId: 999 })).status, 404);
});

test('empty or malformed judge test set cannot be Accepted', async t => {
    const { db, request } = await setup(t);
    for (const tests of ['[]', '{}', 'broken', '[{"input":1,"expected":"1"}]']) {
        await db.run('UPDATE problems SET test_cases=?', tests);
        assert.equal((await request('/submit', submission)).status, 500);
    }
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM submissions')).n, 0);
});

test('Accepted, Wrong Answer and judge errors always reach terminal state', async t => {
    for (const expected of ['Accepted', 'Wrong Answer', 'Runtime Error', 'Internal Error']) {
        const runCode = async (code, language, input) => {
            if (expected === 'Internal Error') throw new Error('private daemon detail');
            return { status: expected === 'Runtime Error' ? expected : 'OK',
                output: expected === 'Accepted' ? String(input.split(' ').reduce((a,b) => a + Number(b), 0)) : 'wrong', executionTime: 2 };
        };
        const { service, request } = await setup(t, { runCode });
        const sent = await request('/submit', submission);
        assert.equal(sent.status, 202);
        await service.idle();
        const result = await request(`/submissions/${sent.data.submissionId}`);
        assert.equal(result.data.verdict, expected);
        assert.ok(!('code' in result.data));
        assert.ok(!JSON.stringify(result.data).includes('private daemon'));
    }
});

test('bounded queue serializes jobs, recovers capacity, and rejects new work on shutdown', async t => {
    let release; const gate = new Promise(r => { release = r; });
    let active = 0, maxActive = 0;
    const { service, request } = await setup(t, { runCode: async () => {
        active++; maxActive = Math.max(maxActive, active); await gate; active--;
        return { status: 'OK', output: 'wrong', executionTime: 0 };
    } });
    t.after(() => release());
    try {
        const accepted = await Promise.all(Array.from({ length: 4 }, () => request('/submit', submission)));
        assert.ok(accepted.every(r => r.status === 202));
        assert.equal((await request('/submit', submission)).status, 429);
    } finally { release(); }
    await service.idle();
    assert.equal(maxActive, 1);
    assert.equal((await request('/submit', submission)).status, 202);
    await service.drain();
    assert.equal((await request('/submit', submission)).status, 503);
});

test('restart preserves problems but terminates abandoned submissions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'brainsoft-db-'));
    const filename = path.join(directory, 'test.sqlite');
    let db;
    try {
        db = await openDatabase(filename);
        await db.run("INSERT INTO submissions(id,verdict) VALUES('old','Running')");
        await db.close();
        db = await openDatabase(filename);
        assert.equal((await db.get("SELECT verdict FROM submissions WHERE id='old'")).verdict, 'Internal Error');
        assert.equal((await db.get('SELECT COUNT(*) AS n FROM problems')).n, 1);
    } finally { await db?.close(); await rm(directory, { recursive: true, force: true }); }
});
