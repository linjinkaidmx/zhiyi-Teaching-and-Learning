# -*- coding: utf-8 -*-
"""精准出题引擎 离线回归（2026-10-08，不连网、不花钱）

覆盖：学科归一 / 四方向白名单 / 轮换覆盖 / 知识点加权 / 同类补题去重
/ 指定 id 直取 / SRS 到期优先 / 伴学事件影响画像 / 考试倒计时加权。

用法：cd backend && python _test_quiz_pick.py
DB 使用公开题库与种子字面量构建，不读取真实账号数据库。
"""

import test_support  # isolated database, no credentials or network
import os
import random
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_TMP = tempfile.mkdtemp(prefix="quizpick_test_")
_DB = os.path.join(_TMP, "test.db")
test_support.public_bank_fixture(_DB, include_seeds=True)
os.environ["ZHIYI_DB"] = _DB

import db            # noqa: E402
import quiz_pick     # noqa: E402

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


def err_item(qid, subject, kps, mastered=False, review_at=0, quiz_count=0, correct=0):
    return {
        "id": qid, "question": "测试题 " + qid, "subject": subject,
        "knowledgePoints": kps, "mastered": mastered, "reviewAt": review_at,
        "quizCount": quiz_count, "correctCount": correct, "answer": "x",
    }


print("\n== 1. 学科归一与方向映射 ==")
cases = [
    ("高等数学", "高数", "高数"),
    ("高等数学（微积分）", "高数", "高数"),
    ("数学分析/微积分", "高数", "高数"),
    ("概率论与数理统计", "概率统计", "概率统计"),
    ("概率论", "概率统计", "概率统计"),
    ("数据结构与算法", "数据结构", "计算机算法"),
    ("C语言程序设计", "C语言", "计算机算法"),
    ("Python程序设计", "Python", "计算机算法"),
    ("大学物理", "大物", "大物"),
    ("理论力学", "理论力学", "大物"),
    ("普通化学", "化学", ""),
    ("数学物理方程", "数理方程", ""),
]
for subj, short, d in cases:
    ok(quiz_pick.subject_short(subj) == short, "subject_short(%s)=%s" % (subj, short),
       quiz_pick.subject_short(subj))
    ok(quiz_pick.subject_direction(subj) == d, "direction(%s)=%s" % (subj, d or "无"),
       quiz_pick.subject_direction(subj))
ok(quiz_pick.course_direction("数据结构与算法A") == "计算机算法", "课程名→方向（数据结构与算法A）")
ok(quiz_pick.course_direction("大学物理实验") == "大物", "课程名→方向（大学物理实验）")

print("\n== 2. 空库兜底：只出四方向 ==")
random.seed(7)
uid_empty = "u_empty"
hits = [quiz_pick.pick(uid_empty, read_only=True)[0] for _ in range(24)]   # 模拟冒泡预览
ok(all(h is not None for h in hits), "空库每次都能取到题")
dirs = [quiz_pick.subject_direction(h.get("subject")) for h in hits]
ok(all(d for d in dirs), "空库 24 次全部落在四方向内", set(dirs))
ok(len(set(dirs)) >= 3, "轮换覆盖 >=3 个方向", sorted(set(dirs)))
consec = sum(1 for i in range(1, len(dirs)) if dirs[i] == dirs[i - 1])
ok(consec == 0, "不连续两次同方向", dirs[:12])
srcs = set(quiz_pick.pick(uid_empty)[1] for _ in range(6))
ok(all(s.startswith("题库") for s in srcs), "空库 source 标为题库", srcs)

print("\n== 3. 预览也轮换方向，但不污染「真讲过」的去重队列 ==")
before = (db.kp_state_load(uid_empty) or {}).get("turn", 0)
n_before = len((db.kp_state_load(uid_empty) or {}).get("recent") or [])
for _ in range(4):
    quiz_pick.pick(uid_empty, read_only=True)
st3 = db.kp_state_load(uid_empty) or {}
ok(int(st3.get("turn") or 0) == before + 4, "预览 4 次推进 4 格游标", (before, st3.get("turn")))
ok(len(st3.get("recent") or []) == n_before, "预览不写真去重队列",
   (n_before, len(st3.get("recent") or [])))
ok(len(st3.get("peek_recent") or []) == 3, "预览去重队列保留 3 条", st3.get("peek_recent"))
quiz_pick.pick(uid_empty)
st3b = db.kp_state_load(uid_empty) or {}
ok(len(st3b.get("recent") or []) == n_before + 1, "正式出题写真去重队列",
   (n_before, len(st3b.get("recent") or [])))

print("\n== 4. 指定 question_id 直取（不被画像覆盖） ==")
it, src = quiz_pick.pick(uid_empty, question_id="bank-1")
ok(it is not None and str(it.get("id")) == "bank-1", "bank-1 直取", it and it.get("id"))
ok(src == "题库", "直取 source=题库", src)

print("\n== 5. 错题本：SRS 到期优先 ==")
uid2 = "u_due"
items = [
    err_item("e1", "高等数学", ["等价无穷小"], mastered=False, review_at=NOW - DAY),
    err_item("e2", "大学物理", ["牛顿第二定律"], mastered=False, review_at=NOW + 10 * DAY),
]
db.save_errorbook(uid2, items)
random.seed(3)
ok(quiz_pick.pick(uid2, items=items, read_only=True)[1] == "SRS 到期", "首次即到期题",
   quiz_pick.pick(uid2, items=items, read_only=True)[1])
srcs = [quiz_pick.pick(uid2, items=items)[1] for _ in range(6)]
ok(srcs.count("SRS 到期") >= 3, "6 次里到期题占多数（其余是去重让位）", srcs)
got = quiz_pick.pick(uid2, items=items)[0]
ok(str(got.get("id")) == "e1", "到期的是 e1", got.get("id"))

print("\n== 6. 未掌握错题：按知识点权重倾斜 ==")
uid3 = "u_weak"
items3 = [
    err_item("w1", "高等数学", ["链式法则"], mastered=False, review_at=NOW + 9 * DAY, quiz_count=5, correct=0),
    err_item("w2", "普通化学", ["化学平衡"], mastered=False, review_at=NOW + 9 * DAY),
]
db.save_errorbook(uid3, items3)
prof3 = quiz_pick.build_profile(uid3, items=items3)
w_a = quiz_pick.profile_weight(prof3, items3[0])
w_b = quiz_pick.profile_weight(prof3, items3[1])
ok(w_a >= w_b * 2, "薄弱题权重 >= 普通题 2 倍（%.1f vs %.1f）" % (w_a, w_b), (w_a, w_b))
random.seed(11)
got3 = [quiz_pick.pick(uid3, items=items3, read_only=True)[0].get("id") for _ in range(30)]
n_w1 = sum(1 for x in got3 if x == "w1")
# 去重会让位一半轮次，倾斜仍应明显高于均匀（>=40%）
ok(n_w1 >= 12, "高权重错题占比明显高于均匀（实际 %d/30）" % n_w1, n_w1)
ok(prof3["weak"][0] == "链式法则", "画像 top1 = 链式法则", prof3["weak"])

print("\n== 7. 全部掌握 → 薄弱知识点同类补题（不与错题本同题） ==")
uid4 = "u_same"
items4 = [err_item("m1", "高等数学", ["洛必达法则", "泰勒展开"], mastered=True,
                   review_at=NOW + 9 * DAY)]
db.save_errorbook(uid4, items4)
random.seed(5)
res4 = [quiz_pick.pick(uid4, items=items4) for _ in range(10)]
srcs4 = set(s for _, s in res4)
ok(all(s == "题库·同类" for s in srcs4), "全掌握时出同类题", srcs4)
ids4 = set(str(i.get("id")) for i, _ in res4)
ok("m1" not in ids4, "不会重复出错题本里那道", ids4)
ok(all(str(i.get("id")).startswith("bank-") for i, _ in res4), "同类题来自题库", ids4)
kp_ok = 0
for i, _ in res4:
    kps = set(i.get("knowledgePoints") or [])
    if kps & {"洛必达法则", "泰勒展开"}:
        kp_ok += 1
ok(kp_ok == len(res4), "同类题确实命中薄弱知识点", kp_ok)

print("\n== 8. 近期去重（连着问不重复同一道） ==")
uid5 = "u_recent"
items5 = [
    err_item("r1", "高等数学", ["定积分计算"], mastered=False, review_at=NOW + 9 * DAY),
    err_item("r2", "大学物理", ["转动惯量"], mastered=False, review_at=NOW + 9 * DAY),
]
db.save_errorbook(uid5, items5)
random.seed(21)
seq = [str(quiz_pick.pick(uid5, items=items5)[0].get("id")) for _ in range(4)]
repeat = sum(1 for i in range(1, len(seq)) if seq[i] == seq[i - 1])
ok(repeat == 0, "连续 4 次不重复同一道", seq)

print("\n== 9. 伴学事件影响画像（讲崩加权） ==")
uid6 = "u_event"
quiz_pick.record_event(uid6, ["安培环路定理"], "bad", "大学物理")
quiz_pick.record_event(uid6, ["安培环路定理"], "bad", "大学物理")
st6 = db.kp_state_load(uid6)
ok((st6.get("events", {}).get("安培环路定理", {}).get("bad") or 0) == 2, "讲崩计数落盘", st6.get("events"))
prof6 = quiz_pick.build_profile(uid6, items=[])
ok(prof6["weak"][:1] == ["安培环路定理"], "画像里讲崩知识点排第一", prof6["weak"])
quiz_pick.record_event(uid6, ["安培环路定理"], "good", "大学物理")
prof6b = quiz_pick.build_profile(uid6, items=[])
w_bad = next((v["w"] for v in prof6b["kps"] if v["kp"] == "安培环路定理"), 0)
ok(w_bad == 3, "讲通一次扣权（2*2-1=3）", w_bad)

print("\n== 10. 课程与考试倒计时加权 ==")
uid7 = "u_exam"
soon = time.strftime("%Y-%m-%d", time.localtime((NOW + 3 * DAY) / 1000))
far = time.strftime("%Y-%m-%d", time.localtime((NOW + 45 * DAY) / 1000))
blob = {
    "courses": [{"id": "c1", "name": "概率论与数理统计"}, {"id": "c2", "name": "数字电路"}],
    "exams": [{"id": "x1", "name": "期中考试", "date": soon, "courseId": "c1"},
              {"id": "x2", "name": "期末考试", "date": far, "courseId": "c2"}],
}
db.save_courses(uid7, blob) if hasattr(db, "save_courses") else None
prof7 = quiz_pick.build_profile(uid7, items=[])
ok(prof7["dirs"].get("概率统计", 0) >= 7, "3 天后考试 → 概率统计方向权重 >=7（2+5）",
   prof7["dirs"])
ok(prof7["dirs"].get("概率统计", 0) > prof7["dirs"].get("计网", 0), "临考方向权重高于无关方向",
   prof7["dirs"])
# 临考方向在空库轮换时被优先命中
random.seed(31)
d7 = set(quiz_pick.subject_direction(quiz_pick.pick(uid7)[0].get("subject")) for _ in range(5))
ok(d7 == {"概率统计"}, "空库+临考 → 连续命中临考方向", d7)

print("\n== 11. 题库为空时不崩 ==")
real_bank = quiz_pick.db.bank_by_keywords


class _EmptyDB:
    @staticmethod
    def bank_by_keywords(kws, limit=20):
        return []


saved = quiz_pick.db.bank_by_keywords
quiz_pick.db.bank_by_keywords = staticmethod(lambda kws, limit=20: [])
try:
    uid8 = "u_nobank"
    it8, src8 = quiz_pick.pick(uid8, items=[])
    ok(it8 is None or isinstance(it8, dict), "题库空也不抛异常", (it8, src8))
finally:
    quiz_pick.db.bank_by_keywords = saved

print("\n== 12. 真实题库分布（四方向覆盖量） ==")
cnt = {d: len(quiz_pick._bank_rows_by_direction(d, limit=300)) for d in quiz_pick.DIRECTION_ORDER}
ok(all(v > 0 for v in cnt.values()), "四方向都有题", cnt)
ok(sum(cnt.values()) >= 150, "四方向合计 >=150 题", sum(cnt.values()))

print("\n------ %d passed, %d failed ------" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
