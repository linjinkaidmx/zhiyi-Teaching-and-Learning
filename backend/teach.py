"""AI 教学老师 · 状态机与输出钳位（2026-10-09，纯逻辑，不调模型）

职责边界
--------
- 确认语识别：「会了，下一个知识点」是推进的唯一语义入口（前端也用同一套规则，见 lib/teachFlow.js）
- 状态迁移校验：lecture → exam → graded →（next）lecture；模型无权跳点
- 讲义规范化与**钳位**：模型一次吐多个知识点时只保留第一个（规则①②靠代码保证，不靠提示词祈祷）
- 题型兜底：选择题选项/答案索引不合法时降级为文字题（宁可让学生写字，也不误判）
- 错题条目构造：字段对齐 book.js makeItem，让错题本 UI 零改动

本模块不 import service / main，方便离线断言。
"""
import re

# ------------------------------------------------------------------ 两位老师

TEACHERS = {
    "chenli": {
        "id": "chenli", "name": "陈砺", "gender": "male", "title": "陈老师",
        "style": (
            "沉稳、板书式的大学讲师。讲清逻辑链，先给结论再给推导，语言简洁、少废话。"
            "不喷人、不轻浮、不替学生做题；学生答错时先指出错在哪一步，再给反例。"
        ),
    },
    "shentong": {
        "id": "shentong", "name": "沈疏桐", "gender": "female", "title": "沈老师",
        "style": (
            "细致温和的大学讲师。习惯把一个知识点拆成小步、多举一个贴近生活的例子，"
            "讲完常确认一句「跟上了吗」。不喷人、不轻浮、不替学生做题；"
            "学生答错时先肯定做对的部分，再耐心指出错在哪一步，并给反例。"
        ),
    },
}
DEFAULT_TEACHER = "chenli"


def teacher_of(teacher_id: str) -> dict:
    return TEACHERS.get(str(teacher_id or "").strip()) or TEACHERS[DEFAULT_TEACHER]


# ------------------------------------------------------------------ 确认语

NEG_WORDS = ("不会", "没会", "不懂", "没懂", "不明白", "没明白", "不清楚", "不确定", "没把握",
             "等一下", "等等", "先别", "还没", "还不", "重讲", "再讲一遍", "没跟上")
CONFIRM_WORDS = ("会了", "下一个", "下一题", "下一讲", "next", "懂了",
                 "学会了", "明白了", "可以了", "往下")


def norm_text(text: str) -> str:
    """归一化：去空白与常见标点、转小写（用于确认语与同题比对）。"""
    t = re.sub(r"[\s，,。．\.、；;：:！!？?~～\"'“”‘’`（）()\[\]【】]+", "", str(text or ""))
    return t.lower()


def is_confirm(text: str) -> bool:
    """是否表示「我掌握了，讲下一个」（否定的表达一律不算）。"""
    t = norm_text(text)
    if not t or len(t) > 24:          # 长句多半是在提问，不是确认
        return False
    if any(w in t for w in NEG_WORDS):
        return False
    return any(w in t for w in CONFIRM_WORDS)


# ------------------------------------------------------------------ 状态机

STATES = ("lecture", "exam", "graded", "done")
# 事件 → {当前态: 目标态}
TRANSITIONS = {
    "start": {"lecture": "exam"},
    "answer": {"exam": "graded"},
    "ask": {"lecture": "lecture", "exam": "exam", "graded": "exam"},   # 解答后回到考试题
    # 推进的闸门是「用户确认掌握」，不是「必须先答题」：答完可推进，答前明确说会了也可推进
    "next": {"exam": "lecture", "graded": "lecture"},
    "finish": {"graded": "done"},
}


class TeachFlowError(Exception):
    """状态迁移非法（前端乱点/重复提交）。"""


def next_state(state: str, event: str) -> str:
    m = TRANSITIONS.get(event) or {}
    tgt = m.get(str(state or ""))
    if not tgt:
        raise TeachFlowError("当前状态（%s）不能执行「%s」" % (state, event))
    return tgt


def can(state: str, event: str) -> bool:
    return str(state or "") in ((TRANSITIONS.get(event) or {}))


# ------------------------------------------------------------------ 讲义规范化

_LIMITS = {"pitfalls": 4, "symbols": 5, "confused_with": 3, "steps": 8, "points": 5}


def _s(v, n: int = 400) -> str:
    return str(v if v is not None else "").strip()[:n]


def _as_list(v) -> list:
    if isinstance(v, list):
        return v
    if v in (None, "", {}):
        return []
    return [v]


def _first_kp(obj: dict) -> dict:
    """钳位：只取第一个知识点（模型偶尔会一次给多个）。"""
    for key in ("kp", "knowledge_point", "point"):
        if isinstance(obj.get(key), dict):
            return obj[key]
    for key in ("kps", "knowledge_points", "points", "items"):
        arr = _as_list(obj.get(key))
        for x in arr:
            if isinstance(x, dict):
                return x
        if arr and isinstance(arr[0], str):
            return {"name": arr[0]}
    if _s(obj.get("kp_name")) or _s(obj.get("name")):
        return {"name": _s(obj.get("kp_name")) or _s(obj.get("name"))}
    return {}


def normalize_kp(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    pitfalls = [_s(x, 220) for x in _as_list(raw.get("pitfalls") or raw.get("pitfall") or raw.get("易错"))]
    symbols = []
    for x in _as_list(raw.get("symbols") or raw.get("符号")):
        if isinstance(x, dict):
            sym, mean = _s(x.get("sym") or x.get("symbol"), 40), _s(x.get("meaning") or x.get("desc"), 200)
            if sym or mean:
                symbols.append({"sym": sym, "meaning": mean})
        elif _s(x):
            symbols.append({"sym": "", "meaning": _s(x, 200)})
    conf = []
    for x in _as_list(raw.get("confused_with") or raw.get("易混")):
        if isinstance(x, dict):
            a, b, d = _s(x.get("a"), 60), _s(x.get("b"), 60), _s(x.get("diff") or x.get("difference"), 300)
            if a or b:
                conf.append({"a": a, "b": b, "diff": d})
    return {
        "name": _s(raw.get("name") or raw.get("title"), 60) or "本知识点",
        "definition": _s(raw.get("definition") or raw.get("content") or raw.get("定义"), 1200),
        "principle": _s(raw.get("principle") or raw.get("原理"), 1200),
        "pitfalls": [p for p in pitfalls if p][:_LIMITS["pitfalls"]],
        "symbols": symbols[:_LIMITS["symbols"]],
        "confused_with": conf[:_LIMITS["confused_with"]],
    }


def normalize_example(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    steps = []
    for x in _as_list(raw.get("steps") or raw.get("步骤")):
        if isinstance(x, dict):
            title, detail = _s(x.get("title"), 80), _s(x.get("detail"), 600)
            basis = _s(x.get("basis") or x.get("依据"), 120)          # 规则④：每步标依据
            if detail or basis:
                steps.append({"title": title, "detail": detail, "basis": basis})
        elif _s(x):
            steps.append({"title": "", "detail": _s(x, 600), "basis": ""})
    return {
        "question": _s(raw.get("question") or raw.get("题目"), 800),
        "steps": steps[:_LIMITS["steps"]],
        "answer": _s(raw.get("answer") or raw.get("答案"), 600),
        # 例题应用分析（2026-10-10）：这题考的什么、为什么这么想、易错点在哪——随题生成零追加成本
        "analysis": _s(raw.get("analysis") or raw.get("分析"), 600),
    }


def normalize_exam(raw) -> dict:
    """考试题规范化 + 题型兜底。

    选择题：选项 ≥2 且答案索引可定位，否则**降级为文字题**（宁可让学生写字，也不误判）。
    """
    raw = raw if isinstance(raw, dict) else {}
    options = []
    for i, x in enumerate(_as_list(raw.get("options") or raw.get("选项"))):
        if isinstance(x, dict):
            key = _s(x.get("key") or x.get("label"), 4) or "ABCDEFGH"[min(i, 7)]
            text = _s(x.get("text") or x.get("content"), 400)
        else:
            key = "ABCDEFGH"[min(i, 7)]
            text = _s(x, 400)
        if text:
            options.append({"key": key.upper(), "text": text})
    points = []
    for x in _as_list(raw.get("points") or raw.get("评分点")):
        if isinstance(x, dict):
            p = _s(x.get("point"), 200)
            if p:
                try:
                    sc = float(x.get("score") or 0)
                except Exception:
                    sc = 0.0
                points.append({"point": p, "score": sc})
    distractors = []                                          # 干扰项辨析（#5，2026-10-09）
    for x in _as_list(raw.get("distractor_reasons") or raw.get("干扰项辨析")):
        if isinstance(x, dict):
            k = _s(x.get("key") or x.get("option"), 4).upper()
            why = _s(x.get("why") or x.get("reason") or x.get("理由"), 200)
            if k and why:
                distractors.append({"key": k, "why": why})
    exam = {
        "type": "choice" if str(raw.get("type") or "").strip() == "choice" else "text",
        "question": _s(raw.get("question") or raw.get("题目"), 800),
        "options": options,
        "answer_key": _s(raw.get("answer_key") or raw.get("answer"), 60).upper(),
        "reference_answer": _s(raw.get("reference_answer") or raw.get("answer_text"), 800),
        "points": points[:_LIMITS["points"]],
        "distractor_reasons": distractors,
        "type_reason": _s(raw.get("type_reason") or raw.get("reason"), 200),
    }
    if exam["type"] == "choice":
        keys = [o["key"] for o in exam["options"]]
        k = exam["answer_key"]
        if len(exam["options"]) >= 2 and k in keys:
            pass
        elif len(exam["options"]) >= 2 and k.isdigit() and 1 <= int(k) <= len(keys):
            exam["answer_key"] = keys[int(k) - 1]
        elif len(exam["options"]) >= 2 and k:
            hit = next((o["key"] for o in exam["options"] if norm_text(o["text"]) == norm_text(k)), "")
            if hit:
                exam["answer_key"] = hit
            else:
                exam["type"] = "text"
                exam["reference_answer"] = exam["reference_answer"] or k
        else:
            exam["type"] = "text"
            exam["reference_answer"] = exam["reference_answer"] or exam["answer_key"]
    if exam["type"] == "text":
        exam["options"] = []
        exam["answer_key"] = ""
        exam["distractor_reasons"] = []
        if not exam["reference_answer"]:
            exam["reference_answer"] = ""
    else:
        keys = {o["key"] for o in exam["options"]}            # 辨析只留指向真实选项的
        ak = exam["answer_key"]
        exam["distractor_reasons"] = [d for d in exam["distractor_reasons"]
                                      if d["key"] in keys and d["key"] != ak]
    return exam


def normalize_lecture(obj) -> dict:
    """模型输出 → 规范化讲义（只保留一个知识点）。"""
    obj = obj if isinstance(obj, dict) else {}
    return {
        "kp": normalize_kp(_first_kp(obj)),
        "example": normalize_example(obj.get("example") or obj.get("例题") or {}),
        "exam": normalize_exam(obj.get("exam") or obj.get("考试题") or obj.get("question") or {}),
    }


def normalize_syllabus(obj, subject: str = "", want: int = 14) -> list:
    """大纲规范化：去重、去空、截断到 want 条。"""
    obj = obj if isinstance(obj, dict) else {}
    arr = _as_list(obj.get("items") or obj.get("knowledge_points") or obj.get("syllabus") or obj)
    out, seen = [], set()
    for x in arr:
        if isinstance(x, dict):
            name = _s(x.get("name") or x.get("title") or x.get("point"), 60)
            brief = _s(x.get("brief") or x.get("desc") or x.get("why"), 200)
        else:
            name, brief = _s(x, 60), ""
        if not name:
            continue
        key = norm_text(name)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append({"name": name, "brief": brief})
        if len(out) >= max(4, int(want)):
            break
    return out


# ------------------------------------------------------------------ 批改规范化

def normalize_points(obj) -> list:
    """评分点逐项核查表：point/hit/got/max/evidence（AutoGrader 的可核查凭据，2026-10-09）。

    宽容处理：got/max 缺值或非数字都能兜住，max 缺失时按 100 均分兜底，保证表不会因为一个坏值整块丢掉。
    """
    raw = obj if isinstance(obj, list) else (_as_list(obj) if obj is not None else [])
    items = [x for x in raw if isinstance(x, dict)]
    out = []
    for x in items:
        pt = _s(x.get("point") or x.get("name"), 200)
        if not pt:
            continue
        try:
            mx = float(x.get("max") if x.get("max") is not None else 0)
        except Exception:
            mx = 0.0
        if mx <= 0:
            mx = round(100.0 / max(1, len(items)), 1)
        try:
            got = float(x.get("got") if x.get("got") is not None else x.get("score") or 0)
        except Exception:
            got = 0.0
        got = max(0.0, min(mx, round(got, 1)))
        hit = x.get("hit")
        if not isinstance(hit, bool):
            hit = got >= mx * 0.6        # 缺 hit 时按得分率推（拿满 6 成算拿到了）
        out.append({"point": pt, "hit": bool(hit), "got": got, "max": mx,
                    "evidence": _s(x.get("evidence"), 300)})
    return out[:6]


def grade_from_points(points: list) -> int | None:
    """由逐点得分折算百分制总分；评分点体系不可信时返回 None（交给模型给的分数）。"""
    if not points:
        return None
    mx = sum(float(p.get("max") or 0) for p in points)
    if mx < 60:                            # 覆盖不到六成分值，说明这表拆歪了，不采信
        return None
    return int(max(0, min(100, round(sum(float(p.get("got") or 0) for p in points) * 100.0 / mx))))


def normalize_grade(obj) -> dict:
    obj = obj if isinstance(obj, dict) else {}
    v = str(obj.get("verdict") or "").strip().lower()
    if v not in ("correct", "partial", "wrong"):
        v = "wrong"
    try:
        score = int(float(obj.get("score") or 0))
    except Exception:
        score = 0
    score = max(0, min(100, score))
    # 逐点核查优先：总分由各项实得分累加得出，学生能一项项对回去
    prs = normalize_points(obj.get("point_results") or obj.get("points_result"))
    by_points = grade_from_points(prs)
    if by_points is not None:
        score = by_points
    if v == "correct" and score < 60:
        score = 90                          # 判定与分数自相矛盾时的确定性钳位
    if v == "wrong" and score > 60:
        score = 30
    steps_fb = []
    for x in _as_list(obj.get("step_feedback") or obj.get("steps")):
        if isinstance(x, dict):
            txt = _s(x.get("comment") or x.get("detail") or x.get("text"), 300)
            if txt:
                steps_fb.append(txt)
        elif _s(x):
            steps_fb.append(_s(x, 300))
    return {
        "verdict": v,
        "score": score,
        "comment": _s(obj.get("comment"), 600),
        "error_point": _s(obj.get("error_point") or obj.get("error"), 300),      # 规则⑥：错在哪
        "root_cause": _s(obj.get("root_cause") or obj.get("cause"), 400),        # 规则⑥：根源
        "counterexample": _s(obj.get("counterexample"), 400),                    # 规则⑥：反例
        "step_feedback": steps_fb[:6],
        "point_results": prs,                                                    # 评分点逐项核查
    }


# ------------------------------------------------------------------ 对学生的可见视图（隐藏答案）

def exam_public(exam: dict) -> dict:
    """下发给学生端的考试题：不含答案与评分点。"""
    exam = exam if isinstance(exam, dict) else {}
    return {
        "type": exam.get("type") or "text",
        "question": exam.get("question") or "",
        "options": exam.get("options") or [],
    }


def lecture_public(payload: dict, graded: bool = False) -> dict:
    """讲义 → 学生视图。例题随题带完整详解（2026-10-10 折叠即看，前端默认折叠防剧透）；
    考试题在批改前仍只给题面与选项。"""
    payload = payload if isinstance(payload, dict) else {}
    kp = payload.get("kp") or {}
    ex = payload.get("example") or {}
    exam = payload.get("exam") or {}
    out = {
        "kp": kp,
        "example": {
            "question": ex.get("question") or "",
            "steps": ex.get("steps") or [],
            "answer": ex.get("answer") or "",
            "analysis": ex.get("analysis") or "",
        },
        "exam": exam_public(exam),
    }
    if graded:
        out["exam"]["answer_key"] = exam.get("answer_key") or ""
        out["exam"]["reference_answer"] = exam.get("reference_answer") or ""
        out["exam"]["points"] = exam.get("points") or []
    return out


def grade_choice(exam: dict, choice: str) -> dict:
    """选择题本地判分（零成本）。判错时本地查干扰项辨析（#5），不额外调模型。"""
    exam = exam if isinstance(exam, dict) else {}
    key = str(exam.get("answer_key") or "").strip().upper()
    got = str(choice or "").strip().upper()
    ok = bool(key) and got == key
    why = ""
    if not ok:
        for d in (exam.get("distractor_reasons") or []):
            if isinstance(d, dict) and str(d.get("key") or "").strip().upper() == got:
                why = str(d.get("why") or "")
                break
    # 答对就是满分：早先按 100/选项数给分，四选一答对只显示 25 分，学生以为自己答错了（2026-10-09 评测）
    score = 100 if ok else 0
    return {
        "verdict": "correct" if ok else "wrong",
        "score": score,
        "comment": ("选对了。" if ok else "没选对，正确选项是 %s。" % key),
        "error_point": "" if ok else "选项判断",
        "root_cause": "", "counterexample": "", "step_feedback": [],
        "chosen": got, "answer_key": key,
        "distractor_reason": why,
        "point_results": [{"point": "选出正确选项 %s" % key, "hit": ok,
                           "got": score, "max": 100,
                           "evidence": ("选了 %s" % got) if got else "未涉及"}],
    }


# ------------------------------------------------------------------ 错题条目（进错题本）

def build_wrong_item(*, session_id: str, kp_index: int, subject: str, kp_name: str,
                     exam: dict, user_answer: str, grade: dict, now_ms: int) -> dict:
    """答错 → 错题本条目（字段对齐 book.js makeItem / 链式沉淀惯例）。"""
    exam = exam if isinstance(exam, dict) else {}
    grade = grade if isinstance(grade, dict) else {}
    ans = exam.get("reference_answer") or ""
    if exam.get("type") == "choice" and exam.get("answer_key"):
        ans = "%s．%s" % (exam.get("answer_key"), next(
            (o.get("text") for o in (exam.get("options") or []) if o.get("key") == exam.get("answer_key")), ""))
    diagnosis = "；".join([x for x in (grade.get("error_point"), grade.get("root_cause"),
                                       grade.get("counterexample")) if x])[:600]
    return {
        "id": "teach-%s-%d" % (str(session_id)[:8], int(kp_index)),
        "kind": "mistake",
        "question": str(exam.get("question") or "")[:600],
        "attempt": str(user_answer or "")[:600],
        "subject": str(subject or "未分类"),
        "answer": str(ans)[:400],
        "knowledgePoints": [str(kp_name)] if kp_name else [],
        "diagnosis": diagnosis,
        "mastered": False,
        "streak": 0,
        "quizCount": 0,
        "correctCount": 0,
        "reviewAt": int(now_ms) + 86400 * 1000,   # 次日进 SRS 复习
        "addedAt": int(now_ms),
        "source": "AI 教学",
    }


# ------------------------------------------------------------------ 章节两级 + 逐选项分析（2026-10-10 章节化改造）

def normalize_option_analysis(raw, exam: dict) -> dict:
    """批改后的逐选项解析：per_option（每项对错+为什么）+ kps（本题考查的知识点）。

    与 distractor_reasons 的区别：那是出题时预生成的「错误项为什么看着对」，这是批改后
    现场生成的「四个选项逐一拆解」，覆盖全部选项且带知识点归属。"""
    raw = raw if isinstance(raw, dict) else {}
    keys = [o.get("key") for o in (exam.get("options") or []) if o.get("key")]
    per = []
    for x in _as_list(raw.get("per_option") or raw.get("options")):
        if isinstance(x, dict):
            k = _s(x.get("key") or x.get("option"), 4).upper()
            if not k or k not in keys:
                continue
            v = str(x.get("verdict") or x.get("right") or "").strip().lower()
            v = "right" if v in ("right", "true", "对", "正确") else "wrong"
            per.append({"key": k, "verdict": v,
                        "why": _s(x.get("why") or x.get("reason"), 300)})
    per.sort(key=lambda p: keys.index(p["key"]))     # 按选项顺序重排，方便对照
    kps = [_s(x, 60) for x in _as_list(raw.get("kps"))
           if _s(x, 60)][:5]
    return {"per_option": per, "kps": kps}


def normalize_chapters(raw, items: list) -> tuple:
    """大纲两级化：章（2~8）× 节。chapters 只存 {name, brief, count}——节就是 items 本身，
    第 i 章的节 = items[累计偏移 : 偏移+count]，保持 kp_index 语义与旧表结构完全兼容。
    单章节数钳位 ≤8；章数不足 2 时降级为单章（防模型只吐一章把结构压扁）。

    返回 (chapters, flat_items)：flat_items 是按「章→节」重排后的 items，调用方用它落库。"""
    out = []
    for x in _as_list(raw):
        if isinstance(x, dict):
            name = _s(x.get("name") or x.get("title"), 60)
            brief = _s(x.get("brief") or x.get("desc"), 200)
            secs = _as_list(x.get("sections"))
            names = []
            for s in secs:
                if isinstance(s, dict):
                    nm = _s(s.get("name") or s.get("title"), 60)
                    br = _s(s.get("brief") or s.get("desc"), 200)
                else:
                    nm, br = _s(s, 60), ""
                if nm:
                    names.append((nm, br))
            if name and names:
                out.append({"name": name, "brief": brief, "sections": names})
    if len(out) < 2:                       # 结构塌了 → 单章兜底：全部节归一章
        out = [{"name": "全部内容", "brief": "",
                "sections": [(it.get("name", ""), it.get("brief", "")) for it in items]}]
    flat, chapters = [], []
    for ch in out[:8]:                     # 最多 8 章
        secs = ch["sections"][:8]          # 单章最多 8 节
        chapters.append({"name": ch["name"], "brief": ch["brief"], "count": len(secs)})
        flat.extend([{"name": n, "brief": b} for n, b in secs])
    return chapters, flat


def chapter_of(chapters: list, idx: int) -> int:
    """小节全局索引 → 所属章号（越界钳到最后一章）。"""
    acc = 0
    for ci, ch in enumerate(chapters or []):
        acc += int((ch or {}).get("count") or 0)
        if idx < acc:
            return ci
    return max(0, len(chapters or []) - 1)


def chapter_range(chapters: list, ci: int) -> tuple:
    """章号 → (起始小节全局索引, 节数)。"""
    start = sum(int((ch or {}).get("count") or 0) for ch in (chapters or [])[:ci])
    n = int((chapters[ci] or {}).get("count") or 0) if ci < len(chapters or []) else 0
    return start, n


def chapter_end_index(chapters: list, ci: int, total: int) -> int:
    """章内最后一个小节的全局索引。"""
    start, n = chapter_range(chapters, ci)
    if n <= 0:
        return min(start, max(0, total - 1))
    return min(start + n - 1, max(0, total - 1))


def normalize_unit_paper(raw, chapter_name: str) -> list:
    """单元测试卷规范化：复用题（小节考题引用）+ 新综合题统一成 {origin, ...exam} 结构。"""
    out = []
    for x in _as_list(raw):
        if not isinstance(x, dict):
            continue
        origin = _s(x.get("origin"), 40) or "new"
        exam = x.get("exam") if isinstance(x.get("exam"), dict) else x
        if not _s(exam.get("question")):
            continue
        out.append({"origin": origin, "section": _s(x.get("section"), 60),
                    "kp": _s(x.get("kp"), 60), "exam": normalize_exam(exam)})
    return out[:10]
