"""发帖 card 参数回归：null / 省略 / 正常卡片 都应通过（修复「请求参数有误：字段 card」）。

用法：python _test_forum_null_card.py
"""

import test_support  # isolated database, no credentials or network
import os
import sys
import tempfile
import types

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_forum_card_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    print(("[PASS] " if cond else "[FAIL] ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)
PW = "pass123456"
reg = client.post("/api/account/register", json={"nickname": "card_tester", "password": PW, "password_confirm": PW}).json()
check("注册成功", reg.get("ok") is True)
tok = reg["token"]

# 1) card 显式 null（前端旧行为的复现）
r = client.post("/api/forum/post", json={"token": tok, "type": "thought", "title": "感想帖", "content": "正文", "card": None}).json()
check("card=null 发感想帖（原 bug 场景）", r.get("ok") is True, r.get("error"))

# 2) 完全不传 card 字段
r = client.post("/api/forum/post", json={"token": tok, "type": "thought", "title": "不传 card", "content": "正文"}).json()
check("省略 card 字段", r.get("ok") is True, r.get("error"))

# 3) 正常题目卡片
card = {"question": "求导 $f(x)=x^2$", "answer": "$2x$", "steps": [], "knowledgePoints": ["导数"]}
r = client.post("/api/forum/post", json={"token": tok, "type": "question", "title": "题目帖", "content": "", "card": card}).json()
check("正常题目卡片", r.get("ok") is True and r["post"]["card"]["knowledgePoints"] == ["导数"], str(r)[:160])

# 4) 空对象 card（兼容旧前端另一种写法）
r = client.post("/api/forum/post", json={"token": tok, "type": "thought", "title": "空卡", "content": "x", "card": {}}).json()
check("card={} 空对象", r.get("ok") is True, r.get("error"))

# 5) 列表能看到 4 条
r = client.post("/api/forum/list", json={"sort": "latest", "limit": 10, "offset": 0}).json()
check("列表共 4 条", r.get("total") == 4, str(r.get("total")))

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
