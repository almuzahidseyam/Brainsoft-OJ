const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner, command } = require('../judge');

test('real Linux container language, timeout, output and isolation regression checks', { skip: process.env.JUDGE_INTEGRATION !== '1', timeout: 180000 }, async t => {
    const runner = createRunner({ enabled: true, execute: async (...args) => {
        const result = await command(...args);
        // Fixture-only diagnostics: never expose worker stderr through the public API.
        if (result.exitCode !== 0 || result.stopped) t.diagnostic(result.stderr || 'Docker command stopped');
        return result;
    } });
    assert.equal(await runner.initialize(), true, 'Build runner image and start Linux Docker first');
    const cases = [
        ['python', 'print(sum(map(int,input().split())))', '1 2', 'OK', '3'],
        ['cpp', '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}', '4 5', 'OK', '9'],
        ['java', 'import java.util.*;public class Solution { public static void main(String[] a){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}', '6 7', 'OK', '13'],
        ['cpp', 'this is not C++', '', 'Compilation Error', ''],
        ['python', 'raise ValueError("x")', '', 'Runtime Error', ''],
        ['python', 'while True: pass', '', 'Time Limit Exceeded', ''],
        ['python', 'print("আ" * 50000)', '', 'Output Limit Exceeded', null],
        ['python', 'import subprocess; subprocess.Popen(["python3","-c","import time;time.sleep(10)"])', '', 'Time Limit Exceeded', null],
        ['python', 'import os\nassert os.getuid()==10001\nassert not os.path.exists("/var/run/docker.sock")\nassert not os.path.exists("/host")\ntry:\n open("/etc/escape", "w")\n raise AssertionError("root writable")\nexcept OSError: pass\ntry:\n open("/proc/1/fd/1", "w")\n raise AssertionError("controller writable")\nexcept PermissionError: pass\nprint("isolated")', '', 'OK', 'isolated'],
        ['python', 'import socket\ns=socket.socket();s.settimeout(.2)\ntry:\n s.connect(("192.0.2.1",80))\n raise AssertionError("network available")\nexcept OSError: pass\nprint("offline")', '', 'OK', 'offline'],
        ['python', 'open("marker", "w").write("private"); print("created")', '', 'OK', 'created'],
        ['python', 'import os; assert not os.path.exists("marker"); print("fresh")', '', 'OK', 'fresh'],
    ];
    for (const [language, code, input, status, output] of cases) await t.test(`${language}: ${status}: ${output}`, async () => {
        const result = await runner.runCode(code, language, input);
        assert.equal(result.status, status);
        if (output !== null) assert.equal(result.output.trim(), output);
    });
    const workers = await command(['ps', '-aq', '--filter', 'label=brainsoft-oj.worker=true']);
    assert.equal(workers.stdout.trim(), '', 'No workers survive a completed job');
});
