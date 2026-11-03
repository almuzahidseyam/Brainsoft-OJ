"""Container controller. Contestants use a separate UID; expected answers stay on the host."""
import json
import os
import resource
import selectors
import signal
import subprocess
import sys
import time
from pathlib import Path

LIMIT = 65536


def restrict():
    os.setsid()
    os.setgroups([])
    os.setgid(10001)
    os.setuid(10001)
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run(args, data, seconds):
    start = time.monotonic()
    output = bytearray()
    status = 'OK'
    # File-backed stdin avoids a pipe write blocking the controller's timer.
    with open('/work/input', 'wb') as handle:
        handle.write(data.encode('utf-8'))
    os.chmod('/work/input', 0o600)
    with open('/work/input', 'rb') as stdin:
        proc = subprocess.Popen(args, stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                cwd='/work', env={'PATH': '/usr/bin:/bin', 'HOME': '/work', 'LANG': 'C.UTF-8'},
                                preexec_fn=restrict, close_fds=True)
    selector = selectors.DefaultSelector()
    selector.register(proc.stdout, selectors.EVENT_READ, True)
    selector.register(proc.stderr, selectors.EVENT_READ, False)
    total = 0
    try:
        while selector.get_map():
            remaining = seconds - (time.monotonic() - start)
            if remaining <= 0:
                status = 'Time Limit Exceeded'
                break
            for key, _ in selector.select(min(remaining, 0.05)):
                chunk = os.read(key.fd, 8192)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                total += len(chunk)
                if total > LIMIT:
                    status = 'Output Limit Exceeded'
                    break
                if key.data:
                    output.extend(chunk)
            if status != 'OK':
                break
        if status == 'OK':
            try:
                proc.wait(timeout=max(0.001, seconds - (time.monotonic() - start)))
            except subprocess.TimeoutExpired:
                status = 'Time Limit Exceeded'
        if status == 'OK' and proc.returncode != 0:
            status = 'Runtime Error'
    finally:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()
        selector.close()
        proc.stdout.close()
        proc.stderr.close()
    return {'status': status, 'output': output.decode('utf-8', errors='replace'),
            'executionTime': round((time.monotonic() - start) * 1000)}


def main():
    payload = json.loads(sys.stdin.buffer.read(1048576))
    language, code, data = payload['language'], payload['code'], payload['input']
    if language not in ('python', 'cpp', 'java') or not isinstance(code, str) or not isinstance(data, str):
        raise ValueError('Invalid payload')
    if len(code.encode()) > LIMIT or len(data.encode()) > LIMIT:
        raise ValueError('Input too large')
    filename = {'python': 'main.py', 'cpp': 'main.cpp', 'java': 'Solution.java'}[language]
    Path(filename).write_text(code, encoding='utf-8')
    if language != 'python':
        args = ['g++', 'main.cpp', '-o', 'main', '-std=c++17', '-O2'] if language == 'cpp' else [
            'javac', '-J-Xmx128m', '-J-XX:+UseSerialGC', '-J-XX:ActiveProcessorCount=1', 'Solution.java']
        compiled = run(args, '', 10)
        if compiled['status'] != 'OK':
            return {'status': 'Compilation Error', 'output': '', 'executionTime': 0}
    args = {'python': ['python3', '-I', '-B', 'main.py'], 'cpp': ['./main'],
            'java': ['java', '-Xmx128m', '-XX:MaxMetaspaceSize=64m', '-XX:+UseSerialGC',
                     '-XX:ActiveProcessorCount=1', '-cp', '/work', 'Solution']}[language]
    return run(args, data, 2)


if __name__ == '__main__':
    print(json.dumps(main()), flush=True)
