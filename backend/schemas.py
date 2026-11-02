from pydantic import BaseModel, Field


class ExtractRequest(BaseModel):
    image_base64: str = Field(..., description="图片 base64，可带 data URL 前缀")
    mime: str = "image/png"
    mode: str = "question"   # question=提取题目 | answer=逐字转录学生手写作答（自测批改用）


class ExplainRequest(BaseModel):
    question: str
    attempt: str = ""
    depth: str = "standard"   # 批次3：brief | standard | deep


class JudgeRequest(BaseModel):
    question: str
    reference: str
    user_answer: str
    steps: list = []          # 解题步骤（供批改对照，可选）
    key_breakthrough: str = ""  # 关键突破口
    knowledge_points: list = [] # 知识点


# ---------------- 账号体系 ----------------

class RegisterRequest(BaseModel):
    nickname: str
    password: str
    password_confirm: str = ""
    client_id: str = ""


class LoginRequest(BaseModel):
    nickname: str
    password: str


class VerifyRequest(BaseModel):
    token: str = ""


class ChangePasswordRequest(BaseModel):
    token: str = ""
    old_password: str = ""
    new_password: str = ""
    password_confirm: str = ""


class RecoverRequest(BaseModel):
    nickname: str
    backup_code: str = ""
    new_password: str = ""
    password_confirm: str = ""


class AdminResetRequest(BaseModel):
    nickname: str
    new_password: str = ""


# ---------------- 个人主页 ----------------

class ProfileSaveRequest(BaseModel):
    token: str = ""
    profile: dict = {}        # 头像/签名/学校/专业/年级/偏好等（整体覆盖）


class RenameRequest(BaseModel):
    token: str = ""
    password: str = ""        # 安全校验：改名必须验密码
    new_nickname: str = ""


class DeleteAccountRequest(BaseModel):
    token: str = ""
    password: str = ""


class ResetBackupRequest(BaseModel):
    token: str = ""
    password: str = ""


class FeedbackRequest(BaseModel):
    token: str = ""
    content: str = ""
    contact: str = ""
    version: str = ""


class SyncPushRequest(BaseModel):
    token: str = ""
    items: list = []
    deleted_ids: list[str] = []  # 显式删除；缺少条目不再表示删除
    stats: dict = {}          # 打卡/连续/成就统计（老客户端不传也兼容）
    courses: dict = {}        # 课程/知识点/课表（批次1；老客户端不传也兼容）
    sessions: list = []       # 学习记录（批次1；老客户端不传也兼容）
    exams: list = []          # 模拟考试试卷（老客户端不传也兼容）


class SyncPullRequest(BaseModel):
    token: str = ""


# ---------------- 模拟考试（组卷 / 判卷） ----------------

class PaperPlanItem(BaseModel):
    type: str = "choice"      # choice | blank | solution
    count: int = 0            # 该题型题量
    score: int = 0            # 每题分值（分值为整数；总数由后端按 plan 覆盖，保证总分 100）


class GeneratePaperRequest(BaseModel):
    mode: str = "full"                 # full | choice | blank
    plan: list = []                    # [{type, count, score}]，决定题型配比与分值
    knowledge_points: list = []        # 出题范围（知识点）
    subject: str = ""                  # 学科（可选）
    difficulty: str = "standard"       # standard | easy | hard（可选）


class JudgePaperQuestion(BaseModel):
    id: object = None                  # 题号或题目 id
    question: str = ""
    reference: str = ""                # 参考答案
    user_answer: str = ""
    score: int = 0                     # 本题满分
    knowledge_points: list = []


class JudgePaperRequest(BaseModel):
    questions: list = []               # 仅主观题（选择题在前端本地判）


class RunRequest(BaseModel):
    language: str = "python"  # python | c
    code: str = ""
    stdin: str = ""


class DebugRequest(BaseModel):
    code: str = ""
    error: str = ""        # 报错信息
    language: str = ""     # 语言（可选，AI 可自行判断）
    description: str = ""  # 问题描述（可选）


class CompanionChatRequest(BaseModel):
    """伴学角色闲聊：人设由前端注入（V1 轻自定义——形象自带人设 + 用户改名）。"""
    token: str = ""
    character: str = ""    # 角色 id，如 yue / nailong
    name: str = ""         # 当前显示名（含用户改名）
    persona: str = ""      # 人设描述
    message: str = ""
    history: list = []     # 已登录时以云端历史为准，该字段仅作旧客户端兼容
    pending_question: str = ""  # 主页求教泡找回：待请教题目摘要（用户问「题目是啥」时 AI 能如实复述）
    session_id: str = ""   # p20：聊天记录会话 id（记忆按会话隔离）


class CustomCompanionCreateRequest(BaseModel):
    """造角色二期：用户自定义伴学角色创建。"""
    token: str = ""
    name: str = ""              # 角色名 ≤6 字
    template: str = ""          # 性格模板 key：cheerful/gentle/cool/passionate/funny/healing
    extra: str = ""             # 一句话补充（可空，LLM 融合进 persona）
    image: str = ""             # dataURL（image/png 或 image/jpeg，前端已压至 ≤600px 宽）
    ratio: float = 0.5          # 立绘 宽/高 比


class CustomCompanionDeleteRequest(BaseModel):
    token: str = ""
    char_id: str = ""


class CustomAiGenRequest(BaseModel):
    """AI 造角色·第一步：照片 → AI 画成 Q 版立绘（2026-10-09）。"""
    token: str = ""
    image: str = ""             # 照片 dataURL（前端已压缩）
    mime: str = "image/jpeg"
    hint: str = ""              # 用户补充描述（可空，≤60 字）


class CustomAiSaveRequest(BaseModel):
    """AI 造角色·第二步：确认保存（凭 gen_id 取服务端暂存图，防绕过 AI 直传）。"""
    token: str = ""
    gen_id: str = ""
    name: str = ""              # 角色名 ≤6 字
    template: str = ""          # 性格模板 key
    extra: str = ""


class CustomAiUpdateRequest(BaseModel):
    """AI 造角色·编辑（2026-10-09）：char_id 不变原地更新，聊天/亲密度保留。
    gen_id 空 = 不换形象（沿用旧 BLOB，不扣生图次数）；非空 = 取暂存新图（重画已在 ai-gen 扣过额度）。"""
    token: str = ""
    char_id: str = ""
    gen_id: str = ""            # 可空
    name: str = ""              # 角色名 ≤6 字
    template: str = ""          # 性格模板 key
    extra: str = ""


class CompanionHistoryRequest(BaseModel):
    """拉取伙伴页云端聊天历史 + 全部角色偏好（名字/大小）。"""
    token: str = ""
    character: str = ""
    session_id: str = ""   # p20：只取该会话的消息；为空兼容旧客户端（全量流水）


class CompanionSessionListRequest(BaseModel):
    """p20：历史对话列表（标题/计数/最后一句/是否含进行中的链）。"""
    token: str = ""
    character: str = ""


class CompanionSessionCreateRequest(BaseModel):
    """p20：新开一条聊天记录（每角色 30 条上限，超出自动清最旧）。"""
    token: str = ""
    character: str = ""


class CompanionSessionRenameRequest(BaseModel):
    """p20：重命名聊天记录（≤18 字）。"""
    token: str = ""
    session_id: str = ""
    title: str = ""


class CompanionSessionDeleteRequest(BaseModel):
    """p20：删除聊天记录（消息级联删除、进行中的链作废）。"""
    token: str = ""
    session_id: str = ""


class CompanionPrefRequest(BaseModel):
    """角色偏好：改名 + 页面立绘大小（0.6~2.0，None 表示不修改）。"""
    token: str = ""
    character: str = ""
    name: str | None = None
    size_scale: float | None = None


class CompanionQuizRequest(BaseModel):
    """轻量问答：start=出题（纯 SQL 选题不耗模型）/ answer=点评 / peek=冒泡取题（不计费）。"""
    token: str = ""
    character: str = ""
    name: str = ""
    persona: str = ""
    action: str = "start"
    question_id: str = ""   # start 可指定题目（行走角色冒泡点击跳转）
    question: str = ""      # answer：题目文本
    source: str = ""        # answer：来源标签
    answer: str = ""        # answer：用户作答
    chain_id: str = ""      # chain_start/chain_answer：小老师模式问题链标识
    step_idx: int = -1      # chain_answer：当前讲解的层序号（服务端校验用）
    session_id: str = ""    # p20：链/考题绑定会话（进度隔离）


class CompanionAsrRequest(BaseModel):
    """语音转文字：浏览器录好 WAV 转 base64 上传。"""
    token: str = ""
    audio_base64: str = ""
    mime: str = "wav"


class GenerateQuizRequest(BaseModel):
    knowledge_points: list = []   # 要练习的知识点
    reference_question: str = ""  # 参考原题（可选，用于对齐难度）
    subject: str = ""             # 学科（可选）


# ---------------- 讲解追问 / 换个讲法 ----------------

class FollowUpRequest(BaseModel):
    question: str = ""       # 题干
    result: dict = {}        # 该题已有的讲解结果（供追问时对齐上下文）
    history: list = []       # 已有追问，[{q, a}, ...]，取最近若干轮
    followup: str = ""       # 本次追问
    mode: str = "deep"       # deep=深思（讲解位） | fast=快答（批改位）


class ReteachRequest(BaseModel):
    question: str = ""
    result: dict = {}
    angle: str = "basic"     # basic 更基础 | another 换个方法 | visual 直观图像化 | exam 考点视角


# ---------------- 批次2：变式题 / AI 对话 ----------------

class VariantRequest(BaseModel):
    question: str = ""
    answer: str = ""
    subject: str = ""
    strategy: str = "same_point"   # same_point | change_data | change_angle | change_type
    count: int = 1


class ChatStreamRequest(BaseModel):
    messages: list = []            # [{ role: "user"|"assistant", text: "..." }]
    context: list = []             # 引用的学习内容 [{ title, brief }]


# ---------------- 批次4：学情分析 ----------------

class AnalyzeRequest(BaseModel):
    summary: dict = {}         # 聚合摘要：{total, mastered, points:[...], reasons:[...]}
    sample_questions: list = []  # 最多 5 条题目摘要（各 ≤120 字）


class DailyAdviceRequest(BaseModel):
    summary: dict = {}         # 今日上下文：{date, lessons:[{start,end,name}], due, weak_points, next_chapter, done_today}


# ---------------- 社区：论坛 ----------------

class ForumListRequest(BaseModel):
    sort: str = "latest"       # latest | hot
    limit: int = 20
    offset: int = 0


class ForumDetailRequest(BaseModel):
    post_id: str = ""


class ForumCommentsRequest(BaseModel):
    post_id: str = ""


class CreatePostRequest(BaseModel):
    token: str = ""
    type: str = "thought"      # thought 学习感想 | question 题目求助
    title: str = ""
    content: str = ""          # 纯文本正文（感想）或题目帖的补充说明
    card: dict | None = None   # 题目卡片（question 类型）；感想帖可为 null（handler 里按空处理）


class CommentRequest(BaseModel):
    token: str = ""
    post_id: str = ""
    content: str = ""


class LikeRequest(BaseModel):
    token: str = ""
    post_id: str = ""


class DeletePostRequest(BaseModel):
    token: str = ""
    post_id: str = ""


# ---------------- 社区：学习小组 ----------------

class CreateGroupRequest(BaseModel):
    token: str = ""
    name: str = ""
    description: str = ""


class JoinGroupRequest(BaseModel):
    token: str = ""
    invite_code: str = ""


class GroupDetailRequest(BaseModel):
    token: str = ""
    group_id: str = ""


class GroupMessagesRequest(BaseModel):
    token: str = ""
    group_id: str = ""
    limit: int = 100
    offset: int = 0


class GroupSendRequest(BaseModel):
    token: str = ""
    group_id: str = ""
    type: str = "text"         # text 文本 | question 题目卡片
    content: str = ""          # 纯文本，或题目卡片 JSON 字符串


class GroupInviteRequest(BaseModel):
    token: str = ""
    group_id: str = ""
    nickname: str = ""         # 按昵称直接拉人进组（仅 owner）


class GroupRemoveMemberRequest(BaseModel):
    token: str = ""
    group_id: str = ""
    user_id: str = ""          # 组长要移除的成员（仅 owner）


# ---------------- 班级模块 ----------------

class TeacherApplyRequest(BaseModel):
    token: str = ""
    name: str = ""             # 真实姓名（公示用，可填化名）
    school: str = ""
    subject: str = ""


class ClassCreateRequest(BaseModel):
    token: str = ""
    name: str = ""
    subject: str = ""
    grade: str = ""


class ClassJoinRequest(BaseModel):
    token: str = ""
    code: str = ""             # 6 位班级码


class HomeworkCreateRequest(BaseModel):
    token: str = ""
    class_id: str = ""
    title: str = ""
    content: str = ""          # 题目/要求（纯文本，可多题；有图时可为空）
    reference: str = ""        # 参考答案/评分要点（给 AI 批改用，选填）
    due_at: int = 0            # 截止时间戳（毫秒），0 = 不限
    images: list = []          # 老师上传的题目图片（dataURL，最多 9 张，选填）


class HomeworkListRequest(BaseModel):
    token: str = ""
    class_id: str = ""


class HomeworkDetailRequest(BaseModel):
    token: str = ""
    homework_id: str = ""


class HomeworkAssignImagesRequest(BaseModel):
    token: str = ""
    homework_id: str = ""


class ClassNoteCreateRequest(BaseModel):
    token: str = ""
    class_id: str = ""
    title: str = ""
    content: str = ""          # 笔记正文（有图时可留空）
    images: list = []          # 最多 9 张


class ClassNoteListRequest(BaseModel):
    token: str = ""
    class_id: str = ""


class ClassNoteIdRequest(BaseModel):
    token: str = ""
    note_id: str = ""


class ClassTestCreateRequest(BaseModel):
    token: str = ""
    class_id: str = ""
    title: str = ""
    duration_sec: int = 600     # 限时（秒）
    items: list = []            # [{type:'choice'|'blank', question, options, answer, score}]


class ClassTestGenerateRequest(BaseModel):
    token: str = ""
    class_id: str = ""
    subject: str = ""           # 学科，如 高等数学
    topic: str = ""             # 考察范围，如 第 1-3 章 极限与连续
    choice_count: int = 5
    choice_score: float = 10
    blank_count: int = 5
    blank_score: float = 10


class ClassTestListRequest(BaseModel):
    token: str = ""
    class_id: str = ""


class ClassTestIdRequest(BaseModel):
    token: str = ""
    test_id: str = ""
    preview: int = 0            # 1=仅预览（不创建作答记录、不开始计时）


class ClassTestSubmitRequest(BaseModel):
    token: str = ""
    test_id: str = ""
    answers: dict = {}          # {题目序号(index 字符串): 作答}
    elapsed_sec: int = 0        # 前端计的作答用时（服务端以 started_at 复核）


class HomeworkSubmitRequest(BaseModel):
    token: str = ""
    homework_id: str = ""
    image_base64: str = ""     # 兼容旧客户端的单图字段；新客户端用 images
    mime: str = "image/jpeg"
    note: str = ""             # 文字说明（选填）
    images: list = []          # 多张答卷图（dataURL，最多 9 张）


class HomeworkSubmissionsRequest(BaseModel):
    token: str = ""
    homework_id: str = ""


class HomeworkGradeRequest(BaseModel):
    token: str = ""
    homework_id: str = ""
    user_id: str = ""          # 批改某一位学生的提交（老师操作）


class GroupStreamRequest(BaseModel):
    """群聊实时增量流：since 为毫秒时间戳，只推此后的新消息（0 表示从现在开始）。"""
    token: str = ""
    group_id: str = ""
    since: int = 0


class GradeTaskRequest(BaseModel):
    """启动/查询后台批改任务：按作业维度处理，同一作业同时只允许一个任务。"""
    token: str = ""
    homework_id: str = ""


class ClassExportRequest(BaseModel):
    token: str = ""
    homework_id: str = ""


class HomeworkReportRequest(BaseModel):
    token: str = ""
    homework_id: str = ""


class HomeworkPushRequest(BaseModel):
    token: str = ""
    homework_id: str = ""
    kind: str = "report"       # report 班级报告 | student 某学生的反馈
    user_id: str = ""          # kind=student 时指定


class HomeworkImageRequest(BaseModel):
    token: str = ""
    homework_id: str = ""
    user_id: str = ""          # 老师查看某学生的作业原图


# ---------------- AI 教学老师（2026-10-09） ----------------

from pydantic import model_validator


class TeachBase(BaseModel):
    """教学模块统一入口校验：Pydantic v2 对 str 字段收到 null/数字会直接 422，
    前端「我的课程」id 是数字、部分字段可能传 null，这里统一 coerce（2026-10-09 开课 422 修复）"""

    @model_validator(mode="before")
    @classmethod
    def _coerce_teach_types(cls, data):
        if not isinstance(data, dict):
            return data
        out = dict(data)
        for name, f in cls.model_fields.items():
            if name not in out:
                continue
            v = out[name]
            if v is None:
                # None → 用字段默认值（如 teacher_id 默认 chenli）
                out[name] = f.get_default(call_default_factory=True)
                continue
            if f.annotation is str:
                if isinstance(v, bool):
                    out[name] = "1" if v else "0"
                elif isinstance(v, (int, float)):
                    out[name] = str(int(v)) if isinstance(v, int) else str(v)
            elif f.annotation is int:
                if isinstance(v, bool):
                    out[name] = int(v)
                elif isinstance(v, float):
                    out[name] = int(v)
                elif isinstance(v, str):
                    s = v.strip()
                    if not s:
                        out[name] = f.get_default(call_default_factory=True)
                    else:
                        try:
                            out[name] = int(float(s))
                        except ValueError:
                            pass  # 留给 pydantic 报 422，非数字串不该静默吞
        return out


class TeachSyllabusRequest(TeachBase):
    token: str = ""
    subject: str = ""          # 学科名（手输或来自「我的课程」）
    course_id: str = ""        # 关联课程 id（可选）
    teacher_id: str = "chenli"
    level: str = "auto"        # auto | basic | final | kaoyan
    want: int = 14             # 期望知识点数量


class TeachStartRequest(TeachBase):
    token: str = ""
    syllabus_id: str = ""
    kp_index: int = -1         # -1 = 用大纲当前游标
    minutes: int = 0           # 上一讲耗时（进学习记录）


class TeachAnswerRequest(TeachBase):
    token: str = ""
    session_id: str = ""
    choice: str = ""           # 选择题所选项（A/B/C/D）
    text: str = ""             # 文字题作答


class TeachAskRequest(TeachBase):
    token: str = ""
    session_id: str = ""
    question: str = ""


class TeachNextRequest(TeachBase):
    token: str = ""
    session_id: str = ""
    minutes: int = 0


class TeachChapterRequest(TeachBase):
    """章末（2026-10-10 章节化）：总结 + 单元测试。"""
    token: str = ""
    syllabus_id: str = ""
    ch_index: int = -1          # 章号


class TeachChapterAnswerRequest(TeachBase):
    """单元测试提交：answers = [{q_index, choice, text}]（与题目顺序对齐）。"""
    token: str = ""
    syllabus_id: str = ""
    ch_index: int = -1
    answers: list = []


class TeachExamAnalysisRequest(TeachBase):
    """批改后的逐选项分析（结果缓存，同题不二次花钱）。"""
    token: str = ""
    session_id: str = ""


class TeachEditRequest(TeachBase):
    token: str = ""
    syllabus_id: str = ""
    action: str = ""           # rename | add | del | reset | switch_teacher | delete | rename_ch
    title: str = ""
    index: int = -1
    name: str = ""
    brief: str = ""
    teacher_id: str = ""
    ch_index: int = -1         # rename_ch / 章级操作用

