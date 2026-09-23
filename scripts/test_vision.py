# -*- coding: utf-8 -*-
"""最小验证：错题图片 -> 多模态模型 -> 结构化错因诊断 JSON

用法（PowerShell）:
  $env:ARK_API_KEY="你的key"
  python test_vision.py
"""
import os
import re
import json
import base64
from openai import OpenAI

BASE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(BASE, "sample.png")
API_KEY = os.environ.get("ARK_API_KEY", "")

MODEL = "doubao-seed-2-1-pro-260915"
BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"

PROMPT = """你是高校数学助教。请分析这张错题图片，完成错因诊断。

请严格按以下 JSON 格式输出，不要输出任何多余文字：
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

其中 error_type 必须是以下之一：概念理解错误 / 计算失误 / 审题偏差 / 方法错误 / 知识盲区
error_step 是错误发生的步骤序号（整数）。
"""


def main():
    if not API_KEY:
        raise SystemExit("请先设置环境变量 ARK_API_KEY")
    if not os.path.exists(IMG):
        raise SystemExit(f"找不到图片 {IMG}，请先运行 make_sample.py")

    with open(IMG, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    client = OpenAI(api_key=API_KEY, base_url=BASE_URL, timeout=180)
    resp = client.chat.completions.create(
        model=MODEL,
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

    text = resp.choices[0].message.content
    print("===== 模型原始输出 =====")
    print(text)

    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        data = json.loads(m.group())
        print("\n===== 解析后的 JSON =====")
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print("\n[警告] 未能解析出 JSON，需要优化 Prompt")


if __name__ == "__main__":
    main()
