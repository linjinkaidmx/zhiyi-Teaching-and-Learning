# -*- coding: utf-8 -*-
"""SPA 深链回退测试（vue-router history 模式部署前必须通过）
用法：python _test_spa_fallback.py

背景：/wrongbook、/more 这类前端路由在服务器上没有实体文件，
      StaticFiles(html=True) 对缺失路径返回 404，必须回退到 index.html。
"""
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_spa_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)

pass_n = 0
fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + (f"  → {extra}" if extra is not None else ""))


# 用临时静态目录做测试，不依赖本地是否已有真实构建产物
# （回退路由在每次请求时调用模块内的 _resolve_static_dir，因此替换该函数即可）
MARKER = '<div id="zy-spa-marker"></div>'
sandbox = os.path.join(tempfile.gettempdir(), "zhiyi_spa_static_%d" % os.getpid())
os.makedirs(os.path.join(sandbox, "assets"), exist_ok=True)
with open(os.path.join(sandbox, "index.html"), "w", encoding="utf-8") as f:
    f.write(f"<!DOCTYPE html><html><body>{MARKER}</body></html>")
with open(os.path.join(sandbox, "assets", "app.js"), "w", encoding="utf-8") as f:
    f.write("console.log('real js asset')\n")
main._resolve_static_dir = lambda: main.Path(sandbox)
print("使用临时静态目录:", sandbox)

print("\n1. 前端路由深链都回退到 index.html")
for path in ["/", "/capture", "/wrongbook", "/wrongbook/123", "/practice/quiz", "/chat", "/more", "/me",
             "/course", "/timetable", "/data", "/records", "/community", "/about", "/help"]:
    r = client.get(path)
    ok(r.status_code == 200 and MARKER in r.text, f"{path} → 200 且返回 index.html", r.status_code)

print("\n2. 静态资源按文件返回（关键：不能被兜底成 index.html）")
r = client.get("/assets/app.js")
ok(r.status_code == 200, "/assets/app.js → 200", r.status_code)
ok(r.text.strip() == "console.log('real js asset')", "/assets/app.js 返回真实 JS 内容", r.text[:60])
ct = r.headers.get("content-type", "")
ok("javascript" in ct, f"/assets/app.js 是 JS 的 content-type（实际 {ct}）", ct)
ok(MARKER not in r.text, "/assets/app.js 不包含 index.html 内容（未被兜底）")

r = client.get("/index.html")
ok(r.status_code == 200 and MARKER in r.text, "/index.html 走文件系统")
r = client.get("/definitely-missing-asset.js")
ok(r.status_code == 200 and MARKER in r.text, "缺失的静态文件回退到 index.html（前端路由兜底）")

print("\n3. /api/* 不受影响")
r = client.get("/api/health")
ok(r.status_code == 200 and r.json().get("ok") is True, "/api/health 正常")
r = client.get("/api/definitely-not-exist")
ok(r.status_code == 404, "未知 /api/* 返回 404（不会被回退成 HTML）")
ok("text/html" not in r.headers.get("content-type", ""), "未知 /api/* 不返回 HTML")
r = client.post("/api/sync/pull", json={"token": "bad"})
ok(r.status_code == 200 and r.json().get("ok") is False, "POST /api/* 仍走业务逻辑")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
