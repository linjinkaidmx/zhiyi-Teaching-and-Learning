# -*- coding: utf-8 -*-
"""章节化改造专项离线回归（2026-10-10）：两级大纲 / 章末 / 单元测试 / 逐项分析 / 旧课归档。

命名约定：_test_* = 离线（MOCK=1，不调真实模型，不打服务器）。
"""

import test_support  # isolated database, no credentials or network
import os
import sys
import types

os.environ["MOCK"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
import teach  # noqa: E402
import teach_llm  # noqa: E402

PASS = FAIL = 0


def ok(cond, name, extra=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  OK  %s" % name)
    else:
        FAIL += 1
        print("  FAIL %s  %r" % (name, extra))


client = TestClient(main.app)
TOKEN = ""


def post(path, payload):
    r = client.post(path, json={**payload, "token": TOKEN})
    try:
        return r.json() or {}
    except Exception:
        return {"ok": False, "error": "HTTP %s" % r.status_code}


NICK = "qa_teach_ch1"
reg = post("/api/account/register", {"nickname": NICK, "password": "test1234",
                                     "password_confirm": "test1234", "client_id": "qa"})
if not reg.get("token"):
    reg = post("/api/account/login", {"nickname": NICK, "password": "test1234", "client_id": "qa"})
TOKEN = reg.get("token") or ""
ok(bool(TOKEN), "注册/登录拿到 token", reg.get("error"))


# ---- 0. 纯逻辑：章分组工具 ----
print("\n== 0. 章分组纯逻辑 ==")
chs = [{"name": "A章", "brief": "a", "count": 3}, {"name": "B章", "brief": "b", "count": 2}]
ok(teach.chapter_of(chs, 0) == 0 and teach.chapter_of(chs, 2) == 0, "第0~2节属A章")
ok(teach.chapter_of(chs, 3) == 1 and teach.chapter_of(chs, 4) == 1, "第3~4节属B章")
ok(teach.chapter_of(chs, 99) == 1, "越界钳到最后一章")
ok(teach.chapter_range(chs, 1) == (3, 2), "B章范围 (3,2)")
ok(teach.chapter_end_index(chs, 0, 5) == 2 and teach.chapter_end_index(chs, 1, 5) == 4,
   "章末小节索引")
# normalize_chapters：模型输出树 → 重排
raw = [{"name": "一", "brief": "", "sections": [{"name": "s1", "brief": "x"}, {"name": "s2"}]},
       {"name": "二", "brief": "", "sections": [{"name": "s3"}]}]
c2, flat = teach.normalize_chapters(raw, [])
ok([c["count"] for c in c2] == [2, 1], "章 count 分配")
ok([x["name"] for x in flat] == ["s1", "s2", "s3"], "items 按 章→节 重排")
# 塌成单章的兜底
c3, flat3 = teach.normalize_chapters([{"name": "唯一", "sections": [{"name": "a"}]}],
                                     [{"name": "a", "brief": ""}, {"name": "b", "brief": ""}])
ok(len(c3) == 1 and c3[0]["count"] == 2, "单章兜底：全节归一章")

# ---- 1. 开课：两级大纲 ----
print("\n== 1. 开课（mock 两级大纲） ==")
r = post("/api/teach/syllabus", {"subject": "高等数学"})
ok(r.get("ok"), "开课成功", r.get("error"))
SYL = r.get("syllabus") or {}
SID = SYL.get("id")
chs = SYL.get("chapters") or []
ok(len(chs) >= 2, "章数 ≥2（mock 两章）", chs)
ok(sum(c.get("count", 0) for c in chs) == SYL.get("total"), "各章节数之和 = 总小节数")
ok(SYL.get("version") == 2 and not SYL.get("archived"), "新课 version=2 未归档")

# ---- 2. 讲两节再推进（为章末组卷准备素材） ----
print("\n== 2. 学完 A 章前两节 ==")
SESS = []
for i in range(3):
    r = post("/api/teach/start", {"syllabus_id": SID, "kp_index": i})
    ok(r.get("ok"), "开讲第%d节" % (i + 1), r.get("error"))
    SESS.append(r.get("session_id"))
    lec = r.get("lecture") or {}
    ex = lec.get("example") or {}
    ok(bool(ex.get("analysis")), "第%d节例题带 analysis" % (i + 1))
    post("/api/teach/answer", {"session_id": SESS[-1], "choice": "B"})
    post("/api/teach/next", {"session_id": SESS[-1]})

# ---- 3. 逐选项分析：批改后才给 + 缓存 ----
print("\n== 3. 逐选项分析（答完立即看） ==")
r = post("/api/teach/start", {"syllabus_id": SID, "kp_index": 3})   # B 章第一节，未批改
SESS3 = r.get("session_id")
r = post("/api/teach/exam_analysis", {"session_id": SESS3})
ok(not r.get("ok"), "未批改时拒绝出解析（防剧透）", r)
post("/api/teach/answer", {"session_id": SESS3, "choice": "B"})
r = post("/api/teach/exam_analysis", {"session_id": SESS3})
ok(r.get("ok") and r.get("cached") is False, "批改后首次生成", r)
r2 = post("/api/teach/exam_analysis", {"session_id": SESS3})
ok(r2.get("cached") is True, "第二次走缓存（不二次花钱）")
ana = (r.get("analysis") or {})
per = ana.get("per_option") or []
ok(len(per) == 4, "四个选项逐项都有", per)
ok(all(p.get("why") for p in per), "每项都有解析")
ok(any(p.get("verdict") == "right" for p in per), "有正确项判定")

# ---- 4. 章末：总结 + 组卷 ----
print("\n== 4. 章末页（A 章 ci=0） ==")
r = post("/api/teach/chapter", {"syllabus_id": SID, "ch_index": 0})
ok(r.get("ok"), "章末打开成功", r.get("error"))
ok(bool(r.get("overview")), "有章末总述")
secs = r.get("sections") or []
ok(len(secs) == 3, "章内三节速查", secs)
paper = r.get("paper") or []
ok(len(paper) >= 3, "试卷至少 3 题（复用+新题）", len(paper))
ok(all("answer_key" not in (p or {}) and "reference_answer" not in (p or {}) for p in paper),
   "试卷下发不含答案")
ok(any(p.get("origin") == "replay" for p in paper), "有复用小节考题")
ok(any(p.get("origin") == "new" for p in paper), "有新综合题")
r2 = post("/api/teach/chapter", {"syllabus_id": SID, "ch_index": 0})
ok(r2.get("ok") and len(r2.get("paper") or []) == len(paper), "幂等：重开不重新组卷")

# ---- 5. 单元测试提交批改 ----
print("\n== 5. 单元测试批改 ==")
answers = [{"q_index": p["q_index"], "choice": "A"} if p["type"] == "choice"
           else {"q_index": p["q_index"], "text": "洛必达先确认未定式，再求导。"}
           for p in paper]
r = post("/api/teach/chapter/answer", {"syllabus_id": SID, "ch_index": 0, "answers": answers})
ok(r.get("ok") and r.get("graded"), "提交批改成功", r.get("error"))
res = r.get("result") or {}
ok(isinstance(res.get("score"), int) and 0 <= res["score"] <= 100, "总分在 0~100", res.get("score"))
ok(len(res.get("results") or []) == len(paper), "每题都有批改结果")
ok("weak" in res and "advice" in res, "薄弱定位 + 补弱建议都在")
r2 = post("/api/teach/chapter/answer", {"syllabus_id": SID, "ch_index": 0, "answers": answers})
ok(r2.get("ok") and r2.get("result", {}).get("score") == res.get("score"), "重复提交返回已批改结果")
# 空答案拦截
r3 = post("/api/teach/chapter/answer", {"syllabus_id": SID, "ch_index": 1, "answers": []})
ok(not r3.get("ok"), "空 answers 被拦截")

# ---- 6. 旧课归档 ----
print("\n== 6. 旧课归档（v1 作废重开） ==")
import db as _db  # noqa: E402
old_syl = {"id": "oldsyl1", "user_id": NICK,
           "subject": "旧课", "teacher_id": "chenli", "title": "旧课",
           "items": [{"name": "a", "brief": ""}], "cursor": 0, "status": "active"}
_db.save_syllabus(old_syl)   # version 缺省 = 1
r = post("/api/teach/syllabi", {})
row = next((s for s in r.get("list") or [] if s.get("id") == "oldsyl1"), {})
ok(row.get("archived") is True, "v1 旧课在列表里标记 archived")
r = post("/api/teach/start", {"syllabus_id": "oldsyl1"})
ok(not r.get("ok") and r.get("archived") is True, "旧课开讲被拦截并提示重开", r)

# ---- 7. 大纲编辑：章改名 / 加节 / 删节同步章结构 ----
print("\n== 7. 大纲编辑两级同步 ==")
r = post("/api/teach/syllabus/edit", {"syllabus_id": SID, "action": "rename_ch",
                                      "ch_index": 0, "name": "极限与未定式"})
ok(r.get("ok") and (r.get("syllabus") or {}).get("chapters", [{}])[0].get("name") == "极限与未定式",
   "章改名生效")
before = r.get("syllabus") or {}
r = post("/api/teach/syllabus/edit", {"syllabus_id": SID, "action": "add", "index": 1,
                                      "name": "临时小节", "brief": ""})
after = r.get("syllabus") or {}
ok(after["total"] == before["total"] + 1, "加节成功")
ok(sum(c["count"] for c in after["chapters"]) == after["total"], "加节后章 count 之和守恒")
r = post("/api/teach/syllabus/edit", {"syllabus_id": SID, "action": "del", "index": 1})
after2 = r.get("syllabus") or {}
ok(after2["total"] == after["total"] - 1, "删节成功")
ok(sum(c["count"] for c in after2["chapters"]) == after2["total"], "删节后章 count 之和守恒")

# ---- 8. 批改后预生成下一单元（2026-10-10 性能） ----
print("\n== 8. 批改后预生成 ==")
import time as _time

# 开一门新课走预生成链路（mock 生成瞬时）
r = post("/api/teach/syllabus", {"subject": "线性代数"})
SID2 = (r.get("syllabus") or {}).get("id")
ok(r.get("ok"), "新课开出（预生成链路）", r.get("error"))
r = post("/api/teach/start", {"syllabus_id": SID2, "kp_index": 0})
s0 = r.get("session_id")
post("/api/teach/answer", {"session_id": s0, "choice": "B"})
# 批改后应已触发预生成 kp=1 的讲义（daemon 线程落库，轮询 kp_started——不能借 start 探测，它有现场生成的副作用）
t0 = _time.time()
pregen = False
while _time.time() - t0 < 6:
    s2 = next((s for s in post("/api/teach/syllabi", {}).get("list") or [] if s.get("id") == SID2), {})
    if 1 in (s2.get("kp_started") or []):
        pregen = True
        break
    _time.sleep(0.2)
ok(pregen, "批改后下一节讲义已预生成（未点推进就已存在会话）")

# 章内最后一节批改 → 预生成章末试卷
s2 = next((s for s in post("/api/teach/syllabi", {}).get("list") or [] if s.get("id") == SID2), {})
n0 = (s2.get("chapters") or [{}])[0].get("count", 0)
for i in range(1, n0):
    r = post("/api/teach/start", {"syllabus_id": SID2, "kp_index": i})
    if not r.get("reused"):
        post("/api/teach/answer", {"session_id": r.get("session_id"), "choice": "B"})
    post("/api/teach/next", {"session_id": r.get("session_id")})
# 最后一节批改触发章末预生成（轮询 unit_tests["0"] 落库）
t0 = _time.time()
pregen_ut = False
while _time.time() - t0 < 6:
    s2 = next((s for s in post("/api/teach/syllabi", {}).get("list") or [] if s.get("id") == SID2), {})
    if (s2.get("unit_tests") or {}).get("0"):
        pregen_ut = True
        break
    _time.sleep(0.2)
ok(pregen_ut, "章内最后一节批改后章末试卷已预生成")

# ---- 9. 同名课查重 + 存量合并（2026-10-10 用户拍板） ----
print("\n== 9. 同名课查重与合并 ==")
# 归一化同名（空格/标点差异）开课 → 返回已有课，不新建
r = post("/api/teach/syllabus", {"subject": "线 性 代 数！"})
ok(r.get("merged") is True and (r.get("syllabus") or {}).get("id") == SID2,
   "同名（含空格标点）开课返回已有课", ((r.get("syllabus") or {}).get("id"), SID2))
# 学完（done）的课允许重开：置 done 后同名开课不再 merged
_db.update_syllabus(NICK, SID2, {"status": "done"})
r = post("/api/teach/syllabus", {"subject": "线性代数"})
ok(not r.get("merged"), "学完的同名课允许重开新课", r.get("merged"))
SID3 = (r.get("syllabus") or {}).get("id")
_db.update_syllabus(NICK, SID3, {"status": "active"})
# 存量合并：再造两门同名课（独特课名避免与前面的课撞名，进度深浅不同）
# → init_db 合并后只剩进度最深那门
_db.save_syllabus({"id": "dupA", "user_id": NICK, "subject": "数据库系统!", "teacher_id": "chenli",
                   "title": "数据库系统", "items": [{"name": "a", "brief": ""}],
                   "chapters": [{"name": "一", "brief": "", "count": 1}],
                   "cursor": 1, "kp_done": [0], "status": "active", "version": 2})
_db.save_syllabus({"id": "dupB", "user_id": NICK, "subject": "数据库系统", "teacher_id": "chenli",
                   "title": "数据库系统", "items": [{"name": "a", "brief": ""}, {"name": "b", "brief": ""}],
                   "chapters": [{"name": "一", "brief": "", "count": 2}],
                   "cursor": 2, "kp_done": [0, 1], "status": "active", "version": 2})
_db.init_db()
names = [s.get("id") for s in post("/api/teach/syllabi", {}).get("list") or []]
ok("dupA" not in names and "dupB" in names, "同名课合并：保留进度深的 dupB，删除 dupA", names)

print("\n------ %d passed, %d failed ------" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
