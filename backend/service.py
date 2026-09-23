"""知一 · 模型调用与解析层。

设计：
- 三个调用位（识别 / 讲解 / 批改）各自可配 provider + model + thinking 开关，全走 env
- provider：ark（方舟，支持视觉与 enable_thinking）或 deepseek（仅文本，reasoner 自带思考）
- 讲解位调用失败（超时等）可自动降级到方舟 turbo 不开思考重试，保住 30s 延迟红线
- JSON 裸反斜杠正则修复；无任何 Key 或 MOCK=1 时走内置 Mock
"""
import base64
import io
import json
import os
import re

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageFilter, ImageStat

load_dotenv()

# ---- Provider 凭据
ARK_API_KEY = os.getenv("ARK_API_KEY", "").strip()
ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3").strip()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()

# ---- 三个调用位配置（默认：全方舟 turbo；讲解位默认开思考）
def _slot(name: str, default_model: str, default_thinking: str):
    provider = os.getenv(f"{name}_PROVIDER", "ark").strip().lower()
    model = os.getenv(f"{name}_MODEL", default_model).strip()
    thinking = os.getenv(f"{name}_THINKING", default_thinking).lower() in ("1", "true", "yes")
    return {"provider": provider, "model": model, "thinking": thinking}

EXTRACT_SLOT = _slot("EXTRACT", "doubao-seed-2-1-turbo-260628", "0")
EXPLAIN_SLOT = _slot("EXPLAIN", "doubao-seed-2-1-turbo-260628", "0")
JUDGE_SLOT = _slot("JUDGE", "doubao-seed-2-1-turbo-260628", "0")

EXPLAIN_FALLBACK = os.getenv("EXPLAIN_FALLBACK", "1").lower() in ("1", "true", "yes")

MOCK = os.getenv("MOCK", "").lower() in ("1", "true", "yes") or not (ARK_API_KEY or DEEPSEEK_API_KEY)

_clients: dict = {}


def _get_client(provider: str, timeout: float = 150) -> OpenAI:
    """按 provider 取客户端（OpenAI 兼容协议，max_retries=0）。timeout 可按调用位调节。"""
    if provider == "deepseek":
        key, base = DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
    else:
        key, base = ARK_API_KEY, ARK_BASE_URL
    cache_key = (provider, key, base, timeout)
    if cache_key not in _clients:
        _clients[cache_key] = OpenAI(api_key=key, base_url=base, timeout=timeout, max_retries=0)
    return _clients[cache_key]


def chat_text(messages, temperature: float = 0.2, slot: dict | None = None, timeout: float = 150) -> str:
    """调用单个模型位，返回纯文本回复。"""
    slot = slot or EXTRACT_SLOT
    provider = slot["provider"]
    kwargs = {"model": slot["model"], "messages": messages, "temperature": temperature}
    if provider == "ark":
        kwargs["extra_body"] = {"enable_thinking": bool(slot["thinking"])}
    resp = _get_client(provider, timeout).chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


def chat_with_fallback(messages, temperature: float, slot: dict) -> str:
    """讲解位：主配置失败（超时等）时降级到方舟 turbo 不开思考重试一次。"""
    try:
        return chat_text(messages, temperature=temperature, slot=slot)
    except Exception:
        is_plain_ark = slot["provider"] == "ark" and not slot["thinking"]
        if not EXPLAIN_FALLBACK or is_plain_ark:
            raise
        fb = {"provider": "ark", "model": "doubao-seed-2-1-turbo-260628", "thinking": False}
        return chat_text(messages, temperature=temperature, slot=fb)


# ---------------------------------------------------------------- JSON 修复

_FENCE_RE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$", re.M)
_BARE_BACKSLASH_RE = re.compile(r'(?<!\\)\\(?![\\"/bfnrtu])')

# \f \b \t \n \r \u 在 JSON 里是合法转义，模型输出「裸 LaTeX」时会被静默吃掉
# （\frac → 换页符+"rac"、\theta → 制表符+"heta"、\underbrace → 整包解析失败）。
# 所以当这些字母后面跟的是「已知 LaTeX 命令」时，仍要把反斜杠双写。
_LATEX_CMD_AFTER = (
    "frac|forall|fbox|flat|frown|fcolorbox|"
    "beta|begin|bmatrix|bmod|bar|bigcup|bigcap|bigoplus|bigotimes|bigvee|bigwedge|"
    "boxed|bullet|binom|boldsymbol|bigg|Bigg|"
    "theta|tan|tau|times|to|top|text|textbf|textit|tfrac|tbinom|triangle|tilde|"
    "therefore|thinspace|"
    "nu|nabla|ne|neq|not|nleq|ngeq|nto|nparallel|nmid|nleftarrow|nrightarrow|"
    "rho|rightarrow|rangle|rfloor|rceil|rVert|rbrace|roman|rm|"
    "underbrace|underline|uparrow|updownarrow|union|uplus|upsilon"
)
_LATEX_BACKSLASH_RE = re.compile(r'(?<!\\)\\(?=(?:' + _LATEX_CMD_AFTER + r'))')

# 已被吃掉的残骸还原（存量数据兜底）：
#   \x08→\b、\x0c→\f、\x0d→\r 在正文里没有正当用途，直接还原；
#   \x09(制表符) / \x0a(换行) 有正当用途，只在后面跟着「命令名的剩余部分」时才还原
#   （\theta 被吃掉后是 制表符+"heta"，所以要匹配 heta 而不是 theta）
_CMD_TAILS_T = "heta|an|au|imes|o |op|ext|rac|binom|riangle|ilde|herefore|hinspace"
_CMD_TAILS_N = "abla|eq|ot|leq|geq|parallel|mid|leftarrow|rightarrow"
_CTRL_RESTORE_RE = re.compile(
    r'[\x08\x0c\x0d]|\t(?=(?:' + _CMD_TAILS_T + r'))|\n(?=(?:' + _CMD_TAILS_N + r'))'
)
_CTRL_MAP = {'\x08': '\\b', '\x0c': '\\f', '\x0d': '\\r', '\t': '\\t', '\n': '\\n'}


def _restore_control_chars(value):
    """把被 JSON 误当转义字符吃掉的 LaTeX 反斜杠还原（无损：控制字符在正文中不会自然出现）。"""
    if isinstance(value, str):
        if not any(c in value for c in ('\x08', '\x0c', '\x0d', '\t')):
            return value
        return _CTRL_RESTORE_RE.sub(lambda m: _CTRL_MAP.get(m.group(0), m.group(0)), value)
    if isinstance(value, dict):
        return {k: _restore_control_chars(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_restore_control_chars(v) for v in value]
    return value


def _repair_json(text: str) -> str:
    """去掉 markdown 围栏，并保护 JSON 里的 LaTeX 反斜杠（裸反斜杠补成双反斜杠）。"""
    text = _FENCE_RE.sub("", text.strip()).strip()
    # 必须先修「会被 json 当合法转义吃掉」的 LaTeX 命令，否则 json.loads 会成功但内容已损坏
    text = _LATEX_BACKSLASH_RE.sub(r"\\\\", text)
    # 其余裸反斜杠同样补成双反斜杠（\\" \\/ 等真正的转义保持不动）
    return _BARE_BACKSLASH_RE.sub(r"\\\\", text)


def extract_json(text: str) -> dict:
    """模型输出 → dict。**先试修复版**（否则 json.loads 会在吃到 \\t \\n 等转义后「成功」返回已损坏的内容），
    再退回原文；成功后统一还原被吃掉的反斜杠。"""
    candidates = [_repair_json(text), text.strip()]
    for cand in candidates:
        m = re.search(r"\{.*\}", cand, re.S)
        if not m:
            continue
        for body in (m.group(0), _repair_json(m.group(0))):
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    return _restore_control_chars(data)
            except Exception:
                continue
    raise ValueError(f"模型返回 JSON 解析失败: {text[:200]}")


# ---------------------------------------------------------------- Prompts
# 注意：这些 Prompt 是纯字符串，不做 .format()，避免 LaTeX 花括号触发 KeyError

# 识别位只做"纯转写"这一件事。实测 turbo 模型下：纯转写 ~14s；
# 一旦要求 LaTeX 转换/JSON 结构化/区分手写，推理时间暴涨到 200s+ 甚至卡死。
# 公式整理、学科判断、错因分析全部交给讲解位（DeepSeek-R1）完成。
EXTRACT_PROMPT = (
    "识别图中全部文字，按原顺序**完整**输出，不要解答题目，不要解释，不要概括。"
    "若是选择题，必须逐项完整输出**所有**选项（A/B/C/D 等），不得省略、不得截断、不得合并。"
)

# 自测作答转录（mode=answer）：与题目提取不同，这里转录的是「学生写下的东西」。
# 关键约束：**保留学生原始错误**——模型顺手纠正/补全会直接毁掉后续批改的准确性。
ANSWER_TRANSCRIBE_PROMPT = (
    "逐字转录图中学生手写的作答内容（演算步骤、文字说明、最终答案；画的图和表格用一句话文字注明），"
    "按书写顺序完整输出。保留学生原来的写法和可能的错误：不要纠正、不要解答、不要点评、"
    "不要补全没写完的内容、不要概括。"
    "若图上有涂改、划掉、涂黑，或某题明显空着没写，在转录对应位置插入标记——"
    "涂改/划掉/涂黑一律写成 {涂改}，空白未写一律写成 {空白}；"
    "只允许这两种标记、原样保留花括号，不要自创别的写法（如 {涂黑}），"
    "方便后续批改时按固定格式识别纸面信息。"
    "数学式按图中书写形式转成普通文本（如 x^2、√2、∫0到1），不要用 LaTeX 语法。"
)

# 讲解深度（批次3）：只影响「讲多深」，不改变 JSON 字段契约
EXPLAIN_DEPTH_TAILS = {
    "brief": (
        "\n\n【深度：基础】只给结论性的答案 + 最多 3 个关键步骤，"
        "不要展开知识点系统讲解，不要写举一反三；diagnosis 与 knowledge_review 留空字符串。"
    ),
    "standard": "",
    "deep": (
        "\n\n【深度：深入】在标准讲解基础上，额外写清："
        "① 常见错误与为什么容易错；② 如果有第二种解法，给出对比；"
        "③ 结论能否推广，给出一个具体的推广形式。knowledge_review 要系统、可复习。"
    ),
}


def normalize_depth(depth: str | None) -> str:
    d = str(depth or "standard").strip().lower()
    return d if d in EXPLAIN_DEPTH_TAILS else "standard"


def _depth_slot(depth: str) -> tuple[dict, float]:
    """按深度给「模型位 + 超时」：基础档关掉思考（更快更省）。"""
    d = normalize_depth(depth)
    if d == "brief":
        slot = dict(EXPLAIN_SLOT)
        slot["thinking"] = 0
        return slot, 90
    if d == "deep":
        slot = dict(EXPLAIN_SLOT)
        slot["thinking"] = 1
        return slot, 300
    return EXPLAIN_SLOT, 300


EXPLAIN_PROMPT = """你是资深大学理工科私教。请对学生提出的题目做"讲透而不是只给答案"的讲解。

要求：
1. 先自己认真解题，确保答案正确，再输出。
2. 步骤要逐步展开：每一步写清楚"为什么这么做"，关键变形和公式用 LaTeX（行内 $...$，独立公式 $$...$$）。
3. key_breakthrough 指出这道题的"题眼"：突破的思路从哪里来。
4. knowledge_review 是对涉及知识点的系统讲解（定义/定理/适用条件/易错点），而不是复述步骤。
5. extensions 给 2-3 道同类型的举一反三练习（只给题干，不解答）。
6. 若提供了学生的作答 attempt 且与正确解法不符，在 diagnosis 中诊断错因（概念/计算/方法选择）；没有作答或作答正确则 diagnosis 为空字符串。
7. **公式与正文要分清**：LaTeX（$...$）只用于数学表达式；代码标识符、函数名、正则、转义字符一律用反引号包裹（如 `__len__`、`1[3-9]\\d{9}`、`\\n`），不要用 LaTeX 包裹它们。
只输出 JSON，格式：
{"question_type": "题型，如 计算题/证明题/选择题",
 "subject": "学科",
 "answer": "最终答案（LaTeX）",
 "steps": [{"title": "步骤标题", "detail": "该步的推理过程，含 LaTeX"}],
 "key_breakthrough": "题眼与突破口",
 "knowledge_points": ["知识点1", "知识点2"],
 "knowledge_review": "知识点系统讲解",
 "extensions": ["变式题1", "变式题2"],
 "diagnosis": "错因诊断或空字符串"}
题目："""

JUDGE_PROMPT = """你是大学理工科阅卷老师。请严格对照「参考答案」和「解题要点」判断学生作答是否正确。

判分原则：
1. 答案等价性：数值不同但数学等价应判对（如 1/3、0.333、$\\frac{1}{3}$、$\frac{1}{3}$ 视为等价；未化简的表达式、等价变形都算对）。不要因形式不同误判。
2. 方法可不同：只要结论正确、推理自洽，即使方法不同于参考答案也算对。
3. 步骤分：结论错但关键思路对、只差一步或计算失误 → verdict="partial"，并按完成度给分。
4. 完全正确 → verdict="correct"（score 85-100）；思路或结论错误、答非所问、空白 → verdict="wrong"（score 0-39）；其余 → verdict="partial"（score 40-84）。
5. comment 用一两句话指出对在哪/错在哪，公式用 LaTeX。

只输出 JSON：
{"verdict": "correct|partial|wrong", "score": 0, "comment": "评语"}"""


# ---- 追问：把「题干 + 完整讲解」放进 system，历史追问作为多轮消息（利于前缀缓存）

_FOLLOWUP_RULES = """

回答要求：
1. 只回答学生问的那个点，不要重复整道题的讲解——学生是看过上面这份讲解才来追问的。
2. 讲具体、有依据：公式与变形用 LaTeX（行内 $...$，独立公式 $$...$$）；代码用 ``` 代码块。
3. 如果发现自己前面的讲解有不够准确的地方，明确说「我前面的讲解这里说得不够准确」并给出修正，不要含糊过去。
4. 举例、类比要贴题，不要扯远。
5. 学生问的若与本题及涉及知识点无关，用一句话说明「这个和当前题目关系不大」并把话题拉回题目，不要展开无关内容。
6. 篇幅按需：一般 100~400 字，确实需要展开的最多 800 字，不要写成小作文。
7. 与前面几轮的回答保持一致，不要自相矛盾。"""


def _result_context(question: str, result: dict | None) -> str:
    """题干 + 已有讲解 → 上下文文本（各字段截断，控制 token）。"""
    r = result or {}
    parts = ["【题干】", (question or "").strip()[:3000]]
    if r.get("answer"):
        parts += ["", "【参考答案】", str(r["answer"]).strip()[:2000]]
    steps = r.get("steps") or []
    lines = []
    for i, s in enumerate(steps[:12]):
        if isinstance(s, dict):
            lines.append(f"{i + 1}. {s.get('title', '')}：{str(s.get('detail', ''))[:800]}")
    if lines:
        parts += ["", "【解题步骤】", "\n".join(lines)]
    if r.get("key_breakthrough"):
        parts += ["", "【关键突破口】", str(r["key_breakthrough"]).strip()[:1500]]
    if r.get("knowledge_points"):
        parts += ["", "【涉及知识点】" + "、".join(str(k) for k in r["knowledge_points"])]
    if r.get("knowledge_review"):
        parts += ["", "【知识点讲解】", str(r["knowledge_review"]).strip()[:2500]]
    if r.get("diagnosis"):
        parts += ["", "【错因诊断】", str(r["diagnosis"]).strip()[:1000]]
    return "\n".join(parts)


FOLLOWUP_HEAD = "你是大学理工科私教。学生已经看过你给下面这道题的讲解，现在针对这道题继续追问。\n\n"


def _followup_messages(question: str, result: dict | None, history: list | None, followup: str):
    """system=题目上下文与回答规则；history=最近若干轮问答；最后一条 user=本次追问。"""
    messages = [{"role": "system", "content": FOLLOWUP_HEAD + _result_context(question, result) + _FOLLOWUP_RULES}]
    items = history or []
    for h in items[-6:]:
        q = str((h or {}).get("q") or "").strip()
        a = str((h or {}).get("a") or "").strip()
        if q and a:
            messages.append({"role": "user", "content": q[:2000]})
            messages.append({"role": "assistant", "content": a[:4000]})
    messages.append({"role": "user", "content": (followup or "").strip()[:2000]})
    return messages


# ---- 换个讲法：四个角度，各自给「怎么换」的指令

RETEACH_ANGLES = {
    "basic": "假设学生基础薄弱：从最基础的概念讲起，解释每一步「为什么需要这样做」，多用具体数字或小例子，少用术语、不跳步。",
    "another": "换一条与原讲解不同的解法路径，并对比两种方法各自的适用场景与优劣（什么时候用哪个更省事）。",
    "visual": "尽量建立直观：用几何意义、图像走势、类比或示意图（可用文字描述图形，或用 LaTeX 画简单示意）来帮助理解，再落回公式。",
    "exam": "从考试与做题的角度讲：这类题的识别特征、标准解法模板、常见陷阱与易错点、评分要点（哪里容易丢分）。",
}

RETEACH_PROMPT = """你是大学理工科私教。下面这道题你已经讲过一遍，学生希望**换一种讲法**再听一次。

【原讲解】
"""

RETEACH_TAIL = """

【本次讲法要求】
"""

RETEACH_TAIL2 = """

要求：
1. 必须换角度：不要复述原讲解的措辞和顺序；原讲解里已经讲透的部分可以一句带过。
2. 仍要有完整可跟随的解答链条（学生要能照着做出来）；关键公式用 LaTeX（行内 $...$，独立 $$...$$），代码用 ``` 代码块。
3. 用 Markdown 组织（可用小标题、列表、加粗重点），篇幅 300~900 字，讲清楚为准。
4. 只输出这一次的讲解正文：不要输出 JSON，不要寒暄，不要写「另一种讲法如下」之类的话。"""


# ---------------------------------------------------------------- Mock

_MOCK_EXPLAIN = {
    "question_type": "计算题",
    "subject": "高等数学",
    "answer": r"$\frac{1}{3}$",
    "steps": [
        {"title": "识别题型", "detail": r"这是定积分基本计算，被积函数 $x^2$ 在 $[0,1]$ 上连续，可直接用牛顿-莱布尼茨公式。"},
        {"title": "求原函数", "detail": r"由幂函数积分公式 $\int x^n dx = \frac{x^{n+1}}{n+1} + C$，得 $\int x^2 dx = \frac{x^3}{3} + C$。"},
        {"title": "代入上下限", "detail": r"$\int_0^1 x^2\,dx = \left.\frac{x^3}{3}\right|_0^1 = \frac{1^3}{3} - \frac{0^3}{3} = \frac{1}{3}$。"},
    ],
    "key_breakthrough": r"看到多项式在闭区间上积分，第一反应就是找原函数 + 牛顿-莱布尼茨公式，不需要任何技巧变形。",
    "knowledge_points": ["定积分", "牛顿-莱布尼茨公式", "幂函数积分"],
    "knowledge_review": r"定积分 $\int_a^b f(x)dx$ 的几何意义是曲线下的（代数）面积。牛顿-莱布尼茨公式：若 $F$ 是 $f$ 在 $[a,b]$ 上的一个原函数，则 $\int_a^b f(x)dx = F(b) - F(a)$。易错点：忘记减 $F(a)$；被积区间内有奇点时不能直接套用。",
    "extensions": [
        r"计算 $\int_0^2 (3x^2 - 2x)\,dx$。",
        r"计算 $\int_1^e \frac{1}{x}\,dx$。",
        r"已知 $f(x) = x^3$，求 $\int_{-1}^{1} f(x)\,dx$ 并解释结果的几何意义。",
    ],
    "diagnosis": "",
}

_MOCK_JUDGE = {
    "verdict": "correct",
    "score": 95,
    "comment": r"答案 $\frac{1}{3}$ 正确，计算过程无误。",
}

_MOCK_FOLLOWUP = r"""好问题——这一步确实是整道题的关键。

之所以能这样变形，是因为被积函数 $x^2$ 在闭区间 $[0,1]$ 上连续，满足牛顿-莱布尼茨公式的使用条件，于是可以先求原函数再代入上下限：

$$\int_0^1 x^2\,dx = \left.\frac{x^3}{3}\right|_0^1 = \frac{1}{3} - 0 = \frac{1}{3}$$

换句话说，这不是"技巧"，而是把"曲边梯形面积"转化成了"原函数在两点的差"。做题时先确认连续性，再套公式即可。

（当前为 Mock 回答：未配置模型 Key 时返回示例内容。）"""

_MOCK_RETEACH = r"""## 换成「面积」来看

先不想积分公式，想一个画面：$y = x^2$ 这条曲线，从 $x=0$ 到 $x=1$ 与 $x$ 轴围出一块**曲边三角形**。题目问的就是这块图形的面积。

把 $[0,1]$ 分成 $n$ 份，每份宽 $1/n$，取右端点算高度，那么总面积约为

$$S_n = \sum_{i=1}^{n} \left(\frac{i}{n}\right)^2 \cdot \frac{1}{n} = \frac{1}{n^3}\cdot\frac{n(n+1)(2n+1)}{6} \to \frac{1}{3}$$

分割越细，近似越准，极限就是 $\frac{1}{3}$。而牛顿-莱布尼茨公式把这一整套"分割求和取极限"压缩成了一步：找原函数、代上下限。

所以记公式时不妨连着这块图形一起记——面积是 $\frac{1}{3}$，公式只是算出它的快捷方式。

（当前为 Mock 回答：未配置模型 Key 时返回示例内容。）"""


def _mock_pieces(text: str, size: int = 14):
    """把 Mock 文本切成小片，模拟流式输出。"""
    for i in range(0, len(text), size):
        yield text[i:i + size]


def _mock_extract(image_b64: str | None, mode: str = "question") -> dict:
    if mode == "answer":
        return {
            "question": "先求导得 f'(x) = 2x - 3，令 f'(x) = 0 解出 x = 3/2，"
                        "所以在区间 [0,2] 上最小值在 x = 3/2 处取到，代入得最小值 -1/4。（手写作答转录）",
            "subject": "", "attempt_hint": "",
        }
    question = r"计算定积分：$\int_0^1 x^2\,dx$。" if image_b64 else r"计算定积分：$\int_0^1 x^2\,dx$。（文本输入）"
    return {"question": question, "subject": "高等数学", "attempt_hint": ""}


# ---------------------------------------------------------------- 业务函数

class NoQuestionError(Exception):
    """识别结果里没有有效题目内容（空白图 / 图片无法解析 / 模型自述"太模糊"）。"""


# 模型在识别失败时可能返回一段"自述/道歉"，而不是题目文本（实测：模糊图返回「图像过于模糊，无法识别其中的文字内容」）。
_NO_QUESTION_RE = re.compile(
    r"无法识别|识别不了|识别不到|未能识别|看不[清见]|图[像片].{0,6}(模糊|不[清晰楚])|"
    r"没有(识别到|检测到|读取到)?文字|无法(读取|辨认)|too blurry|not readable|cannot read|unable to read|no text",
    re.IGNORECASE,
)


def _looks_like_no_question(text: str) -> bool:
    """识别转写是否「不像一道题」：空、过短、或命中模型自述/道歉句式。"""
    t = (text or "").strip()
    if not t:
        return True
    if len(t) <= 3:  # 过短，不像题目
        return True
    return bool(_NO_QUESTION_RE.search(t))


def _image_is_blank_or_invalid(b64: str) -> bool:
    """近纯色（空白/纯色底）或无法解析的图片，直接判定「无内容」，避免打满 120s 超时。

    空文件 / 损坏文件 / 空白图都走这里快速失败（实测空白图曾 180s 超时）。
    """
    try:
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("L")
        small = img.resize((200, 200))
        px = list(small.getdata())
        n = len(px)
        mean = sum(px) / n
        var = sum((p - mean) ** 2 for p in px) / n
        # 近纯色（灰度标准差极小）→ 无文字内容。
        # 阈值 2：白底整页试卷（细字+大面积留白）实测 std≈19，真空白/纯色图 ≤0.5，分离度充足。
        # 注意不能用 FIND_EDGES 替代：Pillow 卷积在均匀图上会输出虚假边缘（纯白图 edge 均值≈5）。
        # 旧版 48x48 + 阈值 14 会把整页白底试卷误判为空白（缩到 48px 后文字糊进白底，std 掉到 11）。
        return (var ** 0.5) < 2
    except Exception:
        # 无法打开（空文件 / 损坏 / 非图片字节）→ 也判为无内容
        return True


def _image_is_too_blurry(b64: str) -> bool:
    """边缘能量极低 = 重度模糊/对焦失败，模型识别会极慢（实测 178s）甚至瞎编。

    用 FIND_EDGES 后的像素均值做模糊度量：清晰文字图 ≈ 13+，重度模糊 ≈ 5。
    阈值 8 留足安全边际（宁可让用户重拍，也不要干等 3 分钟）。
    """
    try:
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("L").resize((200, 200))
        edges = img.filter(ImageFilter.FIND_EDGES)
        return ImageStat.Stat(edges).mean[0] < 8
    except Exception:
        return False


def _split_long_image(b64: str, mime: str) -> list[tuple[str, str]]:
    """预处理：统一重编码为 JPEG（大 PNG 原图实测会让视觉模型处理极慢），
    长截图（高 > 宽×1.4）再切成接近 1:1.3 的段，最多 4 段。失败则原样返回。"""
    try:
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size

        def to_jpeg(im: Image.Image) -> tuple[str, str]:
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode(), "image/jpeg"

        if h <= w * 1.4:
            return [to_jpeg(img)]
        seg_h = max(int(w * 1.3), 400)
        n = min(4, max(2, -(-h // seg_h)))
        step = h // n
        segments = []
        for i in range(n):
            top = i * step
            bottom = h if i == n - 1 else (i + 1) * step
            segments.append(to_jpeg(img.crop((0, top, w, bottom))))
        return segments
    except Exception:
        return [(b64, mime)]


def _recognize_one(b64: str, mime: str, timeout: float = 120, retries: int = 1,
                   prompt: str | None = None) -> str:
    """单段识别，返回纯文本转写。mime 必须与数据真实格式一致。prompt 缺省为题目提取。"""
    messages = [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            {"type": "text", "text": prompt or EXTRACT_PROMPT},
        ],
    }]
    last_err: Exception | None = None
    for _ in range(retries + 1):
        try:
            return (chat_text(messages, temperature=0.2, slot=EXTRACT_SLOT, timeout=timeout) or "").strip()
        except Exception as e:
            last_err = e
    raise last_err


def analyze_image(image_base64: str, mime: str = "image/png", mode: str = "question") -> dict:
    """图片 → 文本（纯转写）。mode=question 提取题目；mode=answer 逐字转录学生手写作答（自测批改用）。
    长图自动切段逐个识别；个别段失败可跳过，全失败才报错。"""
    if MOCK:
        return _mock_extract(image_base64, mode)
    b64 = image_base64.split(",")[-1]  # 兼容 data URL
    if _image_is_blank_or_invalid(b64):
        raise NoQuestionError("没识别到题目：图片里似乎没有文字（或文件无法解析），请重拍或直接输入文字。")
    if _image_is_too_blurry(b64):
        raise NoQuestionError("这张图太模糊了，没识别到题目，请重拍一张清晰的照片或直接输入文字。")
    segments = _split_long_image(b64, mime)
    # 总预算 280s（前端限 300s）：单段给满 120s+一次重试；多段按段数均摊
    per_timeout = max(45, min(120, 280 // len(segments)))
    retries = 1 if len(segments) == 1 else 0
    prompt = ANSWER_TRANSCRIBE_PROMPT if mode == "answer" else EXTRACT_PROMPT

    questions: list[str] = []
    last_err: Exception | None = None

    for seg_b64, seg_mime in segments:
        try:
            text = _recognize_one(seg_b64, seg_mime, timeout=per_timeout, retries=retries, prompt=prompt)
        except Exception as e:
            last_err = e
            if len(segments) == 1:
                raise  # 单段图：失败即整体失败
            continue  # 多段图：跳过坏段（多为纯手写笔记区）
        if text:
            questions.append(text)

    # 过滤"模型自述/道歉"这类非题目文本（实测模糊图返回"图像过于模糊，无法识别"）
    questions = [q for q in questions if not _looks_like_no_question(q)]
    if not questions:
        if mode == "answer":
            raise NoQuestionError(
                "没识别到手写作答：图片可能太模糊或是空白的，请重拍一张，或直接在输入框里输入你的作答。"
            )
        raise NoQuestionError("这张图太模糊或没有可识别的题目，请换一张更清晰的照片或直接输入文字。")
    # 学科判断、手写痕迹理解交给讲解位；此处只回传转写文本
    return {"question": "\n\n".join(questions), "subject": "", "attempt_hint": ""}


def analyze_images(images: list, mode: str = "answer") -> dict:
    """多张答卷图依次转录并按页拼接（批改用）。单张失败跳过，全部失败才报错。"""
    pages: list[str] = []
    for i, img in enumerate(images or []):
        if not img:
            continue
        try:
            data = analyze_image(img, "image/jpeg", mode=mode)
        except Exception:
            continue
        text = str(data.get("question") or "").strip()
        if text:
            pages.append(f"【第 {len(pages) + 1} 页】\n{text}")
    if not pages:
        raise NoQuestionError(
            "没识别到手写作答：图片可能太模糊或是空白的，请重拍，或直接在输入框里输入作答。"
        )
    return {"question": "\n\n".join(pages), "subject": "", "attempt_hint": ""}


def _explain_prompt(question: str, attempt: str = "", depth: str = "standard") -> str:
    d = normalize_depth(depth)
    prompt = EXPLAIN_PROMPT + EXPLAIN_DEPTH_TAILS.get(d, "") + "\n" + question.strip()
    if attempt.strip():
        prompt += "\n\n学生作答痕迹：\n" + attempt.strip()
    return prompt


def _mock_explain_for(attempt: str = "", depth: str = "standard") -> dict:
    data = json.loads(json.dumps(_MOCK_EXPLAIN))  # deep copy
    if attempt.strip():
        data["diagnosis"] = r"你的作答把上限 $1$ 代成了 $2$，属于代入上下限粗心；公式与方法都是对的，做题时建议最后单独核对一遍上下限。"
    if normalize_depth(depth) == "brief":
        data["steps"] = data["steps"][:1]
        data["knowledge_review"] = ""
        data["extensions"] = []
        data["diagnosis"] = ""
    return data


def explain_question(question: str, attempt: str = "", depth: str = "standard") -> dict:
    """题目（+可选作答痕迹）→ 结构化讲解（走讲解位，失败自动降级）。"""
    if MOCK:
        return _mock_explain_for(attempt, depth)
    slot, timeout = _depth_slot(depth)
    prompt = _explain_prompt(question, attempt, depth)
    if normalize_depth(depth) == "brief":
        # 基础档不降级：本来就要求快，降级再慢就没意义了
        text = chat_text([{"role": "user", "content": prompt}], temperature=0.2, slot=slot, timeout=timeout)
        return extract_json(text)
    text = chat_with_fallback([{"role": "user", "content": prompt}], temperature=0.2, slot=slot)
    return extract_json(text)


# ---------------------------------------------------------------- 增量 JSON 字段解析（批次3核心）

def _decode_partial(raw: str):
    r"""把（可能被截断的）JSON 字符串内容解码成可显示文本。

    返回 (decoded_text, consumed_len)。结尾若是**半个**转义序列（如单独的 \ 或 \u12），
    只解码到安全位置、把剩下的留给下一片，避免把 \n 拆成 \ + n 显示成乱码。
    """
    out = []
    i = 0
    n = len(raw)
    simple = {'"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t"}
    while i < n:
        ch = raw[i]
        if ch != "\\":
            out.append(ch)
            i += 1
            continue
        if i + 1 >= n:
            break
        e = raw[i + 1]
        if e in simple:
            out.append(simple[e])
            i += 2
            continue
        if e == "u":
            if i + 6 > n:
                break
            hexs = raw[i + 2:i + 6]
            try:
                out.append(chr(int(hexs, 16)))
            except ValueError:
                out.append("\\u" + hexs)
            i += 6
            continue
        out.append(e)
        i += 2
    return "".join(out), i


def scan_json_strings(text: str):
    """扫描（可能不完整的）JSON 文本，收集所有**字符串值**。

    返回 [(path, raw, closed)]，path 形如 `answer` / `steps[0].detail` / `knowledge_points[2]`。
    只关心字符串值 —— 讲解结果里需要逐字显示的字段都是字符串。
    不依赖完整 JSON（允许结尾被截断），这是流式逐字显示的前提。
    """
    results = []
    frames = []          # [{'kind':'obj'|'arr', 'name':str, 'idx':int}]
    pending_key = None
    i = 0
    n = len(text)

    def path_of():
        parts = []
        for fr in frames:
            if fr["kind"] == "arr":
                parts.append("%s[%d]" % (fr["name"], fr["idx"]) if fr["name"] else "[%d]" % fr["idx"])
            elif fr["name"]:
                parts.append(fr["name"])
        return ".".join(parts)

    while i < n:
        ch = text[i]
        if ch == '"':
            j = i + 1
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == '"':
                    break
                j += 1
            closed = j < n
            raw = text[i + 1:j] if closed else text[i + 1:]
            is_key = False
            if closed:
                k = j + 1
                while k < n and text[k] in " \t\r\n":
                    k += 1
                is_key = k < n and text[k] == ":"
            if is_key:
                pending_key = raw
                i = j + 1
                continue
            prefix = path_of()
            key_part = pending_key if (pending_key and frames and frames[-1]["kind"] == "obj") else ""
            # 根层字段不能带前导点：answer 而不是 .answer
            path = (prefix + "." + key_part) if (prefix and key_part) else (prefix or key_part)
            results.append((path, raw, closed))
            if not closed:
                return results          # 值未结束 → 到此为止
            pending_key = None
            i = j + 1
            continue
        if ch == "{":
            frames.append({"kind": "obj", "name": pending_key or "", "idx": 0})
            pending_key = None
            i += 1
            continue
        if ch == "}":
            if frames:
                frames.pop()
            pending_key = None
            i += 1
            continue
        if ch == "[":
            frames.append({"kind": "arr", "name": pending_key or "", "idx": 0})
            pending_key = None
            i += 1
            continue
        if ch == "]":
            if frames:
                frames.pop()
            pending_key = None
            i += 1
            continue
        if ch == ",":
            if frames and frames[-1]["kind"] == "arr":
                frames[-1]["idx"] += 1
            pending_key = None
            i += 1
            continue
        i += 1
    return results


def _diff_field_events(buffer: str, emitted: dict, done_paths: set):
    """对比累积文本，产出新增的字段增量事件。"""
    events = []
    for path, raw, closed in scan_json_strings(buffer):
        decoded, _ = _decode_partial(raw)
        prev = emitted.get(path, 0)
        if len(decoded) > prev:
            events.append({"field": path, "delta": decoded[prev:]})
            emitted[path] = len(decoded)
        if closed and path not in done_paths:
            done_paths.add(path)
            events.append({"field_done": path})
    return events


def flatten_explain_fields(data: dict):
    """把完整的讲解对象摊平成 [(path, text)]，用于 Mock 与降级路径一次性产出。"""
    out = []

    def add(path, val):
        if isinstance(val, str) and val != "":
            out.append((path, val))

    add("answer", data.get("answer"))
    for i, st in enumerate(data.get("steps") or []):
        if isinstance(st, dict):
            add("steps[%d].title" % i, st.get("title"))
            add("steps[%d].detail" % i, st.get("detail"))
    add("key_breakthrough", data.get("key_breakthrough"))
    add("knowledge_review", data.get("knowledge_review"))
    for i, kp in enumerate(data.get("knowledge_points") or []):
        add("knowledge_points[%d]" % i, kp if isinstance(kp, str) else "")
    for i, ex in enumerate(data.get("extensions") or []):
        add("extensions[%d]" % i, ex if isinstance(ex, str) else "")
    add("diagnosis", data.get("diagnosis"))
    return out


def explain_stream(question: str, attempt: str = "", depth: str = "standard"):
    """结构化讲解的流式版本：生成器 yield 事件。

    事件协议：
      {"field": path, "delta": "新增文本"}
      {"field_done": path}
      {"done": True, "result": {...}}        结束时给完整对象（前端据此校正）
      {"error": "..."}
    首 token 之前失败 → 自动降级为非流式完整调用（用户仍能拿到讲解）。
    """
    d = normalize_depth(depth)
    if MOCK:
        data = _mock_explain_for(attempt, d)
        for path, text in flatten_explain_fields(data):
            yield {"field": path, "delta": text}
            yield {"field_done": path}
        yield {"done": True, "result": data}
        return

    prompt = _explain_prompt(question, attempt, d)
    slot, timeout = _depth_slot(d)
    buf = ""
    emitted = {}
    done_paths = set()
    got_first = False
    try:
        for piece in _stream_chat([{"role": "user", "content": prompt}], temperature=0.2,
                                  slot=slot, timeout=timeout):
            if not piece:
                continue
            got_first = True
            buf += piece
            for ev in _diff_field_events(buf, emitted, done_paths):
                yield ev
        if not got_first:
            raise RuntimeError("模型没有返回内容")
        yield {"done": True, "result": extract_json(buf)}
    except Exception as e:
        if not got_first:
            # 一个字都还没出 → 降级为非流式，保证用户拿到讲解
            try:
                data = explain_question(question, attempt, d)
                for path, text in flatten_explain_fields(data):
                    yield {"field": path, "delta": text}
                    yield {"field_done": path}
                yield {"done": True, "result": data, "fallback": True}
                return
            except Exception as e2:
                yield {"error": f"讲解失败：{e2}"}
                return
        yield {"error": f"讲解中断：{e}"}


def judge_answer(question: str, reference: str, user_answer: str,
                 steps: list | None = None, key_breakthrough: str = "",
                 knowledge_points: list | None = None) -> dict:
    """自测批改（走批改位）。空答案短路返回，不调模型。可传解题要点辅助判分。"""
    if not user_answer or not user_answer.strip():
        return {"verdict": "wrong", "score": 0, "comment": "未作答。建议先重看讲解里的解题步骤，再回来重做一次。"}
    if MOCK:
        return dict(_MOCK_JUDGE)
    prompt = JUDGE_PROMPT + "\n题目：" + question.strip()
    prompt += "\n\n参考答案：\n" + str(reference).strip()
    # 把原讲解的步骤/突破口作为「解题要点」供对照，提升判分准确率
    key_points = []
    if key_breakthrough.strip():
        key_points.append("关键突破口：" + key_breakthrough.strip())
    for s in (steps or []):
        if isinstance(s, dict) and s.get("detail"):
            key_points.append(f"{s.get('title', '步骤')}：{s['detail']}")
    if key_points:
        prompt += "\n\n解题要点：\n" + "\n".join(key_points)
    prompt += "\n\n学生作答：\n" + user_answer.strip()
    text = chat_text([{"role": "user", "content": prompt}], temperature=0.1, slot=JUDGE_SLOT)
    data = extract_json(text)
    if data.get("verdict") not in ("correct", "partial", "wrong"):
        data["verdict"] = "wrong"
    return data


# ---------------------------------------------------------------- 流式（追问 / 换个讲法）

def _stream_iter(messages, temperature: float, slot: dict, timeout: float):
    """单次流式调用，逐片 yield 正文（思维链字段 reasoning_content 不输出）。"""
    provider = slot["provider"]
    kwargs = {"model": slot["model"], "messages": messages, "temperature": temperature, "stream": True}
    if provider == "ark":
        kwargs["extra_body"] = {"enable_thinking": bool(slot["thinking"])}
    stream = _get_client(provider, timeout).chat.completions.create(**kwargs)
    for ch in stream:
        if not getattr(ch, "choices", None):
            continue
        delta = ch.choices[0].delta
        piece = getattr(delta, "content", None)
        if piece:
            yield piece


def _stream_chat(messages, temperature: float, slot: dict, timeout: float, allow_fallback: bool = True):
    """流式输出：首个字之前失败可降级重试（沿用 EXPLAIN_FALLBACK）；已出字后失败只能抛错。"""
    started = False
    try:
        for piece in _stream_iter(messages, temperature, slot, timeout):
            started = True
            yield piece
    except Exception:
        if started or not allow_fallback or not EXPLAIN_FALLBACK:
            raise
        is_plain_ark = slot["provider"] == "ark" and not slot["thinking"]
        if is_plain_ark:
            raise
        fb = {"provider": "ark", "model": "doubao-seed-2-1-turbo-260628", "thinking": False}
        for piece in _stream_iter(messages, temperature, fb, timeout):
            yield piece


def follow_up_stream(question: str, result: dict | None, history: list | None,
                     followup: str, mode: str = "deep"):
    """讲解追问：深思想走讲解位（reasoner 等），快答走批改位（chat）。生成器 yield 文本片。"""
    q = (followup or "").strip()
    if not q:
        raise ValueError("问题为空")
    if MOCK:
        yield from _mock_pieces(_MOCK_FOLLOWUP)
        return
    fast = str(mode or "deep").lower() == "fast"
    slot = JUDGE_SLOT if fast else EXPLAIN_SLOT
    timeout = 150 if fast else 300
    messages = _followup_messages(question, result, history, q)
    yield from _stream_chat(messages, temperature=0.3, slot=slot, timeout=timeout, allow_fallback=not fast)


def reteach_stream(question: str, result: dict | None, angle: str = "basic"):
    """换个讲法：按指定角度重讲一遍（避开原讲解思路），生成器 yield 文本片。"""
    guide = RETEACH_ANGLES.get(str(angle or "basic").lower(), RETEACH_ANGLES["basic"])
    if MOCK:
        yield from _mock_pieces(_MOCK_RETEACH)
        return
    prompt = (RETEACH_PROMPT + _result_context(question, result)
              + RETEACH_TAIL + guide + RETEACH_TAIL2)
    yield from _stream_chat([{"role": "user", "content": prompt}], temperature=0.5,
                            slot=EXPLAIN_SLOT, timeout=300)


# ---------------------------------------------------------------- 变式题 / 相似题（批次2）

VARIANT_STRATEGIES = {
    "same_point": "换一个生活场景或应用背景，但考察**完全相同**的知识点与解题方法。",
    "change_data": "保留题目的结构与解题方法，只把数据/参数换掉（数字、字母、区间、系数）。",
    "change_angle": "换个问法：原题是「求结果」，新题改成「已知结果反求条件」，或反过来。",
    "change_type": "换题型：计算题↔证明题↔选择题↔填空题，考察同一知识点。",
}

VARIANT_PROMPT = """你是大学理工科教师，要基于一道原题生成**变式题**（用于举一反三练习）。

变式要求：
1. 必须考察与原题**同一知识点**，难度相当或略作变化，不要超纲。
2. 答案唯一明确、便于自动判分；解析要讲清思路，让学生看懂「为什么」。
3. 严禁照抄原题；数字、情境或问法必须有实质变化。
4. 数学表达式用 LaTeX（行内 $...$，独立公式 $$...$$）。

只输出 JSON，格式：
{"items": [
  {"question": "变式题题干",
   "answer": "参考答案",
   "analysis": "解析（讲清思路）",
   "knowledge_points": ["知识点1"],
   "question_type": "计算题/证明题/选择题/填空题"}
]}
"""

_MOCK_VARIANT = {
    "items": [
        {
            "question": r"计算定积分 $\int_0^2 x^2\,dx$。（Mock 变式题）",
            "answer": r"$\frac{8}{3}$",
            "analysis": r"原函数为 $\frac{x^3}{3}$，代入上下限得 $\frac{8}{3}-0=\frac{8}{3}$。",
            "knowledge_points": ["定积分", "牛顿-莱布尼茨公式"],
            "question_type": "计算题",
        },
        {
            "question": r"计算定积分 $\int_1^3 (2x+1)\,dx$。（Mock 变式题）",
            "answer": r"$12$",
            "analysis": r"$\int (2x+1)dx = x^2+x$，代入得 $(9+3)-(1+1)=12$。",
            "knowledge_points": ["定积分", "幂函数积分"],
            "question_type": "计算题",
        },
    ]
}


def generate_variant(question: str, answer: str = "", subject: str = "",
                     strategy: str = "same_point", count: int = 1) -> dict:
    """生成变式题；返回 {"items": [...]}。count 由调用方限制上限。"""
    strat = VARIANT_STRATEGIES.get(str(strategy or "same_point").lower())
    if strat is None:
        strat = VARIANT_STRATEGIES["same_point"]
    if MOCK:
        return {"items": _MOCK_VARIANT["items"][:max(1, min(int(count or 1), 2))]}

    prompt = (VARIANT_PROMPT
              + f"\n\n变式策略：{strat}"
              + f"\n\n需要生成 {max(1, int(count or 1))} 道。")
    if subject.strip():
        prompt += "\n\n学科：" + subject.strip()
    prompt += "\n\n原题：\n" + (question or "").strip()[:1200]
    if answer.strip():
        prompt += "\n\n原题参考答案（新题不要照抄）：\n" + answer.strip()[:600]

    # 出题不需要深度推理：用批改位（更快更省）
    text = chat_text([{"role": "user", "content": prompt}], temperature=0.7, slot=JUDGE_SLOT)
    data = extract_json(text)
    items = data.get("items")
    if not isinstance(items, list) or not items:
        # 模型偶尔直接返回单题对象
        if data.get("question"):
            items = [data]
        else:
            raise ValueError("生成失败，请重试")
    out = []
    for it in items:
        if not isinstance(it, dict) or not it.get("question"):
            continue
        out.append({
            "question": it.get("question", ""),
            "answer": it.get("answer", ""),
            "analysis": it.get("analysis", ""),
            "knowledge_points": it.get("knowledge_points") or [],
            "question_type": it.get("question_type", ""),
            "strategy": str(strategy or "same_point"),
        })
    if not out:
        raise ValueError("生成失败，请重试")
    return {"items": out}


# ---------------------------------------------------------------- AI 对话（批次2）

CHAT_PROMPT = """你是「知一」里的学习助手，面向大学生（以理工科为主）。

回答要求：
1. 直接回答，不寒暄；结论先给，再给理由或步骤。
2. 数学表达式用 LaTeX（行内 $...$，独立公式 $$...$$）；代码用 markdown 代码块并标注语言。
3. 若提供了「引用的学习内容」，只能把它当作背景参考，**不得编造引用里没有的信息**；
   引用内容与问题无关时，明确指出并正常回答。
4. 不确定或超出你能力范围时，直接说明，不要硬编。
5. 回答保持精炼：能三句话说清就不要写成小论文；确实需要展开时才分点。
"""

_MOCK_CHAT = """这是**演示回答**（当前未配置模型 Key，走的是内置 Mock）。

配置好 ARK_API_KEY / DEEPSEEK_API_KEY 后，这里会返回真实模型的多轮回答，交互（流式、停止、重新生成、引用范围）保持不变。

一般来说我会这样回答你：
1. 先给结论；
2. 再给理由或推导步骤（必要时用 LaTeX 写公式）；
3. 最后补一句容易踩的坑或可以继续追问的方向。"""


def _chat_context_text(context: list | None) -> str:
    if not context:
        return ""
    lines = []
    for c in context[:8]:
        if not isinstance(c, dict):
            continue
        title = str(c.get("title") or "").strip()[:200]
        brief = str(c.get("brief") or "").strip()[:60]
        if title:
            lines.append(f"- {title}" + (f"（{brief}）" if brief else ""))
    if not lines:
        return ""
    return "\n\n【引用的学习内容】\n" + "\n".join(lines)


def chat_messages(messages: list | None, context: list | None):
    """把前端历史（{role,text}）转成模型消息，并注入引用内容。"""
    out = [{"role": "system", "content": CHAT_PROMPT + _chat_context_text(context)}]
    for m in (messages or [])[-12:]:
        if not isinstance(m, dict):
            continue
        role = "assistant" if m.get("role") == "assistant" else "user"
        text = str(m.get("text") or "").strip()
        if not text:
            continue
        out.append({"role": role, "content": text[:4000]})
    if len(out) == 1:
        out.append({"role": "user", "content": "（无内容）"})
    return out


def chat_stream(messages: list | None, context: list | None):
    """AI 对话：生成器 yield 文本片。"""
    if MOCK:
        yield from _mock_pieces(_MOCK_CHAT)
        return
    yield from _stream_chat(chat_messages(messages, context), temperature=0.35,
                            slot=JUDGE_SLOT, timeout=180)


# ---------------------------------------------------------------- 学情分析（批次4）

ANALYZE_PROMPT = """你是大学理工科的学习教练。下面给出某位学生错题本的**聚合摘要**（不是全部题目）。

请基于摘要给出可执行的复习建议，要求：
1. 只依据摘要里出现的信息，不要编造学生没做过的题或没出现过的知识点。
2. 指出最该优先补的薄弱点（最多 5 个），每个都要说清「为什么弱」和「具体怎么做」。
3. 归纳错因类型（最多 4 类），每类给一条改进办法。
4. 语气直接、具体，不要空话（避免「多练习」「要细心」这类无信息量的建议）。
5. summary 用两句话总结当前最该做的一件事。

只输出 JSON：
{"weak_points": [{"name": "知识点", "why": "为什么弱（基于给的数据）", "advice": "具体怎么做"}],
 "reason_advice": [{"type": "错因类型", "advice": "改进办法"}],
 "summary": "两句话总结"}
"""

_MOCK_ANALYZE = {
    "weak_points": [
        {"name": "定积分", "why": "练习 9 次只对 3 次，是全库正确率最低的知识点",
         "advice": "先把「找原函数」练熟：每天 3 道纯求原函数的题，再回到定积分；重点核对上下限代入。"},
        {"name": "换元积分法", "why": "错题集中在换元后忘记改积分限",
         "advice": "固定写三步：设 u → 换限 → 再积分，把换限写在草稿最上面，不要留到最后。"},
    ],
    "reason_advice": [
        {"type": "计算失误", "advice": "每题写完后单独用 30 秒回代验证，尤其是上下限代入这一步。"},
        {"type": "方法选择错误", "advice": "做完题回头补一句「为什么用这个方法」，积累 10 条后你会发现套路有限。"},
    ],
    "summary": "当前最该做的一件事：把定积分的复测安排在本周内完成，先把「求原函数 + 代入上下限」练到不用想。",
}


def analyze_errorbook(summary: dict | None, sample_questions: list | None = None) -> dict:
    """错题本聚合摘要 → 薄弱点与错因建议。只传聚合数据，不传题目全文（省 token）。"""
    if MOCK:
        return json.loads(json.dumps(_MOCK_ANALYZE))
    payload = summary if isinstance(summary, dict) else {}
    lines = []
    lines.append("错题总数：%s，已掌握：%s" % (payload.get("total", 0), payload.get("mastered", 0)))
    for pt in (payload.get("points") or [])[:12]:
        if not isinstance(pt, dict):
            continue
        lines.append("知识点「%s」：错题 %s 道，练习 %s 次，对 %s 次，已掌握 %s 道" % (
            pt.get("name", ""), pt.get("total", 0), pt.get("quiz", 0),
            pt.get("correct", 0), pt.get("mastered", 0),
        ))
    for rs in (payload.get("reasons") or [])[:8]:
        if isinstance(rs, dict):
            lines.append("错因「%s」：%s 次" % (rs.get("type", ""), rs.get("count", 0)))
    for i, q in enumerate((sample_questions or [])[:5]):
        text = str(q or "").strip()[:120]
        if text:
            lines.append("样例题%d：%s" % (i + 1, text))
    prompt = ANALYZE_PROMPT + "\n\n【摘要】\n" + "\n".join(lines)
    # 归纳类任务不需要深度推理，用批改位（快、便宜）
    text = chat_text([{"role": "user", "content": prompt}], temperature=0.3, slot=JUDGE_SLOT, timeout=150)
    data = extract_json(text)
    weak = [w for w in (data.get("weak_points") or []) if isinstance(w, dict) and w.get("name")]
    reasons = [r for r in (data.get("reason_advice") or []) if isinstance(r, dict) and r.get("type")]
    if not weak and not reasons:
        raise ValueError("分析失败，请重试")
    return {
        "weak_points": weak[:5],
        "reason_advice": reasons[:4],
        "summary": str(data.get("summary") or "")[:400],
    }
