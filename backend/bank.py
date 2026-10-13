"""知一 · 题库命中模块。

- normalize：题目文本归一化（去 LaTeX 定界符/空格命令/全角半角/空白），让「同一道题」
  无论拍图识别还是文本输入都能归一化成一致的指纹
- find_match：归一化后与题库做相似度匹配，命中返回库内完整讲解
- add_to_bank：AI 讲解后自动回填题库（自增长，越用命中率越高）
"""
import re
from difflib import SequenceMatcher

import db

# LaTeX 定界符：$$ $ \( \) \[ \]（$$ 放前面避免被 $ 提前匹配）
_LATEX_DELIM_RE = re.compile(r"\$\$|\$|\\\(|\\\)|\\\[|\\\]")
# LaTeX 水平空格命令：\quad \qquad \, \; \: \! \␣
_LATEX_SPACE_RE = re.compile(r"\\(?:quad|qquad|,|;|:|!|\s)")
# 提取所有数字（含小数），用于「数字指纹」校验
_DIGIT_RE = re.compile(r"\d+(?:\.\d+)?")

# 文本相似度阈值。
# 原为 0.96（几乎逐字相同才算命中），但拍照识别的空格/标点/题号/LaTeX 写法差异
# 会让「同一道题」掉到 0.9 以下，导致题库「只进不出」（线上实测 273 条 0 命中）。
# 配合下面的归一化增强，0.90 已足以认定同题；再由数字指纹兜住「差一个数字」的误匹配。
MATCH_THRESHOLD = 0.90

# 相似候选阈值：仅供「找到相似题，是否是你搜的这道？」这类交互使用（未接入前不影响主流程）
CANDIDATE_THRESHOLD = 0.78

# 开头题号（"21."、"3、"、"（4）"…）：题号与题目内容无关，参与比对会白降相似度
_LEADING_NO_RE = re.compile(r"^\s*(?:第\s*\d+\s*题|[（(]?\d{1,3}[.、)）]|\d{1,3}\s+)\s*")

# 标点（中英）：数学题的信息都在符号与数字里，标点去掉后相似度判定更稳
_PUNCT_RE = re.compile(r"[，。、；：？！,.;:?!'\"“”‘’（）()【】\[\]《》<>~—-]+")

# 常见 LaTeX 命令 → 等价写法（让「\frac{a}{b}」与「a/b」这类差别不干扰判定）
_LATEX_EQUIV = [
    # \frac{a}{b} 与 a/b 是同一个除法的两种写法 → 统一成斜杠
    ("\\frac", "/"), ("\\dfrac", "/"), ("\\tfrac", "/"),
    ("\\sqrt", "sqrt"), ("\\times", "*"), ("\\cdot", "*"),
    ("\\int", "int"), ("\\sum", "sum"), ("\\lim", "lim"),
    ("\\theta", "theta"), ("\\alpha", "alpha"), ("\\beta", "beta"),
    ("\\pi", "pi"), ("\\infty", "inf"), ("\\to", "->"),
    ("\\quad", ""), ("\\qquad", ""), ("\\left", ""), ("\\right", ""),
    ("\\,", ""), ("\\;", ""), ("\\!", ""),
]

# Unicode 数学符号 → 文本写法：让「√(1-x²)」与「\sqrt{1-x^2}」落到同一形态上
_SYMBOL_EQUIV = [
    ("√", "sqrt"), ("∛", "cbrt"), ("∫", "int"), ("∬", "iint"), ("∑", "sum"), ("∏", "prod"),
    ("∞", "inf"), ("≈", "="), ("≠", "!="), ("≤", "<="), ("≥", ">="), ("±", "+-"),
    ("×", "*"), ("·", "*"), ("÷", "/"), ("−", "-"), ("→", "->"), ("⇒", "=>"),
    ("θ", "theta"), ("α", "alpha"), ("β", "beta"), ("γ", "gamma"), ("λ", "lambda"),
    ("μ", "mu"), ("π", "pi"), ("σ", "sigma"), ("φ", "phi"), ("ω", "omega"), ("Δ", "delta"),
    ("²", "^2"), ("³", "^3"), ("¹", "^1"), ("⁰", "^0"), ("⁴", "^4"), ("⁵", "^5"),
    ("₀", "_0"), ("₁", "_1"), ("₂", "_2"), ("₃", "_3"), ("ₙ", "_n"), ("ᵢ", "_i"), ("ⱼ", "_j"),
    ("ₓ", "_x"), ("ₐ", "_a"), ("ₖ", "_k"),
]


def normalize(text: str) -> str:
    """题目归一化：让「同一道题」的不同写法落到同一个指纹上。

    处理顺序：小写 → 全角转半角 → 去 LaTeX 定界符/空格命令 → LaTeX 命令等价化
    → 去标点 → 去开头题号 → 去所有空白。
    """
    t = str(text or "")
    t = t.lower()
    # 全角 → 半角（含全角空格、全角字母数字符号）
    t = "".join(chr(ord(c) - 0xFEE0) if 0xFF01 <= ord(c) <= 0xFF5E else c for c in t)
    # 去 LaTeX 定界符与水平空格命令
    t = _LATEX_DELIM_RE.sub("", t)
    t = _LATEX_SPACE_RE.sub("", t)
    # LaTeX 命令等价化（\frac{a}{b} 与 a/b 不再判成两回事）
    for a, b in _LATEX_EQUIV:
        t = t.replace(a, b)
    # Unicode 数学符号等价化（√ 与 \sqrt、x² 与 x^2 等写法统一）
    for a, b in _SYMBOL_EQUIV:
        t = t.replace(a, b)
    # 花括号是 LaTeX 分组符号，无语义
    t = t.replace("{", "").replace("}", "")
    # 去标点（数学题的信息在符号与数字里）
    t = _PUNCT_RE.sub("", t)
    # 去开头题号（"21." 这类与题目内容无关）
    t = _LEADING_NO_RE.sub("", t.strip())
    # 去所有空白（空格/换行/tab）
    t = re.sub(r"\s+", "", t)
    return t


def digit_fingerprint(text: str) -> tuple:
    """提取题目的所有数字并排序，作为「数值身份」。两道题若数字集合不同，
    即使文本高度相似（如 x^3 vs x^2 只差一个指数）也判为不同题。

    注意：先剥掉开头的题号（"21. 已知…" 里的 21 不是题目数值），否则同一道题
    换个编号就会被判成不同题。
    """
    t = _LEADING_NO_RE.sub("", str(text or "").strip())
    return tuple(sorted(_DIGIT_RE.findall(t)))


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def find_match(question: str, threshold: float = MATCH_THRESHOLD):
    """查题库命中。返回 (item, score)，未命中返回 (None, 0)。

    双重校验：文本相似度达标 + 数字指纹一致，避免「差一个数字」的误匹配。
    """
    nq = normalize(question)
    if not nq:
        return None, 0.0
    q_digits = digit_fingerprint(question)
    best, best_score = None, 0.0
    for item in db.load_all_bank():
        score = similarity(nq, item["normalized"])
        if score > best_score:
            best, best_score = item, score
    if best and best_score >= threshold:
        if digit_fingerprint(best["question"]) != q_digits:
            return None, best_score
        return best, best_score
    return None, best_score


def find_candidates(question: str, limit: int = 3):
    """返回相似度较高的候选（含未达命中阈值的），用于「是不是这道题？」的确认交互。

    返回 [(item, score)]，按相似度降序；数字指纹不一致的会被剔除。
    """
    nq = normalize(question)
    if not nq:
        return []
    q_digits = digit_fingerprint(question)
    out = []
    for item in db.load_all_bank():
        score = similarity(nq, item["normalized"])
        if score < CANDIDATE_THRESHOLD:
            continue
        if digit_fingerprint(item["question"]) != q_digits:
            continue
        out.append((item, score))
    out.sort(key=lambda x: -x[1])
    return out[: max(1, limit)]


def add_to_bank(question: str, result: dict) -> int | None:
    """AI 讲解完成后回填题库。result 为 explain 的结构化返回。"""
    nq = normalize(question)
    if not nq or not isinstance(result, dict) or not result.get("answer"):
        return None
    subject = result.get("subject", "")
    kps = result.get("knowledge_points", []) or []
    answer = result.get("answer", "")
    return db.save_bank_item(question, nq, subject, kps, answer, result)
