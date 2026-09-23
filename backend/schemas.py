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
    card: dict = {}            # 题目卡片（question 类型）：{question, answer, steps, knowledgePoints, subject}


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

