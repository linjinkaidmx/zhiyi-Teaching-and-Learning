# -*- coding: utf-8 -*-
"""精准出题 接口层冒烟（2026-10-08，TestClient 离线，不连网）

只打不调模型的两个动作：peek（冒泡预览）与 start（角色考你）。
验证：接口接线正常 / source 标签正确 / 空库只出四方向 / 有错题优先出错题。
用法：cd backend && python _test_quiz_api.py
"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_TMP = tempfile.mkdtemp(prefix="quizapi_test_")
_DB = os.path.join(_TMP, "test.db")
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "zhiyi.db"), _DB)
os.environ["ZHIYI_DB"] = _DB

import auth       # noqa: E402
import db         # noqa: E402
import quiz_pick  # noqa: E402
import service    # noqa: E402
service.MOCK = True
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: "（测试桩）"
import main       # noqa: E402

pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  OK  " + label)
    else:
        fail_n += 1
        print("  FAIL " + label + (("  -> " + str(extra)) if extra else ""))


try:
    from fastapi.testclient import TestClient
except Exception:
    from starlette.testclient import TestClient

client = TestClient(main.app)
NOW = int(time.time() * 1000)


def signup(nick):
    r = client.post("/api/account/register", json={"nickname": nick, "password": "test1234",
                                                   "password_confirm": "test1234", "client_id": "qa"})
    d = r.json() or {}
    return d.get("token") or "", d.get("error") or ""


print("\n== 1. 注册并拿 token ==")
tok, tok_err = signup("qa_pick_1")
ok(bool(tok), "注册成功拿到 token", (tok[:12] if tok else tok_err))

print("\n== 2. 空库 peek：只出四方向 ==")
seen = []
for _ in range(8):
    r = client.post("/api/companion/quiz", json={"token": tok, "action": "peek",
                                                 "character": "default", "name": "小伙伴"})
    d = r.json() or {}
    if d.get("empty"):
        continue
    seen.append((quiz_pick.subject_direction(d.get("subject")), d.get("source"), d.get("question", "")[:20]))
ok(len(seen) == 8, "8 次都有题", len(seen))
ok(all(s[0] for s in seen), "全部落在四方向", set(s[0] for s in seen))
ok(all(str(s[1]).startswith("题库") for s in seen), "source 均为题库系列", set(s[1] for s in seen))
ok(len(set(s[2] for s in seen)) >= 6, "轮换下题目多样", len(set(s[2] for s in seen)))

print("\n== 3. 有错题后 peek：优先出错题本 ==")
db.save_errorbook("qa_pick_1", [{
    "id": "qa1", "question": "求极限测试题（专属标记XYZ）", "subject": "高等数学",
    "knowledgePoints": ["洛必达法则"], "mastered": False, "reviewAt": 0,
    "quizCount": 4, "correctCount": 0, "answer": "1/2",
}])
r = client.post("/api/companion/quiz", json={"token": tok, "action": "peek",
                                             "character": "default", "name": "小伙伴"})
d = r.json() or {}
ok("XYZ" in str(d.get("question") or ""), "出的是错题本那道", d.get("question"))
ok(d.get("source") in ("SRS 到期", "错题本"), "source 为错题本系", d.get("source"))
ok(d.get("subject") == "高等数学", "科目透传正确", d.get("subject"))

print("\n== 4. start（角色考你）同样走精准匹配 ==")
r2 = client.post("/api/companion/quiz", json={"token": tok, "action": "start",
                                              "character": "default", "name": "小伙伴",
                                              "persona": "活泼"})
d2 = r2.json() or {}
ok(d2.get("ok") and not d2.get("empty"), "start 成功", d2.get("error"))
ok("XYZ" in str(d2.get("question") or ""), "start 也出错题本那道", d2.get("question"))
ok(isinstance(d2.get("left"), int), "返回剩余轮次", d2.get("left"))

print("\n== 5. 指定 question_id 直取（链续教复取路径，走 start） ==")
r3 = client.post("/api/companion/quiz", json={"token": tok, "action": "start",
                                              "character": "default", "name": "小伙伴",
                                              "persona": "活泼", "question_id": "bank-3"})
d3 = r3.json() or {}
ok(d3.get("question_id") == "bank-3", "按 id 直取 bank-3", d3.get("question_id"))

print("\n------ %d passed, %d failed ------" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
