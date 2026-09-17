# -*- coding: utf-8 -*-
"""deploy v6: 仅更新前端构建产物（修复小组/论坛分享下拉 No data）

变更内容：
  - GroupView.vue: 补 getBook 导入（此前 ReferenceError 被 catch 吞掉 -> 下拉空）
  - GroupView.vue: shareableBook 由 computed 改为打开弹窗时刷新的 ref
  - PostDialog.vue: myBook 同样改为 ref + 打开时刷新
后端未改动，本脚本只上传前端 dist 并重启验证。
"""
import os
import re
import sys
import time
import urllib.request
import warnings

import paramiko

warnings.filterwarnings("ignore")

HOST = "193.112.28.51"
USER = "root"
PWD = os.environ.get("ZHIYI_SSH_PWD", "")  # 密码不再入库，用环境变量传入
REMOTE = "/opt/zhiyi"
BASE = f"http://{HOST}:3300"
DIST = "zhiyi/frontend/dist"


def get_json(path, timeout=20):
    req = urllib.request.Request(BASE + path)
    r = urllib.request.urlopen(req, timeout=timeout)
    return r.read().decode()


def main():
    if not PWD:/n        print("请先设置环境变量 ZHIYI_SSH_PWD（服务器 SSH 密码）")
        return 1
    assert os.path.isdir(DIST), f"构建产物不存在: {DIST}"
    assets = os.listdir(os.path.join(DIST, "assets"))
    print(f"== 本地产物: {len(assets)} 个 assets ==")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=20,
              allow_agent=False, look_for_keys=False)

    def ex(cmd, timeout=300):
        _, o, e = c.exec_command(cmd, timeout=timeout)
        return (o.read().decode(errors="replace").strip(),
                e.read().decode(errors="replace").strip())

    print("== 1. 备份旧 static ==")
    out, err = ex(f"rm -rf {REMOTE}/backend/static_old && "
                  f"cp -r {REMOTE}/backend/static {REMOTE}/backend/static_old && echo OK")
    print(" ", out or err)

    print("== 2. 上传新前端 ==")
    ex(f"rm -rf {REMOTE}/backend/static && mkdir -p {REMOTE}/backend/static/assets")
    sftp = c.open_sftp()
    sftp.put(f"{DIST}/index.html", f"{REMOTE}/backend/static/index.html")
    print("  ok index.html")
    for i, fn in enumerate(assets, 1):
        sftp.put(f"{DIST}/assets/{fn}", f"{REMOTE}/backend/static/assets/{fn}")
        if i % 20 == 0 or i == len(assets):
            print(f"  uploaded {i}/{len(assets)}")
    sftp.close()

    print("== 3. 重启服务 ==")
    out, err = ex("systemctl restart zhiyi && sleep 5 && systemctl is-active zhiyi")
    print("  service:", out or err)
    c.close()

    print("\n== 4. 线上验证 ==")
    time.sleep(2)
    print("  health:", get_json("/api/health")[:120])
    html = urllib.request.urlopen(BASE + "/", timeout=20).read().decode("utf-8")
    m = re.search(r'assets/([^"]+\.js)', html)
    js = m.group(1) if m else "?"
    print("  页面 JS:", js)
    print("  含新构建(DwL6sZWN):", "DwL6sZWN" in html)

    # 校验主 JS 与主 CSS 可访问
    for ref in re.findall(r'assets/([^"]+\.(?:js|css))', html):
        code = urllib.request.urlopen(f"{BASE}/assets/{ref}", timeout=20).getcode()
        print(f"  {ref} -> {code}")
    print("\nDONE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("EXC:", type(e).__name__, e)
        sys.exit(1)
