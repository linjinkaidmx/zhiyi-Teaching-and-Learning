"""Opt-in isolated runner. No host subprocess fallback for untrusted programs."""
import json
import os
import subprocess
import uuid
import threading


def _invoke_docker(cmd, payload):
    """Bound output even if user code writes directly to container PID 1's fd."""
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    chunks = [bytearray(), bytearray()]
    overflow = threading.Event()
    def drain(stream, target):
        while True:
            chunk = stream.read(4096)
            if not chunk:
                break
            if len(target) + len(chunk) > 65536:
                overflow.set()
                try:
                    proc.kill()
                except OSError:
                    pass
                break
            target.extend(chunk)
    readers = [threading.Thread(target=drain, args=(stream, target), daemon=True)
               for stream, target in zip((proc.stdout, proc.stderr), chunks)]
    for reader in readers:
        reader.start()
    def write_input():
        try:
            proc.stdin.write(payload.encode('utf-8'))
            proc.stdin.close()
        except (BrokenPipeError, OSError):
            pass
    writer = threading.Thread(target=write_input, daemon=True)
    writer.start()
    try:
        proc.wait(timeout=30)
        for reader in readers:
            reader.join(timeout=2)
        writer.join(timeout=2)
        if overflow.is_set():
            return subprocess.CompletedProcess(cmd, 1, '', 'output limit exceeded')
        return subprocess.CompletedProcess(cmd, proc.returncode, chunks[0].decode('utf-8', errors='replace'), chunks[1].decode('utf-8', errors='replace'))
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        for reader in readers:
            reader.join(timeout=2)
        writer.join(timeout=2)
        for stream in (proc.stdin, proc.stdout, proc.stderr):
            stream.close()

# This wrapper and the compiler execute INSIDE the disposable container.
_WRAPPER = r'''
import json, pathlib, resource, subprocess, sys
p = json.load(sys.stdin)
resource.setrlimit(resource.RLIMIT_FSIZE, (1048576, 1048576))
resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
work = pathlib.Path('/work')
src = work / ('main.py' if p['language'] == 'python' else 'main.c')
src.write_text(p['code'])
def run(cmd, timeout, stdin=''):
    with open('/work/stdout', 'w+') as out, open('/work/stderr', 'w+') as err:
        try:
            r = subprocess.run(cmd, input=stdin, text=True, stdout=out, stderr=err, timeout=timeout)
            out.seek(0); err.seek(0)
            return {'ok': r.returncode == 0, 'exit_code': r.returncode, 'stdout': out.read(8000), 'stderr': err.read(2000)}
        except subprocess.TimeoutExpired:
            return {'ok': False, 'error': '运行超时，请检查是否有死循环'}
if p['language'] == 'c':
    result = run(['gcc', str(src), '-o', '/work/main', '-std=c99', '-O0'], 15)
    if result['ok']:
        result = run(['/work/main'], 8, p['stdin'])
else:
    result = run(['python3', '-I', str(src)], 8, p['stdin'])
print(json.dumps(result, ensure_ascii=False))
'''


def run_code(language, code, stdin=''):
    image = os.environ.get('ZHIYI_RUNNER_IMAGE', '').strip()
    if os.environ.get('ZHIYI_CODE_RUNNER', '') != 'docker' or not image:
        return {'ok': False, 'error': '代码运行暂未开放，请稍后再试'}
    if len(stdin.encode('utf-8')) > 64 * 1024:
        return {'ok': False, 'error': '输入数据过长（上限 64KB）'}
    name = 'zhiyi-run-' + uuid.uuid4().hex
    cmd = ['docker', 'run', '--rm', '--pull=never', '--name', name, '-i',
           '--network=none', '--read-only', '--user=65534:65534',
           '--cap-drop=ALL', '--security-opt=no-new-privileges',
           '--pids-limit=32', '--memory=256m', '--memory-swap=256m', '--cpus=0.5',
           '--ulimit=nofile=64:64', '--ulimit=core=0:0', '--log-driver=none',
           '--tmpfs=/work:rw,exec,nosuid,size=32m,mode=1777',
           '--tmpfs=/tmp:rw,noexec,nosuid,size=8m,mode=1777',
           '--workdir=/work', '--entrypoint=python3', image, '-I', '-c', _WRAPPER]
    try:
        result = _invoke_docker(cmd, json.dumps({'language': language, 'code': code, 'stdin': stdin}))
        if result.returncode != 0:
            return {'ok': False, 'error': '隔离运行环境暂不可用，请稍后再试'}
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': '运行超时，请检查是否有死循环'}
    except (OSError, ValueError):
        return {'ok': False, 'error': '隔离运行环境暂不可用，请稍后再试'}
    finally:
        try:
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass
