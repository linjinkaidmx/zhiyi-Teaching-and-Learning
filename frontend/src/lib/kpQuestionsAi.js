/**
 * 知识点问题的「AI 优化版」：先显示模板，后台再让模型拟一批替换掉。
 * ---------------------------------------------------------------------------
 * 与纯逻辑分离的原因：本文件依赖 api（浏览器），放进 kpQuestions.js 会让离线测试跑不起来。
 * 省钱设计：
 *   - 7 天本地缓存（kpQuestions.js 的 readCache/writeCache），同一知识点只花一次
 *   - 走现有 /api/chat/stream，不新增后端接口；不入库、不建会话
 *   - 失败/超时一律静默，保留模板问题，不打扰用户
 */
import { api } from '../api.js'
import { aiPromptFor, parseQuestions, readCache, writeCache, buildQuestions } from './kpQuestions.js'

/** 后台生成超时（超过就用模板，不让用户干等） */
const TIMEOUT_MS = 25000

/**
 * @param {string} kp 知识点名
 * @param {object} opts { wrongCount, signal }
 * @returns {Promise<string[]>} 解析出的问题；失败返回空数组
 */
export async function fetchBetterQuestions(kp, { signal } = {}) {
  const name = String(kp || '').trim()
  if (!name) return []
  const cached = readCache(name)
  if (cached) return cached

  let text = ''
  const timer = setTimeout(() => {}, 0)
  clearTimeout(timer)
  const ctrl = new AbortController()
  const killer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onOuterAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onOuterAbort)
  }

  try {
    await api.chatStream(
      { messages: [{ role: 'user', text: aiPromptFor(name) }], context: [] },
      { signal: ctrl.signal, onDelta: (chunk) => { text += chunk || '' } },
    )
  } catch {
    return []
  } finally {
    clearTimeout(killer)
    if (signal) signal.removeEventListener('abort', onOuterAbort)
  }

  const items = parseQuestions(text, { max: 4 })
  if (items.length >= 2) {
    writeCache(name, items)
    return items
  }
  return []
}

/**
 * 最终展示用：AI 版 4 条（有则用，无则模板 4 条）+ 错题诊断条（有则加）。
 * 错题条不参与 AI 替换 —— 它来自真实错题数据，模型不知道。
 */
export function mergeQuestions(kp, aiItems, { wrongCount = 0 } = {}) {
  const better = Array.isArray(aiItems) && aiItems.length >= 2 ? aiItems.slice(0, 4) : null
  const base = better || buildQuestions(kp, {}).slice(0, 4)
  const out = base.slice()
  const w = buildQuestions(kp, { wrongCount }).slice(4)
  if (w.length) out.push(...w)
  return out
}
