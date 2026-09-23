/**
 * 知识点快捷提问（纯逻辑，脱离浏览器可单测）
 * ---------------------------------------------------------------------------
 * 首页点「推荐知识点」→ 跳 AI 对话并带上候选问题：
 *   1. 先用模板秒出 4 条（零成本、零等待，可离线测试）
 *   2. 同时后台让模型拟 4 条更贴合的，回来后替换（见 lib/kpQuestionsAi.js，带 7 天缓存）
 *   3. 该知识点若确有错题，额外补 1 条「错因诊断」，并把那道错题作为引用带进对话
 *
 * 模型生成的问题可能自带 LaTeX（如 $P(A\cup B)$），在 chips 里会显示成源码，
 * 所以所有问题在进缓存/进 UI 之前，都先经过 sanitizeQuestion 转成 Unicode 纯文本。
 */
import { latexToPlain } from '../mathtext.js'

/** 模板：覆盖「是什么 → 怎么用 → 怎么解 → 错在哪 → 练一练」 */
export function templateQuestions(kp) {
  const name = String(kp || '').trim()
  if (!name) return []
  return [
    `${name}的定义是什么？`,
    `${name}在什么场景下用？给我一个具体例子`,
    `用${name}解题的标准步骤是什么？`,
    `${name}最容易错在哪？我总是做错`,
  ]
}

/** 错题诊断条：只在确实有该知识点的错题时出现 */
export function wrongQuestion(kp, wrongCount) {
  const name = String(kp || '').trim()
  const n = Number(wrongCount) || 0
  if (!name || n <= 0) return null
  return `我在${name}这类题上错了 ${n} 次，帮我分析原因`
}

/**
 * 把问题里的 LaTeX 行内公式转成 Unicode 纯文本。
 * 例：`为啥 $P(A\cup B)=P(A)+P(B)$ 会错?` → `为啥 P(A∪B)=P(A)+P(B) 会错?`
 * 兜底：转换异常时退回去掉 $ 定界符的原文，绝不把 $ 留在文本里。
 */
export function sanitizeQuestion(text) {
  const s = String(text || '')
  return s.replace(/\$([^$\n]+?)\$/g, (_, tex) => {
    const t = String(tex).trim()
    try {
      return latexToPlain(t)
    } catch {
      return t
    }
  })
}

/** 最终展示：模板 +（可选的）错题条 */
export function buildQuestions(kp, { wrongCount = 0 } = {}) {
  const list = templateQuestions(kp)
  const w = wrongQuestion(kp, wrongCount)
  if (w) list.push(w)
  return list
}

/* ---------------- 缓存（7 天，避免同一知识点重复调用模型） ---------------- */

export const CACHE_TTL = 7 * 24 * 3600 * 1000
export const CACHE_PREFIX = 'zhiyi_kpq_'

/** 模型输出里常见的客套话，不能当成问题显示 */
const NOISE_RE = /(希望|以上|以下|如下|祝你|有帮助|有什么还可以|随时|加油|共同进步)/

export function cacheKey(kp) {
  return CACHE_PREFIX + String(kp || '').trim()
}

/** 读取缓存：过期或格式不对都当作没有；读出的每条也过一遍 LaTeX 清洗（兼容旧脏缓存） */
export function readCache(kp, now = Date.now(), store) {
  const s = store || (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!s) return null
  try {
    const raw = s.getItem(cacheKey(kp))
    if (!raw) return null
    const data = JSON.parse(raw)
    const items = Array.isArray(data && data.items) ? data.items.filter((x) => typeof x === 'string' && x.trim()) : []
    if (!items.length) return null
    if (now - Number(data.at || 0) > CACHE_TTL) return null
    return items.map(sanitizeQuestion)
  } catch {
    return null
  }
}

export function writeCache(kp, items, now = Date.now(), store) {
  const s = store || (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!s || !Array.isArray(items) || !items.length) return false
  try {
    s.setItem(cacheKey(kp), JSON.stringify({ at: now, items }))
    return true
  } catch {
    return false
  }
}

/* ---------------- 解析模型返回 ---------------- */

/**
 * 把模型输出解析成 4~5 条问题。
 * 容忍各种格式：「1. xxx」「- xxx」「1）xxx」，并丢掉首尾客套话。
 */
export function parseQuestions(text, { max = 4 } = {}) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out = []
  for (const line of lines) {
    // 去掉行首序号/符号
    const cleaned = line.replace(/^(\d+[.、)）]?|[-•*·])\s*/, '').trim()
    if (!cleaned) continue
    if (cleaned.length < 4 || cleaned.length > 60) continue
    // 模型常带的客套话不当问题
    if (NOISE_RE.test(cleaned)) continue
    // LaTeX → Unicode，避免 chips 显示成源码
    const plain = sanitizeQuestion(cleaned)
    if (out.includes(plain)) continue
    out.push(plain)
    if (out.length >= max) break
  }
  return out
}

/** 生成「让模型拟问题」的提问文本 */
export function aiPromptFor(kp) {
  const name = String(kp || '').trim()
  return [
    `你是大学理工科的辅导老师。针对知识点「${name}」，列出 4 个学生最常问、也最值得问的问题。`,
    '要求：',
    '1. 只输出 4 行，每行一个问题，不要编号以外的任何说明、不要开场白和结尾总结；',
    '2. 每个问题不超过 25 个字，口语化，像学生真的会问出口的话；',
    '3. 四条要覆盖不同角度（是什么 / 怎么用 / 易错点 / 怎么练），不要重复；',
    '4. 不要出现「知识点」三个字，直接用具体名称；',
    '5. 数学式子直接用普通文字和 Unicode 符号（如 ∪、∩、≤、≥），不要用 LaTeX 语法（不要出现 $ 或反斜杠命令）。',
  ].join('\n')
}
