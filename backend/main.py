"""知一 MVP 后端。业务接口（extract/explain/judge）+ 账号体系 + 错题本云同步。

同源部署：单 uvicorn 进程同时 serve 前端静态页（dist）与 API，根除跨域/混合内容问题。
"""
import hashlib
import json
import logging
import os
import resource
import subprocess
import sys
import tempfile
import asyncio
import threading
import time as _t
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import auth
import bank
import db
import service
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
    LikeRequest,
    VariantRequest,
    ChatStreamRequest,
    AnalyzeRequest,
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
    elif str(resp.headers.get("content-type", "")).startswith("text/html"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


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
    db.save_errorbook(profile["nickname"], req.items)
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
    return {"ok": True, "count": len(req.items)}


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
    def set_limits():
        # CPU 5 秒；地址空间 512MB；禁止生成 core 文件
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        except Exception:
            pass

    return subprocess.run(
        cmd,
        input=stdin_text,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
        cwd=cwd,
        preexec_fn=set_limits,
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

# 单页应用（history 模式路由）回退：
# /wrongbook、/more 这类前端路由在服务器上没有实体文件，必须回 index.html；
# 但 /assets/*.js、/chart.umd.js 等**真实存在的静态文件必须直接返回文件本身**，
# 否则会被兜底成 index.html（HTML），浏览器报 MIME 错误导致整站白屏。
# 规则：请求路径对应真实文件 → 返回文件；否则 → 回 index.html；/api|docs|openapi → 404。
@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
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
        return FileResponse(target, media_type=_STATIC_MIME.get(ext))

    index = static_dir / "index.html"
    if index.exists():
        return FileResponse(index, media_type="text/html")
    raise HTTPException(status_code=404, detail="前端资源未构建")

if STATIC_DIR:
    # mount 放在所有 API 路由之后，作为兜底；/api/* 仍优先匹配
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    log.info("静态页目录: %s", STATIC_DIR)
