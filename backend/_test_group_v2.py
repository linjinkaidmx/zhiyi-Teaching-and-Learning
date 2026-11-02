"""学习小组 v2（退出 / 解散 / 移除成员）接口层回归测试。

用法：python _test_group_v2.py
说明：独立临时库，不污染本地数据；默认 MOCK=1。
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
_tmp = tempfile.mkdtemp(prefix="zhiyi_group_v2_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)
PW = "pass123456"


def reg(nick):
    return client.post("/api/account/register", json={
        "nickname": nick, "password": PW, "password_confirm": PW,
    }).json()


A = reg("grp_owner")
B = reg("grp_member")
C = reg("grp_out")
check("注册三个用户", all(x.get("ok") and x.get("token") for x in (A, B, C)))
tokA, tokB, tokC = A["token"], B["token"], C["token"]

r = client.post("/api/group/create", json={"token": tokA, "name": "测试小组", "description": "d"}).json()
check("A 建组", r.get("ok") is True)
gid, code = r["group"]["id"], r["group"]["invite_code"]

r = client.post("/api/group/join", json={"token": tokB, "invite_code": code}).json()
check("B 加入", r.get("ok") is True)

# ---- 退出 ----
r = client.post("/api/group/quit", json={"token": tokC, "group_id": gid}).json()
check("非成员退出被拒", r.get("ok") is False, r.get("error"))

r = client.post("/api/group/quit", json={"token": tokA, "group_id": gid}).json()
check("组长不能直接退出", r.get("ok") is False, r.get("error"))

r = client.post("/api/group/quit", json={"token": tokB, "group_id": gid}).json()
check("成员退出成功", r.get("ok") is True, r.get("error"))

r = client.post("/api/group/quit", json={"token": tokB, "group_id": gid}).json()
check("退出后不能再退", r.get("ok") is False)

r = client.post("/api/group/messages", json={"token": tokB, "group_id": gid}).json()
check("退出后看消息被拒", r.get("ok") is False)

# ---- 移除成员 ----
client.post("/api/group/join", json={"token": tokB, "invite_code": code})
r = client.post("/api/group/remove-member", json={"token": tokB, "group_id": gid, "user_id": "grp_member"}).json()
check("非组长移除成员被拒", r.get("ok") is False, r.get("error"))

r = client.post("/api/group/remove-member", json={"token": tokA, "group_id": gid, "user_id": "grp_owner"}).json()
check("组长不能移除自己", r.get("ok") is False)

r = client.post("/api/group/remove-member", json={"token": tokA, "group_id": gid, "user_id": "grp_member"}).json()
check("组长移除成员成功", r.get("ok") is True, r.get("error"))

r = client.post("/api/group/detail", json={"token": tokB, "group_id": gid}).json()
check("被移除后进不了组", r.get("ok") is False)

r = client.post("/api/group/detail", json={"token": tokA, "group_id": gid}).json()
check("成员列表只剩组长", r.get("ok") is True and len(r.get("members", [])) == 1, str(r.get("members")))

# ---- 解散 ----
r = client.post("/api/group/dissolve", json={"token": tokB, "group_id": gid}).json()
check("非组长解散被拒", r.get("ok") is False, r.get("error"))

r = client.post("/api/group/dissolve", json={"token": tokA, "group_id": gid}).json()
check("组长解散成功", r.get("ok") is True, r.get("error"))

r = client.post("/api/group/detail", json={"token": tokA, "group_id": gid}).json()
check("解散后小组不存在", r.get("ok") is False and "不存在" in (r.get("error") or ""), r.get("error"))

r = client.post("/api/group/my", json={"token": tokA}).json()
check("解散后我的小组为空", r.get("ok") is True and len(r.get("groups", [])) == 0, str(r.get("groups")))

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
