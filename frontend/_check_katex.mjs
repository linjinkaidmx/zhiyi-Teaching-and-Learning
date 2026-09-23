/**
 * 用真实 KaTeX 扫描题库讲解内容：找出「渲染失败 → 前端降级显示原文」的地方
 * 用法：node _check_katex.mjs
 *
 * 完全复刻 MathText.vue 的分段逻辑（DELIM_RE / BARE_MATH_RE / CODE_RE），
 * 因此这里报出的失败 = 用户在页面上看到的「没被转换成符号」的部分。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import katex from 'katex'
import 'katex/contrib/mhchem'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || '_bank_dump.json'
const rows = JSON.parse(readFileSync(path.join(here, file), 'utf8'))

// ---- 与 MathText.vue 一致
const DELIM_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
const BARE_MATH_RE = /[^\u4e00-\u9fff。！？，；：、（）【】《》""''\n]*?(?:\\[a-zA-Z]+|[_^])[^\u4e00-\u9fff。！？，；：、（）【】《》""''\n]*/g
const CODE_RE = /```([a-zA-Z0-9+#]*)\n?([\s\S]*?)```/g

function tryKatex(tex, display) {
  try {
    katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false })
    return null
  } catch (e) {
    return e.message.split('\n')[0]
  }
}

/** 返回该字段里所有渲染失败的片段 */
function scanField(text) {
  const fails = []
  if (!text || typeof text !== 'string') return fails
  // 去掉代码块（代码不做公式渲染）
  const noCode = text.replace(CODE_RE, '\n[CODE]\n')
  const segs = noCode.split(DELIM_RE).filter((s) => s !== '')
  for (const seg of segs) {
    const isMath = seg.length > 2 && (seg.startsWith('$') || seg.startsWith('\\(') || seg.startsWith('\\['))
    if (isMath) {
      const display = seg.startsWith('$$') || seg.startsWith('\\[')
      const tex = seg.startsWith('$$') || seg.startsWith('\\[') || seg.startsWith('\\(') ? seg.slice(2, -2) : seg.slice(1, -1)
      const err = tryKatex(tex, display)
      if (err) fails.push({ kind: '定界符内', tex, err })
      continue
    }
    // 纯文本段：若无定界符但含反斜杠/上下标，MathText 会用 BARE_MATH_RE 包一层再试
    if (/\\[a-zA-Z]+|[_^]/.test(seg)) {
      const wrapped = seg.replace(BARE_MATH_RE, (m) => (m.trim() ? ` $${m}$ ` : m))
      if (wrapped !== seg) {
        for (const piece of wrapped.split(/(\$[^$\n]+?\$)/g)) {
          if (piece.length > 2 && piece.startsWith('$') && piece.endsWith('$')) {
            const err = tryKatex(piece.slice(1, -1), false)
            if (err) fails.push({ kind: '裸公式', tex: piece.slice(1, -1), err })
          }
        }
      } else {
        fails.push({ kind: '疑似未闭合', tex: seg.slice(0, 120), err: '无可用定界符（原样显示）' })
      }
    }
    // 未闭合的 $ 检测
    const dollars = (seg.match(/\$/g) || []).length
    if (dollars % 2 === 1) {
      fails.push({ kind: '美元符不成对', tex: seg.slice(0, 120), err: `含 ${dollars} 个 $（奇数）→ 该段不会走公式渲染` })
    }
  }
  return fails
}

const FIELDS = ['answer', 'key_breakthrough', 'knowledge_review', 'diagnosis']
const errCount = new Map()
const badEntries = []
const texCases = new Map()

for (const row of rows) {
  const d = row.data || {}
  const all = []
  for (const f of FIELDS) {
    for (const fail of scanField(d[f])) all.push({ field: f, ...fail })
  }
  const steps = Array.isArray(d.steps) ? d.steps : []
  steps.forEach((s, i) => {
    for (const fail of scanField(s && s.detail)) all.push({ field: `steps[${i}].detail`, ...fail })
  })
  for (const fail of scanField(row.question)) all.push({ field: 'question', ...fail })
  for (const e of Array.isArray(d.extensions) ? d.extensions : []) {
    for (const fail of scanField(e)) all.push({ field: 'extensions', ...fail })
  }
  if (all.length) {
    badEntries.push({ id: row.id, fails: all })
    for (const f of all) {
      // 归类错误：取「未定义命令」的名字，便于看主要问题
      const m = /Undefined control sequence: (\\[a-zA-Z]+)/.exec(f.err)
      const key = m ? `未定义命令 ${m[1]}` : f.err.slice(0, 60)
      errCount.set(key, (errCount.get(key) || 0) + 1)
      // 去重收集具体片段
      const texKey = `${String(f.tex).slice(0, 60)}||${key}`
      if (!texCases.has(texKey)) texCases.set(texKey, { tex: String(f.tex).slice(0, 90), err: key, n: 0 })
      texCases.get(texKey).n++
    }
  }
}

console.log(`扫描 ${rows.length} 条 · 有渲染失败内容的条目 ${badEntries.length} 条`)
console.log()
console.log('错误类型分布（Top 15）:')
;[...errCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${v}  ×  ${k}`))
console.log()
console.log('去重后的失败片段（按出现次数，最多 25 条）:')
;[...texCases.values()].sort((a, b) => b.n - a.n).slice(0, 25).forEach((c) => {
  console.log(`  ${String(c.n).padStart(3)} × [${c.err.slice(0, 44)}]`)
  console.log(`        ${JSON.stringify(c.tex)}`)
})
