"""模拟考试后端接口验证：组卷 / 判卷 / 试卷云同步。

- 组卷与判卷走真实模型（验证 prompt 与 JSON 规范化）
- 同步用临时账号走真实接口，跑完即删
用法：python _qa_paper_api.py
"""
import sys
import types

# main.py 依赖 Unix 专有 resource 模块，Windows 下打桩（与 _test_sse.py 同法）
res = types.ModuleType("resource")
res.getrlimit = lambda *a: (0, 0)
res.setrlimit = lambda *a: None
res.RLIMIT_AS = 0
res.RLIMIT_CPU = 1
sys.modules["resource"] = res

sys.path.insert(0, ".")
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
passed = 0
failed = 0


def ok(cond, label, extra=None):
    global passed, failed
    if cond:
        passed += 1
        print("  ✓ " + label)
    else:
        failed += 1
        print("  ✗ " + label + ("  → " + str(extra) if extra is not None else ""))


print("1. 组卷：仅选择题 5 道 × 20 分")
r = client.post("/api/generate-paper", json={
    "mode": "choice",
    "plan": [{"type": "choice", "count": 5, "score": 20}],
    "knowledge_points": ["极限", "导数"],
    "subject": "高等数学",
}).json()
ok(r.get("ok"), "接口返回 ok", r.get("error"))
paper = r.get("data") or {}
qs = paper.get("questions") or []
print("   试卷标题:", paper.get("title"), "| 题数:", len(qs), "| 总分:", paper.get("totalScore"))
ok(len(qs) == 5, "生成 5 道题", len(qs))
ok(paper.get("totalScore") == 100, "总分为 100", paper.get("totalScore"))
ok(all(q.get("score") == 20 for q in qs), "每题 20 分（按 plan 赋分）", [q.get("score") for q in qs])
ok(all(len(q.get("options") or []) == 4 for q in qs), "每题 4 个选项", [len(q.get("options") or []) for q in qs])
ok(all(str(q.get("answer") or "").strip().upper() in ("A", "B", "C", "D") for q in qs), "答案均为选项字母", [q.get("answer") for q in qs])
ok(all(q.get("explanation") for q in qs), "每题都有解析")
if qs:
    print("   样题:", str(qs[0].get("question"))[:80])
    print("   选项:", qs[0].get("options"))

print("\n2. 组卷：整卷（选择 2 + 填空 1 + 解答 1）")
r2 = client.post("/api/generate-paper", json={
    "mode": "full",
    "plan": [
        {"type": "choice", "count": 2, "score": 15},
        {"type": "blank", "count": 1, "score": 30},
        {"type": "solution", "count": 1, "score": 40},
    ],
    "knowledge_points": ["定积分"],
}).json()
ok(r2.get("ok"), "接口返回 ok", r2.get("error"))
qs2 = (r2.get("data") or {}).get("questions") or []
types_seen = [q.get("type") for q in qs2]
print("   题型序列:", types_seen, "| 总分:", (r2.get("data") or {}).get("totalScore"))
ok(len(qs2) == 4, "生成 4 道题", len(qs2))
ok((r2.get("data") or {}).get("totalScore") == 100, "总分为 100")
ok(set(types_seen) == {"choice", "blank", "solution"}, "三种题型齐备", types_seen)

print("\n3. 判卷：主观题（填空 + 解答），一正一误")
subjective = [q for q in qs2 if q.get("type") in ("blank", "solution")]
judge_payload = []
for i, q in enumerate(subjective):
    judge_payload.append({
        "id": q.get("id"),
        "question": q.get("question"),
        "reference": q.get("answer"),
        # 第一题故意答错，第二题直接抄参考答案（应得满分）
        "user_answer": "我完全不会" if i == 0 else q.get("answer"),
        "score": q.get("score"),
    })
rj = client.post("/api/judge-paper", json={"questions": judge_payload}).json()
ok(rj.get("ok"), "接口返回 ok", rj.get("error"))
results = (rj.get("data") or {}).get("results") or []
print("   判分结果:", [(x.get("id"), x.get("got"), str(x.get("comment"))[:24]) for x in results])
ok(len(results) == len(subjective), "每题都有判分结果", len(results))
by_id = {str(x.get("id")): x for x in results}
ok(all(0 <= (by_id[str(q.get("id"))] or {}).get("got", -1) <= q.get("score") for q in subjective), "得分都在 0~满分之间")
wrong = by_id.get(str(subjective[0].get("id"))) if subjective else None
right = by_id.get(str(subjective[1].get("id"))) if len(subjective) > 1 else None
if wrong:
    ok(wrong.get("got", 99) <= subjective[0].get("score") * 0.5, "答错的题得分不高于一半", wrong.get("got"))
    ok(bool(str(wrong.get("comment") or "").strip()), "错题给了评语")
if right:
    ok(right.get("got", 0) >= subjective[1].get("score") * 0.9, "照抄参考答案的题接近满分", right.get("got"))

print("\n4. 试卷云同步（push / pull）")
import time  # noqa: E402
nick = "paperqa" + str(int(time.time()))[-8:]
reg = client.post("/api/account/register", json={
    "nickname": nick, "password": "test123456", "password_confirm": "test123456", "client_id": "qa",
}).json()
ok(reg.get("ok"), "临时账号注册成功", reg.get("error"))
token = reg.get("token")
sample = [{
    "id": "p1", "createdAt": int(time.time() * 1000), "title": "测试卷",
    "totalScore": 100, "questions": [{"id": 1, "type": "choice", "question": "1+1=?", "answer": "B", "score": 100}],
    "answers": {"1": "B"}, "graded": {"total": 100, "perQuestion": [{"id": 1, "got": 100}]},
    "updatedAt": int(time.time() * 1000),
}]
rp = client.post("/api/sync/push", json={"token": token, "items": [], "exams": sample}).json()
ok(rp.get("ok"), "推送试卷成功", rp)
rl = client.post("/api/sync/pull", json={"token": token}).json()
got = rl.get("exams") or []
ok(len(got) == 1 and got[0].get("id") == "p1", "拉回试卷成功", [x.get("id") for x in got])
ok((got[0].get("graded") or {}).get("total") == 100, "成绩字段完整", (got[0].get("graded") or {}).get("total"))
rd = client.post("/api/account/delete", json={"token": token, "password": "test123456"}).json()
print("   临时账号清理:", "已删除" if rd.get("ok") else "删除失败（可忽略）")

print("\n" + "=" * 46)
print(f"全部通过（{passed} 项断言）" if failed == 0 else f"有 {failed} 项未通过（通过 {passed} 项）")
sys.exit(0 if failed == 0 else 1)
