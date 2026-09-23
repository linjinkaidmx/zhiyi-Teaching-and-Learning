/**
 * 变式题 / 相似题 · adapter（批次2）
 * ---------------------------------------------------------------------------
 * UI 只调这里：
 *   - MOCK.similarQuestions = true  → 用 lib/mock/variants.js 的本地演示数据（无后端时）
 *   - MOCK.similarQuestions = false → 走真实 /api/variant（后端已实现）
 * 返回统一形态：[{ question, answer, analysis, knowledgePoints, questionType, strategy }]
 */
import { MOCK } from '../../config/app.js'
import { api } from '../../api'
import { generateVariants } from '../mock/variants.js'

/** 讲解页的 kind → 后端策略 */
const KIND_TO_STRATEGY = {
  similar: 'same_point',    // 相似题：同知识点
  variant: 'change_data',   // 变式题：换数据
  angle: 'change_angle',
  type: 'change_type',
}

/**
 * 生成变式题
 * @param {{question:string, answer?:string, subject?:string}} src 原题
 * @param {string} kind similar | variant | angle | type
 * @param {number} count 需要几道（上限 3）
 */
export async function makeVariants(src, kind = 'similar', count = 1) {
  if (MOCK.similarQuestions) {
    const texts = generateVariants(src.question, kind === 'similar' ? 'similar' : 'variant')
    return texts.slice(0, count).map((text) => ({
      question: text,
      answer: src.answer || '',
      analysis: '',
      knowledgePoints: [],
      questionType: '',
      strategy: KIND_TO_STRATEGY[kind] || 'same_point',
      demo: true, // 演示数据标记，UI 可据此提示
    }))
  }
  const d = await api.variant({
    question: src.question,
    answer: src.answer || '',
    subject: src.subject || '',
    strategy: KIND_TO_STRATEGY[kind] || 'same_point',
    count: Math.max(1, Math.min(count, 3)),
  })
  if (!d.ok) throw new Error(d.error || '生成失败')
  return (d.items || []).map((it) => ({
    question: it.question,
    answer: it.answer || '',
    analysis: it.analysis || '',
    knowledgePoints: it.knowledge_points || [],
    questionType: it.question_type || '',
    strategy: it.strategy || 'same_point',
    cached: !!d.cached,
  }))
}
