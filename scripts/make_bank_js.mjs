// 把 bank_generated.json 转成前端可用的 questionBankGen.js
// 用法：node make_bank_js.mjs
import fs from 'fs'

const gen = JSON.parse(fs.readFileSync('bank_generated.json', 'utf8'))
const items = Object.entries(gen).map(([key, v]) => ({
  key,
  ...v,
}))

// 去重：同知识点同难度下题干完全相同的只留一条
const seen = new Set()
const uniq = []
for (const it of items) {
  const sig = `${it.knowledge_points.join(',')}|${it.question}`
  if (seen.has(sig)) continue
  seen.add(sig)
  uniq.push(it)
}

// id 从 1000 起，避免与现有题库 1-18 冲突
const out = uniq.map((it, i) => ({
  id: 1000 + i,
  subject: it.subject,
  knowledge_points: it.knowledge_points,
  difficulty: it.difficulty,
  question: it.question,
  hint: it.hint,
  answer: it.answer,
  target_errors: it.target_errors || [],
}))

const js = `/**
 * AI 预生成的题库（由 gen_bank.py 离线批量生成，人工抽检后入库）
 * 覆盖：数据结构 / 算法 / 操作系统 / 计算机网络 / 高等数学 / 线性代数 / 概率论
 * 共 ${out.length} 题。id 从 1000 起，与下方手工题库（1-18）不冲突。
 */
export const GEN_BANK = ${JSON.stringify(out, null, 2)}
`

fs.writeFileSync('zhiyi/frontend/src/data/questionBankGen.js', js)
console.log('written', out.length, 'questions')

// 生成一份人类可读的抽检清单
const lines = ['# 抽检清单', '', `共 ${out.length} 题，按学科统计：`, '']
const stat = {}
out.forEach((q) => (stat[q.subject] = (stat[q.subject] || 0) + 1))
Object.entries(stat).forEach(([s, n]) => lines.push(`- ${s}: ${n}`))
lines.push('')
out.forEach((q) => {
  lines.push(`## [${q.id}] ${q.subject} · ${q.knowledge_points[0]} · ${q.difficulty}`)
  lines.push(`- 题干：${q.question}`)
  lines.push(`- 思路：${q.hint}`)
  lines.push(`- 答案：${q.answer}`)
  lines.push(`- 考察失误：${(q.target_errors || []).join('/')}`)
  lines.push('')
})
fs.writeFileSync('抽检清单.md', lines.join('\n'), 'utf8')
console.log('review list written')
