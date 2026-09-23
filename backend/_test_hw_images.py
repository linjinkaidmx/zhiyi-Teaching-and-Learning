# -*- coding: utf-8 -*-
"""作业题目图片（老师布置作业可拍照/上传，最多 9 张）接口层回归。MOCK 模式离线跑。
用法：zhiyi 环境 python _test_hw_images.py
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_hwimg_test_")
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


def make_img(color, size=8):
    """生成 1x1 像素 dataURL（接口只校验前缀与长度，不需要真照片）。"""
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" + color * size


# ---------- 注册：老师 + 学生 ----------
r = client.post("/api/account/register", json={"nickname": "hwimg_t", "password": "pw123456", "password_confirm": "pw123456"}).json()
check("注册老师", r.get("ok"), r)
ttok = r["token"]

r = client.post("/api/account/register", json={"nickname": "hwimg_s", "password": "pw123456", "password_confirm": "pw123456"}).json()
stok = r["token"]

r = client.post("/api/teacher/apply", json={"token": ttok, "name": "王老师", "school": "测试中学"}).json()
check("老师认证", r.get("ok"), r)

r = client.post("/api/class/create", json={"token": ttok, "name": "图片作业班", "subject": "数学"}).json()
check("建班", r.get("ok") and r.get("class", {}).get("invite_code"), r)
cid = r["class"]["id"]
code = r["class"]["invite_code"]

r = client.post("/api/class/join", json={"token": stok, "code": code}).json()
check("学生进班", r.get("ok"), r)

# ---------- 布置作业：带 3 张图 ----------
imgs = [make_img("a"), make_img("b"), make_img("c")]
r = client.post("/api/homework/create", json={
    "token": ttok, "class_id": cid, "title": "图片作业", "content": "", "images": imgs,
}).json()
check("有图无文字可发布", r.get("ok"), r)
hid = r["homework"]["id"] if r.get("ok") else ""

r = client.post("/api/homework/assign_images", json={"token": stok, "homework_id": hid}).json()
check("学生拉取题目图片", r.get("ok") and r.get("images") == imgs, str(r)[:120])
check("图片顺序正确", r.get("images", [])[1] == imgs[1] if r.get("images") else False)

r = client.post("/api/homework/detail", json={"token": stok, "homework_id": hid}).json()
check("详情带 images_count", r.get("ok") and r["homework"].get("images_count") == 3, str(r.get("homework", {}).get("images_count")))

r = client.post("/api/homework/list", json={"token": stok, "class_id": cid}).json()
items = r.get("items", [])
check("列表带 images_count 且不带大图", items and items[0].get("images_count") == 3 and "images" not in items[0], str(items)[:150])

# ---------- 校验 ----------
r = client.post("/api/homework/create", json={"token": ttok, "class_id": cid, "title": "空", "content": "", "images": []}).json()
check("无图无文拒绝", not r.get("ok"), r)

r = client.post("/api/homework/create", json={"token": ttok, "class_id": cid, "title": "超", "content": "x",
                                              "images": [make_img(str(i)) for i in range(10)]}).json()
check("10 张拒绝", not r.get("ok"), r)

r = client.post("/api/homework/create", json={"token": ttok, "class_id": cid, "title": "格式", "content": "x",
                                              "images": ["http://evil/x.png"]}).json()
check("非 dataURL 拒绝", not r.get("ok"), r)

r = client.post("/api/homework/create", json={"token": ttok, "class_id": cid, "title": "正常", "content": "文字题目",
                                              "images": [make_img("d")]}).json()
check("图文都有可发布", r.get("ok"), r)
hid2 = r["homework"]["id"] if r.get("ok") else ""

r = client.post("/api/homework/assign_images", json={"token": stok, "homework_id": hid2}).json()
check("第二份作业图片独立", r.get("images") == [make_img("d")], str(r)[:100])

r = client.post("/api/homework/assign_images", json={"token": stok, "homework_id": "nonexistent"}).json()
check("不存在作业拒绝", not r.get("ok"), r)

# ---------- 学生提交作业不受影响 ----------
r = client.post("/api/homework/submit", json={"token": stok, "homework_id": hid, "image_base64": make_img("s"), "note": ""}).json()
check("学生提交仍正常", r.get("ok"), r)

# ---------- 学生多图提交 ----------
imgs9 = [make_img(f"m{i}") for i in range(9)]
r = client.post("/api/homework/submit", json={"token": stok, "homework_id": hid, "images": imgs9}).json()
check("学生 9 图提交", r.get("ok"), r)
r = client.post("/api/homework/detail", json={"token": stok, "homework_id": hid}).json()
check("提交 images_count=9", r.get("ok") and r["homework"]["my_submission"]["images_count"] == 9,
      str(r.get("homework", {}).get("my_submission", {}).get("images_count")))
r = client.post("/api/homework/image", json={"token": ttok, "homework_id": hid, "user_id": "hwimg_s"}).json()
check("老师拉学生全部图", len(r.get("images", [])) == 9 and r.get("image"), str(r)[:80])
r = client.post("/api/homework/submit", json={"token": stok, "homework_id": hid, "images": [make_img(str(i)) for i in range(10)]}).json()
check("学生 10 图拒绝", not r.get("ok"), r)

# ---------- 班级解散级联删图 ----------
r = client.post("/api/teacher/me", json={"token": ttok}).json()
check("老师身份在", r.get("ok"), r)

print(f"\n{'全部通过' if FAIL == 0 else '存在失败'}（{PASS} 项，失败 {FAIL}）")
sys.exit(0 if FAIL == 0 else 1)
