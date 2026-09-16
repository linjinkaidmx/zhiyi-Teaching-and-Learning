# -*- coding: utf-8 -*-
"""知一 · 错题诊断后端服务"""
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import DiagnoseResult, ApiResp
from service import diagnose_image, ArkError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zhiyi")

app = FastAPI(
    title="知一 · 错题诊断 API",
    description="基于火山方舟多模态模型的错题识别与错因诊断服务",
    version="0.1.0",
)

# 开发阶段放开跨域，前端可直连调试
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@app.get("/api/health")
def health():
    """健康检查"""
    return {"status": "ok", "service": "zhiyi"}


@app.post("/api/diagnose", response_model=ApiResp)
async def diagnose(file: UploadFile = File(...)):
    """上传错题图片，返回结构化诊断结果"""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"仅支持图片格式：{', '.join(ALLOWED_TYPES)}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="图片不能超过 10MB")

    try:
        result = diagnose_image(data)
    except ArkError as e:
        logger.error("诊断失败: %s", e)
        return ApiResp(success=False, error=str(e))
    except Exception as e:
        logger.exception("未预期的错误")
        return ApiResp(success=False, error=f"诊断失败: {e}")

    return ApiResp(success=True, data=result)
