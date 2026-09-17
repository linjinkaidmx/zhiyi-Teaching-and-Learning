# -*- coding: utf-8 -*-
"""社区模块后端全流程集成测试（账号/同步/论坛/小组），仅 ASCII 输出"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8900"


def post(path, body, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-account-token"] = token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"http": e.code, "raw": e.read().decode()[:200]}


def get(path, token=None):
    headers = {"x-account-token": token} if token else {}
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"http": e.code, "raw": e.read().decode()[:200]}


results = []


def check(name, cond):
    results.append((name, cond))
    print(("OK  " if cond else "FAIL"), name)


def main():
    # 1 register
    r = post("/api/account/register", {"nickname": "tester01", "password": "abc12345",
                                       "passwordConfirm": "abc12345"})
    check("register", r.get("ok") and bool(r.get("token")) and len(r.get("backupCode", "")) == 9)
    backup = r.get("backupCode", "")
    t1 = r.get("token", "")

    r = post("/api/account/register", {"nickname": "tester01", "password": "abc12345"})
    check("duplicate nickname rejected", not r.get("ok"))

    r = post("/api/account/register", {"nickname": "tester02", "password": "123"})
    check("weak password rejected", not r.get("ok"))

    r = post("/api/account/login", {"nickname": "tester01", "password": "wrong!"})
    check("wrong password rejected", not r.get("ok"))

    r = post("/api/account/login", {"nickname": "tester01", "password": "abc12345"})
    check("login", r.get("ok"))
    t1 = r.get("token", t1)

    r = post("/api/account/verify", {"token": t1})
    check("verify session", r.get("ok") and r.get("nickname") == "tester01")

    rec = {"id": "1001", "source": "bank", "subject": "CS", "question": "loop queue stem $O(1)$",
           "knowledge_points": ["stack"], "error_type": "", "mastered": False,
           "quizCount": 2, "quizCorrect": 1, "streak": 1}
    r = post("/api/records/upsert", {"record": rec}, token=t1)
    check("record upsert", r.get("ok"))
    rec2 = dict(rec)
    rec2["quizCount"] = 3
    r = post("/api/records/upsert", {"record": rec2}, token=t1)
    check("record upsert again (same id)", r.get("ok"))

    r = get("/api/records", token=t1)
    check("record list count=1", r.get("ok") and len(r.get("records", [])) == 1)
    check("record fields restored", r["records"][0]["quizCount"] == 3
          and r["records"][0]["question"].startswith("loop"))

    r = get("/api/records")
    check("list without token rejected", not r.get("ok"))

    r = post("/api/forum/posts", {"type": "text", "title": "how to review", "content": "tips?"}, token=t1)
    check("forum text post", r.get("ok"))
    pid_text = r.get("postId")

    r = post("/api/forum/posts", {"type": "question", "title": "share a tree problem",
                                  "subject": "CS", "question": "preorder ABC postorder CBA",
                                  "knowledgePoints": ["binary tree"], "errorType": "blind",
                                  "answer": "$N$ possible"}, token=t1)
    check("forum question post", r.get("ok"))
    pid_q = r.get("postId")

    r = post("/api/forum/posts", {"type": "question", "title": "no stem"}, token=t1)
    check("question post without stem rejected", not r.get("ok"))

    r = get("/api/forum/posts?subject=CS")
    check("post list + subject filter", r.get("ok") and r["total"] == 1
          and r["posts"][0]["title"] == "share a tree problem")
    check("post author nickname", r["posts"][0]["author"] == "tester01")

    r = post("/api/forum/posts/%d/like" % pid_q, {}, token=t1)
    check("like", r.get("ok") and r.get("liked") and r.get("likeCount") == 1)
    r = post("/api/forum/posts/%d/like" % pid_q, {}, token=t1)
    check("unlike toggle", r.get("ok") and not r.get("liked") and r.get("likeCount") == 0)

    r = post("/api/forum/posts/%d/comments" % pid_q, {"content": "nice!"}, token=t1)
    check("comment", r.get("ok") and r.get("commentCount") == 1)
    r = get("/api/forum/posts/%d" % pid_q)
    cid = r["comments"][0]["id"]
    r = post("/api/forum/posts/%d/comments" % pid_q, {"content": "thanks", "replyTo": cid}, token=t1)
    check("reply comment", r.get("ok"))
    r = get("/api/forum/posts/%d" % pid_q)
    check("detail has 2 comments", len(r.get("comments", [])) == 2
          and r["comments"][1]["replyTo"] == cid)

    r = post("/api/group/create", {"name": "DS squad", "intro": "mutual help", "subject": "CS"}, token=t1)
    check("create group", r.get("ok") and len(r["group"]["code"]) == 6 and r["group"]["isOwner"])
    gcode = r["group"]["code"]
    gid = r["group"]["id"]

    r = post("/api/account/register", {"nickname": "tester03", "password": "xyz98765",
                                       "passwordConfirm": "xyz98765"})
    t2 = r["token"]
    r = post("/api/group/join", {"code": gcode}, token=t2)
    check("join by code", r.get("ok") and r["group"]["memberCount"] == 2)

    post("/api/records/upsert", {"record": rec}, token=t2)
    r = post("/api/group/%d/share" % gid, {"rid": "1001", "subject": "CS",
            "question": "loop queue stem", "knowledgePoints": ["stack"],
            "errorType": "concept", "note": "always wrong on full check"}, token=t2)
    check("share record to group", r.get("ok"))
    sid = r.get("shareId")

    r = get("/api/group/%d/shares" % gid, token=t1)
    check("group shares visible", r.get("ok") and len(r["shares"]) == 1
          and r["shares"][0]["author"] == "tester03")

    r = get("/api/group/%d/members" % gid, token=t1)
    m = [x for x in r["members"] if x["nickname"] == "tester03"][0]
    check("leaderboard stats", r.get("ok") and m["recordTotal"] == 1 and m["quizTotal"] == 2)

    r = post("/api/group/%d/quit" % gid, {}, token=t1)
    check("owner cannot quit", not r.get("ok"))
    r = post("/api/group/%d/quit" % gid, {}, token=t2)
    check("member quit", r.get("ok"))
    r = post("/api/group/shares/%d/delete" % sid, {}, token=t2)
    check("share author delete own share", r.get("ok"))

    r = post("/api/account/recover", {"nickname": "tester01", "backupCode": backup.lower(),
                                      "newPassword": "newpass99"})
    check("recover by backup code (case-insensitive)", r.get("ok"))
    t1new = r["token"]
    r = post("/api/account/verify", {"token": t1})
    check("old token invalid after recover", not r.get("ok"))
    r = post("/api/account/login", {"nickname": "tester01", "password": "newpass99"})
    check("login with new password", r.get("ok"))

    r = post("/api/account/change-password", {"token": t1new, "oldPassword": "newpass99",
                                              "newPassword": "final1234"})
    check("change password", r.get("ok"))
    r = post("/api/account/verify", {"token": t1new})
    check("old token invalid after change", not r.get("ok"))

    r = post("/api/forum/posts/%d/delete" % pid_text, {}, token=t2)
    check("cannot delete others post", not r.get("ok"))

    n_fail = sum(1 for _, ok in results if not ok)
    print("\n== RESULT: %d/%d passed, %d failed ==" % (len(results) - n_fail, len(results), n_fail))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
