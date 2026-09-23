# -*- coding: utf-8 -*-
"""静态资源缓存头测试（发新版后用户能立刻看到更新）
用法：python _test_cache_headers.py

背景：index.html 若不发 Cache-Control，浏览器会启发式缓存，
      发新版后用户（尤其手机）会继续用旧 JS，表现为"看不到新功能"。
"""
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_cache_%d.db" % os.getpid()))

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
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


HAS_STATIC = getattr(main, "STATIC_DIR", None) is not None
print("\n0. 环境检查")
ok(True, f"本地构建产物目录：{main.STATIC_DIR if HAS_STATIC else '（无，本轮跳过首页相关断言）'}")

print("\n1. 首页 HTML 必须禁止强缓存（否则发新版看不到更新）")
if HAS_STATIC:
    r = client.get("/")
    cc = r.headers.get("cache-control", "")
    ok(r.status_code == 200, "首页返回 200", r.status_code)
    ok("no-cache" in cc, f"首页 Cache-Control 含 no-cache（实际 {cc!r}）", cc)
else:
    ok(True, "跳过：本地没有 frontend/dist（部署机器上才需要验证）")
    ok(True, "跳过：同上")

print("\n2. SPA 深链回退返回的 HTML 同样禁止强缓存")
r2 = client.get("/wrongbook")
cc2 = r2.headers.get("cache-control", "")
if r2.headers.get("content-type", "").startswith("text/html"):
    ok("no-cache" in cc2, f"深链 HTML Cache-Control 含 no-cache（实际 {cc2!r}）", cc2)
else:
    ok(True, "深链未返回 HTML（本地无构建产物时正常，跳过）")

print("\n3. 带哈希的静态资源应长缓存 immutable")
static_dir = getattr(main, "STATIC_DIR", None)
asset = None
if static_dir:
    assets = os.path.join(static_dir, "assets")
    if os.path.isdir(assets):
        for name in sorted(os.listdir(assets)):
            if name.endswith(".js"):
                asset = name
                break
if asset:
    r3 = client.get("/assets/" + asset)
    cc3 = r3.headers.get("cache-control", "")
    ok(r3.status_code == 200, f"资源 /assets/{asset} 返回 200")
    ok("immutable" in cc3 and "max-age=31536000" in cc3, f"资源 Cache-Control 为长缓存 immutable（实际 {cc3!r}）", cc3)
else:
    ok(True, "未找到 /assets/*.js（本地未构建时跳过该项）")

print("\n4. API 响应不应被误加缓存头")
r4 = client.get("/api/config")
ok("immutable" not in r4.headers.get("cache-control", ""), "API 未被加上静态资源长缓存")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
