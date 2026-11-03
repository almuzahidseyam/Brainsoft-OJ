const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const IMAGE = 'brainsoft-judge:local';
const LABEL = 'brainsoft-oj.worker=true';

// Only Docker is invoked on the host. Source is stdin, never a shell command.
function command(args, { input = '', timeout = 20000, limit = 1048576 } = {}) {
    return new Promise(resolve => {
        const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        const chunks = { stdout: [], stderr: [] };
        let bytes = 0, stopped = false, done = false, reapTimer;
        const finish = exitCode => {
            if (done) return;
            done = true;
            clearTimeout(timer); clearTimeout(reapTimer);
            resolve({ exitCode, stopped, stdout: Buffer.concat(chunks.stdout).toString('utf8'), stderr: Buffer.concat(chunks.stderr).toString('utf8') });
        };
        const stop = () => {
            stopped = true; child.kill('SIGKILL');
            reapTimer = setTimeout(() => finish(-1), 1000);
        };
        const timer = setTimeout(stop, timeout);
        for (const stream of ['stdout', 'stderr']) child[stream].on('data', chunk => {
            chunks[stream].push(chunk.subarray(0, Math.max(0, limit - bytes)));
            bytes += chunk.length;
            if (bytes > limit && !stopped) stop();
        });
        child.on('error', () => finish(-1)); child.on('close', finish);
        child.stdin.on('error', () => {}); child.stdin.end(input);
    });
}

function containerArgs(name) {
    return ['create', '--pull=never', '--interactive', '--name', name, '--label', LABEL,
        '--network=none', '--read-only', '--cap-drop=ALL', '--cap-add=SETUID', '--cap-add=SETGID', '--cap-add=KILL',
        '--security-opt=no-new-privileges', '--pids-limit=64', '--cpus=1', '--memory=512m', '--memory-swap=512m',
        '--ulimit=nofile=128:128', '--tmpfs=/work:rw,exec,nosuid,nodev,size=64m,mode=1777',
        '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777', IMAGE];
}

function createRunner({ enabled = false, execute = command } = {}) {
    let ready = false;
    async function initialize() {
        ready = false;
        if (!enabled) return false;
        const os = await execute(['info', '--format', '{{.OSType}}'], { timeout: 5000 });
        if (os.exitCode !== 0 || os.stdout.trim() !== 'linux') return false;
        if ((await execute(['image', 'inspect', IMAGE], { timeout: 5000 })).exitCode !== 0) return false;
        const stale = await execute(['ps', '-aq', '--filter', `label=${LABEL}`]);
        if (stale.exitCode !== 0) return false;
        for (const id of stale.stdout.trim().split(/\s+/).filter(Boolean)) {
            if (!/^[a-f0-9]{12,64}$/.test(id) || (await execute(['rm', '--force', id])).exitCode !== 0) return false;
        }
        ready = true;
        return true;
    }
    async function runCode(code, language, input) {
        if (!ready) throw new Error('Judge unavailable');
        if (!['python', 'cpp', 'java'].includes(language)) throw new Error('Unsupported language');
        const name = `brainsoft-${randomUUID()}`;
        let result;
        try {
            if ((await execute(containerArgs(name))).exitCode !== 0) throw new Error('Cannot create worker');
            const ran = await execute(['start', '--attach', '--interactive', name], {
                input: JSON.stringify({ code, language, input }), timeout: 20000,
            });
            if (ran.exitCode !== 0 || ran.stopped) throw new Error('Worker failed');
            result = JSON.parse(ran.stdout);
            if (!['OK', 'Compilation Error', 'Runtime Error', 'Time Limit Exceeded', 'Output Limit Exceeded'].includes(result.status) ||
                typeof result.output !== 'string' || !Number.isFinite(result.executionTime) || result.executionTime < 0) throw new Error('Invalid worker result');
        } catch (error) { ready = false; throw error; }
        finally {
            // A killed Docker CLI does not kill the container: remove its whole process tree.
            if ((await execute(['rm', '--force', name], { timeout: 10000 })).exitCode !== 0) {
                ready = false; throw new Error('Worker cleanup failed; check Docker before restarting');
            }
        }
        return result;
    }
    return { initialize, runCode, isReady: () => ready };
}
module.exports = { createRunner, containerArgs, command };
