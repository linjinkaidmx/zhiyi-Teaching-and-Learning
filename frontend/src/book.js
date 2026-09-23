// 错题本：本地双空间（游客 / 账号），不强依赖服务端账号
// 两个空间完全隔离、互不覆盖：游客用游客 key，登录后切到账号 key，退出回到游客视图
const KEY_GUEST = 'zhiyi_errorbook_v1'
const KEY_ACCOUNT = 'zhiyi_errorbook_account_v1'
const SETTINGS_KEY = 'zhiyi_settings_v1'
const DAY = 86400000

function bookKey(space) {
  return space === 'account' ? KEY_ACCOUNT : KEY_GUEST
}

export function loadBook(space = 'guest') {
  try {
    const raw = localStorage.getItem(bookKey(space))
    const list = raw ? JSON.parse(raw) : []
    return (Array.isArray(list) ? list : []).map(migrate)
  } catch {
    return []
  }
}

// 旧数据迁移：补齐 SRS 字段与追问/换个讲法容器
function migrate(item) {
  return {
    ...item,
    reviewAt: typeof item.reviewAt === 'number' ? item.reviewAt : 0,
    interval: item.interval || 1,
    repetitions: item.repetitions || 0,
    followups: Array.isArray(item.followups) ? item.followups : [],
    reteach: Array.isArray(item.reteach) ? item.reteach : [],
    courseId: typeof item.courseId === 'string' ? item.courseId : '',
  }
}

export function saveBook(list, space = 'guest') {
  localStorage.setItem(bookKey(space), JSON.stringify(list))
}

let _seq = Date.now()
export function nextId() {
  return Date.now() * 1000 + (_seq++ % 1000)
}

// ---- 复习设置（SRS，用户可配置、可关闭）
export const DEFAULT_SETTINGS = {
  srsEnabled: true,           // 关闭 = 掌握即永久移出（旧行为）
  srsMode: 'ladder',          // 'ladder' 阶梯间隔 | 'fixed' 固定天数
  srsIntervals: [1, 3, 7, 15, 30], // 阶梯间隔（天）
  srsFixedDays: 7,            // 固定模式的天数
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const s = raw ? JSON.parse(raw) : {}
    return { ...DEFAULT_SETTINGS, ...s }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

/** 答对后下一个复习间隔（天）。 */
export function nextInterval(repetitions, settings) {
  const s = settings || DEFAULT_SETTINGS
  if (!s.srsEnabled) return 0
  if (s.srsMode === 'fixed') return s.srsFixedDays || 7
  const arr = (s.srsIntervals && s.srsIntervals.length) ? s.srsIntervals : DEFAULT_SETTINGS.srsIntervals
  return arr[Math.min(Math.max(repetitions - 1, 0), arr.length - 1)] || 30
}

/**
 * 讲解结果 → 错题条目。MCP 数据字段对齐讲解 JSON。
 * extras：{ followups, reteach }（讲解过程中产生的追问与「换个讲法」版本，随题一起入库）
 */
export function makeItem(question, attempt, result, extras = {}) {
  return {
    id: nextId(),
    question,
    attempt: attempt || '',
    subject: result.subject || '未分类',
    questionType: result.question_type || '',
    answer: result.answer || '',
    steps: Array.isArray(result.steps) ? result.steps : [],
    keyBreakthrough: result.key_breakthrough || '',
    knowledgePoints: Array.isArray(result.knowledge_points) ? result.knowledge_points : [],
    knowledgeReview: result.knowledge_review || '',
    extensions: Array.isArray(result.extensions) ? result.extensions : [],
    diagnosis: result.diagnosis || '',
    followups: Array.isArray(extras.followups) ? extras.followups : [],
    reteach: Array.isArray(extras.reteach) ? extras.reteach : [],
    // 学情字段
    streak: 0, // 连续答对次数，达到 2 即掌握
    quizCount: 0,
    correctCount: 0,
    mastered: false,
    reviewAt: 0,      // 下次复习时间戳（0 或过去 = 立即需复习）
    interval: 1,      // 当前复习间隔（天）
    repetitions: 0,   // 成功复习次数
    courseId: typeof extras.courseId === 'string' ? extras.courseId : '', // 用户手动归类到的课程
    createdAt: new Date().toISOString(),
  }
}

export function upsertItem(list, item) {
  const idx = list.findIndex((it) => it.id === item.id)
  if (idx >= 0) {
    const copy = list.slice()
    copy[idx] = item
    return copy
  }
  return [item, ...list]
}

export function removeItem(list, id) {
  return list.filter((it) => it.id !== id)
}

/** 组卷池：未掌握题 + （开启 SRS 时）到期的已掌握题。笔记（kind='note'）不参与自测与复习。 */
export function quizPool(list, settings) {
  const s = settings || DEFAULT_SETTINGS
  const now = Date.now()
  return list.filter((it) => it.kind === 'note' ? false : (!it.mastered || (s.srsEnabled && it.reviewAt <= now)))
}

/**
 * 班级笔记 / 知识点 → 错题学习条目（kind='note'）。
 * 不带图片：错题本走 localStorage + 云同步（blob 上限 400KB），图片原件留在班级笔记里。
 */
export function makeNoteItem({ title, content, knowledgePoints, source } = {}) {
  return {
    id: nextId(),
    kind: 'note',
    title: (title || '未命名笔记').slice(0, 120),
    content: content || '',
    question: (content || '').slice(0, 120) || (title || '未命名笔记'), // 兼容旧渲染字段的摘要
    subject: '未分类',
    knowledgePoints: Array.isArray(knowledgePoints) ? knowledgePoints : [],
    source: source || '班级笔记',
    // 学情字段置零：笔记不参与自测 / 复习 / 掌握率
    streak: 0,
    quizCount: 0,
    correctCount: 0,
    mastered: false,
    reviewAt: 0,
    interval: 1,
    repetitions: 0,
    courseId: '',
    createdAt: new Date().toISOString(),
  }
}

/**
 * 勾选的 id 与复习池对齐：丢掉已不在池中的（例如答对 2 次后被标记掌握）。
 * 否则这些「幽灵勾选」会让组卷结果为空，答题页拿不到题目而渲染失败。
 */
export function pruneCheckedIds(list, checkedIds) {
  const ids = new Set((list || []).map((it) => it.id))
  return (checkedIds || []).filter((id) => ids.has(id))
}

/** 按勾选的 id 从复习池组卷（保持池内顺序，调用方自行打乱）。 */
export function pickQuizItems(list, checkedIds) {
  const wanted = new Set(checkedIds || [])
  return (list || []).filter((it) => wanted.has(it.id))
}

/** 一次作答后更新学情（返回新条目）。 */
export function applyAnswer(item, ok, settings) {
  const it = { ...item }
  it.quizCount = (it.quizCount || 0) + 1
  const s = settings || DEFAULT_SETTINGS
  if (ok) {
    it.correctCount = (it.correctCount || 0) + 1
    it.streak = (it.streak || 0) + 1
    it.repetitions = (it.repetitions || 0) + 1
    if (it.streak >= 2) it.mastered = true
    it.interval = nextInterval(it.repetitions, s)
    it.reviewAt = s.srsEnabled ? Date.now() + it.interval * DAY : 0
  } else {
    it.streak = 0
    it.repetitions = 0
    it.interval = 1
    it.mastered = false // 答错降级，回炉复习
    it.reviewAt = Date.now()
  }
  return it
}

/**
 * 薄弱点分析：按知识点聚合，返回按错误率排序的列表。
 */
export function analyzeWeakPoints(list) {
  const map = {}
  for (const it of list) {
    if (it.kind === 'note') continue
    const kps = Array.isArray(it.knowledgePoints) ? it.knowledgePoints : []
    for (const k of kps) {
      const name = (k || '').trim()
      if (!name) continue
      if (!map[name]) map[name] = { name, total: 0, quiz: 0, correct: 0, mastered: 0 }
      const e = map[name]
      e.total++
      e.quiz += it.quizCount || 0
      e.correct += it.correctCount || 0
      if (it.mastered) e.mastered++
    }
  }
  return Object.values(map)
    .map((e) => {
      const errorRate = e.quiz > 0 ? (e.quiz - e.correct) / e.quiz : (e.mastered < e.total ? 1 : 0)
      return { name: e.name, total: e.total, quiz: e.quiz, correct: e.correct, mastered: e.mastered, errorRate }
    })
    .sort((a, b) => b.errorRate - a.errorRate || b.total - a.total)
}

/**
 * 学习概览：总错题 / 已掌握 / 练习与正确次数 / 正确率 / 本周新增。
 */
export function getOverview(list) {
  const qs = (list || []).filter((i) => i.kind !== 'note')
  const total = qs.length
  const mastered = qs.filter((i) => i.mastered).length
  const quiz = qs.reduce((s, i) => s + (i.quizCount || 0), 0)
  const correct = qs.reduce((s, i) => s + (i.correctCount || 0), 0)
  const accuracy = quiz > 0 ? Math.round((correct / quiz) * 100) : 0
  const now = new Date()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const weekNew = qs.filter((i) => {
    const d = new Date(i.createdAt)
    return !isNaN(d) && d >= weekStart
  }).length
  return { total, mastered, quiz, correct, accuracy, weekNew }
}

/**
 * 知识点掌握度（用于雷达图）：每个知识点的答对率，按练习次数排序。
 */
export function getMasteryByPoint(list) {
  const map = {}
  for (const it of list) {
    if (it.kind === 'note') continue
    const kps = Array.isArray(it.knowledgePoints) ? it.knowledgePoints : []
    for (const k of kps) {
      const name = (k || '').trim()
      if (!name) continue
      if (!map[name]) map[name] = { name, quiz: 0, correct: 0 }
      map[name].quiz += it.quizCount || 0
      map[name].correct += it.correctCount || 0
    }
  }
  return Object.values(map)
    .map((e) => ({
      name: e.name,
      mastery: e.quiz > 0 ? Math.round((e.correct / e.quiz) * 100) : 0,
      quiz: e.quiz,
    }))
    .sort((a, b) => b.quiz - a.quiz)
}

/**
 * 近 N 天每日新增错题趋势（基于 createdAt）。
 */
export function getDailyTrend(list, days = 14) {
  const counts = {}
  for (const it of list) {
    const d = new Date(it.createdAt)
    if (isNaN(d)) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    counts[key] = (counts[key] || 0) + 1
  }
  const now = new Date()
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: counts[key] || 0 })
  }
  return out
}

/**
 * 把整段转写文本拆成多道题。
 * 识别形如 "1." "2、" "（3）" "③" "(4)" 的行首题号作为新题起点。
 *
 * 关键：区分「主题干 + 小题」与「独立多题」——
 * - 若第一个题号行之前有非空文字（主题干/引导语），说明是一道大题套小题，
 *   整段合成一道题返回（不拆，保证信息完整）。
 * - 若文本开头就是题号（无主题干），按题号拆成多道独立题。
 * - 完全无题号则返回原文本作为单题。
 */
const Q_HEAD_RE = /^\s*(?:\d{1,2}\s*[.、．:：)）]|[（(]\s*\d{1,2}\s*[）)]|[①②③④⑤⑥⑦⑧⑨⑩])/

// 试卷版式/说明类行：整页试卷识别时模型会把页头、考生须知、大题引导语一并转出来，
// 这些行明显不是题目，在拆题前确定性剔除（不靠模型判断，模型判断既慢又丢题干）。
const EXAM_PREAMBLE_RE =
  /^(?:绝密|试卷类型|注意事项|考生须知|答题说明|答卷前|答题前|考试结束后|考试开始时|密封线|装订线|普通高等学校|高等学校|全国.{0,12}考试|满分|考试时间|答卷时间|考试用时|本卷共|共\s*\d+\s*题|姓名|考生号|准考证号|座位号|学号|班级|第\s*[一二三四五六七八九十IVX0-9]+\s*卷)/
// 「一、选择题：本题共10小题…」「二、填空题…」等大题引导语（中文序号，不被 Q_HEAD_RE 命中）
const SECTION_HEAD_RE = /^[一二三四五六七八九十]+\s*[、．.]\s*(?:选择题|填空题|解答题|计算题|判断题|证明题|简答题|名词解释|综合题|应用题|多项选择题|主观题|客观题)/
// 注意事项里的编号条目（「1. 答卷前…」「2. 回答选择题…」），长得像题号但不是题
const NOTE_ITEM_RE =
  /^\s*\d{1,2}\s*[.、．:：)）]\s*(?:答卷前|回答选择题|回答非选择题|考试结束后|考生|答题|请在|书写|填涂|用铅笔|用橡皮|保持|如需|不得|必须|注意|将本|将答案|选出|再选|答在|写在|本卷|本试卷|答题卡|试卷指定|监考|密封|卷面|条形码)/

/**
 * 剥掉试卷页头/版式引导语：返回从第一道「真正的题号行」开始的内容。
 * 仅当前导块里出现过强标志（绝密/试卷类型/注意事项/密封线/一、选择题…）时才剥，
 * 否则视为「主题干 + 小题」或普通单题，原样保留，避免误删真实题干。
 */
function stripPagePreamble(text) {
  const lines = text.split(/\r?\n/)
  let firstQ = -1
  for (let i = 0; i < lines.length; i++) {
    if (NOTE_ITEM_RE.test(lines[i])) continue // 注意事项条目不是题号
    if (Q_HEAD_RE.test(lines[i])) {
      firstQ = i
      break
    }
  }
  if (firstQ <= 0) return text // 没有题号，或第一行就是题号，无需剥
  const preamble = lines.slice(0, firstQ)
  const hasStrongHeader = preamble.some((l) => EXAM_PREAMBLE_RE.test(l) || SECTION_HEAD_RE.test(l))
  if (!hasStrongHeader) return text
  return lines.slice(firstQ).join('\n')
}

export function splitQuestions(text) {
  const raw = stripPagePreamble((text || '').trim())
  if (!raw) return []
  const lines = raw.split(/\r?\n/)
  const segments = []
  let cur = []
  let firstHeadSeen = false

  for (const line of lines) {
    if (Q_HEAD_RE.test(line)) {
      if (!firstHeadSeen) {
        // 第一个题号行：它之前的累积文字就是「主题干」
        const prefix = cur.join('\n').trim()
        if (prefix) {
          // 有主题干 → 是一道大题套小题，整体返回，不拆
          return [raw]
        }
        firstHeadSeen = true
        cur = [line]
      } else if (cur.length) {
        segments.push(cur.join('\n').trim())
        cur = [line]
      } else {
        cur = [line]
      }
    } else {
      cur.push(line)
    }
  }
  const last = cur.join('\n').trim()
  if (last) segments.push(last)

  if (!firstHeadSeen) return [raw] // 完全无题号 → 单题
  const cleaned = segments.filter((s) => s)
  return cleaned.length ? cleaned : [raw]
}

/** 手动拆分：按空行分隔成多题（用户在编辑框里用空行分隔）。 */
export function splitByBlank(text) {
  const parts = (text || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : [(text || '').trim()]
}
