const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner, containerArgs } = require('../judge');
const ok = stdout => ({ exitCode: 0, stdout: stdout || '', stderr: '' });
function fake(overrides = {}) {
    const calls = [];
    const execute = async (args, options) => {
        calls.push({ args, options });
        if (overrides[args[0]]) return overrides[args[0]](args, options);
        if (args[0] === 'info') return ok('linux');
        if (args[0] === 'start') return ok(JSON.stringify({ status: 'OK', output: '3', executionTime: 1 }));
        return ok();
    };
    return { execute, calls };
}
test('disabled runner never spawns a process; missing Docker never falls back to host', async () => {
    const f = fake(); const disabled = createRunner({ execute: f.execute });
    assert.equal(await disabled.initialize(), false);
    await assert.rejects(disabled.runCode('print(1)', 'python', ''));
    assert.equal(f.calls.length, 0);
    const missing = createRunner({ enabled: true, execute: async () => ({ exitCode: -1 }) });
    assert.equal(await missing.initialize(), false);
    await assert.rejects(missing.runCode('', 'cpp', ''));
});
test('container is bounded, networkless, no host mounts or env secrets, and always removed', async () => {
    const f = fake(); const r = createRunner({ enabled: true, execute: f.execute });
    await r.initialize();
    const code = 'print("$(not-a-host-command)")';
    await r.runCode(code, 'python', '1 2');
    const create = f.calls.find(c => c.args[0] === 'create');
    for (const flag of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=512m']) assert.ok(create.args.includes(flag));
    assert.ok(!create.args.some(a => /--(volume|mount|privileged|env|publish)/.test(a)));
    const start = f.calls.find(c => c.args[0] === 'start');
    assert.deepEqual(JSON.parse(start.options.input), { code, language: 'python', input: '1 2' });
    assert.equal(f.calls.at(-1).args[0], 'rm');
    assert.ok(!f.calls.some(c => c.args.includes(code)));
});
test('worker parse/start failures disable judge and still remove container', async () => {
    for (const response of [{ exitCode: -1 }, ok('bad json'), ok('{"status":"Accepted"}')]) {
        const f = fake({ start: async () => response }); const r = createRunner({ enabled: true, execute: f.execute });
        await r.initialize();
        await assert.rejects(r.runCode('', 'python', ''));
        assert.equal(r.isReady(), false); assert.equal(f.calls.at(-1).args[0], 'rm');
    }
});
test('cleanup failure is fatal and stale workers are removed before becoming ready', async () => {
    const f = fake({ ps: async () => ok('abcdef123456'), rm: async () => ({ exitCode: 1 }) });
    const r = createRunner({ enabled: true, execute: f.execute });
    assert.equal(await r.initialize(), false);
    assert.deepEqual(f.calls.at(-1).args, ['rm', '--force', 'abcdef123456']);
    assert.ok(containerArgs('safe-name').at(-1).startsWith('brainsoft-judge:'));
});
