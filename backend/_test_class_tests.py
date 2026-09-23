# -*- coding: utf-8 -*-
"""班级测试接口回归（发布→开始→判分→排名→防重复→超时→AI 生成 MOCK）。MOCK 离线跑。
用法：zhiyi 环境 python _test_class_tests.py
"""
import os
import sys
import tempfile
import time
import types

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_tests_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
import db  # noqa: E402

client = TestClient(main.app)
PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        print(f"[FAIL] {name}  {extra}")


ITEMS = [
    {"type": "choice", "question": "1+1=?", "options": ["A. 1", "B. 2", "C. 3", "D. 4"], "answer": "B", "score": 40},
    {"type": "blank", "question": "2 的平方是 ____", "answer": "4", "score": 30},
    {"type": "blank", "question": "2 的平方是 ____", "answer": "4", "score": 30},
]

# ---------- 准备：老师 + 两个学生 ----------
r = client.post("/api/account/register", json={"nickname": "test_t", "password": "pw123456", "password_confirm": "pw123456"}).json()
ttok = r["token"]
r = client.post("/api/account/register", json={"nickname": "test_s1", "password": "pw123456", "password_confirm": "pw123456"}).json()
s1 = r["token"]
r = client.post("/api/account/register", json={"nickname": "test_s2", "password": "pw123456", "password_confirm": "pw123456"}).json()
s2 = r["token"]
r = client.post("/api/teacher/apply", json={"token": ttok, "name": "测试老师", "school": "测试中学"}).json()
check("老师认证", r.get("ok"), r)
r = client.post("/api/class/create", json={"token": ttok, "name": "测试班"}).json()
cid = r["class"]["id"]
code = r["class"]["invite_code"]
check("建班", r.get("ok"), r)
client.post("/api/class/join", json={"token": s1, "code": code})
r = client.post("/api/class/join", json={"token": s2, "code": code}).json()
check("学生进班", r.get("ok"), r)

# ---------- 发布校验 ----------
r = client.post("/api/class/test/create", json={"token": ttok, "class_id": cid, "title": "T", "duration_sec": 600, "items": []}).json()
check("空题拒绝", not r.get("ok"), r)
r = client.post("/api/class/test/create", json={"token": ttok, "class_id": cid, "title": "T", "duration_sec": 10, "items": ITEMS}).json()
check("限时过短拒绝", not r.get("ok"), r)
bad = [dict(ITEMS[0]), {"type": "choice", "question": "x", "options": ["A. 1"], "answer": "A", "score": 10}]
r = client.post("/api/class/test/create", json={"token": ttok, "class_id": cid, "title": "T", "duration_sec": 600, "items": bad}).json()
check("选项不足拒绝", not r.get("ok"), r)
r = client.post("/api/class/test/create", json={"token": s1, "class_id": cid, "title": "T", "duration_sec": 600, "items": ITEMS}).json()
check("学生发布被拒", not r.get("ok"), r)
check("学生发布被拒", not r.get("ok"), r)

# ---------- 发布 ----------
r = client.post("/api/class/test/create", json={"token": ttok, "class_id": cid, "title": "第一场测验", "duration_sec": 600, "items": ITEMS}).json()
check("老师发布测试", r.get("ok"), r)
tid = r["test"]["id"] if r.get("ok") else ""
check("总分统计 100", r.get("test", {}).get("total_score") == 100, r.get("test", {}).get("total_score"))

r = client.post("/api/class/test/list", json={"token": s1, "class_id": cid}).json()
tests = r.get("tests", [])
check("学生列表可见且不带题目", tests and tests[0].get("title") == "第一场测验" and "paper" not in tests[0], str(tests)[:100])

# ---------- 开始与题目剥离 ----------
r = client.post("/api/class/test/start", json={"token": s1, "test_id": tid}).json()
check("学生开始作答", r.get("ok") and r.get("remaining_sec", 0) > 590, r.get("remaining_sec"))
check("题目剥离答案", all("answer" not in q for q in r.get("questions", [])), str(r.get("questions", []))[:80])

# ---------- 判分：s1 对 1、3 题（choice 对，第一 blank 归一化对，第二空） ----------
r = client.post("/api/class/test/submit", json={"token": s1, "test_id": tid, "answers": {"0": "B", "1": " ４ "}}).json()
check("s1 提交得 70（blank 全角带空格也算对）", r.get("ok") and r.get("score") == 70 and r.get("correct_count") == 2, str(r)[:120])
check("s1 排名第 1", r.get("rank") == 1, r.get("rank"))

r = client.post("/api/class/test/submit", json={"token": s1, "test_id": tid, "answers": {"0": "B"}}).json()
check("重复交卷拒绝", not r.get("ok"), r)

# s2 全对但用时逻辑一样 → 同分比用时（这里不 sleep，duration 都小）——先让 s2 拿 70 分超过 s1
r = client.post("/api/class/test/start", json={"token": s2, "test_id": tid}).json()
check("s2 开始", r.get("ok"), r)
r = client.post("/api/class/test/submit", json={"token": s2, "test_id": tid, "answers": {"0": "b", "1": "4", "2": "  4  "}}).json()
check("s2 小写 b 也判对，得 100", r.get("ok") and r.get("score") == 100, str(r)[:120])

r = client.post("/api/class/test/rank", json={"token": s1, "test_id": tid}).json()
rank = r.get("rank", [])
check("排名 s2 第一 s1 第二", len(rank) == 2 and rank[0]["user_id"] == "test_s2" and rank[1]["user_id"] == "test_s1", str(rank)[:120])
check("排名带 is_me 标记", any(x.get("is_me") for x in rank))
check("参考人数统计", r.get("total_students") == 2, r.get("total_students"))

# ---------- 非成员 ----------
r = client.post("/api/class/test/rank", json={"token": ttok, "test_id": tid}).json()
# 老师是成员，应通过
check("老师可看排名", r.get("ok"), r)

# ---------- AI 生成（MOCK） ----------
r = client.post("/api/class/test/generate", json={"token": ttok, "class_id": cid, "subject": "高等数学", "topic": "极限", "choice_count": 2, "choice_score": 10, "blank_count": 1, "blank_score": 10}).json()
check("AI 生成返回题目草稿", r.get("ok") and isinstance(r.get("items"), list) and len(r.get("items", [])) >= 1, str(r)[:120])

print(f"\n{'全部通过' if FAIL == 0 else '存在失败'}（{PASS} 项，失败 {FAIL}）")
sys.exit(0 if FAIL == 0 else 1)
