const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Wall-clock limits. Compilation gets its own, separate from execution: a
// submission full of template metaprogramming can keep a compiler busy for
// minutes, and the previous version ran the compiler through spawnSync, which
// blocks the Node event loop -- so one such submission froze the judge for
// every other user until the compiler decided to return.
const COMPILE_TIMEOUT_MS = 10000;
const RUN_TIMEOUT_MS = 2000;

// stdout and stderr were accumulated without a ceiling, so a submission looping
// on print could allocate gigabytes before the timer fired.
const MAX_OUTPUT_BYTES = 1024 * 1024;

// `python` does not exist on most Linux and macOS installations, where the
// interpreter is `python3`. Windows usually has both.
const PYTHON = process.env.JUDGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

function runProcess(command, args, { input, timeoutMs, cwd }) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(command, args, { cwd, windowsHide: true });
        } catch (error) {
            resolve({ timedOut: false, exitCode: -1, stdout: '', stderr: String(error && error.message) });
            return;
        }

        let stdout = '';
        let stderr = '';
        let truncated = false;
        let settled = false;
        let timedOut = false;

        child.stdout.on('data', (chunk) => {
            if (stdout.length >= MAX_OUTPUT_BYTES) { truncated = true; return; }
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            if (stderr.length >= MAX_OUTPUT_BYTES) { truncated = true; return; }
            stderr += chunk.toString();
        });

        const settle = (result) => {
            if (settled) return;           // 'close' still arrives after a kill
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };

        const timer = setTimeout(() => {
            timedOut = true;
            // SIGTERM can be ignored; follow it with SIGKILL so a submission
            // cannot outlive its limit by declining to die.
            child.kill('SIGTERM');
            setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, 250);
        }, timeoutMs);

        child.on('error', (error) => settle({ timedOut, exitCode: -1, stdout, stderr: String(error.message), truncated }));
        child.on('close', (exitCode) => settle({ timedOut, exitCode, stdout, stderr, truncated }));

        if (input) {
            // A program that never reads stdin makes this write fail with EPIPE.
            child.stdin.on('error', () => {});
            child.stdin.write(input);
        }
        child.stdin.end();
    });
}

async function runCode(code, language, input) {
    const tempRoot = path.join(__dirname, 'temp');
    await fsp.mkdir(tempRoot, { recursive: true });

    // One directory per submission, always. The previous version shared the
    // temp directory for python and cpp and only isolated java, so two
    // submissions landing together could read each other's files.
    const workDir = path.join(tempRoot, uuidv4());
    await fsp.mkdir(workDir);

    const cleanup = () => fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});

    try {
        let command;
        let args = [];

        if (language === 'python') {
            const file = path.join(workDir, 'main.py');
            await fsp.writeFile(file, code);
            command = PYTHON;
            args = [file];
        } else if (language === 'cpp') {
            const file = path.join(workDir, 'main.cpp');
            const binary = path.join(workDir, process.platform === 'win32' ? 'main.exe' : 'main');
            await fsp.writeFile(file, code);
            const compiled = await runProcess('g++', [file, '-o', binary, '-std=c++17', '-O2'], {
                timeoutMs: COMPILE_TIMEOUT_MS, cwd: workDir,
            });
            if (compiled.timedOut) {
                return { error: true, errorType: 'Compilation Error', details: 'Compilation timed out.' };
            }
            if (compiled.exitCode !== 0) {
                return { error: true, errorType: 'Compilation Error', details: compiled.stderr };
            }
            command = binary;
        } else if (language === 'java') {
            // javac requires the file name to match the public class.
            const file = path.join(workDir, 'Solution.java');
            await fsp.writeFile(file, code);
            const compiled = await runProcess('javac', [file], {
                timeoutMs: COMPILE_TIMEOUT_MS, cwd: workDir,
            });
            if (compiled.timedOut) {
                return { error: true, errorType: 'Compilation Error', details: 'Compilation timed out.' };
            }
            if (compiled.exitCode !== 0) {
                return { error: true, errorType: 'Compilation Error', details: compiled.stderr };
            }
            command = 'java';
            args = ['-cp', workDir, 'Solution'];
        } else {
            return { error: true, errorType: 'Unsupported Language' };
        }

        const startTime = Date.now();
        const result = await runProcess(command, args, {
            input, timeoutMs: RUN_TIMEOUT_MS, cwd: workDir,
        });
        const executionTime = Date.now() - startTime;

        if (result.timedOut) return { error: true, errorType: 'Time Limit Exceeded', executionTime };
        if (result.truncated) {
            return { error: true, errorType: 'Output Limit Exceeded', executionTime };
        }
        if (result.exitCode !== 0) {
            return { error: true, errorType: 'Runtime Error', executionTime, details: result.stderr };
        }
        return { error: false, output: result.stdout, executionTime };
    } finally {
        // Runs on every path, including the early returns above, so a
        // compilation failure no longer leaves its directory behind.
        await cleanup();
    }
}

module.exports = { runCode };
