# -*- coding: utf-8 -*-
"""AI 教学老师 全链路离线回归（2026-10-09，TestClient + MOCK，不连网不花钱）

覆盖：开课大纲落库 / 开讲幂等 / 状态机唯一推进 / 选择题本地秒判 / 答错沉淀错题本+画像
/ 疑问解答后回到考试题 / 确认语服务端兜底 / 大纲增删改与重置 / 结课。
用法：cd backend && python _test_teach_api.py
"""
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_TMP = tempfile.mkdtemp(prefix="teach_test_")
_DB = os.path.join(_TMP, "test.db")
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "zhiyi.db"), _DB)
os.environ["ZHIYI_DB"] = _DB

import service      # noqa: E402
service.MOCK = True   # 强制 Mock：本测试不连网
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: "（桩）"
import db           # noqa: E402
import teach        # noqa: E402
import main         # noqa: E402
main.quota.window_allow = lambda *a, **k: True  # 离线回归不限速：用例多了会撞「备课太快」窗口

try:
    from fastapi.testclient import TestClient
except Exception:
    from starlette.testclient import TestClient

client = TestClient(main.app)
pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  OK  " + label)
    else:
        fail_n += 1
        print("  FAIL " + label + (("  -> " + str(extra)) if extra else ""))


def post(path, payload):
    r = client.post(path, json=payload)
    try:
        return r.json() or {}
    except Exception:
        return {"ok": False, "error": "HTTP %s" % r.status_code}


NICK = "qa_teach_1"
reg = post("/api/account/register", {"nickname": NICK, "password": "test1234",
                                     "password_confirm": "test1234", "client_id": "qa"})
TOKEN = reg.get("token") or ""

print("\n== 1. 开课：生成大纲并落库 ==")
ok(bool(TOKEN), "注册拿到 token", reg.get("error"))
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "高等数学", "teacher_id": "shentong"})
ok(r.get("ok"), "大纲生成成功", r.get("error"))
syl = r.get("syllabus") or {}
ok(len(syl.get("items") or []) >= 4, "知识点数量 >=4", len(syl.get("items") or []))
ok(syl.get("cursor") == 0 and not syl.get("done"), "初始游标 0、未结课")
ok((syl.get("teacher") or {}).get("name") == "沈疏桐", "老师绑定正确", syl.get("teacher"))
SID = syl.get("id")
ok(bool(SID), "拿到大纲 id")

print("\n== 2. 我的教学线列表 ==")
r = post("/api/teach/syllabi", {"token": TOKEN})
ok(r.get("ok") and len(r.get("list") or []) == 1, "列表 1 条", r.get("list"))

print("\n== 3. 开讲：三段讲义 + 学生视图不含答案 ==")
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID})
ok(r.get("ok"), "开讲成功", r.get("error"))
SESS = r.get("session_id")
lec = r.get("lecture") or {}
ok(r.get("state") == "exam", "讲义已出 → 状态 exam", r.get("state"))
ok((lec.get("kp") or {}).get("name"), "有知识点名", lec.get("kp"))
ok(bool((lec.get("kp") or {}).get("definition")), "有定义（讲透概念）")
ok(bool((lec.get("kp") or {}).get("pitfalls")), "有易错提醒（规则①）")
ok(bool((lec.get("kp") or {}).get("symbols")), "有符号解释（规则⑤）")
ok(len((lec.get("kp") or {}).get("confused_with") or []) >= 1, "有易混区分（规则⑤）")
ex = lec.get("example") or {}
# 2026-10-10 章节化：例题随题带完整详解（前端折叠防剧透），考试题答案仍不下发
ok(bool(ex.get("question")) and bool(ex.get("steps")) and bool(ex.get("answer")),
   "例题带完整详解（步骤+答案，折叠即看）")
ok(bool(ex.get("analysis")), "例题带知识点应用分析（analysis）")
exam = lec.get("exam") or {}
ok(exam.get("type") in ("choice", "text"), "考试题有题型", exam.get("type"))
ok("answer_key" not in exam and "reference_answer" not in exam, "考试题不下发答案")

print("\n== 4. 开讲幂等（同一知识点复用，不重复花额度） ==")
r2 = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID})
ok(r2.get("reused") is True and r2.get("session_id") == SESS, "第二次 start 复用同一 session",
   (r2.get("reused"), r2.get("session_id") == SESS))

print("\n== 5. 推进闸门＝用户确认（未作答的 exam 也能确认推进，lecture 不能） ==")
r5 = post("/api/teach/ask", {"token": TOKEN, "session_id": SESS, "question": "会了，下一个知识点"})
ok(r5.get("advanced") is True, "未作答状态确认语可推进（用户明确确认掌握）", r5)
sess_row = db.get_teach_session(NICK, SESS) or {}
ok(sess_row.get("state") == "lecture", "推进后状态回到 lecture（不会再推进一次）", sess_row.get("state"))
r5b = post("/api/teach/next", {"token": TOKEN, "session_id": SESS})
ok(not r5b.get("ok"), "重复推进被拒（防连点）", r5b.get("error"))
# 复位，后续用例继续用原游标
db.update_syllabus(NICK, SID, {"cursor": 0})
db.clear_teach_sessions(NICK, SID)
r0 = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID})
SESS = r0.get("session_id")
lec = r0.get("lecture") or {}
exam = lec.get("exam") or {}
ok(r0.get("ok") and r0.get("state") == "exam", "复位后重新开讲", r0.get("error"))

print("\n== 6. 答错：本地秒判 + 参考答案揭晓 ==")
KPS = (lec.get("kp") or {}).get("name")
stored = ((db.get_teach_session(NICK, SESS) or {}).get("kp_payload") or {}).get("exam") or {}
if exam.get("type") == "choice":
    keys = [o.get("key") for o in (exam.get("options") or [])]
    right = str(stored.get("answer_key") or "").upper()
    wrong_key = next((k for k in keys if k != right), keys[0] if keys else "Z")
    r = post("/api/teach/answer", {"token": TOKEN, "session_id": SESS, "choice": wrong_key})
else:
    r = post("/api/teach/answer", {"token": TOKEN, "session_id": SESS, "text": "随便写点"})
ok(r.get("ok"), "提交作答成功", r.get("error"))
g = r.get("grade") or {}
ok(g.get("verdict") in ("wrong", "partial"), "判为未通过", g.get("verdict"))
ok(r.get("state") == "graded", "状态 graded", r.get("state"))
ok(bool(((r.get("reveal") or {}).get("exam") or {}).get("answer_key")
        or ((r.get("reveal") or {}).get("exam") or {}).get("reference_answer")),
   "批改后揭晓答案/参考", (r.get("reveal") or {}).get("exam"))
ok(r.get("wrong_saved") is True, "答错沉淀错题本")

print("\n== 7. 答错联动：错题本 + 精准出题画像 ==")
eb = [x for x in db.load_errorbook(NICK) if isinstance(x, dict) and str(x.get("id", "")).startswith("teach-")]
ok(len(eb) == 1, "错题本新增 1 条教学错题", len(eb))
if eb:
    it = eb[0]
    ok(KPS in (it.get("knowledgePoints") or []), "错题带知识点", it.get("knowledgePoints"))
    ok(bool(it.get("question")) and it.get("mastered") is False, "题干与掌握态正确")
    ok(bool(it.get("diagnosis")), "错题带错因（源头/反例）", it.get("diagnosis"))
    ok(int(it.get("reviewAt") or 0) > 0, "带次日的 SRS 复习时间")
st = db.kp_state_load(NICK) or {}
ev = (st.get("events") or {}).get(KPS) or {}
ok(int(ev.get("bad") or 0) == 1, "画像记 1 次讲崩/答错", ev)

print("\n== 8. 疑问：解答后回到考试题 ==")
r = post("/api/teach/ask", {"token": TOKEN, "session_id": SESS, "question": "为什么要先判断类型？"})
ok(r.get("ok") and bool(r.get("reply")), "疑问有解答", r.get("error"))
ok(r.get("state") == "exam", "解答后回到 exam（规则②）", r.get("state"))

print("\n== 9. 重答正确：不重复沉错题，画像记讲通 ==")
if exam.get("type") == "choice":
    right_key = str(stored.get("answer_key") or "").upper()
    r = post("/api/teach/answer", {"token": TOKEN, "session_id": SESS, "choice": right_key})
else:
    r = post("/api/teach/answer", {"token": TOKEN, "session_id": SESS, "text": "完整思路"})
ok((r.get("grade") or {}).get("verdict") in ("correct", "partial"), "重答被受理", r.get("grade"))
ok(r.get("wrong_saved") is False, "正确作答不再沉错题")
ev = ((db.kp_state_load(NICK) or {}).get("events") or {}).get(KPS) or {}
ok(int(ev.get("good") or 0) >= 1, "画像记 good", ev)

print("\n== 10. 确认语推进（服务端兜底 + 按钮路径） ==")
r = post("/api/teach/ask", {"token": TOKEN, "session_id": SESS, "question": "会了，下一个知识点"})
ok(r.get("advanced") is True and r.get("cursor") == 1, "确认语顺手推进到第 2 讲", r)
r = post("/api/teach/next", {"token": TOKEN, "session_id": SESS})
ok(not r.get("ok"), "同一教学线不能重复推进（防连点）", r.get("error"))

print("\n== 11. 指定知识点跳讲 ==")
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID, "kp_index": 3})
ok(r.get("ok") and r.get("index") == 3, "可跳到第 4 讲", (r.get("error"), r.get("index")))
SESS3 = r.get("session_id")

print("\n== 12. 大纲编辑：改名 / 增 / 删 / 换老师 / 重置 ==")
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "rename", "title": "高数（冲刺）"})
ok(r.get("ok") and (r.get("syllabus") or {}).get("title") == "高数（冲刺）", "改名成功")
n0 = len((r.get("syllabus") or {}).get("items") or [])
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "add",
                                      "name": "补充：夹逼定理", "brief": "用夹逼求极限"})
ok(r.get("ok") and len((r.get("syllabus") or {}).get("items") or []) == n0 + 1, "新增知识点")
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "del", "index": 0})
ok(r.get("ok") and len((r.get("syllabus") or {}).get("items") or []) == n0, "删除知识点")
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "switch_teacher",
                                      "teacher_id": "chenli"})
ok((r.get("syllabus") or {}).get("teacher_id") == "chenli", "换老师成功")
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "reset"})
ok(r.get("ok") and (r.get("syllabus") or {}).get("cursor") == 0, "重置进度")
ok(db.get_teach_session(NICK, SESS3) is None, "重置同时清掉旧教学线（避免索引错位）")

print("\n== 13. 学完结课 ==")
syl = db.get_syllabus(NICK, SID) or {}
total = len(syl.get("items") or [])
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID, "kp_index": total - 1})
ok(r.get("ok"), "开讲最后一讲", r.get("error"))
sess_last = r.get("session_id")
if (r.get("lecture") or {}).get("exam", {}).get("type") == "text":
    post("/api/teach/answer", {"token": TOKEN, "session_id": sess_last, "text": "思路"})
else:
    row = db.get_teach_session(NICK, sess_last) or {}
    k = (((row.get("kp_payload") or {}).get("exam") or {}).get("answer_key")) or "A"
    post("/api/teach/answer", {"token": TOKEN, "session_id": sess_last, "choice": k})
r = post("/api/teach/next", {"token": TOKEN, "session_id": sess_last, "minutes": 8})
ok(r.get("ok") and r.get("finished") is True, "最后一讲推进 → 结课", r)
ok(((r.get("syllabus") or {}).get("status")) == "done", "大纲标记 done", r.get("syllabus"))
ok((r.get("minutes") or 0) >= 8, "累计本讲耗时（供学习记录）", r.get("minutes"))

print("\n== 14. 删课连教学线一起清 ==")
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID, "action": "delete"})
ok(r.get("ok") and r.get("deleted"), "删课成功", r.get("error"))
ok(db.get_syllabus(NICK, SID) is None, "大纲已删除")
r = post("/api/teach/syllabi", {"token": TOKEN})
ok(len(r.get("list") or []) == 0, "列表已空", r.get("list"))

print("\n== 15. 未登录与越权保护 ==")
r = post("/api/teach/syllabus", {"token": "", "subject": "高等数学"})
ok(not r.get("ok"), "游客不能开课")
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": "not-exist"})
ok(not r.get("ok"), "不存在的大纲被拒", r.get("error"))

print("\n== 15.5 类型防线：数字/None 字段不再 422（2026-10-09 开课 422 修复） ==")
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "数据结构",
                                 "course_id": 1727030000123, "teacher_id": "chenli"})
ok(r.get("ok"), "course_id 传数字也能开课（Pydantic coerce）", r.get("error"))
ok(str((r.get("syllabus") or {}).get("course_id") or "") == "1727030000123",
   "course_id 落库回显为字符串", (r.get("syllabus") or {}).get("course_id"))
SID_T = (r.get("syllabus") or {}).get("id")
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID_T, "kp_index": "0", "minutes": None})
ok(r.get("ok"), "kp_index 传字符串、minutes 传 None 也正常开讲", r.get("error"))
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "大学物理",
                                 "teacher_id": None, "level": None, "want": None})
ok(r.get("ok"), "teacher_id/level/want 传 None 走默认值", r.get("error"))
ok(((r.get("syllabus") or {}).get("teacher") or {}).get("name") == "陈砺",
   "None teacher_id → 默认陈砺", (r.get("syllabus") or {}).get("teacher"))
for sid_t in [SID_T, (r.get("syllabus") or {}).get("id")]:
    if sid_t:
        post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": sid_t, "action": "delete"})
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "高等数学", "course_id": None, "want": "abc"})
ok(not r.get("ok"), "want 传非数字串仍被拒（不静默吞）", r.get("ok"))

print("\n== 15.6 章节目录：跳章开讲 / ✓ 打标 / 重学复用 / 删点重排（2026-10-09） ==")
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "高等数学"})
ok(r.get("ok"), "开课成功", r.get("error"))
syl = r.get("syllabus") or {}
SID_C = syl.get("id")
items = syl.get("items") or []
while len(items) < 3:  # Mock 大纲章数不固定，不足 3 章先补齐
    r2 = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID_C,
                                           "action": "add", "name": "补充章 %d" % len(items),
                                           "index": len(items)})
    ok(r2.get("ok"), "补章到 3 章+", r2.get("error"))
    items = (r2.get("syllabus") or {}).get("items") or []
ok("kp_done" in syl and "kp_started" in syl, "大纲 payload 含 kp_done/kp_started", sorted(syl.keys()))
LAST = len(items) - 1
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID_C, "kp_index": LAST})
ok(r.get("ok") and r.get("index") == LAST, "跳章开讲最后一章", r.get("error"))
ok(((r.get("syllabus") or {}).get("cursor")) == LAST,
   "游标跟人走：cursor 同步到最后章", (r.get("syllabus") or {}).get("cursor"))
ok(LAST in ((r.get("syllabus") or {}).get("kp_started") or []),
   "kp_started 记录已学章节", (r.get("syllabus") or {}).get("kp_started"))
r = post("/api/teach/next", {"token": TOKEN, "session_id": r.get("session_id")})
ok(r.get("ok") and LAST in (r.get("kp_done") or []), "推进后 kp_done 打 ✓", r.get("kp_done"))
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID_C, "kp_index": LAST})
ok(r.get("ok") and r.get("reused"), "同章重学复用讲义（不重复花额度）", r.get("reused"))
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID_C,
                                      "action": "del", "index": 0})
ok(r.get("ok") and (r.get("syllabus") or {}).get("kp_done") == [LAST - 1],
   "删首章 → ✓ 索引前移一位", (r.get("syllabus") or {}).get("kp_done"))
r = post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID_C, "action": "reset"})
ok(r.get("ok") and (r.get("syllabus") or {}).get("kp_done") == []
   and ((r.get("syllabus") or {}).get("cursor") or 0) == 0,
   "重置 → kp_done 清空、游标归零", (r.get("syllabus") or {}).get("kp_done"))
post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID_C, "action": "delete"})

print("\n== 16. 讲义抖动兜底：JSON 解析失败 → 纯文本降级（不瘫） ==")
service.MOCK = True
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "线性代数"})
SID2 = (r.get("syllabus") or {}).get("id")
ok(bool(SID2), "先在大纲上用 Mock 建一门课", r.get("error"))
_plain = ("这一讲我们把定义与原理串一遍，注意适用条件。\n"
          "题：请说明该知识点的核心条件，并举一个反例。")
service.MOCK = False
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: _plain
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID2})
ok(r.get("ok"), "模型输出非 JSON 时讲义仍能出（降级成功）", r.get("error"))
lec2 = r.get("lecture") or {}
ok(bool((lec2.get("kp") or {}).get("definition")), "降级讲义有讲解正文")
ok((lec2.get("exam") or {}).get("type") == "text", "降级为文字题", lec2.get("exam"))
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "离散数学"})
ok(not r.get("ok"), "大纲生成失败时返回友好错误而非 500", r.get("error"))
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: "（桩）"
service.MOCK = True
post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID2, "action": "delete"})

print("\n== 17. 评分点逐项核查 AutoGrader（2026-10-09） ==")
import json            # noqa: E402
import teach_llm       # noqa: E402
# 17.1 纯逻辑：总分由逐点实得分累加，坏值不整块丢表
ok(teach.grade_from_points([{"max": 60, "got": 60}, {"max": 40, "got": 10}]) == 70,
   "总分=逐点实得分累加（60+10=70）",
   teach.grade_from_points([{"max": 60, "got": 60}, {"max": 40, "got": 10}]))
ok(teach.grade_from_points([{"max": 30, "got": 30}]) is None,
   "评分点覆盖不足六成 → 不采信，交回模型分")
ok(teach.grade_from_points([]) is None, "无评分点 → None（沿用模型分）")
pr = teach.normalize_points([{"point": "识别未定式", "hit": True, "got": 30, "max": 30,
                              "evidence": "代入得 0/0"},
                             {"point": "求导正确", "got": "25", "max": "25"},
                             {"name": "坏值行", "got": None, "max": None},
                             "不是字典", {"point": ""}])
ok(len(pr) == 3, "非字典/空评分点被剔除，只留有效三行", len(pr))
ok(pr[1]["got"] == 25.0 and pr[1]["hit"] is True, "字符串数字转成数值；缺 hit 按得分率推", pr[1])
ok(pr[2]["max"] > 0, "max 缺失按 100 均分兜底", pr[2])
g = teach.normalize_grade({"verdict": "partial", "score": 99,
                           "point_results": [{"point": "A", "got": 30, "max": 30},
                                             {"point": "B", "got": 10, "max": 70}]})
ok(g["score"] == 40, "模型自报 99 分、逐点只 40 → 采信逐点", g["score"])
ok([p["hit"] for p in g["point_results"]] == [True, False], "hit 与得分率一致",
   [p["hit"] for p in g["point_results"]])
# 17.2 选择题答对 = 满分（旧逻辑按 100/选项数，四选一只给 25 分，学生以为自己答错了）
gc = teach.grade_choice({"answer_key": "B", "options": [{"key": "A"}, {"key": "B"},
                                                        {"key": "C"}, {"key": "D"}]}, "B")
ok(gc["score"] == 100, "四选一答对 = 100 分（旧逻辑只给 25）", gc["score"])
ok(teach.grade_choice({"answer_key": "B", "options": [{"key": "A"}, {"key": "B"}]}, "A")["score"] == 0,
   "答错 = 0 分")
ok(len(gc.get("point_results") or []) == 1, "选择题也带一行核查项", gc.get("point_results"))
# 17.3 文字题批改链路：模型回带 point_results → 归一化以逐点为准
service.MOCK = False
service.chat_text = lambda messages, temperature=0.2, slot=None, timeout=150: json.dumps(
    {"verdict": "partial", "score": 95, "comment": "思路对，第二步的条件没说明。",
     "point_results": [{"point": "识别未定式", "hit": True, "got": 30, "max": 30,
                        "evidence": "代入得 0/0"},
                       {"point": "第一次洛必达", "hit": True, "got": 20, "max": 30,
                        "evidence": "求导步骤正确"},
                       {"point": "第二次确认类型", "hit": False, "got": 0, "max": 40,
                        "evidence": "未涉及"}],
     "root_cause": "把洛必达当成可以无条件连用", "counterexample": "非未定式套洛必达会错"},
    ensure_ascii=False)
gt = teach_llm.grade_text_answer("求极限", "参考答案", [{"point": "识别", "score": 100}],
                                 "我写的过程", "洛必达法则", {})
ok(gt["score"] == 50, "模型自报 95、逐点只 50 → 采信逐点", gt["score"])
ok(len(gt.get("point_results") or []) == 3, "核查表三行都在", gt.get("point_results"))
ok(gt["point_results"][2]["hit"] is False, "没拿到的点 hit=false", gt["point_results"][2])
# 17.4 接口贯通：选择题作答回传核查表
service.MOCK = True
r = post("/api/teach/syllabus", {"token": TOKEN, "subject": "线性代数"})
SID3 = (r.get("syllabus") or {}).get("id")
r = post("/api/teach/start", {"token": TOKEN, "syllabus_id": SID3})
r = post("/api/teach/answer", {"token": TOKEN, "session_id": r.get("session_id"), "choice": "B"})
ok(r.get("ok"), "选择题提交成功", r.get("error"))
gr = r.get("grade") or {}
ok(gr.get("score") == 100, "接口回传：答对 100 分", gr.get("score"))
ok(len(gr.get("point_results") or []) == 1, "接口回传：核查表带出来了", gr)
post("/api/teach/syllabus/edit", {"token": TOKEN, "syllabus_id": SID3, "action": "delete"})

print("\n------ %d passed, %d failed ------" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
