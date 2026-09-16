# -*- coding: utf-8 -*-
"""火山方舟多模态诊断服务"""
import os
import re
import json
import base64

from openai import OpenAI
from dotenv import load_dotenv

from schemas import DiagnoseResult, ERROR_TYPES

load_dotenv()

ARK_API_KEY = os.getenv("ARK_API_KEY", "")
ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
ARK_MODEL = os.getenv("ARK_MODEL", "doubao-seed-2-1-pro-260915")


class ArkError(Exception):
    """方舟调用异常"""


PROMPT = """你是高校理工科助教，请分析这张错题图片并完成错因诊断。

严格按以下 JSON 格式输出，不要输出任何多余文字：
{
  "subject": "学科",
  "knowledge_points": ["知识点1", "知识点2"],
  "question": "题目原文",
  "student_answer": "学生作答原文",
  "correct_answer": "正确答案",
  "error_step": 3,
  "error_type": "计算失误",
  "error_analysis": "一句话说明错在哪、为什么错",
  "solution_steps": ["正确步骤1", "正确步骤2"]
}

规则：
- error_type 必须是以下之一：概念理解错误 / 计算失误 / 审题偏差 / 方法错误 / 知识盲区
- error_step 为整数，表示错误发生在第几步；若无法定位则填 0
- solution_steps 给出完整的正确求解步骤
- 所有字段都必须存在
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


def diagnose_image(image_bytes: bytes) -> DiagnoseResult:
    """输入图片字节，输出结构化诊断结果"""
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
    data = _extract_json(text)

    # 兜底：错因类型不在约定范围内时归为「知识盲区」
    if data.get("error_type") not in ERROR_TYPES:
        data["error_type"] = "知识盲区"

    try:
        return DiagnoseResult(**data)
    except Exception as e:
        raise ArkError(f"诊断结果校验失败: {e}")
