# -*- coding: utf-8 -*-
"""火山方舟多模态诊断服务"""
import os
import re
import json
import base64

from openai import OpenAI
from dotenv import load_dotenv

from schemas import (
    AnalyzeResult,
    ERROR_TYPES,
    ANALYZE_MODES,
    JudgeRequest,
    JudgeResult,
    JUDGE_VERDICTS,
)

load_dotenv()

ARK_API_KEY = os.getenv("ARK_API_KEY", "")
ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
ARK_MODEL = os.getenv("ARK_MODEL", "doubao-seed-2-1-pro-260915")


class ArkError(Exception):
    """方舟调用异常"""


PROMPT = """你是高校理工科助教。请分析这张题目图片，先判断它的类型，再给出相应结果。

【第一步：判断题图类型】
- 图中既有「题目」，又有「学生的作答、演算过程或教师批改痕迹」→ mode 填 "diagnose"
- 图中只有题目本身，没有任何作答痕迹 → mode 填 "solve"
- 图中没有可识别的题目（如风景、人像、无关的纯文字）→ mode 填 "invalid"

【第二步：严格按以下 JSON 输出，不要输出任何多余文字】
{
  "mode": "diagnose",
  "has_student_answer": true,
  "subject": "高等数学",
  "question": "题目原文",
  "knowledge_points": ["知识点1", "知识点2"],
  "student_answer": "学生作答原文",
  "correct_answer": "正确答案",
  "error_step": 3,
  "error_type": "计算失误",
  "error_analysis": "错在哪一步、为什么会错",
  "solution_steps": ["步骤1", "步骤2", "步骤3"],
  "key_insight": "本题的解题关键与突破口",
  "knowledge_explanation": "核心知识点的系统讲解，帮助举一反三",
  "related_points": ["延伸知识点1", "延伸知识点2"],
  "tip": "mode 为 invalid 时说明未识别到的原因"
}

【规则】
- 数学表达式必须用 $...$ 包裹的 LaTeX 书写，例如 $y = C_1 e^{2x}$、$\\frac{a}{b}$、$\\sqrt{2}$、$r^2 - 3r + 2 = 0$
- 禁止使用 Unicode 数学字母（如 𝑥 𝑦 ℝ）与 Unicode 上下标（如 C₁ e²），下标一律写 C_1，上标一律写 e^{2x}
- 纯中文叙述部分不要加 $，只有真正的数学表达式才包裹
- error_type 必须是以下之一：概念理解错误 / 计算失误 / 审题偏差 / 方法错误 / 知识盲区
  （solve 与 invalid 模式下填空字符串）
- error_step 为整数，表示错误发生在第几步；无法定位则填 0
- solution_steps 必须给出完整且可直接看懂的求解过程，每步独立成项，含关键推导
- key_insight 用一到两句话点明解题关键，不要复述步骤
- knowledge_explanation 讲清定义、适用条件与常见用法，控制在 60-150 字
- related_points 给 2-4 个与本题相关的延伸知识点或常见题型
- 即便 mode 为 diagnose，也必须完整填写 solution_steps / key_insight /
  knowledge_explanation / related_points
- 所有字段都必须存在；缺失的字符串填空字符串，缺失的数组填空数组
"""


def _extract_json(text: str) -> dict:
    """从模型输出中提取 JSON（兼容模型输出前后带说明文字的情况）"""
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ArkError("模型未返回 JSON 格式内容")
    try:
        return json.loads(m.group())
    except json.JSONDecodeError as e:
        raise ArkError(f"JSON 解析失败: {e}")


def _normalize(data: dict) -> dict:
    """矫正模型输出，保证模式合法且关键字段在受控范围内"""
    # 模式无效时，按是否存在作答痕迹推断
    if data.get("mode") not in ANALYZE_MODES:
        data["mode"] = "diagnose" if data.get("has_student_answer") else "solve"

    if data["mode"] == "diagnose":
        data["has_student_answer"] = True
        # 错因类型不在约定范围内时归为「知识盲区」
        if data.get("error_type") not in ERROR_TYPES:
            data["error_type"] = "知识盲区"
    else:
        data["error_type"] = ""

    try:
        data["error_step"] = int(data.get("error_step") or 0)
    except (TypeError, ValueError):
        data["error_step"] = 0
    return data


def analyze_image(image_bytes: bytes) -> AnalyzeResult:
    """输入图片字节，输出分析结果（错题诊断 / 题目解答 自动二选一）"""
    if not ARK_API_KEY:
        raise ArkError("未配置 ARK_API_KEY，请检查 .env 文件")

    b64 = base64.b64encode(image_bytes).decode()
    client = OpenAI(api_key=ARK_API_KEY, base_url=ARK_BASE_URL, timeout=180)

    try:
        resp = client.chat.completions.create(
            model=ARK_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": PROMPT},
                ],
            }],
            temperature=0.2,
        )
    except Exception as e:
        raise ArkError(f"调用方舟接口失败: {e}")

    text = resp.choices[0].message.content or ""
    data = _normalize(_extract_json(text))

    try:
        return AnalyzeResult(**data)
    except Exception as e:
        raise ArkError(f"分析结果校验失败: {e}")


# 历史命名保持兼容
diagnose_image = analyze_image


JUDGE_PROMPT = """你是高校理工科阅卷老师。下面给出一道题的「题目」「标准答案」和「学生作答」，请判断学生答得对不对。

题目：
{question}

标准答案：
{correct_answer}

学生作答：
{user_answer}

【判定规则】
- correct：最终结论正确，且关键步骤或表达式没有实质性错误。
  允许书写格式差异（如 C₁ 写成 C1、e^x 写成 exp(x)、空格与换行不同、等价变形），
  只要数学含义相同就算对。
- partial：思路方向正确但结论错了，或者只有部分正确（如求两个特征值只对了一个、
  过程对但最后一步算错数值）。
- wrong：完全答错、答非所问、明显把题目理解错了，或者空白。

【注意】
- 学生作答若是描述思路而非完整计算，只要思路正确且结论正确，仍判 correct。
- 标准答案为空时，请你依据题目自行推断正确答案再判。
- 不要臆造学生作答里没有的内容。

【输出】严格按以下 JSON 输出，不要任何多余文字：
{{
  "verdict": "correct",
  "comment": "一到两句中文点评，肯定正确之处或指出问题所在，不超过 80 字",
  "key_mistake": "若判为 partial 或 wrong，指出最关键的一处错误；判为 correct 时填空字符串"
}}

【记号规范】
- comment 与 key_mistake 中的数学表达式用 $...$ 包裹的 LaTeX 书写，如 $C_2 e^{{3x}}$
- 禁止 Unicode 数学字母（𝑥 ℝ）与 Unicode 上下标（C₁ e²），下标写 C_1，上标写 e^{{2x}}
- 纯中文叙述不加 $
"""


def judge_answer(req: JudgeRequest) -> JudgeResult:
    """自测判分：比对用户作答与标准答案"""
    if not ARK_API_KEY:
        raise ArkError("未配置 ARK_API_KEY，请检查 .env 文件")
    if not req.user_answer.strip():
        # 空白作答无需调用模型，直接判定，省时省钱
        return JudgeResult(verdict="wrong", comment="你没有填写答案。", key_mistake="作答为空")

    prompt = JUDGE_PROMPT.format(
        question=req.question or "（未提供题目）",
        correct_answer=req.correct_answer or "（未提供标准答案，请自行推断）",
        user_answer=req.user_answer,
    )
    client = OpenAI(api_key=ARK_API_KEY, base_url=ARK_BASE_URL, timeout=120)

    try:
        resp = client.chat.completions.create(
            model=ARK_MODEL,
            messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
            temperature=0.1,
        )
    except Exception as e:
        raise ArkError(f"调用方舟接口失败: {e}")

    text = resp.choices[0].message.content or ""
    data = _extract_json(text)

    data["verdict"] = str(data.get("verdict", "wrong")).strip().lower()
    if data["verdict"] not in JUDGE_VERDICTS:
        # 模型偶有输出中文，做一次兜底映射
        mapping = {"正确": "correct", "部分正确": "partial", "错误": "wrong"}
        data["verdict"] = mapping.get(data.get("verdict"), "wrong")
    data["comment"] = str(data.get("comment", ""))[:200]
    data["key_mistake"] = str(data.get("key_mistake", ""))[:200]
    if data["verdict"] == "correct":
        data["key_mistake"] = ""

    try:
        return JudgeResult(**data)
    except Exception as e:
        raise ArkError(f"判分结果校验失败: {e}")
