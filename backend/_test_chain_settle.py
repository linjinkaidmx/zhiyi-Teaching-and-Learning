# -*- coding: utf-8 -*-
"""伴学链收官 → 错题本轻回写 离线回归（2026-10-08，MOCK=1 不连网）

覆盖：讲会一次 streak+1 / 讲会两次判掌握 / 讲崩不改错题状态只沉淀 + 记画像事件
/ 知识点事件落 user_kp_state。
用法：cd backend && python _test_chain_settle.py
"""

import test_support  # isolated database, no credentials or network
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_TMP = tempfile.mkdtemp(prefix="settle_test_")
_DB = os.path.join(_TMP, "test.db")
test_support.public_bank_fixture(_DB)
os.environ["ZHIYI_DB"] = _DB
os.environ["MOCK"] = "1"

import service      # noqa: E402
import db            # noqa: E402
import quiz_pick     # noqa: E402
service.MOCK = True   # 强制走内置 Mock：本测试不连网、不花钱（.env 有 Key 时 env 不足以关掉真实调用）
# chat_text 是底层单调用位，自身不判断 MOCK（MOCK 只在高层函数里判）→ 直接打桩，杜绝真实请求
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: "（测试桩）我听懂啦，谢谢小老师~"

import main          # noqa: E402

pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  OK  " + label)
    else:
        fail_n += 1
        print("  FAIL " + label + (("  -> " + str(extra)) if extra else ""))


NOW = int(time.time() * 1000)
DAY = 86400 * 1000
UID = "u_settle"


def item(qid="s1", streak=0, mastered=False):
    return {
        "id": qid, "question": "求极限测试题", "subject": "高等数学",
        "knowledgePoints": ["洛必达法则", "泰勒展开"], "answer": "1/2",
        "streak": streak, "mastered": mastered, "reviewAt": 0,
        "quizCount": 3, "correctCount": 0,
    }


def chain(cid, qid, wrong=()):
    return {
        "id": cid, "question_id": qid, "question": "求极限测试题",
        "subject": "高等数学",
        "steps": [{"ask": "这题怎么入手？", "expected": "洛必达", "hint": "看类型"},
                  {"ask": "答案是？", "expected": "1/2", "hint": "算到底"}],
        "progress": 2, "streak": 0, "layer_tries": 0, "wrong_steps": list(wrong),
        "status": "done", "session_id": "",
    }


def find(qid):
    for it in db.load_errorbook(UID):
        if str(it.get("id")) == str(qid):
            return it
    return None


print("\n== 1. 讲会一次：streak+1，不判掌握，推 3 天复习 ==")
db.save_errorbook(UID, [item()])
main._settle_chain(UID, chain("c1", "s1"), chain("c1", "s1")["steps"], cid="default",
                   name="小伙伴", persona="活泼")
it1 = find("s1")
ok(it1 is not None, "错题条还在")
ok(int(it1.get("streak") or 0) == 1, "streak=1", it1.get("streak"))
ok(it1.get("taughtOk") is True, "taughtOk=True")
ok(not it1.get("mastered"), "一次讲会不判掌握", it1.get("mastered"))
ok(abs(int(it1.get("reviewAt") or 0) - (NOW + 3 * DAY)) < 5 * 60 * 1000,
   "reviewAt ≈ +3 天", it1.get("reviewAt"))
ev1 = (db.kp_state_load(UID) or {}).get("events", {})
ok(int(ev1.get("洛必达法则", {}).get("good") or 0) == 1, "知识点记 good=1", ev1)
ok(int(ev1.get("泰勒展开", {}).get("good") or 0) == 1, "第二个知识点也记 good", ev1)

print("\n== 2. 讲会两次：判掌握 ==")
main._settle_chain(UID, chain("c2", "s1"), chain("c2", "s1")["steps"], cid="default",
                   name="小伙伴", persona="活泼")
it2 = find("s1")
ok(int(it2.get("streak") or 0) == 2, "streak=2", it2.get("streak"))
ok(it2.get("mastered") is True, "连续讲会 2 次 → mastered=True", it2.get("mastered"))

print("\n== 3. 讲崩：不改原错题状态，沉淀错题 + 记 bad ==")
main._settle_chain(UID, chain("c3", "s1", wrong=(0,)), chain("c3", "s1")["steps"],
                   cid="default", name="小伙伴", persona="活泼")
it3 = find("s1")
ok(int(it3.get("streak") or 0) == 2, "讲崩不动 streak", it3.get("streak"))
ok(it3.get("mastered") is True, "讲崩不动 mastered", it3.get("mastered"))
settled = [x for x in db.load_errorbook(UID) if str(x.get("id") or "").startswith("chain-")]
ok(len(settled) >= 1, "讲崩层沉淀进错题本", len(settled))
if settled:
    ok(settled[0].get("subject") == "高等数学", "沉淀条目带科目", settled[0].get("subject"))
    ok("洛必达法则" in (settled[0].get("knowledgePoints") or []), "沉淀条目带知识点",
       settled[0].get("knowledgePoints"))
ev3 = (db.kp_state_load(UID) or {}).get("events", {})
ok(int(ev3.get("洛必达法则", {}).get("bad") or 0) == 1, "知识点记 bad=1", ev3)

print("\n== 4. 讲崩知识点进画像（影响后续出题） ==")
prof = quiz_pick.build_profile(UID)
w = next((v["w"] for v in prof["kps"] if v["kp"] == "洛必达法则"), 0)
ok(w >= 2, "画像里讲崩知识点有权重（2*bad-good）", w)

print("\n== 5. 题库题（bank-）讲会：不污染错题本，只记事件 ==")
uid2 = "u_settle_bank"
db.save_errorbook(uid2, [])
main._settle_chain(uid2, chain("c4", "bank-1", ), chain("c4", "bank-1")["steps"],
                   cid="default", name="小伙伴", persona="活泼")
ok(len(db.load_errorbook(uid2)) == 0, "题库题讲会不写错题本", db.load_errorbook(uid2))
ev5 = (db.kp_state_load(uid2) or {}).get("events", {})
ok(len(ev5) >= 1, "题库题讲会也记知识点事件", list(ev5)[:3])

print("\n------ %d passed, %d failed ------" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
