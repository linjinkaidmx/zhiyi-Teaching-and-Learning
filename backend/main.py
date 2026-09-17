# -*- coding: utf-8 -*-
"""知一 · 错题诊断后端服务

支持两种运行形态：
1. 仅 API 模式（无 dist 目录）：uvicorn main:app --port 8000
2. 前后端一体化模式（存在前端构建产物）：同一端口同时提供页面与 API，
   天然同源，规避浏览器 HTTPS 混合内容拦截，零 Nginx 配置即可上线。
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from schemas import DiagnoseResult, ApiResp, JudgeRequest, JudgeResp
from service import diagnose_image, judge_answer, ArkError
from auth import router as account_router
from forum import router as forum_router
from group import router as group_router

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


# 账号 / 错题同步 / 论坛 / 学习小组（数据库模块，不依赖 AI）
app.include_router(account_router)
app.include_router(forum_router)
app.include_router(group_router)


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


@app.post("/api/judge", response_model=JudgeResp)
async def judge(req: JudgeRequest):
    """自测判分：比对用户作答与标准答案

    verdict 取值 correct / partial / wrong，除 wrong 之外均视为通过。
    """
    try:
        result = judge_answer(req)
    except ArkError as e:
        logger.error("判分失败: %s", e)
        return JudgeResp(success=False, error=str(e))
    except Exception as e:
        logger.exception("判分时发生未预期的错误")
        return JudgeResp(success=False, error=f"判分失败: {e}")

    return JudgeResp(success=True, data=result)


# ---------------------------------------------------------------------------
# 前端静态托管（放在所有 API 路由之后，保证 /api/* 优先匹配）
# ---------------------------------------------------------------------------
def _resolve_static_dir() -> Path | None:
    """定位前端构建产物目录，支持环境变量 ZHIYI_STATIC_DIR 覆盖。"""
    candidates = []
    env_dir = os.getenv("ZHIYI_STATIC_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    base = Path(__file__).resolve().parent
    candidates += [
        base / "static",
        base.parent / "frontend" / "dist",
        base.parent / "dist",
    ]
    for p in candidates:
        if p.is_dir() and (p / "index.html").exists():
            return p
    return None


STATIC_DIR = _resolve_static_dir()
if STATIC_DIR:
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    logger.info("已挂载前端静态目录: %s", STATIC_DIR)
else:
    logger.info("未发现前端构建产物，以纯 API 模式运行")
