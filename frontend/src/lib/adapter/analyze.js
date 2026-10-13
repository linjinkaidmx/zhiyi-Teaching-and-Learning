/**
 * AI 学情建议 · adapter（批次4）
 * ---------------------------------------------------------------------------
 * MOCK.analysis = true  → 用 lib/mock/analyze.js 的演示内容
 * MOCK.analysis = false → 走真实 /api/analyze/errorbook（服务端 24h 缓存）
 */
import { MOCK } from '../../config/app.js'
import { api } from '../../api'
import { analyzeMock } from '../mock/analyze.js'

/**
 * 生成学情建议（只在用户点击时调用，避免静默计费）
 * @param {{summary:object, samples:string[]}} payload
 */
export async function analyzeStudy(payload) {
  const summary = payload.summary || {}
  if (MOCK.analysis) {
    const demo = await analyzeMock(summary)
    return { ...demo, cached: false }
  }
  const r = await api.analyze({ summary, sample_questions: payload.samples || [] })
  if (!r.ok) throw new Error(r.error || '分析失败')
  return { ...(r.data || {}), cached: !!r.cached }
}
