"""AI 教学老师 · 模型调用层（2026-10-09）

与 `teach.py`（纯逻辑）分离：这里只负责 prompt 组装与模型调用，
输出一律交给 `teach.normalize_*` 做钳位与兜底。

prompt 里全是 LaTeX 与 JSON 花括号 → **禁用 .format()**，占位符用 `__TOKEN__` 替换。
"""
import teach

import service

TEACH_SLOT = service._slot("TEACH", "doubao-seed-2-1-turbo-260628", "0")
TEACH_CHAT_SLOT = service._slot("TEACH_CHAT", "doubao-seed-2-1-turbo-260628", "0")


def _fill(tpl: str, **kv) -> str:
    out = tpl
    for k, v in kv.items():
        out = out.replace("__%s__" % k.upper(), str(v))
    return out


SYLLABUS_PROMPT = """你是大学理工科的课程讲师，正在为学生把一门课拆成「章 → 小节」两级教学大纲。

学科：__SUBJECT__
__EXTRA__
要求：
1. 输出 4~6 个大章，每章 3~5 个小节，总小节数 __WANT__ 个左右；按教学顺序排列（先基础后进阶，由浅入深，前后有承接）。
2. 小节粒度是「一节课」：能在一轮里讲透（定义 + 原理 + 易错 + 1 个例题 + 1 道考试题）。
3. 小节之间不要重叠，不要出现「综合练习」「总复习」「本章总结」这类空泛项——章末总结由系统自动生成。
4. 章的 brief 用一句话说清这一章在整门课里的位置（不超过 30 字）；小节 brief 用一句话说清解决什么问题（不超过 30 字）。
5. 每一章的小节必须真正属于这一章的主题，不要为凑数把不相关的小节塞进来。
6. 只输出 JSON，不要任何解释性文字。

只输出 JSON：
{"chapters": [{"name": "章名", "brief": "一句话定位",
  "sections": [{"name": "小节名", "brief": "一句话说明"}]}]}"""


LECTURE_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。教学风格：__TEACHER_STYLE__

学科：__SUBJECT__
本轮要讲的知识点（**只讲这一个**）：__KP_NAME__
这个知识点的定位：__KP_BRIEF__
__LEVEL_HINT____WRONG_HINT__
严格遵守教学模式，一轮只输出这一个知识点的固定三段结构：

① 知识点内容：给清晰定义、核心原理、易错提醒，语言通俗、把概念讲透。
   - 出现符号（如 lim、Σ、∂、O 记号）必须单独解释含义，并区分容易混淆的概念（放在 symbols / confused_with）。
② 配套例题：简短，附完整解题/证明过程；**每一步都要标注依据**（写出具体用到的定理、公式或方法名称，例：依据=洛必达法则），用来演示这个知识点怎么用。
   并写 analysis：这段解法的「知识点应用分析」——这题考的什么、为什么第一步这么想、整个思路串起来依赖哪个核心条件、最容易在哪一步走偏（3~5 句，80~200 字）。
③ 考试题：针对当前知识点的练习题，留给学生自己作答。

题型要求（能在选择题里考出核心考点的，就出选择题）：
- 出选择题（type=choice）：概念定义、定理条件辨析、易错点判断、符号含义、公式选择、结论正误判断。给 4 个选项，干扰项必须是针对本知识点典型错法的合理错误（不是凑数的胡话），answer_key 填正确选项字母。
  **并给每个错误选项写一条 distractor_reasons**：why 用一句话说清「这个选项为什么看起来对、实际错在哪」（20~60 字，直接点破典型误区）。
- 必须出文字题（type=text）：需要推导/证明（如 ε-δ 论证）、多步计算（选项无法定位错在哪一步）、构造反例或举例。
- 用 type_reason 一句话说明为什么这样选题型。

其他要求：
- 数学公式用 LaTeX：行内 $...$，独立公式 $$...$$；不要输出 HTML。
- example.steps 3~6 步；exam.points 给出参考评分点（文字题用，用于批改对照）。
- 不要输出第二个知识点，不要写「下面我们讲下一个」之类的话。

只输出 JSON（不要解释文字，不要 markdown 围栏）：
{"kp": {"name": "", "definition": "", "principle": "", "pitfalls": [""],
        "symbols": [{"sym": "", "meaning": ""}],
        "confused_with": [{"a": "", "b": "", "diff": ""}]},
 "example": {"question": "", "steps": [{"title": "", "detail": "", "basis": ""}], "answer": "", "analysis": ""},
 "exam": {"type": "choice", "question": "", "options": [{"key": "A", "text": ""}],
          "answer_key": "A", "reference_answer": "", "points": [{"point": "", "score": 0}],
          "distractor_reasons": [{"key": "", "why": ""}],
          "type_reason": ""}}"""


GRADE_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。教学风格：__TEACHER_STYLE__

你刚给学生留了一道针对知识点「__KP_NAME__」的考试题，学生提交了作答，现在批改。

题目：__QUESTION__
参考答案：__REFERENCE__
评分点：__POINTS__
学生作答：__ANSWER__

批改要求（严格遵守）：
1. 先拆评分点：把这道题拆成 3~5 个可核查的评分点，写进 point_results（上面给了「评分点」就沿用，不够就补）。
   每项给 point（评分点）、hit（学生是否拿到，布尔）、got（实得分）、max（该点满分）、
   evidence（学生作答里对应的原文片段；学生没写到这一点就写「未涉及」）。
   各项 max 之和 = 100，got 不得超过 max。
2. 判分：score 必须等于 point_results 各项 got 之和——系统会按这个数核对，不要另给一个笼统印象分。
   数值/表达式不同但数学等价要判对；方法不同于参考答案但推理自洽也算对；结论错但关键思路对、只差一步或计算失误 → verdict=partial。
   correct → score 85~100；partial → 40~84；wrong → 0~39（答非所问、空白、方向性错误）。
3. 详细解析：逐点说明对在哪、错在哪（step_feedback）。
4. 找到错误根源（root_cause）：不是重复「你算错了」，而是说清是哪一步的哪个概念/条件/方法选择出了问题。若学生没写过程，从答案特征反推最可能的根源，并说明这是推测。
5. 举反例辅助理解（counterexample）：给一个能戳破这个错误认识的简短反例或极端情形；答对时给一个容易踩坑的变形，仍填在 counterexample 字段。
6. 语气像老师：直接、具体、不喷人、不轻浮、不空洞（禁止「多练习」「要细心」这类废话）。
7. 公式用 LaTeX（行内 $...$）。

只输出 JSON：
{"verdict": "correct|partial|wrong", "score": 0, "comment": "两三句话的总评",
 "point_results": [{"point": "评分点", "hit": true, "got": 30, "max": 30, "evidence": "学生作答里的对应原文"}],
 "step_feedback": ["第几步 对/错 + 为什么"],
 "error_point": "错在哪一步/哪个点（答对则留空）",
 "root_cause": "错误根源（答对则写这道题的易错提醒）",
 "counterexample": "反例或易踩坑的变形"}"""


EXAMPLE_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。教学风格：__TEACHER_STYLE__

学科：__SUBJECT__，知识点：__KP_NAME__（__KP_BRIEF__）
讲义要点：__KP_CONTEXT__

只补一道配套例题：简短、能演示这个知识点怎么用，附完整解题过程，
每一步标注依据（写出具体用到的定理/公式/方法名，例：依据=洛必达法则）。
并写 analysis：知识点应用分析——这题考的什么、为什么第一步这么想、思路串起来依赖的核心条件、最容易在哪一步走偏（3~5 句）。
公式用 LaTeX（行内 $...$）。3~6 步。

只输出 JSON（不要解释文字，不要 markdown 围栏）：
{"example": {"question": "", "steps": [{"title": "", "detail": "", "basis": ""}], "answer": "", "analysis": ""}}"""


ASK_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。教学风格：__TEACHER_STYLE__

你正在给学生讲知识点「__KP_NAME__」，当前的讲义要点：
__KP_CONTEXT__

当前知识点的考试题是：__EXAM_QUESTION__

学生提出了疑问：__QUESTION__

要求：
1. 先正面回答学生问的那个点，不要重复整份讲义。
2. 讲具体、有依据；公式用 LaTeX（行内 $...$，独立公式 $$...$$）。
3. 学生问到相邻、前置或延伸概念（哪怕不在这个知识点范围内）是正常的学习疑问：先用一两句话
把他问的那个概念讲清楚，再点出它和当前知识点的关系，最后回到考试题。禁止说「关系不大」
「不在这个知识点范围」「先聚焦当前内容」这类把问题挡回去的话——不能给学生的好奇心泼冷水。
4. 篇幅 100~400 字，不要写成小作文。不要反问学生额外的问题。
5. 结尾用一句话自然地把学生带回当前的考试题（例如「弄明白这点，回头看那道题就有思路了」）。
直接输出回答文本，不要 JSON、不要 markdown 围栏。"""


PLAIN_LECTURE_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。教学风格：__TEACHER_STYLE__

学科：__SUBJECT__，这一讲只讲一个知识点：__KP_NAME__（__KP_BRIEF__）。

请用纯文本（不要 JSON、不要 markdown 围栏）输出两部分：
第一部分：用通俗语言讲透这个知识点——定义、核心原理、易错提醒，出现符号要解释含义；公式用 LaTeX（行内 $...$）。300~600 字。
第二部分：另起一行，以「题：」开头，针对这个知识点写一道让学生自己作答的题（只写题干，不要给答案）。"""


# ---------------- 章节化改造（2026-10-10）：逐项分析 / 章末总述 / 单元测试 ----------------

EXAM_ANALYSIS_PROMPT = """你是大学理工科的课程讲师。学生刚做完一道选择题，你已批改完毕，现在给**逐选项解析**。

知识点：__KP_NAME__
题目：__QUESTION__
选项：
__OPTIONS__
正确答案：__ANSWER_KEY__
参考解析：__REFERENCE__
学生的选择：__CHOSEN__

要求：
1. per_option：对**每一个选项**（包括正确项和所有错误项）各给一条：key 填选项字母；verdict 填 "right"（正确项）或 "wrong"（错误项）；why 用 1~2 句说清「这个选项为什么对/为什么看着对实际错在哪」（错误项要点破典型误区，正确项要说清它为什么成立，不许只写「这是正确答案」）。
2. kps：这道题考查的知识点（1~3 个，用小节里的知识点名，具体到条件/方法层面）。
3. 公式用 LaTeX（行内 $...$）。语气像老师讲评，直接、具体、不空洞。
4. 只输出 JSON，不要解释文字，不要 markdown 围栏。

只输出 JSON：
{"per_option": [{"key": "A", "verdict": "right|wrong", "why": "..."}], "kps": ["知识点1", "知识点2"]}"""


CHAPTER_SUMMARY_PROMPT = """你是大学理工科的课程讲师「__TEACHER_NAME__」。学生刚学完「__SUBJECT__」的「__CHAPTER_NAME__」一章，你来做章末总述。

本章各小节要点（自动汇总，供你串联，不要照抄）：
__SECTIONS__

要求：
1. 用 150~250 字把整章的知识脉络串起来：各小节之间是什么关系（递进/并列/互为工具）、主线是什么、学完这一章应该具备什么能力。
2. 点出 1~2 个本章最容易全局性犯错的认知（跨小节的，不是单节内的易错）。
3. 语气像老师做章末收束，直接说结论，不要寒暄。公式用 LaTeX（行内 $...$）。
4. 直接输出正文文本，不要 JSON、不要 markdown 围栏、不要标题。"""


UNIT_GEN_PROMPT = """你是大学理工科的课程讲师，正在为「__CHAPTER_NAME__」这一章出单元测试的**新综合题**。

本章已学小节：__SECTIONS__
已有题目（不用重复出）：__EXISTING__

要求：
1. 出 1~2 道**跨小节综合题**：把本章至少两个小节的知识串起来考（例如「先用 A 的判定再用 B 的方法求解」）。
2. 能用选择题考的就出选择题（type=choice，4 个选项，干扰项针对典型错法，answer_key 填正确字母）；需要推导/多步计算的出文字题（type=text，给 reference_answer 与 3~4 个评分点 points，各项 score 之和 100）。
3. 难度与本章小节考试题持平或略高，不出超纲题。
4. 公式用 LaTeX（行内 $...$）。只输出 JSON，不要解释文字，不要 markdown 围栏。

只输出 JSON：
{"items": [{"kp": "综合·涉及的知识点", "exam": {"type": "choice", "question": "", "options": [{"key": "A", "text": ""}], "answer_key": "A", "reference_answer": "", "points": [{"point": "", "score": 0}]}}]}"""


_MOCK_SYLLABUS = {"chapters": [
    {"name": "极限基础", "brief": "从直观到严格，打下求极限的地基",
     "sections": [
         {"name": "函数与极限的概念", "brief": "理解极限的直观含义与存在条件"},
         {"name": "极限的四则运算", "brief": "掌握极限运算的基本法则"},
         {"name": "等价无穷小替换", "brief": "用等价无穷小快速求极限"},
     ]},
    {"name": "求极限的方法", "brief": "处理各类未定式的核心工具箱",
     "sections": [
         {"name": "洛必达法则", "brief": "处理 0/0 与 无穷/无穷 型未定式"},
         {"name": "泰勒展开求极限", "brief": "用泰勒展开处理高阶未定式"},
     ]},
]}

_MOCK_EXAM_ANALYSIS = {
    "per_option": [
        {"key": "A", "verdict": "right",
         "why": "$\\frac{\\sin x}{x}$ 是经典 $\\frac00$ 型未定式，满足洛必达条件，求导后得 $\\frac{\\cos x}{1}\\to1$，可以用。"},
        {"key": "B", "verdict": "wrong",
         "why": "$\\frac{x^2+1}{x+2}$ 在 $x\\to0$ 时分子趋于 1、分母趋于 2，不是未定式，直接代入得 $\\frac12$；套洛必达反而算错。"},
        {"key": "C", "verdict": "right",
         "why": "$\\frac{\\ln x}{x}$ 是 $\\frac\\infty\\infty$ 型，洛必达同样适用（很多人误以为只有 $\\frac00$ 型才行）。"},
        {"key": "D", "verdict": "right",
         "why": "$\\frac{e^x-1}{x}$ 是标准 $\\frac00$ 型，正是 $e^x-1\\sim x$ 的来源，可用洛必达或等价替换。"},
    ],
    "kps": ["洛必达法则的适用条件", "未定式的类型判断"],
}

_MOCK_CHAPTER_SUMMARY = (
    "这一章把「未定式求极限」的两件主工具串了起来：洛必达负责把 0/0、∞/∞ 化成可代入的形式，"
    "等价无穷小负责乘除因子的快速替换。主线是——先判断类型，再挑工具，最后验证条件。"
    "最容易犯的全局性错误有二：一是见到分式就想求导，忘了洛必达只对未定式成立；"
    "二是替换与求导混用在了加减项上。学完这章，你应该能对任意一元极限先分类、再选路。"
)

_MOCK_LECTURE = {
    "kp": {
        "name": "洛必达法则",
        "definition": "当 $x\\to a$ 时，若 $f(x)$ 与 $g(x)$ 都趋于 0（或都趋于无穷），"
                      "且两者在去心邻域内可导、$g'(x)\\neq 0$，则 "
                      "$\\lim\\limits_{x\\to a}\\frac{f(x)}{g(x)}=\\lim\\limits_{x\\to a}"
                      "\\frac{f'(x)}{g'(x)}$（右端存在或为无穷时成立）。",
        "principle": "本质是用导数刻画函数在一点附近的相对变化速度，把未定式化成可直接代入的形式。",
        "pitfalls": ["不是未定式就套洛必达会算错", "用一次后仍是未定式要重新确认类型", "分母导数不能为 0"],
        "symbols": [{"sym": "lim", "meaning": "极限符号：自变量趋近某值时函数值趋近的目标"}],
        "confused_with": [{"a": "洛必达法则", "b": "等价无穷小替换",
                           "diff": "前者靠求导、只适用于 0/0 或 无穷/无穷；后者靠替换、只适用于乘除因子"}],
    },
    "example": {
        "question": "求极限 $\\lim\\limits_{x\\to 0}\\frac{e^x-1-x}{x^2}$。",
        "steps": [
            {"title": "判断类型", "detail": "分子分母在 $x\\to0$ 时都趋于 0，属于 $\\frac00$ 型未定式。",
             "basis": "未定式定义"},
            {"title": "第一次洛必达", "detail": "化为 $\\lim\\limits_{x\\to0}\\frac{e^x-1}{2x}$，仍是 $\\frac00$ 型。",
             "basis": "洛必达法则"},
            {"title": "第二次洛必达", "detail": "化为 $\\lim\\limits_{x\\to0}\\frac{e^x}{2}=\\frac12$。",
             "basis": "洛必达法则"},
        ],
        "answer": "$\\frac12$",
        "analysis": "这题考的是「连续使用洛必达前必须重新确认类型」。第一步先判断 0/0 型，"
                    "这是整个方法的入场券；每求导一次后未定式可能消失，所以第二次求导前要再验一次。"
                    "最容易走偏的地方：把「洛必达可以连用」当成无条件成立，跳过类型复查直接算到底。",
    },
    "exam": {
        "type": "choice",
        "question": "下列极限中，不能直接使用洛必达法则的是？",
        "options": [
            {"key": "A", "text": "$\\lim\\limits_{x\\to0}\\frac{\\sin x}{x}$"},
            {"key": "B", "text": "$\\lim\\limits_{x\\to0}\\frac{x^2+1}{x+2}$"},
            {"key": "C", "text": "$\\lim\\limits_{x\\to\\infty}\\frac{\\ln x}{x}$"},
            {"key": "D", "text": "$\\lim\\limits_{x\\to0}\\frac{e^x-1}{x}$"},
        ],
        "answer_key": "B",
        "reference_answer": "B",
        "distractor_reasons": [
            {"key": "A", "why": "$\\frac{\\sin x}{x}$ 是经典的 $\\frac00$ 型，洛必达或重要极限都能求，看起来眼熟就以为不能用，其实可以。"},
            {"key": "C", "why": "$\\frac{\\ln x}{x}$ 是 $\\frac\\infty\\infty$ 型，很多人忘了这也是未定式，误以为只有 $\\frac00$ 才能套。"},
            {"key": "D", "why": "$\\frac{e^x-1}{x}$ 是标准 $\\frac00$ 型，且正好是 $e^x-1\\sim x$ 的来源，看似特殊实则可用。"},
        ],
        "points": [{"point": "判断是否未定式", "score": 100}],
        "type_reason": "考察适用条件（必须先是不定式），适合用选项辨析。",
    },
}

_MOCK_GRADE = {
    "verdict": "partial",
    "score": 60,
    "comment": "思路方向对，但少检查了一次未定式类型，第二次洛必达前的条件没说明。",
    "step_feedback": ["判断类型正确", "第一次洛必达后未说明仍是 0/0 型"],
    "error_point": "未验证第二次洛必达的适用条件",
    "root_cause": "把「洛必达可以连续使用」当成无条件成立，忽略了每一步都要重新确认未定式类型。",
    "counterexample": "对 $\\lim\\limits_{x\\to0}\\frac{x+1}{x+2}$ 并非未定式，若套洛必达会得到与真实极限不同的结果。",
    "point_results": [
        {"point": "识别为 0/0 型未定式", "hit": True, "got": 30, "max": 30,
         "evidence": "学生写了「代入得 0/0」"},
        {"point": "第一次洛必达求导正确", "hit": True, "got": 25, "max": 25,
         "evidence": "求导步骤正确"},
        {"point": "第二次使用前重新确认未定式类型", "hit": False, "got": 0, "max": 30,
         "evidence": "未涉及"},
        {"point": "得出最终极限值", "hit": False, "got": 5, "max": 15,
         "evidence": "结论写错"},
    ],
}


def _chat_json(prompt: str, temperature: float, slot: dict, timeout: float,
               retries: int = 1) -> dict:
    """要 JSON 的调用：解析失败自动重试（第二次降到低温 + 强调输出格式）。

    `service.extract_json` 在彻底解析失败时**抛 ValueError**（不是返回空 dict），
    长 LaTeX 讲义偶发踩中 → 这里统一兜住，避免一次抖动就把整讲打掉。
    """
    last = None
    for attempt in range(retries + 1):
        p = prompt
        if attempt:
            p += ("\n\n注意：上一次输出不是合法 JSON。请只输出一个 JSON 对象；"
                  "字符串内部不要出现未转义的换行与反斜杠（LaTeX 反斜杠要写成双反斜杠），"
                  "不要输出任何解释文字或 markdown 围栏。")
        try:
            text = service.chat_text([{"role": "user", "content": p}],
                                     temperature=temperature if not attempt else max(0.1, temperature - 0.2),
                                     slot=slot, timeout=timeout)
            return service.extract_json(text)
        except Exception as e:      # 含 JSON 解析失败与网络抖动
            last = e
            continue
    raise last if last else ValueError("模型调用失败")


def _fallback_lecture(subject: str, kp_name: str, kp_brief: str, teacher: dict) -> dict:
    """最终降级：改用「纯文本两段」的简版 prompt（不要 JSON），服务端包装成讲义结构。

    宁可给学生一份朴素但可读的讲义 + 一道文字题，也不让整讲打不开。
    """
    plain_prompt = _fill(PLAIN_LECTURE_PROMPT,
                         teacher_name=teacher.get("name") or "老师",
                         teacher_style=teacher.get("style") or "",
                         subject=subject, kp_name=kp_name,
                         kp_brief=kp_brief or "（按学科常识把握）")
    text = service.chat_text([{"role": "user", "content": plain_prompt}],
                             temperature=0.3, slot=TEACH_SLOT, timeout=180)
    text = (text or "").strip()
    if not text:
        raise ValueError("讲义降级生成也失败")
    # 约定简版输出：第一部分讲解，第二部分以「题：」开头
    q = ""
    body = text
    if "题：" in text:
        body, q = text.split("题：", 1)
        q = q.strip()
    return teach.normalize_lecture({
        "kp": {
            "name": kp_name,
            "definition": body.strip()[:1500],
            "principle": "",
            "pitfalls": [],
            "symbols": [],
            "confused_with": [],
        },
        "example": {},
        "exam": {
            "type": "text",
            "question": q or ("请用自己的话讲一遍「%s」的核心思路，并举一个能用到它的例子。" % kp_name),
            "reference_answer": "",
            "points": [{"point": "概念说清 + 会用", "score": 100}],
            "type_reason": "讲义降级模式，出文字题让学生自述",
        },
    })


def gen_syllabus(subject: str, teacher: dict | None = None, course_hint: str = "",
                 level_hint: str = "", want: int = 16) -> tuple:
    """生成两级大纲（章 × 节）→ (chapters, items)。

    chapters=[{name, brief, count}]（节就是 items 本身，按章分组，kp_index 语义不变）；
    items=[{name, brief}] 是按「章→节」重排后的平铺小节。生成失败降级为旧式平铺单章。"""
    if service.MOCK:
        data = dict(_MOCK_SYLLABUS)
    else:
        extra = []
        if course_hint:
            extra.append("课程信息：" + str(course_hint)[:200])
        if level_hint:
            extra.append("难度定位：" + str(level_hint)[:200])
        prompt = _fill(SYLLABUS_PROMPT, subject=subject, want=int(want or 16),
                       extra=("\n".join(extra) + "\n") if extra else "")
        try:
            data = _chat_json(prompt, 0.4, TEACH_SLOT, 150, retries=1)
        except Exception:
            data = {}
    # 优先吃 chapters 树；模型若退化输出平铺 items → 全部节归入单章兜底
    raw_chapters = _as_list_safe(data.get("chapters"))
    synth = [{"name": str(s.get("name") or ""), "brief": str(s.get("brief") or "")}
             for ch in raw_chapters if isinstance(ch, dict)
             for s in (ch.get("sections") or []) if isinstance(s, dict) and s.get("name")]
    if raw_chapters:
        chapters, items = teach.normalize_chapters(raw_chapters, synth)
    else:
        items = teach.normalize_syllabus(data, subject=subject, want=want)
        if not items:
            raise ValueError("大纲生成失败，请重试")
        chapters, items = teach.normalize_chapters(
            [{"name": subject or "全部内容", "brief": "", "sections": items}], items)
    if not items:
        raise ValueError("大纲生成失败，请重试")
    return chapters, items


def _as_list_safe(v) -> list:
    if isinstance(v, list):
        return v
    return []


def gen_exam_analysis(exam: dict, chosen: str, grade_comment: str, kp_name: str) -> dict:
    """批改后逐选项分析（选择题专用；结果由调用方缓存，同题不二次花钱）。"""
    if service.MOCK:
        return teach.normalize_option_analysis(_MOCK_EXAM_ANALYSIS, exam)
    opts = "\n".join("%s．%s" % (o.get("key"), o.get("text"))
                     for o in (exam.get("options") or []))
    prompt = _fill(EXAM_ANALYSIS_PROMPT,
                   kp_name=str(kp_name or "本知识点"),
                   question=str(exam.get("question") or "")[:800],
                   options=opts,
                   answer_key=str(exam.get("answer_key") or ""),
                   reference=str(exam.get("reference_answer") or "")[:400],
                   chosen=str(chosen or "（未选）"))
    raw = _chat_json(prompt, 0.3, TEACH_SLOT, 120, retries=1)
    return teach.normalize_option_analysis(raw, exam)


def gen_chapter_summary(subject: str, chapter_name: str, sections: list, teacher: dict) -> str:
    """章末总述：把各节要点串成脉络（各节要点拼接由调用方完成，这里只生成总述一段）。"""
    if service.MOCK:
        return _MOCK_CHAPTER_SUMMARY
    secs = "\n".join("· %s：%s" % (s.get("kp") or s.get("name"), (s.get("definition") or s.get("principle") or "")[:120])
                     for s in (sections or [])[:8])
    prompt = _fill(CHAPTER_SUMMARY_PROMPT,
                   teacher_name=(teacher or {}).get("name") or "老师",
                   teacher_style=(teacher or {}).get("style") or "",
                   subject=str(subject or ""), chapter_name=str(chapter_name or ""),
                   sections=secs or "（无）")
    text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.4,
                             slot=TEACH_SLOT, timeout=120)
    return (text or "").strip()[:600] or "这一章的主线：先把各小节的适用条件分清，再按条件挑工具。建议回到薄弱小节再过一遍例题。"


def gen_unit_items(chapter_name: str, sections: list, existing: list) -> list:
    """单元测试的新综合题（1~2 道）。失败返回空 → 调用方降级为纯复用组卷。"""
    if service.MOCK:
        return [{"origin": "new", "kp": "综合·未定式判定+方法选择",
                 "exam": {
                     "type": "choice",
                     "question": "下列哪个极限的求解过程「先用等价无穷小替换、再用洛必达」顺序是合法的？",
                     "options": [
                         {"key": "A", "text": "$\\frac{\\sin x \\cdot \\ln(1+x)}{x^2}$（$x\\to0$）"},
                         {"key": "B", "text": "$\\frac{e^x-1-\\sin x}{x}$（$x\\to0$）"},
                         {"key": "C", "text": "$\\frac{\\tan x - x}{x^3}$（$x\\to0$）"},
                         {"key": "D", "text": "$\\frac{\\ln(1+x)+x}{x}$（$x\\to0$）"},
                     ],
                     "answer_key": "A",
                     "reference_answer": "A",
                     "points": [{"point": "乘除因子可替换、加减不能", "score": 100}],
                 }}]
    secs = "；".join(str(s.get("name") or "")[:30] for s in (sections or [])[:8])
    exist = "；".join(str(q)[:60] for q in (existing or [])[:8])
    prompt = _fill(UNIT_GEN_PROMPT, chapter_name=str(chapter_name or ""),
                   sections=secs or "（无）", existing=exist or "（无）")
    try:
        raw = _chat_json(prompt, 0.4, TEACH_SLOT, 150, retries=1)
    except Exception:
        return []
    items = teach.normalize_unit_paper((raw or {}).get("items") or [], chapter_name)
    return [it for it in items if it.get("exam", {}).get("question")]


def gen_lecture(subject: str, kp_name: str, kp_brief: str = "", teacher: dict | None = None,
                level_hint: str = "", wrong_hint: str = "") -> dict:
    """生成当前知识点的三段讲义（已钳位为单个知识点）。

    三级兜底：严格 JSON（含一次重试）→ 纯文本简版 → 抛错（前端提示重来）。
    """
    teacher = teacher or {}
    if service.MOCK:
        data = dict(_MOCK_LECTURE)
        out = teach.normalize_lecture(data)
    else:
        lvl = ("难度定位：" + str(level_hint)[:200] + "\n") if level_hint else ""
        wh = ("\n这个学生以前在这一块踩过坑：" + str(wrong_hint)[:200] + "\n") if wrong_hint else ""
        prompt = _fill(LECTURE_PROMPT,
                       teacher_name=teacher.get("name") or "老师",
                       teacher_style=teacher.get("style") or "",
                       subject=subject, kp_name=kp_name,
                       kp_brief=kp_brief or "（按学科常识把握）",
                       level_hint=lvl, wrong_hint=wh)
        out = None
        try:
            out = teach.normalize_lecture(_chat_json(prompt, 0.35, TEACH_SLOT, 180, retries=1))
        except Exception:
            out = None
        if not out or not (out["kp"].get("definition") or out["kp"].get("principle")) \
                or not out["exam"].get("question"):
            try:
                return _fallback_lecture(subject, kp_name, kp_brief, teacher)
            except Exception:
                raise ValueError("讲义生成失败，请重试")
    if not (out["kp"].get("definition") or out["kp"].get("principle")) or not out["exam"].get("question"):
        raise ValueError("讲义生成不完整，请重试")
    # 例题缺失兜底（2026-10-09 评测：第4讲曾直接上屏「（无例题）」）——单独补一次小生成
    if not str(out["example"].get("question") or "").strip():
        ex = _regen_example(subject, kp_name, kp_brief, teacher,
                            str(out["kp"].get("definition") or out["kp"].get("principle") or "")[:300])
        if ex.get("question"):
            out["example"] = ex
    return out


def gen_lecture_stream(subject: str, kp_name: str, kp_brief: str = "", teacher: dict | None = None,
                       level_hint: str = "", wrong_hint: str = ""):
    """三段讲义的「字段级流式」版本（讲课时逐字段冒字，别让用户干等）。

    事件协议与 service.json_field_stream 一致：
      {"field","delta"} / {"field_done"} / {"done": True, "result": <规范化讲义>}
      {"fallback": True, "reason": ...}   首 token 前失败 → 调用方降级为一次性 gen_lecture
      {"error": ...}                      已出字后失败（如实报错）
    MOCK 下直接给完整结果（不模拟逐字）。
    """
    teacher = teacher or {}
    if service.MOCK:
        yield {"done": True, "result": teach.normalize_lecture(dict(_MOCK_LECTURE))}
        return

    lvl = ("难度定位：" + str(level_hint)[:200] + "\n") if level_hint else ""
    wh = ("\n这个学生以前在这一块踩过坑：" + str(wrong_hint)[:200] + "\n") if wrong_hint else ""
    prompt = _fill(LECTURE_PROMPT,
                   teacher_name=teacher.get("name") or "老师",
                   teacher_style=teacher.get("style") or "",
                   subject=subject, kp_name=kp_name,
                   kp_brief=kp_brief or "（按学科常识把握）",
                   level_hint=lvl, wrong_hint=wh)

    for ev in service.json_field_stream(prompt, 0.35, TEACH_SLOT, 180):
        if ev.get("error"):
            if ev.get("partial"):
                yield ev                       # 已经冒字了，只能如实报错
            else:
                yield {"fallback": True, "reason": ev.get("error")}
            return
        if ev.get("done"):
            try:
                out = teach.normalize_lecture(ev.get("result") or {})
            except Exception as e:
                yield {"fallback": True, "reason": f"讲义规范化失败：{e}"}
                return
            if not (out["kp"].get("definition") or out["kp"].get("principle")) or not out["exam"].get("question"):
                yield {"fallback": True, "reason": "讲义不完整"}
                return
            yield {"done": True, "result": out}
            return
        yield ev


def _regen_example(subject: str, kp_name: str, kp_brief: str, teacher: dict, kp_ctx: str) -> dict:
    """讲义没生成例题时单独补一道（小 prompt，约 1/4 次讲义成本）；失败返回空，由前端隐藏卡片。"""
    if service.MOCK:
        return dict((teach.normalize_lecture(dict(_MOCK_LECTURE))["example"]))
    prompt = _fill(EXAMPLE_PROMPT, teacher_name=teacher.get("name") or "老师",
                   teacher_style=teacher.get("style") or "", subject=subject,
                   kp_name=kp_name, kp_brief=kp_brief or "（按学科常识把握）", kp_context=kp_ctx)
    try:
        raw = _chat_json(prompt, 0.4, TEACH_SLOT, 90, retries=0)
        return teach.normalize_example(raw.get("example") if isinstance(raw, dict) else raw)
    except Exception:
        return {}


def grade_text_answer(question: str, reference: str, points: list, user_answer: str,
                      kp_name: str = "", teacher: dict | None = None) -> dict:
    """文字题批改：对错 + 逐点 + 根源 + 反例（规则⑥）。空答案短路，不调模型。"""
    if not str(user_answer or "").strip():
        return {"verdict": "wrong", "score": 0,
                "comment": "没有作答。先回到上面的例题，照着「每步依据」的思路写一遍再来。",
                "step_feedback": [], "error_point": "未作答",
                "root_cause": "空答案无法诊断，先动笔写出你认为的第一步。",
                "counterexample": "", "point_results": []}
    teacher = teacher or {}
    if service.MOCK:
        return dict(_MOCK_GRADE)
    pts = "；".join("%s（%s 分）" % (p.get("point"), p.get("score"))
                   for p in (points or [])[:6] if isinstance(p, dict)) or "（无）"
    prompt = _fill(GRADE_PROMPT,
                   teacher_name=teacher.get("name") or "老师",
                   teacher_style=teacher.get("style") or "",
                   kp_name=kp_name or "本知识点", question=question,
                   reference=reference or "（无参考答案，凭学科常识判断）",
                   points=pts, answer=str(user_answer)[:2000])
    text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.2,
                             slot=service.JUDGE_SLOT, timeout=180)
    grade = teach.normalize_grade(service.extract_json(text))
    # #6 判分自校验（2026-10-09）：wrong 且 <20 分 → 独立复核一次取宽，防演示时误判答对的学生
    try:
        if grade.get("verdict") == "wrong" and float(grade.get("score") or 0) < 20:
            re_prompt = (prompt + "\n\n（复核）刚才第一次批改把你判成了 wrong 且低于 20 分。"
                         "请完全独立地重新批改一次，不要受这个结果影响。特别注意：数值/表达式不同但数学等价要判对，"
                         "方法不同于参考答案但推理自洽也算对，结论对只是步骤有缺口应给 partial。"
                         "如果你仍然认为答错了，保持 wrong；如果第一次判重了，请按实际给分。")
            text2 = service.chat_text([{"role": "user", "content": re_prompt}], temperature=0.2,
                                      slot=service.JUDGE_SLOT, timeout=180)
            g2 = teach.normalize_grade(service.extract_json(text2))
            if float(g2.get("score") or 0) > float(grade.get("score") or 0):
                g2["rechecked"] = True
                return g2
    except Exception:
        pass                                    # 复核失败不影响首次结果
    return grade


def ask(question: str, kp_name: str, kp_context: str, exam_question: str,
        teacher: dict | None = None) -> str:
    """学生疑问解答（解答完把学生带回当前考试题）。"""
    teacher = teacher or {}
    if service.MOCK:
        return ("（演示回答）这一步的关键是先把适用条件确认清楚，条件不满足就不能套公式。"
                "弄明白这点，回头看那道题就有思路了。")
    prompt = _fill(ASK_PROMPT,
                   teacher_name=teacher.get("name") or "老师",
                   teacher_style=teacher.get("style") or "",
                   kp_name=kp_name or "本知识点",
                   kp_context=str(kp_context)[:1200],
                   exam_question=str(exam_question)[:400],
                   question=str(question)[:600])
    text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.5,
                             slot=TEACH_CHAT_SLOT, timeout=120)
    return (text or "").strip()[:1200] or "这个问题我还没想好怎么讲清楚，你换个说法再问一次？"
