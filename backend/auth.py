# -*- coding: utf-8 -*-
"""账号系统：注册 / 登录 / 会话 / 找回 + 错题同步

凭据方案（照搬 jubensha-pinchedating 的成熟设计，改为 Python 实现）：
- 密码：pbkdf2_hmac-sha256，30 万迭代，随机盐，格式 pbkdf2$iter$salt$hash
- token：三段式 base64url(userId).exp.HMAC(userId::authNonce::exp)，30 天有效，
  无服务端会话表；authNonce 存库，改密码即轮换 → 旧 token 全部即时失效
- 备份码：注册时一次性返回明文，库里只存哈希；昵称+备份码可重置密码
- 防爆破：内存计数，同一 昵称+IP 15 分钟内失败 5 次锁 15 分钟
- 全部标准库，零新增依赖
"""
import base64
import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Request

from db import query, query_one, execute, jdump, jload

router = APIRouter(prefix="/api")

ACC_SECRET = os.getenv("ZHIYI_ACC_SECRET", "zhiyi-dev-secret-please-override")
ACC_TTL_MS = 30 * 24 * 3600 * 1000  # 30 天

PASSWORD_MIN, PASSWORD_MAX = 6, 64
NICKNAME_MIN, NICKNAME_MAX = 2, 20

# 登录限流：key=(nickname, ip) -> 失败时间戳队列
_login_fails = defaultdict(deque)
FAIL_WINDOW = 15 * 60
FAIL_LIMIT = 5


# ---------------------------------------------------------------------------
# 密码与备份码
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    salt = secrets.token_hex(8)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 300_000)
    return f"pbkdf2$300000${salt}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, iters, salt, expect = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(iters))
        return hmac.compare_digest(dk.hex(), expect)
    except (ValueError, AttributeError):
        return False


def make_backup_code() -> str:
    raw = secrets.token_hex(4).upper()  # 8 位十六进制
    return f"{raw[:4]}-{raw[4:]}"


# ---------------------------------------------------------------------------
# token 签发与校验
# ---------------------------------------------------------------------------
def _b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def _b64url_decode(s: str) -> str:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode()).decode()


def make_token(user: dict) -> str:
    exp = int(time.time() * 1000) + ACC_TTL_MS
    body = f"{user['id']}::{user['auth_nonce']}::{exp}"
    sig = hmac.new(ACC_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{_b64url(str(user['id']))}.{exp}.{sig}"


def user_from_token(token: str):
    """校验 token，返回用户行；无效/过期/改密后返回 None"""
    if not token or token.count(".") != 2:
        return None
    uid_b64, exp_s, sig = token.split(".")
    try:
        uid = _b64url_decode(uid_b64)
        exp = int(exp_s)
    except (ValueError, UnicodeDecodeError):
        return None
    if exp < int(time.time() * 1000):
        return None
    user = query_one("SELECT * FROM users WHERE id=?", (uid,))
    if not user:
        return None
    body = f"{user['id']}::{user['auth_nonce']}::{exp}"
    expect = hmac.new(ACC_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expect):
        return None  # nonce 已轮换（改过密码）或签名错误
    return user


def _rotate_nonce(user_id: int):
    execute("UPDATE users SET auth_nonce=? WHERE id=?", (secrets.token_hex(16), user_id))


# ---------------------------------------------------------------------------
# 登录限流
# ---------------------------------------------------------------------------
def _login_blocked(nickname: str, ip: str) -> int:
    """返回剩余锁定秒数，0 表示未锁"""
    key = (nickname, ip)
    now = time.time()
    q = _login_fails[key]
    while q and now - q[0] > FAIL_WINDOW:
        q.popleft()
    if len(q) >= FAIL_LIMIT:
        return int(FAIL_WINDOW - (now - q[0])) + 1
    return 0


def _login_fail(nickname: str, ip: str):
    _login_fails[(nickname, ip)].append(time.time())


def _login_ok(nickname: str, ip: str):
    _login_fails.pop((nickname, ip), None)


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------
def _valid_nickname(n: str) -> bool:
    return NICKNAME_MIN <= len(n.strip()) <= NICKNAME_MAX


def _valid_password(p: str) -> bool:
    return PASSWORD_MIN <= len(p) <= PASSWORD_MAX


def _token_body(user: dict) -> dict:
    return {"token": make_token(user), "nickname": user["nickname"], "userId": user["id"]}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


# ---------------------------------------------------------------------------
# 账号路由
# ---------------------------------------------------------------------------
@router.post("/account/register")
def register(req: Request, body: dict):
    nickname = str(body.get("nickname", "")).strip()
    password = str(body.get("password", ""))
    confirm = str(body.get("passwordConfirm", password))
    if not _valid_nickname(nickname):
        return {"ok": False, "msg": f"昵称需 {NICKNAME_MIN}-{NICKNAME_MAX} 个字符"}
    if not _valid_password(password):
        return {"ok": False, "msg": f"密码需 {PASSWORD_MIN}-{PASSWORD_MAX} 位"}
    if password != confirm:
        return {"ok": False, "msg": "两次输入的密码不一致"}
    if query_one("SELECT id FROM users WHERE nickname=?", (nickname,)):
        return {"ok": False, "msg": "该昵称已被注册"}

    backup = make_backup_code()
    uid = execute(
        "INSERT INTO users(nickname, password_hash, auth_nonce, recovery_hash) VALUES(?,?,?,?)",
        (nickname, hash_password(password), secrets.token_hex(16), hash_password(backup)),
    )
    user = query_one("SELECT * FROM users WHERE id=?", (uid,))
    return {"ok": True, **_token_body(user), "backupCode": backup}


@router.post("/account/login")
def login(req: Request, body: dict):
    nickname = str(body.get("nickname", "")).strip()
    password = str(body.get("password", ""))
    ip = _client_ip(req)

    remain = _login_blocked(nickname, ip)
    if remain > 0:
        return {"ok": False, "msg": f"失败次数过多，请 {remain // 60 + 1} 分钟后再试"}

    user = query_one("SELECT * FROM users WHERE nickname=?", (nickname,))
    if not user or not verify_password(password, user["password_hash"]):
        _login_fail(nickname, ip)
        return {"ok": False, "msg": "昵称或密码不正确"}

    _login_ok(nickname, ip)
    return {"ok": True, **_token_body(user)}


@router.post("/account/verify")
def verify(body: dict):
    user = user_from_token(str(body.get("token", "")))
    if not user:
        return {"ok": False, "msg": "登录已过期"}
    return {"ok": True, **_token_body(user)}


@router.post("/account/change-password")
def change_password(body: dict):
    user = user_from_token(str(body.get("token", "")))
    if not user:
        return {"ok": False, "msg": "登录已过期，请重新登录"}
    old_pw = str(body.get("oldPassword", ""))
    new_pw = str(body.get("newPassword", ""))
    if not verify_password(old_pw, user["password_hash"]):
        return {"ok": False, "msg": "原密码不正确"}
    if not _valid_password(new_pw):
        return {"ok": False, "msg": f"新密码需 {PASSWORD_MIN}-{PASSWORD_MAX} 位"}
    execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(new_pw), user["id"]))
    _rotate_nonce(user["id"])  # 旧 token 全部失效
    user = query_one("SELECT * FROM users WHERE id=?", (user["id"],))
    return {"ok": True, **_token_body(user)}


@router.post("/account/recover")
def recover(body: dict):
    nickname = str(body.get("nickname", "")).strip()
    backup = str(body.get("backupCode", "")).strip().upper()
    new_pw = str(body.get("newPassword", ""))
    if not _valid_password(new_pw):
        return {"ok": False, "msg": f"新密码需 {PASSWORD_MIN}-{PASSWORD_MAX} 位"}
    user = query_one("SELECT * FROM users WHERE nickname=?", (nickname,))
    if not user or not user["recovery_hash"] or not verify_password(backup, user["recovery_hash"]):
        return {"ok": False, "msg": "昵称或备份码不正确"}
    execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(new_pw), user["id"]))
    _rotate_nonce(user["id"])
    user = query_one("SELECT * FROM users WHERE id=?", (user["id"],))
    return {"ok": True, **_token_body(user)}


# ---------------------------------------------------------------------------
# 错题与学习记录同步（登录态）
# ---------------------------------------------------------------------------
def _record_out(row: dict) -> dict:
    """数据库行 -> 前端 record 对象（data JSON 展平 + 固定列覆盖）"""
    rec = jload(row["data"], {})
    rec["id"] = row["rid"]
    rec["source"] = row["source"] or rec.get("source", "")
    rec["subject"] = row["subject"] or rec.get("subject", "")
    rec["question"] = row["question"] if row["question"] else rec.get("question", "")
    rec["knowledge_points"] = jload(row["knowledge_points"], rec.get("knowledge_points", []))
    rec["error_type"] = row["error_type"] if row["error_type"] else rec.get("error_type", "")
    rec["mastered"] = bool(row["mastered"])
    return rec


@router.get("/records")
def list_records(request: Request):
    user = user_from_token(request.headers.get("x-account-token", ""))
    if not user:
        return {"ok": False, "msg": "未登录"}
    rows = query("SELECT * FROM records WHERE user_id=? ORDER BY updated_at DESC", (user["id"],))
    return {"ok": True, "records": [_record_out(r) for r in rows]}


@router.post("/records/upsert")
def upsert_record(request: Request, body: dict):
    user = user_from_token(request.headers.get("x-account-token", ""))
    if not user:
        return {"ok": False, "msg": "未登录"}
    rec = body.get("record")
    if not isinstance(rec, dict) or not str(rec.get("id", "")).strip():
        return {"ok": False, "msg": "record 缺少 id"}
    rid = str(rec["id"]).strip()
    kps = rec.get("knowledge_points") or []
    if not isinstance(kps, list):
        kps = [str(kps)]
    execute(
        """INSERT INTO records(user_id, rid, source, subject, question, knowledge_points,
                               error_type, mastered, data, updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,datetime('now','localtime'))
           ON CONFLICT(user_id, rid) DO UPDATE SET
               source=excluded.source, subject=excluded.subject, question=excluded.question,
               knowledge_points=excluded.knowledge_points, error_type=excluded.error_type,
               mastered=excluded.mastered, data=excluded.data,
               updated_at=datetime('now','localtime')""",
        (user["id"], rid, str(rec.get("source", "")), str(rec.get("subject", "")),
         str(rec.get("question", "")), jdump(kps), str(rec.get("error_type", "")),
         1 if rec.get("mastered") else 0, jdump(rec)),
    )
    return {"ok": True}


@router.post("/records/delete")
def delete_record(request: Request, body: dict):
    user = user_from_token(request.headers.get("x-account-token", ""))
    if not user:
        return {"ok": False, "msg": "未登录"}
    rid = str(body.get("rid", "")).strip()
    if not rid:
        return {"ok": False, "msg": "缺少 rid"}
    execute("DELETE FROM records WHERE user_id=? AND rid=?", (user["id"], rid))
    return {"ok": True}
