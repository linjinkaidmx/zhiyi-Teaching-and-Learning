# -*- coding: utf-8 -*-
"""数据模型定义"""
from typing import List
from pydantic import BaseModel, Field

ERROR_TYPES = ["概念理解错误", "计算失误", "审题偏差", "方法错误", "知识盲区"]

# 分析结果模式：
#   diagnose - 图中存在学生作答痕迹，做错因定位与诊断
#   solve    - 图中仅有题目本身，做完整解答与知识点讲解
#   invalid  - 未能识别到有效题目
ANALYZE_MODES = ("diagnose", "solve", "invalid")


class AnalyzeResult(BaseModel):
    """统一的题目分析结果

    同一个模型调用根据图片内容自动切换模式：
    - diagnose 模式会填充 student_answer / error_* 等诊断字段
    - solve    模式侧重 solution_steps / key_insight / knowledge_explanation
    所有字段均带默认值，确保任一模式下缺失字段都不会破坏接口契约。
    """

    mode: str = Field("solve", description="diagnose | solve | invalid")
    has_student_answer: bool = Field(False, description="图中是否检测到学生作答痕迹")
    subject: str = Field("", description="学科，如 高等数学")
    question: str = Field("", description="题目原文")
    knowledge_points: List[str] = Field(default_factory=list, description="关联知识点")

    # ---- diagnose 模式专用 ----
    student_answer: str = Field("", description="学生作答原文")
    correct_answer: str = Field("", description="正确答案")
    error_step: int = Field(0, description="错误发生的步骤序号，无法定位时为 0")
    error_type: str = Field("", description="错因类型")
    error_analysis: str = Field("", description="错因分析")

    # ---- 通用输出 ----
    solution_steps: List[str] = Field(default_factory=list, description="正确分步解答")
    key_insight: str = Field("", description="解题关键 / 突破口")
    knowledge_explanation: str = Field("", description="涉及知识点的系统讲解")
    related_points: List[str] = Field(default_factory=list, description="延伸知识点")
    tip: str = Field("", description="invalid 模式下的提示语")


# 历史命名保持兼容
DiagnoseResult = AnalyzeResult


# ---- 自测判分 ----

JUDGE_VERDICTS = ("correct", "partial", "wrong")


class JudgeRequest(BaseModel):
    """自测判分请求"""

    question: str = Field("", description="题目原文")
    correct_answer: str = Field("", description="标准答案")
    user_answer: str = Field("", description="用户在自测中填写的答案")


class JudgeResult(BaseModel):
    """自测判分结果

    verdict:
        correct  - 结论正确且关键步骤无误（允许书写格式差异）
        partial  - 思路正确但结论有误，或局部出错
        wrong    - 完全答错、答非所问、空白
    """

    verdict: str = Field("wrong", description="correct | partial | wrong")
    comment: str = Field("", description="针对本次作答的一句点评")
    key_mistake: str = Field("", description="若判为错误，指出最关键的一处问题")


class JudgeResp(BaseModel):
    """判分接口响应"""

    success: bool
    data: JudgeResult | None = None
    error: str | None = None


class ApiResp(BaseModel):
    """统一接口响应"""

    success: bool
    data: AnalyzeResult | None = None
    error: str | None = None
