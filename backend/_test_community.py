"""社区（论坛 + 学习小组）接口层测试：MOCK 下跑通全链路 + 鉴权 + 改名/注销迁移。

用法：python _test_community.py
说明：Windows 打桩 resource；用独立临时库，不污染本地数据；默认 MOCK=1。
"""
import json
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
_tmp = tempfile.mkdtemp(prefix="zhiyi_community_test_")
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


# 1) 游客可看论坛空列表
r = client.post("/api/forum/list", json={"sort": "latest", "limit": 10, "offset": 0}).json()
check("游客可看论坛列表", r.get("ok") is True and r.get("total") == 0)

# 2) 未登录发帖被拒
r = client.post("/api/forum/post", json={"token": "", "type": "thought", "title": "t", "content": "c"}).json()
check("未登录发帖被拒", r.get("ok") is False)

# 3) 注册两个用户
A = reg("comm_a")
B = reg("comm_b")
check("注册 A", A.get("ok") is True and A.get("token"))
check("注册 B", B.get("ok") is True and B.get("token"))
tokA, tokB = A["token"], B["token"]

# 4) A 发感想帖
r = client.post("/api/forum/post", json={
    "token": tokA, "type": "thought", "title": "我的学习感想", "content": "今天刷了 10 道题",
}).json()
check("发感想帖", r.get("ok") is True and r["post"]["type"] == "thought")
pid = r["post"]["id"]

# 5) A 发题目帖（带卡片）
card = {"question": "已知 P(A)=0.4，求 P(非A)", "answer": "0.6",
        "knowledgePoints": ["概率"], "subject": "概率论", "steps": []}
r = client.post("/api/forum/post", json={
    "token": tokA, "type": "question", "title": "一道概率题求教", "content": "", "card": card,
}).json()
check("发题目帖", r.get("ok") is True and r["post"]["card"]["knowledgePoints"] == ["概率"])
qpid = r["post"]["id"]

# 6) 游客看列表有 2 条
r = client.post("/api/forum/list", json={"sort": "latest", "limit": 10, "offset": 0}).json()
check("列表 2 条", r.get("total") == 2)

# 7) B 评论 + 点赞
r = client.post("/api/forum/comment", json={"token": tokB, "post_id": pid, "content": "加油"}).json()
check("评论", r.get("ok") is True)
r = client.post("/api/forum/like", json={"token": tokB, "post_id": pid}).json()
check("点赞", r.get("ok") is True and r.get("liked") is True and r.get("count") == 1)
r = client.post("/api/forum/like", json={"token": tokB, "post_id": pid}).json()
check("再点取消赞", r.get("liked") is False and r.get("count") == 0)

# 8) 详情带计数
r = client.post("/api/forum/detail", json={"post_id": pid}).json()
check("详情带评论计数", r["post"]["comment_count"] == 1)

# 9) B 删 A 的帖被拒
r = client.post("/api/forum/post/delete", json={"token": tokB, "post_id": pid}).json()
check("不能删别人的帖", r.get("ok") is False)

# 10) 小组：A 建组
r = client.post("/api/group/create", json={"token": tokA, "name": "高数互助", "description": ""}).json()
check("建组", r.get("ok") is True and r["group"]["invite_code"])
gid = r["group"]["id"]
code = r["group"]["invite_code"]

# 11) B 邀请码加入
r = client.post("/api/group/join", json={"token": tokB, "invite_code": code}).json()
check("邀请码加入", r.get("ok") is True)

# 12) A 发题目卡片消息
msg_card = json.dumps({"question": "求导 f(x)=x^2", "answer": "2x", "knowledgePoints": ["导数"]}, ensure_ascii=False)
r = client.post("/api/group/send", json={"token": tokA, "group_id": gid, "type": "question", "content": msg_card}).json()
check("发组内题目消息", r.get("ok") is True)

# 13) B（成员）看消息
r = client.post("/api/group/messages", json={"token": tokB, "group_id": gid}).json()
check("成员看组消息", r.get("ok") is True and r.get("total") == 1)

# 14) 非成员被拒
C = reg("comm_c")
r = client.post("/api/group/messages", json={"token": C["token"], "group_id": gid}).json()
check("非成员看消息被拒", r.get("ok") is False)

# 15) 昵称邀请：A 邀请 C
r = client.post("/api/group/invite", json={"token": tokA, "group_id": gid, "nickname": "comm_c"}).json()
check("昵称邀请入组", r.get("ok") is True)

# 16) 非 owner 邀请被拒
r = client.post("/api/group/invite", json={"token": tokB, "group_id": gid, "nickname": "comm_c"}).json()
check("非 owner 邀请被拒", r.get("ok") is False)

# 17) 我的小组列表
r = client.post("/api/group/my", json={"token": tokB}).json()
check("我的小组", r.get("ok") is True and len(r["groups"]) == 1 and r["groups"][0]["member_count"] == 3)

# 18) 改名迁移：A → comm_a2，帖子作者跟着改
r = client.post("/api/account/rename", json={"token": tokA, "password": PW, "new_nickname": "comm_a2"}).json()
check("A 改名", r.get("ok") is True)
tokA2 = r["token"]
r = client.post("/api/forum/detail", json={"post_id": pid}).json()
check("帖子作者随改名迁移", r["post"]["user_id"] == "comm_a2")

# 19) 注销 B：评论匿名化、帖子保留
r = client.post("/api/account/delete", json={"token": tokB, "password": PW}).json()
check("注销 B", r.get("ok") is True)
r = client.post("/api/forum/detail", json={"post_id": pid}).json()
check("帖子仍存在", r.get("ok") is True)
r = client.post("/api/forum/comments/list", json={"post_id": pid}).json()
check("评论匿名化", any(c["user_id"] == "" for c in r["comments"]))

# 20) 注销 A：帖子匿名化 + 组解散
r = client.post("/api/account/delete", json={"token": tokA2, "password": PW}).json()
check("注销 A", r.get("ok") is True)
r = client.post("/api/forum/detail", json={"post_id": pid}).json()
check("A 帖子匿名化", r["post"]["user_id"] == "")
r = client.post("/api/forum/detail", json={"post_id": qpid}).json()
check("A 题目帖也匿名化", r["post"]["user_id"] == "")

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
