"""知一 · SQLite 存储层。

用标准库 sqlite3 实现（零新增依赖），存储账号（profiles）与错题本（errorbook）。
- WAL 模式 + 单连接 + 全局线程锁，MVP 并发量下安全可靠
- 错题本沿用「id + data JSON 列」模式：学情字段（streak/interval/...）全部落在 data 里，
  后续加字段无需迁移表结构
"""
import json
import os
import sqlite3
import threading
import time
import uuid

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
# 允许用环境变量指定库文件：测试用独立库，避免污染本地开发数据
DB_FILE = os.environ.get("ZHIYI_DB") or os.path.join(DATA_DIR, "zhiyi.db")

# 用可重入锁：create_profile / update_profile_password 在持锁状态下会再调用
# 同样带锁的 find_profile_by_nickname，普通 Lock 会死锁，RLock 允许同线程重入。
_lock = threading.RLock()
_conn: sqlite3.Connection | None = None


def init_db():
    global _conn
    os.makedirs(DATA_DIR, exist_ok=True)
    _conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA busy_timeout=5000")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            auth_nonce TEXT NOT NULL,
            recovery_hash TEXT,
            phone TEXT DEFAULT '',
            client_id TEXT DEFAULT '',
            registered_at INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS errorbook (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_errorbook_user ON errorbook(user_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS question_bank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            normalized TEXT NOT NULL,
            subject TEXT DEFAULT '',
            knowledge_points TEXT DEFAULT '[]',
            answer TEXT DEFAULT '',
            result TEXT NOT NULL,
            hit_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profile (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT '',
            content TEXT NOT NULL,
            contact TEXT DEFAULT '',
            version TEXT DEFAULT '',
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS analysis_cache (
            hash TEXT PRIMARY KEY,
            result TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS variant_cache (
            hash TEXT PRIMARY KEY,
            result TEXT NOT NULL,
            hit_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_courses (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_exams (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_bank_subject ON question_bank(subject)")
    # ---------------- 社区（学习小组 + 论坛） ----------------
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            owner_id TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS group_members (
            group_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            joined_at INTEGER DEFAULT 0,
            PRIMARY KEY (group_id, user_id)
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS group_messages (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            type TEXT DEFAULT 'text',
            content TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_posts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT DEFAULT 'thought',
            title TEXT DEFAULT '',
            content TEXT DEFAULT '',
            card TEXT DEFAULT '',
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_likes (
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at INTEGER DEFAULT 0,
            PRIMARY KEY (post_id, user_id)
        )
        """
    )
    # ---------------- 班级模块（作业 / 提交 / 报告） ----------------
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS homework (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            reference TEXT DEFAULT '',
            due_at INTEGER DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS homework_submissions (
            id TEXT PRIMARY KEY,
            homework_id TEXT NOT NULL,
            class_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            image TEXT DEFAULT '',
            note TEXT DEFAULT '',
            transcript TEXT DEFAULT '',
            score REAL DEFAULT -1,
            feedback TEXT DEFAULT '',
            graded_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            UNIQUE(homework_id, user_id)
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_hsub_homework ON homework_submissions(homework_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS homework_report (
            homework_id TEXT PRIMARY KEY,
            report TEXT DEFAULT '',
            created_at INTEGER DEFAULT 0
        )
        """
    )
    # 老师布置作业的题目图片（最多 9 张；独立表避免列表/详情接口把大图带出来）
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS homework_images (
            id TEXT PRIMARY KEY,
            homework_id TEXT NOT NULL,
            idx INTEGER DEFAULT 0,
            image TEXT NOT NULL
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_hwimg_hw ON homework_images(homework_id)")
    # 班级笔记 / 知识点（老师发布，学生可保存到错题学习）
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS class_notes (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            created_by TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_class_notes_class ON class_notes(class_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS note_images (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            idx INTEGER DEFAULT 0,
            image TEXT NOT NULL
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_noteimg_note ON note_images(note_id)")
    # 班级测试（选择 + 填空，限时，排名）。paper 存完整题目（含答案，不下发学生端）
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS class_tests (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            title TEXT NOT NULL,
            duration_sec INTEGER DEFAULT 600,
            paper TEXT DEFAULT '[]',
            question_count INTEGER DEFAULT 0,
            total_score REAL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_class_tests_class ON class_tests(class_id)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS class_test_attempts (
            id TEXT PRIMARY KEY,
            test_id TEXT NOT NULL,
            class_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            answers TEXT DEFAULT '[]',
            score REAL DEFAULT 0,
            correct_count INTEGER DEFAULT 0,
            duration_sec INTEGER DEFAULT 0,
            started_at INTEGER DEFAULT 0,
            submitted_at INTEGER DEFAULT 0,
            is_timeout INTEGER DEFAULT 0,
            UNIQUE(test_id, user_id)
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_cta_test ON class_test_attempts(test_id)")
    # 轻量列迁移：SQLite 的 ALTER TABLE ADD COLUMN 无 IF NOT EXISTS，先查 PRAGMA 再补
    _ensure_columns(_conn, "profiles", {
        "is_teacher": "INTEGER DEFAULT 0",
        "teacher_meta": "TEXT DEFAULT ''",
    })
    _ensure_columns(_conn, "groups", {
        "type": "TEXT DEFAULT 'study'",
        "meta": "TEXT DEFAULT ''",
    })
    _ensure_columns(_conn, "homework_submissions", {
        "images": "TEXT DEFAULT ''",   # 学生提交的多张答卷图（JSON 数组，<=9 张）
    })
    _conn.commit()
    return _conn


def _ensure_columns(conn, table: str, columns: dict) -> None:
    """给已有表补缺失列（新版本字段）；table 名来自代码内常量，无注入面。"""
    existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for col, decl in columns.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def _conn_checked():
    if _conn is None:
        init_db()
    return _conn


# ---------------------------------------------------------------- profiles

def find_profile_by_nickname(nickname: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM profiles WHERE nickname = ?", (nickname,)
        ).fetchone()
    return dict(row) if row else None


def find_profile_by_client(client_id: str) -> dict | None:
    if not client_id:
        return None
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM profiles WHERE client_id = ?", (client_id,)
        ).fetchone()
    return dict(row) if row else None


def create_profile(nickname: str, password_hash: str, salt: str, auth_nonce: str,
                   recovery_hash: str | None, client_id: str) -> dict:
    now = int(__import__("time").time() * 1000)
    with _lock:
        cur = _conn_checked().execute(
            """
            INSERT INTO profiles
                (nickname, password_hash, salt, auth_nonce, recovery_hash, client_id, registered_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (nickname, password_hash, salt, auth_nonce, recovery_hash, client_id, now, now),
        )
        _conn_checked().commit()
        return find_profile_by_nickname(nickname)


def update_profile_password(nickname: str, password_hash: str, salt: str, auth_nonce: str) -> dict:
    with _lock:
        _conn_checked().execute(
            "UPDATE profiles SET password_hash = ?, salt = ?, auth_nonce = ? WHERE nickname = ?",
            (password_hash, salt, auth_nonce, nickname),
        )
        _conn_checked().commit()
        return find_profile_by_nickname(nickname)


def update_profile_client(nickname: str, client_id: str) -> None:
    with _lock:
        _conn_checked().execute(
            "UPDATE profiles SET client_id = ? WHERE nickname = ?", (client_id, nickname)
        )
        _conn_checked().commit()


def set_recovery_hash(nickname: str, recovery_hash: str) -> None:
    with _lock:
        _conn_checked().execute(
            "UPDATE profiles SET recovery_hash = ? WHERE nickname = ?", (recovery_hash, nickname)
        )
        _conn_checked().commit()


# ---------------------------------------------------------------- errorbook

def save_errorbook(user_id: str, items: list) -> None:
    """全量替换某账号的云端错题本。item 为错题条目对象，含 id 字段。"""
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        conn.execute("DELETE FROM errorbook WHERE user_id = ?", (user_id,))
        for it in items:
            if not isinstance(it, dict) or it.get("id") is None:
                continue
            conn.execute(
                "INSERT OR REPLACE INTO errorbook (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)",
                (str(it["id"]), user_id, json.dumps(it, ensure_ascii=False), now),
            )
        conn.commit()


def load_errorbook(user_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT data FROM errorbook WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
    items = []
    for r in rows:
        try:
            items.append(json.loads(r["data"]))
        except Exception:
            continue
    return items


# ---------------------------------------------------------------- user_stats（打卡/成就）

def save_stats(user_id: str, stats: dict) -> None:
    """覆盖式保存某账号的打卡/成就统计（整体是一个 JSON 对象）。"""
    now = int(__import__("time").time() * 1000)
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO user_stats (user_id, data, updated_at) VALUES (?, ?, ?)",
            (user_id, json.dumps(stats or {}, ensure_ascii=False), now),
        )
        _conn_checked().commit()


def load_stats(user_id: str) -> dict:
    with _lock:
        row = _conn_checked().execute(
            "SELECT data FROM user_stats WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return {}
    try:
        data = json.loads(row["data"])
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


# ---------------------------------------------------------------- user_profile（个人资料）与账号级操作

def save_profile_data(user_id: str, data: dict) -> None:
    """覆盖式保存个人资料（头像/签名/学校/年级/偏好等，整体一个 JSON）。"""
    now = int(__import__("time").time() * 1000)
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO user_profile (user_id, data, updated_at) VALUES (?, ?, ?)",
            (user_id, json.dumps(data or {}, ensure_ascii=False), now),
        )
        _conn_checked().commit()


def load_profile_data(user_id: str) -> dict:
    with _lock:
        row = _conn_checked().execute(
            "SELECT data FROM user_profile WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return {}
    try:
        data = json.loads(row["data"])
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


# 所有以「昵称」作为 user_id 的表。
# 改昵称迁移与注销清理都必须覆盖这里的每一张 —— 曾经因为硬编码三张表，
# 导致批次1 新增的 user_courses / user_sessions 改昵称后变成孤儿数据（线上实测抓到）。
USER_SCOPED_TABLES = (
    "errorbook",
    "user_stats",
    "user_profile",
    "user_courses",
    "user_sessions",
)

# 社区中「以昵称作为 user_id 列、改名要迁移、注销要删除」的表（关系与私密消息）。
# 论坛帖子/评论是公开内容，注销时「匿名化保留」而非删除，故不在此列。
COMMUNITY_USER_TABLES = (
    "group_members",
    "group_messages",
    "forum_likes",
    "homework_submissions",
)


def rename_user(old: str, new: str) -> None:
    """改昵称 = 改登录名：把 USER_SCOPED_TABLES 里所有表的 user_id 一起迁移。"""
    with _lock:
        conn = _conn_checked()
        conn.execute("UPDATE profiles SET nickname = ? WHERE nickname = ?", (new, old))
        for table in USER_SCOPED_TABLES + COMMUNITY_USER_TABLES + ("forum_posts", "forum_comments"):
            conn.execute(f"UPDATE {table} SET user_id = ? WHERE user_id = ?", (new, old))
        # 小组 owner 单独一列；班级作业的 created_by 同理
        conn.execute("UPDATE groups SET owner_id = ? WHERE owner_id = ?", (new, old))
        conn.execute("UPDATE homework SET created_by = ? WHERE created_by = ?", (new, old))
        conn.commit()


def delete_user(user_id: str) -> None:
    """注销账号：清空该账号在云端的一切数据（同样必须覆盖 USER_SCOPED_TABLES）。"""
    with _lock:
        conn = _conn_checked()
        conn.execute("DELETE FROM profiles WHERE nickname = ?", (user_id,))
        for table in USER_SCOPED_TABLES + COMMUNITY_USER_TABLES:
            conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
        # 论坛帖子/评论是公开内容：匿名化保留（作者显示「已注销」），不删别人的评论线程
        conn.execute("UPDATE forum_posts SET user_id = '' WHERE user_id = ?", (user_id,))
        conn.execute("UPDATE forum_comments SET user_id = '' WHERE user_id = ?", (user_id,))
        # 解散自己拥有的小组/班级（连带组消息、成员、作业、提交、报告）
        owned = conn.execute("SELECT id FROM groups WHERE owner_id = ?", (user_id,)).fetchall()
        for g in owned:
            gid = g["id"]
            conn.execute("DELETE FROM group_messages WHERE group_id = ?", (gid,))
            conn.execute("DELETE FROM group_members WHERE group_id = ?", (gid,))
            conn.execute(
                "DELETE FROM homework_submissions WHERE class_id = ?", (gid,)
            )
            hw = conn.execute("SELECT id FROM homework WHERE class_id = ?", (gid,)).fetchall()
            for h in hw:
                conn.execute("DELETE FROM homework_report WHERE homework_id = ?", (h["id"],))
                conn.execute("DELETE FROM homework_images WHERE homework_id = ?", (h["id"],))
            conn.execute("DELETE FROM homework WHERE class_id = ?", (gid,))
            conn.execute("DELETE FROM note_images WHERE note_id IN (SELECT id FROM class_notes WHERE class_id = ?)", (gid,))
            conn.execute("DELETE FROM class_notes WHERE class_id = ?", (gid,))
            conn.execute("DELETE FROM class_test_attempts WHERE class_id = ?", (gid,))
            conn.execute("DELETE FROM class_tests WHERE class_id = ?", (gid,))
            conn.execute("DELETE FROM groups WHERE id = ?", (gid,))
        conn.commit()


def save_feedback(user_id: str, content: str, contact: str = "", version: str = "") -> None:
    now = int(__import__("time").time() * 1000)
    with _lock:
        _conn_checked().execute(
            "INSERT INTO feedback (user_id, content, contact, version, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id or "", content[:4000], (contact or "")[:200], (version or "")[:40], now),
        )
        _conn_checked().commit()


def update_recovery_hash(user_id: str, recovery_hash: str) -> None:
    with _lock:
        _conn_checked().execute(
            "UPDATE profiles SET recovery_hash = ? WHERE nickname = ?", (recovery_hash, user_id)
        )
        _conn_checked().commit()


# ---------------------------------------------------------------- question_bank（题库）

def save_bank_item(question: str, normalized: str, subject: str,
                   knowledge_points: list, answer: str, result: dict) -> int:
    """新增或更新一条题库记录（按归一化文本去重）。返回该条 id。"""
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        row = conn.execute("SELECT id FROM question_bank WHERE normalized = ?", (normalized,)).fetchone()
        if row:
            conn.execute(
                "UPDATE question_bank SET question=?, subject=?, knowledge_points=?, answer=?, result=? WHERE id=?",
                (question, subject, json.dumps(knowledge_points, ensure_ascii=False), answer,
                 json.dumps(result, ensure_ascii=False), row["id"]),
            )
            conn.commit()
            return row["id"]
        cur = conn.execute(
            "INSERT INTO question_bank (question, normalized, subject, knowledge_points, answer, result, hit_count, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
            (question, normalized, subject, json.dumps(knowledge_points, ensure_ascii=False), answer,
             json.dumps(result, ensure_ascii=False), now),
        )
        conn.commit()
        return cur.lastrowid


def load_all_bank() -> list:
    """返回题库全部条目（供 bank.py 做文本匹配）。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT id, question, normalized, subject, knowledge_points, answer, result FROM question_bank"
        ).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "question": r["question"],
            "normalized": r["normalized"],
            "subject": r["subject"],
            "knowledge_points": json.loads(r["knowledge_points"]) if r["knowledge_points"] else [],
            "answer": r["answer"],
            "result": json.loads(r["result"]) if r["result"] else {},
        })
    return out


def increment_bank_hit(bank_id: int) -> None:
    with _lock:
        _conn_checked().execute(
            "UPDATE question_bank SET hit_count = hit_count + 1 WHERE id = ?", (bank_id,)
        )
        _conn_checked().commit()


def bank_count() -> int:
    with _lock:
        row = _conn_checked().execute("SELECT COUNT(*) AS c FROM question_bank").fetchone()
    return row["c"] if row else 0


# ---------------------------------------------------------------- 课程 / 学习记录（批次1）

MAX_SESSIONS = 300          # 与前端上限一致
MAX_COURSES = 60            # 防止异常大 payload
MAX_PAPERS = 60             # 模拟试卷保留上限（含作答与成绩）
MAX_BLOB_CHARS = 400_000    # 单个 blob 字符上限（约 400KB），超出视为异常直接拒绝


def _save_blob(table: str, user_id: str, payload) -> None:
    text = json.dumps(payload, ensure_ascii=False)
    if len(text) > MAX_BLOB_CHARS:
        raise ValueError("数据过大，已拒绝写入")
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        conn.execute(
            f"INSERT OR REPLACE INTO {table} (user_id, data, updated_at) VALUES (?, ?, ?)",
            (user_id, text, now),
        )
        conn.commit()


def _load_blob(table: str, user_id: str, default):
    with _lock:
        row = _conn_checked().execute(
            f"SELECT data FROM {table} WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return default
    try:
        return json.loads(row["data"])
    except Exception:
        return default


def save_courses(user_id: str, data: dict) -> None:
    """课程 / 章节 / 知识点 / 课表（含删除墓碑 deletedIds），整体一个 JSON 对象。"""
    payload = data if isinstance(data, dict) else {}
    courses = payload.get("courses")
    if isinstance(courses, list) and len(courses) > MAX_COURSES:
        payload = dict(payload)
        payload["courses"] = courses[:MAX_COURSES]
    _save_blob("user_courses", user_id, payload)


def load_courses(user_id: str) -> dict:
    data = _load_blob("user_courses", user_id, {})
    return data if isinstance(data, dict) else {}


def save_sessions(user_id: str, items: list) -> None:
    """学习记录数组（只追加，按 createdAt 倒序截断上限）。"""
    arr = items if isinstance(items, list) else []
    arr = [x for x in arr if isinstance(x, dict)]
    arr.sort(key=lambda x: x.get("createdAt") or 0, reverse=True)
    _save_blob("user_sessions", user_id, arr[:MAX_SESSIONS])


def load_sessions(user_id: str) -> list:
    data = _load_blob("user_sessions", user_id, [])
    return data if isinstance(data, list) else []


def save_exams(user_id: str, items: list) -> None:
    """模拟考试试卷数组（含作答与成绩，只保留最近若干张）。"""
    arr = items if isinstance(items, list) else []
    arr = [x for x in arr if isinstance(x, dict)]
    arr.sort(key=lambda x: x.get("createdAt") or 0, reverse=True)
    _save_blob("user_exams", user_id, arr[:MAX_PAPERS])


def load_exams(user_id: str) -> list:
    data = _load_blob("user_exams", user_id, [])
    return data if isinstance(data, list) else []


# ---------------------------------------------------------------- 变式题缓存（批次2）

def get_variant_cache(hash_key: str) -> dict | None:
    """命中则返回缓存的 items（并累加命中次数），未命中返回 None。"""
    if not hash_key:
        return None
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT result FROM variant_cache WHERE hash = ?", (hash_key,)
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE variant_cache SET hit_count = hit_count + 1 WHERE hash = ?", (hash_key,)
        )
        conn.commit()
    try:
        return json.loads(row["result"])
    except Exception:
        return None


def put_variant_cache(hash_key: str, result) -> None:
    if not hash_key:
        return
    text = json.dumps(result, ensure_ascii=False)
    if len(text) > MAX_BLOB_CHARS:
        return
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT OR REPLACE INTO variant_cache (hash, result, hit_count, created_at) VALUES (?, ?, 0, ?)",
            (hash_key, text, now),
        )
        conn.commit()


def variant_cache_stats() -> dict:
    with _lock:
        row = _conn_checked().execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(hit_count), 0) AS hits FROM variant_cache"
        ).fetchone()
    return {"entries": row["n"], "hits": row["hits"]}


# ---------------------------------------------------------------- 学情分析缓存（批次4）

ANALYSIS_TTL_MS = 24 * 3600 * 1000     # 24 小时内直接复用，避免重复计费


def get_analysis_cache(hash_key: str, ttl_ms: int = ANALYSIS_TTL_MS) -> dict | None:
    """命中且未过期才返回，否则返回 None（过期项顺手清掉）。"""
    if not hash_key:
        return None
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT result, created_at FROM analysis_cache WHERE hash = ?", (hash_key,)
        ).fetchone()
        if not row:
            return None
        if now - int(row["created_at"] or 0) > ttl_ms:
            conn.execute("DELETE FROM analysis_cache WHERE hash = ?", (hash_key,))
            conn.commit()
            return None
    try:
        return json.loads(row["result"])
    except Exception:
        return None


def put_analysis_cache(hash_key: str, result) -> None:
    if not hash_key:
        return
    text = json.dumps(result, ensure_ascii=False)
    if len(text) > MAX_BLOB_CHARS:
        return
    now = int(__import__("time").time() * 1000)
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT OR REPLACE INTO analysis_cache (hash, result, created_at) VALUES (?, ?, ?)",
            (hash_key, text, now),
        )
        conn.commit()


# ---------------------------------------------------------------- 社区：学习小组

def _now() -> int:
    return int(time.time() * 1000)


def create_group(name: str, description: str, owner_id: str) -> dict:
    gid = uuid.uuid4().hex
    code = uuid.uuid4().hex[:8].upper()
    now = _now()
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO groups (id, name, description, owner_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (gid, name[:60], (description or "")[:200], owner_id, code, now),
        )
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
            (gid, owner_id, now),
        )
        conn.commit()
    return get_group(gid)


def get_group(gid: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute("SELECT * FROM groups WHERE id = ?", (gid,)).fetchone()
    return dict(row) if row else None


def get_group_by_invite(code: str) -> dict | None:
    if not code:
        return None
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM groups WHERE invite_code = ?", (code.strip().upper(),)
        ).fetchone()
    return dict(row) if row else None


def _group_member_count(gid: str) -> int:
    with _lock:
        row = _conn_checked().execute(
            "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?", (gid,)
        ).fetchone()
    return row["c"] if row else 0


def list_groups_of_user(user_id: str) -> list:
    """返回我加入的所有小组（含成员数与 owner）。"""
    with _lock:
        rows = _conn_checked().execute(
            """
            SELECT g.*, gm.role AS my_role FROM groups g
            JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
            ORDER BY g.created_at DESC
            """,
            (user_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["member_count"] = _group_member_count(d["id"])
        out.append(d)
    return out


def is_group_member(gid: str, user_id: str) -> bool:
    with _lock:
        row = _conn_checked().execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (gid, user_id)
        ).fetchone()
    return row is not None


def join_group(gid: str, user_id: str) -> bool:
    """加入小组；已是成员返回 False。"""
    with _lock:
        conn = _conn_checked()
        if conn.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (gid, user_id)
        ).fetchone():
            return False
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
            (gid, user_id, _now()),
        )
        conn.commit()
    return True


def list_group_members(gid: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT user_id, role, joined_at FROM group_members WHERE group_id = ? ORDER BY joined_at ASC",
            (gid,),
        ).fetchall()
    return [dict(r) for r in rows]


def add_group_message(gid: str, user_id: str, msg_type: str, content: str) -> dict:
    mid = uuid.uuid4().hex
    now = _now()
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO group_messages (id, group_id, user_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, gid, user_id, msg_type, content, now),
        )
        conn.commit()
    return {"id": mid, "group_id": gid, "user_id": user_id, "type": msg_type, "content": content, "created_at": now}


def list_group_messages_since(gid: str, since_created_at: int, limit: int = 50) -> list:
    """增量拉取：created_at 严格大于给定时间戳的消息（升序）。

    群聊实时推送用（每 2s 拉一次），只取新增部分，避免重复传输整段历史。
    """
    with _lock:
        rows = _conn_checked().execute(
            "SELECT * FROM group_messages WHERE group_id = ? AND created_at > ?"
            " ORDER BY created_at ASC, id ASC LIMIT ?",
            (gid, int(since_created_at or 0), max(1, min(limit, 100))),
        ).fetchall()
    return [dict(r) for r in rows]


def list_group_messages(gid: str, limit: int = 100, offset: int = 0) -> dict:
    """组内消息（时间正序返回，方便前端往上接），返回 {items, total}。"""
    with _lock:
        conn = _conn_checked()
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM group_messages WHERE group_id = ?", (gid,)
        ).fetchone()["c"]
        rows = conn.execute(
            "SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?",
            (gid, max(1, min(limit, 200)), max(0, offset)),
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total}


# ---------------------------------------------------------------- 班级模块

MAX_HOMEWORK_CONTENT = 8000
MAX_SUBMISSION_IMAGE = 700_000  # base64 字符上限（压缩后 jpeg 约 500KB 实际字节）


def set_teacher(user_id: str, meta: dict) -> dict:
    """自助声明式教师认证：写入 is_teacher 与认证信息（JSON）。"""
    text = json.dumps(meta, ensure_ascii=False)[:500]
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "UPDATE profiles SET is_teacher = 1, teacher_meta = ? WHERE nickname = ?",
            (text, user_id),
        )
        conn.commit()
    return get_teacher(user_id)


def get_teacher(user_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT is_teacher, teacher_meta FROM profiles WHERE nickname = ?", (user_id,)
        ).fetchone()
    if not row:
        return None
    meta = {}
    try:
        meta = json.loads(row["teacher_meta"] or "{}")
    except Exception:
        meta = {}
    return {"is_teacher": bool(row["is_teacher"]), "meta": meta}


def create_class(name: str, subject: str, grade: str, owner_id: str) -> dict:
    """创建班级（type='class' 的 group），创建者 role='teacher'。"""
    gid = uuid.uuid4().hex
    code = uuid.uuid4().hex[:6].upper()  # 班级码 6 位，比小组邀请码短、好念
    now = _now()
    meta = json.dumps({"subject": (subject or "")[:30], "grade": (grade or "")[:20]},
                      ensure_ascii=False)
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO groups (id, name, description, owner_id, invite_code, type, meta, created_at)"
            " VALUES (?, ?, '', ?, ?, 'class', ?, ?)",
            (gid, name[:60], owner_id, code, meta, now),
        )
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'teacher', ?)",
            (gid, owner_id, now),
        )
        conn.commit()
    return get_group(gid)


def list_classes_of_user(user_id: str) -> list:
    """我加入的班级（排除学习小组）。"""
    with _lock:
        rows = _conn_checked().execute(
            """
            SELECT g.*, gm.role AS my_role FROM groups g
            JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
            WHERE g.type = 'class'
            ORDER BY g.created_at DESC
            """,
            (user_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["member_count"] = _group_member_count(d["id"])
        out.append(d)
    return out


def is_class_teacher(gid: str, user_id: str) -> bool:
    """是否该班级的老师（群 owner）。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT owner_id, type FROM groups WHERE id = ?", (gid,)
        ).fetchone()
    return bool(row and row["type"] == "class" and row["owner_id"] == user_id)


def list_class_students(gid: str) -> list:
    """班级全部学生（role='student' 的成员）。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT user_id, joined_at FROM group_members WHERE group_id = ? AND role = 'student'"
            " ORDER BY joined_at ASC",
            (gid,),
        ).fetchall()
    return [dict(r) for r in rows]


MAX_HOMEWORK_IMAGES = 9
MAX_HOMEWORK_IMAGE_CHARS = 450_000    # 单张压缩后 base64 上限（约 450KB）


def create_homework(class_id: str, title: str, content: str, reference: str,
                    due_at: int, created_by: str, images=None) -> dict:
    hid = uuid.uuid4().hex
    now = _now()
    imgs = [str(x) for x in (images or [])][:MAX_HOMEWORK_IMAGES]
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO homework (id, class_id, title, content, reference, due_at, created_by, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (hid, class_id, title[:120], (content or "")[:MAX_HOMEWORK_CONTENT],
             (reference or "")[:MAX_HOMEWORK_CONTENT], int(due_at or 0), created_by, now),
        )
        for i, img in enumerate(imgs):
            conn.execute(
                "INSERT INTO homework_images (id, homework_id, idx, image) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, hid, i, img[:MAX_HOMEWORK_IMAGE_CHARS]),
            )
        conn.commit()
    return get_homework(hid)


def get_homework(hid: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute("SELECT * FROM homework WHERE id = ?", (hid,)).fetchone()
    return dict(row) if row else None


def get_homework_images(hid: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT image FROM homework_images WHERE homework_id = ? ORDER BY idx", (hid,)
        ).fetchall()
    return [r["image"] for r in rows]


def get_homework_image_count(hid: str) -> int:
    with _lock:
        row = _conn_checked().execute(
            "SELECT COUNT(*) AS c FROM homework_images WHERE homework_id = ?", (hid,)
        ).fetchone()
    return int(row["c"]) if row else 0


def list_homework(class_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT hw.*, (SELECT COUNT(*) FROM homework_images hi WHERE hi.homework_id = hw.id) AS images_count"
            " FROM homework hw WHERE hw.class_id = ? ORDER BY hw.created_at DESC",
            (class_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_submission(homework_id: str, class_id: str, user_id: str,
                      image: str, note: str, images=None) -> dict:
    """提交/重新提交作业（截止校验在接口层）。重复提交覆盖图与说明，批改结果清空。
    images：多张答卷图（<=9 张）；image 保留第一张（兼容旧读取端）。"""
    sid = uuid.uuid4().hex
    now = _now()
    imgs = [str(x) for x in (images or []) if str(x).startswith("data:image/")][:MAX_HOMEWORK_IMAGES]
    if not imgs and image:
        imgs = [image]
    first = imgs[0] if imgs else image
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT id FROM homework_submissions WHERE homework_id = ? AND user_id = ?",
            (homework_id, user_id),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE homework_submissions SET image = ?, images = ?, note = ?, transcript = '',"
                " score = -1, feedback = '', graded_at = 0, updated_at = ? WHERE id = ?",
                (first, json.dumps(imgs, ensure_ascii=False), (note or "")[:1000], now, row["id"]),
            )
            sid = row["id"]
        else:
            conn.execute(
                "INSERT INTO homework_submissions"
                " (id, homework_id, class_id, user_id, image, images, note, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (sid, homework_id, class_id, user_id, first,
                 json.dumps(imgs, ensure_ascii=False), (note or "")[:1000], now),
            )
        conn.commit()
    return get_submission(homework_id, user_id)


def get_submission(homework_id: str, user_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM homework_submissions WHERE homework_id = ? AND user_id = ?",
            (homework_id, user_id),
        ).fetchone()
    return _submission_public(dict(row)) if row else None


def _submission_public(d: dict) -> dict:
    """对外输出：不含 image/images 本体（大头），只给张数；批改结果原样。"""
    imgs = []
    try:
        imgs = json.loads(d.pop("images", "") or "[]")
        if not isinstance(imgs, list):
            imgs = []
    except Exception:
        imgs = []
    first = d.pop("image", "")
    d["has_image"] = bool(first) or bool(imgs)
    d["images_count"] = len(imgs) if imgs else (1 if first else 0)
    try:
        d["feedback"] = json.loads(d["feedback"]) if d.get("feedback") else None
    except Exception:
        d["feedback"] = None
    return d


def list_submissions(homework_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT * FROM homework_submissions WHERE homework_id = ? ORDER BY updated_at ASC",
            (homework_id,),
        ).fetchall()
    return [_submission_public(dict(r)) for r in rows]


def get_submission_image(homework_id: str, user_id: str) -> str | None:
    """仅老师取图时使用（走独立接口，避免列表携带大对象）。兼容旧单图数据。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT image, images FROM homework_submissions WHERE homework_id = ? AND user_id = ?",
            (homework_id, user_id),
        ).fetchone()
    if not row:
        return None
    if row["image"]:
        return row["image"]
    try:
        imgs = json.loads(row["images"] or "[]")
        return imgs[0] if isinstance(imgs, list) and imgs else None
    except Exception:
        return None


def get_submission_images(homework_id: str, user_id: str) -> list:
    """取某学生提交的全部答卷图（新数据读 images JSON，旧数据回落单张 image）。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT image, images FROM homework_submissions WHERE homework_id = ? AND user_id = ?",
            (homework_id, user_id),
        ).fetchone()
    if not row:
        return []
    try:
        imgs = json.loads(row["images"] or "[]")
        if isinstance(imgs, list) and imgs:
            return [str(x) for x in imgs]
    except Exception:
        pass
    return [row["image"]] if row["image"] else []


def get_submission_full(sub_id: str) -> dict | None:
    """批改用：含 image 本体。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM homework_submissions WHERE id = ?", (sub_id,)
        ).fetchone()
    return dict(row) if row else None


def find_submission_id(homework_id: str, user_id: str) -> str | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT id FROM homework_submissions WHERE homework_id = ? AND user_id = ?",
            (homework_id, user_id),
        ).fetchone()
    return row["id"] if row else None


# ---------------- 班级笔记 / 知识点（老师发布，学生可保存到错题学习） ----------------

def create_note(class_id: str, title: str, content: str, created_by: str, images=None) -> dict:
    nid = uuid.uuid4().hex
    now = _now()
    imgs = [str(x) for x in (images or []) if str(x).startswith("data:image/")][:MAX_HOMEWORK_IMAGES]
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO class_notes (id, class_id, title, content, created_by, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (nid, class_id, title[:120], (content or "")[:MAX_HOMEWORK_CONTENT], created_by, now),
        )
        for i, img in enumerate(imgs):
            conn.execute(
                "INSERT INTO note_images (id, note_id, idx, image) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, nid, i, img[:MAX_HOMEWORK_IMAGE_CHARS]),
            )
        conn.commit()
    return get_note(nid)


def get_note(note_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute("SELECT * FROM class_notes WHERE id = ?", (note_id,)).fetchone()
    return dict(row) if row else None


def get_note_class(note_id: str) -> dict | None:
    """鉴权用：note 所在班级行（groups）。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT g.* FROM class_notes n JOIN groups g ON g.id = n.class_id WHERE n.id = ?",
            (note_id,),
        ).fetchone()
    return dict(row) if row else None


def list_notes(class_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT n.*, (SELECT COUNT(*) FROM note_images ni WHERE ni.note_id = n.id) AS images_count"
            " FROM class_notes n WHERE n.class_id = ? ORDER BY n.created_at DESC",
            (class_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_note_images(note_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT image FROM note_images WHERE note_id = ? ORDER BY idx", (note_id,)
        ).fetchall()
    return [r["image"] for r in rows]


def delete_note(note_id: str) -> None:
    with _lock:
        conn = _conn_checked()
        conn.execute("DELETE FROM note_images WHERE note_id = ?", (note_id,))
        conn.execute("DELETE FROM class_notes WHERE id = ?", (note_id,))
        conn.commit()


# ---------------- 班级测试（选择 + 填空，限时，排名） ----------------

def create_test(class_id: str, title: str, duration_sec: int, paper: list, created_by: str) -> dict:
    tid = uuid.uuid4().hex
    now = _now()
    total = round(sum(float(q.get("score") or 0) for q in paper), 1)
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO class_tests (id, class_id, title, duration_sec, paper, question_count, total_score, created_by, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (tid, class_id, title[:120], int(duration_sec), json.dumps(paper, ensure_ascii=False),
             len(paper), total, created_by, now),
        )
        conn.commit()
    return get_test(tid)


def get_test(test_id: str) -> dict | None:
    """完整测试（含 paper 答案），仅服务端判分与老师编辑用。"""
    with _lock:
        row = _conn_checked().execute("SELECT * FROM class_tests WHERE id = ?", (test_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["paper"] = json.loads(d.get("paper") or "[]")
    except Exception:
        d["paper"] = []
    return d


def get_test_class(test_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT g.* FROM class_tests t JOIN groups g ON g.id = t.class_id WHERE t.id = ?",
            (test_id,),
        ).fetchone()
    return dict(row) if row else None


def list_tests(class_id: str, user_id: str = "") -> list:
    """测试列表（不带题目本体），附带当前用户的作答状态。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT t.id, t.class_id, t.title, t.duration_sec, t.question_count, t.total_score,"
            " t.created_by, t.created_at,"
            " (SELECT COUNT(*) FROM class_test_attempts a WHERE a.test_id = t.id) AS attempt_count,"
            " a2.score AS my_score, a2.duration_sec AS my_duration, a2.is_timeout AS my_timeout"
            " FROM class_tests t"
            " LEFT JOIN class_test_attempts a2 ON a2.test_id = t.id AND a2.user_id = ?"
            " WHERE t.class_id = ? ORDER BY t.created_at DESC",
            (user_id, class_id),
        ).fetchall()
    return [dict(r) for r in rows]


def start_attempt(test_id: str, class_id: str, user_id: str) -> dict:
    """开始作答：幂等，已有记录直接返回（started_at 不变，防刷新重置计时）。"""
    now = _now()
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT * FROM class_test_attempts WHERE test_id = ? AND user_id = ?",
            (test_id, user_id),
        ).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO class_test_attempts (id, test_id, class_id, user_id, started_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (uuid.uuid4().hex, test_id, class_id, user_id, now),
            )
            conn.commit()
    return get_attempt(test_id, user_id)


def get_attempt(test_id: str, user_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM class_test_attempts WHERE test_id = ? AND user_id = ?",
            (test_id, user_id),
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["answers"] = json.loads(d.get("answers") or "{}")
    except Exception:
        d["answers"] = {}
    return d


def save_attempt_result(attempt_id: str, answers: dict, score: float,
                        correct_count: int, duration_sec: int, is_timeout: bool) -> None:
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "UPDATE class_test_attempts SET answers = ?, score = ?, correct_count = ?,"
            " duration_sec = ?, submitted_at = ?, is_timeout = ? WHERE id = ?",
            (json.dumps(answers, ensure_ascii=False), round(score, 1), correct_count,
             int(duration_sec), _now(), 1 if is_timeout else 0, attempt_id),
        )
        conn.commit()


def list_attempts(test_id: str) -> list:
    """排名用：得分降序、用时升序（已提交者）。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT user_id, score, correct_count, duration_sec, is_timeout, submitted_at"
            " FROM class_test_attempts WHERE test_id = ? AND submitted_at > 0"
            " ORDER BY score DESC, duration_sec ASC, submitted_at ASC",
            (test_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def count_attempt(test_id: str, user_id: str) -> dict | None:
    return get_attempt(test_id, user_id)


def save_grade(sub_id: str, score: float, feedback: dict, transcript: str) -> None:
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "UPDATE homework_submissions SET score = ?, feedback = ?, transcript = ?, graded_at = ?"
            " WHERE id = ?",
            (float(score), json.dumps(feedback, ensure_ascii=False)[:MAX_HOMEWORK_CONTENT],
             (transcript or "")[:MAX_HOMEWORK_CONTENT], _now(), sub_id),
        )
        conn.commit()


def save_report(homework_id: str, report: dict) -> None:
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT OR REPLACE INTO homework_report (homework_id, report, created_at) VALUES (?, ?, ?)",
            (homework_id, json.dumps(report, ensure_ascii=False)[:MAX_HOMEWORK_CONTENT], _now()),
        )
        conn.commit()


def get_report(homework_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT report, created_at FROM homework_report WHERE homework_id = ?", (homework_id,)
        ).fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["report"])
    except Exception:
        data = None
    return {"report": data, "created_at": row["created_at"]}


# ---------------------------------------------------------------- 社区：论坛

MAX_POST_CHARS = 20000


def create_post(user_id: str, ptype: str, title: str, content: str, card: str) -> dict:
    pid = uuid.uuid4().hex
    now = _now()
    title = (title or "")[:120]
    content = (content or "")[:MAX_POST_CHARS]
    card = (card or "")[:MAX_POST_CHARS]
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO forum_posts (id, user_id, type, title, content, card, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (pid, user_id, ptype, title, content, card, now, now),
        )
        conn.commit()
    return get_post(pid)


def get_post(pid: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            """
            SELECT p.*,
                (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id) AS comment_count,
                (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) AS like_count
            FROM forum_posts p WHERE p.id = ?
            """,
            (pid,),
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    if d.get("card"):
        try:
            d["card"] = json.loads(d["card"])
        except Exception:
            d["card"] = None
    else:
        d["card"] = None
    return d


def list_posts(sort: str = "latest", limit: int = 20, offset: int = 0) -> dict:
    """帖子列表。sort=latest 按时间，hot 按点赞数。返回 {items, total}。"""
    order = "p.created_at DESC" if sort != "hot" else "like_count DESC, p.created_at DESC"
    with _lock:
        conn = _conn_checked()
        total = conn.execute("SELECT COUNT(*) AS c FROM forum_posts").fetchone()["c"]
        rows = conn.execute(
            f"""
            SELECT p.*,
                (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id) AS comment_count,
                (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) AS like_count
            FROM forum_posts p
            ORDER BY {order}
            LIMIT ? OFFSET ?
            """,
            (max(1, min(limit, 50)), max(0, offset)),
        ).fetchall()
    items = []
    for r in rows:
        d = dict(r)
        if d.get("card"):
            try:
                d["card"] = json.loads(d["card"])
            except Exception:
                d["card"] = None
        else:
            d["card"] = None
        items.append(d)
    return {"items": items, "total": total}


def delete_post(pid: str, user_id: str) -> bool:
    """作者删除自己的帖子（连带评论与点赞）。"""
    with _lock:
        conn = _conn_checked()
        cur = conn.execute("DELETE FROM forum_posts WHERE id = ? AND user_id = ?", (pid, user_id))
        if cur.rowcount:
            conn.execute("DELETE FROM forum_comments WHERE post_id = ?", (pid,))
            conn.execute("DELETE FROM forum_likes WHERE post_id = ?", (pid,))
            conn.commit()
            return True
    return False


def create_comment(pid: str, user_id: str, content: str) -> dict:
    cid = uuid.uuid4().hex
    now = _now()
    content = (content or "")[:4000]
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "INSERT INTO forum_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (cid, pid, user_id, content, now),
        )
        conn.commit()
    return {"id": cid, "post_id": pid, "user_id": user_id, "content": content, "created_at": now}


def list_comments(pid: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT * FROM forum_comments WHERE post_id = ? ORDER BY created_at ASC", (pid,)
        ).fetchall()
    return [dict(r) for r in rows]


def toggle_like(pid: str, user_id: str) -> dict:
    """点赞/取消点赞（幂等）。返回 {liked, count}。"""
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT 1 FROM forum_likes WHERE post_id = ? AND user_id = ?", (pid, user_id)
        ).fetchone()
        if row:
            conn.execute("DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?", (pid, user_id))
            liked = False
        else:
            conn.execute(
                "INSERT INTO forum_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
                (pid, user_id, _now()),
            )
            liked = True
        conn.commit()
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM forum_likes WHERE post_id = ?", (pid,)
        ).fetchone()["c"]
    return {"liked": liked, "count": count}
