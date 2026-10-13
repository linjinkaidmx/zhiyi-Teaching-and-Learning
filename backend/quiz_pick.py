"""AI 伴学「出题精准匹配」引擎（2026-10-08）

取代原先 `ORDER BY RANDOM()` 的裸抽题：先算用户知识点画像，再按画像加权选题。

设计要点
--------
1. 画像权重来自四路：错题本学情 > 伴学链讲崩/讲通事件 > 我的课程 > 考试倒计时。
   错题部分实时算（307 题规模，无性能压力），伴学增量落 `user_kp_state` 跨会话累积。
2. 空库（画像为空）时只在「高数 / 概率统计 / 计算机算法 / 大物」四个方向出题，
   并按方向轮换，保证每个方向都覆盖到，不连续两轮同方向。
3. 有错题时按知识点权重加权随机（薄弱点更容易被抽到），并对最近出过的题做去重。

纯逻辑 + 薄 DB 调用，不调模型；所有随机都走 random 模块，测试可 seed。
"""
import json
import random
import re
import time as _t

import db
import textmath

DAY_MS = 86400 * 1000

# ------------------------------------------------------------------ 学科归一

_SUBJECT_RULES = [
    ("高等数学", "高数"), ("数学分析", "高数"), ("微积分", "高数"),
    ("线性代数", "线代"), ("大学物理", "大物"), ("概率论", "概率统计"),
    ("数据结构", "数据结构"), ("算法", "数据结构"), ("计算机网络", "计网"),
    ("组成原理", "计组"), ("操作系统", "操作系统"), ("C语言", "C语言"),
    ("Python", "Python"), ("信号与系统", "信号与系统"), ("复变", "复变函数"),
    ("数字电路", "数电"), ("电路分析", "电路"), ("离散数学", "离散数学"),
    ("数学物理方程", "数理方程"), ("化学", "化学"), ("理论力学", "理论力学"),
    ("自动控制", "自控"), ("计算机", "计算机"),
]


def subject_short(subject) -> str:
    """科目简称：题库科目写法多样（如「高等数学（微积分）」），按包含关系匹配。"""
    s = str(subject or "").strip()
    if not s:
        return ""
    for p, short in _SUBJECT_RULES:
        if p in s:
            return short
    return s[:6]


# 空库兜底：只在这四个方向出题（用户 2026-10-08 定稿）
DIRECTIONS = {
    "高数": {"高数"},
    "概率统计": {"概率统计"},
    "计算机算法": {"数据结构", "C语言", "Python", "计网", "计组", "操作系统", "计算机"},
    "大物": {"大物", "理论力学"},
}
DIRECTION_ORDER = ["高数", "概率统计", "计算机算法", "大物"]

# 方向 → 题库 subject 的 SQL 匹配关键词（LIKE，用于定向兜底抽题）
DIRECTION_KEYWORDS = {
    "高数": ["高等数学", "数学分析", "微积分"],
    "概率统计": ["概率", "统计"],
    "计算机算法": ["数据结构", "算法", "C语言", "Python", "计算机"],
    "大物": ["大学物理", "理论力学"],
}


def subject_direction(subject) -> str:
    """学科 → 四方向之一；不属于任何方向返回 ''。"""
    s = subject_short(subject)
    if not s:
        return ""
    for d, shorts in DIRECTIONS.items():
        if s in shorts:
            return d
    return ""


def course_direction(course_name: str) -> str:
    """课程名 → 方向（课程名是用户自由输入，走同样的关键词归一）。"""
    return subject_direction(course_name)


# ------------------------------------------------------------------ 文本归一（去重/排重比对用）

_PUNCT = re.compile(r"[\s，,。．\.、；;：:？?！!（）()\[\]【】\$'\"“”‘’`\-_/\\]+")


def norm_q(text: str) -> str:
    """题干归一：去空白与标点，供「同题排除」比对（不做语义匹配）。"""
    return _PUNCT.sub("", str(text or "")).lower()


# ------------------------------------------------------------------ 画像

def _err_items(user_id: str) -> list:
    """错题本可用题源：跳过笔记、半截序号题；出口统一清洗 LaTeX。"""
    pool = []
    for it in db.load_errorbook(user_id):
        if not isinstance(it, dict) or it.get("kind") == "note":
            continue
        q = str(it.get("question") or "").strip()
        if not q or db.strip_leading_no(q) != q:
            continue
        pool.append(textmath.plain_obj(it))
    return pool


def _exam_boost(exams: list, courses: list, now_ms: int) -> dict:
    """考试倒计时 → 学科加权。返回 {科目简称: 权重增量}。

    ≤7 天 +5 / ≤30 天 +3 / ≤60 天 +1；考试名或关联课程名都要归一到方向。
    """
    boost = {}
    if not exams:
        return boost
    course_name = {}
    for c in (courses or []):
        if isinstance(c, dict) and c.get("id") is not None:
            course_name[str(c.get("id"))] = str(c.get("name") or "")
    today = _t.strftime("%Y-%m-%d", _t.localtime(now_ms / 1000))
    for e in exams:
        if not isinstance(e, dict):
            continue
        date = str(e.get("date") or "")
        if not date or date < today:
            continue          # 已考过 / 无日期：不加权
        try:
            days = (int(_t.mktime(_t.strptime(date, "%Y-%m-%d")) * 1000) - now_ms) // DAY_MS
        except Exception:
            continue
        if days < 0:
            continue
        w = 5 if days <= 7 else (3 if days <= 30 else (1 if days <= 60 else 0))
        if not w:
            continue
        for name in (str(e.get("name") or ""), course_name.get(str(e.get("courseId") or ""), "")):
            d = course_direction(name)
            if not d:
                continue
            for short in DIRECTIONS[d]:
                boost[short] = boost.get(short, 0) + w
            break
    return boost


def build_profile(user_id: str, items: list = None, now_ms: int = 0) -> dict:
    """用户知识点画像。

    返回 {"kps": [{"kp","subject","dir","w"}...] 降序, "dirs": {方向: 权重},
          "weak": [top5 知识点], "empty": bool}
    """
    now_ms = int(now_ms or _t.time() * 1000)
    items = _err_items(user_id) if items is None else items
    kp_w, dir_w = {}, {}

    def add(kp, subject, w):
        if not kp or w <= 0:
            return
        k = str(kp).strip()
        if not k:
            return
        e = kp_w.setdefault(k, {"kp": k, "subject": str(subject or ""), "w": 0})
        e["w"] += w
        if not e["subject"] and subject:
            e["subject"] = str(subject)

    def add_dir(subject, w):
        d = subject_direction(subject)
        if d and w > 0:
            dir_w[d] = dir_w.get(d, 0) + w

    # ① 错题本学情
    for it in items:
        if not isinstance(it, dict):
            continue
        subj = str(it.get("subject") or "")
        mastered = bool(it.get("mastered"))
        due = bool(it.get("reviewAt")) and float(it.get("reviewAt") or 0) <= now_ms
        if due:
            base = 5
        elif mastered:
            base = 1
        else:
            base = 4
        try:
            miss = max(0, int(it.get("quizCount") or 0) - int(it.get("correctCount") or 0))
        except Exception:
            miss = 0
        base += min(miss, 3)
        kps = [k for k in (it.get("knowledgePoints") or []) if str(k).strip()]
        if not kps:
            # 没标知识点的题：把权重记在科目上，供方向级匹配使用
            add_dir(subj, base)
            continue
        for k in kps[:5]:
            add(k, subj, base)
            add_dir(subj, base)

    # ② 伴学链事件（跨会话累积）
    st = {}
    try:
        st = db.kp_state_load(user_id) or {}
    except Exception:
        st = {}
    for k, ev in (st.get("events") or {}).items():
        if not isinstance(ev, dict):
            continue
        w = 2 * int(ev.get("bad") or 0) - int(ev.get("good") or 0)
        if w > 0:
            subj = str(ev.get("subject") or "")
            add(k, subj, w)
            add_dir(subj, w)

    # ③ 我的课程
    courses = []
    try:
        blob = db.load_courses(user_id) or {}
        courses = [c for c in (blob.get("courses") or []) if isinstance(c, dict)]
    except Exception:
        courses = []
    for c in courses:
        d = course_direction(str(c.get("name") or ""))
        if not d:
            continue
        dir_w[d] = dir_w.get(d, 0) + 2   # 在学的课：该方向整体加权（无具体知识点时用得上）

    # ④ 考试倒计时
    exams = []
    try:
        blob = db.load_courses(user_id) or {}
        exams = [e for e in (blob.get("exams") or []) if isinstance(e, dict)]
    except Exception:
        exams = []
    boost = _exam_boost(exams, courses, now_ms)
    for short, w in boost.items():
        d = subject_direction(short)
        if d:
            dir_w[d] = dir_w.get(d, 0) + w

    kps = sorted([v for v in kp_w.values() if not str(v["kp"]).startswith("@")],
                 key=lambda x: -x["w"])
    for v in kps:
        v["dir"] = subject_direction(v.get("subject"))
    return {
        "kps": kps,
        "dirs": dir_w,
        "weak": [v["kp"] for v in kps[:5]],
        "empty": (not kps) and (not dir_w),
        "boost": boost,
    }


def profile_weight(profile: dict, it: dict) -> float:
    """某道题的画像权重：自身知识点权重之和 + 方向权重（决定加权随机）。"""
    kp_w = {v["kp"]: v["w"] for v in (profile.get("kps") or [])}
    w = 0.0
    for k in (it.get("knowledgePoints") or []):
        w += float(kp_w.get(str(k).strip(), 0))
    d = subject_direction(it.get("subject"))
    if d:
        w += 0.5 * float((profile.get("dirs") or {}).get(d, 0))
    return max(w, 0.5)      # 兜底 0.5：画像外的题仍有机会，但远低于薄弱点


def _weighted_choice(pool: list, profile: dict):
    """按画像权重加权随机取一道题。"""
    if not pool:
        return None
    if len(pool) == 1:
        return pool[0]
    weights = [profile_weight(profile, it) for it in pool]
    total = float(sum(weights))
    if total <= 0:
        return random.choice(pool)
    r = random.random() * total
    acc = 0.0
    for it, w in zip(pool, weights):
        acc += w
        if r <= acc:
            return it
    return pool[-1]


# ------------------------------------------------------------------ 定向兜底（空库轮换）

def _rotate_direction(user_id: str, dirs: list, profile: dict) -> str:
    """四方向轮换：不连续两轮同方向；考试临考前强制该方向。

    dirs 传入可用方向（有题的方向）；返回选中的方向 key。
    每次取方向都推进游标（含冒泡预览——预览不推进的话会永远停在第一方向）。
    """
    if not dirs:
        return ""
    ordered = [d for d in DIRECTION_ORDER if d in dirs]
    if not ordered:
        return dirs[0]
    # 考试优先：7 天内有考试的课程方向直接命中（不推进轮换游标）
    urgent = [d for d, w in sorted((profile.get("dirs") or {}).items(), key=lambda x: -x[1])
              if w >= 5 and d in ordered]
    if urgent:
        return urgent[0]
    turn = 0
    try:
        st = db.kp_state_load(user_id) or {}
        turn = int(st.get("turn") or 0)
    except Exception:
        st = {}
    d = ordered[turn % len(ordered)]
    try:
        st["turn"] = turn + 1
        db.kp_state_save(user_id, st)
    except Exception:
        pass
    return d


def _bank_rows_by_direction(direction: str, limit: int = 20) -> list:
    """取某方向的题库行（SQL 直接按科目关键词过滤，带解析优先）。"""
    kws = DIRECTION_KEYWORDS.get(direction) or []
    if not kws:
        return []
    return db.bank_by_keywords(kws, limit=limit)


# ------------------------------------------------------------------ 主入口

def _recent_ids(user_id: str, n: int = 8, kind: str = "recent") -> list:
    """近期出过的题 id。kind='recent'（真讲过的）/ 'peek_recent'（只预览过的）。"""
    try:
        st = db.kp_state_load(user_id) or {}
    except Exception:
        return []
    return [str(x) for x in (st.get(kind) or [])][:n]


def _push_recent(user_id: str, question_id: str, kind: str = "recent", keep: int = 8) -> None:
    if not question_id:
        return
    try:
        st = db.kp_state_load(user_id) or {}
        recent = [str(x) for x in (st.get(kind) or [])]
        recent = [x for x in recent if x != str(question_id)]
        recent.insert(0, str(question_id))
        st[kind] = recent[:keep]
        db.kp_state_save(user_id, st)
    except Exception:
        pass


def bank_quiz_item(row: dict) -> dict:
    """题库行 → 错题条目形状（id 加 bank- 前缀，供链式教学/判分复取）。"""
    res = row.get("result") or {}
    if not isinstance(res, dict):
        try:
            res = json.loads(res)
        except Exception:
            res = {}
    steps = []
    for s in (res.get("steps") or []):
        if isinstance(s, dict):
            txt = (str(s.get("title") or "") + "：" + str(s.get("detail") or "")).strip("：")
        else:
            txt = str(s)
        if txt.strip():
            steps.append(txt.strip())
    steps = steps[:4]
    return {
        "id": "bank-%s" % row.get("id"),
        "kind": "bank",
        "question": textmath.plain_math(str(row.get("question") or "").strip()),
        "subject": str(row.get("subject") or "未分类"),
        "answer": textmath.plain_math(str(res.get("answer") or row.get("answer") or "")),
        "steps": [textmath.plain_math(x) for x in steps],
        "keyBreakthrough": textmath.plain_math(
            (str(res.get("key_breakthrough") or "") or (steps[0] if steps else ""))[:200]),
        "knowledgePoints": [str(k) for k in (row.get("knowledge_points") or [])][:8],
        "mastered": False,
    }


def _same_kp_candidates(profile: dict, exclude_norm: set, limit: int = 8) -> list:
    """薄弱知识点的同类题库题（用户错题本里没有的）。"""
    kps = [v["kp"] for v in (profile.get("kps") or [])][:3]
    if not kps:
        return []
    rows = db.bank_by_knowledge(kps, limit=limit * 3)
    out = []
    for r in rows:
        n = norm_q(r.get("question") or "")
        if not n or n in exclude_norm:
            continue
        if any(n in x or x in n for x in exclude_norm if len(x) >= 10 and len(n) >= 10):
            continue
        out.append(r)
    return out[:limit]


def pick(user_id: str, question_id: str = "", items: list = None,
         now_ms: int = 0, read_only: bool = False):
    """精准选题入口。read_only=True = 冒泡预览模式：方向轮换照常推进，
    但去重只进 peek_recent（3 条），不污染「真讲过的题」队列。"""
    it, src = _pick_inner(user_id, question_id, items, now_ms, read_only)
    if it and it.get("id"):
        if read_only:
            _push_recent(user_id, str(it.get("id")), kind="peek_recent", keep=3)
        else:
            _push_recent(user_id, str(it.get("id")), kind="recent", keep=8)
    return it, src


def _pick_inner(user_id: str, question_id: str = "", items: list = None,
                now_ms: int = 0, read_only: bool = False):
    """精准选题。返回 (item|None, source_label)。

    优先级：指定 id > SRS 到期错题 > 未掌握错题（加权）> 薄弱知识点同类补题
    > 已掌握随机回顾 > 四方向轮换兜底。
    """
    now_ms = int(now_ms or _t.time() * 1000)
    # ① 指定题库题（链续教/判分复取）
    if question_id and str(question_id).startswith("bank-"):
        row = db.get_bank_by_id(str(question_id)[5:])
        if row and str(row.get("question") or "").strip():
            return bank_quiz_item(row), "题库"
    pool = _err_items(user_id) if items is None else [
        it for it in (items or [])
        if isinstance(it, dict) and it.get("kind") != "note"
        and str(it.get("question") or "").strip()
        and db.strip_leading_no(str(it.get("question") or "").strip()) == str(it.get("question") or "").strip()
    ]
    profile = build_profile(user_id, items=pool, now_ms=now_ms)

    # ②/③ 错题本：先按 id 点名，再 SRS 到期，再未掌握（加权）
    if question_id:
        for it in pool:
            if str(it.get("id")) == str(question_id):
                return it, "你点名的题"
    recent = _recent_ids(user_id, 2, kind="peek_recent" if read_only else "recent")
    if read_only:
        recent = recent + _recent_ids(user_id, 2)   # 预览也避开最近真讲过的题
    last = recent[0] if recent else ""
    fresh = [it for it in pool if str(it.get("id")) not in recent]
    if not fresh and last:
        # 候选都被近期去重排掉了：至少保证不连着出上一道（题少时退化为交替）
        fresh = [it for it in pool if str(it.get("id")) != last]
    if not fresh:
        fresh = pool
    due = [it for it in fresh if it.get("reviewAt") and float(it["reviewAt"]) <= now_ms]
    if due:
        return _weighted_choice(due, profile), "SRS 到期"
    weak = [it for it in fresh if not it.get("mastered")]
    if weak:
        return _weighted_choice(weak, profile), "错题本"

    # ④ 薄弱知识点同类补题（错题本里没有的同知识点题）
    exclude = {norm_q(it.get("question") or "") for it in pool}
    cands = _same_kp_candidates(profile, exclude)
    if cands:
        return bank_quiz_item(random.choice(cands)), "题库·同类"

    # ⑤ 已掌握随机回顾
    if pool:
        return random.choice(pool), "随机回顾"

    # ⑥ 空库兜底：四方向轮换
    avail = []
    for d in DIRECTION_ORDER:
        if _bank_rows_by_direction(d, limit=10):
            avail.append(d)
    d = _rotate_direction(user_id, avail, profile)
    rows = _bank_rows_by_direction(d, limit=20) if d else []
    if rows:
        return bank_quiz_item(random.choice(rows)), "题库·" + (d or "推荐")
    rows = db.random_bank_items(6)
    if rows:
        return bank_quiz_item(random.choice(rows)), "题库"
    return None, ""


def profile_hint(user_id: str, kps: list) -> str:
    """画像里有「讲崩过」的知识点 → 一句角色口吻的上下文前缀；否则返回空串。

    让伴学与错题数据的联动在对话里看得见（2026-10-08）。
    """
    try:
        st = db.kp_state_load(user_id) or {}
    except Exception:
        return ""
    ev = st.get("events") or {}
    for k in [str(x).strip() for x in (kps or []) if str(x).strip()]:
        e = ev.get(k)
        if not isinstance(e, dict):
            continue
        bad = int(e.get("bad") or 0)
        if bad >= 1:
            return "我翻了翻小本本，你在「%s」这儿卡过%s，" % (k, "好几次" if bad >= 2 else "一次")
    return ""


def record_event(user_id: str, kps: list, kind: str, subject: str = "") -> None:
    """伴学交互 → 画像事件。kind: 'good'（讲通）| 'bad'（讲崩）。"""
    if not kps or kind not in ("good", "bad"):
        return
    try:
        st = db.kp_state_load(user_id) or {}
        ev = st.get("events") or {}
        for k in [str(x).strip() for x in kps if str(x).strip()][:6]:
            e = ev.setdefault(k, {"good": 0, "bad": 0})
            e[kind] = int(e.get(kind) or 0) + 1
            if subject:
                e["subject"] = str(subject)[:40]
        st["events"] = ev
        db.kp_state_save(user_id, st)
    except Exception:
        pass
