# -*- coding: utf-8 -*-
"""数据模型定义"""
from typing import List
from pydantic import BaseModel, Field

ERROR_TYPES = ["概念理解错误", "计算失误", "审题偏差", "方法错误", "知识盲区"]


class DiagnoseResult(BaseModel):
    """单道错题的诊断结果"""

    subject: str = Field(..., description="学科，如 高等数学")
    knowledge_points: List[str] = Field(default_factory=list, description="关联知识点")
    question: str = Field(..., description="题目原文")
    student_answer: str = Field(..., description="学生作答原文")
    correct_answer: str = Field(..., description="正确答案")
    error_step: int = Field(0, description="错误发生的步骤序号，无法定位时为 0")
    error_type: str = Field(..., description="错因类型")
    error_analysis: str = Field(..., description="错因分析")
    solution_steps: List[str] = Field(default_factory=list, description="正确分步解析")


class ApiResp(BaseModel):
    """统一接口响应"""

    success: bool
    data: DiagnoseResult | None = None
    error: str | None = None
