/**
 * 首页真实学情（纯逻辑，脱离浏览器可单测）
 * ---------------------------------------------------------------------------
 * 数据来源全是本地真实数据，没有任何写死的演示值：
 *   今日时长 / 完成题目  ← 学习记录 records（minutes、type）
 *   待复习 / 复习计划    ← 错题本 book + 复习设置 settings（SRS 到期）
 *   推荐知识点          ← book.analyzeWeakPoints（按知识点错误率降序）
 *   学习总结            ← 规则生成（不调用模型、不产生费用）
 */

import { analyzeWeakPoints, getOverview, quizPool } from '../book.js'

const DAY = 24 * 3600 * 1000
/** 每道复习题的估算时长（分钟），用于「今日复习」的预计时间 */
export const MINUTES_PER_REVIEW_ITEM = 2.5

export function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 今日时长（分钟，整数）：今天的学习记录 minutes 合计 */
export function todayMinutes(records, now = Date.now()) {
  const start = startOfDay(now)
  const end = start + DAY
  const total = (Array.isArray(records) ? records : []).reduce((sum, r) => {
    if (!r) return sum
    const t = Number(r.createdAt) || 0
    if (t < start || t >= end) return sum
    const m = Number(r.minutes) || 0
    return sum + (Number.isFinite(m) ? Math.max(0, Math.min(m, 120)) : 0)
  }, 0)
  return Math.round(total)
}

/** 今日完成题目数：今天「完成讲解」+「自测作答」+「练习」的记录条数 */
export function todayQuestions(records, now = Date.now()) {
  const start = startOfDay(now)
  const end = start + DAY
  return (Array.isArray(records) ? records : []).filter((r) => {
    if (!r) return false
    const t = Number(r.createdAt) || 0
    if (t < start || t >= end) return false
    return r.type === 'explain' || r.type === 'quiz' || r.type === 'practice'
  }).length
}

/** 待复习数量：复习池大小（未掌握，或已到 SRS 复习时间） */
export function pendingReviewCount(book, settings, now = Date.now()) {
  return quizPool(Array.isArray(book) ? book : [], settings).length
}

/** 权重映射：错误率 ≥50% 高、≥25% 中，其余低 */
export function weightOf(errorRate) {
  if (errorRate >= 0.5) return 'high'
  if (errorRate >= 0.25) return 'mid'
  return 'low'
}

/** 推荐知识点：薄弱点前 N，转为首页 pill 需要的形状 */
export function buildRecommendations(book, { max = 5 } = {}) {
  const weak = analyzeWeakPoints(Array.isArray(book) ? book : [])
  const items = weak.slice(0, max).map((w, i) => ({
    id: 'kp_' + i + '_' + (w.name || '').replace(/\s+/g, '_'),
    name: w.name,
    weight: weightOf(w.errorRate),
  }))
  if (!items.length) return { hint: '', basis: '', items: [] }
  return {
    hint: '建议优先复习「' + items[0].name + '」',
    basis: '根据错题的练习正确率排序',
    items,
  }
}

/** 复习计划：把复习池按知识点分组，越早到期越靠前 */
export function buildReviewPlan(book, settings, now = Date.now(), { maxGroups = 3 } = {}) {
  const pool = quizPool(Array.isArray(book) ? book : [], settings)
  if (!pool.length) return null

  const groups = new Map()
  for (const it of pool) {
    const kps = Array.isArray(it.knowledgePoints) ? it.knowledgePoints.filter(Boolean) : []
    const title = String(kps[0] || it.subject || '未分类').trim() || '未分类'
    if (!groups.has(title)) groups.set(title, [])
    groups.get(title).push(it)
  }

  const items = [...groups.entries()]
    .map(([title, list], i) => ({
      id: 'rv_' + i + '_' + title.replace(/\s+/g, '_'),
      title,
      count: list.length,
      minutes: Math.max(1, Math.round(list.length * MINUTES_PER_REVIEW_ITEM)),
      earliest: Math.min(...list.map((x) => Number(x.reviewAt) || 0)),
    }))
    .sort((a, b) => a.earliest - b.earliest || b.count - a.count)
    .slice(0, Math.maxGroups)
    .map(({ id, title, count, minutes }) => ({ id, title, count, minutes }))

  const estimateMinutes = items.reduce((s, i) => s + i.minutes, 0)
  return {
    estimateMinutes,
    note: items.length > 1 ? '按到期时间排列' : '按你的复习安排',
    items,
  }
}

/**
 * 学习总结：规则生成（不调模型、不花钱）。
 * 有错题时给「总量 + 最薄弱 + 今日待办」，没有错题时返回 null（首页按空态隐藏）。
 */
export function buildSummary({ book = [], records = [], settings, now = Date.now() } = {}) {
  const list = Array.isArray(book) ? book : []
  if (!list.length) return null

  const ov = getOverview(list)
  const weak = analyzeWeakPoints(list)
  const due = pendingReviewCount(list, settings, now)
  const parts = []

  parts.push(`错题 ${ov.total} 道，已掌握 ${ov.mastered} 道`)
  if (weak.length) parts.push(`最薄弱的是「${weak[0].name}」`)
  if (ov.quiz > 0) parts.push(`练习正确率 ${ov.accuracy}%`)
  const sentence = parts.join('，') + '。'

  let todo = ''
  if (due > 0) todo = `今天有 ${due} 道到期，先过一轮。`
  else todo = '今天没有到期复习，可以拍新题。'

  return { text: sentence + todo, updatedAt: '刚刚更新' }
}

/**
 * 首页聚合：一次算出四个区块需要的真实数据。
 * 全部为空时（新用户）返回零值/空，首页按「不展示空模块」原则自行隐藏。
 */
export function buildHomeStats({ book = [], records = [], settings, now = Date.now() } = {}) {
  const list = Array.isArray(book) ? book : []
  return {
    overview: {
      minutes: todayMinutes(records, now),
      questions: todayQuestions(records, now),
      pendingReview: pendingReviewCount(list, settings, now),
    },
    summary: buildSummary({ book: list, records, settings, now }),
    reviewPlan: buildReviewPlan(list, settings, now),
    recommendations: buildRecommendations(list),
  }
}
