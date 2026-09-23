# -*- coding: utf-8 -*-
"""部署「KaTeX 公式渲染 + 题库扩充第一批 + 模糊匹配」版本"""
import json
import re
import sys
import time
import urllib.request
import uuid
import warnings

import os
import paramiko

warnings.filterwarnings("ignore")

# 凭据一律从环境变量读取，切勿把密码写回文件（本仓库是公开的）
HOST = os.environ.get("ZHIYI_HOST", "193.112.28.51")
USER = os.environ.get("ZHIYI_USER", "root")
PWD = os.environ.get("ZHIYI_PW", "")
REMOTE = "/opt/zhiyi"
BASE = f"http://{HOST}:3300"
STATIC = "zhiyi/backend/static5"
JS_HASH = "BtywryiX"


def post_img(path, imgfile, timeout=240):
    b = uuid.uuid4().hex
    img = open(imgfile, "rb").read()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="t.png"\r\nContent-Type: image/png\r\n\r\n').encode()
    body += img + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request(
        BASE + path, data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    t0 = time.time()
    r = urllib.request.urlopen(req, timeout=timeout)
    return r.status, json.loads(r.read().decode("utf-8")), time.time() - t0


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=20,
              allow_agent=False, look_for_keys=False)

    def ex(cmd, timeout=180):
        _, o, e = c.exec_command(cmd, timeout=timeout)
        return (o.read().decode(errors="replace").strip(),
                e.read().decode(errors="replace").strip())

    print("== 1. 备份 ==")
    out, err = ex("rm -rf /opt/zhiyi/backend/static_bak && "
                  "cp -r /opt/zhiyi/backend/static /opt/zhiyi/backend/static_bak && "
                  "cp /opt/zhiyi/backend/service.py /opt/zhiyi/backend/service.py.bak && "
                  "echo BACKUP_OK")
    print(" ", out or err)

    print("\n== 2. 上传后端（service.py 含新记号规范 Prompt）==")
    sftp = c.open_sftp()
    sftp.put("zhiyi/backend/service.py", f"{REMOTE}/backend/service.py")
    print("  ✓ service.py")
    sftp.close()

    print("\n== 3. 上传前端（KaTeX 版）==")
    ex(f"rm -rf {REMOTE}/backend/static && mkdir -p {REMOTE}/backend/static/assets")
    sftp = c.open_sftp()
    import os
    sftp.put(f"{STATIC}/index.html", f"{REMOTE}/backend/static/index.html")
    print("  ✓ index.html")
    for fn in os.listdir(f"{STATIC}/assets"):
        sftp.put(f"{STATIC}/assets/{fn}", f"{REMOTE}/backend/static/assets/{fn}")
        print("  ✓ assets/" + fn)
    sftp.close()

    print("\n== 4. 自检 + 重启 ==")
    out, err = ex(f"cd {REMOTE}/backend && source venv/bin/activate && "
                  "python -c 'import service,schemas,main;print(\"IMPORT_OK\")'")
    print("  import:", out or err)
    out, err = ex("systemctl restart zhiyi && sleep 5 && systemctl is-active zhiyi")
    print("  状态:", out or err)
    c.close()

    print("\n=== 5. 外网验证 ===")
    time.sleep(3)
    r = urllib.request.urlopen(BASE + "/api/health", timeout=20)
    print("  health:", r.status)
    html = urllib.request.urlopen(BASE + "/", timeout=20).read().decode("utf-8")
    mjs = re.search(r'assets/([^"]+\.js)', html)
    print("  页面 JS:", mjs.group(1) if mjs else "?")
    print(f"  新版({JS_HASH}):", JS_HASH in html)

    print("\n=== 6. diagnose 记号规范验证 ===")
    st, d, cost = post_img("/api/diagnose", "zhiyi/scripts/sample.png")
    print(f"  HTTP {st} success={d.get('success')} 耗时 {cost:.1f}s")
    if d.get("success"):
        x = d["data"]
        ca = x.get("correct_answer", "")
        print(f"  correct_answer = {ca!r}")
        print(f"  含 $ 包裹: {'$' in ca}")
        print(f"  含裸 ^ 记号且无 $: {'^' in ca and '$' not in ca}")
        steps = x.get("solution_steps") or []
        if steps:
            print(f"  step1 = {steps[0]!r}")
    else:
        print("  ERROR:", d.get("error"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("异常:", type(e).__name__, e)
        sys.exit(1)
