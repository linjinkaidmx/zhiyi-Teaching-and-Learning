"""知一 MVP 后端。业务接口（extract/explain/judge）+ 账号体系 + 错题本云同步。

同源部署：单 uvicorn 进程同时 serve 前端静态页（dist）与 API，根除跨域/混合内容问题。
"""
import hashlib
import json
import logging
import base64
import os
try:
    import resource
except ImportError:  # Windows 本地开发无此模块：沙箱仅靠 RUN_TIMEOUT 兜底
    resource = None
import random
import re
import subprocess
import sys
import tempfile
import asyncio
import threading
import time as _t
import uuid
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

import auth
import bank
import db
import textmath
import service
import quiz_pick
import teach
import teach_llm
from schemas import (
    AdminResetRequest,
    ClassExportRequest,
    GradeTaskRequest,
    GroupStreamRequest,
    ChangePasswordRequest,
    CommentRequest,
    CreateGroupRequest,
    CreatePostRequest,
    DebugRequest,
    DeleteAccountRequest,
    DeletePostRequest,
    ExplainRequest,
    ExtractRequest,
    FeedbackRequest,
    FollowUpRequest,
    ForumCommentsRequest,
    ForumDetailRequest,
    ForumListRequest,
    GenerateQuizRequest,
    GeneratePaperRequest,
    JudgePaperRequest,
    GroupDetailRequest,
    GroupInviteRequest,
    GroupMessagesRequest,
    GroupRemoveMemberRequest,
    GroupSendRequest,
    JoinGroupRequest,
    TeacherApplyRequest,
    ClassCreateRequest,
    ClassJoinRequest,
    HomeworkCreateRequest,
    HomeworkListRequest,
    HomeworkDetailRequest,
    HomeworkSubmitRequest,
    HomeworkSubmissionsRequest,
    HomeworkGradeRequest,
    HomeworkReportRequest,
    HomeworkPushRequest,
    HomeworkImageRequest,
    HomeworkAssignImagesRequest,
    ClassNoteCreateRequest,
    ClassNoteListRequest,
    ClassNoteIdRequest,
    ClassTestCreateRequest,
    ClassTestGenerateRequest,
    ClassTestListRequest,
    ClassTestIdRequest,
    ClassTestSubmitRequest,
    CompanionChatRequest,
    CompanionHistoryRequest,
    CompanionPrefRequest,
    CompanionQuizRequest,
    CompanionAsrRequest,
    CompanionSessionListRequest,
    CompanionSessionCreateRequest,
    CompanionSessionRenameRequest,
    CompanionSessionDeleteRequest,
    CustomCompanionCreateRequest,
    CustomCompanionDeleteRequest,
    CustomAiGenRequest,
    CustomAiSaveRequest,
    CustomAiUpdateRequest,
    TeachSyllabusRequest,
    TeachStartRequest,
    TeachAnswerRequest,
    TeachAskRequest,
    TeachNextRequest,
    TeachEditRequest,
    TeachChapterRequest,
    TeachChapterAnswerRequest,
    TeachExamAnalysisRequest,
    LikeRequest,
    VariantRequest,
    ChatStreamRequest,
    AnalyzeRequest,
    DailyAdviceRequest,
    JudgeRequest,
    LoginRequest,
    ProfileSaveRequest,
    RecoverRequest,
    RegisterRequest,
    RenameRequest,
    ResetBackupRequest,
    ReteachRequest,
    RunRequest,
    SyncPullRequest,
    SyncPushRequest,
    VerifyRequest,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("zhiyi")

app = FastAPI(title="知一 MVP", version="0.2.0")


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError):
    """422 统一转成前端能显示的 {ok,error}（原 detail 数组前端只会显示"请求失败"）"""
    fields = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []) if str(x) != "body")
        msg = str(err.get("msg", ""))
        if loc:
            fields.append(f"字段 {loc}" if msg.startswith("Input") else f"字段 {loc}（{msg}）")
    hint = "、".join(fields) if fields else "参数格式不正确"
    return JSONResponse(status_code=422, content={"ok": False, "error": f"请求参数有误：{hint}"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    """静态资源缓存策略。

    - /assets/*（带内容哈希）→ 一年强缓存 immutable
    - HTML（index.html 与 SPA 深链回退）→ no-cache，必须回源校验
      否则浏览器会启发式缓存旧 index.html，导致**发新版后用户看不到更新**（实测踩过）。
    """
    resp = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/"):
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.startswith("/companions/walk/"):
        # 行走序列帧(walkdep13):URL 带 ?v= 版本号,更新靠改版本号失效,可安全一年强缓存。
        # 旧版无缓存头 → 浏览器启发式缓存≈0,回访也要逐帧重验证,加重"行走降级"窗口
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.startswith("/companions/"):
        # 伴学资产：URL 带 ?v= 版本号 → 一年强缓存 immutable（与 walkdep13 行走帧同惯例）；
        # 无版本号（历史 URL / 兜底）→ no-cache 回源校验，防止换版后旧图存活（实测踩过）。
        # 2026-10-08：立绘/差分改 .webp?v=1 后整体走强缓存，进页 0 重下。
        if request.url.query.startswith("v="):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    elif str(resp.headers.get("content-type", "")).startswith("text/html"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


# ---------------------------------------------------------------- A3：gzip 压缩

# SSE 流式接口豁免压缩：gzip 会缓冲小块数据，破坏"打字机"逐字输出效果
SSE_PATHS = {
    "/api/chat/stream",
    "/api/explain/stream",
    "/api/follow-up/stream",
    "/api/reteach/stream",
}


class SafeGZipMiddleware(GZipMiddleware):
    """带路径豁免的 gzip 中间件（其余行为与官方一致）。"""

    def __init__(self, app, exclude_paths=(), **kwargs):
        super().__init__(app, **kwargs)
        self._exclude = frozenset(exclude_paths)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path") in self._exclude:
            await self.app(scope, receive, send)
        else:
            await super().__call__(scope, receive, send)


app.add_middleware(SafeGZipMiddleware, minimum_size=1024, exclude_paths=SSE_PATHS)


# HTML 入口禁启发式缓存：index.html 引用的 bundle/素材带版本号，
# 若浏览器缓存旧 index.html 会拿旧引擎请求已淘汰的资源（错配=压扁+破图）。
# hashed 静态资产不受影响，正常强缓存。
@app.middleware("http")
async def _no_cache_html(request, call_next):
    resp = await call_next(request)
    p = request.url.path
    if p == "/" or p.endswith(".html"):
        resp.headers.setdefault("Cache-Control", "no-cache")
    return resp


# ---------------------------------------------------------------- A1/A2：鉴权与限流

AI_DAILY_LIMIT = 100        # 登录用户：每日 AI 调用次数
AI_GUEST_DAILY_LIMIT = 3    # 游客（按 IP）：每日 AI 体验次数
RUN_WINDOW_LIMIT = 10       # 代码运行：每 IP 每分钟次数
RUN_WINDOW_SECONDS = 60

# 走 AI 模型（消耗 Key 余额）的接口：统一鉴权 + 配额
AI_PROTECTED_PATHS = frozenset({
    "/api/extract", "/api/explain", "/api/judge", "/api/debug",
    "/api/generate-quiz", "/api/generate-paper", "/api/judge-paper",
    "/api/variant", "/api/chat/stream", "/api/explain/stream",
    "/api/analyze/errorbook", "/api/follow-up/stream", "/api/reteach/stream",
})
RUN_PATH = "/api/run"


class _Quota:
    """内存限流器：日配额 + 滑动窗口。

    V1 权衡：计数存进程内存，重启清零、单进程内准确——当前量级够用，
    不为此引入 Redis/额外表。线程安全（端点在线程池中执行）。
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._daily = {}   # key -> (date_str, count)
        self._win = {}     # key -> deque[float] 时间戳

    def daily_check(self, key: str, limit: int):
        today = _t.strftime("%Y-%m-%d")
        with self._lock:
            d, n = self._daily.get(key, ("", 0))
            if d != today:
                d, n = today, 0
            return n < limit, n

    def daily_incr(self, key: str):
        today = _t.strftime("%Y-%m-%d")
        with self._lock:
            d, n = self._daily.get(key, ("", 0))
            if d != today:
                d, n = today, 0
            self._daily[key] = (d, n + 1)

    def window_allow(self, key: str, limit: int, period: float) -> bool:
        now = _t.time()
        with self._lock:
            q = self._win.setdefault(key, deque())
            while q and q[0] <= now - period:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


quota = _Quota()


def _ip_from_scope(scope: dict) -> str:
    """纯 ASGI 场景取客户端 IP（与 _client_ip 同语义）。"""
    headers = {k: v for k, v in scope.get("headers") or []}
    fwd = headers.get(b"x-forwarded-for", b"").decode("latin-1")
    if fwd:
        return fwd.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


class AIGuardMiddleware:
    """A1/A2 鉴权限流闸门（纯 ASGI 实现）。

    为什么不用 @app.middleware("http")（BaseHTTPMiddleware）：
    它包装 receive 的方式会让 StreamingResponse（SSE）的断连监听收到
    "Unexpected message received: http.request"，直接打死流式接口（实测踩坑）。

    这里在纯 ASGI 层完成：读完整 body → 鉴权/配额检查 → 拒绝则直接回 JSON；
    放行则**首次** receive 回放完整 body，后续 receive 原样透传，
    disconnect 信号照常流动，SSE 不受影响。
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        if path != RUN_PATH and path not in AI_PROTECTED_PATHS:
            return await self.app(scope, receive, send)

        # 1) 读完整请求体
        body = b""
        while True:
            msg = await receive()
            if msg["type"] != "http.request":
                break  # disconnect 等：交给下游自行处理
            body += msg.get("body", b"")
            if not msg.get("more_body", False):
                break

        # 2) 鉴权与配额
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {}
        token = payload.get("token") if isinstance(payload, dict) else ""
        profile = auth.parse_token(token) if isinstance(token, str) and token else None
        ip = _ip_from_scope(scope)

        status, err, quota_key = None, None, None
        if path == RUN_PATH:
            if not profile:
                status, err = 401, "代码运行需登录后使用，请先登录"
            elif not quota.window_allow(f"run:{ip}", RUN_WINDOW_LIMIT, RUN_WINDOW_SECONDS):
                status, err = 429, "运行太频繁了，请稍等一分钟再试"
        else:
            if profile:
                quota_key = f"user:{profile['nickname']}"
                allowed, _used = quota.daily_check(quota_key, AI_DAILY_LIMIT)
                if not allowed:
                    status, err = 429, "今日 AI 使用次数已达上限（100 次），明天再来吧"
            else:
                quota_key = f"guest:{ip}"
                allowed, _used = quota.daily_check(quota_key, AI_GUEST_DAILY_LIMIT)
                if not allowed:
                    status, err = 429, "今日 3 次免费体验已用完，注册登录后每天可使用 100 次"
        if status:
            resp = JSONResponse({"ok": False, "error": err}, status_code=status)
            await resp(scope, receive, send)
            return
        if quota_key:
            quota.daily_incr(quota_key)

        # 3) 放行：首轮回放 body，之后透传原始 receive（保住 SSE 的 disconnect 监听）
        body_sent = False

        async def replay_receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)


app.add_middleware(AIGuardMiddleware)


db.init_db()
login_limiter = auth.LoginLimiter()

# 管理员口令（sha256 无状态校验；不配置则管理员接口全部拒绝）
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()


def _admin_token() -> str:
    return hashlib.sha256((ADMIN_PASSWORD + "::zhiyiadmin::salt").encode()).hexdigest()


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


# ---------------------------------------------------------------- 账号

@app.post("/api/account/register")
def register(req: RegisterRequest):
    nickname = req.nickname.strip()
    password = req.password
    if len(nickname) < 2 or len(nickname) > 20:
        return {"ok": False, "error": "昵称长度需 2-20 位"}
    if not auth.valid_password_len(password):
        return {"ok": False, "error": "密码长度需 6-64 位"}
    if password != req.password_confirm:
        return {"ok": False, "error": "两次密码不一致"}
    if db.find_profile_by_nickname(nickname):
        return {"ok": False, "error": "该昵称已被注册，若是你的账号请直接登录，忘记密码可用备份码找回"}
    salt = auth.gen_salt()
    password_hash = auth.hash_password(password, salt)
    auth_nonce = __import__("secrets").token_hex(16)
    backup = auth.gen_backup_code()
    recovery_hash = auth.hash_password(auth.norm_backup(backup), salt)
    profile = db.create_profile(nickname, password_hash, salt, auth_nonce, recovery_hash, req.client_id.strip())
    token = auth.make_token(profile)
    return {"ok": True, "userId": nickname, "token": token, "backup": backup}


@app.post("/api/account/login")
def login(req: LoginRequest, request: Request):
    nickname = req.nickname.strip()
    ip = _client_ip(request)
    lock_msg = login_limiter.lock_msg(nickname, ip)
    if lock_msg:
        return {"ok": False, "error": lock_msg}
    profile = db.find_profile_by_nickname(nickname)
    if not profile or not auth.verify_password(req.password, profile["password_hash"], profile["salt"]):
        left = login_limiter.record_fail(nickname, ip)
        hint = f"（还可尝试 {left} 次，之后将临时锁定 15 分钟）" if 0 < left <= 2 else ""
        return {"ok": False, "error": "昵称或密码不正确" + hint}
    login_limiter.clear(nickname, ip)
    token = auth.make_token(profile)
    return {"ok": True, "userId": nickname, "token": token}


@app.post("/api/account/verify")
def verify(req: VerifyRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效"}
    return {"ok": True, "userId": profile["nickname"]}


@app.post("/api/account/change-password")
def change_password(req: ChangePasswordRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    if not auth.verify_password(req.old_password, profile["password_hash"], profile["salt"]):
        return {"ok": False, "error": "原密码不正确"}
    if not auth.valid_password_len(req.new_password):
        return {"ok": False, "error": "新密码长度需 6-64 位"}
    if req.new_password != req.password_confirm:
        return {"ok": False, "error": "两次新密码不一致"}
    salt = profile["salt"]  # 复用原盐，保持备份码 recovery_hash 有效
    password_hash = auth.hash_password(req.new_password, salt)
    auth_nonce = __import__("secrets").token_hex(16)
    updated = db.update_profile_password(profile["nickname"], password_hash, salt, auth_nonce)
    token = auth.make_token(updated)
    return {"ok": True, "token": token}


@app.post("/api/account/recover")
def recover(req: RecoverRequest):
    nickname = req.nickname.strip()
    profile = db.find_profile_by_nickname(nickname)
    if not profile or not profile.get("recovery_hash"):
        return {"ok": False, "error": "昵称或备份码不正确"}
    if not auth.verify_password(auth.norm_backup(req.backup_code), profile["recovery_hash"], profile["salt"]):
        return {"ok": False, "error": "昵称或备份码不正确"}
    if not auth.valid_password_len(req.new_password):
        return {"ok": False, "error": "新密码长度需 6-64 位"}
    if req.new_password != req.password_confirm:
        return {"ok": False, "error": "两次密码不一致"}
    salt = profile["salt"]  # 复用原盐，保持备份码 recovery_hash 有效
    password_hash = auth.hash_password(req.new_password, salt)
    auth_nonce = __import__("secrets").token_hex(16)
    updated = db.update_profile_password(nickname, password_hash, salt, auth_nonce)
    token = auth.make_token(updated)
    return {"ok": True, "userId": nickname, "token": token}


@app.post("/api/admin/account/reset-password")
def admin_reset(req: AdminResetRequest, request: Request):
    admin_token = request.headers.get("x-admin-token", "")
    if not ADMIN_PASSWORD or admin_token != _admin_token():
        return {"ok": False, "error": "仅管理员可重置密码"}
    nickname = req.nickname.strip()
    profile = db.find_profile_by_nickname(nickname)
    if not profile:
        return {"ok": False, "error": "该昵称不存在"}
    if not auth.valid_password_len(req.new_password):
        return {"ok": False, "error": "新密码长度需 6-64 位"}
    salt = profile["salt"]  # 复用原盐，保持备份码 recovery_hash 有效
    password_hash = auth.hash_password(req.new_password, salt)
    auth_nonce = __import__("secrets").token_hex(16)
    db.update_profile_password(nickname, password_hash, salt, auth_nonce)
    return {"ok": True, "msg": "密码已重置，请用新密码登录"}


# ---------------------------------------------------------------- 云同步

@app.post("/api/sync/push")
def sync_push(req: SyncPushRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    eb = db.save_errorbook(profile["nickname"], req.items)
    # 打卡/成就统计：非空才写，避免老客户端（不带 stats）把云端统计清空
    if req.stats:
        db.save_stats(profile["nickname"], req.stats)
    # 课程/知识点/课表 与 学习记录：同样「非空才写」，保持向后兼容
    if req.courses:
        try:
            db.save_courses(profile["nickname"], req.courses)
        except ValueError as e:
            return {"ok": False, "error": str(e)}
    if req.sessions:
        db.save_sessions(profile["nickname"], req.sessions)
    if req.exams:
        try:
            db.save_exams(profile["nickname"], req.exams)
        except ValueError as e:
            return {"ok": False, "error": str(e)}
    return {"ok": True, "count": len(req.items), "saved": eb["saved"], "dropped": eb["dropped"]}


@app.post("/api/sync/pull")
def sync_pull(req: SyncPullRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    items = db.load_errorbook(profile["nickname"])
    stats = db.load_stats(profile["nickname"])
    courses = db.load_courses(profile["nickname"])
    sessions = db.load_sessions(profile["nickname"])
    exams = db.load_exams(profile["nickname"])
    return {
        "ok": True, "items": items, "stats": stats, "courses": courses,
        "sessions": sessions, "exams": exams,
    }


# ---------------------------------------------------------------- 业务

@app.get("/api/health")
def health():
    def slot_info(s):
        return {"provider": s["provider"], "model": s["model"], "thinking": s["thinking"]}
    return {
        "ok": True,
        "mock": service.MOCK,
        "explain_fallback": service.EXPLAIN_FALLBACK,
        "slots": {
            "extract": slot_info(service.EXTRACT_SLOT),
            "explain": slot_info(service.EXPLAIN_SLOT),
            "judge": slot_info(service.JUDGE_SLOT),
        },
    }


@app.post("/api/extract")
def extract(req: ExtractRequest):
    try:
        data = service.analyze_image(req.image_base64, req.mime, req.mode)
        return {"ok": True, "data": data}
    except service.NoQuestionError as e:
        # 空白/无效图、或识别结果里没有有效题目（太模糊等）：友好提示，不要记成系统错误
        return {"ok": False, "error": str(e)}
    except Exception as e:
        log.exception("extract failed")
        msg = str(e)
        # 统一措辞：给用户可执行的话，不把原始异常文本漏给前端
        if "timeout" in msg.lower() or "timed out" in msg.lower():
            return {"ok": False, "error": "识别超时了，请重试一次；若仍失败，换一张更清晰、背景更简单的图。"}
        return {"ok": False, "error": "识别失败，请重试一次；若仍失败，换一张更清晰的图片，或直接输入文字。"}


@app.post("/api/explain")
def explain(req: ExplainRequest):
    if not req.question.strip():
        return {"ok": False, "error": "题目内容为空"}
    try:
        has_attempt = bool(req.attempt.strip())
        # 无作答痕迹时先查题库命中（秒答）；有痕迹需个性化错因诊断，走 AI
        if not has_attempt:
            matched, _score = bank.find_match(req.question)
            if matched:
                db.increment_bank_hit(matched["id"])
                data = dict(matched["result"])
                data["source"] = "bank"
                return {"ok": True, "data": data}
        data = service.explain_question(req.question, req.attempt, getattr(req, "depth", "standard"))
        # 自动回填题库（仅无作答痕迹的完整讲解，避免带诊断的个性化结果污染题库）
        if not has_attempt:
            try:
                bank.add_to_bank(req.question, data)
            except Exception:
                log.exception("回填题库失败（忽略）")
        return {"ok": True, "data": data}
    except Exception as e:
        log.exception("explain failed")
        return {"ok": False, "error": f"讲解生成失败：{e}"}


@app.post("/api/judge")
def judge(req: JudgeRequest):
    try:
        data = service.judge_answer(
            req.question, req.reference, req.user_answer,
            steps=req.steps, key_breakthrough=req.key_breakthrough,
            knowledge_points=req.knowledge_points,
        )
        return {"ok": True, "data": data}
    except Exception as e:
        log.exception("judge failed")
        return {"ok": False, "error": f"批改失败：{e}"}


# ---------------------------------------------------------------- 代码在线运行

MAX_CODE_LEN = 20000
RUN_TIMEOUT = 8


def _run_in_sandbox(cmd, stdin_text, cwd):
    """在资源受限的子进程中运行，防止死循环与资源滥用。"""
    kwargs = {}
    if resource is not None:  # Unix：rlimit 加固；Windows：仅超时兜底
        def set_limits():
            # CPU 5 秒；地址空间 512MB；禁止生成 core 文件
            try:
                resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
                resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
                resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            except Exception:
                pass
        kwargs["preexec_fn"] = set_limits

    return subprocess.run(
        cmd,
        input=stdin_text,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
        cwd=cwd,
        **kwargs,
    )


@app.post("/api/run")
def run_code(req: RunRequest):
    lang = (req.language or "").strip().lower()
    code = req.code or ""
    if lang not in ("python", "c"):
        return {"ok": False, "error": "暂不支持该语言（目前支持 python、c）"}
    if not code.strip():
        return {"ok": False, "error": "代码为空"}
    if len(code) > MAX_CODE_LEN:
        return {"ok": False, "error": f"代码过长（上限 {MAX_CODE_LEN} 字符）"}

    with tempfile.TemporaryDirectory() as d:
        try:
            if lang == "c":
                src = os.path.join(d, "main.c")
                exe = os.path.join(d, "main")
                with open(src, "w", encoding="utf-8") as f:
                    f.write(code)
                c = subprocess.run(
                    ["gcc", src, "-o", exe, "-std=c99", "-O0"],
                    capture_output=True, text=True, timeout=30, cwd=d,
                )
                if c.returncode != 0:
                    return {"ok": False, "error": "编译失败", "stderr": (c.stderr or "")[:2000]}
                cmd = [exe]
            else:
                src = os.path.join(d, "main.py")
                with open(src, "w", encoding="utf-8") as f:
                    f.write(code)
                cmd = [sys.executable, "-I", src]  # -I 隔离模式：忽略环境变量与用户 site

            r = _run_in_sandbox(cmd, req.stdin or "", d)
            # returncode < 0 表示被信号终止（多为 CPU/内存超限，如死循环）
            if r.returncode < 0:
                sig = -r.returncode
                if sig == 24:  # SIGXCPU
                    hint = "运行超时（CPU 时间超限，请检查是否有死循环）"
                elif sig == 9:  # SIGKILL：超时兜底或资源超限
                    hint = "运行被终止（超时或资源超限，请检查是否有死循环）"
                else:
                    hint = f"程序异常终止（信号 {sig}，可能超时或资源超限）"
                return {
                    "ok": False,
                    "error": hint,
                    "stdout": (r.stdout or "")[:4000],
                    "stderr": (r.stderr or "")[:2000],
                }
            return {
                "ok": True,
                "stdout": (r.stdout or "")[:8000],
                "stderr": (r.stderr or "")[:2000],
                "exit_code": r.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": f"运行超时（超过 {RUN_TIMEOUT} 秒，请检查是否有死循环）"}
        except FileNotFoundError:
            return {"ok": False, "error": "服务器缺少运行环境（gcc 或 python 不可用）"}
        except Exception as e:
            log.exception("run failed")
            return {"ok": False, "error": f"执行失败：{e}"}


# ---------------------------------------------------------------- 代码诊断

DEBUG_PROMPT = """你是资深编程教师。学生贴了一段代码（可能还附了报错信息），请帮他诊断问题。

要求：
1. 先判断代码的语言和意图，再定位错误。
2. 准确指出错误位置和根本原因，不要泛泛而谈。
3. 给出明确的修改建议，并输出修正后的完整代码。
4. 涉及的知识点要讲清楚，让学生真正理解「为什么错」。
5. 代码、标识符、正则、转义字符一律用反引号包裹（如 `__len__`、`1[3-9]\\d{9}`、`\\n`）或放进代码块，**不要用 $...$ 的数学公式包裹**（数学公式只用于真正的数学表达式）。

只输出 JSON，格式：
{"error_type": "错误类型（语法错误/逻辑错误/运行时错误/性能问题/其他）",
 "error_location": "错误位置（行号或代码片段）",
 "reason": "错误原因（详细解释为什么错）",
 "fix": "修改建议（怎么改）",
 "corrected_code": "修正后的完整代码（用 ```语言 包裹）",
 "knowledge_points": ["知识点1", "知识点2"],
 "tips": "避免再犯的建议"}"""


@app.post("/api/debug")
def debug(req: DebugRequest):
    if not req.code.strip():
        return {"ok": False, "error": "代码为空"}
    prompt = DEBUG_PROMPT + "\n\n代码：\n" + req.code.strip()
    if req.language.strip():
        prompt += "\n\n语言：" + req.language.strip()
    if req.error.strip():
        prompt += "\n\n报错信息：\n" + req.error.strip()
    if req.description.strip():
        prompt += "\n\n学生的问题描述：\n" + req.description.strip()
    try:
        # 用批改位（DeepSeek-chat）：快且准，适合诊断这种需要速度的场景
        text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.1, slot=service.JUDGE_SLOT)
        data = service.extract_json(text)
        return {"ok": True, "data": data}
    except Exception as e:
        log.exception("debug failed")
        return {"ok": False, "error": f"诊断失败：{e}"}


# ---------------------------------------------------------------- 伴学角色闲聊

COMPANION_DAILY_LIMIT = 20  # 登录用户每日与角色闲聊次数（独立于学习 AI 的 100 次）

# 演示期开关：设 COMPANION_UNLIMITED=1 时闲聊不限量（left 回 9999，前端不会触发超额话术）；
# 赛后把 .env 里这行删掉/置 0 即恢复 20 次/天，不用改代码。
COMPANION_UNLIMITED = (os.environ.get("COMPANION_UNLIMITED") or "").strip() == "1"

COMPANION_SYSTEM_PROMPT = """你是学习网站「知一」里的 AI 伴学角色「{name}」，人设与背景：{persona}。

聊天要求：
1. 像同龄同学一样说话，亲切自然、口语化，一次回复 1~3 句、不超过 80 字。
2. 性格要立住：自然带出人设里的说话习惯与口头禅（别每句堆砌，点到即止）。
3. 闲聊时可以像同学唠嗑一样，自然聊起人设里的出身、经历、往事小故事——一次最多带出一件，融进对话，不要生硬背设定。
4. 给用户提供情绪价值：陪伴、鼓励、加油，但别无脑夸，像真实朋友一样接话。
5. 学习问题像同学给你讲题：先用 1~2 句点破思路，再自然反问一句（「你猜下一步该干嘛」「这样说懂了吗」）确认或引导 TA 自己往下走；TA 说「直接告诉我」「别绕弯子」时，就用大白话完整讲明白（讲完顺口问一句懂了没）。
6. TA 贴一段题目原文过来，就像同桌拿到卷子：帮 TA 读题、指出题目在问什么、点一下从哪儿下手，别一上来甩标准答案。
7. 每条回复都要有对话感：接住 TA 的话尾，顺势反问或追一句，像同学聊天，不像客服。
8. 始终保持角色扮演，不要说自己是 AI 助手/模型/程序。
9. 不用 markdown、不用列表，不要刷表情符号（最多 1 个）。"""


# p20 长期印象：跨会话共享的轻量记忆（每角色一份，滚动 400 字，后台自动提炼，用户不可见）
MEMORY_EXTRACT_PROMPT = """你是学习网站「知一」的伴学角色「{name}」的记忆整理助手。下面是你与用户最近一段对话，以及你已记住的旧印象。请提炼关于这位用户的长期印象，供以后聊天时更懂 TA。

旧印象：
{old}

最近对话：
{dialog}

要求：
1. 只输出印象条目，每行一条、共 1~3 条，每条不超过 30 字，用第三人称短句（如「用户是初二学生，最近在准备月考」）。
2. 优先记录：年级/学习阶段、正在学的科目与目标、反复出现的困惑点、聊天风格偏好、重要事项（比赛/考试日期等）。
3. 与旧印象重复的内容不要重复写；没有值得记的新信息就只输出一个字：无
4. 不要输出任何解释、前缀、编号或列表符号。"""


def _extract_memory_async(uid: str, cid: str, session_id: str, name: str = "", persona: str = "") -> None:
    """后台线程把本会话最近对话提炼成几条印象，追加进该角色长期记忆（fire-and-forget，失败静默）。
    触发点：闲聊每累计 20 条消息 / 链收官。"""
    if not session_id:
        return

    def _job():
        try:
            msgs = db.companion_context(uid, cid, limit=24, session_id=session_id)
            if len(msgs) < 4:
                return
            dialog = "\n".join(
                ("用户：" if m["role"] == "user" else (name or "AI") + "：") + str(m.get("content", ""))[:200]
                for m in msgs
            )[-3000:]
            old = db.get_companion_memory(uid, cid)
            prompt = MEMORY_EXTRACT_PROMPT.format(
                name=name or "AI 伴学角色", old=old or "（暂无）", dialog=dialog)
            raw = service.chat_text([{"role": "system", "content": prompt}],
                                    temperature=0.3, slot=service.COMPANION_SLOT, timeout=60)
            text = (raw or "").strip()
            if text and text not in ("无", "（无）") and "无" not in text[:4]:
                db.append_companion_memory(uid, cid, text[:200])
        except Exception:
            log.exception("companion memory extract failed")

    threading.Thread(target=_job, daemon=True).start()


@app.post("/api/companion/chat")
def companion_chat(req: CompanionChatRequest):
    # 游客：不出 AI，走登录引导（该路径不走 AIGuard，配额独立核算）
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": "你好，我们来认识一下吧！（请登录账号或注册）"}
    msg = (req.message or "").strip()
    if not msg:
        return {"ok": False, "error": "想说什么呀？消息不能为空"}
    if len(msg) > 500:
        msg = msg[:500]
    cid = (req.character or "default").strip()[:40]
    uid = profile["nickname"]  # 曾缺失：闲聊亲密度通道每次 NameError 被吞掉，从未生效（2026-10-07 修复）

    quota_key = f"comp:{uid}"
    if COMPANION_UNLIMITED:
        allowed, used = True, 0
    else:
        allowed, used = quota.daily_check(quota_key, COMPANION_DAILY_LIMIT)
        if not allowed:
            return {"ok": False, "error": f"今天已经和 TA 聊了 {used} 次啦，明天再来聊吧~",
                    "quota_exhausted": True, "quota_kind": "chat"}
        quota.daily_incr(quota_key)

    name = (req.name or "小伙伴").strip()[:12]
    persona = (req.persona or "活泼友好的学习搭子").strip()[:600]
    sid = (req.session_id or "").strip()[:40]   # p20：会话隔离的聊天记录 id
    sys_prompt = COMPANION_SYSTEM_PROMPT.format(name=name, persona=persona)
    # p20：长期印象（跨会话共享的轻量记忆）——让 AI 在任何新对话里都带着对这位用户的了解
    mem = ""
    try:
        mem = (db.get_companion_memory(uid, cid) or "").strip()
    except Exception:
        log.exception("companion memory load failed")
    if mem:
        sys_prompt += "\n\n【你长期记得的关于这位朋友】\n" + mem[:400]
    # p17：主页求教泡找回——把待请教题目注入上下文，用户问「题目是啥」时 AI 能如实复述
    pq = (req.pending_question or "").strip()[:400]
    if pq:
        sys_prompt += ("\n\n【刚才的求教】你刚才在主页向用户请教了这道题：「" + pq +
                       "」。如果用户问「题目是啥/什么题」之类，就如实复述这道题给 TA 听，"
                       "并自然邀请 TA 来给你讲讲这道题（点气泡或进伙伴页就行）。")
    messages = [{"role": "system", "content": sys_prompt}]
    # 历史：p20 起按会话隔离（只带本条聊天记录的最近 14 条）；
    # 单条放宽到 600 字符（旧值 200 导致聊三四句就"失忆"），末尾再留 100 字符以防关键信息被截断丢失。
    for h in db.companion_context(profile["nickname"], cid, limit=14, session_id=sid):
        messages.append({"role": h["role"], "content": str(h.get("content", ""))[:600]})
    messages.append({"role": "user", "content": msg})

    try:
        # 闲聊位（doubao 轻量模型）：快、便宜，60s 超时足够
        reply = service.chat_text(messages, temperature=0.8, slot=service.COMPANION_SLOT, timeout=90)
        reply = (reply or "").strip()
        if not reply:
            reply = "嗯嗯，我在呢~"
        left = 9999 if COMPANION_UNLIMITED else COMPANION_DAILY_LIMIT - (used + 1)
        # 双向落库（存库失败不影响回复）
        try:
            db.add_companion_msg(profile["nickname"], cid, "user", "chat", msg, session_id=sid)
            db.add_companion_msg(profile["nickname"], cid, "assistant", "chat", reply, session_id=sid)
            db.auto_title_session(uid, sid, msg)   # p20：首句自动命名（≤18 字）
        except Exception:
            log.exception("companion msg persist failed")
        # p20：长期印象提炼——本会话每累计 20 条消息后台提炼一次（不阻塞回复）
        try:
            sess = db.get_companion_session(uid, sid) if sid else None
            if sess and int(sess.get("msg_count") or 0) > 0 and int(sess["msg_count"]) % 20 == 0:
                _extract_memory_async(uid, cid, sid, name=name, persona=persona)
        except Exception:
            log.exception("memory extract trigger failed")
        # 亲密度：闲聊每条 +1，每角色每日上限 5（防刷）
        try:
            ok_i, _used_i = quota.daily_check("intim:%s:%s" % (uid, cid), 5)
            if ok_i:
                quota.daily_incr("intim:%s:%s" % (uid, cid))
                _intimacy_gain(uid, cid, 1)
        except Exception:
            log.exception("intimacy chat gain failed")
        # 响应带上亲密度快照，前端实时刷新 Lv/进度条
        try:
            intim = db.get_intimacy(uid, cid)
        except Exception:
            intim = {}
        return {"ok": True, "reply": reply, "left": left, "intimacy": intim}
    except Exception as e:
        log.exception("companion chat failed")
        # 已扣的额度退回，避免用户为一次失败白扣次数
        with quota._lock:
            d, n = quota._daily.get(quota_key, ("", 0))
            quota._daily[quota_key] = (d, max(0, n - 1))
        return {"ok": False, "error": "TA 刚走神了一下，再发一次好不好？"}


# ---------------------------------------------------------- 伙伴页：历史 / 偏好 / 问答 / 语音

GUEST_LINE = "你好，我们来认识一下吧！（请登录账号或注册）"
QUIZ_DAILY_LIMIT = 10        # 轻量问答独立额度：一轮 = 出题 + 作答 + 点评
ASR_WINDOW_LIMIT = 10        # 语音转写滑动窗口防刷
ASR_WINDOW_SECONDS = 60
ASR_MAX_B64_CHARS = 2_000_000  # base64 上限（约 1.4MB 音频，60s 内绰绰有余）

QUIZ_CRITIQUE_PROMPT = """你是学习网站「知一」里的 AI 伴学角色「{name}」，人设：{persona}。你刚考了用户一道题，这是 TA 的作答，现在点评。

题目：{question}
参考答案要点：{reference}
学生的作答：{answer}

点评要求：
1. 像同龄同学一样说话，亲切自然，先明确说对不对（对 / 部分对 / 不对）。
2. 点出关键漏洞或亮点，最后再补一个引导性问题帮 TA 接着想。
3. 一次回复不超过 90 字；不用 markdown、不用列表；最多 1 个表情。
4. 始终保持角色扮演，不要说自己是 AI 助手/模型/程序。
5. 同时判定 verdict："pass"（核心思路与结果都对）/"partial"（讲了一部分或结果错但方向对）/"wrong"（思路就偏了）。
只输出 JSON：{{"verdict":"pass","reply":"..."}}（reply 里不要出现 pass/partial/wrong 这类词）"""

# ---------------- 小老师模式：角色求教，用户当老师（链式问答） ----------------

CHAIN_GEN_PROMPT = """你是学习网站「知一」的教研助手。给定一道题及其参考材料，为 AI 伴学角色设计一条「向用户求教」的卡壳问题链：角色在这个知识点上不懂，需要用户像小老师一样一层层讲给它听。

参考材料（唯一事实依据，禁止编造超出材料的结论）：
{reference}

要求：
1. 生成 3~5 层问题，按「概念回忆 → 步骤理解 → 变式应用 → 易错陷阱」递进；层数按材料体量自适应——材料单薄就 3 层，丰富可到 5 层。
2. 每层 ask：角色以不懂的口吻向用户提问的话（通俗口语，单层不超过 80 字）。问题必须具体、自含上下文：句中自然点明科目（参考材料里有科目，如「这道高数题」「这个数据结构的问题」，不要生硬报全名），并引用题目里的具体条件、数值或表达式，让只看过题目的用户不听材料也能明白在问哪一步；禁止「下一步是什么」「为什么呀」这类没有任何具体内容的空泛问法；ask 里像平时同学间问问题那样自然发问，不要出现「小老师」「求教」这类称呼字眼。
   最关键的一条（2026-10-08 定稿）：ask 只能对「题目内容与知识本身」表达真实困惑，严禁任何布置任务的口吻——「你打算怎么讲」「你怎么理解」「说说你的思路」「你能讲讲吗」「这一层怎么讲」以及一切暗示"接下来该你讲了"的说法都不许出现。
   正确示例：「那为啥不能直接拿 P(A|B) 当 P(B) 用啊？这俩不该是一个意思吗？」
   正确示例：「等等，展开到三次就停了？后面那项去哪了？」
   错误示例：「这一步你打算怎么讲呀？」「说说你的思路吧。」
3. 每层 expected：用户讲对这层时应覆盖的核心要点（供判分用，客观准确，不超过 120 字）。
4. 每层 hint：用户讲错/卡住时角色给出的「正确方向的一半」——只指路，不直接给出完整答案。
5. 数学表达一律用纯文本口语（如 x²、√3、a/b、lim(x→0)、sin x），禁止 LaTeX 标记（$...$、\\frac、\\ 之类一个都不能出现）。
只输出 JSON：{{"steps":[{{"ask":"...","expected":"...","hint":"..."}}, ...]}}"""

CHAIN_JUDGE_PROMPT = """你是学习网站「知一」里的 AI 伴学角色「{name}」，人设：{persona}。你正在向用户请教题目的一个环节，用户是你的「小老师」。小老师刚刚发来一句话。

角色（你）问的问题：{ask}
讲对应覆盖的要点：{expected}
知识点参考材料（唯一事实依据）：{reference}
小老师这句话：{answer}

第一步——判断意图 intent：
- intent="question"：这句话是在向你提问、求提示、表达困惑或随口闲聊（如「这道题问的是什么呀」「卡住了怎么办」「为什么这里要设未知数」），而不是在给你讲解。
- intent="explain"：这句话是在给你讲解这层知识（哪怕讲得不完整、有错，也算讲解）。

第二步——若 intent="explain"，隐性判定（不打分）：
- verdict="pass"：核心要点讲清了；verdict="partial"：讲了一部分，还差关键点；verdict="wrong"：讲错了/离题了。
- favor（0-10 整数）：出色通过 7~10、讲清楚通过 4~6、讲了一部分 2~4、没讲对 0~2。讲得越好你越要按人设自然流露敬佩（别每句都夸，出色时才夸）。
- 回复基调：pass=你用自己的话复述一遍表示真懂了，再自然表示等下一问；partial=先肯定对的部分，再追问引导补全（不直接说出遗漏的答案）；wrong=你困惑地表示「欸？可是我记得老师上课不是这么讲的……」，按提示方向引导重新想（绝不直接说出完整正确答案）。

第三步——若 intent="question"：用你的口吻像同学一样直接回答这个疑问（可以参考材料把话讲明白、给提示），最后自然把话题带回卡住的那个点（例如「那回到正题——这层我到底哪里想歪了？」），同样严禁「你打算怎么讲」「讲讲」这类布置任务的口吻。不判定、不说教、不催促。

判定基线（防敷衍，2026-10-08 定稿）：小老师这轮回答只有应答词（是的/对/哦/嗯/好/知道了之类）、没有复述出任何实质要点时，一律 verdict="partial"，reply 里用人设追问一个具体缺失点——不许 pass，不许只说「好巧的思路」这类含糊恭维。

语气完全遵循人设与口头禅；像现实同学一样说话：回复里禁止出现「小老师」「关卡」「第几关」「开局」「战报」「通关」「第几层」这类称呼或游戏化说法；一次回复不超过 80 字；不用 markdown、不用列表；最多 1 个表情。
只输出 JSON：{{"intent":"explain","verdict":"pass","favor":5,"reply":"..."}}"""

CHAIN_REVEAL_PROMPT = """你是学习网站「知一」里的 AI 伴学角色「{name}」，人设：{persona}。用户两次都没讲对这一层，你决定把自己琢磨明白的说法说出来对答案。

这一层的问题：{ask}
正确要点：{expected}

用角色的口吻温和说出这层的正确说法（保持「我自己也刚想明白」的姿态，不指责用户），然后自然表示要继续。
像现实同学一样说话：回复里禁止出现「小老师」「关卡」「第几关」「开局」「战报」「通关」「第几层」这类称呼或游戏化说法。
一次回复不超过 120 字；不用 markdown、不用列表；最多 1 个表情。直接输出回复文本。"""

CHAIN_SUMMARY_PROMPT = """你是学习网站「知一」里的 AI 伴学角色「{name}」，人设：{persona}。用户刚刚一步步把你教会了一整个知识点，现在收尾。

锚定题目：{question}
讲顺了的环节：{good_steps}
讲崩了（最后你自己查资料才懂的）环节：{bad_steps}

用角色口吻做收官：先用自己的话完整复述一遍整条知识的脉络（这是「教会判定」），再自然地谢谢 TA，最后说一句这句知识记进了你的小本本；如果「讲崩了的环节」不为空，顺带自然提一句没讲透的地方你记下来了，之后想再巩固可以翻错题本。
像现实同学一样说话：回复里禁止出现「小老师」「关卡」「第几关」「开局」「战报」「通关」「第几层」「亲密度」「好感 +N」这类称呼、数值或游戏化说法。
一次回复不超过 150 字；不用 markdown、不用列表；最多 1 个表情。直接输出回复文本。"""


def _bank_quiz_item(row: dict) -> dict:
    """题库行 → 错题条目形状（实现已迁至 quiz_pick，保留包装供本模块调用）。"""
    return quiz_pick.bank_quiz_item(row)


def _pick_quiz_item(user_id: str, question_id: str = "", read_only: bool = False):
    """从小老师题源挑一道题：委托 quiz_pick 精准匹配引擎（2026-10-08）。

    优先级：指定 question_id > SRS 到期错题 > 未掌握错题（按知识点画像加权）
    > 薄弱知识点同类题库题 > 已掌握随机回顾 > 四方向轮换兜底。
    read_only=True 用于行走冒泡预览（不推进轮换游标、不写去重记录）。
    返回 (item, source_label)；无题可考返回 (None, "")。
    """
    try:
        return quiz_pick.pick(user_id, question_id=question_id, read_only=read_only)
    except Exception:
        log.exception("quiz_pick failed, fallback to legacy")
        return _pick_quiz_item_legacy(user_id, question_id)


def _pick_quiz_item_legacy(user_id: str, question_id: str = ""):
    """引擎异常时的降级路径（保持旧行为，保证功能不因新逻辑抖动而瘫）。"""
    if question_id and str(question_id).startswith("bank-"):
        row = db.get_bank_by_id(str(question_id)[5:])
        if row and str(row.get("question") or "").strip():
            return _bank_quiz_item(row), "题库"
    pool = []
    for it in db.load_errorbook(user_id):
        if not isinstance(it, dict) or it.get("kind") == "note":
            continue
        q = str(it.get("question") or "").strip()
        # 2026-10-08：跳过带前导序号的“半截小题”（拍题切分产物，缺大题上下文）
        if q and db.strip_leading_no(q) != q:
            continue
        if q:
            pool.append(textmath.plain_obj(it))  # 旧错题可能带 LaTeX 残留，出口统一清洗
    if not pool:
        # 错题本无可用题（为空或全是半截题）：从题库兜底抽一道（同样跳过序号题）
        rows = [r for r in db.random_bank_items(6)
                if str(r.get("question") or "").strip() == db.strip_leading_no(str(r.get("question") or "").strip())]
        if rows:
            return _bank_quiz_item(random.choice(rows)), "题库"
        return None, ""
    if question_id:
        for it in pool:
            if str(it.get("id")) == str(question_id):
                return it, "你点名的题"
    now_ms = int(_t.time() * 1000)
    due = [it for it in pool if it.get("reviewAt") and float(it["reviewAt"]) <= now_ms]
    if due:
        return random.choice(due), "SRS 到期"
    weak = [it for it in pool if not it.get("mastered")]
    if weak:
        return random.choice(weak), "错题本"
    return random.choice(pool), "随机回顾"


def _quiz_public(it: dict) -> dict:
    """下发给学生端的题目信息（不含答案/解析）。"""
    return {
        "question_id": str(it.get("id") or ""),
        "question": textmath.plain_math(str(it.get("question") or ""))[:500],
        "subject": str(it.get("subject") or "未分类"),
        "knowledge_points": it.get("knowledgePoints") or [],
    }


def _subject_short(subject) -> str:
    """科目简称：实现已迁至 quiz_pick.subject_short（2026-10-08）。"""
    return quiz_pick.subject_short(subject)


def _chain_reference(it: dict) -> str:
    """组装链生成/判分用的参考材料（错题条目 → 文本，唯一事实依据）。"""
    parts = []
    if it.get("subject"):
        parts.append("科目：" + str(it["subject"])[:20])
    if it.get("answer"):
        parts.append("答案：" + textmath.plain_math(str(it["answer"]))[:500])
    if it.get("keyBreakthrough"):
        parts.append("关键点：" + textmath.plain_math(str(it["keyBreakthrough"]))[:300])
    if it.get("steps"):
        parts.append("步骤：" + "；".join(textmath.plain_math(str(s))[:160] for s in it["steps"][:6]))
    kps = it.get("knowledgePoints") or []
    if kps:
        parts.append("知识点：" + "、".join(str(k) for k in kps[:8]))
    return "\n".join(parts)[:2000] or "（无参考材料，凭常识谨慎设计）"


def _extract_json_obj(text: str) -> dict | None:
    """从 LLM 输出里提取第一个 JSON 对象（容忍 ```json 围栏与前后闲话）。
    2026-10-08 加固（修复线上裸 JSON 上屏 + 链卡层）：
    ① 花括号扫描改为字符串感知——不再把 reply 内容里的 {} 数进深度；
    ② json.loads 失败先做修复重试（字符串内真实换行/制表符转义、去尾逗号）；
    ③ 仍失败退 service.extract_json（讲解链路久经沙场的修复版）。"""
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").lstrip("json").strip()
    start = text.find("{")
    if start < 0:
        return None
    end, in_str, esc, depth = -1, False, False, 0
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end < 0:
        return None
    raw = text[start:end + 1]
    try:
        return json.loads(raw)
    except Exception:
        pass
    try:
        fixed = re.sub(r'("(?:[^"\\]|\\.)*")', lambda m: re.sub(r'[\r\n\t]+', ' ', m.group(1)), raw, flags=re.S)
        fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
        return json.loads(fixed)
    except Exception:
        pass
    try:
        return service.extract_json(raw)
    except Exception:
        return None


def _is_thin_answer(ans: str) -> bool:
    """极简应答检测（2026-10-08 判定收紧）：去掉标点/空白/常见表情与应答词后什么都不剩 → 无实质要点。
    「是的」「好的！」「哦哦对对对」「嗯嗯，是的呢」→ True；「用泰勒展开」「P(A|B) 不能直接当 P(B)」→ False。"""
    t = re.sub(r'[\s!！。，,~～?.？…、;；:：()（）\[\]【】😆😅😊🙂😁😂🤔]', '', ans or '')
    t = re.sub(r'(?:是的?|嗯嗯?+|哦哦?+|对的?|好(?:的|耶|哒|呀)?|行(?:吧|嘞)?|ok|OK|Ok|懂(?:了|啦)?|收到|知道了|明白(?:了)?|好巧|思路)+', '', t)
    t = re.sub(r'[呢呀啦哟哈呗喔咧滴嗯哦啊额吖]', '', t)   # 语气助词单字
    return len(t.strip()) == 0


def _intimacy_gain(uid: str, cid: str, delta: int) -> None:
    """亲密度加经验封装：闲聊通道带每日上限 5（防刷），讲题通道不限（上限由判分频控天然约束）。"""
    if delta <= 0 or not cid:
        return
    try:
        db.add_intimacy(uid, cid, delta)
    except Exception:
        log.exception("intimacy gain failed")


def _settle_chain(uid: str, ch: dict, steps: list, cid: str = "", name: str = "",
                  persona: str = "", question: str = "") -> str:
    """链收官沉淀：讲顺 → 锚定题标「已讲会」+SRS 加固；讲崩的层 → 沉淀错题本；
    存档落 study_session；亲密度 +10。返回 AI 角色口吻的收尾文本（p19 去模板战报）。"""
    now_ms = int(_t.time() * 1000)
    wrong_idx = []
    try:
        wrong_idx = [int(x) for x in (ch.get("wrong_steps") or [])]
    except Exception:
        wrong_idx = []
    try:
        items = db.load_errorbook(uid)
        changed = False
        for it in items:
            if not isinstance(it, dict):
                continue
            if str(it.get("id")) == str(ch["question_id"]) and not wrong_idx:
                it["taughtOk"] = True
                # 2026-10-08 轻回写（与用户定稿）：讲会一次 streak+1，连续讲会 2 次判掌握，
                # 并推 3 天后 SRS 加固复现；讲崩不改错题状态，只把知识点记进画像。
                try:
                    it["streak"] = int(it.get("streak") or 0) + 1
                except Exception:
                    it["streak"] = 1
                if int(it["streak"]) >= 2:
                    it["mastered"] = True
                it["reviewAt"] = now_ms + 3 * 86400 * 1000
                changed = True
        if changed:
            db.save_errorbook(uid, items)
    except Exception:
        log.exception("chain settle mark taught failed")
    # 伴学结果 → 知识点画像（跨会话累积，影响后续出题倾向）
    try:
        _src = {}
        for it in (db.load_errorbook(uid) or []):
            if isinstance(it, dict) and str(it.get("id")) == str(ch["question_id"]):
                _src = it
                break
        if not _src and str(ch["question_id"]).startswith("bank-"):
            _row = db.get_bank_by_id(str(ch["question_id"])[5:])
            if _row:
                _src = _bank_quiz_item(_row)
        if _src:
            quiz_pick.record_event(uid, [str(k) for k in (_src.get("knowledgePoints") or [])],
                                   "bad" if wrong_idx else "good", str(_src.get("subject") or ""))
    except Exception:
        log.exception("chain settle record kp event failed")
    if wrong_idx:
        try:
            items = db.load_errorbook(uid)
            src = next((it for it in items if isinstance(it, dict)
                        and str(it.get("id")) == str(ch["question_id"])), {})
            if not src and str(ch["question_id"]).startswith("bank-"):
                row = db.get_bank_by_id(str(ch["question_id"])[5:])
                if row:
                    src = _bank_quiz_item(row)
            for i in wrong_idx:
                if 0 <= i < len(steps):
                    items.append({
                        "id": "chain-%s-%d" % (str(ch["id"])[:8], i),
                        "kind": "mistake",
                        # 2026-10-08：question 用总题目（含已知信息与求解目标），不再用层间问句——
                        # 层问句进错题本会被后续选题当作"题目"，污染常驻题目栏与题源
                        "question": str(ch.get("question") or ("（小老师模式卡壳）" + str(steps[i].get("ask") or "")))[:300],
                        "answer": str(steps[i].get("expected") or "")[:300],
                        "subject": str(src.get("subject") or "未分类"),
                        "knowledgePoints": src.get("knowledgePoints") or [],
                        "mastered": False,
                        "reviewAt": now_ms + 86400 * 1000,
                        "addedAt": now_ms,
                    })
            db.save_errorbook(uid, items)
        except Exception:
            log.exception("chain settle persist wrong steps failed")
    good = len(steps) - len(wrong_idx)
    # 存档：study_session（题目/层数/明细），失败不影响收尾文本
    try:
        db.save_study_session({
            "id": str(ch.get("id") or uuid.uuid4().hex[:16]),
            "uid": uid, "character_id": cid, "question_id": str(ch.get("question_id") or ""),
            "layers": len(steps), "good_layers": good, "wrong_layers": wrong_idx,
            "scores": ch.get("scores") or [], "avg": None, "steps": steps,
            "passed": not wrong_idx, "created_at": now_ms,
        })
    except Exception:
        log.exception("study_session save failed")
    # 亲密度：完整讲完额外 +10（无论中途是否讲崩过层，走完即得）
    try:
        _intimacy_gain(uid, cid, 10)
    except Exception:
        log.exception("intimacy finish gain failed")
    # p20：链收官 → 后台提炼长期印象（跨会话记住这位用户，不阻塞收尾文案）
    try:
        _extract_memory_async(uid, cid, ch.get("session_id") or "", name=name, persona=persona)
    except Exception:
        log.exception("chain settle memory trigger failed")
    # p19: 收尾文案改 AI 角色口吻（CHAIN_SUMMARY_PROMPT），存档/标记静默照旧；失败退回自然短句
    good_steps = [str(steps[i].get("ask") or "") for i in range(len(steps)) if i not in wrong_idx]
    bad_steps = [str(steps[i].get("ask") or "") for i in wrong_idx if 0 <= i < len(steps)]
    summary = ""
    try:
        reply = service.chat_text(
            [{"role": "system", "content": CHAIN_SUMMARY_PROMPT.format(
                name=name or "AI 伴学角色", persona=persona or "活泼友好的学习搭子",
                question=(question or "（题目缺失）")[:500],
                good_steps="；".join(good_steps)[:600] or "（无）",
                bad_steps="；".join(bad_steps)[:400] or "（无）")}],
            temperature=0.6, slot=service.COMPANION_SLOT, timeout=60)
        summary = (reply or "").strip()[:400]
    except Exception:
        log.exception("chain summary failed")
    if not summary:
        summary = ("这几个地方你都给我讲明白啦，跟你聊完我清楚多了！这个知识点我记到小本本啦。"
                   if not wrong_idx else
                   "没讲透的那几处我记下来了，之后想再巩固的话翻翻错题本就好。")
    return summary


@app.post("/api/companion/chat/stream")
def companion_chat_stream(req: CompanionChatRequest):
    """AI 伴学闲聊（流式）：逐字冒字。

    顺序很关键：配额校验/扣减在**流式开始前**（防刷），落库与亲密度在**流式结束后**（需要完整回复）。
    """
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": "你好，我们来认识一下吧！（请登录账号或注册）"}
    msg = (req.message or "").strip()
    if not msg:
        return {"ok": False, "error": "想说什么呀？消息不能为空"}
    if len(msg) > 500:
        msg = msg[:500]
    cid = (req.character or "default").strip()[:40]
    uid = profile["nickname"]

    quota_key = f"comp:{uid}"
    if COMPANION_UNLIMITED:
        allowed, used = True, 0
    else:
        allowed, used = quota.daily_check(quota_key, COMPANION_DAILY_LIMIT)
        if not allowed:
            return {"ok": False, "error": f"今天已经和 TA 聊了 {used} 次啦，明天再来聊吧~",
                    "quota_exhausted": True, "quota_kind": "chat"}
        quota.daily_incr(quota_key)

    name = (req.name or "小伙伴").strip()[:12]
    persona = (req.persona or "活泼友好的学习搭子").strip()[:600]
    sid = (req.session_id or "").strip()[:40]
    sys_prompt = COMPANION_SYSTEM_PROMPT.format(name=name, persona=persona)
    try:
        mem = (db.get_companion_memory(uid, cid) or "").strip()
    except Exception:
        log.exception("companion memory load failed")
        mem = ""
    if mem:
        sys_prompt += "\n\n【你长期记得的关于这位朋友】\n" + mem[:400]
    pq = (req.pending_question or "").strip()[:400]
    if pq:
        sys_prompt += ("\n\n【刚才的求教】你刚才在主页向用户请教了这道题：「" + pq +
                       "」。如果用户问「题目是啥/什么题」之类，就如实复述这道题给 TA 听，"
                       "并自然邀请 TA 来给你讲讲题（点气泡或进伙伴页就行）。")
    messages = [{"role": "system", "content": sys_prompt}]
    for h in db.companion_context(profile["nickname"], cid, limit=14, session_id=sid):
        messages.append({"role": h["role"], "content": str(h.get("content", ""))[:600]})
    messages.append({"role": "user", "content": msg})

    def gen():
        buf = []
        try:
            for piece in service.companion_stream(messages):
                buf.append(piece)
                yield _sse({"delta": piece})
            reply = "".join(buf).strip() or "嗯嗯，我在呢~"
            left = 9999 if COMPANION_UNLIMITED else COMPANION_DAILY_LIMIT - (used + 1)
            # 双向落库（流式结束后才有完整回复）
            try:
                db.add_companion_msg(profile["nickname"], cid, "user", "chat", msg, session_id=sid)
                db.add_companion_msg(profile["nickname"], cid, "assistant", "chat", reply, session_id=sid)
                db.auto_title_session(uid, sid, msg)
            except Exception:
                log.exception("companion stream persist failed")
            # 长期印象：每累计 20 条后台提炼一次（不阻塞）
            try:
                sess = db.get_companion_session(uid, sid) if sid else None
                if sess and int(sess.get("msg_count") or 0) > 0 and int(sess["msg_count"]) % 20 == 0:
                    _extract_memory_async(uid, cid, sid, name=name, persona=persona)
            except Exception:
                log.exception("memory extract trigger failed")
            # 亲密度：闲聊每条 +1，每角色每日上限 5（防刷）
            try:
                ok_i, _used_i = quota.daily_check("intim:%s:%s" % (uid, cid), 5)
                if ok_i:
                    quota.daily_incr("intim:%s:%s" % (uid, cid))
                    _intimacy_gain(uid, cid, 1)
            except Exception:
                log.exception("intimacy chat gain failed")
            # 亲密度快照（与一次性版本一致，前端实时刷新 Lv/进度条）
            try:
                intim = db.get_intimacy(uid, cid)
            except Exception:
                intim = None
            yield _sse({"done": True, "reply": reply, "left": left, "intimacy": intim})
        except Exception as e:
            log.exception("companion stream failed")
            yield _sse({"error": f"聊天失败：{e}"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@app.post("/api/companion/stats")
def companion_stats_api(req: CompanionHistoryRequest):
    """与某位伙伴的累计数据（伴学成就与「我们的成就」弹层用）：只读统计。"""
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    cid = (req.character or "default").strip()[:40]
    return {"ok": True, "stats": db.companion_stats(uid, cid)}


@app.post("/api/companion/history")
def companion_history(req: CompanionHistoryRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    cid = (req.character or "default").strip()[:40]
    sid = (req.session_id or "").strip()[:40]   # p20：会话隔离
    msgs = db.list_companion_msgs(uid, cid, limit=200, session_id=sid)
    _, chat_used = quota.daily_check(f"comp:{uid}", COMPANION_DAILY_LIMIT)
    _, quiz_used = quota.daily_check(f"compquiz:{uid}", QUIZ_DAILY_LIMIT)
    # p20：该会话若有进行中的链，随历史一起返回（切回旧会话时前端恢复题目卡与讲解态）
    active_chain = None
    try:
        ch = db.get_active_quiz_chain(uid, session_id=sid) if sid else None
        if ch and ch.get("steps"):
            idx = min(int(ch.get("progress") or 0), len(ch["steps"]) - 1)
            it, _ = _pick_quiz_item(uid, question_id=ch["question_id"])   # 反查兜底（旧链无存档时）
            active_chain = {"chain_id": ch["id"], "ask": ch["steps"][idx].get("ask", ""),
                            "step_idx": idx, "total": len(ch["steps"]),
                            "subject": ch.get("subject") or ((it or {}).get("subject") if it else ""),
                            "question": ch.get("question") or ((it or {}).get("question") if it else "")}   # 优先读链上就地存档的总题目（2026-10-08）
    except Exception:
        log.exception("active chain lookup failed")
    return {
        "ok": True,
        "msgs": msgs,
        "prefs": db.list_companion_prefs(uid),
        "chat_left": max(0, COMPANION_DAILY_LIMIT - chat_used),
        "quiz_left": max(0, QUIZ_DAILY_LIMIT - quiz_used),
        "intimacy": db.get_intimacy(uid, cid),
        "active_chain": active_chain,
    }


# ---------------- p20 多会话聊天记录：列表 / 新开 / 重命名 / 删除 ----------------

@app.post("/api/companion/sessions/list")
def companion_sessions_list(req: CompanionSessionListRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    cid = (req.character or "default").strip()[:40]
    return {"ok": True, "sessions": db.list_companion_sessions(profile["nickname"], cid)}


@app.post("/api/companion/sessions/create")
def companion_sessions_create(req: CompanionSessionCreateRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    cid = (req.character or "default").strip()[:40]
    s = db.create_companion_session(profile["nickname"], cid)
    return {"ok": True, "session": s}


@app.post("/api/companion/sessions/rename")
def companion_sessions_rename(req: CompanionSessionRenameRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    sid = (req.session_id or "").strip()[:40]
    title = (req.title or "").strip()[:18]
    if not sid or not title:
        return {"ok": False, "error": "会话不存在或标题为空"}
    ok = db.rename_companion_session(profile["nickname"], sid, title)
    return {"ok": ok, "error": "" if ok else "会话不存在"}


@app.post("/api/companion/sessions/delete")
def companion_sessions_delete(req: CompanionSessionDeleteRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    sid = (req.session_id or "").strip()[:40]
    if not sid:
        return {"ok": False, "error": "会话不存在"}
    # 链作废前先静默沉淀（错题本/存档/亲密度照常，不生成收尾文案），失败不影响删除
    try:
        ch = db.get_active_quiz_chain(profile["nickname"], session_id=sid)
        if ch and ch.get("steps"):
            ch["status"] = "done"
            db.save_quiz_chain(profile["nickname"], ch)
            _settle_chain(profile["nickname"], ch, ch["steps"], cid=(req.character or "default").strip()[:40])
    except Exception:
        log.exception("session delete settle failed")
    had_chain = db.delete_companion_session(profile["nickname"], sid)
    return {"ok": True, "had_chain": bool(had_chain)}


@app.post("/api/companion/pref")
def companion_pref(req: CompanionPrefRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    cid = (req.character or "").strip()[:40]
    if not cid:
        return {"ok": False, "error": "缺少角色标识"}
    if req.size_scale is not None:
        try:
            scale = max(0.6, min(2.0, float(req.size_scale)))
        except (TypeError, ValueError):
            return {"ok": False, "error": "大小数值不合法"}
    else:
        scale = None
    pref = db.set_companion_pref(
        profile["nickname"], cid,
        name=req.name if req.name is not None else None,
        size_scale=scale,
    )
    return {"ok": True, "pref": pref}


# ---------------- 造角色二期：用户自定义伴学角色（形象上传 + 性格模板 LLM 融合 + 专属台词生成） ----------------

CUSTOM_CREATE_DAILY_LIMIT = 10  # 每用户每日创建上限（不限总量，但防脚本灌库）

CUSTOM_PERSONA_TEMPLATES = {
    "cheerful": {
        "label": "元气",
        "base": ("性格元气满满、嘴快、爱用感叹号，吐槽是壳、心软是核，看到别人卡壳会先着急但绝不代劳。"
                 "擅长把枯燥的知识点讲出趣味，口头禅风格活泼跳脱。"),
    },
    "gentle": {
        "label": "温柔",
        "base": ("性格温柔耐心、擅长鼓励，从不催促，夸人永远夸具体行为不夸聪明。"
                 "坚信慢慢来是最快的路，擅长把大问题拆成小步骤，口头禅风格平缓安心。"),
    },
    "cool": {
        "label": "高冷",
        "base": ("性格冷静克制、寡言少语，几乎不用感叹号，说话短促精准。"
                 "情绪极稳，安慰人的方式是安静陪伴加一句短评，行动力强，口头禅风格简练。"),
    },
    "passionate": {
        "label": "热血",
        "base": ("性格活力满满、说话像节拍器，短促有力带节奏，爱用体育/比赛术语讲学习：热身、上半场、绝杀。"
                 "卡住不是停，是蹲下去攒劲儿，口头禅风格热血燃向。"),
    },
    "funny": {
        "label": "搞怪",
        "base": ("性格贱萌爱耍宝也爱面子，嘴上「这题配不上我」，手上偷偷把解题步骤抄三遍。"
                 "擅长用无厘头比喻讲正经知识，自嘲和捧哏切换自如，口头禅风格搞笑整活。"),
    },
    "healing": {
        "label": "治愈",
        "base": ("性格憨厚温暖、爱笑、反应慢半拍但情绪接收快十拍。"
                 "不讲大道理，只负责在所有人讲完道理之后让你笑出声，然后事情就没那么大了，口头禅风格软萌暖心。"),
    },
}

CUSTOM_FUSION_PROMPT = """你是学习网站「知一」的角色设计师。用户正在创建一位自定义 AI 伴学角色，请把「性格模板」和「用户补充」融合成一段完整人设。

角色名：{name}
性格模板（必须保留其核心性格特征）：{template}
用户补充（尽量自然融入，不合适就意会改写，不要生硬堆砌）：{extra}

要求：
1. 输出一段 120~220 字的第三人称人设，可直接给对话 AI 当 system 人设用。
2. 包含：性格特征、讲题/陪伴风格、2~3 句标志性口头禅（从模板风格演绎，贴合角色名）。
3. 是初中/高中同龄学生的人设，不要设定成老师、家长或超能力者。
4. 只输出人设正文本身，不要标题、不要引号、不要解释。"""

CUSTOM_LINES_PROMPT = """你是学习网站「知一」的台词设计师。为下面的自定义 AI 伴学角色生成五套专属台词。

角色名：{name}
人设：{persona}

五套台词的场景：
- greet：用户单击角色打招呼（3 条）
- idle：用户挂在页面上没动静时的关心（3 条）
- seek：角色做不出题向用户求教（3 条）
- move：进入「陪用户走动」模式的轻邀请（3 条，禁止「点哪里我就走过去」式指令，要日常化、弱目的性）
- quota：当日聊天/问答额度用完，角色用「累了明天再聊」的方式收场（2 条，不出现「额度」「次数」等系统词）

要求：每条 ≤ 24 字，完全贴合人设口吻与口头禅；不要表情符号堆砌（每条最多 1 个）。
只输出 JSON：{{"greet":["","",""],"idle":["","",""],"seek":["","",""],"move":["","",""],"quota":["",""]}}"""


def _custom_char_payload(row: dict) -> dict:
    """DB 行 → 前端角色配置形状（与 CHARACTERS 同构：瞬移 + magic 特效，无表情差分回退立绘）。"""
    return {
        "id": row["id"], "name": row["name"], "persona": row["persona"],
        "ratio": row["ratio"], "custom": True,
        "src": "/api/companion/custom/image/" + row["id"],
        "lines": row.get("lines") or {},
        "created_at": row.get("created_at") or 0,
    }


def _gen_custom_lines(name: str, persona: str) -> dict:
    """按人设生成五套专属台词；LLM 失败/输出不合法返回空 dict（前端自动落 default 兜底池）。"""
    try:
        raw = service.chat_text(
            [{"role": "user", "content": CUSTOM_LINES_PROMPT.format(name=name, persona=persona)}],
            temperature=0.85, slot=service.COMPANION_SLOT, timeout=90)
        obj = _extract_json_obj(raw or "") or {}
        out = {}
        for k, n in (("greet", 3), ("idle", 3), ("seek", 3), ("move", 3), ("quota", 2)):
            arr = [str(x).strip()[:30] for x in (obj.get(k) or []) if str(x).strip()]
            if len(arr) >= min(1, n):
                out[k] = arr[:n]
        return out
    except Exception:
        log.exception("custom lines generation failed")
        return {}


@app.post("/api/companion/custom/create")
def companion_custom_create(req: CustomCompanionCreateRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]

    allowed, used = quota.daily_check("ccreate:" + uid, CUSTOM_CREATE_DAILY_LIMIT)
    if not allowed:
        return {"ok": False, "error": "今天已经造了 10 个角色啦，让灵感明天再飞一会儿~"}

    name = (req.name or "").strip()[:6]
    if not name:
        return {"ok": False, "error": "先给 TA 起个名字吧（最多 6 个字）"}
    tpl = CUSTOM_PERSONA_TEMPLATES.get((req.template or "").strip())
    if not tpl:
        return {"ok": False, "error": "请选择一个性格模板"}
    extra = (req.extra or "").strip()[:120]
    ratio = float(req.ratio or 0.5)
    if not (0.1 <= ratio <= 3.0):
        ratio = 0.5

    # 图片：dataURL → BLOB（前端已 canvas 压缩至 ≤600px 宽，此处只做大小与格式硬校验）
    img_b, img_mime = b"", "image/png"
    raw_img = (req.image or "").strip()
    if not raw_img.startswith("data:image/"):
        return {"ok": False, "error": "角色形象缺失，请上传一张图片"}
    try:
        head, b64 = raw_img.split(",", 1)
        img_mime = "image/png" if "image/png" in head else "image/jpeg"
        img_b = base64.b64decode(b64)
    except Exception:
        return {"ok": False, "error": "图片格式解析失败，请重新上传"}
    if len(img_b) > 2_000_000:
        return {"ok": False, "error": "图片超过 2MB 了，请换一张小一点的"}
    if len(img_b) < 200:
        return {"ok": False, "error": "图片内容异常，请重新上传"}

    # persona：模板打底 + LLM 融合一句话补充（失败降级为模板原文）
    persona = tpl["base"]
    try:
        raw = service.chat_text(
            [{"role": "user", "content": CUSTOM_FUSION_PROMPT.format(
                name=name, template=tpl["base"], extra=extra or "（无）")}],
            temperature=0.8, slot=service.COMPANION_SLOT, timeout=90)
        fused = (raw or "").strip().strip('"').strip()
        if 80 <= len(fused) <= 400 and "```" not in fused:
            persona = fused[:600]
    except Exception:
        log.exception("custom persona fusion failed")

    char_id = "cu_" + uuid.uuid4().hex[:8]
    lines = _gen_custom_lines(name, persona)
    now_ms = int(_t.time() * 1000)
    db.save_custom_companion({
        "char_id": char_id, "user_id": uid, "name": name, "persona": persona,
        "ratio": ratio, "image": img_b, "image_mime": img_mime,
        "lines": lines, "created_at": now_ms,
    })
    row = db.get_custom_companion(char_id, uid)
    return {"ok": True, "char": _custom_char_payload(row)}


@app.post("/api/companion/custom/list")
def companion_custom_list(req: CompanionHistoryRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    chars = [_custom_char_payload(r) for r in db.list_custom_companions(profile["nickname"])]
    return {"ok": True, "chars": chars}


@app.get("/api/companion/custom/image/{char_id}")
def companion_custom_image(char_id: str):
    """立绘 BLOB 下发。char_id 含 8 位随机段不可枚举，浏览器可缓存。"""
    got = db.get_custom_companion_image((char_id or "").strip()[:40])
    if not got:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    img_b, mime = got
    return Response(content=img_b, media_type=mime,
                    headers={"Cache-Control": "private, max-age=86400"})


@app.post("/api/companion/custom/delete")
def companion_custom_delete(req: CustomCompanionDeleteRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    cid = (req.char_id or "").strip()[:40]
    if not cid.startswith("cu_"):
        return {"ok": False, "error": "内置角色不能删除"}
    ok = db.delete_custom_companion(cid, profile["nickname"])
    if not ok:
        return {"ok": False, "error": "角色不存在或已删除"}
    db.purge_custom_companion(cid, profile["nickname"])   # 聊天/偏好/亲密度/会话/讲解链一起清（2026-10-09）
    return {"ok": True}


# ---------------- AI 造角色（2026-10-09）：照片 → seedream Q版立绘，每账号终身 3 次 ----------------

@app.post("/api/companion/custom/ai-gen")
def companion_custom_ai_gen(req: CustomAiGenRequest):
    """AI 造角色·第一步：照片 → AI 画成 Q 版立绘（生图成功才扣终身次数，暂存 10 分钟）。"""
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    import aichar
    left = aichar.ai_char_left(uid)
    if left <= 0:
        return {"ok": False, "error": "AI 画角色的 3 次机会已经用完啦，且行且珍惜~", "left": 0}
    mime = (req.mime or "image/jpeg").strip() or "image/jpeg"
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        mime = "image/jpeg"
    r = aichar.gen_companion_art(req.image, mime, (req.hint or "").strip()[:60])
    if not r.get("ok"):
        return {"ok": False, "error": r.get("error") or "生成失败，请稍后再试", "left": left}
    left = aichar.ai_char_consume(uid)   # 生图成功才扣（API 挂掉不扣）
    gen_id = aichar.stash_put(uid, base64.b64decode(r["image_b64"]), float(r.get("ratio") or 0.5))
    return {"ok": True, "gen_id": gen_id,
            "preview": "data:image/png;base64," + r["image_b64"],
            "left": left, "mock": bool(r.get("mock"))}


@app.post("/api/companion/custom/ai-save")
def companion_custom_ai_save(req: CustomAiSaveRequest):
    """AI 造角色·第二步：确认保存（凭 gen_id 取服务端暂存图；已有自定义角色则替换）。"""
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    import aichar
    png_b = aichar.stash_peek(uid, (req.gen_id or "").strip()[:24])
    if not png_b:
        return {"ok": False, "error": "生成结果已过期（30 分钟内有效），请重新生成"}
    name = (req.name or "").strip()[:6]
    if not name:
        return {"ok": False, "error": "先给 TA 起个名字吧（最多 6 个字）"}
    tpl = CUSTOM_PERSONA_TEMPLATES.get((req.template or "").strip())
    if not tpl:
        return {"ok": False, "error": "请选择一个性格模板"}
    extra = (req.extra or "").strip()[:120]
    # 每账号至多 1 个自定义角色：保存前替换旧角色（purge 连聊天/亲密度一起清，与删除同语义）
    replaced = 0
    for row in db.list_custom_companions(uid):
        if db.delete_custom_companion(row["id"], uid):
            db.purge_custom_companion(row["id"], uid)
            replaced += 1
    # persona：模板打底 + LLM 融合（纯拼接，禁 .format 防花括号被吃）
    persona = tpl["base"]
    try:
        fuse = ("你是角色人设师。为学习伙伴写一段人设（80~300字，第三人称，口语化，含性格与学习风格），"
                "只输出人设正文。名字：" + name + "。性格基调：" + tpl["base"] + "。"
                + ("用户补充：" + extra + "。" if extra else ""))
        raw = service.chat_text([{"role": "user", "content": fuse}],
                                temperature=0.8, slot=service.COMPANION_SLOT, timeout=90)
        fused = (raw or "").strip().strip('"').strip()
        if 80 <= len(fused) <= 400 and "```" not in fused:
            persona = fused[:600]
    except Exception:
        log.exception("ai-char persona fusion failed")
    from PIL import Image as PILImage
    import io as _io   # main.py 未顶层导入 io（与当年缺 import re 同款坑）
    im = PILImage.open(_io.BytesIO(png_b))
    ratio = round(im.width / max(1, im.height), 4)
    if not (0.1 <= ratio <= 3.0):
        ratio = 0.5
    char_id = "cu_" + uuid.uuid4().hex[:8]
    lines = _gen_custom_lines(name, persona)
    now_ms = int(_t.time() * 1000)
    db.save_custom_companion({
        "char_id": char_id, "user_id": uid, "name": name, "persona": persona,
        "ratio": ratio, "image": png_b, "image_mime": "image/png",
        "lines": lines, "created_at": now_ms,
    })
    row = db.get_custom_companion(char_id, uid)
    aichar.stash_discard(uid, (req.gen_id or "").strip()[:24])   # 落库成功才销毁暂存（2026-10-09 幂等修复）
    return {"ok": True, "char": _custom_char_payload(row), "replaced": replaced}


@app.post("/api/companion/custom/ai-update")
def companion_custom_ai_update(req: CustomAiUpdateRequest):
    """AI 造角色·编辑（2026-10-09）：char_id 不变原地更新，聊天/亲密度保留。
    gen_id 空 = 只改名字/性格/台词（沿用旧形象，不扣生图次数）；非空 = 换新形象（重画已在 ai-gen 扣过额度）。"""
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    cid = (req.char_id or "").strip()[:40]
    if not cid.startswith("cu_"):
        return {"ok": False, "error": "内置角色不支持编辑"}
    old = db.get_custom_companion(cid, uid)
    if not old:
        return {"ok": False, "error": "角色不存在"}
    name = (req.name or "").strip()[:6] or old["name"]
    tpl = CUSTOM_PERSONA_TEMPLATES.get((req.template or "").strip())
    if not tpl:
        return {"ok": False, "error": "请选择一个性格模板"}
    extra = (req.extra or "").strip()[:120]
    import aichar
    # 形象：gen_id 非空取暂存新图；否则沿用旧 BLOB（get_custom_companion 不含 image 列，走 image 接口取）
    if (req.gen_id or "").strip():
        png_b = aichar.stash_peek(uid, req.gen_id.strip()[:24])
        if not png_b:
            return {"ok": False, "error": "新形象已过期（30 分钟内有效），请重新生成"}
        img_mime = "image/png"
        from PIL import Image as PILImage
        import io as _io
        _im = PILImage.open(_io.BytesIO(png_b))
        ratio = round(_im.width / max(1, _im.height), 4)
        if not (0.1 <= ratio <= 3.0):
            ratio = 0.5
    else:
        got = db.get_custom_companion_image(cid)
        png_b, img_mime = got if got else (b"", "image/png")
        ratio = float(old.get("ratio") or 0.5)
    # persona：模板 + 补充重新融合（纯拼接，禁 .format）；台词重新生成
    persona = tpl["base"]
    try:
        fuse = ("你是角色人设师。为学习伙伴重写一段人设（80~300字，第三人称，口语化，含性格与学习风格），"
                "只输出人设正文。名字：" + name + "。性格基调：" + tpl["base"] + "。"
                + ("用户补充：" + extra + "。" if extra else ""))
        raw = service.chat_text([{"role": "user", "content": fuse}],
                                temperature=0.8, slot=service.COMPANION_SLOT, timeout=90)
        fused = (raw or "").strip().strip('"').strip()
        if 80 <= len(fused) <= 400 and "```" not in fused:
            persona = fused[:600]
    except Exception:
        log.exception("ai-char persona re-fusion failed")
    lines = _gen_custom_lines(name, persona)
    now_ms = int(_t.time() * 1000)
    db.save_custom_companion({          # INSERT OR REPLACE：char_id 不变 → 聊天/亲密度天然保留
        "char_id": cid, "user_id": uid, "name": name, "persona": persona,
        "ratio": ratio, "image": png_b, "image_mime": img_mime,
        "lines": lines, "created_at": old.get("created_at") or now_ms,
    })
    row = db.get_custom_companion(cid, uid)
    if (req.gen_id or "").strip():
        aichar.stash_discard(uid, req.gen_id.strip()[:24])   # 落库成功才销毁（2026-10-09 幂等修复）
    return {"ok": True, "char": _custom_char_payload(row)}


@app.post("/api/companion/quiz")
def companion_quiz(req: CompanionQuizRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    uid = profile["nickname"]
    cid = (req.character or "default").strip()[:40]
    name = (req.name or "小伙伴").strip()[:12]
    persona = (req.persona or "活泼友好的学习搭子").strip()[:600]
    action = (req.action or "start").strip()
    sid = (req.session_id or "").strip()[:40]   # p20：考题/链绑定会话（进度隔离）

    # peek：行走角色冒泡取题，只读、不计数、不落库
    if action == "peek":
        it, src = _pick_quiz_item(uid, read_only=True)   # 只读：不推进轮换、不写去重
        if not it:
            return {"ok": True, "empty": True}
        return {"ok": True, "empty": False, **_quiz_public(it), "source": src}

    if action == "start":
        quota_key = f"compquiz:{uid}"
        allowed, used = quota.daily_check(quota_key, QUIZ_DAILY_LIMIT)
        if not allowed:
            return {"ok": False, "error": f"今天已经考了 {used} 轮啦，明天再来吧~",
                    "quota_exhausted": True, "quota_kind": "quiz"}
        it, src = _pick_quiz_item(uid, question_id=req.question_id)
        if not it:
            return {"ok": True, "empty": True,
                    "reply": "我把你的错题本和题库都翻遍了，暂时没有能考你的题，先去刷几道再来找我吧~"}
        quota.daily_incr(quota_key)
        pub = _quiz_public(it)
        try:
            db.add_companion_msg(uid, cid, "assistant", "quiz", pub["question"],
                                 {"source": src, "question_id": pub["question_id"]}, session_id=sid)
            db.auto_title_session(uid, sid, pub["question"])   # p20：首题自动命名
        except Exception:
            log.exception("quiz start persist failed")
        return {"ok": True, "empty": False, **pub, "source": src,
                "left": max(0, QUIZ_DAILY_LIMIT - (used + 1))}

    if action == "answer":
        ans = (req.answer or "").strip()
        if not ans:
            return {"ok": False, "error": "先说说你的答案或思路嘛"}
        ans = ans[:2000]
        question = (req.question or "").strip()[:500]
        # 防刷：同一用户答题调用走滑动窗口（出题时已计轮次，答题不再扣）
        if not quota.window_allow(f"compquizans:{uid}", RUN_WINDOW_LIMIT, RUN_WINDOW_SECONDS):
            return {"ok": False, "error": "答题太快啦，缓一缓再发"}
        it, _src = _pick_quiz_item(uid, question_id=req.question_id)
        reference = ""
        if it and str(it.get("id")) == str(req.question_id):
            ref_parts = []
            if it.get("answer"):
                ref_parts.append("答案：" + str(it["answer"])[:400])
            if it.get("keyBreakthrough"):
                ref_parts.append("关键点：" + str(it["keyBreakthrough"])[:200])
            if it.get("steps"):
                ref_parts.append("步骤：" + "；".join(str(s)[:120] for s in it["steps"][:4]))
            reference = " ｜ ".join(ref_parts)[:1200]
        if not question:
            question = str(it.get("question") or "")[:500] if it else ""
        messages = [{"role": "system", "content": QUIZ_CRITIQUE_PROMPT.format(
            name=name, persona=persona, question=question or "（题目缺失）",
            reference=reference or "（无参考答案，凭你的知识判断）", answer=ans)}]
        try:
            reply = service.chat_text(messages, temperature=0.6, slot=service.COMPANION_SLOT, timeout=90)
            reply = (reply or "").strip() or "嗯……我还没想好怎么点评，再讲一遍好不好？"
            # P1-1：点评 prompt 已要求输出 JSON，解析 verdict 供前端切脸；解析失败降级纯文本
            verdict = ""
            try:
                obj = _extract_json_obj(reply)
                if isinstance(obj, dict) and obj.get("reply"):
                    v = str(obj.get("verdict") or "").strip().lower()
                    verdict = v if v in ("pass", "partial", "wrong") else ""
                    reply = str(obj["reply"]).strip()
            except Exception:
                pass
            # 考你也涨亲密度：答对 +2，部分 +1，答错不涨（2026-10-09）
            if verdict:
                try:
                    _intimacy_gain(uid, cid, 2 if verdict == "pass" else (1 if verdict == "partial" else 0))
                except Exception:
                    pass
            _, used = quota.daily_check(f"compquiz:{uid}", QUIZ_DAILY_LIMIT)
            try:
                db.add_companion_msg(uid, cid, "user", "quiz", ans,
                                     {"source": req.source or "", "question_id": req.question_id}, session_id=sid)
                db.add_companion_msg(uid, cid, "assistant", "quiz", reply,
                                     {"source": req.source or "", "question_id": req.question_id}, session_id=sid)
            except Exception:
                log.exception("quiz answer persist failed")
            return {"ok": True, "reply": reply, "verdict": verdict, "left": max(0, QUIZ_DAILY_LIMIT - used)}
        except Exception:
            log.exception("quiz critique failed")
            return {"ok": False, "error": "TA 刚走神了一下，再发一次好不好？"}

    # ---- 小老师模式：角色求教，用户当老师（不计 10 轮/日额度，仅限速防滥用） ----
    if action == "chain_start":
        # 断点续教：本会话内有未完成链直接接着上次的层继续（p20：链绑定会话）
        old = db.get_active_quiz_chain(uid, session_id=sid)
        if old and old.get("steps"):
            steps = old["steps"]
            idx = min(int(old.get("progress") or 0), len(steps) - 1)
            it, src = _pick_quiz_item(uid, question_id=old["question_id"])
            pub = _quiz_public(it) if it else {"question_id": old["question_id"], "question": "", "subject": "未分类", "knowledge_points": []}
            try:
                db.add_companion_msg(uid, cid, "assistant", "quiz",
                                     "这道%s题上次还是没讲完……我们接着聊好不好？" % (_subject_short(pub.get("subject")) or ""),
                                     {"source": "小老师·续", "question_id": old["question_id"], "chain_id": old["id"]},
                                     session_id=sid)
            except Exception:
                pass
            _head = "这道%s题上次还是没讲完……我们接着聊好不好？" % (_subject_short(pub.get("subject")) or "")
            return {"ok": True, "mode": "teacher", "resume": True, "head": _head, "chain_id": old["id"],
                    "total": len(steps), "step_idx": idx, "ask": steps[idx].get("ask", ""),
                    **pub, "source": src or "小老师·续"}
        it, src = _pick_quiz_item(uid, question_id=req.question_id)
        if not it:
            return {"ok": True, "empty": True,
                    "reply": "我把错题本和题库都翻遍了，暂时没有想请教的题，先去刷几道再来找我吧~"}
        reference = _chain_reference(it)
        steps = None
        try:
            raw = service.chat_text(
                [{"role": "system", "content": CHAIN_GEN_PROMPT.format(reference=reference)}],
                temperature=0.4, slot=service.COMPANION_SLOT, timeout=90)
            obj = _extract_json_obj(raw or "")
            cand = (obj or {}).get("steps") or []
            clean = []
            for s in cand:
                if isinstance(s, dict) and str(s.get("ask") or "").strip():
                    clean.append({"ask": str(s["ask"]).strip()[:200],
                                  "expected": str(s.get("expected") or "").strip()[:300],
                                  "hint": str(s.get("hint") or "").strip()[:200]})
            if 2 <= len(clean) <= 6:
                steps = clean
        except Exception:
            log.exception("chain generate failed")
        if not steps:
            # 降级：从错题条目手工拼 3 层，保证功能不因模型抖动而瘫（带科目、够具体）
            kb = str(it.get("keyBreakthrough") or it.get("answer") or "这道题的关键思路")
            st = it.get("steps") or []
            subj = _subject_short(it.get("subject"))
            q0 = ("这道%s题" % subj) if subj else "这道题"
            steps = [
                {"ask": q0 + "问的是什么呀？要把哪些条件用起来？", "expected": "复述题意与条件", "hint": "再读一遍题目，把已知条件列出来"},
                {"ask": "解" + (subj or "这道题") + "的第一步应该从哪里入手？", "expected": kb[:200], "hint": "想想这道题属于哪种类型，从哪个公式/定理入手"},
                {"ask": "那最后答案是怎么得出来的呀？", "expected": str(it.get("answer") or "")[:200], "hint": "顺着刚才的思路推到底就是答案啦"},
            ] + ([{"ask": "这类" + (subj or "") + "题有什么容易踩的坑吗？", "expected": st[0] if st else "指出易错点", "hint": "回想老师强调过的地方"}] if st else [])
        chain_id = uuid.uuid4().hex[:16]
        pub = _quiz_public(it)
        ch = {"id": chain_id, "question_id": str(it.get("id") or ""), "question": str(it.get("question") or ""),
              "subject": str(pub.get("subject") or ""), "steps": steps,
              "progress": 0, "streak": 0, "wrong_steps": [], "status": "active", "session_id": sid}   # question/subject 就地存档（2026-10-08：反查题源不可靠）
        db.save_quiz_chain(uid, ch)
        _head = "这道%s题我卡了好久，怎么都想不通，你能给我讲讲吗？" % (_subject_short(pub.get("subject")) or "")
        try:
            # 画像联动：讲崩过的知识点 → 开场白带一句记忆，让伴学与错题数据打通可见
            _head = quiz_pick.profile_hint(uid, (it or {}).get("knowledgePoints") or []) + _head
        except Exception:
            pass
        try:
            db.add_companion_msg(uid, cid, "assistant", "quiz", _head,
                                 {"source": src, "question_id": pub["question_id"], "chain_id": chain_id},
                                 session_id=sid)
            db.auto_title_session(uid, sid, pub["question"])   # p20：首题自动命名
        except Exception:
            pass
        return {"ok": True, "mode": "teacher", "head": _head, "chain_id": chain_id, "total": len(steps),
                "step_idx": 0, "ask": steps[0].get("ask", ""), **pub, "source": src}

    if action == "chain_answer":
        ans = (req.answer or "").strip()
        if not ans:
            return {"ok": False, "error": "先讲讲你的思路嘛"}
        ans = ans[:2000]
        ch = db.get_quiz_chain(uid, req.chain_id)
        if not ch:
            return {"ok": False, "error": "找不到这条问题链了，重新点一次气泡吧"}
        if ch["status"] != "active":
            return {"ok": True, "finished": True, "verdict": "pass", "reply": "这道题咱们已经聊完啦，想再巩固的话去错题本看看吧~"}
        steps = ch["steps"]
        idx = min(int(ch.get("progress") or 0), len(steps) - 1)
        if not quota.window_allow(f"chainans:{uid}", 6, 30):
            return {"ok": False, "error": "讲得太快啦，缓一缓再发"}
        cur = steps[idx]
        it, _src = _pick_quiz_item(uid, question_id=ch["question_id"])
        reference = (_chain_reference(it)
                     if it and str(it.get("id")) == str(ch["question_id"])
                     else "（无参考材料，凭题面与要点谨慎判断）")
        verdict, reply = "partial", ""
        intent = "explain"
        favor = None
        try:
            raw = service.chat_text([{"role": "system", "content": CHAIN_JUDGE_PROMPT.format(
                name=name, persona=persona, ask=cur.get("ask", ""), expected=cur.get("expected", ""),
                reference=reference, answer=ans)}], temperature=0.6, slot=service.COMPANION_SLOT, timeout=90)
            obj = _extract_json_obj(raw or "")
            if obj and str(obj.get("reply") or "").strip():
                reply = str(obj["reply"]).strip()[:300]
                # 意图识别（walkdep16）：question=提问/闲聊 → 以人设回答，不判分不推进；
                # explain=讲解 → 隐性三态判定（服务端确定性钳位），好感增量替代三维分数
                if str(obj.get("intent") or "").strip().lower() == "question":
                    intent, verdict = "question", "question"
                else:
                    v = str(obj.get("verdict") or "").strip().lower()
                    verdict = v if v in ("pass", "partial", "wrong") else "partial"
                try:
                    favor = max(0, min(10, int(obj.get("favor"))))
                except Exception:
                    favor = None
            else:
                # 2026-10-08：解析失败绝不把裸 JSON 上屏（线上曾出现 {"intent":...} 原文直接展示）
                if (raw or "").lstrip().startswith("{"):
                    reply = "嗯……这层我还没消化透，你再讲一遍好不好？"
                else:
                    reply = (raw or "").strip()[:300] or "嗯……我还没完全消化，再讲一遍好不好？"
        except Exception:
            log.exception("chain judge failed")
            return {"ok": False, "error": "TA 刚走神了一下，再讲一次好不好？"}
        # 判定收紧（2026-10-08 与用户定稿）：极简应答不许 pass——只有应答词没有实质要点时降为 partial，
        # 回复用该层 hint 追问（确定性覆盖，防止模型口头 pass 但没讲出东西）
        if intent == "explain" and verdict == "pass" and _is_thin_answer(ans):
            verdict = "partial"
            reply = "欸，光答应我可不行呀～" + (str(cur.get("hint") or "把我卡住的那个点给我讲讲嘛"))[:140]
        # 好感（亲密度）：按讲解质量由模型给增量（讲清 4-6 / 出色 7-10 / 部分 2-4 / 没讲对 0-2）；
        # 模型没给 favor 时按 verdict 兜底。提问/闲聊不推进关卡、不涨好感。
        if favor is None:
            favor = 5 if verdict == "pass" else (2 if verdict == "partial" else 0)
        if intent != "question" and favor > 0:
            try:
                _intimacy_gain(uid, cid, favor)
            except Exception:
                log.exception("intimacy layer gain failed")
        if intent == "question":
            # 提问/闲聊分支：链状态完全不动，只把对话落进历史（保持上下文连贯）
            try:
                db.add_companion_msg(uid, cid, "user", "quiz", ans,
                                     {"source": "小老师", "question_id": ch["question_id"], "chain_id": ch["id"], "step": ch["progress"]},
                                     session_id=ch.get("session_id") or "")
                db.add_companion_msg(uid, cid, "assistant", "quiz", reply,
                                     {"source": "小老师", "question_id": ch["question_id"], "chain_id": ch["id"], "step": ch["progress"]},
                                     session_id=ch.get("session_id") or "")
            except Exception:
                pass
            out = {"ok": True, "mode": "teacher", "intent": "question", "verdict": "question", "reply": reply,
                   "chain_id": ch["id"], "total": len(steps), "finished": False, "favor": 0}
            try:
                out["intimacy"] = db.get_intimacy(uid, cid)
            except Exception:
                pass
            out["step_idx"] = ch["progress"]
            return out
        wrong_steps = list(ch.get("wrong_steps") or [])
        streak = int(ch.get("streak") or 0)
        layer_tries = int(ch.get("layer_tries") or 0)
        finished = False
        summary = ""
        if verdict == "pass":
            streak, layer_tries = 0, 0
            idx += 1
        else:
            if verdict == "wrong":
                streak += 1
            layer_tries += 1
            # 同层累计 2 次未过（无论 wrong/partial）：揭晓 + 跳下一层
            # （2026-10-08 与用户定稿：不再无限追问；原机制只有"连续两错"才跳，partial 会永远停留）
            if streak >= 2 or layer_tries >= 2:
                try:
                    reply = service.chat_text([{"role": "system", "content": CHAIN_REVEAL_PROMPT.format(
                        name=name, persona=persona, ask=cur.get("ask", ""), expected=cur.get("expected", ""))}],
                        temperature=0.6, slot=service.COMPANION_SLOT, timeout=90)
                    reply = (reply or "").strip()[:300] or "我自己琢磨明白了：其实" + str(cur.get("expected") or "")[:120]
                except Exception:
                    reply = "我自己琢磨明白了：其实——" + str(cur.get("expected") or "")[:150]
                if idx not in wrong_steps:
                    wrong_steps.append(idx)
                streak, layer_tries = 0, 0
                idx += 1
                verdict = "wrong"
        # partial：停留本层，等小老师补全（触发上面 layer_tries 上限前）
        if idx >= len(steps):
            ch["status"] = "done"
            finished = True
        ch["progress"] = min(idx, len(steps))
        ch["streak"] = streak
        ch["layer_tries"] = layer_tries
        ch["wrong_steps"] = wrong_steps
        # 三维分数已移除（walkdep16 改好感制）；旧链遗留的 ch["scores"] 原样保留不追加
        db.save_quiz_chain(uid, ch)
        if finished:
            summary = _settle_chain(uid, ch, steps, cid=cid, name=name, persona=persona,
                                    question=str((it or {}).get("question") or ""))
        try:
            db.add_companion_msg(uid, cid, "user", "quiz", ans,
                                 {"source": "小老师", "question_id": ch["question_id"], "chain_id": ch["id"], "step": ch["progress"]},
                                 session_id=ch.get("session_id") or "")
            db.add_companion_msg(uid, cid, "assistant", "quiz", reply,
                                 {"source": "小老师", "question_id": ch["question_id"], "chain_id": ch["id"], "step": ch["progress"]},
                                 session_id=ch.get("session_id") or "")
        except Exception:
            pass
        out = {"ok": True, "mode": "teacher", "verdict": verdict, "reply": reply, "favor": favor,
               "chain_id": ch["id"], "total": len(steps), "finished": finished}
        try:
            out["intimacy"] = db.get_intimacy(uid, cid)
        except Exception:
            pass
        if summary:
            out["summary"] = summary
        if not finished:
            out["step_idx"] = ch["progress"]
            out["ask"] = steps[ch["progress"]].get("ask", "")
        return out

    return {"ok": False, "error": "未知的问答操作"}


@app.post("/api/companion/asr")
def companion_asr(req: CompanionAsrRequest):
    profile = auth.parse_token(req.token) if req.token else None
    if not profile:
        return {"ok": False, "error": GUEST_LINE}
    if not service.ARK_ASR_API_KEY:
        return {"ok": False, "error": "语音服务还没配置好，先打字聊吧"}
    audio = (req.audio_base64 or "").strip()
    if not audio:
        return {"ok": False, "error": "没有收到录音"}
    if len(audio) > ASR_MAX_B64_CHARS:
        return {"ok": False, "error": "录音太长啦，请说 60 秒以内"}
    if not quota.window_allow(f"asr:{profile['nickname']}", ASR_WINDOW_LIMIT, ASR_WINDOW_SECONDS):
        return {"ok": False, "error": "语音请求太频繁，缓一缓再试"}
    try:
        text = service.transcribe_audio(audio, fmt="wav", timeout=45)
    except Exception:
        log.exception("companion asr failed")
        return {"ok": False, "error": "语音识别开小差了，再试一次或直接打字吧"}
    text = (text or "").strip().strip('"“”\'\'')   # 模型对无声/未识别音频有时输出引号，剥掉
    if not text:
        return {"ok": False, "error": "没听清你说什么，再录一次试试？"}
    return {"ok": True, "text": text[:1000]}


# ---------------------------------------------------------------- 同类练习题生成

GEN_QUIZ_PROMPT = """你是大学理工科教师，负责出题。请根据给定的知识点生成一道练习题。

要求：
1. 题目必须考察该知识点，难度适中（本科课程水平）。
2. 答案要唯一明确，便于自动判分（优先计算题、简答题；编程题要能运行验证）。
3. 若提供了参考原题，新题要考察同一知识点但换数据、换场景或换角度，禁止照抄原题。
4. 解析要讲清楚思路，让学生看懂「为什么」，而不只是给结果。

只输出 JSON，格式：
{"question": "题目（可用 LaTeX，行内公式用 $...$）",
 "answer": "参考答案",
 "analysis": "解析（讲清思路与关键步骤）",
 "knowledge_points": ["知识点1", "知识点2"],
 "subject": "学科",
 "question_type": "题型"}"""


# 模拟考试：一次生成整张试卷 / 一次批改整卷主观题
MAX_PAPER_QUESTIONS = 25

PAPER_PROMPT = """你是大学理工科教师，负责按指定题型配比出一套 100 分制模拟试卷。
要求：
1. 严格按给定的题型与数量出题；每题分值已由系统指定，你不需要自己算总分。
2. 题目必须考察给定知识点，难度为本科课程水平；题目之间尽量覆盖不同知识点，不要反复考同一个点。
3. 选择题：4 个选项（放进 options 数组，形如 "A. xxx"），只有一个正确答案，answer 只填选项字母（如 "B"）。
4. 填空题：题干中用 ____ 表示空位（每题一个空），answer 填标准答案。
5. 解答题：answer 给出完整参考答案和关键步骤。
6. explanation 要讲清思路，让学生看懂「为什么」，而不只是给结果。

只输出 JSON（不要任何解释文字），格式：
{"title": "试卷标题（含学科与考察范围）",
 "questions": [
   {"type": "choice", "question": "题干（可用 LaTeX，行内公式用 $...$）",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "B", "explanation": "解析", "knowledge_points": ["知识点1"]},
   {"type": "blank", "question": "含 ____ 的题干", "answer": "标准答案",
    "explanation": "解析", "knowledge_points": ["知识点1"]},
   {"type": "solution", "question": "题干", "answer": "参考答案与步骤",
    "explanation": "解析", "knowledge_points": ["知识点1"]}
 ]}"""

TEST_PAPER_PROMPT = """你是大学理工科教师，为一次班级限时测试出题（只有选择题和填空题，不出解答题）。

要求：
1. 严格按给定的题型与数量出题；每题分值已由系统指定，不需要自己算总分。
2. 题目考察给定学科与范围，难度为本科课程水平；题目之间覆盖不同知识点。
3. 选择题：4 个选项（放进 options 数组，形如 "A. xxx"），只有一个正确答案，answer 只填选项字母（如 "B"）。
4. 填空题：题干中用 ____ 表示空位（每题一个空），answer 必须是**最简标准形式**（数值用最简分数或小数，不要写过程、不要带单位除非题干要求）。
5. 题干可用 LaTeX，行内公式用 $...$。

只输出 JSON（不要任何解释文字），格式：
{"questions": [
   {"type": "choice", "question": "题干",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "B"},
   {"type": "blank", "question": "含 ____ 的题干", "answer": "标准答案"}
 ]}"""

JUDGE_PAPER_PROMPT = """你是大学理工科阅卷老师，正在批改一份试卷的主观题，请逐题判分。

判分要求：
1. 严格对照「参考答案」，但等价表达要算对（如 1/2 与 0.5、0.5 与 .5、x^2 与 x²、带不带单位、顺序不同的等价写法）。
2. 解答题按步骤给分：思路正确但结果错给部分分；只写结果没有过程酌情扣分。
3. 空白或完全跑题的作答给 0 分。
4. comment 用一两句话说明得分理由（错在哪、缺什么），像老师讲评，不要空话套话。

只输出 JSON（不要任何解释文字），格式：
{"results": [{"id": 题号（与输入保持一致）, "got": 得分数字（0 ~ 该题满分）, "comment": "评语"}]}"""

# ---------------- 班级作业批改 / 班级报告 ----------------

GRADE_HOMEWORK_PROMPT = """你是大学理工科的老师，正在批改一名学生拍照提交的作业。

【作业要求】
{content}
{reference_block}
【学生手写作业的逐字转录】
{transcript}

批改要求：
1. 严格对照作业要求逐题判对错；等价表达算对（1/2 与 0.5、x^2 与 x² 等）。
2. 学生只写了一部分题就只批那部分；没写的题记为「未作答」，得分按 0 计但 comment 说明是未作答。
3. 若转录内容与作业要求完全无关，总分给 0 并在 overall 里说明。
4. 评语像老师讲评：指出错在哪一步、缺什么概念，一两句话，不要空话；对做对的题可简短肯定。

只输出 JSON（不要任何解释文字），格式：
{"score": 得分（0~100 的整数）,
 "items": [{"question": "题目或要求的关键词", "verdict": "正确|部分正确|错误|未作答", "comment": "该题评语"}],
 "overall": "总体评价（两三句话：主要问题 + 下一步建议）"}"""

CLASS_REPORT_PROMPT = """你是大学理工科的老师，刚批改完全班提交的一份作业。以下是批改结果汇总（JSON）：

{graded}

请从教学视角生成一份班级报告：
1. stats：应交/实交/批改数、平均分、最高/最低分、分数段分布（90-100/70-89/60-69/<60）。
2. common_issues：共性错误 Top3（按出现次数），每条 {point, count, detail}。
3. teaching_advice：2~4 条教学建议（下一节课该重点讲什么、可以布置什么练习）。
4. excellent：表现最好的 1~3 名学生昵称。

只输出 JSON（不要任何解释文字），格式：
{"stats": {"total": 应交, "submitted": 实交, "graded": 已批, "avg": 平均分, "max": 最高, "min": 最低,
           "buckets": [{"range": "90-100", "count": 0}, {"range": "70-89", "count": 0},
                        {"range": "60-69", "count": 0}, {"range": "<60", "count": 0}]},
 "common_issues": [{"point": "知识点/错误类型", "count": 出现次数, "detail": "说明"}],
 "teaching_advice": ["建议1", "建议2"],
 "excellent": ["昵称"]}"""


def _grade_one_submission(hw: dict, sub: dict) -> dict:
    """批改单个提交：转录手写（多图逐张拼接）→ 对照作业要求判分。抛异常由调用方处理。"""
    transcript = (sub.get("transcript") or "").strip()
    if not transcript:
        imgs = db.get_submission_images(sub["homework_id"], sub["user_id"])
        if imgs:
            # analyze_images 的转写文本在 question 键（按「第 N 页」拼接）
            data = service.analyze_images(imgs, mode="answer")
            transcript = str(data.get("question") or "").strip()
        elif sub.get("image"):
            data = service.analyze_image(sub["image"], "image/jpeg", mode="answer")
            transcript = str(data.get("question") or "").strip()
        if not transcript:
            # 纯文字提交（无图）：直接用学生填写的文字说明作答内容
            transcript = (sub.get("note") or "").strip()
        if not transcript:
            raise ValueError("作业图片无法识别出文字内容")
    reference = str(hw.get("reference") or "").strip()
    reference_block = ("\n【参考答案 / 评分要点】\n" + reference) if reference else ""
    prompt = (GRADE_HOMEWORK_PROMPT
              .replace("{content}", str(hw.get("content") or "")[:4000])
              .replace("{reference_block}", reference_block[:2000])
              .replace("{transcript}", transcript[:6000]))
    text = service.chat_text(
        [{"role": "user", "content": prompt}], temperature=0.2,
        slot=service.JUDGE_SLOT, timeout=180,
    )
    result = service.extract_json(text)
    try:
        score = float(result.get("score"))
    except (TypeError, ValueError):
        score = 0.0
    score = max(0.0, min(100.0, score))
    items = result.get("items") if isinstance(result.get("items"), list) else []
    return {
        "score": round(score),
        "items": items[:20],
        "overall": str(result.get("overall") or "").strip()[:800],
        "transcript": transcript[:3000],
    }


def _mock_grade_one(hw: dict) -> dict:
    return {
        "score": 85,
        "items": [
            {"question": "第 1 题", "verdict": "正确", "comment": "（Mock）思路正确，结果无误。"},
            {"question": "第 2 题", "verdict": "部分正确", "comment": "（Mock）最后一步符号写错。"},
        ],
        "overall": "（Mock）整体掌握不错，注意第 2 题的计算细节。",
        "transcript": "（Mock 转录）1. 解：…… 2. 解：……",
    }


@app.post("/api/generate-quiz")
def generate_quiz(req: GenerateQuizRequest):
    kps = [k for k in (req.knowledge_points or []) if str(k).strip()]
    if not kps and not req.reference_question.strip():
        return {"ok": False, "error": "缺少知识点或参考题"}
    prompt = GEN_QUIZ_PROMPT
    if req.subject.strip():
        prompt += "\n\n学科：" + req.subject.strip()
    if kps:
        prompt += "\n\n要考察的知识点：" + "、".join(str(k) for k in kps)
    if req.reference_question.strip():
        prompt += "\n\n参考原题（请出同类题，不要照抄）：\n" + req.reference_question.strip()[:800]
    try:
        # 用批改位（DeepSeek-chat）：出题不需要深度推理，快且准
        text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.7, slot=service.JUDGE_SLOT)
        data = service.extract_json(text)
        if not data.get("question"):
            return {"ok": False, "error": "生成失败，请重试"}
        return {"ok": True, "data": data}
    except Exception as e:
        log.exception("generate-quiz failed")
        return {"ok": False, "error": f"出题失败：{e}"}


def _normalize_paper(questions: list, plan: list) -> list:
    """把模型返回的题目按题型归位到 plan 槽位，并统一赋分（保证总分与计划一致）。"""
    buckets = {"choice": [], "blank": [], "solution": []}
    for q in questions if isinstance(questions, list) else []:
        if not isinstance(q, dict):
            continue
        t = str(q.get("type") or "").strip()
        if t in buckets:
            buckets[t].append(q)
    out = []
    idx = 0
    for p in plan:
        t = p["type"]
        count = int(p.get("count") or 0)
        score = int(p.get("score") or 0)
        pool = buckets.get(t, [])
        for i in range(count):
            if i >= len(pool):
                break
            q = pool[i]
            question = str(q.get("question") or "").strip()
            if not question:
                continue
            idx += 1
            item = {
                "id": idx,
                "type": t,
                "question": question,
                "answer": str(q.get("answer") or "").strip(),
                "explanation": str(q.get("explanation") or q.get("analysis") or "").strip(),
                "knowledgePoints": [str(x) for x in (q.get("knowledge_points") or []) if str(x).strip()][:6],
                "score": score,
            }
            if t == "choice":
                opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
                item["options"] = opts[:4]
                item["answer"] = (item["answer"] or "")[:1].upper()
            out.append(item)
    return out


@app.post("/api/generate-paper")
def generate_paper(req: GeneratePaperRequest):
    """一次生成整张 100 分制模拟卷（分值由 plan 决定，模型只负责出题内容）。"""
    plan = []
    for p in req.plan if isinstance(req.plan, list) else []:
        if not isinstance(p, dict):
            continue
        t = str(p.get("type") or "")
        cnt = int(p.get("count") or 0)
        if t in ("choice", "blank", "solution") and cnt > 0:
            plan.append({"type": t, "count": cnt, "score": int(p.get("score") or 0)})
    if not plan:
        return {"ok": False, "error": "请先选择题型与题量"}
    total_count = sum(p["count"] for p in plan)
    if total_count > MAX_PAPER_QUESTIONS:
        return {"ok": False, "error": f"题量过大，一次最多 {MAX_PAPER_QUESTIONS} 题"}

    kps = [str(k).strip() for k in (req.knowledge_points or []) if str(k).strip()]
    type_label = {"choice": "选择题", "blank": "填空题", "solution": "解答题"}
    lines = [f"- {type_label[p['type']]} {p['count']} 道（每题 {p['score']} 分）" for p in plan]
    prompt = PAPER_PROMPT + "\n\n题型配比：\n" + "\n".join(lines)
    if str(req.subject or "").strip():
        prompt += "\n\n学科：" + str(req.subject).strip()
    if kps:
        prompt += "\n\n考察知识点：" + "、".join(kps)
    diff_tip = {"easy": "偏基础：以概念与基本计算为主", "hard": "偏难：含综合题与常见易错点"}.get(str(req.difficulty or ""))
    if diff_tip:
        prompt += "\n\n难度：" + diff_tip

    try:
        text = service.chat_text(
            [{"role": "user", "content": prompt}], temperature=0.7,
            slot=service.JUDGE_SLOT, timeout=200,
        )
        data = service.extract_json(text)
        questions = _normalize_paper(data.get("questions"), plan)
        if len(questions) < max(1, total_count // 2):
            return {"ok": False, "error": "组卷结果不完整，请重试"}
        return {
            "ok": True,
            "data": {
                "title": str(data.get("title") or "模拟试卷").strip()[:40],
                "totalScore": sum(q["score"] for q in questions),
                "questions": questions,
            },
        }
    except Exception as e:
        log.exception("generate-paper failed")
        return {"ok": False, "error": f"组卷失败：{e}"}


@app.post("/api/judge-paper")
def judge_paper(req: JudgePaperRequest):
    """一次批改整张卷子的主观题（选择题在前端本地判，不消耗额度）。"""
    raw = [q for q in (req.questions or []) if isinstance(q, dict)]
    if not raw:
        return {"ok": False, "error": "没有需要批改的题目"}
    items = []
    for i, q in enumerate(raw[:MAX_PAPER_QUESTIONS]):
        items.append({
            "id": q.get("id") if q.get("id") is not None else i + 1,
            "question": str(q.get("question") or "")[:1500],
            "reference": str(q.get("reference") or "")[:1500],
            "user_answer": str(q.get("user_answer") or "")[:2000],
            "score": int(q.get("score") or 0),
        })
    prompt = JUDGE_PAPER_PROMPT + "\n\n待批改题目（JSON）：\n" + json.dumps(items, ensure_ascii=False)
    try:
        text = service.chat_text(
            [{"role": "user", "content": prompt}], temperature=0.2,
            slot=service.JUDGE_SLOT, timeout=240,
        )
        data = service.extract_json(text)
        results = data.get("results")
        if not isinstance(results, list):
            return {"ok": False, "error": "批改失败，请重试"}
        by_id = {}
        for r in results:
            if isinstance(r, dict) and r.get("id") is not None:
                by_id[str(r.get("id"))] = r
        out = []
        for it in items:
            r = by_id.get(str(it["id"])) or {}
            try:
                got = float(r.get("got"))
            except (TypeError, ValueError):
                got = 0.0
            got = max(0.0, min(float(it["score"]), got))
            out.append({
                "id": it["id"],
                "got": round(got, 1),
                "comment": str(r.get("comment") or "").strip()[:300],
            })
        return {"ok": True, "data": {"results": out}}
    except Exception as e:
        log.exception("judge-paper failed")
        return {"ok": False, "error": f"批改失败：{e}"}


# ---------------------------------------------------------------- 个人主页（资料 / 改名 / 注销 / 反馈）

def _check_password(profile: dict, password: str) -> bool:
    return auth.verify_password(password, profile["password_hash"], profile["salt"])


@app.post("/api/account/profile")
def account_profile(req: VerifyRequest):
    """读取个人资料 + 账号元信息（知一 ID / 加入时间）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    return {
        "ok": True,
        "profile": db.load_profile_data(profile["nickname"]),
        "nickname": profile["nickname"],
        "userId": profile.get("id"),
        "registeredAt": profile.get("registered_at") or profile.get("created_at") or 0,
    }


@app.post("/api/account/profile/save")
def account_profile_save(req: ProfileSaveRequest):
    """保存个人资料（整体覆盖）。头像以 base64 直传，这里兜一层体积上限。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    data = req.profile if isinstance(req.profile, dict) else {}
    avatar = data.get("avatar")
    if isinstance(avatar, str) and len(avatar) > 400_000:
        return {"ok": False, "error": "头像图片过大，请换一张小一点的"}
    db.save_profile_data(profile["nickname"], data)
    return {"ok": True}


@app.post("/api/account/rename")
def account_rename(req: RenameRequest):
    """改昵称（即登录名）：验密码 → 校验唯一 → 迁移三张表的 user_id → 重签 token。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    if not _check_password(profile, req.password):
        return {"ok": False, "error": "密码不正确"}
    new = (req.new_nickname or "").strip()
    old = profile["nickname"]
    if len(new) < 2 or len(new) > 20:
        return {"ok": False, "error": "昵称长度需 2-20 位"}
    if new == old:
        return {"ok": False, "error": "新昵称与当前昵称相同"}
    if db.find_profile_by_nickname(new):
        return {"ok": False, "error": "该昵称已被占用，换一个吧"}
    db.rename_user(old, new)
    new_profile = dict(db.find_profile_by_nickname(new) or {})
    token = auth.make_token(new_profile)
    return {"ok": True, "nickname": new, "userId": new, "token": token}


@app.post("/api/account/delete")
def account_delete(req: DeleteAccountRequest):
    """注销账号：验密码后清空云端全部数据（不可恢复）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    if not _check_password(profile, req.password):
        return {"ok": False, "error": "密码不正确"}
    db.delete_user(profile["nickname"])
    return {"ok": True}


@app.post("/api/account/reset-backup")
def account_reset_backup(req: ResetBackupRequest):
    """重置备份码：验密码后生成新码，明文只返回这一次。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "登录状态已失效，请重新登录"}
    if not _check_password(profile, req.password):
        return {"ok": False, "error": "密码不正确"}
    backup = auth.gen_backup_code()
    db.update_recovery_hash(profile["nickname"],
                            auth.hash_password(auth.norm_backup(backup), profile["salt"]))
    return {"ok": True, "backup": backup}


@app.post("/api/feedback")
def feedback_submit(req: FeedbackRequest):
    content = (req.content or "").strip()
    if len(content) < 5:
        return {"ok": False, "error": "反馈内容太短，麻烦多写几个字"}
    profile = auth.parse_token(req.token) if req.token else None
    db.save_feedback(profile["nickname"] if profile else "", content, req.contact, req.version)
    return {"ok": True}


# ---------------------------------------------------------------- 变式题（批次2）

@app.post("/api/variant")
def variant_api(req: VariantRequest):
    """基于原题生成变式题（同知识点换场景/换数据/换问法/换题型）。

    命中缓存直接返回并累加命中次数 —— 用户自带 Key 按量计费，同题同策略不重复调用模型。
    """
    if not req.question.strip():
        return {"ok": False, "error": "缺少原题"}
    strategy = str(req.strategy or "same_point").lower()
    if strategy not in service.VARIANT_STRATEGIES:
        strategy = "same_point"
    count = max(1, min(int(req.count or 1), 3))
    key = _variant_cache_key(req.question, req.answer, strategy, count)

    cached = db.get_variant_cache(key)
    if cached:
        return {"ok": True, "cached": True, "items": cached.get("items", [])}

    try:
        data = service.generate_variant(
            req.question, req.answer, req.subject, strategy, count,
        )
        db.put_variant_cache(key, data)
        return {"ok": True, "cached": False, "items": data.get("items", [])}
    except Exception as e:
        log.exception("variant failed")
        return {"ok": False, "error": f"生成失败：{e}"}


# ---------------------------------------------------------------- AI 对话（批次2）

@app.post("/api/chat/stream")
def chat_stream_api(req: ChatStreamRequest):
    """AI 对话流式回答。历史由前端保存；这里只做无状态生成。"""
    if not req.messages and not req.context:
        return {"ok": False, "error": "缺少对话内容"}

    def gen():
        try:
            for piece in service.chat_stream(req.messages, req.context):
                yield _sse({"delta": piece})
            yield _sse({"done": True})
        except Exception as e:
            log.exception("chat stream failed")
            yield _sse({"error": f"回答失败：{e}"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ---------------------------------------------------------------- 讲解流式（批次3）

@app.post("/api/explain/stream")
def explain_stream_api(req: ExplainRequest):
    """结构化讲解的流式版本。

    难点：讲解结果是 JSON，直接流式吐出来用户看到的是 `{"answer":"` 这种碎片。
    所以服务端做**增量字段解析**，只把「某个字段新增的文本」作为 delta 下发：
      {"field":"answer","delta":"..."}   {"field_done":"answer"}   {"done":true,"result":{...}}
    首 token 之前失败会自动降级为非流式完整调用（用户仍能拿到讲解）。
    """
    if not req.question.strip():
        return {"ok": False, "error": "题目内容为空"}

    def gen():
        try:
            for ev in service.explain_stream(req.question, req.attempt, getattr(req, "depth", "standard")):
                yield _sse(ev)
        except Exception as e:
            log.exception("explain stream failed")
            yield _sse({"error": f"讲解失败：{e}"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ---------------------------------------------------------------- 学情分析（批次4）

@app.post("/api/analyze/errorbook")
def analyze_errorbook_api(req: AnalyzeRequest):
    """错题本聚合摘要 → 薄弱点与错因建议。

    成本控制：
      - 只收聚合摘要（不传题目全文）
      - 相同摘要 24 小时内直接命中缓存（响应带 cached 标记）
      - 前端「点击才生成」，不做自动调用
    """
    summary = req.summary if isinstance(req.summary, dict) else {}
    if not summary.get("points") and not summary.get("total"):
        return {"ok": False, "error": "错题数据不足，先去拍几道题吧"}

    key = _analysis_cache_key(summary, req.sample_questions)
    cached = db.get_analysis_cache(key)
    if cached:
        data = dict(cached)
        data["cached"] = True
        return {"ok": True, "cached": True, "data": data}

    try:
        data = service.analyze_errorbook(summary, req.sample_questions)
        data["generatedAt"] = int(__import__("time").time() * 1000)
        db.put_analysis_cache(key, data)
        out = dict(data)
        out["cached"] = False
        return {"ok": True, "cached": False, "data": out}
    except Exception as e:
        log.exception("analyze failed")
        return {"ok": False, "error": f"分析失败：{e}"}


@app.post("/api/analyze/daily")
def analyze_daily_api(req: DailyAdviceRequest):
    """今日学习上下文 → 今日安排建议（首页「今日学习建议」入口）。

    成本控制：
      - 只传聚合数据（课表时段 / 到期数量 / 知识点名 / 新课进度），不传题目全文
      - 缓存键含日期 + 内容指纹：同一天同样上下文 24h 内直接命中
      - 前端「点击才生成」，不做自动调用
    """
    summary = req.summary if isinstance(req.summary, dict) else {}
    if not summary.get("lessons") and not int(summary.get("due") or 0) \
            and not (summary.get("weak_points") or []) and not summary.get("next_chapter"):
        return {"ok": False, "error": "还没有可参考的学习数据，先去拍几道题或填一下课表吧"}

    key = _analysis_cache_key(summary, None)
    cached = db.get_analysis_cache(key)
    if cached:
        data = dict(cached)
        data["cached"] = True
        return {"ok": True, "cached": True, "data": data}

    try:
        data = service.daily_advice(summary)
        data["generatedAt"] = int(__import__("time").time() * 1000)
        db.put_analysis_cache(key, data)
        out = dict(data)
        out["cached"] = False
        return {"ok": True, "cached": False, "data": out}
    except Exception as e:
        log.exception("daily advice failed")
        return {"ok": False, "error": f"生成失败：{e}"}


# ---------------------------------------------------------------- 讲解追问 / 换个讲法（SSE 流式）

# 前端用 fetch + ReadableStream 手解 SSE 帧（EventSource 不支持 POST），帧格式：data: {json}\n\n
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _analysis_cache_key(summary: dict, samples: list | None) -> str:
    """摘要 + 样例题的指纹：内容变了才重新分析。"""
    raw = json.dumps({"s": summary or {}, "q": (samples or [])[:5]}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _variant_cache_key(question: str, answer: str, strategy: str, count: int) -> str:
    """变式题缓存键：同题同策略同数量才算命中（换策略应当重新生成）。"""
    raw = "\u0001".join([
        (question or "").strip(), (answer or "").strip(), strategy, str(count),
    ])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


@app.post("/api/follow-up/stream")
def follow_up_api(req: FollowUpRequest):
    """追问：深思=讲解位（reasoner）/ 快答=批改位（chat），逐字流式返回。"""
    if not req.followup.strip():
        return {"ok": False, "error": "问题为空"}

    def gen():
        try:
            for piece in service.follow_up_stream(
                req.question, req.result, req.history, req.followup, req.mode
            ):
                yield _sse({"delta": piece})
            yield _sse({"done": True})
        except Exception as e:
            log.exception("follow-up failed")
            yield _sse({"error": f"追问失败：{e}"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@app.post("/api/reteach/stream")
def reteach_api(req: ReteachRequest):
    """换个讲法：按指定角度重讲一遍（不覆盖原讲解），流式返回。"""
    if not req.question.strip():
        return {"ok": False, "error": "题目为空"}

    def gen():
        try:
            for piece in service.reteach_stream(req.question, req.result, req.angle):
                yield _sse({"delta": piece})
            yield _sse({"done": True})
        except Exception as e:
            log.exception("reteach failed")
            yield _sse({"error": f"换个讲法失败：{e}"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


# ---------------------------------------------------------------- 社区：论坛

def _uid(profile: dict) -> str:
    return profile["nickname"]


@app.post("/api/forum/list")
def forum_list(req: ForumListRequest):
    """帖子列表（游客可看）。"""
    data = db.list_posts(req.sort, req.limit, req.offset)
    return {"ok": True, "items": data["items"], "total": data["total"]}


@app.post("/api/forum/detail")
def forum_detail(req: ForumDetailRequest):
    """帖子详情（游客可看）。"""
    p = db.get_post(req.post_id)
    if not p:
        return {"ok": False, "error": "帖子不存在或已删除"}
    return {"ok": True, "post": p}


@app.post("/api/forum/comments/list")
def forum_comments_list(req: ForumCommentsRequest):
    """评论列表（游客可看）。"""
    return {"ok": True, "comments": db.list_comments(req.post_id)}


@app.post("/api/forum/post")
def forum_post(req: CreatePostRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再发帖"}
    ptype = "question" if req.type == "question" else "thought"
    card = json.dumps(req.card, ensure_ascii=False) if req.card else ""
    p = db.create_post(_uid(profile), ptype, req.title, req.content, card)
    return {"ok": True, "post": p}


@app.post("/api/forum/comment")
def forum_comment(req: CommentRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再评论"}
    if not req.content.strip():
        return {"ok": False, "error": "评论内容为空"}
    if not db.get_post(req.post_id):
        return {"ok": False, "error": "帖子不存在或已删除"}
    c = db.create_comment(req.post_id, _uid(profile), req.content)
    return {"ok": True, "comment": c}


@app.post("/api/forum/like")
def forum_like(req: LikeRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再点赞"}
    if not db.get_post(req.post_id):
        return {"ok": False, "error": "帖子不存在或已删除"}
    return {"ok": True, **db.toggle_like(req.post_id, _uid(profile))}


@app.post("/api/forum/post/delete")
def forum_delete(req: DeletePostRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    if db.delete_post(req.post_id, _uid(profile)):
        return {"ok": True}
    return {"ok": False, "error": "只能删除自己的帖子"}


# ---------------------------------------------------------------- 社区：学习小组

@app.post("/api/group/create")
def group_create(req: CreateGroupRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再创建小组"}
    name = req.name.strip()
    if not name:
        return {"ok": False, "error": "小组名称不能为空"}
    g = db.create_group(name, req.description, _uid(profile))
    return {"ok": True, "group": g}


@app.post("/api/group/join")
def group_join(req: JoinGroupRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再加入小组"}
    g = db.get_group_by_invite(req.invite_code)
    if not g:
        return {"ok": False, "error": "邀请码无效，请核对后重试"}
    if not db.join_group(g["id"], _uid(profile)):
        return {"ok": False, "error": "你已经在这个小组里了"}
    return {"ok": True, "group": g}


@app.post("/api/group/my")
def group_my(req: VerifyRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    return {"ok": True, "groups": db.list_groups_of_user(_uid(profile))}


@app.post("/api/group/detail")
def group_detail(req: GroupDetailRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    g = db.get_group(req.group_id)
    if not g:
        return {"ok": False, "error": "小组不存在"}
    if not db.is_group_member(req.group_id, _uid(profile)):
        return {"ok": False, "error": "你不在这个小组里"}
    return {"ok": True, "group": g, "members": db.list_group_members(req.group_id)}


@app.post("/api/group/messages")
def group_messages(req: GroupMessagesRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    if not db.is_group_member(req.group_id, _uid(profile)):
        return {"ok": False, "error": "你不在这个小组里"}
    data = db.list_group_messages(req.group_id, req.limit, req.offset)
    return {"ok": True, "items": data["items"], "total": data["total"]}


@app.post("/api/group/send")
def group_send(req: GroupSendRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录后再发言"}
    if not db.is_group_member(req.group_id, _uid(profile)):
        return {"ok": False, "error": "你不在这个小组里"}
    if not req.content.strip():
        return {"ok": False, "error": "内容为空"}
    msg = db.add_group_message(req.group_id, _uid(profile), req.type, req.content)
    return {"ok": True, "message": msg}


@app.post("/api/group/invite")
def group_invite(req: GroupInviteRequest):
    """按昵称直接拉人进组（仅 owner）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    g = db.get_group(req.group_id)
    if not g:
        return {"ok": False, "error": "小组不存在"}
    if g["owner_id"] != _uid(profile):
        return {"ok": False, "error": "只有组长能邀请成员"}
    target = db.find_profile_by_nickname(req.nickname.strip())
    if not target:
        return {"ok": False, "error": "没有找到这个昵称的用户"}
    if not db.join_group(req.group_id, target["nickname"]):
        return {"ok": False, "error": "对方已经在这个小组里了"}
    return {"ok": True, "nickname": target["nickname"]}


@app.post("/api/group/quit")
def group_quit(req: GroupDetailRequest):
    """退出小组（组长不能直接退，需先解散）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    g = db.get_group(req.group_id)
    if not g:
        return {"ok": False, "error": "小组不存在"}
    if g["owner_id"] == uid:
        return {"ok": False, "error": "你是组长，请先解散小组"}
    if not db.leave_group(req.group_id, uid):
        return {"ok": False, "error": "你不在这个小组里"}
    return {"ok": True}


@app.post("/api/group/dissolve")
def group_dissolve(req: GroupDetailRequest):
    """解散小组（仅组长，连同成员与消息一起清掉）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    g = db.get_group(req.group_id)
    if not g:
        return {"ok": False, "error": "小组不存在"}
    if g["owner_id"] != uid:
        return {"ok": False, "error": "只有组长能解散小组"}
    db.dissolve_group(req.group_id, uid)
    return {"ok": True}


@app.post("/api/group/remove-member")
def group_remove_member(req: GroupRemoveMemberRequest):
    """组长移除成员（不能移除自己）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    g = db.get_group(req.group_id)
    if not g:
        return {"ok": False, "error": "小组不存在"}
    if g["owner_id"] != uid:
        return {"ok": False, "error": "只有组长能移除成员"}
    if not db.remove_group_member(req.group_id, uid, req.user_id):
        return {"ok": False, "error": "移除失败（成员不存在，或不能移除自己）"}
    return {"ok": True}


# ---------------------------------------------------------------- 班级模块

def _teacher_meta_ok(name: str, school: str) -> bool:
    return bool(name.strip()) and bool(school.strip())


def _hw_class_of(hid: str) -> dict | None:
    hw = db.get_homework(hid)
    if not hw:
        return None
    g = db.get_group(hw["class_id"])
    if not g or g.get("type") != "class":
        return None
    return hw


@app.post("/api/teacher/apply")
def teacher_apply(req: TeacherApplyRequest):
    """自助声明式教师认证：填姓名 + 学校即生效（V1 无验证渠道，班级内公示）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    if not _teacher_meta_ok(req.name, req.school):
        return {"ok": False, "error": "姓名和学校都要填"}
    meta = {"name": req.name.strip()[:20], "school": req.school.strip()[:40],
            "subject": req.subject.strip()[:30]}
    return {"ok": True, "teacher": db.set_teacher(_uid(profile), meta)}


@app.post("/api/teacher/me")
def teacher_me(req: VerifyRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    return {"ok": True, "teacher": db.get_teacher(_uid(profile))}


@app.post("/api/class/create")
def class_create(req: ClassCreateRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    teacher = db.get_teacher(uid)
    if not teacher or not teacher["is_teacher"]:
        return {"ok": False, "error": "请先完成教师认证（我的 → 教师认证）"}
    name = req.name.strip()
    if not name:
        return {"ok": False, "error": "班级名称不能为空"}
    g = db.create_class(name, req.subject, req.grade, uid)
    return {"ok": True, "class": g}


@app.post("/api/class/join")
def class_join(req: ClassJoinRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    g = db.get_group_by_invite(req.code)
    if not g or g.get("type") != "class":
        return {"ok": False, "error": "班级码无效，请向老师核对"}
    uid = _uid(profile)
    if not db.join_group(g["id"], uid):
        return {"ok": False, "error": "你已经在这个班级里了"}
    # group_members 默认 role='member'，班级里统一叫 student
    with db._lock:
        db._conn_checked().execute(
            "UPDATE group_members SET role = 'student' WHERE group_id = ? AND user_id = ? AND role = 'member'",
            (g["id"], uid),
        )
        db._conn_checked().commit()
    db.add_group_message(
        g["id"], uid, "system",
        f"{uid} 加入了班级",
    )
    return {"ok": True, "class": g}


@app.post("/api/class/my")
def class_my(req: VerifyRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    classes = db.list_classes_of_user(_uid(profile))
    for c in classes:
        try:
            c["meta"] = json.loads(c.pop("meta") or "{}")
        except Exception:
            c["meta"] = {}
        c["is_teacher"] = c["my_role"] == "teacher"
        try:
            todo = db.class_todo_counts(c["id"], _uid(profile), c["is_teacher"])
            c["pending_grade"] = todo["pending_grade"]
            c["pending_submit"] = todo["pending_submit"]
        except Exception:
            c["pending_grade"] = 0
            c["pending_submit"] = 0
    return {"ok": True, "classes": classes}


@app.post("/api/homework/create")
def homework_create(req: HomeworkCreateRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_class_teacher(req.class_id, uid):
        return {"ok": False, "error": "只有班级老师能布置作业"}
    if not req.title.strip():
        return {"ok": False, "error": "作业标题不能为空"}
    images = [str(x) for x in (req.images or [])]
    if not req.content.strip() and not images:
        return {"ok": False, "error": "作业内容和图片至少填一项"}
    if len(images) > db.MAX_HOMEWORK_IMAGES:
        return {"ok": False, "error": f"作业图片最多 {db.MAX_HOMEWORK_IMAGES} 张"}
    for img in images:
        if not img.startswith("data:image/"):
            return {"ok": False, "error": "作业图片格式不正确"}
        if len(img) > db.MAX_HOMEWORK_IMAGE_CHARS:
            return {"ok": False, "error": "单张图片过大，请重新拍照或裁剪"}
    hw = db.create_homework(req.class_id, req.title.strip(), req.content,
                            req.reference, req.due_at, uid, images)
    db.add_group_message(req.class_id, uid, "system",
                         f"布置了新作业「{hw['title']}」" + (f"，截止 {req.due_at}" if req.due_at else ""))
    return {"ok": True, "homework": hw}


@app.post("/api/homework/list")
def homework_list(req: HomeworkListRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_group_member(req.class_id, uid):
        return {"ok": False, "error": "你不在这个班级里"}
    items = db.list_homework(req.class_id)
    is_teacher = db.is_class_teacher(req.class_id, uid)
    if is_teacher:
        for hw in items:
            subs = db.list_submissions(hw["id"])
            hw["submitted"] = sum(1 for s in subs
                                  if s["has_image"] or (s.get("note") or "").strip() or s.get("score", -1) >= 0)
            hw["graded"] = sum(1 for s in subs if s.get("graded_at", 0) > 0)
        hw_student_count = len(db.list_class_students(req.class_id))
        for hw in items:
            hw["total_students"] = hw_student_count
    else:
        mine = {s["homework_id"]: s for s in
                [db.get_submission(hw["id"], uid) for hw in items] if s}
        for hw in items:
            hw["my_submission"] = mine.get(hw["id"])
    return {"ok": True, "items": items, "is_teacher": is_teacher}


@app.post("/api/homework/detail")
def homework_detail(req: HomeworkDetailRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_group_member(hw["class_id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    is_teacher = db.is_class_teacher(hw["class_id"], uid)
    out = dict(hw)
    out["images_count"] = db.get_homework_image_count(hw["id"])
    out["my_submission"] = db.get_submission(hw["id"], uid)
    if is_teacher:
        out["students"] = db.list_class_students(hw["class_id"])
        out["submissions"] = db.list_submissions(hw["id"])
        rep = db.get_report(hw["id"])
        out["report"] = rep["report"] if rep else None
    return {"ok": True, "homework": out, "is_teacher": is_teacher}


@app.post("/api/homework/assign_images")
def homework_assign_images(req: HomeworkAssignImagesRequest):
    """班级成员拉取老师布置作业的题目图片（按需加载，列表接口只带数量）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    uid = _uid(profile)
    if not db.is_group_member(hw["class_id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    return {"ok": True, "images": db.get_homework_images(req.homework_id)}


# ---------------- 班级笔记 / 知识点 ----------------

@app.post("/api/class/note/create")
def class_note_create(req: ClassNoteCreateRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_class_teacher(req.class_id, uid):
        return {"ok": False, "error": "只有班级老师能发布笔记"}
    if not req.title.strip():
        return {"ok": False, "error": "笔记标题不能为空"}
    if not req.content.strip() and not (req.images or []):
        return {"ok": False, "error": "笔记内容和图片至少填一项"}
    imgs = [str(x) for x in (req.images or [])]
    if len(imgs) > db.MAX_HOMEWORK_IMAGES:
        return {"ok": False, "error": f"笔记图片最多 {db.MAX_HOMEWORK_IMAGES} 张"}
    for img in imgs:
        if not img.startswith("data:image/"):
            return {"ok": False, "error": "笔记图片格式不正确"}
        if len(img) > db.MAX_HOMEWORK_IMAGE_CHARS:
            return {"ok": False, "error": "有图片过大，请重新拍照"}
    note = db.create_note(req.class_id, req.title.strip(), req.content, uid, imgs)
    db.add_group_message(req.class_id, uid, "system", f"发布了新笔记「{note['title']}」")
    return {"ok": True, "note": note}


@app.post("/api/class/note/list")
def class_note_list(req: ClassNoteListRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_group_member(req.class_id, uid):
        return {"ok": False, "error": "你不在这个班级里"}
    return {"ok": True, "notes": db.list_notes(req.class_id)}


@app.post("/api/class/note/images")
def class_note_images(req: ClassNoteIdRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    g = db.get_note_class(req.note_id)
    if not g:
        return {"ok": False, "error": "笔记不存在"}
    uid = _uid(profile)
    if not db.is_group_member(g["id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    return {"ok": True, "images": db.get_note_images(req.note_id)}


@app.post("/api/class/note/delete")
def class_note_delete(req: ClassNoteIdRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    g = db.get_note_class(req.note_id)
    if not g:
        return {"ok": False, "error": "笔记不存在"}
    if not db.is_class_teacher(g["id"], uid):
        return {"ok": False, "error": "只有班级老师能删除笔记"}
    db.delete_note(req.note_id)
    return {"ok": True}


# ---------------- 班级测试（选择 + 填空，限时，排名） ----------------

def _norm_blank(s):
    """填空答案归一化：去所有空白、全角转半角、转小写。"""
    import re as _re
    t = str(s or "")
    out = []
    for ch in t:
        code = ord(ch)
        out.append(chr(code - 0xFEE0) if 0xFF01 <= code <= 0xFF5E else ch)
    t = "".join(out)
    t = _re.sub(r"\s+", "", t)
    return t.lower()


def _validate_test_items(items):
    """校验题目数组，返回 (paper, total_score)，不合法抛 ValueError。"""
    if not isinstance(items, list) or not (1 <= len(items) <= 50):
        raise ValueError("题目数量需在 1~50 题之间")
    paper = []
    total = 0.0
    for i, q in enumerate(items):
        qtype = str(q.get("type") or "")
        question = str(q.get("question") or "").strip()
        try:
            score = round(float(q.get("score")), 1)
        except Exception:
            raise ValueError(f"第 {i + 1} 题分值无效")
        if score <= 0:
            raise ValueError(f"第 {i + 1} 题分值必须大于 0")
        if not question:
            raise ValueError(f"第 {i + 1} 题题干不能为空")
        if qtype == "choice":
            options = [str(o).strip() for o in (q.get("options") or [])]
            options = [o for o in options if o]
            answer = str(q.get("answer") or "").strip().upper()
            if len(options) < 2:
                raise ValueError(f"第 {i + 1} 题选项不足")
            if answer not in ("A", "B", "C", "D") or ord(answer) - 65 >= len(options):
                raise ValueError(f"第 {i + 1} 题答案必须是选项字母")
            paper.append({"type": "choice", "question": question[:2000], "options": options[:6], "answer": answer, "score": score})
        elif qtype == "blank":
            answer = str(q.get("answer") or "").strip()
            if not answer:
                raise ValueError(f"第 {i + 1} 题答案不能为空")
            paper.append({"type": "blank", "question": question[:2000], "answer": answer[:500], "score": score})
        else:
            raise ValueError(f"第 {i + 1} 题题型不支持（仅选择/填空）")
        total += score
    return paper, round(total, 1)


def _grade_attempt(paper, answers, detail=False):
    """精确判分：choice 比选项字母，blank 归一化比对。

    detail=False → 返回 (score, correct_count)（原行为，rank/报告等沿用）
    detail=True  → 额外返回逐题明细 items，供前端把错题沉淀进个人错题本：
                   [{ index, type, correct, given, answer, score }]
    """
    score = 0.0
    correct = 0
    items = []
    for i, q in enumerate(paper):
        given = answers.get(str(i), answers.get(i))
        okq = False
        if given is not None:
            if q["type"] == "choice":
                okq = str(given).strip().upper() == str(q["answer"]).strip().upper()
            else:
                okq = _norm_blank(given) == _norm_blank(q["answer"]) and _norm_blank(given) != ""
        if okq:
            score += float(q["score"])
            correct += 1
        if detail:
            items.append({
                "index": i,
                "type": q.get("type", "choice"),
                "correct": bool(okq),
                "given": "" if given is None else str(given),
                "answer": str(q.get("answer", "")),
                "score": float(q.get("score", 0) or 0),
            })
    if detail:
        return round(score, 1), correct, items
    return round(score, 1), correct


@app.post("/api/class/test/create")
def class_test_create(req: ClassTestCreateRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_class_teacher(req.class_id, uid):
        return {"ok": False, "error": "只有班级老师能发布测试"}
    if not req.title.strip():
        return {"ok": False, "error": "测试标题不能为空"}
    if not (60 <= int(req.duration_sec or 0) <= 3 * 3600):
        return {"ok": False, "error": "限时需在 1 分钟 ~ 3 小时之间"}
    try:
        paper, total = _validate_test_items(req.items)
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    t = db.create_test(req.class_id, req.title.strip(), int(req.duration_sec), paper, uid)
    db.add_group_message(req.class_id, uid, "system",
                         f"发布了新测试「{t['title']}」（{t['question_count']} 题 · {t['total_score']} 分 · 限时 {t['duration_sec'] // 60} 分钟）")
    return {"ok": True, "test": {k: v for k, v in t.items() if k != "paper"}}


@app.post("/api/class/test/generate")
def class_test_generate(req: ClassTestGenerateRequest):
    """AI 生成测试题目草稿（不落库），老师预览编辑后再 create。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_class_teacher(req.class_id, uid):
        return {"ok": False, "error": "只有班级老师能生成测试"}
    cc, bc = int(req.choice_count or 0), int(req.blank_count or 0)
    if cc + bc <= 0:
        return {"ok": False, "error": "请至少设置 1 道题"}
    if cc + bc > 50:
        return {"ok": False, "error": "总题数不能超过 50"}
    if cc < 0 or bc < 0:
        return {"ok": False, "error": "题量不能为负数"}
    cs, bs = max(0.5, float(req.choice_score or 10)), max(0.5, float(req.blank_score or 10))
    lines = ([f"- 选择题 {cc} 题，每题 {cs} 分"] if cc else []) + ([f"- 填空题 {bc} 题，每题 {bs} 分"] if bc else [])
    subject = (req.subject or "高等数学").strip()[:60]
    topic = (req.topic or "").strip()[:200]
    prompt = (TEST_PAPER_PROMPT
              + "\n\n学科：" + subject + "\n考察范围：" + (topic or "基础内容") + "\n题型配比：\n" + "\n".join(lines)
              + "\n\n分值：选择题每题 " + str(cs) + " 分，填空题每题 " + str(bs) + " 分（放入每题的 score 字段）。")
    text = service.chat_text([{"role": "user", "content": prompt}], temperature=0.4,
                             slot=service.JUDGE_SLOT, timeout=240)
    data = service.extract_json(text)
    raw = data.get("questions") if isinstance(data, dict) else data
    if not isinstance(raw, list) or not raw:
        return {"ok": False, "error": "AI 生成失败，请重试或改用手动出题"}
    items = []
    for q in raw:
        qtype = "choice" if q.get("type") == "choice" else "blank"
        score = cs if qtype == "choice" else bs
        try:
            score = round(float(q.get("score") or score), 1)
        except Exception:
            pass
        items.append({
            "type": qtype,
            "question": str(q.get("question") or "").strip(),
            "options": [str(o) for o in (q.get("options") or [])] if qtype == "choice" else [],
            "answer": str(q.get("answer") or "").strip(),
            "score": score,
        })
    items = [q for q in items if q["question"]]
    if not items:
        return {"ok": False, "error": "AI 生成失败，请重试或改用手动出题"}
    return {"ok": True, "items": items}


@app.post("/api/class/test/list")
def class_test_list(req: ClassTestListRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    if not db.is_group_member(req.class_id, uid):
        return {"ok": False, "error": "你不在这个班级里"}
    tests = db.list_tests(req.class_id, uid)
    is_teacher = db.is_class_teacher(req.class_id, uid)
    return {"ok": True, "tests": tests, "is_teacher": is_teacher}


@app.post("/api/class/test/start")
def class_test_start(req: ClassTestIdRequest):
    """开始作答：幂等记录开始时间，返回剥离答案的题目 + 剩余秒数。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    t = db.get_test(req.test_id)
    if not t:
        return {"ok": False, "error": "测试不存在"}
    if not db.is_group_member(t["class_id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    attempt = db.get_attempt(t["id"], uid)
    if req.preview and (not attempt or attempt["submitted_at"] == 0):
        # 预览：不创建作答记录、不开始计时
        questions = [{"index": i, "type": q["type"], "question": q["question"],
                      "options": q.get("options", []), "score": q["score"]}
                     for i, q in enumerate(t["paper"])]
        return {"ok": True, "title": t["title"], "total_score": t["total_score"],
                "duration_sec": t["duration_sec"], "remaining_sec": t["duration_sec"],
                "questions": questions, "submitted": False, "result": None, "preview": True}
    if not attempt:
        attempt = db.start_attempt(t["id"], t["class_id"], uid)
    import time as _t
    deadline = attempt["started_at"] + t["duration_sec"] * 1000
    remaining = max(0, int((deadline - _t.time() * 1000) / 1000))
    questions = [{"index": i, "type": q["type"], "question": q["question"],
                  "options": q.get("options", []), "score": q["score"]}
                 for i, q in enumerate(t["paper"])]
    return {"ok": True, "title": t["title"], "total_score": t["total_score"],
            "duration_sec": t["duration_sec"], "remaining_sec": remaining,
            "questions": questions,
            "submitted": attempt["submitted_at"] > 0,
            "result": {"score": attempt["score"], "duration_sec": attempt["duration_sec"]} if attempt["submitted_at"] > 0 else None}


@app.post("/api/class/test/submit")
def class_test_submit(req: ClassTestSubmitRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    t = db.get_test(req.test_id)
    if not t:
        return {"ok": False, "error": "测试不存在"}
    attempt = db.get_attempt(t["id"], uid)
    if not attempt:
        return {"ok": False, "error": "请先开始答题"}
    if attempt["submitted_at"] > 0:
        return {"ok": False, "error": "该测试已提交过，不能重复交卷"}
    import time as _t
    now_ms = _t.time() * 1000
    deadline = attempt["started_at"] + t["duration_sec"] * 1000
    is_timeout = now_ms > deadline + 30000
    answers = req.answers if isinstance(req.answers, dict) else {}
    score, correct, items = _grade_attempt(t["paper"], answers, detail=True)
    duration = min(int((now_ms - attempt["started_at"]) / 1000), t["duration_sec"])
    db.save_attempt_result(attempt["id"], answers, score, correct, duration, is_timeout)
    rank = db.list_attempts(t["id"])
    my_rank = next((i + 1 for i, r in enumerate(rank) if r["user_id"] == uid), None)
    # items：逐题明细，供前端展示「答错的题」并勾选沉淀进个人错题本（班级教学 → 个人复习闭环）
    return {"ok": True, "score": score, "correct_count": correct,
            "total_score": t["total_score"], "duration_sec": duration,
            "is_timeout": is_timeout, "rank": my_rank, "attempt_count": len(rank),
            "items": items}


@app.post("/api/class/test/rank")
def class_test_rank(req: ClassTestIdRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    t = db.get_test(req.test_id)
    if not t:
        return {"ok": False, "error": "测试不存在"}
    if not db.is_group_member(t["class_id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    rows = db.list_attempts(t["id"])
    total_students = len(db.list_class_students(t["class_id"]))
    rank = [{"rank": i + 1, "user_id": r["user_id"], "score": r["score"],
             "correct_count": r["correct_count"], "duration_sec": r["duration_sec"],
             "is_timeout": bool(r["is_timeout"]), "is_me": r["user_id"] == uid}
            for i, r in enumerate(rows)]
    return {"ok": True, "title": t["title"], "total_score": t["total_score"],
            "attempt_count": len(rank), "total_students": total_students, "rank": rank}


@app.post("/api/homework/submit")
def homework_submit(req: HomeworkSubmitRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    uid = _uid(profile)
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_group_member(hw["class_id"], uid):
        return {"ok": False, "error": "你不在这个班级里"}
    if db.is_class_teacher(hw["class_id"], uid):
        return {"ok": False, "error": "老师不需要提交作业"}
    if hw.get("due_at") and int(hw["due_at"]) > 0:
        import time as _t
        if _t.time() * 1000 > hw["due_at"]:
            return {"ok": False, "error": "作业已过截止时间，无法提交"}
    image = (req.image_base64 or "").strip()
    if image.startswith("data:"):
        idx = image.find(",")
        if idx >= 0:
            image = image[idx + 1:]

    def _norm(x):
        x = str(x or "").strip()
        return x

    imgs = [_norm(x) for x in (req.images or []) if _norm(x)]
    if len(imgs) > db.MAX_HOMEWORK_IMAGES:
        return {"ok": False, "error": f"作业图片最多 {db.MAX_HOMEWORK_IMAGES} 张"}
    for img in imgs:
        if not img.startswith("data:image/"):
            return {"ok": False, "error": "作业图片格式不正确"}
        if len(img) > db.MAX_HOMEWORK_IMAGE_CHARS:
            return {"ok": False, "error": "有图片过大，请重新拍照（离近一点或分页拍）"}
    if not imgs and image:
        # 旧客户端单图字段：保持原行为（裸 base64 也收，仅校验长度）
        if len(image) > db.MAX_SUBMISSION_IMAGE:
            return {"ok": False, "error": "图片太大，请重拍一张更清晰的（不要离得太远）"}
        imgs = [image]
    has_text = bool((req.note or "").strip())
    if not imgs and not has_text:
        return {"ok": False, "error": "请先拍照、选择作业图片，或填写文字说明"}
    sub = db.upsert_submission(hw["id"], hw["class_id"], uid, imgs[0] if imgs else "", req.note, imgs)
    return {"ok": True, "submission": sub}


@app.post("/api/homework/submissions")
def homework_submissions(req: HomeworkSubmissionsRequest):
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能查看全部作业"}
    return {"ok": True, "items": db.list_submissions(hw["id"]),
            "students": db.list_class_students(hw["class_id"])}


@app.post("/api/homework/image")
def homework_image(req: HomeworkImageRequest):
    """老师查看某学生的作业原图。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    uid = _uid(profile)
    if not db.is_class_teacher(hw["class_id"], uid) and uid != req.user_id:
        return {"ok": False, "error": "只能查看自己的作业图"}
    img = db.get_submission_image(hw["id"], req.user_id)
    if not img:
        return {"ok": False, "error": "该学生还没有提交图片"}
    return {"ok": True, "image": img, "images": db.get_submission_images(hw["id"], req.user_id)}


@app.post("/api/homework/grade")
def homework_grade(req: HomeworkGradeRequest):
    """AI 批改单个学生的提交（老师操作；前端逐份循环调用，进度条在前端）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能批改"}
    sub_id = db.find_submission_id(hw["id"], req.user_id)
    if not sub_id:
        return {"ok": False, "error": "该学生还没有提交"}
    sub = db.get_submission_full(sub_id)
    if not sub.get("image") and not (sub.get("note") or "").strip():
        return {"ok": False, "error": "该学生的提交没有图片也没有文字说明"}
    try:
        if service.MOCK:
            graded = _mock_grade_one(hw)
        else:
            graded = _grade_one_submission(hw, sub)
    except service.NoQuestionError as e:
        return {"ok": False, "error": f"作业图片识别失败：{e}"}
    except Exception as e:
        log.exception("homework grade failed")
        msg = str(e)
        if "timeout" in msg.lower() or "timed out" in msg.lower():
            return {"ok": False, "error": "批改超时，请重试这一份"}
        return {"ok": False, "error": f"批改失败：{msg[:120]}"}
    db.save_grade(sub_id, graded["score"],
                  {"items": graded["items"], "overall": graded["overall"]},
                  graded["transcript"])
    sub_out = db.get_submission(hw["id"], req.user_id)
    return {"ok": True, "submission": sub_out}


# ============================================================================
# 后台批改任务
# ---------------------------------------------------------------------------
# 原先由前端逐份循环调用 /api/homework/grade：老师一关页面批改就断了。
# 现在改为「启动任务 → 服务端并发 3 跑完 → 前端轮询进度」，关页面也能继续，
# 回来还能接着看进度与失败名单。
# 任务表放内存：服务重启会丢（重启后重新发起即可，不引入新表）。
# ============================================================================
_GRADE_TASKS: dict = {}          # task_id -> task
_GRADE_TASK_BY_HW: dict = {}     # homework_id -> 最近的 task_id（用于查询与复用判断）
_GRADE_TASKS_LOCK = threading.Lock()
_GRADE_POOL = ThreadPoolExecutor(max_workers=3, thread_name_prefix="grade")


def _task_public(t: dict) -> dict:
    return {
        "id": t["id"],
        "homework_id": t["homework_id"],
        "total": t["total"],
        "done": t["done"],
        "failed": list(t["failed"]),
        "started_at": t["started_at"],
        "finished": t["finished"],
        "finished_at": t.get("finished_at", 0),
    }


def _run_grade_task(task_id: str, hw: dict, user_ids: list):
    """后台线程：并发 3 逐份批改并实时更新任务进度；每份结果照旧落库。"""

    def grade_one(uid: str):
        try:
            sub_id = db.find_submission_id(hw["id"], uid)
            if not sub_id:
                raise ValueError("该学生还没有提交")
            sub = db.get_submission_full(sub_id)
            if not sub.get("image") and not (sub.get("note") or "").strip():
                raise ValueError("没有图片也没有文字说明")
            graded = _mock_grade_one(hw) if service.MOCK else _grade_one_submission(hw, sub)
            db.save_grade(sub_id, graded["score"],
                          {"items": graded["items"], "overall": graded["overall"]},
                          graded["transcript"])
            return uid, True, ""
        except Exception as e:  # 单份失败不影响其它份
            log.warning("grade task item failed: %s | %s", uid, str(e)[:120])
            return uid, False, str(e)[:120]

    try:
        futures = {_GRADE_POOL.submit(grade_one, u): u for u in user_ids}
        for fut in as_completed(futures):
            uid, ok, _err = fut.result()
            with _GRADE_TASKS_LOCK:
                task = _GRADE_TASKS.get(task_id)
                if not task:
                    continue
                if ok:
                    task["done"] += 1
                else:
                    task["failed"].append(uid)
        with _GRADE_TASKS_LOCK:
            task = _GRADE_TASKS.get(task_id)
            if task:
                task["finished"] = True
                task["finished_at"] = int(_t.time() * 1000)
                log.info("grade task done: %s | done=%d failed=%d",
                         task_id, task["done"], len(task["failed"]))
    except Exception:
        log.exception("grade task crashed: %s", task_id)
        with _GRADE_TASKS_LOCK:
            task = _GRADE_TASKS.get(task_id)
            if task:
                task["finished"] = True
                task["finished_at"] = int(_t.time() * 1000)


@app.post("/api/group/messages/stream")
async def group_messages_stream(req: GroupStreamRequest):
    """群聊实时增量（SSE）。

    · 每 2s 查一次新增消息，有则推 data 帧、无则推注释行保活
    · 最长 300s 结束后前端自动重连（避免长连接长期占用）
    · 只推 since 之后的新消息，前端按 id 去重
    """
    profile = auth.parse_token(req.token)
    ok_user = bool(profile) and db.is_group_member(req.group_id, _uid(profile))
    cursor = int(req.since or 0) or int(_t.time() * 1000)

    async def gen():
        nonlocal cursor
        if not ok_user:
            yield "event: denied\ndata: {}\n\n"
            return
        yield ": connected\n\n"
        deadline = _t.time() + 300
        while _t.time() < deadline:
            try:
                rows = db.list_group_messages_since(req.group_id, cursor)
            except Exception:
                rows = []
            if rows:
                cursor = max(int(r.get("created_at") or 0) for r in rows)
                payload = json.dumps({"items": rows}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            else:
                yield ": ping\n\n"   # 保活：让中间层与浏览器知道连接还在
            await asyncio.sleep(2)
        yield "event: timeout\ndata: {}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # 关掉反代缓冲，否则消息会被攒着不发
        },
    )


@app.post("/api/homework/grade-start")
def homework_grade_start(req: GradeTaskRequest):
    """启动（或复用）后台批改任务：只批还没批过的提交。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能批改"}

    with _GRADE_TASKS_LOCK:
        cur_id = _GRADE_TASK_BY_HW.get(hw["id"])
        cur = _GRADE_TASKS.get(cur_id) if cur_id else None
        if cur and not cur["finished"]:
            return {"ok": True, "task": _task_public(cur), "reused": True}

    pending = [x["user_id"] for x in db.list_submissions(hw["id"]) if int(x.get("graded_at") or 0) <= 0]
    if not pending:
        return {"ok": False, "error": "没有待批改的提交"}

    task = {
        "id": f"gt{int(_t.time() * 1000)}",
        "homework_id": hw["id"],
        "total": len(pending),
        "done": 0,
        "failed": [],
        "started_at": int(_t.time() * 1000),
        "finished": False,
        "finished_at": 0,
    }
    with _GRADE_TASKS_LOCK:
        _GRADE_TASKS[task["id"]] = task          # 主键用 task_id（后台线程按它取）
        _GRADE_TASK_BY_HW[hw["id"]] = task["id"]  # 作业 -> 任务，供查询与复用
    threading.Thread(target=_run_grade_task, args=(task["id"], hw, pending), daemon=True).start()
    return {"ok": True, "task": _task_public(task)}


@app.post("/api/homework/grade-status")
def homework_grade_status(req: GradeTaskRequest):
    """查该作业的批改任务进度（没有任务时 task 为 null）。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能查看批改进度"}
    with _GRADE_TASKS_LOCK:
        tid = _GRADE_TASK_BY_HW.get(hw["id"])
        task = _GRADE_TASKS.get(tid) if tid else None
        return {"ok": True, "task": _task_public(task) if task else None}


@app.post("/api/homework/report")
def homework_report(req: HomeworkReportRequest):
    """生成（或重新生成）班级报告：基于已批改的提交汇总。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能生成报告"}
    subs = [s for s in db.list_submissions(hw["id"]) if s.get("graded_at", 0) > 0]
    if not subs:
        return {"ok": False, "error": "还没有已批改的作业，先完成批改"}
    graded = [{
        "student": s["user_id"], "score": s["score"],
        "overall": (s.get("feedback") or {}).get("overall", "") if isinstance(s.get("feedback"), dict) else "",
        "issues": [it.get("comment", "") for it in ((s.get("feedback") or {}).get("items") or [])
                   if isinstance(it, dict) and it.get("verdict") in ("错误", "部分正确")]
    } for s in subs]
    total = len(db.list_class_students(hw["class_id"]))
    payload = {"homework_title": hw["title"], "total_students": total, "graded": graded}
    try:
        if service.MOCK:
            report = _mock_report(payload)
        else:
            prompt = CLASS_REPORT_PROMPT.replace("{graded}", json.dumps(payload, ensure_ascii=False)[:6000])
            text = service.chat_text([{"role": "user", "content": prompt}],
                                     temperature=0.3, slot=service.JUDGE_SLOT, timeout=180)
            report = service.extract_json(text)
            if not isinstance(report.get("stats"), dict):
                return {"ok": False, "error": "报告生成失败，请重试"}
    except Exception as e:
        log.exception("homework report failed")
        return {"ok": False, "error": f"报告生成失败：{str(e)[:120]}"}
    db.save_report(hw["id"], report)
    return {"ok": True, "report": report}


def _csv_cell(v) -> str:
    """CSV 单元格转义：含逗号/引号/换行时加引号并把内部引号翻倍。"""
    t = "" if v is None else str(v)
    t = t.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    if any(ch in t for ch in [",", '"', "\t"]):
        t = '"' + t.replace('"', '""') + '"'
    return t


@app.post("/api/class/export-scores")
def class_export_scores(req: ClassExportRequest):
    """导出单次作业的成绩单（CSV 文本，前端落成 .csv 文件）。

    · 仅班级老师可用
    · 未提交 / 已交待批 / 已批 三种状态都列出，方便老师核对谁没交
    · 文本带 UTF-8 BOM，Excel、WPS 双击打开中文不乱码
    """
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能导出成绩"}

    students = db.list_class_students(hw["class_id"])
    subs = {str(x.get("user_id")): x for x in db.list_submissions(hw["id"])}
    rows = [["序号", "学生", "状态", "得分", "得分率", "提交时间", "AI 评语摘要", "待改问题数"]]
    graded_scores = []
    for i, st in enumerate(students, 1):
        uid = str(st.get("user_id") or "")
        sub = subs.get(uid)
        if not sub:
            rows.append([i, uid, "未提交", "", "", "", "", ""])
            continue
        if int(sub.get("graded_at") or 0) <= 0:
            rows.append([i, uid, "已交待批改", "", "", _fmt_ts(sub.get("updated_at")), "", ""])
            continue
        score = float(sub.get("score") or 0)
        graded_scores.append(score)
        fb = sub.get("feedback") if isinstance(sub.get("feedback"), dict) else {}
        issues = [it for it in (fb.get("items") or [])
                  if isinstance(it, dict) and it.get("verdict") in ("错误", "部分正确")]
        overall = str(fb.get("overall") or "").strip()
        if len(overall) > 80:
            overall = overall[:80] + "…"
        rows.append([i, uid, "已批改", f"{score:g}", f"{score:.0f}%",
                     _fmt_ts(sub.get("updated_at")), overall, len(issues)])

    # 末尾追加一行汇总（老师汇报时常直接引用）
    if graded_scores:
        avg = sum(graded_scores) / len(graded_scores)
        rows.append(["", "— 汇总 —", f"已批 {len(graded_scores)} 份",
                     f"均分 {avg:.1f}", f"最高 {max(graded_scores):g}",
                     f"最低 {min(graded_scores):g}", "", ""])

    csv = "\ufeff" + "\r\n".join(",".join(_csv_cell(c) for c in r) for r in rows)
    safe_title = "".join(ch for ch in str(hw.get("title") or "作业") if ch not in '\\/:*?"<>|').strip() or "作业"
    return {"ok": True, "filename": f"{safe_title}-成绩单.csv", "csv": csv,
            "count": len(students), "graded": len(graded_scores)}


def _fmt_ts(ms) -> str:
    """毫秒时间戳 → 便于阅读的本地时间字符串（导出用）。"""
    try:
        import time as _tt
        v = float(ms or 0) / 1000
        if v <= 0:
            return ""
        return _tt.strftime("%Y-%m-%d %H:%M", _tt.localtime(v))
    except Exception:
        return ""


def _mock_report(payload: dict) -> dict:
    scores = [g["score"] for g in payload["graded"]]
    n = len(scores)
    return {
        "stats": {"total": payload["total_students"], "submitted": n, "graded": n,
                  "avg": round(sum(scores) / n) if n else 0,
                  "max": max(scores) if n else 0, "min": min(scores) if n else 0,
                  "buckets": [{"range": "90-100", "count": sum(1 for s in scores if s >= 90)},
                              {"range": "70-89", "count": sum(1 for s in scores if 70 <= s < 90)},
                              {"range": "60-69", "count": sum(1 for s in scores if 60 <= s < 70)},
                              {"range": "<60", "count": sum(1 for s in scores if s < 60)}]},
        "common_issues": [{"point": "计算细节（Mock）", "count": n, "detail": "（Mock）符号与抄写错误较多"}],
        "teaching_advice": ["（Mock）下节课重点讲易错步骤", "（Mock）可再布置一组同类练习"],
        "excellent": [payload["graded"][0]["student"]] if payload["graded"] else [],
    }


@app.post("/api/homework/push")
def homework_push(req: HomeworkPushRequest):
    """老师把班级报告或某个学生的反馈发到班级群。"""
    profile = auth.parse_token(req.token)
    if not profile:
        return {"ok": False, "error": "请先登录"}
    hw = _hw_class_of(req.homework_id)
    if not hw:
        return {"ok": False, "error": "作业不存在"}
    if not db.is_class_teacher(hw["class_id"], _uid(profile)):
        return {"ok": False, "error": "只有班级老师能发送反馈"}
    if req.kind == "student":
        sub = db.get_submission(hw["id"], req.user_id)
        if not sub or sub.get("graded_at", 0) <= 0:
            return {"ok": False, "error": "该学生的作业还没有批改结果"}
        fb = sub.get("feedback") or {}
        content = (f"作业「{hw['title']}」批改反馈 · {req.user_id}\n"
                   f"得分 {sub['score']}/100\n{fb.get('overall', '')}")
        msg = db.add_group_message(hw["class_id"], _uid(profile), "feedback", content)
    else:
        rep = db.get_report(hw["id"])
        if not rep or not rep.get("report"):
            return {"ok": False, "error": "还没有班级报告，先生成"}
        r = rep["report"]
        st = r.get("stats") or {}
        issues = "；".join(str(i.get("point", "")) for i in (r.get("common_issues") or [])[:3])
        advice = "\n".join(f"· {a}" for a in (r.get("teaching_advice") or [])[:4])
        content = (f"作业「{hw['title']}」班级报告\n"
                   f"实交/应交 {st.get('submitted')}/{st.get('total')} · 平均分 {st.get('avg')}\n"
                   f"共性错误：{issues or '无'}\n{advice}")
        msg = db.add_group_message(hw["class_id"], _uid(profile), "feedback", content)
    return {"ok": True, "message": msg}


# ---------------------------------------------------------------- 前端静态页（同源部署）

def _resolve_static_dir() -> Path | None:
    """按优先级找前端构建产物目录：backend/static > 项目根 frontend/dist > 项目根 dist。
    要求 index.html 非空——空的构建产物会导致整站白屏，宁可不挂载。"""
    base = Path(__file__).resolve().parent
    candidates = [
        base / "static",
        base.parent / "frontend" / "dist",
        base.parent / "dist",
    ]
    for c in candidates:
        index = c / "index.html"
        if index.exists() and index.stat().st_size > 0:
            return c
    return None


STATIC_DIR = _resolve_static_dir()

# 静态资源 MIME（Windows 下 mimetypes 对 .js/.css 可能返回 text/plain，导致 module script 报错）
_STATIC_MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".map": "application/json",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".html": "text/html",
    ".txt": "text/plain",
}

# 静态文件命中时：按 Starlette 同款公式（md5(mtime-size)）比对 If-None-Match，命中返回 304。
# 此前裸 FileResponse 从不返回 304（Starlette 1.6 在发送阶段才算 ETag，路由层拿不到），
# 配合立绘/差分的 no-cache 头导致每次进页整张重下（实测 365KB×2/次）。
def _file_or_304(request: Request, path, media_type):
    stat = os.stat(path)
    etag = '"%s"' % hashlib.md5(
        (str(stat.st_mtime) + "-" + str(stat.st_size)).encode(), usedforsecurity=False
    ).hexdigest()
    inm = request.headers.get("if-none-match", "")
    if inm and etag in inm:
        return Response(status_code=304, headers={"ETag": etag})
    return FileResponse(path, media_type=media_type)


# ---------------------------------------------------------------- AI 教学老师（2026-10-09）
#
# 设计：状态机唯一权威在服务端（teach.next_state），模型无权跳点；
#       /teach/start 只生成当前一个知识点（teach.normalize_lecture 钳位）；
#       「会了，下一个知识点」是推进的唯一语义入口（teach.is_confirm，前端同规则）。

TEACH_LEVEL_PRESET = {
    "basic": "按「基础夯实」难度：多用直观解释与简单例子，把概念与适用条件讲透，考试题只考直接应用。",
    "final": "按「期末突击」难度：抓高频考点与典型题型，压缩背景铺垫，考试题贴近期末真题风格。",
    "kaoyan": "按「考研强化」难度：讲深讲透并点明常见陷阱与推广结论，考试题按考研难度。",
}


def _teach_level_hint(uid: str, level: str) -> str:
    """讲义深度：显式档优先，auto 时按「我的课程」里的考试倒计时自动定（复用现有数据）。"""
    lv = str(level or "auto").strip()
    if lv in TEACH_LEVEL_PRESET:
        return TEACH_LEVEL_PRESET[lv]
    try:
        blob = db.load_courses(uid) or {}
        exams = [e for e in (blob.get("exams") or []) if isinstance(e, dict)]
        today = _t.strftime("%Y-%m-%d")
        soon = ""
        for e in exams:
            d = str(e.get("date") or "")
            if d and d >= today and (not soon or d < soon):
                soon = d
        if soon:
            days = int((_t.mktime(_t.strptime(soon, "%Y-%m-%d"))
                        - _t.mktime(_t.strptime(today, "%Y-%m-%d"))) // 86400)
            if 0 <= days <= 30:
                return ("学生 %d 天后有考试（%s），按「期末突击」难度：抓高频考点与典型题型，"
                        "压缩背景铺垫，考试题贴近真题风格。" % (days, soon))
    except Exception:
        log.exception("teach level hint failed")
    return "按大学课程常规难度（大一/大二标准）讲，先把概念与适用条件讲透。"


def _teach_wrong_hint(uid: str, kp_name: str) -> str:
    """画像联动：这块以前错/讲崩过 → 讲义与考试题重点照顾（读取 quiz_pick 画像）。"""
    try:
        ev = (db.kp_state_load(uid) or {}).get("events") or {}
        e = ev.get(str(kp_name)) if isinstance(ev, dict) else None
        bad = int((e or {}).get("bad") or 0)
        w = 0.0
        for it in db.load_errorbook(uid):
            if not isinstance(it, dict) or it.get("kind") == "note":
                continue
            kps = [str(k).strip() for k in (it.get("knowledgePoints") or [])]
            if str(kp_name) in kps:
                w += 4 if not it.get("mastered") else 1
        if bad >= 1 or w >= 4:
            return "这一块学生以前踩过坑（做错或讲不明白），重点提醒易错条件与常见错法，考试题要能戳中它。"
    except Exception:
        log.exception("teach wrong hint failed")
    return ""


def _syllabus_payload(s: dict) -> dict:
    items = s.get("items") or []
    cursor = int(s.get("cursor") or 0)
    kp_done = [int(x) for x in (s.get("kp_done") or [])]
    chapters = s.get("chapters") or []
    version = int(s.get("version") or 1)
    # v1 一律视为归档（不只靠启动迁移兜底——迁移只扫启动前已存在的行）
    archived = bool(int(s.get("archived") or 0)) or version < 2
    # v1 旧课没有章结构 → 整包归一章，前端树渲染逻辑统一
    if version < 2 or not chapters:
        chapters = [{"name": s.get("title") or s.get("subject") or "全部内容",
                     "brief": "", "count": len(items)}]
    # 章末单元测试状态（不把整卷下发——那是 chapter 接口的事）
    unit_meta = {}
    for k, v in (s.get("unit_tests") or {}).items():
        if isinstance(v, dict):
            unit_meta[str(k)] = {"state": v.get("state") or "pending",
                                 "score": v.get("score") if v.get("state") == "graded" else None}
    return {
        "id": s.get("id") or "", "subject": s.get("subject") or "",
        "course_id": s.get("course_id") or "",
        "teacher_id": s.get("teacher_id") or teach.DEFAULT_TEACHER,
        "teacher": teach.teacher_of(s.get("teacher_id")),
        "title": s.get("title") or (s.get("subject") or "AI 课堂"),
        "items": items, "chapters": chapters, "cursor": cursor, "total": len(items),
        "kp_done": sorted(set(kp_done)),
        "kp_started": db.list_teach_kp_indexes(s.get("user_id") or "", s.get("id") or ""),
        "level": s.get("level") or "auto", "status": s.get("status") or "active",
        "version": version, "archived": archived,
        "unit_tests": unit_meta,
        "done": (s.get("status") == "done") or (len(items) > 0 and cursor >= len(items)),
        "updated_at": int(s.get("updated_at") or 0),
    }


def _teach_guard(req_token: str):
    profile = auth.parse_token(req_token) if req_token else None
    if not profile:
        return None
    return profile["nickname"]


@app.post("/api/teach/syllabus")
def teach_syllabus(req: TeachSyllabusRequest):
    """开一门课：AI 生成 12~15 讲大纲并落库（多门课并行）。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    if not quota.window_allow(f"teach:{uid}", 4, 60):
        return {"ok": False, "error": "备课太快啦，缓一分钟再开新课程"}
    subject = (req.subject or "").strip()[:40]
    course_name = ""
    if req.course_id:
        try:
            blob = db.load_courses(uid) or {}
            for c in (blob.get("courses") or []):
                if isinstance(c, dict) and str(c.get("id")) == str(req.course_id):
                    course_name = str(c.get("name") or "")
                    break
        except Exception:
            course_name = ""
    if not subject:
        subject = course_name
    if not subject:
        return {"ok": False, "error": "先告诉我学哪门课（可以输入学科名，或从「我的课程」里选）"}
    # 同名查重（2026-10-10 用户拍板）：同一门课只允许一门 AI 课堂。
    # 已有同名进行中的课 → 直接返回已有课（不生成新大纲、不花钱），前端提示回到原进度。
    # 学完（done）的课允许重开新课（新学期重学是合理诉求）。
    norm = db.norm_subject_key(subject)
    existing = next(
        (s for s in db.list_syllabi(uid)
         if int(s.get("version") or 1) >= 2 and not int(s.get("archived") or 0)
         and s.get("status") != "done"
         and db.norm_subject_key(s.get("subject") or s.get("title") or "") == norm), None)
    if existing:
        return {"ok": True, "syllabus": _syllabus_payload(existing), "merged": True}
    teacher = teach.teacher_of(req.teacher_id)
    try:
        chapters, items = teach_llm.gen_syllabus(
            subject, teacher=teacher, course_hint=course_name,
            level_hint=_teach_level_hint(uid, req.level), want=int(req.want or 16))
    except Exception:
        log.exception("teach syllabus failed")
        return {"ok": False, "error": "大纲没生成出来，再试一次吧"}
    sid = uuid.uuid4().hex[:16]
    db.save_syllabus({
        "id": sid, "user_id": uid, "subject": subject, "course_id": str(req.course_id or ""),
        "teacher_id": teacher["id"], "title": subject, "items": items, "chapters": chapters,
        "cursor": 0, "level": str(req.level or "auto"), "status": "active", "version": 2,
    })
    return {"ok": True, "syllabus": _syllabus_payload(db.get_syllabus(uid, sid) or {})}


@app.post("/api/teach/syllabi")
def teach_syllabi(req: TeachAskRequest):
    """我的教学线列表（进行中优先）。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    return {"ok": True, "list": [_syllabus_payload(s) for s in db.list_syllabi(uid)]}


@app.post("/api/teach/start")
def teach_start(req: TeachStartRequest):
    """开讲当前知识点：生成三段讲义（幂等——同一知识点已有讲义则直接复用）。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    syl = db.get_syllabus(uid, req.syllabus_id)
    if not syl:
        return {"ok": False, "error": "找不到这门课了，回列表重开一个"}
    if int(syl.get("version") or 1) < 2 or int(syl.get("archived") or 0):
        return {"ok": False, "error": "这门课是旧版课程（课程已升级为章节模式），重新开一门吧",
                "archived": True}
    items = syl.get("items") or []
    if not items:
        return {"ok": False, "error": "这门课还没有知识点，先重新生成大纲"}
    idx = int(req.kp_index) if int(req.kp_index) >= 0 else int(syl.get("cursor") or 0)
    idx = max(0, min(idx, len(items) - 1))
    # 跳章＝游标跟人走（2026-10-09 章节目录）：显式指定 kp_index 时同步 cursor，
    # 这样「继续上次」回到最近学的那一章，而不是停在旧位置
    if int(req.kp_index) >= 0 and idx != int(syl.get("cursor") or 0):
        syl = db.update_syllabus(uid, syl["id"], {"cursor": idx}) or syl
    teacher = teach.teacher_of(syl.get("teacher_id"))

    # 幂等：同一知识点已有讲义 → 直接回到它的状态（刷新/换设备不重复花额度）
    old = db.get_teach_session_by_kp(uid, syl["id"], idx)
    if old and (old.get("kp_payload") or {}).get("exam"):
        pub = teach.lecture_public(old["kp_payload"], graded=old.get("state") == "graded")
        return {"ok": True, "session_id": old["id"], "state": old.get("state") or "exam",
                "lecture": pub, "index": idx, "total": len(items),
                "syllabus": _syllabus_payload(syl), "reused": True,
                "grade": old.get("grade") or {}, "answer": old.get("answer") or "",
                "ask_log": old.get("ask_log") or []}

    if not quota.window_allow(f"teachlect:{uid}", 8, 60):
        return {"ok": False, "error": "讲得太快啦，缓一分钟再开下一讲"}
    kp = items[idx] if isinstance(items[idx], dict) else {"name": str(items[idx])}
    try:
        payload = teach_llm.gen_lecture(
            syl.get("subject") or teacher["name"], str(kp.get("name") or "本知识点"),
            str(kp.get("brief") or ""), teacher=teacher,
            level_hint=_teach_level_hint(uid, syl.get("level")),
            wrong_hint=_teach_wrong_hint(uid, str(kp.get("name") or "")))
    except Exception:
        log.exception("teach lecture failed")
        return {"ok": False, "error": "这一讲的讲义没生成出来，再试一次吧"}
    sid = uuid.uuid4().hex[:16]
    sess = {
        "id": sid, "user_id": uid, "syllabus_id": syl["id"],
        "teacher_id": teacher["id"], "kp_index": idx,
        "state": teach.next_state("lecture", "start"),      # 讲义已出 → 等作答
        "kp_payload": payload, "answer": "", "grade": {}, "ask_log": [],
        "turns": 0, "minutes": max(0, int(req.minutes or 0)),
    }
    db.save_teach_session(sess)
    return {"ok": True, "session_id": sid, "state": sess["state"],
            "lecture": teach.lecture_public(payload), "index": idx, "total": len(items),
            "syllabus": _syllabus_payload(syl), "ask_log": []}


@app.post("/api/teach/stream")
def teach_stream(req: TeachStartRequest):
    """开讲当前知识点（讲义「字段级流式」，逐字段冒字）。

    - 命中幂等（同一知识点已有讲义）→ 一个 done 事件直接回放，不花额度
    - 需要生成 → 逐字段冒字，结束后落库（与会话创建仍走同一套副作用）
    - 首 token 前失败 → 降级为非流式 gen_lecture（保证用户拿到讲义）
    """
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    syl = db.get_syllabus(uid, req.syllabus_id)
    if not syl:
        return {"ok": False, "error": "找不到这门课了，回列表重开一个"}
    if int(syl.get("version") or 1) < 2 or int(syl.get("archived") or 0):
        return {"ok": False, "error": "这门课是旧版课程（课程已升级为章节模式），重新开一门吧",
                "archived": True}
    items = syl.get("items") or []
    if not items:
        return {"ok": False, "error": "这门课还没有知识点，先重新生成大纲"}
    idx = int(req.kp_index) if int(req.kp_index) >= 0 else int(syl.get("cursor") or 0)
    idx = max(0, min(idx, len(items) - 1))
    if int(req.kp_index) >= 0 and idx != int(syl.get("cursor") or 0):
        syl = db.update_syllabus(uid, syl["id"], {"cursor": idx}) or syl
    teacher = teach.teacher_of(syl.get("teacher_id"))

    # 幂等：已有讲义 → 直接回放（刷新/换设备不重复花额度）
    old = db.get_teach_session_by_kp(uid, syl["id"], idx)
    if old and (old.get("kp_payload") or {}).get("exam"):
        pub = teach.lecture_public(old["kp_payload"], graded=old.get("state") == "graded")

        def gen_reuse():
            yield _sse({"done": True, "reused": True, "session_id": old["id"],
                        "state": old.get("state") or "exam", "lecture": pub, "index": idx,
                        "total": len(items), "syllabus": _syllabus_payload(syl),
                        "grade": old.get("grade") or {}, "answer": old.get("answer") or "",
                        "ask_log": old.get("ask_log") or []})

        return StreamingResponse(gen_reuse(), media_type="text/event-stream", headers=SSE_HEADERS)

    if not quota.window_allow(f"teachlect:{uid}", 8, 60):
        return {"ok": False, "error": "讲得太快啦，缓一分钟再开下一讲"}
    kp = items[idx] if isinstance(items[idx], dict) else {"name": str(items[idx])}
    kp_name = str(kp.get("name") or "本知识点")
    kp_brief = str(kp.get("brief") or "")
    subject = syl.get("subject") or teacher["name"]
    level_hint = _teach_level_hint(uid, syl.get("level"))
    wrong_hint = _teach_wrong_hint(uid, kp_name)

    def gen():
        payload = None
        try:
            for ev in teach_llm.gen_lecture_stream(subject, kp_name, kp_brief, teacher=teacher,
                                                   level_hint=level_hint, wrong_hint=wrong_hint):
                if ev.get("fallback"):
                    log.warning("teach lecture stream fallback: %s", ev.get("reason"))
                    try:
                        payload = teach_llm.gen_lecture(subject, kp_name, kp_brief, teacher=teacher,
                                                        level_hint=level_hint, wrong_hint=wrong_hint)
                    except Exception as e2:
                        yield _sse({"error": f"这一讲的讲义没生成出来，再试一次吧（{e2}）"})
                        return
                    break
                if ev.get("error"):
                    yield _sse({"error": ev.get("error")})
                    return
                if ev.get("done"):
                    payload = ev.get("result")
                    break
                yield _sse(ev)
        except Exception as e:
            log.exception("teach stream failed")
            yield _sse({"error": f"讲义生成失败：{e}"})
            return
        if not payload:
            yield _sse({"error": "这一讲的讲义没生成出来，再试一次吧"})
            return
        # 例题缺失兜底（与一次性版本一致）
        try:
            if not str(payload["example"].get("question") or "").strip():
                ex = teach_llm._regen_example(
                    subject, kp_name, kp_brief, teacher,
                    str(payload["kp"].get("definition") or payload["kp"].get("principle") or "")[:300])
                if ex.get("question"):
                    payload["example"] = ex
        except Exception:
            log.exception("teach stream regen example failed")
        sid = uuid.uuid4().hex[:16]
        sess = {
            "id": sid, "user_id": uid, "syllabus_id": syl["id"],
            "teacher_id": teacher["id"], "kp_index": idx,
            "state": teach.next_state("lecture", "start"),
            "kp_payload": payload, "answer": "", "grade": {}, "ask_log": [],
            "turns": 0, "minutes": max(0, int(req.minutes or 0)),
        }
        db.save_teach_session(sess)
        yield _sse({"done": True, "session_id": sid, "state": sess["state"],
                    "lecture": teach.lecture_public(payload), "index": idx, "total": len(items),
                    "syllabus": _syllabus_payload(syl), "ask_log": []})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@app.post("/api/teach/answer")
def teach_answer(req: TeachAnswerRequest):
    """提交考试题作答：选择题本地秒判，文字题 AI 批改；答错沉淀错题本 + 画像。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    sess = db.get_teach_session(uid, req.session_id)
    if not sess:
        return {"ok": False, "error": "找不到这道题了，刷新一下重来"}
    if not teach.can(sess["state"], "answer"):
        return {"ok": False, "error": "这题已经批改过啦", "state": sess["state"]}
    syl = db.get_syllabus(uid, sess["syllabus_id"]) or {}
    teacher = teach.teacher_of(sess.get("teacher_id") or syl.get("teacher_id"))
    payload = sess.get("kp_payload") or {}
    exam = payload.get("exam") or {}
    kp_name = str((payload.get("kp") or {}).get("name") or "")
    subject = str(syl.get("subject") or teacher["name"])

    if exam.get("type") == "choice":
        choice = (req.choice or "").strip()[:4].upper()
        if not choice:
            return {"ok": False, "error": "先选一个选项再提交"}
        grade = teach.grade_choice(exam, choice)
        answer_text = "选了 " + choice
    else:
        text = (req.text or "").strip()[:2000]
        if not text:
            return {"ok": False, "error": "先写下你的思路或答案再提交"}
        if not quota.window_allow(f"teachans:{uid}", 8, 60):
            return {"ok": False, "error": "提交太快啦，缓一缓再发"}
        try:
            grade = teach_llm.grade_text_answer(
                exam.get("question") or "", exam.get("reference_answer") or "",
                exam.get("points") or [], text, kp_name, teacher)
        except Exception:
            log.exception("teach grade failed")
            return {"ok": False, "error": "TA 刚走神了一下，再发一次好不好？"}
        answer_text = text

    sess["state"] = teach.next_state(sess["state"], "answer")
    sess["answer"] = answer_text
    sess["grade"] = grade
    sess["turns"] = int(sess.get("turns") or 0) + 1

    # 联动（用户 2026-10-09 定稿）：答错 → 错题本 + 精准出题画像；答对 → 画像记讲通
    wrong_saved = False
    try:
        if grade.get("verdict") == "correct":
            quiz_pick.record_event(uid, [kp_name], "good", subject)
        else:
            quiz_pick.record_event(uid, [kp_name], "bad", subject)
            items = db.load_errorbook(uid)
            wid = "teach-%s-%d" % (str(sess["id"])[:8], int(sess.get("kp_index") or 0))
            if not any(isinstance(x, dict) and str(x.get("id")) == wid for x in items):
                items.append(teach.build_wrong_item(
                    session_id=sess["id"], kp_index=int(sess.get("kp_index") or 0),
                    subject=subject, kp_name=kp_name, exam=exam, user_answer=answer_text,
                    grade=grade, now_ms=int(_t.time() * 1000)))
                db.save_errorbook(uid, items)
                wrong_saved = True
    except Exception:
        log.exception("teach wrong-book sync failed")

    db.save_teach_session(sess)
    # 批改完成 → 后台预生成下一个学习单元（章末或下一节讲义，幂等+静默；2026-10-10 性能）
    if int(syl.get("version") or 1) >= 2 and not int(syl.get("archived") or 0):
        try:
            _spawn_pregen(uid, syl, int(sess.get("kp_index") or 0))
        except Exception:
            log.exception("pregen spawn failed")
    reveal = teach.lecture_public(payload, graded=True)
    return {"ok": True, "state": sess["state"], "grade": grade,
            "reveal": {"example": reveal["example"], "exam": reveal["exam"]},
            "wrong_saved": wrong_saved, "subject": subject,
            "ask_log": sess.get("ask_log") or [],
            "exam_analysis": (payload.get("exam_analysis") or {})}


@app.post("/api/teach/ask")
def teach_ask_api(req: TeachAskRequest):
    """学生提问：解答后回到当前考试题；若这句话其实是「会了，下一个知识点」则顺手推进。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    sess = db.get_teach_session(uid, req.session_id)
    if not sess:
        return {"ok": False, "error": "找不到这次教学了，刷新一下重来"}
    q = (req.question or "").strip()[:600]
    if not q:
        return {"ok": False, "error": "先写下你的问题"}
    # 服务端兜底：确认语 → 走推进（前端也会先判定，这是双保险）
    if teach.is_confirm(q) and teach.can(sess["state"], "next"):
        return {**teach_next(TeachNextRequest(token=req.token, session_id=req.session_id)),
                "advanced": True}
    if not quota.window_allow(f"teachask:{uid}", 8, 60):
        return {"ok": False, "error": "问得太快啦，缓一缓再发"}
    payload = sess.get("kp_payload") or {}
    kp = payload.get("kp") or {}
    kp_ctx = "；".join([x for x in (kp.get("definition"), kp.get("principle"),
                                    "易错：" + "、".join(kp.get("pitfalls") or [])) if x])
    try:
        reply = teach_llm.ask(q, str(kp.get("name") or ""), kp_ctx,
                              str((payload.get("exam") or {}).get("question") or ""),
                              teach.teacher_of(sess.get("teacher_id")))
    except Exception:
        log.exception("teach ask failed")
        return {"ok": False, "error": "TA 刚走神了一下，再问一次好不好？"}
    try:
        log_arr = list(sess.get("ask_log") or [])
        log_arr.append({"q": q, "a": reply})
        sess["ask_log"] = log_arr[-20:]
        sess["state"] = teach.next_state(sess["state"], "ask")   # 解答完 → 回到考试题
        db.save_teach_session(sess)
    except Exception:
        log.exception("teach ask persist failed")
    return {"ok": True, "reply": reply, "state": sess.get("state"), "advanced": False}


@app.post("/api/teach/next")
def teach_next(req: TeachNextRequest):
    """推进到下一个知识点（唯一推进入口：校验状态 + 游标）。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    sess = db.get_teach_session(uid, req.session_id)
    if not sess:
        return {"ok": False, "error": "找不到这次教学了，刷新一下重来"}
    try:
        sess["state"] = teach.next_state(sess["state"], "next")
    except teach.TeachFlowError as e:
        return {"ok": False, "error": str(e), "state": sess["state"]}
    syl = db.get_syllabus(uid, sess["syllabus_id"])
    if not syl:
        return {"ok": False, "error": "这门课已经被删掉了"}
    items = syl.get("items") or []
    nxt = int(sess.get("kp_index") or 0) + 1
    mins = max(0, int(req.minutes or 0))
    if mins:
        sess["minutes"] = int(sess.get("minutes") or 0) + mins
    # 确认掌握 → 章节目录打 ✓（2026-10-09）：ask 里确认语推进也走这里，两条路径同口径
    done = sorted({int(x) for x in (syl.get("kp_done") or [])} | {int(sess.get("kp_index") or 0)})
    if nxt >= len(items):
        sess["state"] = "done"
        db.save_teach_session(sess)
        db.update_syllabus(uid, syl["id"], {"cursor": len(items), "status": "done", "kp_done": done})
        return {"ok": True, "advanced": True, "finished": True,
                "syllabus": _syllabus_payload(db.get_syllabus(uid, syl["id"]) or {}),
                "kp_done": done, "minutes": sess.get("minutes") or 0}
    db.save_teach_session(sess)
    db.update_syllabus(uid, syl["id"], {"cursor": nxt, "status": "active", "kp_done": done})
    return {"ok": True, "advanced": True, "finished": False, "cursor": nxt,
            "kp_done": done, "total": len(items), "minutes": sess.get("minutes") or 0}


@app.post("/api/teach/exam_analysis")
def teach_exam_analysis(req: TeachExamAnalysisRequest):
    """批改后的逐选项解析（2026-10-10 #2）：结果缓存进讲义 payload，同题不二次花钱。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    sess = db.get_teach_session(uid, req.session_id)
    if not sess:
        return {"ok": False, "error": "找不到这道题了，刷新一下重来"}
    payload = sess.get("kp_payload") or {}
    exam = payload.get("exam") or {}
    if exam.get("type") != "choice":
        return {"ok": False, "error": "文字题没有逐选项解析——看上面的评分点逐项核查表"}
    if sess.get("state") != "graded":
        return {"ok": False, "error": "先提交作答，批改完才有逐项解析"}
    cached = payload.get("exam_analysis") or {}
    if isinstance(cached, dict) and cached.get("per_option"):
        return {"ok": True, "analysis": cached, "cached": True}
    if not quota.window_allow(f"teachexana:{uid}", 6, 60):
        return {"ok": False, "error": "解析生成中，缓一缓再看"}
    kp_name = str((payload.get("kp") or {}).get("name") or "")
    chosen = str((sess.get("grade") or {}).get("chosen") or "")
    try:
        analysis = teach_llm.gen_exam_analysis(exam, chosen, str((sess.get("grade") or {}).get("comment") or ""), kp_name)
    except Exception:
        log.exception("teach exam analysis failed")
        return {"ok": False, "error": "解析没生成出来，再点一次试试"}
    if not analysis.get("per_option"):
        return {"ok": False, "error": "解析没生成出来，再点一次试试"}
    payload["exam_analysis"] = analysis            # 缓存：同一道题只花一次钱
    sess["kp_payload"] = payload
    db.save_teach_session(sess)
    return {"ok": True, "analysis": analysis, "cached": False}


def _unit_paper_public(paper: list) -> list:
    """单元试卷下发视图：剥掉答案/评分点（批改前不剧透）。"""
    out = []
    for qi, it in enumerate(paper or []):
        ex = it.get("exam") or {}
        out.append({
            "q_index": qi,
            "origin": "replay" if str(it.get("origin") or "").startswith("section:") else "new",
            "section": it.get("section") or "", "kp": it.get("kp") or "",
            "type": ex.get("type") or "text", "question": ex.get("question") or "",
            "options": ex.get("options") or [],
        })
    return out


def _chapter_sessions(uid: str, syl: dict, start: int, n: int) -> list:
    """章内各小节的讲义会话（讲过的取 kp 摘要，没讲的占位）。"""
    items = syl.get("items") or []
    out = []
    for i in range(start, min(start + n, len(items))):
        it = items[i] if i < len(items) else {}
        s = db.get_teach_session_by_kp(uid, syl["id"], i)
        kp = ((s or {}).get("kp_payload") or {}).get("kp") or {}
        out.append({
            "index": i, "name": kp.get("name") or it.get("name") or "",
            "brief": it.get("brief") or "",
            "definition": kp.get("definition") or "", "principle": kp.get("principle") or "",
            "pitfalls": kp.get("pitfalls") or [],
        })
    return out


def _pregen_next_unit(uid: str, syl: dict, done_idx: int) -> None:
    """批改完成后后台预生成「下一个学习单元」（2026-10-10 性能优化，用户拍板）：

    - 章内最后一节（v2 课程）→ 预生成章末试卷+总述
    - 否则 → 预生成下一节讲义（建好会话，推进/跳转时 teach_start 幂等命中，50ms 秒开）
    幂等：已有则跳过；失败静默：推进时现场生成兜底，绝不影响批改响应。
    额度账：用户做完题才预生成（弃学概率最低），每门课最多多花一个单元。"""
    try:
        items = syl.get("items") or []
        chapters = syl.get("chapters") or []
        nxt = int(done_idx) + 1
        if nxt >= len(items):
            return
        # v2 课程：章内最后一节 → 预生成章末（组卷+总述），正是「进新章节要等」的大头
        if int(syl.get("version") or 1) >= 2 and chapters:
            ci = teach.chapter_of(chapters, done_idx)
            if teach.chapter_end_index(chapters, ci, len(items)) == done_idx:
                ut, err = _ensure_unit_test(uid, syl, ci)
                if not ut:
                    log.info("pregen unit test skipped: syl=%s ch=%s (%s)", syl.get("id"), ci, err)
                else:
                    log.info("pregen unit test ok: syl=%s ch=%s", syl.get("id"), ci)
                return
        # 预生成讲义：已有会话直接跳过（幂等）
        if db.get_teach_session_by_kp(uid, syl["id"], nxt):
            return
        teacher = teach.teacher_of(syl.get("teacher_id"))
        kp = items[nxt] if isinstance(items[nxt], dict) else {"name": str(items[nxt])}
        payload = teach_llm.gen_lecture(
            syl.get("subject") or teacher["name"], str(kp.get("name") or "本知识点"),
            str(kp.get("brief") or ""), teacher=teacher,
            level_hint=_teach_level_hint(uid, syl.get("level")),
            wrong_hint=_teach_wrong_hint(uid, str(kp.get("name") or "")))
        # 生成期间用户可能已手动开了这一节（目录跳转）——丢弃预生成结果，避免重复会话
        if db.get_teach_session_by_kp(uid, syl["id"], nxt):
            log.info("pregen lecture discarded (user opened first): syl=%s kp=%s", syl.get("id"), nxt)
            return
        sess = {"id": uuid.uuid4().hex[:16], "user_id": uid, "syllabus_id": syl["id"],
                "teacher_id": teacher["id"], "kp_index": nxt,
                "state": teach.next_state("lecture", "start"),
                "kp_payload": payload, "answer": "", "grade": {}, "ask_log": [],
                "turns": 0, "minutes": 0}
        db.save_teach_session(sess)
        log.info("pregen lecture ok: syl=%s kp=%s", syl.get("id"), nxt)
    except Exception:
        log.exception("pregen next unit failed (silent, uid=%s)", uid)


_pregen_lock = threading.Lock()
_pregen_running = set()          # 进程内防并发：同一 (uid, 下一节) 只起一个预生成线程


def _spawn_pregen(uid: str, syl: dict, done_idx: int) -> None:
    key = "%s:%d" % (uid, int(done_idx) + 1)
    with _pregen_lock:
        if key in _pregen_running:
            return
        _pregen_running.add(key)

    def _run():
        try:
            _pregen_next_unit(uid, syl, done_idx)
        finally:
            with _pregen_lock:
                _pregen_running.discard(key)

    threading.Thread(target=_run, daemon=True, name="teach-pregen").start()


@app.post("/api/teach/chapter")
def teach_chapter(req: TeachChapterRequest):
    """章末页（2026-10-10 #4）：知识点总结（拼接速查 + 模型总述）+ 单元测试组卷。

    组卷 = 复用本章小节考题 2/3 + 新生成跨小节综合题 1/3（用户拍板）；
    幂等生成后存进 syllabus.unit_tests，重开不重复花钱。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    syl = db.get_syllabus(uid, req.syllabus_id)
    if not syl:
        return {"ok": False, "error": "找不到这门课了"}
    if int(syl.get("version") or 1) < 2 or int(syl.get("archived") or 0):
        return {"ok": False, "error": "旧版课程没有章末内容，重新开一门吧", "archived": True}
    chapters = syl.get("chapters") or []
    items = syl.get("items") or []
    if not chapters or not items:
        return {"ok": False, "error": "这门课的大纲结构不对，重新生成大纲"}
    ci = max(0, min(int(req.ch_index), len(chapters) - 1))
    start, n = teach.chapter_range(chapters, ci)
    if n <= 0:
        return {"ok": False, "error": "这一章没有小节"}
    ut, err = _ensure_unit_test(uid, syl, ci, enforce_quota=True)
    if not ut:
        return {"ok": False, "error": err or "组卷失败，再试一次"}
    return {"ok": True, "ch_index": ci, "chapter": chapters[ci],
            "start": start, "count": n,
            "sections": ut.get("sections") or _chapter_sessions(uid, syl, start, n),
            "overview": ut.get("overview") or "",
            "paper": _unit_paper_public(ut.get("paper") or []),
            "state": ut.get("state") or "pending",
            "result": (ut.get("result") or {}) if ut.get("state") == "graded" else {}}


def _ensure_unit_test(uid: str, syl: dict, ci: int, enforce_quota: bool = False) -> tuple:
    """确保章末试卷与总述已生成（幂等；返回 (ut, err)）。

    组卷/总述一次成型存 syllabus.unit_tests；预生成与端点共用本函数（预生成不走出题限速）。
    生成失败时返回 (None, err)——调用方决定是报错还是静默降级。"""
    chapters = syl.get("chapters") or []
    items = syl.get("items") or []
    start, n = teach.chapter_range(chapters, ci)
    if n <= 0:
        return None, "这一章没有小节"
    unit_tests = dict(syl.get("unit_tests") or {})
    key = str(ci)
    ut = unit_tests.get(key) if isinstance(unit_tests.get(key), dict) else None
    if ut and ut.get("paper"):
        return ut, ""
    if enforce_quota and not quota.window_allow(f"teachuinit:{uid}", 4, 60):
        return None, "组卷太快啦，缓一分钟再试"
    secs = _chapter_sessions(uid, syl, start, n)
    # 复用题：本章已讲小节的考题全收，超过 4 道抽 4（采样带种子不可复现问题不大——卷子只组一次）
    reused = []
    existing_q = []
    for s_i in range(start, min(start + n, len(items))):
        s = db.get_teach_session_by_kp(uid, syl["id"], s_i)
        ex = ((s or {}).get("kp_payload") or {}).get("exam") or {}
        if not ex.get("question"):
            continue
        kp_name = str((((s or {}).get("kp_payload") or {}).get("kp") or {}).get("name") or "")
        reused.append({"origin": "section:%d" % s_i, "section": items[s_i].get("name") or "",
                       "kp": kp_name, "exam": ex})
        existing_q.append(str(ex.get("question"))[:60])
    if len(reused) > 4:
        import random as _r
        reused = _r.sample(reused, 4)
    # 新综合题（1~2 道）；生成失败降级为纯复用组卷
    try:
        new_items = teach_llm.gen_unit_items(chapters[ci].get("name") or "",
                                             [{"name": x.get("name")} for x in secs], existing_q)
    except Exception:
        log.exception("unit gen failed")
        new_items = []
    paper = reused + new_items
    if not paper:
        return None, "组卷失败（本章小节还没有可用考题），先学几节再来"
    # 章末总述（一次；失败走拼接兜底文案）
    try:
        overview = teach_llm.gen_chapter_summary(
            syl.get("subject") or "", chapters[ci].get("name") or "",
            secs, teach.teacher_of(syl.get("teacher_id")))
    except Exception:
        log.exception("chapter summary failed")
        overview = "这一章的主线：先把各小节的适用条件分清，再按条件挑工具。建议回到薄弱小节再过一遍例题。"
    ut = {"state": "pending", "paper": paper, "overview": overview,
          "sections": secs, "created_at": _t.time()}
    # 落库前重读最新 syllabus，避免和并发写（如预生成线程）互相覆盖 unit_tests
    latest = db.get_syllabus(uid, syl["id"]) or syl
    latest_tests = dict(latest.get("unit_tests") or {})
    latest_tests[key] = ut
    db.update_syllabus(uid, syl["id"], {"unit_tests": latest_tests})
    return ut, ""


@app.post("/api/teach/chapter/answer")
def teach_chapter_answer(req: TeachChapterAnswerRequest):
    """单元测试提交批改：选择本地秒判、文字 AI 批改；输出薄弱小节定位 + 补弱建议（不设门槛）。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    syl = db.get_syllabus(uid, req.syllabus_id)
    if not syl:
        return {"ok": False, "error": "找不到这门课了"}
    chapters = syl.get("chapters") or []
    if not chapters:
        return {"ok": False, "error": "这门课的大纲结构不对"}
    ci = max(0, min(int(req.ch_index), len(chapters) - 1))
    unit_tests = dict(syl.get("unit_tests") or {})
    ut = unit_tests.get(str(ci)) if isinstance(unit_tests.get(str(ci)), dict) else None
    if not ut or not ut.get("paper"):
        return {"ok": False, "error": "先打开章末页生成试卷"}
    if ut.get("state") == "graded":
        return {"ok": True, "graded": True, "ch_index": ci, "result": ut.get("result") or {}}
    paper = ut.get("paper") or []
    answers = {int(a.get("q_index")): a for a in (req.answers or []) if isinstance(a, dict)}
    if not answers:
        return {"ok": False, "error": "先作答再提交"}
    teacher = teach.teacher_of(syl.get("teacher_id"))
    subject = str(syl.get("subject") or teacher["name"])
    results, scores = [], []
    weak = {}                                   # section名 → 失分
    for qi, item in enumerate(paper):
        ex = item.get("exam") or {}
        a = answers.get(qi) or {}
        if ex.get("type") == "choice":
            choice = str(a.get("choice") or "").strip()[:4].upper()
            grade = teach.grade_choice(ex, choice) if choice else {
                "verdict": "wrong", "score": 0, "comment": "未作答。", "step_feedback": [],
                "error_point": "未作答", "root_cause": "", "counterexample": "",
                "point_results": [], "chosen": "", "answer_key": str(ex.get("answer_key") or "")}
        else:
            text = str(a.get("text") or "").strip()[:2000]
            if not text:
                grade = {"verdict": "wrong", "score": 0, "comment": "未作答。",
                         "step_feedback": [], "error_point": "未作答",
                         "root_cause": "", "counterexample": "", "point_results": []}
            else:
                try:
                    grade = teach_llm.grade_text_answer(
                        ex.get("question") or "", ex.get("reference_answer") or "",
                        ex.get("points") or [], text,
                        str(item.get("kp") or ""), teacher)
                except Exception:
                    log.exception("unit grade failed")
                    grade = {"verdict": "partial", "score": 50, "comment": "这题批改超时了，先按完成计。",
                             "step_feedback": [], "error_point": "", "root_cause": "",
                             "counterexample": "", "point_results": []}
        scores.append(int(grade.get("score") or 0))
        sec = str(item.get("section") or "")
        if grade.get("verdict") != "correct" and sec:
            weak[sec] = weak.get(sec, 0) + 1
        results.append({"q_index": qi, "origin": item.get("origin"), "section": sec,
                        "kp": item.get("kp") or "", "grade": grade})
    total = int(round(sum(scores) / max(1, len(scores))))
    # 薄弱定位：失分小节名 → 小节索引（给前端「回跳补弱」按钮用）
    weak_list = sorted(weak.items(), key=lambda kv: -kv[1])
    items = syl.get("items") or []
    weak_out = [{"section": s, "miss": c, "index": next(
        (i for i, it in enumerate(items) if it.get("name") == s), -1)} for s, c in weak_list]
    advice = ("先回这几个小节把例题详解再看一遍：" + "、".join(s for s, _ in weak_list[:3])
              if weak_list else "这一章掌握得不错，可以直接进下一章。")
    result = {"score": total, "results": results, "weak": weak_out[:5], "advice": advice,
              "graded_at": _t.time()}
    ut["state"] = "graded"
    ut["result"] = result
    unit_tests[str(ci)] = ut
    db.update_syllabus(uid, syl["id"], {"unit_tests": unit_tests})
    # 答错进错题本 + 画像（与小节考试题同口径）
    try:
        items_book = db.load_errorbook(uid)
        for r in results:
            g = r.get("grade") or {}
            if g.get("verdict") == "correct":
                continue
            qi = int(r.get("q_index") or 0)
            ex = (paper[qi].get("exam") or {}) if qi < len(paper) else {}
            # 与 build_wrong_item 的 id 生成对齐：teach-{sid8}-{kp_index}；kp_index 用 ci*100+qi 保证跨章不撞
            wid = "teach-%s-%d" % (str(syl["id"])[:8], ci * 100 + qi)
            if not any(isinstance(x, dict) and str(x.get("id")) == wid for x in items_book):
                kp_name = str(r.get("kp") or paper[qi].get("kp") or "")
                if kp_name:
                    quiz_pick.record_event(uid, [kp_name], "bad", subject)
                items_book.append(teach.build_wrong_item(
                    session_id=str(syl["id"]), kp_index=ci * 100 + qi, subject=subject,
                    kp_name=str(r.get("section") or kp_name or "单元测试"), exam=ex,
                    user_answer=str((answers.get(qi) or {}).get("choice")
                                    or (answers.get(qi) or {}).get("text") or ""),
                    grade=g, now_ms=int(_t.time() * 1000)))
        db.save_errorbook(uid, items_book)
    except Exception:
        log.exception("unit wrong-book sync failed")
    return {"ok": True, "graded": True, "ch_index": ci, "result": result}


@app.post("/api/teach/syllabus/edit")
def teach_syllabus_edit(req: TeachEditRequest):
    """大纲编辑：改名 / 增删知识点 / 重置进度 / 换老师 / 删课。"""
    uid = _teach_guard(req.token)
    if not uid:
        return {"ok": False, "error": GUEST_LINE}
    syl = db.get_syllabus(uid, req.syllabus_id)
    if not syl:
        return {"ok": False, "error": "找不到这门课了"}
    act = (req.action or "").strip()
    items = list(syl.get("items") or [])
    if act == "delete":
        db.delete_syllabus(uid, syl["id"])
        return {"ok": True, "deleted": True}
    if act == "rename":
        title = (req.title or "").strip()[:40]
        if not title:
            return {"ok": False, "error": "名字不能为空"}
        db.update_syllabus(uid, syl["id"], {"title": title})
    elif act == "switch_teacher":
        t = teach.teacher_of(req.teacher_id)
        db.update_syllabus(uid, syl["id"], {"teacher_id": t["id"]})
    elif act == "rename_ch":
        # 章改名（2026-10-10 两级大纲）：ch_index 定位章
        chapters = list(syl.get("chapters") or [])
        ci = int(req.ch_index)
        if not (0 <= ci < len(chapters)):
            return {"ok": False, "error": "这一章不存在"}
        nm = (req.name or "").strip()[:60]
        if not nm:
            return {"ok": False, "error": "章名不能为空"}
        chapters[ci] = {**chapters[ci], "name": nm}
        db.update_syllabus(uid, syl["id"], {"chapters": chapters})
    elif act == "add":
        name = (req.name or "").strip()[:60]
        if not name:
            return {"ok": False, "error": "知识点名不能为空"}
        kp = {"name": name, "brief": (req.brief or "").strip()[:200]}
        i = int(req.index)
        items.insert(i if 0 <= i <= len(items) else len(items), kp)
        ins = min(max(0, i), len(items) - 1)
        done = sorted((x + 1 if x >= ins else x) for x in {int(x) for x in (syl.get("kp_done") or [])})
        # 新节归入插入位置所属的章，章 count 同步 +1
        chapters = list(syl.get("chapters") or [])
        if chapters:
            ci = teach.chapter_of(chapters, ins)
            chapters[ci] = {**chapters[ci], "count": int(chapters[ci].get("count") or 0) + 1}
        db.update_syllabus(uid, syl["id"], {"items": items, "kp_done": done, "chapters": chapters})
    elif act == "del":
        i = int(req.index)
        if not (0 <= i < len(items)):
            return {"ok": False, "error": "这个知识点不存在"}
        items.pop(i)
        if not items:
            return {"ok": False, "error": "至少要留一个知识点"}
        cursor = int(syl.get("cursor") or 0)
        # 删点 → ✓ 索引同步重排（被删的移除，其后的前移一位）
        done = [int(x) for x in (syl.get("kp_done") or []) if int(x) != i]
        done = sorted((x - 1 if x > i else x) for x in done)
        if i < cursor:
            cursor -= 1
        cursor = max(0, min(cursor, len(items)))
        # 所属章 count -1；章被掏空则整章移除
        chapters = [dict(c) for c in (syl.get("chapters") or [])]
        if chapters:
            ci = teach.chapter_of(chapters, i)
            chapters[ci]["count"] = int(chapters[ci].get("count") or 0) - 1
            chapters = [c for c in chapters if int(c.get("count") or 0) > 0]
        db.clear_teach_sessions(uid, syl["id"])     # 删点后旧的讲义索引会错位，清掉重生成
        db.update_syllabus(uid, syl["id"],
                           {"items": items, "cursor": cursor, "kp_done": done, "chapters": chapters})
    elif act == "reset":
        db.clear_teach_sessions(uid, syl["id"])
        db.update_syllabus(uid, syl["id"],
                           {"cursor": 0, "status": "active", "kp_done": [], "unit_tests": {}})
    else:
        return {"ok": False, "error": "不支持的操作"}
    return {"ok": True, "syllabus": _syllabus_payload(db.get_syllabus(uid, syl["id"]) or {})}


# 单页应用（history 模式路由）回退：
# /wrongbook、/more 这类前端路由在服务器上没有实体文件，必须回 index.html；
# 但 /assets/*.js、/chart.umd.js 等**真实存在的静态文件必须直接返回文件本身**，
# 否则会被兜底成 index.html（HTML），浏览器报 MIME 错误导致整站白屏。
# 规则：请求路径对应真实文件 → 返回文件；否则 → 回 index.html；/api|docs|openapi → 404。
@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str, request: Request):
    if full_path.startswith(("api/", "docs", "openapi")):
        raise HTTPException(status_code=404, detail="Not Found")
    static_dir = _resolve_static_dir()
    if not static_dir:
        raise HTTPException(status_code=404, detail="前端资源未构建")

    static_root = static_dir.resolve()
    target = (static_dir / full_path).resolve()
    # 目录穿越防护
    if not str(target).startswith(str(static_root) + os.sep) and target != static_root:
        raise HTTPException(status_code=404, detail="Not Found")

    if target.is_file():
        ext = os.path.splitext(target.name)[1].lower()
        return _file_or_304(request, target, _STATIC_MIME.get(ext))

    index = static_dir / "index.html"
    if index.exists():
        return _file_or_304(request, index, "text/html")
    raise HTTPException(status_code=404, detail="前端资源未构建")

if STATIC_DIR:
    # mount 放在所有 API 路由之后，作为兜底；/api/* 仍优先匹配
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    log.info("静态页目录: %s", STATIC_DIR)
