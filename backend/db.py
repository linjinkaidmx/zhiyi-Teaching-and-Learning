# -*- coding: utf-8 -*-
"""SQLite 存储层

设计要点：
- 单文件 zhiyi.db，WAL 模式（读写不互斥），busy_timeout 防锁冲突
- 线程本地连接：FastAPI 的同步 def 路由跑在线程池里，
  每线程各自持有连接，规避 sqlite3 的跨线程限制
- 全部标准库，零新增依赖
- 错题 records 存「固定索引列 + JSON 明细列」：
  固定列（subject/question/error_type 等）用于列表查询与筛选，
  其余字段（quizCount/streak/lastQuizAt…）整体塞 data JSON，与前端对象一一对应
"""
import json
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "zhiyi.db"

_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    auth_nonce    TEXT NOT NULL,
    recovery_hash TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    rid            TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT '',
    subject        TEXT NOT NULL DEFAULT '',
    question       TEXT NOT NULL DEFAULT '',
    knowledge_points TEXT NOT NULL DEFAULT '[]',
    error_type     TEXT NOT NULL DEFAULT '',
    mastered       INTEGER NOT NULL DEFAULT 0,
    data           TEXT NOT NULL DEFAULT '{}',
    updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, rid)
);
CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);

CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL DEFAULT 'text',
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    subject     TEXT NOT NULL DEFAULT '',
    question    TEXT NOT NULL DEFAULT '',
    hint        TEXT NOT NULL DEFAULT '',
    answer      TEXT NOT NULL DEFAULT '',
    knowledge_points TEXT NOT NULL DEFAULT '[]',
    error_type  TEXT NOT NULL DEFAULT '',
    like_count  INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    reply_to  INTEGER,
    content   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS groups (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    code      TEXT UNIQUE NOT NULL,
    name      TEXT NOT NULL,
    intro     TEXT NOT NULL DEFAULT '',
    subject   TEXT NOT NULL DEFAULT '',
    owner_id  INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    role      TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_shares (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    rid       TEXT NOT NULL DEFAULT '',
    subject   TEXT NOT NULL DEFAULT '',
    question  TEXT NOT NULL DEFAULT '',
    hint      TEXT NOT NULL DEFAULT '',
    answer    TEXT NOT NULL DEFAULT '',
    knowledge_points TEXT NOT NULL DEFAULT '[]',
    error_type TEXT NOT NULL DEFAULT '',
    note      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
"""


def get_conn() -> sqlite3.Connection:
    """取当前线程的连接（首次使用时建立并初始化表结构）"""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=8000")
        conn.executescript(SCHEMA)
        _local.conn = conn
    return conn


def query(sql: str, args: tuple = ()) -> list:
    """查询，返回 dict 列表"""
    rows = get_conn().execute(sql, args).fetchall()
    return [dict(r) for r in rows]


def query_one(sql: str, args: tuple = ()):
    row = get_conn().execute(sql, args).fetchone()
    return dict(row) if row else None


def execute(sql: str, args: tuple = ()) -> int:
    """写操作，返回 lastrowid"""
    conn = get_conn()
    cur = conn.execute(sql, args)
    conn.commit()
    return cur.lastrowid


def jload(text, default):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return default


def jdump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
