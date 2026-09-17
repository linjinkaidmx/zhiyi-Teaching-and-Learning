/**
 * 练习本本地存储（localStorage）
 *
 * 说明：
 * 1. 图片体积大且 localStorage 有 5MB 限制，因此只存文字信息，不存图片。
 * 2. 每条记录用 source 区分来源：
 *      diagnose  拍错题后由错因诊断加入（带错因、错误步骤）
 *      solve     拍题后由题目解答加入（没错因，作为练习收藏）
 *      bank      同类题推荐里主动加入（没错因）
 *    老版本数据没有 source 字段，读取时统一按 diagnose 兼容，保证旧记录不炸。
 */
const KEY = 'zhiyi_error_book'
const DAY = 24 * 3600 * 1000

/** 连续答对多少次自动判定为已掌握 */
const MASTER_STREAK = 2

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

/**
 * 把任意来源的记录补齐成标准结构
 * @param {object} it 原始记录
 */
function normalize(it) {
  return {
    ...it,
    source: it.source || 'diagnose',
    quizCount: it.quizCount || 0,
    correctCount: it.correctCount || 0,
    streak: it.streak || 0,
    lastQuizAt: it.lastQuizAt ?? null,
    lastQuizCorrect: it.lastQuizCorrect ?? null,
    userNote: it.userNote || '',
    knowledge_points: it.knowledge_points || [],
    solution_steps: it.solution_steps || [],
    related_points: it.related_points || [],
  }
}

export function getBook() {
  return readAll().map(normalize)
}

/** 是否有错因（用于列表标签区分） */
export function hasErrorType(item) {
  return !!(item && item.error_type)
}

/**
 * 加入一条记录
 * @param {object} record 诊断结果 / 题库题
 * @param {object} patch  可选，弹窗里用户编辑后的覆盖值
 */
export function addRecord(record, patch = {}) {
  const list = readAll()
  const src = record || {}
  // 题库题自带数字 id，沿用它可以让「加入练习本」按钮正确识别重复；
  // AI 识别出来的题没有 id，此时新生成一个。
  const id = src.id ? String(src.id) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const item = normalize({
    id,
    createdAt: Date.now(),
    subject: src.subject || '',
    knowledge_points: src.knowledge_points || [],
    question: src.question || '',
    student_answer: src.student_answer || '',
    correct_answer: src.correct_answer || '',
    error_step: src.error_step || 0,
    error_type: src.error_type || '',
    error_analysis: src.error_analysis || '',
    solution_steps: src.solution_steps || [],
    key_insight: src.key_insight || '',
    knowledge_explanation: src.knowledge_explanation || '',
    related_points: src.related_points || [],
    source: src.source || 'diagnose',
    status: '未掌握',
    reviewCount: 0,
    lastReviewAt: null,
    quizCount: 0,
    correctCount: 0,
    streak: 0,
    lastQuizAt: null,
    lastQuizCorrect: null,
    userNote: '',
    ...patch,
  })
  // 同一道题重复加入时刷新为最新内容，而不是塞第二条重复记录
  const dup = list.findIndex((x) => String(x.id) === id)
  if (dup >= 0) list[dup] = item
  else list.unshift(item)
  writeAll(list)
  return item
}

/** 通用局部更新 */
export function updateRecord(id, patch) {
  const list = readAll()
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) {
    list[i] = { ...list[i], ...patch }
    writeAll(list)
  }
  return getBook()
}

export function updateStatus(id, status) {
  const list = readAll()
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) {
    list[i].status = status
    list[i].reviewCount = (list[i].reviewCount || 0) + 1
    list[i].lastReviewAt = Date.now()
    writeAll(list)
  }
  return getBook()
}

export function removeRecord(id) {
  writeAll(readAll().filter((x) => x.id !== id))
  return getBook()
}

export function clearBook() {
  writeAll([])
  return []
}

/** 统计概览 */
export function getStats() {
  const list = getBook()
  const now = Date.now()
  return {
    total: list.length,
    pending: list.filter((x) => x.status !== '已掌握').length,
    mastered: list.filter((x) => x.status === '已掌握').length,
    weekNew: list.filter((x) => now - (x.createdAt || now) <= 7 * DAY).length,
    quizTotal: list.reduce((s, x) => s + (x.quizCount || 0), 0),
    quizCorrect: list.reduce((s, x) => s + (x.correctCount || 0), 0),
  }
}

/**
 * 按知识点聚合掌握度（用于雷达图）
 * 返回 [{ name, total, mastered, rate }]
 */
export function getKnowledgeStats() {
  const list = getBook()
  const map = new Map()
  list.forEach((item) => {
    ;(item.knowledge_points || []).forEach((k) => {
      if (!map.has(k)) map.set(k, { name: k, total: 0, mastered: 0 })
      const v = map.get(k)
      v.total += 1
      if (item.status === '已掌握') v.mastered += 1
    })
  })
  return Array.from(map.values())
    .map((v) => ({ ...v, rate: Math.round((v.mastered / v.total) * 100) }))
    .sort((a, b) => b.total - a.total || a.rate - b.rate)
    .slice(0, 6)
}

/* ------------------------------------------------------------------ */
/* 自测                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 组卷：优先抽「从未测过」>「上次答错」>「最久没测」
 * @param {object} opt
 * @param {number|string} opt.limit  5 / 10 / 'all'
 * @param {boolean} opt.includeMastered 是否把已掌握的题也纳入
 */
export function getQuizList({ limit = 5, includeMastered = false } = {}) {
  let pool = getBook().filter((x) => (x.question || '').trim())
  if (!includeMastered) pool = pool.filter((x) => x.status !== '已掌握')

  const scored = pool.map((x) => {
    let tier = 2
    if (!x.lastQuizAt) tier = 0
    else if (x.lastQuizCorrect === false) tier = 1
    return { x, tier, t: x.lastQuizAt || 0 }
  })
  scored.sort((a, b) => a.tier - b.tier || a.t - b.t)

  const items = scored.map((o) => o.x)
  return limit === 'all' || limit >= items.length ? items : items.slice(0, limit)
}

/**
 * 提交一道自测的结果
 * 答对累计 streak，连续命中 MASTER_STREAK 次自动标记已掌握；答错 streak 归零并退回未掌握。
 * @param {string} id
 * @param {boolean} ok
 * @returns {object|null} 更新后的记录
 */
export function submitQuizResult(id, ok) {
  const list = readAll()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return null
  const it = list[i]

  it.quizCount = (it.quizCount || 0) + 1
  it.lastQuizAt = Date.now()
  it.lastQuizCorrect = !!ok

  if (ok) {
    it.correctCount = (it.correctCount || 0) + 1
    it.streak = (it.streak || 0) + 1
    it.status = it.streak >= MASTER_STREAK ? '已掌握' : '复习中'
  } else {
    it.streak = 0
    it.status = '未掌握'
  }

  writeAll(list)
  return normalize(it)
}

/** 自测总体正确率 */
export function getQuizAccuracy() {
  const s = getStats()
  return s.quizTotal ? Math.round((s.quizCorrect / s.quizTotal) * 100) : 0
}
