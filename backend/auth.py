"""知一 · 账号安全模块。

纯标准库实现（hashlib / hmac / secrets / base64），零新增依赖：
- 密码：pbkdf2_hmac-sha256，30 万轮迭代 + 每用户独立盐，比较用 hmac.compare_digest 防时序攻击
- 会话：无状态 HMAC token = base64url(nickname) + '.' + 过期时间 + '.' + HMAC(nickname::authNonce::exp)
  服务端不存会话表；改密/重置轮换 authNonce → 旧 token 全部失效
- 找回：8 位备份码（去 0/O、1/I/L 易混淆字符），bcrypt 等价的安全存储（pbkdf2 存 hash）
- 限流：登录 15 分钟 5 次，按「昵称 + IP」双维度，内存态
"""
import base64
import hashlib
import hmac
import secrets
import time

# ---------------------------------------------------------------- 密码

PBKDF2_ITERATIONS = 300_000


def gen_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return dk.hex()


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    try:
        candidate = hash_password(password, salt)
    except Exception:
        return False
    return hmac.compare_digest(candidate, password_hash)


def valid_password_len(pw) -> bool:
    return isinstance(pw, str) and 6 <= len(pw) <= 64


# ---------------------------------------------------------------- 无状态 token

ACC_SALT = "zhiyi::account::salt::v1"
ACC_TTL_SECONDS = 30 * 24 * 3600  # 30 天


def make_token(profile: dict) -> str:
    exp = int(time.time()) + ACC_TTL_SECONDS
    body = f"{profile['nickname']}::{profile.get('auth_nonce', '')}::{exp}"
    sig = hmac.new(ACC_SALT.encode(), body.encode(), hashlib.sha256).hexdigest()
    user_b64 = base64.urlsafe_b64encode(profile["nickname"].encode("utf-8")).decode().rstrip("=")
    return f"{user_b64}.{exp}.{sig}"


def _resolve_profile(nickname: str):
    import db
    return db.find_profile_by_nickname(nickname)


def parse_token(token: str):
    """校验 token，返回 profile dict 或 None。"""
    if not isinstance(token, str) or not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        nickname = base64.urlsafe_b64decode(parts[0] + "=" * (-len(parts[0]) % 4)).decode("utf-8")
        exp = int(parts[1])
    except Exception:
        return None
    if exp < int(time.time()):
        return None
    profile = _resolve_profile(nickname)
    if not profile or not profile.get("password_hash"):
        return None
    body = f"{nickname}::{profile.get('auth_nonce', '')}::{exp}"
    expect = hmac.new(ACC_SALT.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, parts[2]):
        return None
    return profile


# ---------------------------------------------------------------- 备份码

_BACKUP_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def gen_backup_code() -> str:
    s = "".join(secrets.choice(_BACKUP_CHARS) for _ in range(8))
    return f"{s[:4]}-{s[4:]}"


def norm_backup(code) -> str:
    return "".join(c for c in str(code or "").upper() if c.isalnum())


# ---------------------------------------------------------------- 登录限流

LOGIN_MAX = 5
LOGIN_WINDOW_SECONDS = 15 * 60


class LoginLimiter:
    """内存态登录限流：按「昵称小写 + IP」双维度，恶意者无法借此锁他人账号。"""

    def __init__(self):
        self._fails = {}

    def _key(self, nickname: str, ip: str) -> str:
        return f"{nickname.lower()}|{ip}"

    def lock_msg(self, nickname: str, ip: str) -> str | None:
        rec = self._fails.get(self._key(nickname, ip))
        if rec and rec.get("lock_until", 0) > time.time():
            mins = int((rec["lock_until"] - time.time()) / 60) + 1
            return f"失败次数过多，登录已临时锁定，请约 {mins} 分钟后再试"
        return None

    def record_fail(self, nickname: str, ip: str) -> int:
        key = self._key(nickname, ip)
        rec = self._fails.get(key) or {"count": 0, "lock_until": 0, "window_start": time.time()}
        if time.time() - rec["window_start"] > LOGIN_WINDOW_SECONDS:
            rec = {"count": 0, "lock_until": 0, "window_start": time.time()}
        rec["count"] += 1
        if rec["count"] >= LOGIN_MAX:
            rec["lock_until"] = time.time() + LOGIN_WINDOW_SECONDS
            rec["count"] = 0
            rec["window_start"] = time.time()
        self._fails[key] = rec
        return max(0, LOGIN_MAX - rec["count"])

    def clear(self, nickname: str, ip: str):
        self._fails.pop(self._key(nickname, ip), None)
