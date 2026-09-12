const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { runCode } = require('./judge');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

let db;

// Initialize Database
async function initDB() {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS problems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            difficulty TEXT,
            test_cases TEXT
        );
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            problem_id INTEGER,
            code TEXT,
            language TEXT,
            verdict TEXT,
            execution_time INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert a dummy problem if the database is empty
    const count = await db.get(`SELECT COUNT(*) as count FROM problems`);
    if (count.count === 0) {
        const testCases = JSON.stringify([
            { input: "1 2", expected: "3" },
            { input: "10 20", expected: "30" }
        ]);
        await db.run(`INSERT INTO problems (title, description, difficulty, test_cases) VALUES (?, ?, ?, ?)`,
            ["A + B Problem", "Given two integers A and B, print their sum.", "Easy", testCases]
        );
    }
}

initDB();

// API: Get all problems
app.get('/api/problems', async (req, res) => {
    const problems = await db.all(`SELECT id, title, difficulty FROM problems`);
    res.json(problems);
});

// API: Get problem details
app.get('/api/problems/:id', async (req, res) => {
    const problem = await db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id]);
    if (!problem) return res.status(404).json({ error: "Problem not found" });
    res.json(problem);
});

// API: Submit code
app.post('/api/submit', async (req, res) => {
    const { problemId, code, language } = req.body;
    
    // In our v1, we support python and cpp
    if (language !== 'python' && language !== 'cpp') {
        return res.status(400).json({ error: "Only python and cpp are supported." });
    }

    const problem = await db.get(`SELECT * FROM problems WHERE id = ?`, [problemId]);
    if (!problem) return res.status(404).json({ error: "Problem not found" });

    const submissionId = uuidv4();
    const testCases = JSON.parse(problem.test_cases);

    // Initial Database entry
    await db.run(
        `INSERT INTO submissions (id, problem_id, code, language, verdict, execution_time) VALUES (?, ?, ?, ?, ?, ?)`,
        [submissionId, problemId, code, language, 'Pending', 0]
    );

    // Send immediate response so the client knows it's pending
    res.json({ submissionId, status: "Pending" });

    // Run code asynchronously
    let verdict = "Accepted";
    let maxTime = 0;

    for (let tc of testCases) {
        const result = await runCode(code, language, tc.input);
        
        if (result.error) {
            verdict = result.errorType; // "Runtime Error" or "Time Limit Exceeded"
            break;
        }

        maxTime = Math.max(maxTime, result.executionTime);
        
        if (result.output.trim() !== tc.expected.trim()) {
            verdict = "Wrong Answer";
            break;
        }
    }

    // Update submission with final verdict
    await db.run(`UPDATE submissions SET verdict = ?, execution_time = ? WHERE id = ?`, [verdict, maxTime, submissionId]);
});

// API: Get submission status
app.get('/api/submissions/:id', async (req, res) => {
    const submission = await db.get(`SELECT * FROM submissions WHERE id = ?`, [req.params.id]);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    res.json(submission);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(\`Brainsoft-OJ Backend running on http://localhost:\${PORT}\`);
});
