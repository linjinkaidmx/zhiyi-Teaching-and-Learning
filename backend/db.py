"""知一 · SQLite 存储层。

用标准库 sqlite3 实现（零新增依赖），存储账号（profiles）与错题本（errorbook）。
- WAL 模式 + 单连接 + 全局线程锁，MVP 并发量下安全可靠
- 错题本沿用「id + data JSON 列」模式：学情字段（streak/interval/...）全部落在 data 里，
  后续加字段无需迁移表结构
"""
import json
import os
import re
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
            id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, id)
        )
        """
    )
    # 原表以 id 全局唯一，会让不同账号相同 id 相互覆盖。事务迁移保留现存数据。
    pk = [r['name'] for r in sorted(_conn.execute('PRAGMA table_info(errorbook)').fetchall(), key=lambda r: r['pk']) if r['pk']]
    if pk != ['user_id', 'id']:
        with _conn:
            _conn.execute('CREATE TABLE errorbook_scoped (id TEXT NOT NULL, user_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER DEFAULT 0, PRIMARY KEY(user_id,id))')
            _conn.execute('INSERT INTO errorbook_scoped SELECT id,user_id,data,updated_at FROM errorbook')
            _conn.execute('DROP TABLE errorbook')
            _conn.execute('ALTER TABLE errorbook_scoped RENAME TO errorbook')
    _conn.execute('CREATE TABLE IF NOT EXISTS errorbook_deleted (user_id TEXT NOT NULL, id TEXT NOT NULL, deleted_at INTEGER NOT NULL, PRIMARY KEY(user_id,id))')
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
    # 2026-10-08 精准出题：用户知识点画像状态（伴学讲崩/讲通计数 + 方向轮换游标 + 近期去重）
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_kp_state (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
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
    # ---------------- 伴学角色（聊天历史 + 个性化偏好） ----------------
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_msgs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            role TEXT NOT NULL,            -- 'user' | 'assistant'
            kind TEXT DEFAULT 'chat',      -- 'chat' | 'quiz'
            content TEXT NOT NULL,
            meta TEXT DEFAULT '',          -- JSON：{source, question_id, ...}
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_comp_msgs_user ON companion_msgs(user_id, character_id, created_at)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_pref (
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            name TEXT DEFAULT '',
            size_scale REAL DEFAULT 1.0,
            updated_at INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, character_id)
        )
        """
    )
    _ensure_columns(_conn, "companion_pref", {"memory": "TEXT DEFAULT ''"})
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_intimacy (
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            exp INTEGER DEFAULT 0,          -- 累计经验（每 50 点升一级，Lv1-7 封顶）
            updated_at INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, character_id)
        )
        """
    )
    # ---------------- p20 多会话聊天记录（每次进入伙伴页新开一条，记忆按会话隔离） ----------------
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_sessions (
            id TEXT PRIMARY KEY,           -- uuid hex
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            title TEXT DEFAULT '',         -- 自动取首句前 18 字 / 用户重命名
            msg_count INTEGER DEFAULT 0,   -- 冗余计数（抽屉列表展示 + 长期记忆触发）
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_comp_sess_user ON companion_sessions(user_id, character_id, updated_at)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS study_session (
            id TEXT PRIMARY KEY,            -- chain uuid
            uid TEXT NOT NULL,
            character_id TEXT DEFAULT '',
            question_id TEXT DEFAULT '',
            layers INTEGER DEFAULT 0,       -- 总层数
            good_layers INTEGER DEFAULT 0,  -- 讲通层数
            wrong_layers TEXT DEFAULT '[]', -- JSON: [层下标]
            scores TEXT DEFAULT '[]',       -- JSON: [{layer, concept, logic, expression, total}]
            avg TEXT DEFAULT '{}',          -- JSON: {concept, logic, expression, total}
            steps TEXT DEFAULT '[]',        -- JSON: 回放用层快照
            passed INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_study_session_uid ON study_session(uid, created_at)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS quiz_chains (
            id TEXT PRIMARY KEY,           -- chain uuid
            user_id TEXT NOT NULL,
            question_id TEXT NOT NULL,     -- 锚定的错题本题目 id
            steps TEXT DEFAULT '[]',       -- JSON: [{ask, expected, hint}]
            progress INTEGER DEFAULT 0,    -- 已通过的层数（=当前层 idx）
            streak INTEGER DEFAULT 0,      -- 当前层连续讲错次数
            layer_tries INTEGER DEFAULT 0, -- 当前层累计未过次数（wrong+partial 都计，2026-10-08 同层2次跳层用）
            wrong_steps TEXT DEFAULT '[]', -- 讲崩的层 idx JSON 数组
            status TEXT DEFAULT 'active',  -- active | done
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_quiz_chains_user ON quiz_chains(user_id, status)")
    # ---------------- AI 教学老师（2026-10-09）：大纲 + 教学线 ----------------
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS teaching_syllabus (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            subject TEXT DEFAULT '',        -- 学科名（可来自「我的课程」或手输）
            course_id TEXT DEFAULT '',      -- 关联 user_courses 里的课程 id（可空）
            teacher_id TEXT DEFAULT '',     -- 'chenli' | 'shentong'
            title TEXT DEFAULT '',
            items TEXT DEFAULT '[]',        -- JSON: [{name, brief}]
            cursor INTEGER DEFAULT 0,       -- 讲到第几个知识点
            kp_done TEXT DEFAULT '[]',      -- JSON: [int] 已确认掌握（点过"会了"）的知识点索引
            level TEXT DEFAULT 'auto',      -- auto | basic | final | kaoyan
            status TEXT DEFAULT 'active',   -- active | done
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_teach_syl_user ON teaching_syllabus(user_id, status)")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS teaching_session (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            syllabus_id TEXT NOT NULL,
            teacher_id TEXT DEFAULT '',
            kp_index INTEGER DEFAULT 0,
            state TEXT DEFAULT 'lecture',   -- lecture | exam | graded | done
            kp_payload TEXT DEFAULT '{}',   -- JSON: {kp, example, exam} 三段（含参考答案）
            answer TEXT DEFAULT '',         -- 学生最后一次作答原文
            grade TEXT DEFAULT '{}',        -- JSON: 批改结果
            ask_log TEXT DEFAULT '[]',      -- JSON: 疑问插队记录
            turns INTEGER DEFAULT 0,
            minutes INTEGER DEFAULT 0,      -- 本讲耗时（进学习记录）
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        )
        """
    )
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_teach_sess_user ON teaching_session(user_id, syllabus_id, updated_at)")
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
    # p20 多会话：存量表补 session_id 列（幂等）——必须先补列再建 session 索引
    _ensure_columns(_conn, "companion_msgs", {"session_id": "TEXT DEFAULT ''"})
    _ensure_columns(_conn, "quiz_chains", {"session_id": "TEXT DEFAULT ''", "layer_tries": "INTEGER DEFAULT 0"})
    # 教学大纲：每章"已确认掌握"标记（2026-10-09 章节目录）
    _ensure_columns(_conn, "teaching_syllabus", {"kp_done": "TEXT DEFAULT '[]'"})
    # 章节两级化（2026-10-10）：chapters 章分组、version、archived（旧课作废重开）、unit_tests 章末试卷
    _ensure_columns(_conn, "teaching_syllabus", {
        "chapters": "TEXT DEFAULT '[]'",
        "version": "INTEGER DEFAULT 1",
        "archived": "INTEGER DEFAULT 0",
        "unit_tests": "TEXT DEFAULT '{}'",
    })
    # v1 旧课归档（用户拍板：作废重开；不物理删，反悔可手工翻回 archived=0）
    try:
        _conn.execute("UPDATE teaching_syllabus SET archived = 1 WHERE version < 2 AND archived = 0")
    except Exception:
        pass
    _merge_dup_syllabi(_conn)
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_comp_msgs_sess ON companion_msgs(session_id)")
    _migrate_companion_sessions(_conn)
    _conn.commit()
    return _conn


def norm_subject_key(s: str) -> str:
    """课程名归一化键：去空白与常见标点、转小写（同名课判重用）。"""
    import re as _re
    t = _re.sub(r"[\s，,。．\.、；;：:！!？?~～（）()\[\]【】]+", "", str(s or ""))
    return t.lower()


def _merge_dup_syllabi(conn) -> None:
    """存量同名课合并（2026-10-10 用户拍板）：同一用户内 version>=2 且未归档的课，
    按归一化课程名分组，保留「已确认节数最多」（平手取最近更新）的一门，其余连教学线一起删除。
    幂等——合并后无重复；启动时执行一次。"""
    try:
        rows = conn.execute(
            "SELECT id, user_id, subject, status, kp_done, updated_at FROM teaching_syllabus"
            " WHERE version >= 2 AND archived = 0").fetchall()
        groups = {}
        for r in rows:
            key = (r["user_id"], norm_subject_key(r["subject"] or r["title"]))
            if not key[1]:
                continue                       # 无名的课不参与合并
            groups.setdefault(key, []).append(r)
        for (uid, _k), lst in groups.items():
            if len(lst) <= 1:
                continue
            def _rank(r):
                try:
                    done = len(json.loads(r["kp_done"] or "[]"))
                except Exception:
                    done = 0
                return (done, int(r["updated_at"] or 0), 0 if r["status"] == "active" else 1)
            keep = max(lst, key=_rank)
            for r in lst:
                if r["id"] == keep["id"]:
                    continue
                conn.execute("DELETE FROM teaching_session WHERE user_id = ? AND syllabus_id = ?",
                             (uid, r["id"]))
                conn.execute("DELETE FROM teaching_syllabus WHERE id = ? AND user_id = ?",
                             (r["id"], uid))
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass


def _migrate_companion_sessions(conn) -> None:
    """p20 存量迁移：把每个 (user, character) 的无会话消息归成一条「以前的聊天」记录。
    幂等——只处理 session_id='' 的孤儿消息；旧 active 链无归属（quiz_chains 原本不分角色），
    保持 session_id=''，对按会话过滤的续教查找不可见，即视为自动作废。"""
    try:
        rows = conn.execute(
            "SELECT user_id, character_id, MIN(created_at) AS t0, COUNT(*) AS n"
            " FROM companion_msgs WHERE session_id = '' GROUP BY user_id, character_id"
        ).fetchall()
        for r in rows:
            sid = uuid.uuid4().hex[:16]
            conn.execute(
                "INSERT INTO companion_sessions (id, user_id, character_id, title, msg_count, created_at, updated_at)"
                " VALUES (?, ?, ?, '以前的聊天', ?, ?, ?)",
                (sid, r["user_id"], r["character_id"], int(r["n"] or 0), int(r["t0"] or 0), int(time.time() * 1000)),
            )
            conn.execute(
                "UPDATE companion_msgs SET session_id = ?"
                " WHERE user_id = ? AND character_id = ? AND session_id = ''",
                (sid, r["user_id"], r["character_id"]),
            )
    except Exception:
        # 迁移失败不阻塞启动（表结构已就绪，最多老消息暂不可见）
        pass


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

def save_errorbook(user_id: str, items: list, deleted_ids=None, *, from_client=False) -> dict:
    """合并账号条目；缺项不删除。显式墓碑优先，旧客户端不能复活已删除题。

    客户端同 id 按 updatedAt 冲突裁决；无版本旧客户端不能覆盖已有版本。
    服务端批改更新使用当前时间，只更新实际变化的条目。恢复删除题需创建新 id。
    """
    now = int(__import__("time").time() * 1000)
    saved = dropped = 0
    with _lock:
        conn = _conn_checked()
        with conn:
            for item_id in deleted_ids or []:
                if not isinstance(item_id, (str, int)) or not str(item_id):
                    continue
                conn.execute('INSERT OR IGNORE INTO errorbook_deleted VALUES (?,?,?)', (user_id, str(item_id), now))
                conn.execute('DELETE FROM errorbook WHERE user_id=? AND id=?', (user_id, str(item_id)))
            dead = {r['id'] for r in conn.execute('SELECT id FROM errorbook_deleted WHERE user_id=?', (user_id,))}
            for it in items:
                if not isinstance(it, dict) or not isinstance(it.get('id'), (str, int)) or not str(it['id']):
                    dropped += 1
                    continue
                item_id = str(it['id'])
                if item_id in dead:
                    continue
                old = conn.execute('SELECT data,updated_at FROM errorbook WHERE user_id=? AND id=?', (user_id,item_id)).fetchone()
                if old and json.loads(old['data']) == it:
                    saved += 1
                    continue
                raw_stamp = it.get('updatedAt', 0)
                stamp = min(int(raw_stamp), now) if isinstance(raw_stamp, (int, float)) and 0 <= raw_stamp < 1e16 else 0
                if from_client and old and stamp <= old['updated_at']:
                    continue
                if not from_client and old and stamp and stamp < old['updated_at']:
                    # A server worker may also hold a snapshot loaded before another write.
                    continue
                value = dict(it)
                value['updatedAt'] = (stamp or now) if from_client else max(now, (old['updated_at'] + 1) if old else now)
                conn.execute(
                    'INSERT INTO errorbook (id,user_id,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
                    (item_id,user_id,json.dumps(value,ensure_ascii=False),value['updatedAt']),
                )
                saved += 1
    return {"saved": saved, "dropped": dropped}


def load_errorbook(user_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT data, updated_at FROM errorbook WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
    items = []
    for r in rows:
        try:
            item = json.loads(r['data'])
            item['updatedAt'] = r['updated_at']
            items.append(item)
        except Exception:
            continue
    return items


def errorbook_deleted_ids(user_id: str) -> list:
    with _lock:
        return [r['id'] for r in _conn_checked().execute('SELECT id FROM errorbook_deleted WHERE user_id=?', (user_id,))]


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
    "errorbook_deleted",
    "user_stats",
    "user_profile",
    "user_courses",
    "user_sessions",
    "user_exams",
    "user_kp_state",
    "companion_msgs",
    "companion_pref",
    "companion_sessions",
    "companion_intimacy",
    "quiz_chains",
    "teaching_syllabus",
    "teaching_session",
    "class_test_attempts",
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
        conn.execute("UPDATE class_notes SET created_by = ? WHERE created_by = ?", (new, old))
        conn.execute("UPDATE class_tests SET created_by = ? WHERE created_by = ?", (new, old))
        conn.execute("UPDATE study_session SET uid = ? WHERE uid = ?", (new, old))
        conn.execute("UPDATE feedback SET user_id = ? WHERE user_id = ?", (new, old))
        if conn.execute("SELECT 1 FROM sqlite_master WHERE name='custom_companion'").fetchone():
            conn.execute('UPDATE custom_companion SET user_id=? WHERE user_id=?', (new, old))
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
        conn.execute("UPDATE feedback SET user_id = '' WHERE user_id = ?", (user_id,))
        conn.execute('DELETE FROM study_session WHERE uid=?', (user_id,))
        if conn.execute("SELECT 1 FROM sqlite_master WHERE name='custom_companion'").fetchone():
            conn.execute('DELETE FROM custom_companion WHERE user_id=?', (user_id,))
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

_LEADING_NO_RE = re.compile(r"^\s*(?:[（(]\s*[0-9]{1,2}\s*[)）]|[0-9]{1,2}\s*[.．][ \t]+|[0-9]{1,2}\s*、)\s*")


def strip_leading_no(q: str) -> str:
    """无损剥除题干前导题号（“(2) ”/“12. ”/“3、”），序号对题目内容零贡献。
    点号形式要求序号后有空白，避免误伤“3.14 是圆周率”这类以数字开头的正文。"""
    return _LEADING_NO_RE.sub("", (q or "").strip(), count=1)


def save_bank_item(question: str, normalized: str, subject: str,
                   knowledge_points: list, answer: str, result: dict) -> int:
    """新增或更新一条题库记录（按归一化文本去重）。返回该条 id。
    2026-10-08 入库闸门：无损剥除题干前导题号（“(2) ”/“12. ”/“3、”）——拍题切分可能把
    大题的小问单独成题入库，序号对内容零贡献，剥掉后题源保持干净。"""
    question = strip_leading_no(question)
    normalized = strip_leading_no(normalized)
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


def get_bank_by_id(bank_id) -> dict | None:
    """按 id 取单条题库记录（小老师兜底抽题/链式判分复取用）。"""
    with _lock:
        r = _conn_checked().execute(
            "SELECT id, question, normalized, subject, knowledge_points, answer, result "
            "FROM question_bank WHERE id = ?", (str(bank_id),)).fetchone()
    if not r:
        return None
    return {
        "id": r["id"],
        "question": r["question"],
        "normalized": r["normalized"],
        "subject": r["subject"],
        "knowledge_points": json.loads(r["knowledge_points"]) if r["knowledge_points"] else [],
        "answer": r["answer"],
        "result": json.loads(r["result"]) if r["result"] else {},
    }


def random_bank_items(n: int = 5) -> list:
    """随机抽 n 条题库记录（优先带完整解析的），错题本为空时兜底求教用。"""
    sql = ("SELECT id, question, normalized, subject, knowledge_points, answer, result "
           "FROM question_bank ")
    with _lock:
        rows = _conn_checked().execute(sql + "WHERE length(result) > 20 ORDER BY RANDOM() LIMIT ?",
                                       (int(n),)).fetchall()
        if not rows:
            rows = _conn_checked().execute(sql + "ORDER BY RANDOM() LIMIT ?", (int(n),)).fetchall()
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


def _rows_to_bank(rows) -> list:
    """题库行 → dict（统一 result/knowledge_points 反序列化）。"""
    out = []
    for r in rows:
        try:
            kps = json.loads(r["knowledge_points"]) if r["knowledge_points"] else []
        except Exception:
            kps = []
        try:
            res = json.loads(r["result"]) if r["result"] else {}
        except Exception:
            res = {}
        out.append({
            "id": r["id"],
            "question": r["question"],
            "normalized": r["normalized"],
            "subject": r["subject"],
            "knowledge_points": kps,
            "answer": r["answer"],
            "result": res,
        })
    return out


def bank_by_keywords(keywords: list, limit: int = 20) -> list:
    """按科目关键词抽题（方向兜底用）：subject LIKE 任一词，优先带完整解析的。"""
    kws = [str(k).strip() for k in (keywords or []) if str(k).strip()]
    if not kws:
        return []
    where = " OR ".join(["subject LIKE ?"] * len(kws))
    params = ["%" + k + "%" for k in kws] + [int(limit)]
    sql = ("SELECT id, question, normalized, subject, knowledge_points, answer, result "
           "FROM question_bank ")
    with _lock:
        rows = _conn_checked().execute(
            sql + "WHERE (" + where + ") AND length(result) > 20 ORDER BY RANDOM() LIMIT ?",
            tuple(params)).fetchall()
        if not rows:
            rows = _conn_checked().execute(
                sql + "WHERE (" + where + ") ORDER BY RANDOM() LIMIT ?", tuple(params)).fetchall()
    return _rows_to_bank(rows)


def bank_by_knowledge(kps: list, limit: int = 8) -> list:
    """按知识点抽题：knowledge_points 是 JSON 数组文本，用 '\"知识点\"' 精确匹配元素，
    避免「极限」误命中「极限环」这类子串问题。"""
    kws = [str(k).strip() for k in (kps or []) if str(k).strip()]
    if not kws:
        return []
    where = " OR ".join(["knowledge_points LIKE ?"] * len(kws))
    params = ['%"' + k + '"%' for k in kws] + [int(limit)]
    sql = ("SELECT id, question, normalized, subject, knowledge_points, answer, result "
           "FROM question_bank ")
    with _lock:
        rows = _conn_checked().execute(
            sql + "WHERE (" + where + ") AND length(result) > 20 ORDER BY RANDOM() LIMIT ?",
            tuple(params)).fetchall()
        if not rows:
            rows = _conn_checked().execute(
                sql + "WHERE (" + where + ") ORDER BY RANDOM() LIMIT ?", tuple(params)).fetchall()
    return _rows_to_bank(rows)


def increment_bank_hit(bank_id: int) -> None:
    with _lock:
        _conn_checked().execute(
            "UPDATE question_bank SET hit_count = hit_count + 1 WHERE id = ?", (bank_id,)
        )
        _conn_checked().commit()


# ---------------------------------------------------------------- user_kp_state（精准出题画像状态）

def kp_state_load(user_id: str) -> dict:
    """知识点画像的持久化增量：伴学讲崩/讲通计数、方向轮换游标、近期出题去重。"""
    data = _load_blob("user_kp_state", user_id, {})
    return data if isinstance(data, dict) else {}


def kp_state_save(user_id: str, data: dict) -> None:
    _save_blob("user_kp_state", user_id, data if isinstance(data, dict) else {})


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


def leave_group(gid: str, user_id: str) -> bool:
    """退出小组（组长不能直接退出，需先解散）。成功返回 True。"""
    with _lock:
        conn = _conn_checked()
        g = conn.execute("SELECT owner_id FROM groups WHERE id = ?", (gid,)).fetchone()
        if not g or g["owner_id"] == user_id:
            return False
        cur = conn.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (gid, user_id)
        )
        conn.commit()
        return cur.rowcount > 0


def remove_group_member(gid: str, owner_id: str, target_user_id: str) -> bool:
    """组长移除成员（不能移除自己）。成功返回 True。"""
    with _lock:
        conn = _conn_checked()
        g = conn.execute("SELECT owner_id FROM groups WHERE id = ?", (gid,)).fetchone()
        if not g or g["owner_id"] != owner_id or target_user_id == owner_id:
            return False
        cur = conn.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (gid, target_user_id)
        )
        conn.commit()
        return cur.rowcount > 0


def dissolve_group(gid: str, owner_id: str) -> bool:
    """解散小组（仅组长）：连同成员与消息一起清掉。成功返回 True。"""
    with _lock:
        conn = _conn_checked()
        g = conn.execute("SELECT owner_id FROM groups WHERE id = ?", (gid,)).fetchone()
        if not g or g["owner_id"] != owner_id:
            return False
        conn.execute("DELETE FROM group_messages WHERE group_id = ?", (gid,))
        conn.execute("DELETE FROM group_members WHERE group_id = ?", (gid,))
        conn.execute("DELETE FROM groups WHERE id = ?", (gid,))
        conn.commit()
    return True


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


def class_todo_counts(class_id: str, user_id: str, is_teacher: bool) -> dict:
    """班级待办统计：老师=待批改的提交数；学生=未提交的作业数。

    列表页卡片用它给出「下一步动作」，避免每次点进详情才知道有没有活。
    """
    with _lock:
        conn = _conn_checked()
        if is_teacher:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM homework_submissions s"
                " JOIN homework hw ON hw.id = s.homework_id"
                " WHERE hw.class_id = ? AND s.graded_at = 0",
                (class_id,),
            ).fetchone()
            return {"pending_grade": row["c"] if row else 0, "pending_submit": 0}
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM homework hw"
            " WHERE hw.class_id = ? AND NOT EXISTS ("
            "   SELECT 1 FROM homework_submissions s"
            "   WHERE s.homework_id = hw.id AND s.user_id = ?)",
            (class_id, user_id),
        ).fetchone()
        return {"pending_grade": 0, "pending_submit": row["c"] if row else 0}


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


# ---------------------------------------------------------------- 伴学角色（聊天历史 + 偏好）

MAX_SESSION_MSGS = 300        # 每条会话的消息保留上限（p20：从每角色 500 改为每会话 300）
MAX_COMPANION_MSGS = 1500     # 每用户单角色全部会话合计保留上限，防无限膨胀
MAX_COMPANION_SESSIONS = 30   # 每用户单角色的会话条数上限，超出自动清最旧
MEMORY_MAX_CHARS = 400        # 长期印象滚动上限（追加新印象后裁剪）


def _touch_session(conn, session_id: str) -> None:
    """消息增删后同步会话冗余字段（msg_count + updated_at）。session_id 为空/不存在时静默。"""
    if not session_id:
        return
    try:
        cnt = conn.execute(
            "SELECT COUNT(*) AS c FROM companion_msgs WHERE session_id = ?", (session_id,)
        ).fetchone()["c"]
        conn.execute(
            "UPDATE companion_sessions SET msg_count = ?, updated_at = ? WHERE id = ?",
            (int(cnt), int(time.time() * 1000), session_id),
        )
    except Exception:
        pass


def add_companion_msg(user_id: str, character_id: str, role: str,
                      kind: str, content: str, meta: dict | None = None,
                      session_id: str = "") -> int:
    now = _now()
    with _lock:
        conn = _conn_checked()
        cur = conn.execute(
            "INSERT INTO companion_msgs (user_id, character_id, role, kind, content, meta, session_id, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, character_id, role, kind, content[:4000],
             json.dumps(meta or {}, ensure_ascii=False), str(session_id or ""), now),
        )
        # 只留最近 MAX_SESSION_MSGS 条（按会话）+ 全角色合计 MAX_COMPANION_MSGS 条（防膨胀）
        conn.execute(
            """
            DELETE FROM companion_msgs WHERE user_id = ? AND character_id = ? AND session_id = ? AND id NOT IN (
                SELECT id FROM companion_msgs WHERE user_id = ? AND character_id = ? AND session_id = ?
                ORDER BY created_at DESC, id DESC LIMIT ?
            )
            """,
            (user_id, character_id, session_id, user_id, character_id, session_id, MAX_SESSION_MSGS),
        )
        conn.execute(
            """
            DELETE FROM companion_msgs WHERE user_id = ? AND character_id = ? AND id NOT IN (
                SELECT id FROM companion_msgs WHERE user_id = ? AND character_id = ?
                ORDER BY created_at DESC, id DESC LIMIT ?
            )
            """,
            (user_id, character_id, user_id, character_id, MAX_COMPANION_MSGS),
        )
        _touch_session(conn, session_id)
        conn.commit()
        return cur.lastrowid


def list_companion_msgs(user_id: str, character_id: str, limit: int = 200,
                        session_id: str = "") -> list:
    """某用户某角色的聊天历史（时间正序）；session_id 非空则只取该条会话。"""
    sql = ("SELECT id, role, kind, content, meta, created_at FROM companion_msgs"
           " WHERE user_id = ? AND character_id = ?")
    args: list = [user_id, character_id]
    if session_id:
        sql += " AND session_id = ?"
        args.append(session_id)
    sql += " ORDER BY created_at ASC, id ASC LIMIT ?"
    args.append(max(1, min(limit, 500)))
    with _lock:
        rows = _conn_checked().execute(sql, args).fetchall()
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"] or "{}")
        except Exception:
            meta = {}
        out.append({
            "id": r["id"], "role": r["role"], "kind": r["kind"],
            "content": r["content"], "meta": meta, "created_at": r["created_at"],
        })
    return out


def companion_context(user_id: str, character_id: str, limit: int = 12,
                      session_id: str = "") -> list:
    """给模型当上下文的最近若干条（时间正序），只取 chat/quiz 文本。
    p20：session_id 非空 = 记忆隔离（只带本会话），为空则兼容旧调用（全角色流水）。"""
    sql = "SELECT role, content FROM companion_msgs WHERE user_id = ? AND character_id = ?"
    args: list = [user_id, character_id]
    if session_id:
        sql += " AND session_id = ?"
        args.append(session_id)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    args.append(max(1, min(limit, 24)))
    with _lock:
        rows = _conn_checked().execute(sql, args).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


# ---------------- p20 多会话聊天记录 CRUD ----------------

def create_companion_session(user_id: str, character_id: str, title: str = "") -> dict:
    """开一条新会话；每角色超过 MAX_COMPANION_SESSIONS 条时自动清最旧
    （连同其消息一并删除、进行中的链作废为 done）。返回新会话快照。"""
    now = int(time.time() * 1000)
    sid = uuid.uuid4().hex[:16]
    with _lock:
        conn = _conn_checked()
        rows = conn.execute(
            "SELECT id FROM companion_sessions WHERE user_id = ? AND character_id = ?"
            " ORDER BY updated_at ASC, created_at ASC",
            (user_id, character_id),
        ).fetchall()
        overflow = len(rows) - (MAX_COMPANION_SESSIONS - 1)
        for r in rows[:max(0, overflow)]:
            old = r["id"]
            conn.execute("DELETE FROM companion_msgs WHERE session_id = ? AND user_id = ?", (old, user_id))
            conn.execute(
                "UPDATE quiz_chains SET status = 'done' WHERE user_id = ? AND session_id = ? AND status = 'active'",
                (user_id, old),
            )
            conn.execute("DELETE FROM companion_sessions WHERE id = ?", (old,))
        conn.execute(
            "INSERT INTO companion_sessions (id, user_id, character_id, title, msg_count, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, 0, ?, ?)",
            (sid, user_id, character_id, (title or "").strip()[:18], now, now),
        )
        conn.commit()
    return {"id": sid, "title": (title or "").strip()[:18], "msg_count": 0,
            "created_at": now, "updated_at": now, "last": "", "has_chain": False}


def list_companion_sessions(user_id: str, character_id: str, limit: int = 30) -> list:
    """会话列表（按最近活跃倒序）：标题 / 计数 / 最后一句预览 / 是否有进行中的链。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT id, title, msg_count, created_at, updated_at FROM companion_sessions"
            " WHERE user_id = ? AND character_id = ?"
            " ORDER BY updated_at DESC, created_at DESC LIMIT ?",
            (user_id, character_id, max(1, min(limit, MAX_COMPANION_SESSIONS))),
        ).fetchall()
        chain_sids = {r["session_id"] for r in _conn_checked().execute(
            "SELECT session_id FROM quiz_chains WHERE user_id = ? AND status = 'active' AND session_id != ''",
            (user_id,),
        ).fetchall()}
        out = []
        for r in rows:
            last_row = _conn_checked().execute(
                "SELECT content FROM companion_msgs WHERE session_id = ? ORDER BY id DESC LIMIT 1",
                (r["id"],),
            ).fetchone()
            out.append({
                "id": r["id"], "title": r["title"] or "", "msg_count": int(r["msg_count"] or 0),
                "created_at": int(r["created_at"] or 0), "updated_at": int(r["updated_at"] or 0),
                "last": (last_row["content"] if last_row else "") or "",
                "has_chain": r["id"] in chain_sids,
            })
    return out


def companion_stats(user_id: str, character_id: str) -> dict:
    """与某位伙伴的累计数据（2026-10-11，供伴学成就使用）：只读统计，不写库。
    返回：msgs 累计对话句数 / sessions 会话数 / first_at 第一次聊 / last_at 最近一次 /
          deeds 一起过过的题（讲题链）/ deeds_done 其中讲完的 / partners 聊过的伙伴数。
    """
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT COUNT(*) AS sessions, COALESCE(SUM(msg_count), 0) AS msgs,"
            " COALESCE(MIN(created_at), 0) AS first_at, COALESCE(MAX(updated_at), 0) AS last_at"
            " FROM companion_sessions WHERE user_id = ? AND character_id = ?",
            (user_id, character_id),
        ).fetchone()
        deeds = 0
        deeds_done = 0
        try:
            d1 = conn.execute(
                "SELECT COUNT(*) AS n FROM quiz_chains c JOIN companion_sessions s ON s.id = c.session_id"
                " WHERE c.user_id = ? AND s.character_id = ?", (user_id, character_id)).fetchone()
            deeds = int(d1["n"] or 0) if d1 else 0
            d2 = conn.execute(
                "SELECT COUNT(*) AS n FROM quiz_chains c JOIN companion_sessions s ON s.id = c.session_id"
                " WHERE c.user_id = ? AND s.character_id = ? AND c.status = 'done'",
                (user_id, character_id)).fetchone()
            deeds_done = int(d2["n"] or 0) if d2 else 0
        except Exception:
            deeds = 0
            deeds_done = 0
        p = conn.execute(
            "SELECT COUNT(*) AS n FROM (SELECT character_id FROM companion_sessions"
            " WHERE user_id = ? GROUP BY character_id HAVING COALESCE(SUM(msg_count), 0) > 0)",
            (user_id,),
        ).fetchone()
    intim = get_intimacy(user_id, character_id)
    return {
        "msgs": int(row["msgs"] or 0) if row else 0,
        "sessions": int(row["sessions"] or 0) if row else 0,
        "first_at": int(row["first_at"] or 0) if row else 0,
        "last_at": int(row["last_at"] or 0) if row else 0,
        "deeds": deeds,
        "deeds_done": deeds_done,
        "partners": int(p["n"] or 0) if p else 0,
        "level": int(intim.get("level") or 1),
        "exp": int(intim.get("exp") or 0),
    }


def get_companion_session(user_id: str, session_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT id, title, msg_count, created_at, updated_at FROM companion_sessions"
            " WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        ).fetchone()
    if not row:
        return None
    return {"id": row["id"], "title": row["title"] or "", "msg_count": int(row["msg_count"] or 0),
            "created_at": int(row["created_at"] or 0), "updated_at": int(row["updated_at"] or 0)}


def rename_companion_session(user_id: str, session_id: str, title: str) -> bool:
    with _lock:
        conn = _conn_checked()
        cur = conn.execute(
            "UPDATE companion_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            ((title or "").strip()[:18], _now(), session_id, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def delete_companion_session(user_id: str, session_id: str) -> int:
    """删除会话：消息一并删除、该会话进行中的链作废（done，不沉淀——调用方可先自行结算）。
    返回删除前该会话是否有进行中的链（供前端提示）。"""
    with _lock:
        conn = _conn_checked()
        chain = conn.execute(
            "SELECT id FROM quiz_chains WHERE user_id = ? AND session_id = ? AND status = 'active'",
            (user_id, session_id),
        ).fetchone()
        had_chain = 1 if chain else 0
        conn.execute("DELETE FROM companion_msgs WHERE session_id = ? AND user_id = ?", (session_id, user_id))
        conn.execute(
            "UPDATE quiz_chains SET status = 'done' WHERE user_id = ? AND session_id = ? AND status = 'active'",
            (user_id, session_id),
        )
        conn.execute("DELETE FROM companion_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        conn.commit()
    return had_chain


def auto_title_session(user_id: str, session_id: str, text: str) -> None:
    """会话还没有标题时，用第一条用户消息的前 18 字自动命名（已命名则不动）。"""
    t = (text or "").strip()[:18]
    if not t or not session_id:
        return
    with _lock:
        conn = _conn_checked()
        conn.execute(
            "UPDATE companion_sessions SET title = ? WHERE id = ? AND user_id = ? AND title = ''",
            (t, session_id, user_id),
        )
        conn.commit()


# ---------------- p20 长期印象（跨会话共享的轻量记忆，存 companion_pref.memory） ----------------

def get_companion_memory(user_id: str, character_id: str) -> str:
    with _lock:
        row = _conn_checked().execute(
            "SELECT memory FROM companion_pref WHERE user_id = ? AND character_id = ?",
            (user_id, character_id),
        ).fetchone()
    return (row["memory"] if row and row["memory"] else "") or ""


def append_companion_memory(user_id: str, character_id: str, text: str) -> str:
    """追加一段印象并滚动裁剪到 MEMORY_MAX_CHARS（优先裁掉最旧的整行）。"""
    old = get_companion_memory(user_id, character_id)
    new = (old + "\n" + (text or "").strip()).strip()
    while len(new) > MEMORY_MAX_CHARS and "\n" in new:
        new = new[new.index("\n") + 1:]
    if len(new) > MEMORY_MAX_CHARS:
        new = new[-MEMORY_MAX_CHARS:]
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT name, size_scale FROM companion_pref WHERE user_id = ? AND character_id = ?",
            (user_id, character_id),
        ).fetchone()
        conn.execute(
            "INSERT OR REPLACE INTO companion_pref (user_id, character_id, name, size_scale, memory, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, character_id,
             (row["name"] if row else "") or "", float(row["size_scale"]) if row and row["size_scale"] else 1.0,
             new, _now()),
        )
        conn.commit()
    return new


def get_companion_pref(user_id: str, character_id: str) -> dict:
    with _lock:
        row = _conn_checked().execute(
            "SELECT name, size_scale FROM companion_pref WHERE user_id = ? AND character_id = ?",
            (user_id, character_id),
        ).fetchone()
    if not row:
        return {"name": "", "size_scale": 1.0}
    return {"name": row["name"] or "", "size_scale": float(row["size_scale"] or 1.0)}


def list_companion_prefs(user_id: str) -> list:
    with _lock:
        rows = _conn_checked().execute(
            "SELECT character_id, name, size_scale FROM companion_pref WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return [{"character_id": r["character_id"], "name": r["name"] or "",
             "size_scale": float(r["size_scale"] or 1.0)} for r in rows]


def set_companion_pref(user_id: str, character_id: str,
                       name: str | None = None, size_scale: float | None = None) -> dict:
    """部分更新：name/size_scale 传 None 表示不改。返回更新后的完整偏好。"""
    with _lock:
        conn = _conn_checked()
        row = conn.execute(
            "SELECT name, size_scale FROM companion_pref WHERE user_id = ? AND character_id = ?",
            (user_id, character_id),
        ).fetchone()
        cur_name = row["name"] if row else ""
        cur_size = float(row["size_scale"]) if row and row["size_scale"] else 1.0
        if name is not None:
            cur_name = name.strip()[:12]
        if size_scale is not None:
            cur_size = max(0.6, min(2.0, float(size_scale)))
        conn.execute(
            "INSERT OR REPLACE INTO companion_pref (user_id, character_id, name, size_scale, updated_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (user_id, character_id, cur_name, cur_size, _now()),
        )
        conn.commit()
    return {"character_id": character_id, "name": cur_name, "size_scale": cur_size}


# ---------------------------------------------------------------- quiz_chains（小老师模式问题链）

def save_quiz_chain(user_id: str, chain: dict) -> None:
    """Upsert 一条问题链。chain 需含 id/question_id/steps/progress/streak/wrong_steps/status。
    p20：链绑定会话（session_id），断点续教只在同会话可见。"""
    now = _now()
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO quiz_chains (id, user_id, question_id, steps, progress,"
            " streak, layer_tries, wrong_steps, status, session_id, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
            " COALESCE((SELECT created_at FROM quiz_chains WHERE id = ?), ?), ?)",
            (str(chain["id"]), user_id, str(chain["question_id"]),
             json.dumps(chain.get("steps") or [], ensure_ascii=False),
             int(chain.get("progress") or 0), int(chain.get("streak") or 0),
             int(chain.get("layer_tries") or 0),
             json.dumps(chain.get("wrong_steps") or [], ensure_ascii=False),
             str(chain.get("status") or "active"),
             str(chain.get("session_id") or ""),
             str(chain["id"]), now, now),
        )
        _conn_checked().commit()


def get_quiz_chain(user_id: str, chain_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM quiz_chains WHERE id = ? AND user_id = ?", (chain_id, user_id)
        ).fetchone()
    if not row:
        return None
    return {"id": row["id"], "question_id": row["question_id"],
            "steps": json.loads(row["steps"] or "[]"),
            "progress": int(row["progress"] or 0), "streak": int(row["streak"] or 0),
            "layer_tries": int(row["layer_tries"] or 0) if "layer_tries" in row.keys() else 0,
            "wrong_steps": json.loads(row["wrong_steps"] or "[]"),
            "status": row["status"], "session_id": (row["session_id"] if "session_id" in row.keys() else "") or ""}


def get_active_quiz_chain(user_id: str, session_id: str = "") -> dict | None:
    """取该用户最近一条未完成链（断点续教用），无则 None。
    p20：session_id 非空 = 只找绑定在该会话上的链（记忆/进度隔离）；为空兼容旧调用。"""
    sql = "SELECT * FROM quiz_chains WHERE user_id = ? AND status = 'active'"
    args: list = [user_id]
    if session_id:
        sql += " AND session_id = ?"
        args.append(session_id)
    sql += " ORDER BY updated_at DESC LIMIT 1"
    with _lock:
        row = _conn_checked().execute(sql, args).fetchone()
    if not row:
        return None
    return {"id": row["id"], "question_id": row["question_id"],
            "steps": json.loads(row["steps"] or "[]"),
            "progress": int(row["progress"] or 0), "streak": int(row["streak"] or 0),
            "layer_tries": int(row["layer_tries"] or 0) if "layer_tries" in row.keys() else 0,
            "wrong_steps": json.loads(row["wrong_steps"] or "[]"),
            "status": row["status"], "session_id": (row["session_id"] if "session_id" in row.keys() else "") or ""}


# ---------- AI 教学老师：大纲 + 教学线（2026-10-09） ----------

def _syl_row(row) -> dict:
    keys = row.keys()
    return {
        "id": row["id"], "user_id": row["user_id"],
        "subject": row["subject"] or "", "course_id": row["course_id"] or "",
        "teacher_id": row["teacher_id"] or "", "title": row["title"] or "",
        "items": json.loads(row["items"] or "[]"),
        "chapters": json.loads((row["chapters"] if "chapters" in keys else "") or "[]"),
        "cursor": int(row["cursor"] or 0),
        "kp_done": json.loads((row["kp_done"] if "kp_done" in keys else "") or "[]"),
        "level": row["level"] or "auto",
        "status": row["status"] or "active",
        "version": int((row["version"] if "version" in keys else 1) or 1),
        "archived": int((row["archived"] if "archived" in keys else 0) or 0),
        "unit_tests": json.loads((row["unit_tests"] if "unit_tests" in keys else "") or "{}"),
        "created_at": int(row["created_at"] or 0), "updated_at": int(row["updated_at"] or 0),
    }


def save_syllabus(s: dict) -> None:
    """Upsert 一条教学大纲（items 为小节平铺，chapters 为章分组 [{name,brief,count}]）。"""
    now = _now()
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO teaching_syllabus"
            " (id, user_id, subject, course_id, teacher_id, title, items, chapters, cursor, kp_done,"
            "  level, status, version, archived, unit_tests,"
            "  created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
            "  COALESCE((SELECT created_at FROM teaching_syllabus WHERE id = ?), ?), ?)",
            (str(s["id"]), str(s["user_id"]), str(s.get("subject") or ""),
             str(s.get("course_id") or ""), str(s.get("teacher_id") or ""),
             str(s.get("title") or ""),
             json.dumps(s.get("items") or [], ensure_ascii=False),
             json.dumps(s.get("chapters") or [], ensure_ascii=False),
             int(s.get("cursor") or 0),
             json.dumps(s.get("kp_done") or [], ensure_ascii=False),
             str(s.get("level") or "auto"),
             str(s.get("status") or "active"),
             int(s.get("version") or 1),
             int(s.get("archived") or 0),
             json.dumps(s.get("unit_tests") or {}, ensure_ascii=False),
             str(s["id"]), now, now),
        )
        _conn_checked().commit()


def get_syllabus(user_id: str, syllabus_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM teaching_syllabus WHERE id = ? AND user_id = ?",
            (syllabus_id, user_id)).fetchone()
    return _syl_row(row) if row else None


def list_syllabi(user_id: str) -> list:
    """我的教学线（进行中优先、再按最近更新）。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT * FROM teaching_syllabus WHERE user_id = ?"
            " ORDER BY (status = 'active') DESC, updated_at DESC LIMIT 50", (user_id,)).fetchall()
    return [_syl_row(r) for r in rows]


def update_syllabus(user_id: str, syllabus_id: str, fields: dict) -> dict | None:
    """局部更新（cursor/kp_done/status/items/chapters/teacher_id/level/title/unit_tests）。返回更新后的大纲。"""
    allow = {"cursor", "status", "teacher_id", "level", "title", "subject", "course_id",
             "items", "kp_done", "chapters", "unit_tests", "archived", "version"}
    json_keys = ("items", "kp_done", "chapters", "unit_tests")
    sets, args = [], []
    for k, v in (fields or {}).items():
        if k not in allow:
            continue
        sets.append(k + " = ?")
        args.append(json.dumps(v, ensure_ascii=False) if k in json_keys else v)
    if not sets:
        return get_syllabus(user_id, syllabus_id)
    sets.append("updated_at = ?")
    args.extend([_now(), syllabus_id, user_id])
    with _lock:
        _conn_checked().execute(
            "UPDATE teaching_syllabus SET " + ", ".join(sets) + " WHERE id = ? AND user_id = ?",
            tuple(args))
        _conn_checked().commit()
    return get_syllabus(user_id, syllabus_id)


def delete_syllabus(user_id: str, syllabus_id: str) -> int:
    """删课：连它的教学线一起清。返回删除的行数。"""
    with _lock:
        conn = _conn_checked()
        conn.execute("DELETE FROM teaching_session WHERE user_id = ? AND syllabus_id = ?",
                     (user_id, syllabus_id))
        cur = conn.execute("DELETE FROM teaching_syllabus WHERE id = ? AND user_id = ?",
                           (syllabus_id, user_id))
        conn.commit()
        return int(cur.rowcount or 0)


def _sess_row(row) -> dict:
    return {
        "id": row["id"], "user_id": row["user_id"], "syllabus_id": row["syllabus_id"],
        "teacher_id": row["teacher_id"] or "", "kp_index": int(row["kp_index"] or 0),
        "state": row["state"] or "lecture",
        "kp_payload": json.loads(row["kp_payload"] or "{}"),
        "answer": row["answer"] or "", "grade": json.loads(row["grade"] or "{}"),
        "ask_log": json.loads(row["ask_log"] or "[]"),
        "turns": int(row["turns"] or 0), "minutes": int(row["minutes"] or 0),
        "created_at": int(row["created_at"] or 0), "updated_at": int(row["updated_at"] or 0),
    }


def save_teach_session(s: dict) -> None:
    """Upsert 一条教学线（一个知识点的状态机）。"""
    now = _now()
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO teaching_session"
            " (id, user_id, syllabus_id, teacher_id, kp_index, state, kp_payload, answer, grade,"
            "  ask_log, turns, minutes, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
            "  COALESCE((SELECT created_at FROM teaching_session WHERE id = ?), ?), ?)",
            (str(s["id"]), str(s["user_id"]), str(s["syllabus_id"]),
             str(s.get("teacher_id") or ""), int(s.get("kp_index") or 0),
             str(s.get("state") or "lecture"),
             json.dumps(s.get("kp_payload") or {}, ensure_ascii=False),
             str(s.get("answer") or ""),
             json.dumps(s.get("grade") or {}, ensure_ascii=False),
             json.dumps(s.get("ask_log") or [], ensure_ascii=False),
             int(s.get("turns") or 0), int(s.get("minutes") or 0),
             str(s["id"]), now, now),
        )
        _conn_checked().commit()


def get_teach_session(user_id: str, session_id: str) -> dict | None:
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM teaching_session WHERE id = ? AND user_id = ?",
            (session_id, user_id)).fetchone()
    return _sess_row(row) if row else None


def get_teach_session_by_kp(user_id: str, syllabus_id: str, kp_index: int) -> dict | None:
    """取某条大纲某个知识点已有的教学线（幂等：同一知识点不重复生成讲义）。"""
    with _lock:
        row = _conn_checked().execute(
            "SELECT * FROM teaching_session WHERE user_id = ? AND syllabus_id = ? AND kp_index = ?"
            " ORDER BY updated_at DESC LIMIT 1", (user_id, syllabus_id, int(kp_index))).fetchone()
    return _sess_row(row) if row else None


def clear_teach_sessions(user_id: str, syllabus_id: str) -> int:
    """清掉一条大纲下所有教学线（重置进度 / 删知识点后索引会错位时用）。"""
    with _lock:
        cur = _conn_checked().execute(
            "DELETE FROM teaching_session WHERE user_id = ? AND syllabus_id = ?",
            (user_id, syllabus_id))
        _conn_checked().commit()
        return int(cur.rowcount or 0)


def list_teach_kp_indexes(user_id: str, syllabus_id: str) -> list:
    """一条大纲下已生成过讲义的知识点索引（去重升序）——目录里标"学过"用。"""
    with _lock:
        rows = _conn_checked().execute(
            "SELECT DISTINCT kp_index FROM teaching_session"
            " WHERE user_id = ? AND syllabus_id = ?", (user_id, syllabus_id)).fetchall()
    return sorted(int(r["kp_index"] or 0) for r in rows)


# ---------- M4: 亲密度 + 讲题战报存档 ----------

INTIMACY_PER_LEVEL = 50
INTIMACY_MAX_LEVEL = 7


def get_intimacy(user_id: str, character_id: str) -> dict:
    with _lock:
        row = _conn_checked().execute(
            'SELECT exp FROM companion_intimacy WHERE user_id = ? AND character_id = ?',
            (user_id, character_id),
        ).fetchone()
    exp = int(row['exp'] or 0) if row else 0
    level = min(INTIMACY_MAX_LEVEL, 1 + exp // INTIMACY_PER_LEVEL)
    in_level = 0 if level >= INTIMACY_MAX_LEVEL else exp % INTIMACY_PER_LEVEL
    return {'exp': exp, 'level': level, 'exp_in_level': in_level,
            'per_level': INTIMACY_PER_LEVEL, 'max_level': INTIMACY_MAX_LEVEL}


def add_intimacy(user_id: str, character_id: str, delta: int) -> dict:
    # 加经验（只增不减）；返回最新亲密度快照
    if delta <= 0:
        return get_intimacy(user_id, character_id)
    now = int(time.time() * 1000)
    with _lock:
        _conn_checked().execute(
            'INSERT INTO companion_intimacy (user_id, character_id, exp, updated_at) VALUES (?, ?, ?, ?) '
            'ON CONFLICT (user_id, character_id) DO UPDATE SET exp = exp + excluded.exp, updated_at = excluded.updated_at',
            (user_id, character_id, int(delta), now))
        _conn_checked().commit()
    return get_intimacy(user_id, character_id)


def save_study_session(doc: dict) -> None:
    with _lock:
        _conn_checked().execute(
            'INSERT OR REPLACE INTO study_session '
            '(id, uid, character_id, question_id, layers, good_layers, wrong_layers, scores, avg, steps, passed, created_at) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (str(doc.get('id') or ''), str(doc.get('uid') or ''), str(doc.get('character_id') or ''),
             str(doc.get('question_id') or ''), int(doc.get('layers') or 0), int(doc.get('good_layers') or 0),
             json.dumps(doc.get('wrong_layers') or [], ensure_ascii=False),
             json.dumps(doc.get('scores') or [], ensure_ascii=False),
             json.dumps(doc.get('avg') or {}, ensure_ascii=False),
             json.dumps(doc.get('steps') or [], ensure_ascii=False),
             1 if doc.get('passed') else 0, int(doc.get('created_at') or 0)))
        _conn_checked().commit()


def list_study_sessions(user_id: str, limit: int = 50) -> list:
    with _lock:
        rows = _conn_checked().execute(
            'SELECT id, character_id, question_id, layers, good_layers, wrong_layers, scores, avg, passed, created_at '
            'FROM study_session WHERE uid = ? ORDER BY created_at DESC LIMIT ?',
            (user_id, int(limit)),
        ).fetchall()
    out = []
    for r in rows:
        try:
            wrong = json.loads(r['wrong_layers'] or '[]')
            scores = json.loads(r['scores'] or '[]')
            avg = json.loads(r['avg'] or '{}')
        except Exception:
            wrong, scores, avg = [], [], {}
        out.append({'id': r['id'], 'character_id': r['character_id'], 'question_id': r['question_id'],
                    'layers': r['layers'], 'good_layers': r['good_layers'], 'wrong_layers': wrong,
                    'scores': scores, 'avg': avg, 'passed': bool(r['passed']), 'created_at': r['created_at']})
    return out


# ---------- 造角色二期: 用户自定义伴学角色 ----------

_custom_ensured = False


def _ensure_custom() -> None:
    """懒建表（避免动 init_db 主块）：custom_companion 单表。"""
    global _custom_ensured
    if _custom_ensured:
        return
    with _lock:
        _conn_checked().execute(
            """
            CREATE TABLE IF NOT EXISTS custom_companion (
                char_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                persona TEXT NOT NULL DEFAULT '',
                ratio REAL NOT NULL DEFAULT 0.5,
                image BLOB,
                image_mime TEXT DEFAULT 'image/png',
                lines TEXT DEFAULT '',
                created_at INTEGER DEFAULT 0
            )
            """
        )
        _conn_checked().execute(
            "CREATE INDEX IF NOT EXISTS idx_custom_user ON custom_companion (user_id)")
        _conn_checked().commit()
    _custom_ensured = True


def save_custom_companion(doc: dict) -> None:
    """新建/覆盖一个自定义角色。doc: char_id/user_id/name/persona/ratio/image(bytes)/image_mime/lines(dict)/created_at"""
    _ensure_custom()
    with _lock:
        _conn_checked().execute(
            "INSERT OR REPLACE INTO custom_companion "
            "(char_id, user_id, name, persona, ratio, image, image_mime, lines, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (str(doc["char_id"]), str(doc["user_id"]), str(doc.get("name") or "")[:12],
             str(doc.get("persona") or "")[:800], float(doc.get("ratio") or 0.5),
             doc.get("image") or b"", str(doc.get("image_mime") or "image/png"),
             json.dumps(doc.get("lines") or {}, ensure_ascii=False),
             int(doc.get("created_at") or 0)))
        _conn_checked().commit()


def list_custom_companions(user_id: str) -> list:
    """该用户全部自定义角色（不含 BLOB 图片，含台词 JSON）。"""
    _ensure_custom()
    with _lock:
        rows = _conn_checked().execute(
            "SELECT char_id, name, persona, ratio, lines, created_at FROM custom_companion "
            "WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    out = []
    for r in rows:
        try:
            lines = json.loads(r["lines"] or "{}")
        except Exception:
            lines = {}
        out.append({"id": r["char_id"], "name": r["name"], "persona": r["persona"],
                    "ratio": float(r["ratio"] or 0.5), "lines": lines, "created_at": r["created_at"]})
    return out


def get_custom_companion(char_id: str, user_id: str = "") -> dict | None:
    """按 char_id 取角色（user_id 传空则只按 id 查，仅供图片下发用）。"""
    _ensure_custom()
    with _lock:
        if user_id:
            row = _conn_checked().execute(
                "SELECT char_id, user_id, name, persona, ratio, lines, created_at FROM custom_companion "
                "WHERE char_id = ? AND user_id = ?", (char_id, user_id)).fetchone()
        else:
            row = _conn_checked().execute(
                "SELECT char_id, user_id, name, persona, ratio, lines, created_at FROM custom_companion "
                "WHERE char_id = ?", (char_id,)).fetchone()
    if not row:
        return None
    try:
        lines = json.loads(row["lines"] or "{}")
    except Exception:
        lines = {}
    return {"id": row["char_id"], "user_id": row["user_id"], "name": row["name"],
            "persona": row["persona"], "ratio": float(row["ratio"] or 0.5),
            "lines": lines, "created_at": row["created_at"]}


def get_custom_companion_image(char_id: str) -> tuple | None:
    """取立绘 BLOB，返回 (bytes, mime)；无则 None。"""
    _ensure_custom()
    with _lock:
        row = _conn_checked().execute(
            "SELECT image, image_mime FROM custom_companion WHERE char_id = ?", (char_id,)).fetchone()
    if not row or not row["image"]:
        return None
    return (row["image"], row["image_mime"] or "image/png")


def count_custom_companions(user_id: str) -> int:
    _ensure_custom()
    with _lock:
        row = _conn_checked().execute(
            "SELECT COUNT(*) AS n FROM custom_companion WHERE user_id = ?", (user_id,)).fetchone()
    return int(row["n"] or 0) if row else 0


def delete_custom_companion(char_id: str, user_id: str) -> bool:
    """仅限本人删除。返回是否真的删了。"""
    _ensure_custom()
    with _lock:
        cur = _conn_checked().execute(
            "DELETE FROM custom_companion WHERE char_id = ? AND user_id = ?", (char_id, user_id))
        _conn_checked().commit()
    return cur.rowcount > 0


def purge_custom_companion(char_id: str, user_id: str) -> None:
    """彻底删除自定义角色（2026-10-09）：角色行 + 聊天记录 + 名字/记忆偏好 + 亲密度 + 会话 + 讲解链。
    此前只删 custom_companion 行，聊天/偏好/亲密度残留成死数据（用户拍板：删除=全清）。"""
    _ensure_custom()
    with _lock:
        c = _conn_checked()
        c.execute("DELETE FROM custom_companion WHERE char_id = ? AND user_id = ?", (char_id, user_id))
        c.execute("DELETE FROM companion_msgs WHERE user_id = ? AND character_id = ?", (user_id, char_id))
        c.execute("DELETE FROM companion_pref WHERE user_id = ? AND character_id = ?", (user_id, char_id))
        c.execute("DELETE FROM companion_intimacy WHERE user_id = ? AND character_id = ?", (user_id, char_id))
        c.execute("DELETE FROM companion_sessions WHERE user_id = ? AND character_id = ?", (user_id, char_id))
        # study_session 的用户字段名是 uid（不是 user_id），讲解链也按角色锚定，一并清
        c.execute("DELETE FROM study_session WHERE uid = ? AND character_id = ?", (user_id, char_id))
        c.commit()
