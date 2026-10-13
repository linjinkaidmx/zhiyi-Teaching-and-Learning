import { QUESTION_BANK, DIFFICULTY_ORDER } from '../data/questionBank'
import { bestMatch } from './knowledgeAliases'

/**
 * 同类题推荐 · 四档模糊匹配版
 *
 * 旧版问题：知识点必须字符串精确相等才给分。AI 输出「特征方程与特征根」、
 * 题库写「特征方程法」时直接漏匹配，冷门学科甚至落到空态。
 *
 * 新版打分（知识点主维度）：
 *   精确相等 10 / 别名等价 8 / 双向包含 5，取该题与 AI 全部知识点的最高档
 *   —— 不再按命中个数累加，避免「沾边多次的宽泛题」压过「精准一道题」
 * 错因维度 +4，学科维度 +2（保留原有双维度设计）
 */
export function recommendSimilar(result, limit = 4) {
  if (!result) return []

  const aiKps = result.knowledge_points || []
  const errorType = result.error_type

  const scored = QUESTION_BANK.map((q) => {
    let score = 0

    for (const kp of aiKps) {
      const s = bestMatch(kp, q.knowledge_points || [])
      if (s > score) score = s
    }

    if (errorType && (q.target_errors || []).includes(errorType)) {
      score += 4
    }
    if (q.subject && result.subject && q.subject === result.subject) {
      score += 2
    }

    return { question: q, score }
  })
    .filter((x) => x.score >= 5) // 至少包含匹配，纯靠学科+错因凑分的不要
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (
        (DIFFICULTY_ORDER[a.question.difficulty] || 9) -
        (DIFFICULTY_ORDER[b.question.difficulty] || 9)
      )
    })

  return scored.slice(0, limit).map((x) => x.question)
}

/** 兜底：同学科里挑难度最低的题，保证推荐永不为空 */
export function fallbackQuestions(subject, limit = 3) {
  const same = QUESTION_BANK.filter((q) => q.subject === subject)
  const pool = same.length
    ? same
    : QUESTION_BANK.slice() // 学科都对不上时，宁给别的学科也不给空
  return pool
    .sort(
      (a, b) =>
        (DIFFICULTY_ORDER[a.difficulty] || 9) - (DIFFICULTY_ORDER[b.difficulty] || 9)
    )
    .slice(0, limit)
}
