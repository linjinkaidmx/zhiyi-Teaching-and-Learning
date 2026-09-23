/**
 * 相似题 / 变式题生成（Mock）
 * ---------------------------------------------------------------------------
 * 后端尚未实现「完整相似题/变式题生成」，这里用规则模板生成演示数据。
 * 后端就绪后删除本文件，改由 adapter 调真实接口（config.MOCK.similarQuestions）。
 * UI 不直接依赖本文件（经 ExplainPage 调用，后续可换成 adapter）。
 */
import { MOCK } from '../../config/app.js'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/** 从题干里抽出主语/关键词，做一个可读的模板替换 */
function template(question, kind) {
  const q = String(question || '').replace(/\s+/g, ' ').trim()
  const brief = q.length > 24 ? q.slice(0, 24) + '…' : q
  if (kind === 'similar') {
    return [
      `（同类）${brief}，若把其中一个关键条件改为「加倍/减半」后，结果会如何变化？`,
      `（同类）${brief}，请尝试用另一种方法验证上一题的结论。`,
    ]
  }
  return [
    `（变式）在「${brief}」的基础上，追加一个额外约束条件后再求解。`,
    `（变式）把「${brief}」中的数字替换成字母参数，推导一般形式的解。`,
  ]
}

export function generateVariants(question, kind) {
  if (!MOCK.similarQuestions) {
    return []
  }
  return template(question, kind)
}

/** 异步版（预留：未来接真实接口时签名不变，返回 Promise） */
export async function generateVariantsAsync(question, kind) {
  await delay(300)
  return generateVariants(question, kind)
}
