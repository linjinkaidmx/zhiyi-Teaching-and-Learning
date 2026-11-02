# -*- coding: utf-8 -*-
"""静态文件 304 协商缓存 离线回归（2026-10-08）
背景：spa_fallback 裸 FileResponse 不处理 If-None-Match，304 永不生效，
立绘/差分 no-cache 头导致每次进页整张重下（线上实测 365KB×2/次）。
用法：python _test_static_304.py   （离线，不起服务、不连网络）
"""

import test_support  # isolated database, no credentials or network
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_304_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


client = TestClient(main.app)

# 需要一个真实存在的静态文件：优先取已构建的 index.html / 任意 assets
static_dir = main._resolve_static_dir()
print("== spa_fallback 304 ==")

if not static_dir:
    print("  ⚠ 本地无 static 目录，改用临时文件注入测试目录不可行（mount 在启动时定）——跳过")
    sys.exit(0 if fail_n == 0 else 1)

# 1. 正常取一个静态文件 → 200 + ETag
r1 = client.get("/index.html")
ok(r1.status_code == 200, "index.html 正常返回 200", r1.status_code)
etag = r1.headers.get("etag", "")
ok(bool(etag), "响应带 ETag", etag)

# 2. 带 If-None-Match 回源 → 304（修复点核心断言）
r2 = client.get("/index.html", headers={"If-None-Match": etag})
ok(r2.status_code == 304, "同 ETag 回源返回 304", r2.status_code)
ok(r2.headers.get("etag") == etag, "304 响应回带 ETag")

# 3. ETag 不匹配 → 200 全量
r3 = client.get("/index.html", headers={"If-None-Match": '"deadbeef"'})
ok(r3.status_code == 200, "ETag 不匹配返回 200 全量", r3.status_code)

# 4. 任意静态子路径文件（如有）同规则
probe = None
for root, _dirs, files in os.walk(static_dir):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), static_dir).replace("\\", "/")
        if rel.endswith((".js", ".css", ".png", ".webp", ".ico")):
            probe = rel
            break
    if probe:
        break
if probe:
    ra = client.get("/" + probe)
    rb = client.get("/" + probe, headers={"If-None-Match": ra.headers.get("etag", "")})
    ok(ra.status_code == 200 and rb.status_code == 304, "子路径静态文件同样 304（%s）" % probe,
       (ra.status_code, rb.status_code))
else:
    print("  ⚠ 无静态子文件可测，跳过")

# 5. API 路由不受影响
r5 = client.post("/api/companion/history", json={})
ok(r5.status_code in (200, 400, 401, 422), "API 路由不受 304 逻辑影响", r5.status_code)

# 6. SPA 深链回退仍回 HTML
r6 = client.get("/companion")
ok(r6.status_code == 200 and "text/html" in r6.headers.get("content-type", ""), "SPA 深链 /companion 仍回 HTML", r6.status_code)

# 7. 缓存头分支：带 ?v= 的伴学资产 → immutable；不带 → no-cache
from fastapi import Request as _Req  # noqa: E402  （仅用于构造假 scope 判断，不走真实请求）


def cache_header_for(path, query=""):
    """直接构造最小 scope 走 cache_headers 中间件逻辑：经由 TestClient 请求一个真实文件路径不带文件时不可行，
    这里直接请求 /companions/ 下真实文件（若存在）分别带与不带 v= 查询。"""
    target = os.path.join(static_dir, path.lstrip("/"))
    if not os.path.isfile(target):
        return None
    q = ("?" + query) if query else ""
    r = client.get(path + q)
    return r.headers.get("cache-control", "")


cc_png = cache_header_for("/companions/chibi_girl.png")
if cc_png is not None:
    ok("no-cache" in cc_png, "无版本号伴学资产仍 no-cache", cc_png)
    cc_v = cache_header_for("/companions/chibi_girl.png", "v=1")
    ok("immutable" in cc_v, "带 ?v= 伴学资产强缓存 immutable", cc_v)
else:
    print("  ⚠ 本地无 companions 资产，缓存分支留待线上探针验证")

# 8. HTML no-cache 语义保持
ok("no-cache" in (r1.headers.get("cache-control", "") or ""), "HTML 仍 no-cache 回源校验", r1.headers.get("cache-control"))

print("\n静态304回归: %d 通过 / %d 失败" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
