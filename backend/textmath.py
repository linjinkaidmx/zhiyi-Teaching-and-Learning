# -*- coding: utf-8 -*-
"""
纯文本数学清洗（后端出口护栏）：把残留 LaTeX 标记转成纯文本数学符号。
与 scripts/latex_to_plain.py 的 plain_math 同源（该脚本为数据迁移版，此处为运行时护栏版）。
任何出口（题库取题/错题取题/链式生成输入）过一遍，保证用户永远看不到 $...$、\frac 等标记。
"""
import re

_CMD = {
    "lim": "lim", "sin": "sin", "cos": "cos", "tan": "tan", "cot": "cot",
    "ln": "ln", "log": "log", "exp": "exp", "min": "min", "max": "max",
    "arcsin": "arcsin", "arccos": "arccos", "arctan": "arctan",
    "gcd": "gcd", "det": "det", "mod": "mod",
    "int": "∫", "iint": "∫∫", "iiint": "∫∫∫", "oint": "∮",
    "sum": "Σ", "prod": "Π",
    "to": "→", "rightarrow": "→", "Rightarrow": "⇒", "leftarrow": "←",
    "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠",
    "times": "×", "cdot": "·", "div": "÷", "pm": "±", "mp": "∓",
    "approx": "≈", "sim": "~", "propto": "∝", "equiv": "≡",
    "infty": "∞", "pi": "π", "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ",
    "theta": "θ", "lambda": "λ", "mu": "μ", "xi": "ξ", "eta": "η", "rho": "ρ",
    "sigma": "σ", "tau": "τ", "phi": "φ", "varphi": "φ", "omega": "ω", "epsilon": "ε",
    "Delta": "Δ", "Omega": "Ω", "Gamma": "Γ", "Lambda": "Λ", "Sigma": "Σ", "Phi": "Φ",
    "in": "∈", "notin": "∉", "subset": "⊂", "subseteq": "⊆", "cup": "∪", "cap": "∩",
    "emptyset": "∅", "forall": "∀", "exists": "∃",
    "ldots": "…", "dots": "…", "cdots": "⋯", "vdots": "⋮", "ddots": "⋯",
    "prime": "'", "circ": "°", "degree": "°", "angle": "∠", "parallel": "∥", "perp": "⊥",
    "because": "因为", "therefore": "所以",
    "quad": " ", "qquad": "  ", "displaystyle": "", "limits": "",
    "partial": "∂", "nabla": "∇", "hbar": "ℏ",
    "longrightarrow": "→", "mapsto": "↦",
    "lvert": "|", "rvert": "|", "vert": "|", "lVert": "‖", "rVert": "‖",
}
_TEXTLIKE = re.compile(r"\\(?:text|mathrm|mathbf|mathit|mathfrak|mathcal|operatorname|textbf)\s*\{([^{}]*)\}")
_HAS = re.compile(r"\$|\\\(|\\\[|\\frac|\\sqrt|\\lim|\\int|\\sum|\\log|\\ln|\\sin|\\cos|"
                  r"\\tan|\\begin\{|\\left|\\right|\\[a-zA-Z]+|_\{|\^\{")
_SUPD = str.maketrans("0123456789+-=()", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾")
_SUBD = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")


def _grab(s, i):
    if i < len(s) and s[i] == "{":
        depth, j = 1, i + 1
        while j < len(s) and depth:
            if s[j] == "{":
                depth += 1
            elif s[j] == "}":
                depth -= 1
            j += 1
        return s[i + 1:j - 1], j
    if i < len(s) and s[i] == "\\":
        m = re.match(r"\\[a-zA-Z]+", s[i:])
        if m:
            return m.group(0), i + len(m.group(0))
    return (s[i], i + 1) if i < len(s) else ("", i + 1)


def _simp(tok):
    tok = tok.strip()
    if tok and len(tok) <= 6 and not re.search(r"[+\-=<>,；;]", tok):
        return tok
    return None


def plain_math(text):
    """LaTeX → 纯文本数学；无标记原样返回（幂等、O(1) 快路径）。"""
    if not text:
        return text
    s = str(text)
    if not _HAS.search(s):
        return s

    s = re.sub(r"\\begin\{cases\}", "{ ", s)
    s = re.sub(r"\\end\{cases\}", " }", s)
    s = re.sub(r"\\begin\{[a-z]*matrix\}", "[ ", s)
    s = re.sub(r"\\end\{[a-z]*matrix\}", " ]", s)
    s = re.sub(r"\\begin\{(?:aligned|array|gathered)\}(?:\{[^}]*\})?|\\end\{(?:aligned|array|gathered)\}", " ", s)
    s = s.replace("\\\\", "；").replace("&", " ")

    for _ in range(10):
        s2 = _TEXTLIKE.sub(r"\1", s)
        if s2 == s:
            break
        s = s2

    def _frac(m):
        a, ja = _grab(s, m.end())
        b, jb = _grab(s, ja)
        sa, sb = _simp(a), _simp(b)
        return "%s/%s" % (sa if sa else "(" + a + ")", sb if sb else "(" + b + ")"), jb

    for _ in range(300):
        m = re.search(r"\\[dt]?frac", s)
        if not m:
            break
        tail, j = _frac(m)
        s = s[:m.start()] + tail + s[j:]
    for _ in range(300):
        k = s.find("\\sqrt")
        if k < 0:
            break
        a, j = _grab(s, k + 5)
        sa = _simp(a)
        s = s[:k] + (("√" + sa) if sa else ("√(" + a + ")")) + s[j:]

    pos = 0
    for _ in range(600):
        a_ = s.find("^", pos)
        b_ = s.find("_", pos)
        if a_ >= 0 and (b_ < 0 or a_ < b_):
            k, kind = a_, "sup"
        elif b_ >= 0:
            k, kind = b_, "sub"
        else:
            break
        j = k + 1
        if j < len(s) and s[j] == "{":
            a, k2 = _grab(s, j)
        elif j < len(s) and s[j] == "\\":
            m = re.match(r"\\[a-zA-Z]+", s[j:])
            a, k2 = (m.group(0), j + len(m.group(0))) if m else ("", j + 1)
        else:
            a, k2 = (s[j], j + 1) if j < len(s) else ("", j + 1)
        tab = _SUPD if kind == "sup" else _SUBD
        if re.fullmatch(r"[0-9+\-=()]+", a):
            tail = a.translate(tab)
        else:
            tail = ("^(" if kind == "sup" else "_(") + a + ")"
        s = s[:k] + tail + s[k2:]
        pos = k + len(tail)

    s = re.sub(r"\\([a-zA-Z]+)", lambda m: _CMD.get(m.group(1), m.group(1)), s)
    for tok in ("\\,", "\\;", "\\!", "\\ "):
        s = s.replace(tok, " ")
    for tok in ("$", "\\(", "\\)", "\\[", "\\]"):
        s = s.replace(tok, "")

    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\s+([，。；！？、,.:;!?）)])", r"\1", s)
    s = re.sub(r"[，,]\s*；", "；", s)
    return s.strip()


def plain_obj(obj):
    """递归清洗 JSON 结构里的所有字符串。"""
    if isinstance(obj, str):
        return plain_math(obj)
    if isinstance(obj, list):
        return [plain_obj(x) for x in obj]
    if isinstance(obj, dict):
        return {k: plain_obj(v) for k, v in obj.items()}
    return obj
