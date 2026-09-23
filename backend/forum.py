# -*- coding: utf-8 -*-
"""论坛：发帖（文字帖 / 错题分享帖）、点赞、评论

- 错题分享帖结构化存储题干/知识点/错因/解析，前端用 MathText 渲染公式
- 点赞 toggle：再点一次取消
- 评论支持一层回复（reply_to 指向被回复的评论 id）
"""
from fastapi import APIRouter, Request

from auth import user_from_token
from db import query, query_one, execute, jdump, jload

router = APIRouter(prefix="/api/forum")

PAGE_SIZE = 20
MAX_TITLE = 80
MAX_CONTENT = 5000
MAX_COMMENT = 500


def _me(request: Request):
    return user_from_token(request.headers.get("x-account-token", ""))


def _post_out(row: dict, my_id=None) -> dict:
    out = {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "content": row["content"],
        "subject": row["subject"],
        "question": row["question"],
        "hint": row["hint"],
        "answer": row["answer"],
        "knowledgePoints": jload(row["knowledge_points"], []),
        "errorType": row["error_type"],
        "likeCount": row["like_count"],
        "commentCount": row["comment_count"],
        "createdAt": row["created_at"],
        "author": row.get("nickname", ""),
        "liked": False,
    }
    if my_id:
        out["liked"] = bool(query_one(
            "SELECT 1 AS x FROM post_likes WHERE post_id=? AND user_id=?",
            (row["id"], my_id)))
        out["mine"] = row["user_id"] == my_id
    return out


@router.post("/posts")
def create_post(request: Request, body: dict):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    title = str(body.get("title", "")).strip()
    ptype = str(body.get("type", "text"))
    if ptype not in ("text", "question"):
        ptype = "text"
    if not title:
        return {"ok": False, "msg": "请填写标题"}
    if len(title) > MAX_TITLE:
        return {"ok": False, "msg": f"标题不能超过 {MAX_TITLE} 字"}
    content = str(body.get("content", "")).strip()
    if len(content) > MAX_CONTENT:
        return {"ok": False, "msg": f"正文不能超过 {MAX_CONTENT} 字"}
    if ptype == "question" and not str(body.get("question", "")).strip():
        return {"ok": False, "msg": "错题分享帖必须包含题干"}

    kps = body.get("knowledgePoints") or []
    if not isinstance(kps, list):
        kps = [str(kps)]
    pid = execute(
        """INSERT INTO posts(user_id, type, title, content, subject, question, hint, answer,
                             knowledge_points, error_type)
           VALUES(?,?,?,?,?,?,?,?,?,?)""",
        (user["id"], ptype, title, content, str(body.get("subject", "")),
         str(body.get("question", "")), str(body.get("hint", "")),
         str(body.get("answer", "")), jdump([str(k) for k in kps]),
         str(body.get("errorType", ""))),
    )
    return {"ok": True, "postId": pid}


@router.get("/posts")
def list_posts(request: Request, subject: str = "", page: int = 1):
    user = _me(request)
    my_id = user["id"] if user else None
    page = max(1, page)
    where, args = "", []
    if subject.strip():
        where = "WHERE p.subject=?"
        args.append(subject.strip())
    total = query_one(f"SELECT COUNT(*) AS n FROM posts p {where}", tuple(args))["n"]
    rows = query(
        f"""SELECT p.*, u.nickname FROM posts p
            JOIN users u ON u.id = p.user_id {where}
            ORDER BY p.id DESC LIMIT ? OFFSET ?""",
        tuple(args + [PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    )
    return {"ok": True, "total": total, "page": page,
            "posts": [_post_out(r, my_id) for r in rows]}


@router.get("/posts/{post_id}")
def post_detail(request: Request, post_id: int):
    user = _me(request)
    my_id = user["id"] if user else None
    row = query_one(
        "SELECT p.*, u.nickname FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?",
        (post_id,))
    if not row:
        return {"ok": False, "msg": "帖子不存在"}
    comments = query(
        """SELECT c.*, u.nickname FROM post_comments c
           JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id""",
        (post_id,))
    return {"ok": True, "post": _post_out(row, my_id),
            "comments": [{"id": c["id"], "nickname": c["nickname"], "content": c["content"],
                          "replyTo": c["reply_to"], "mine": bool(my_id and c["user_id"] == my_id),
                          "createdAt": c["created_at"]} for c in comments]}


@router.post("/posts/{post_id}/like")
def toggle_like(request: Request, post_id: int):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    if not query_one("SELECT id FROM posts WHERE id=?", (post_id,)):
        return {"ok": False, "msg": "帖子不存在"}
    liked = query_one("SELECT 1 AS x FROM post_likes WHERE post_id=? AND user_id=?",
                      (post_id, user["id"]))
    if liked:
        execute("DELETE FROM post_likes WHERE post_id=? AND user_id=?", (post_id, user["id"]))
        execute("UPDATE posts SET like_count=like_count-1 WHERE id=? AND like_count>0", (post_id,))
        delta = -1
    else:
        execute("INSERT INTO post_likes(post_id, user_id) VALUES(?,?)", (post_id, user["id"]))
        execute("UPDATE posts SET like_count=like_count+1 WHERE id=?", (post_id,))
        delta = 1
    n = query_one("SELECT like_count AS n FROM posts WHERE id=?", (post_id,))["n"]
    return {"ok": True, "liked": delta > 0, "likeCount": n}


@router.post("/posts/{post_id}/comments")
def add_comment(request: Request, post_id: int, body: dict):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    content = str(body.get("content", "")).strip()
    if not content:
        return {"ok": False, "msg": "评论不能为空"}
    if len(content) > MAX_COMMENT:
        return {"ok": False, "msg": f"评论不能超过 {MAX_COMMENT} 字"}
    reply_to = body.get("replyTo")
    if reply_to is not None:
        rt = query_one("SELECT id FROM post_comments WHERE id=? AND post_id=?",
                       (reply_to, post_id))
        reply_to = rt["id"] if rt else None
    execute("INSERT INTO post_comments(post_id, user_id, reply_to, content) VALUES(?,?,?,?)",
            (post_id, user["id"], reply_to, content))
    execute("UPDATE posts SET comment_count=comment_count+1 WHERE id=?", (post_id,))
    n = query_one("SELECT comment_count AS n FROM posts WHERE id=?", (post_id,))["n"]
    return {"ok": True, "commentCount": n}


@router.post("/posts/{post_id}/delete")
def delete_post(request: Request, post_id: int):
    user = _me(request)
    if not user:
        return {"ok": False, "msg": "请先登录"}
    row = query_one("SELECT user_id FROM posts WHERE id=?", (post_id,))
    if not row:
        return {"ok": False, "msg": "帖子不存在"}
    if row["user_id"] != user["id"]:
        return {"ok": False, "msg": "只能删除自己的帖子"}
    execute("DELETE FROM posts WHERE id=?", (post_id,))
    return {"ok": True}
