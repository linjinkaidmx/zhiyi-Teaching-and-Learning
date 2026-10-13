/**
 * AI 教学老师 · 前端纯逻辑（2026-10-09，可离线断言）
 * ---------------------------------------------------------------------------
 * 与后端 teach.py 同规则，形成双保险：
 *   1. 确认语识别（「会了，下一个知识点」是推进的唯一语义入口）
 *   2. 状态迁移校验（防乱点，前端先挡一道）
 *   3. 讲义 → 视图模型（选项渲染、批改着色、进度文案）
 * 本模块不依赖浏览器与网络，`_qa_teach_flow.mjs` 直接跑断言。
 */

/* ---------------- 两位老师（B1 用占位形象，B3 换立绘） ---------------- */
export const TEACHERS = [
  {
    id: 'chenli', name: '陈砺', title: '陈老师', gender: 'male',
    emoji: '👨‍🏫', color: '#3D6FA8', style: '沉稳 · 板书式',
    tags: ['先讲原理', '板书推导', '节奏稳'],
    line: '先把逻辑链走一遍，别急着套公式。',
  },
  {
    id: 'shentong', name: '沈疏桐', title: '沈老师', gender: 'female',
    emoji: '👩‍🏫', color: '#B5725A', style: '细致 · 多举例',
    tags: ['多举例', '小步拆解', '耐心追问'],
    line: '跟上了吗？我们把它拆成小步来。',
  },
]
export const DEFAULT_TEACHER = 'chenli'

export function teacherOf(id) {
  return TEACHERS.find((t) => t.id === id) || TEACHERS[0]
}

/* ---------------- 老师立绘（public/teachers/*.webp，四档表情差分） ---------------- */
export const TEACHER_FACES = ['default', 'talk', 'happy', 'surprised']
/** 换立绘时要 bump 这个版本号（否则浏览器拿旧图缓存） */
const ART_V = 1

/** 立绘资源路径。face 非法时回退 default。 */
export function teacherArt(id, face = 'default') {
  const t = teacherOf(id)
  const f = TEACHER_FACES.includes(face) ? face : 'default'
  return `/teachers/${t.id}_${f}.webp?v=${ART_V}`
}

/** 页面内部状态 → 立绘档位（idle 用默认表情） */
export function artFace(state) {
  return TEACHER_FACES.includes(state) ? state : 'default'
}

/* ---------------- 状态机（与后端 teach.TRANSITIONS 一致） ---------------- */
export const STATES = ['lecture', 'exam', 'graded', 'done']

export const TRANSITIONS = {
  start: { lecture: 'exam' },
  answer: { exam: 'graded' },
  ask: { lecture: 'lecture', exam: 'exam', graded: 'exam' }, // 解答完回到考试题
  // 推进闸门是「用户确认掌握」，不是「必须先答题」
  next: { exam: 'lecture', graded: 'lecture' },
  finish: { graded: 'done' },
}

export function can(state, event) {
  return !!((TRANSITIONS[event] || {})[state])
}

export function nextState(state, event) {
  return ((TRANSITIONS[event] || {})[state]) || ''
}

/* ---------------- 确认语识别（词表与后端保持一致） ---------------- */
const NEG_WORDS = ['不会', '没会', '不懂', '没懂', '不明白', '没明白', '不清楚', '不确定', '没把握',
  '等一下', '等等', '先别', '还没', '还不', '重讲', '再讲一遍', '没跟上']
const CONFIRM_WORDS = ['会了', '下一个', '下一题', '下一讲', 'next', '懂了',
  '学会了', '明白了', '可以了', '往下']

export function normText(text) {
  return String(text || '')
    .replace(/[\s，,。．.、；;：:！!？?~～"'“”‘’`（）()\[\]【】]+/g, '')
    .toLowerCase()
}

/** 是否表示「我掌握了，讲下一个」（否定表达一律不算；长句多为提问） */
export function isConfirm(text) {
  const t = normText(text)
  if (!t || t.length > 24) return false
  if (NEG_WORDS.some((w) => t.includes(w))) return false
  return CONFIRM_WORDS.some((w) => t.includes(w))
}

/* ---------------- 讲义 → 视图模型 ---------------- */

/** 选项着色：未揭晓时只标已选；揭晓后标对错 */
export function optionState(key, chosen, answerKey, revealed) {
  const k = String(key || '').toUpperCase()
  const c = String(chosen || '').toUpperCase()
  const a = String(answerKey || '').toUpperCase()
  if (revealed) {
    if (a && k === a) return 'right'
    if (c && k === c && k !== a) return 'wrong'
    return ''
  }
  return c && k === c ? 'chosen' : ''
}

export function gradeMeta(verdict) {
  if (verdict === 'correct') return { tone: 'ok', label: '答对了' }
  if (verdict === 'partial') return { tone: 'warn', label: '差一点' }
  return { tone: 'bad', label: '没答对' }
}

export function progressLabel(cursor, total) {
  const t = Number(total) || 0
  const c = Math.max(0, Math.min(Number(cursor) || 0, t))
  if (!t) return '还没有知识点'
  return `第 ${Math.min(c + 1, t)} / ${t} 讲`
}

/**
 * 章节目录状态（2026-10-09）：done=已确认掌握✓ / cur=当前讲▶ / started=学过未确认● / todo=未学○
 * 优先级：当前讲 > 已掌握 > 学过 > 未学（跳回已✓的章重学时显示▶，学完再变回✓）
 */
export function kpStatusOf(syl, i) {
  const s = syl || {}
  const cur = Number(s.cursor) || 0
  if (i === cur && s.status !== 'done') return 'cur'
  if ((s.kp_done || []).map(Number).includes(i)) return 'done'
  if ((s.kp_started || []).map(Number).includes(i)) return 'started'
  return 'todo'
}

/** 讲义要点拼串（提疑问时带给后端做上下文，用户看不到） */
export function kpContextOf(lecture) {
  const kp = (lecture && lecture.kp) || {}
  const parts = [kp.definition, kp.principle]
  if (Array.isArray(kp.pitfalls) && kp.pitfalls.length) parts.push('易错：' + kp.pitfalls.join('、'))
  return parts.filter(Boolean).join('；')
}

/** 学生视角作答是否为空（前端先挡一道，少一次无谓请求） */
export function answerPayload(exam, { choice = '', text = '' } = {}) {
  const type = (exam && exam.type) || 'text'
  if (type === 'choice') {
    const c = String(choice || '').trim().toUpperCase()
    return c ? { choice: c, text: '' } : null
  }
  const t = String(text || '').trim()
  return t ? { choice: '', text: t } : null
}

/** 备课骨架文案（讲义生成期间的进度提示） */
export const PREP_STEPS = ['正在翻阅这门课的脉络…', '正在挑这一讲的例题…', '正在出考试题…']
