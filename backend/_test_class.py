"""班级模块接口层测试：MOCK 下跑通「认证 → 建班 → 加入 → 布置 → 提交 → 批改 → 报告 → 推送」全链路。

用法：python _test_class.py
说明：Windows 打桩 resource；独立临时库不污染本地数据；默认 MOCK=1（批改走 Mock 分支）。
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
_tmp = tempfile.mkdtemp(prefix="zhiyi_class_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
import db  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)
PW = "pass123456"
IMG = "aGVsbG8gand0IHRlc3QgaW1hZ2U="  # 假图 base64（MOCK 不校验内容）


def reg(nick):
    r = client.post("/api/account/register", json={
        "nickname": nick, "password": PW, "password_confirm": PW,
    }).json()
    assert r.get("ok"), r
    return r["token"]


# ---------------- 1. 教师认证 ----------------
T_STU = reg("cls_stu")     # 学生 B
T_TEA = reg("cls_tea")     # 老师 A

r = client.post("/api/teacher/apply", json={"token": ""}).json()
check("未登录申请认证被拒", r.get("ok") is False)

r = client.post("/api/teacher/apply", json={"token": T_TEA, "name": "王老师", "school": ""}).json()
check("缺学校被拒", r.get("ok") is False)

r = client.post("/api/teacher/apply",
                json={"token": T_TEA, "name": "王老师", "school": "某某大学", "subject": "高等数学"}).json()
check("认证成功", r.get("ok") is True and r["teacher"]["is_teacher"] is True, json.dumps(r, ensure_ascii=False))
check("认证信息回显", r["teacher"]["meta"].get("school") == "某某大学")

r = client.post("/api/teacher/me", json={"token": T_TEA}).json()
check("teacher/me 已认证", r.get("ok") and r["teacher"]["is_teacher"] is True)
r = client.post("/api/teacher/me", json={"token": T_STU}).json()
check("teacher/me 学生未认证", r.get("ok") and r["teacher"]["is_teacher"] is False)

# ---------------- 2. 建班 / 加入 ----------------
r = client.post("/api/class/create", json={"token": T_STU, "name": "高数一班"}).json()
check("未认证不能建班", r.get("ok") is False)

r = client.post("/api/class/create",
                json={"token": T_TEA, "name": "高数一班", "subject": "高等数学", "grade": "大一"}).json()
check("建班成功", r.get("ok") is True, json.dumps(r, ensure_ascii=False))
CLS = r["class"]
check("班级码 6 位", len(CLS.get("invite_code", "")) == 6, CLS.get("invite_code"))
check("type=class", CLS.get("type") == "class")

r = client.post("/api/class/join", json={"token": T_STU, "code": "XXXXXX"}).json()
check("错班级码被拒", r.get("ok") is False)

r = client.post("/api/class/join", json={"token": T_STU, "code": CLS["invite_code"]}).json()
check("学生加入成功", r.get("ok") is True, json.dumps(r, ensure_ascii=False))

r = client.post("/api/class/my", json={"token": T_TEA}).json()
tea_cls = [c for c in r["classes"] if c["id"] == CLS["id"]]
check("老师视角 my_class is_teacher", tea_cls and tea_cls[0]["is_teacher"] is True
      and tea_cls[0]["my_role"] == "teacher")
r = client.post("/api/class/my", json={"token": T_STU}).json()
stu_cls = [c for c in r["classes"] if c["id"] == CLS["id"]]
check("学生视角 my_class is_teacher=False", stu_cls and stu_cls[0]["is_teacher"] is False)

# 学习小组不应混进班级列表
r2 = client.post("/api/group/create", json={"token": T_TEA, "name": "兴趣小组"}).json()
r = client.post("/api/class/my", json={"token": T_TEA}).json()
check("学习小组不出现在班级列表", all(c["id"] != r2["group"]["id"] for c in r["classes"]))

# ---------------- 3. 布置作业 ----------------
r = client.post("/api/homework/create",
                json={"token": T_STU, "class_id": CLS["id"], "title": "x", "content": "y"}).json()
check("学生布置被拒", r.get("ok") is False)

r = client.post("/api/homework/create",
                json={"token": T_TEA, "class_id": CLS["id"], "title": "", "content": "y"}).json()
check("空标题被拒", r.get("ok") is False)

r = client.post("/api/homework/create", json={
    "token": T_TEA, "class_id": CLS["id"],
    "title": "第一次作业", "content": "1. 求 lim(x→0) sin x / x\n2. 证明 f(x)=x² 在 R 连续",
    "reference": "1. 极限为 1\n2. 用连续函数定义",
}).json()
check("布置成功", r.get("ok") is True, json.dumps(r, ensure_ascii=False))
HW = r["homework"]

# 群里应有系统消息
r = client.post("/api/group/messages", json={"token": T_TEA, "group_id": CLS["id"], "limit": 50}).json()
check("布置后群有系统消息", r.get("ok") and any("第一次作业" in m["content"] for m in r["items"]))

# ---------------- 4. 学生提交 ----------------
r = client.post("/api/homework/submit", json={"token": T_STU, "homework_id": HW["id"], "image_base64": ""}).json()
check("无图提交被拒", r.get("ok") is False)

r = client.post("/api/homework/submit",
                json={"token": T_TEA, "homework_id": HW["id"], "image_base64": IMG}).json()
check("老师提交被拒", r.get("ok") is False)

r = client.post("/api/homework/submit",
                json={"token": T_STU, "homework_id": HW["id"], "image_base64": IMG, "note": "第一版"}).json()
check("学生提交成功", r.get("ok") is True, json.dumps(r, ensure_ascii=False))
check("提交不含 image 本体", r["submission"].get("has_image") is True and "image" not in r["submission"])

r2 = client.post("/api/homework/submit",
                 json={"token": T_STU, "homework_id": HW["id"], "image_base64": IMG, "note": "第二版"}).json()
check("重复提交覆盖且不新增行", r2.get("ok") and r2["submission"]["note"] == "第二版"
      and r2["submission"]["id"] == r["submission"]["id"])

# ---------------- 5. 视角与权限 ----------------
r = client.post("/api/homework/detail", json={"token": T_STU, "homework_id": HW["id"]}).json()
check("学生 detail 有自己的提交", r.get("ok") and r["homework"]["my_submission"] is not None)
check("学生 detail 无全班提交", "submissions" not in r["homework"] and "students" not in r["homework"])
check("学生视角 is_teacher=False", r.get("is_teacher") is False)

r = client.post("/api/homework/submissions", json={"token": T_STU, "homework_id": HW["id"]}).json()
check("学生拉全班提交被拒", r.get("ok") is False)

r = client.post("/api/homework/grade", json={"token": T_STU, "homework_id": HW["id"], "user_id": "cls_stu"}).json()
check("学生批改被拒", r.get("ok") is False)

r = client.post("/api/homework/image",
                json={"token": T_STU, "homework_id": HW["id"], "user_id": "cls_tea"}).json()
check("学生看别人图被拒", r.get("ok") is False)

# ---------------- 6. 批改（MOCK） ----------------
r = client.post("/api/homework/grade", json={"token": T_TEA, "homework_id": HW["id"], "user_id": "nobody"}).json()
check("批改未提交学生报错", r.get("ok") is False)

r = client.post("/api/homework/grade",
                json={"token": T_TEA, "homework_id": HW["id"], "user_id": "cls_stu"}).json()
check("MOCK 批改成功", r.get("ok") is True, json.dumps(r, ensure_ascii=False))
check("批改结果 85 分", r.get("ok") and r["submission"]["score"] == 85)
check("批改结构含 items/overall", r["submission"]["feedback"].get("items")
      and r["submission"]["feedback"].get("overall"))

# ---------------- 7. 第二个学生只入班不交作业 ----------------
T_STU2 = reg("cls_stu2")
client.post("/api/class/join", json={"token": T_STU2, "code": CLS["invite_code"]})

r = client.post("/api/homework/submissions", json={"token": T_TEA, "homework_id": HW["id"]}).json()
check("老师拉提交列表", r.get("ok") and len(r["students"]) == 2 and len(r["items"]) == 1)

# ---------------- 8. 班级报告 + 推送 ----------------
r = client.post("/api/homework/report", json={"token": T_STU, "homework_id": HW["id"]}).json()
check("学生生成报告被拒", r.get("ok") is False)

r = client.post("/api/homework/report", json={"token": T_TEA, "homework_id": HW["id"]}).json()
check("MOCK 报告生成", r.get("ok") is True, json.dumps(r, ensure_ascii=False))
check("报告统计正确", r["report"]["stats"]["total"] == 2 and r["report"]["stats"]["graded"] == 1
      and r["report"]["stats"]["avg"] == 85)

r = client.post("/api/homework/push", json={"token": T_TEA, "homework_id": HW["id"], "kind": "report"}).json()
check("报告推送成功", r.get("ok") is True)
r = client.post("/api/homework/push",
                json={"token": T_TEA, "homework_id": HW["id"], "kind": "student", "user_id": "cls_stu"}).json()
check("个人反馈推送成功", r.get("ok") is True)
r = client.post("/api/group/messages", json={"token": T_TEA, "group_id": CLS["id"], "limit": 50}).json()
fb = [m for m in r["items"] if m["type"] == "feedback"]
check("群里有两条 feedback 消息", len(fb) == 2)

# ---------------- 9. 截止时间拦截 ----------------
r = client.post("/api/homework/create", json={
    "token": T_TEA, "class_id": CLS["id"], "title": "已截止作业", "content": "x",
    "due_at": 1,  # 1970ms，早已过期
}).json()
HW2 = r["homework"]
r = client.post("/api/homework/submit",
                json={"token": T_STU, "homework_id": HW2["id"], "image_base64": IMG}).json()
check("过截止提交被拒", r.get("ok") is False and "截止" in r.get("error", ""))

# ---------------- 10. 改名迁移（db 层） ----------------
db.rename_user("cls_stu", "cls_stu_new")
sub = db.get_submission(HW["id"], "cls_stu_new")
check("改名后提交记录迁移", sub is not None)
g = db.get_group(CLS["id"])
members = db.list_group_members(CLS["id"])
check("改名后班级成员迁移", any(m["user_id"] == "cls_stu_new" for m in members))

# ---------------- 11. 注销清理（db 层） ----------------
db.delete_user("cls_tea")
check("注销后班级解散", db.get_group(CLS["id"]) is None)
check("注销后作业删除", db.get_homework(HW["id"]) is None)
check("注销后提交删除", db.get_submission(HW["id"], "cls_stu_new") is None)

# ---------------- 12. 迁移范式：老库无新列也能启动（已由本文件 init 顺序验证） ----------------
cols = {r["name"] for r in db._conn_checked().execute("PRAGMA table_info(profiles)").fetchall()}
check("profiles 迁移后含 is_teacher", "is_teacher" in cols and "teacher_meta" in cols)
gcols = {r["name"] for r in db._conn_checked().execute("PRAGMA table_info(groups)").fetchall()}
check("groups 迁移后含 type/meta", "type" in gcols and "meta" in gcols)

print()
if FAILS:
    print(f"共 {len(FAILS)} 项失败：{FAILS}")
    sys.exit(1)
print("全部通过")
