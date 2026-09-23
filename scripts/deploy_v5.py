# -*- coding: utf-8 -*-
"""deploy v5: account system + records sync + forum + study groups

- upload: main.py / db.py / auth.py / forum.py / group.py
- ensure ZHIYI_ACC_SECRET in remote .env
- upload frontend build (static6)
- import check -> restart -> verify
"""
import os
import secrets
import sys
import time
import urllib.request
import uuid
import json
import warnings

import paramiko

warnings.filterwarnings("ignore")

# 凭据一律从环境变量读取，切勿把密码写回文件（本仓库是公开的）
HOST = os.environ.get("ZHIYI_HOST", "193.112.28.51")
USER = os.environ.get("ZHIYI_USER", "root")
PWD = os.environ.get("ZHIYI_PW", "")
REMOTE = "/opt/zhiyi"
BASE = f"http://{HOST}:3300"
STATIC = "zhiyi/backend/static6"
JS_HASH = "0a-jvfC-"


def post_json(path, body, token=None, timeout=30):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-account-token"] = token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=headers)
    r = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(r.read().decode())


def get_json(path, token=None, timeout=20):
    headers = {"x-account-token": token} if token else {}
    req = urllib.request.Request(BASE + path, headers=headers)
    r = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(r.read().decode())


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=20,
              allow_agent=False, look_for_keys=False)

    def ex(cmd, timeout=180):
        _, o, e = c.exec_command(cmd, timeout=timeout)
        return (o.read().decode(errors="replace").strip(),
                e.read().decode(errors="replace").strip())

    print("== 1. backup ==")
    out, err = ex(
        f"cp /opt/zhiyi/backend/main.py /opt/zhiyi/backend/main.py.bak3 && echo BACKUP_OK")
    print(" ", out or err)

    print("== 2. ensure ZHIYI_ACC_SECRET in .env ==")
    out, _ = ex("grep -c ZHIYI_ACC_SECRET /opt/zhiyi/backend/.env 2>/dev/null || echo 0")
    if out.strip() == "0":
        sec = secrets.token_hex(24)
        ex(f'echo "ZHIYI_ACC_SECRET={sec}" >> /opt/zhiyi/backend/.env')
        print("  generated and appended")
    else:
        print("  already present")

    print("== 3. upload backend files ==")
    sftp = c.open_sftp()
    for fn in ["main.py", "db.py", "auth.py", "forum.py", "group.py"]:
        sftp.put(f"zhiyi/backend/{fn}", f"{REMOTE}/backend/{fn}")
        print("  ok", fn)

    print("== 4. upload frontend (static6) ==")
    ex(f"rm -rf {REMOTE}/backend/static && mkdir -p {REMOTE}/backend/static/assets")
    sftp.put(f"{STATIC}/index.html", f"{REMOTE}/backend/static/index.html")
    print("  ok index.html")
    for fn in os.listdir(f"{STATIC}/assets"):
        sftp.put(f"{STATIC}/assets/{fn}", f"{REMOTE}/backend/static/assets/{fn}")
        print("  ok assets/" + fn)
    sftp.close()

    print("== 5. import check + restart ==")
    out, err = ex(f"cd {REMOTE}/backend && source venv/bin/activate && "
                  "python -c 'import main; print(\"IMPORT_OK\")'")
    print("  import:", out or err)
    out, err = ex("systemctl restart zhiyi && sleep 5 && systemctl is-active zhiyi")
    print("  service:", out or err)
    c.close()

    print("\n== 6. online verify ==")
    time.sleep(2)
    print("  health:", get_json("/api/health"))

    html = urllib.request.urlopen(BASE + "/", timeout=20).read().decode("utf-8")
    import re
    m = re.search(r'assets/([^"]+\.js)', html)
    print("  page js:", m.group(1) if m else "?", "| new version:", JS_HASH in html)

    print("  -- account smoke --")
    nick = "smoke_%d" % int(time.time())
    r = post_json("/api/account/register",
                  {"nickname": nick, "password": "smoke123", "passwordConfirm": "smoke123"})
    print("  register ok:", r.get("ok"))
    t = r.get("token")
    rec = {"id": "smoke-1", "source": "bank", "subject": "smoke", "question": "1+1=?",
           "knowledge_points": [], "error_type": "", "mastered": False}
    r = post_json("/api/records/upsert", {"record": rec}, token=t)
    print("  record upsert ok:", r.get("ok"))
    r = get_json("/api/records", token=t)
    print("  record list ok:", r.get("ok"), "count:", len(r.get("records", [])))
    r = post_json("/api/forum/posts",
                  {"type": "text", "title": "deploy smoke", "content": "hi"}, token=t)
    print("  forum post ok:", r.get("ok"))
    r = post_json("/api/group/create", {"name": "smoke group", "subject": ""}, token=t)
    print("  group create ok:", r.get("ok"), "code len:", len(r.get("group", {}).get("code", "")))
    print("\nDONE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("EXC:", type(e).__name__, e)
        sys.exit(1)
