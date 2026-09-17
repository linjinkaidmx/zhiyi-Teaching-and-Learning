# -*- coding: utf-8 -*-
"""学习小组：创建（6 位小组码）/ 加入 / 共享错题 / 学习榜

- 加入方式：6 位小组码（数字+大写字母，去易混淆字符）
- 共享模型：成员把练习本里的错题主动分享进组内共享区（非自动全量互看）
- 学习榜：从各成员 records 表实时派生（练习数 / 已掌握数 / 自测正确率）
"""
import secrets
import string

from fastapi import APIRouter, Request

from auth import user_from_token
from db import query, query_one, execute, jdump, jload

router = APIRouter(prefix="/api/group")

# 去掉 0/O、1/I/L 的 32 字符表
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
MAX_NAME = 30
MAX_INTRO = 200
MAX_NOTE = 200
MAX_SHARES_PER_USER = 50  # 每人每组的共享条数上限，防刷


def _me(request: Request):
    return user_from_token(request.headers.get("x-account-token", ""))


def _gen_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def _is_member(gid: int, uid) -> bool:
    return bool(query_one("SELECT 1 AS x FROM group_members WHERE group_id=? AND user_id=?",
                          (gid, uid)))


def _group_out(row: dict, my_id=None) -> dict:
    n = query_one("SELECT COUNT(*) AS n FROM group_members WHERE group_id=?", (row["id"],))["n"]
    out = {
        "id": row["id"], "code": row["code"], "name": row["name"],
        "intro": row["intro"], "subject": row["subject"],
        "ownerId": row["owner_id"], "createdAt": row["created_at"],
        "memberCount": n, "role": "member",
    }
    if my_id:
        out["isOwner"] = row["owner_id"] == my_id
        out["role"] = "owner" if row["owner_id"] == my_id else "member"
    return out


def _share_out(row: dict) -> dict:
    return {
        "id": row["id"], "groupId": row["group_id"], "rid": row["rid"],
        "subject": row["subject"], "question": row["question"], "hint": row["hint"],
        "answer": row["answer"], "knowledgePoints": jload(row["knowledge_points"], []),
        "errorType": row["error_type"], "note": row["note"],
        "createdAt": row["created_at"], "author": row.get("nickname", ""),
        "userId": row["user_id"],
    }


@router.post("/create")
def create_group(request: Request, body: dict):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    name = str(body.get("name", "")).strip()
    if not name or len(name) > MAX_NAME:
        return {"ok": False, "msg": f"小组名需 1-{MAX_NAME} 个字符"}
    intro = str(body.get("intro", "")).strip()[:MAX_INTRO]
    subject = str(body.get("subject", "")).strip()
    for _ in range(5):  # 码冲突重试
        code = _gen_code()
        if not query_one("SELECT id FROM groups WHERE code=?", (code,)):
            break
    else:
        return {"ok": False, "msg": "小组码生成失败，请重试"}
    gid = execute("INSERT INTO groups(code, name, intro, subject, owner_id) VALUES(?,?,?,?,?)",
                  (code, name, intro, subject, user["id"]))
    execute("INSERT INTO group_members(group_id, user_id, role) VALUES(?,?,'owner')",
            (gid, user["id"]))
    row = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    return {"ok": True, "group": _group_out(row, user["id"])}


@router.post("/join")
def join_group(request: Request, body: dict):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    code = str(body.get("code", "")).strip().upper()
    row = query_one("SELECT * FROM groups WHERE code=?", (code,))
    if not row:
        return {"ok": False, "msg": "小组码不存在，请核对后重试"}
    if _is_member(row["id"], user["id"]):
        return {"ok": False, "msg": "你已在该小组中"}
    execute("INSERT INTO group_members(group_id, user_id, role) VALUES(?,?,'member')",
            (row["id"], user["id"]))
    return {"ok": True, "group": _group_out(row, user["id"])}


@router.get("/list")
def my_groups(request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "未登录"}
    rows = query(
        """SELECT g.* FROM groups g
           JOIN group_members m ON m.group_id = g.id AND m.user_id = ?
           ORDER BY g.id DESC""", (user["id"],))
    return {"ok": True, "groups": [_group_out(r, user["id"]) for r in rows]}


@router.get("/{gid}/members")
def group_members(gid: int, request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "未登录"}
    g = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    if not g or not _is_member(gid, user["id"]):
        return {"ok": False, "msg": "小组不存在或你不在组内"}
    rows = query(
        """SELECT u.id AS user_id, u.nickname, m.role, m.joined_at
           FROM group_members m JOIN users u ON u.id=m.user_id
           WHERE m.group_id=? ORDER BY m.joined_at""", (gid,))
    members = []
    for r in rows:
        stats = query_one(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN mastered=1 THEN 1 ELSE 0 END) AS mastered,
                      SUM(COALESCE(json_extract(data, '$.quizCount'), 0)) AS quizTotal,
                      SUM(COALESCE(json_extract(data, '$.quizCorrect'), 0)) AS quizCorrect
               FROM records WHERE user_id=?""", (r["user_id"],))
        total = stats["total"] or 0
        qt = stats["quizTotal"] or 0
        qc = stats["quizCorrect"] or 0
        members.append({
            "userId": r["user_id"], "nickname": r["nickname"], "role": r["role"],
            "joinedAt": r["joined_at"],
            "recordTotal": total,
            "mastered": stats["mastered"] or 0,
            "quizTotal": qt, "quizCorrect": qc,
            "accuracy": round(qc / qt * 100) if qt else None,
        })
    return {"ok": True, "group": _group_out(g, user["id"]), "members": members}


@router.get("/{gid}/shares")
def group_shares(gid: int, request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "未登录"}
    g = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    if not g or not _is_member(gid, user["id"]):
        return {"ok": False, "msg": "小组不存在或你不在组内"}
    rows = query(
        """SELECT s.*, u.nickname FROM group_shares s
           JOIN users u ON u.id=s.user_id WHERE s.group_id=? ORDER BY s.id DESC""", (gid,))
    return {"ok": True, "group": _group_out(g, user["id"]),
            "shares": [_share_out(r) for r in rows]}


@router.post("/{gid}/share")
def share_to_group(gid: int, request: Request, body: dict):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    g = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    if not g or not _is_member(gid, user["id"]):
        return {"ok": False, "msg": "小组不存在或你不在组内"}
    question = str(body.get("question", "")).strip()
    if not question:
        return {"ok": False, "msg": "分享内容缺少题干"}
    cnt = query_one("SELECT COUNT(*) AS n FROM group_shares WHERE group_id=? AND user_id=?",
                    (gid, user["id"]))["n"]
    if cnt >= MAX_SHARES_PER_USER:
        return {"ok": False, "msg": f"每人每组最多共享 {MAX_SHARES_PER_USER} 条"}
    kps = body.get("knowledgePoints") or []
    if not isinstance(kps, list):
        kps = [str(kps)]
    sid = execute(
        """INSERT INTO group_shares(group_id, user_id, rid, subject, question, hint, answer,
                                    knowledge_points, error_type, note)
           VALUES(?,?,?,?,?,?,?,?,?,?)""",
        (gid, user["id"], str(body.get("rid", "")), str(body.get("subject", "")),
         question, str(body.get("hint", "")), str(body.get("answer", "")),
         jdump([str(k) for k in kps]), str(body.get("errorType", "")),
         str(body.get("note", ""))[:MAX_NOTE]),
    )
    return {"ok": True, "shareId": sid}


@router.post("/shares/{share_id}/delete")
def delete_share(share_id: int, request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    row = query_one("SELECT * FROM group_shares WHERE id=?", (share_id,))
    if not row:
        return {"ok": False, "msg": "共享记录不存在"}
    g = query_one("SELECT owner_id FROM groups WHERE id=?", (row["group_id"],))
    if row["user_id"] != user["id"] and (not g or g["owner_id"] != user["id"]):
        return {"ok": False, "msg": "只有本人或组长可以撤回共享"}
    execute("DELETE FROM group_shares WHERE id=?", (share_id,))
    return {"ok": True}


@router.post("/{gid}/quit")
def quit_group(gid: int, request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "未登录"}
    g = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    if not g:
        return {"ok": False, "msg": "小组不存在"}
    if g["owner_id"] == user["id"]:
        return {"ok": False, "msg": "组长不能退出，请解散小组或先转让（暂不支持转让）"}
    execute("DELETE FROM group_members WHERE group_id=? AND user_id=?", (gid, user["id"]))
    return {"ok": True}


@router.post("/{gid}/dissolve")
def dissolve_group(gid: int, request: Request):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "未登录"}
    g = query_one("SELECT * FROM groups WHERE id=?", (gid,))
    if not g:
        return {"ok": False, "msg": "小组不存在"}
    if g["owner_id"] != user["id"]:
        return {"ok": False, "msg": "只有组长可以解散小组"}
    execute("DELETE FROM group_shares WHERE group_id=?", (gid,))
    execute("DELETE FROM group_members WHERE group_id=?", (gid,))
    execute("DELETE FROM groups WHERE id=?", (gid,))
    return {"ok": True}
