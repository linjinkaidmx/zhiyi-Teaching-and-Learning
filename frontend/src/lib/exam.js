/**
 * 模拟考试 · 纯逻辑（脱离浏览器与模型，Node 可直接测）
 * ---------------------------------------------------------------------------
 * 负责四件事：
 *   1. 组卷配置：模式 → 题型配比与分值（把 100 分精确分完）
 *   2. 本地判分：选择题按标准答案直接判（不花额度）
 *   3. 成绩合并：本地选择题得分 + AI 主观题得分 → 完整成绩对象
 *   4. 历史统计：平均分 / 最高分 / 趋势
 */

export const PAPER_TOTAL = 100
export const MAX_PAPER_QUESTIONS = 25

/** 三种模式的预设配比（每题分值精调过，总和恰好 100） */
export const PAPER_MODES = {
  full: {
    key: 'full',
    label: '完整卷',
    desc: '选择 + 填空 + 解答，最接近真实考试',
    plan: [
      { type: 'choice', count: 6, score: 5 },
      { type: 'blank', count: 4, score: 8 },
      { type: 'solution', count: 2, score: 19 },
    ],
  },
  choice: {
    key: 'choice',
    label: '仅选择题',
    desc: '20 道选择题，适合快速刷概念',
    plan: [{ type: 'choice', count: 20, score: 5 }],
  },
  blank: {
    key: 'blank',
    label: '仅填空题',
    desc: '10 道填空题，练计算与结论',
    plan: [{ type: 'blank', count: 10, score: 10 }],
  },
}

export const TYPE_LABEL = { choice: '选择题', blank: '填空题', solution: '解答题' }

/** 各题型相对难度权重（自定义题量时按此把 100 分分摊到各题型） */
const TYPE_WEIGHT = { choice: 1, blank: 1.6, solution: 3.8 }

/**
 * 按题型配比把 100 分精确分完。
 * 规则：先按权重分给每个题型总分（整数），再在题型内均摊；除不尽的余数加在该题型第一题上。
 * 返回 [{type, count, score, extras:[每题实际分值]}]，所有 extras 之和 = 100。
 */
export function distributeScores(plan, total = PAPER_TOTAL) {
  const items = (Array.isArray(plan) ? plan : [])
    .filter((p) => p && p.count > 0 && TYPE_WEIGHT[p.type])
    .map((p) => ({ type: p.type, count: Math.floor(p.count) }))
  if (!items.length) return []
  const totalWeight = items.reduce((s, p) => s + p.count * TYPE_WEIGHT[p.type], 0)
  const out = []
  let used = 0
  items.forEach((p, i) => {
    let share
    if (i === items.length - 1) {
      share = total - used
    } else {
      share = Math.round(((p.count * TYPE_WEIGHT[p.type]) / totalWeight) * total)
      // 保证后面题型至少还能分到「每题 1 分」
      const restMin = items.slice(i + 1).reduce((s, x) => s + x.count, 0)
      const maxShare = total - used - restMin
      share = Math.max(p.count, Math.min(share, maxShare))
    }
    used += share
    const base = Math.max(1, Math.floor(share / p.count))
    const remainder = share - base * p.count // 余数给第一题，保证精确
    const extras = []
    for (let k = 0; k < p.count; k += 1) extras.push(k === 0 ? base + remainder : base)
    out.push({ type: p.type, count: p.count, score: base, extras })
  })
  return out
}

/**
 * 搜索「同题型每题分值相同」的整数解，使各题型分值合计恰好等于 total。
 * 目标：各题型总分占比尽量贴近难度权重，且难度高的题型每题分值不低于难度低的。
 * 例：5 选择 + 3 填空 → 5×11 + 3×15 = 100（而不是「首题多一分」的 11/10/10）
 * 找不到整齐解时返回 null，由调用方回退到 distributeScores。
 */
export function solveTidyScores(plan, total = PAPER_TOTAL) {
  const items = (Array.isArray(plan) ? plan : [])
    .filter((p) => p && p.count > 0 && TYPE_WEIGHT[p.type])
    .map((p) => ({ type: p.type, count: Math.floor(p.count) }))
  if (!items.length) return null
  if (items.length === 1) {
    const [it] = items
    if (total % it.count !== 0) return null
    const s = total / it.count
    return [{ type: it.type, count: it.count, score: s, extras: Array.from({ length: it.count }, () => s) }]
  }
  const idealSum = items.reduce((s, p) => s + p.count * TYPE_WEIGHT[p.type], 0)
  let best = null
  let bestErr = Infinity
  const scores = []
  const rec = (i, remain) => {
    if (i === items.length) {
      if (remain !== 0) return
      for (let k = 1; k < scores.length; k += 1) {
        if (scores[k] < scores[k - 1]) return // 难度高的题型每题分值不低于低的
      }
      const err = items.reduce((s, p, k) => {
        const actual = (p.count * scores[k]) / total
        const ideal = (p.count * TYPE_WEIGHT[p.type]) / idealSum
        return s + Math.abs(actual - ideal)
      }, 0)
      if (err < bestErr) {
        bestErr = err
        best = scores.slice()
      }
      return
    }
    const p = items[i]
    const restCount = items.slice(i + 1).reduce((s, x) => s + x.count, 0)
    const maxScore = Math.floor((remain - restCount) / p.count) // 余下题型每题至少 1 分
    for (let sc = 1; sc <= maxScore; sc += 1) {
      scores.push(sc)
      rec(i + 1, remain - sc * p.count)
      scores.pop()
    }
  }
  rec(0, total)
  if (!best) return null
  return items.map((p, k) => ({
    type: p.type,
    count: p.count,
    score: best[k],
    extras: Array.from({ length: p.count }, () => best[k]),
  }))
}

/** 组卷请求体：模式（或自定义每题数量）→ 后端可用的 plan */
export function buildPlan(mode, custom = null) {
  if (mode === 'custom' && custom) {
    const raw = Object.entries(custom)
      .map(([type, count]) => ({ type, count: Math.floor(Number(count) || 0) }))
      .filter((p) => p.count > 0 && TYPE_WEIGHT[p.type])
    if (!raw.length) return []
    const tidy = solveTidyScores(raw)
    if (tidy) return tidy
    return distributeScores(raw).map((p) => ({ type: p.type, count: p.count, score: p.score, extras: p.extras }))
  }
  const preset = PAPER_MODES[mode] || PAPER_MODES.full
  return preset.plan.map((p) => ({
    ...p,
    extras: Array.from({ length: p.count }, () => p.score),
  }))
}

/**
 * 按用户显式指定的「题量 + 每题分值」构造 plan（分值可手改）。
 * rows: [{ type, count, score }]，count <= 0 的题型自动略过。
 */
export function buildCustomPlan(rows) {
  const out = []
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !TYPE_WEIGHT[r.type]) continue
    const count = Math.floor(Number(r.count) || 0)
    if (count <= 0) continue
    const score = Math.max(0, Math.round(Number(r.score) || 0))
    out.push({ type: r.type, count, score, extras: Array.from({ length: count }, () => score) })
  }
  return out
}

/** 一组自定义行的合计（题数与总分），用于实时校验 */
export function customSummary(rows) {
  let total = 0
  let score = 0
  for (const r of Array.isArray(rows) ? rows : []) {
    const count = Math.max(0, Math.floor(Number(r && r.count) || 0))
    const each = Math.max(0, Math.round(Number(r && r.score) || 0))
    total += count
    score += count * each
  }
  return { total, score }
}

/** 组卷前校验（题量上限、总分） */
export function validatePlan(plan) {
  const total = (plan || []).reduce((s, p) => s + (p.count || 0), 0)
  if (!total) return { ok: false, error: '请至少选择一种题型' }
  if (total > MAX_PAPER_QUESTIONS) return { ok: false, error: `一次最多 ${MAX_PAPER_QUESTIONS} 题` }
  const score = (plan || []).reduce((s, p) => s + (p.extras || []).reduce((a, b) => a + b, 0), 0)
  if (score !== PAPER_TOTAL) return { ok: false, error: `分值合计需为 ${PAPER_TOTAL} 分（当前 ${score}）` }
  return { ok: true, total, score }
}

/** 把后端返回的题目按 plan 的每题分值补齐（前端再兜一层，保证显示与判分一致） */
export function applyScores(questions, plan) {
  const flat = []
  ;(plan || []).forEach((p) => {
    const extras = p.extras && p.extras.length === p.count
      ? p.extras
      : Array.from({ length: p.count }, () => p.score)
    extras.forEach((sc) => flat.push({ type: p.type, score: sc }))
  })
  return (Array.isArray(questions) ? questions : []).map((q, i) => ({
    ...q,
    score: flat[i] ? flat[i].score : (q.score || 0),
  }))
}

/** 选择题本地判分：返回 { graded: [...] , pending: [...] }（pending = 需要 AI 判的主观题） */
export function splitForGrading(questions, answers) {
  const graded = []
  const pending = []
  ;(Array.isArray(questions) ? questions : []).forEach((q) => {
    const ua = String((answers || {})[q.id] ?? '').trim()
    if (q.type === 'choice') {
      const right = String(q.answer || '').trim().toUpperCase().slice(0, 1)
      const picked = ua.toUpperCase().slice(0, 1)
      const correct = !!picked && picked === right
      graded.push({ id: q.id, got: correct ? q.score : 0, full: q.score, correct })
    } else {
      pending.push({
        id: q.id,
        question: q.question,
        reference: q.answer,
        user_answer: ua,
        score: q.score,
      })
    }
  })
  return { graded, pending }
}

/**
 * 合并成绩：本地选择题结果 + AI 主观题结果 → 完整成绩对象
 * judgeResults: [{id, got, comment}]（可能缺项，缺项按 0 分并标注未判）
 */
export function combineGrade(questions, answers, localGraded, judgeResults) {
  const byId = new Map()
  ;(localGraded || []).forEach((g) => byId.set(String(g.id), { ...g, comment: '' }))
  ;(judgeResults || []).forEach((r) => {
    const key = String(r.id)
    const prev = byId.get(key) || {}
    byId.set(key, {
      id: r.id,
      got: Number(r.got) || 0,
      full: prev.full || 0,
      comment: r.comment || '',
      correct: Number(r.got) >= (prev.full || 0) * 0.999,
    })
  })
  const perQuestion = (Array.isArray(questions) ? questions : []).map((q) => {
    const g = byId.get(String(q.id)) || {}
    const full = q.score || 0
    const got = Math.max(0, Math.min(full, Number(g.got) || 0))
    return {
      id: q.id,
      type: q.type,
      full,
      got,
      correct: got >= full * 0.999,
      partial: got > 0 && got < full * 0.999,
      comment: g.comment || '',
      userAnswer: String((answers || {})[q.id] ?? ''),
    }
  })
  const total = Math.round(perQuestion.reduce((s, x) => s + x.got, 0) * 10) / 10
  const fullScore = perQuestion.reduce((s, x) => s + x.full, 0)
  const byType = {}
  perQuestion.forEach((x) => {
    byType[x.type] = byType[x.type] || { full: 0, got: 0, count: 0 }
    byType[x.type].full += x.full
    byType[x.type].got += x.got
    byType[x.type].count += 1
  })
  return {
    total,
    fullScore,
    rate: fullScore ? Math.round((total / fullScore) * 1000) / 10 : 0,
    correctCount: perQuestion.filter((x) => x.correct).length,
    wrongCount: perQuestion.filter((x) => !x.correct).length,
    perQuestion,
    byType,
  }
}

/** 用时格式化：秒 → "12 分 30 秒" / "1 时 05 分" */
export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分 ${String(s % 60).padStart(2, '0')} 秒`
  return `${Math.floor(m / 60)} 时 ${String(m % 60).padStart(2, '0')} 分`
}

/** 限时剩余秒数（未限时返回 null；已超时返回 0） */
export function remainingSeconds(startedAt, limitMin, now = Date.now()) {
  const limit = Number(limitMin) || 0
  if (limit <= 0 || !startedAt) return null
  const left = Math.floor((Number(startedAt) + limit * 60000 - Number(now)) / 1000)
  return Math.max(0, left)
}

/** 历史成绩统计：张数 / 平均分 / 最高分 / 最近一次 */
export function historyStats(papers) {
  const done = (Array.isArray(papers) ? papers : [])
    .filter((p) => p && p.graded && typeof p.graded.total === 'number')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  if (!done.length) return { count: 0, avg: 0, best: 0, latest: null, list: [] }
  const totals = done.map((p) => p.graded.total)
  const avg = Math.round((totals.reduce((s, x) => s + x, 0) / totals.length) * 10) / 10
  return {
    count: done.length,
    avg,
    best: Math.max(...totals),
    latest: done[0],
    list: done,
  }
}

/** 错题转换为错题本条目的候选（由页面决定是否纳入） */
export function wrongToBookCandidates(paper, grade) {
  if (!paper || !grade) return []
  const byId = new Map((paper.questions || []).map((q) => [String(q.id), q]))
  return grade.perQuestion
    .filter((x) => !x.correct)
    .map((x) => {
      const q = byId.get(String(x.id)) || {}
      return {
        id: `${paper.id}-${x.id}`,
        question: q.question || '',
        answer: q.answer || '',
        explanation: q.explanation || '',
        knowledgePoints: q.knowledgePoints || [],
        subject: paper.subject || '',
        score: `${x.got}/${x.full}`,
      }
    })
    .filter((c) => c.question)
}
