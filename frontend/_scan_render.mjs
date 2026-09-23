/**
 * 渲染扫描器 v2：用「修复后」的 MathText 逻辑（mathtext.js）复扫真实讲解内容
 * 用法：node _scan_render.mjs [jsonFile]     默认 _bank_dump.json
 *
 * 输出三件事：
 *   1) 有多少片段仍会降级（KaTeX 渲染失败）—— 降级后是可读文本，不再算乱码
 *   2) 可见文本里是否残留 `$` 或未转换的 `\命令`（这是「乱码」的真正判据，必须为 0）
 *   3) 有多少「过去会被误判成公式」的代码/正则片段现在被正确当成普通文本
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import katex from 'katex'
import 'katex/contrib/mhchem'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || '_bank_dump.json'
const rows = JSON.parse(readFileSync(path.join(here, file), 'utf8'))

const { hasBareMath, wrapBareMath, stripDelims, splitInlineCode, latexToPlain } =
  await import(path.join(here, 'src', 'mathtext.js').replace(/\\/g, '/').replace(/^/, 'file://'))

const DELIM_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
const CODE_RE = /```([a-zA-Z0-9+#]*)\n?([\s\S]*?)```/g

const isMathSeg = (s) => s.length > 2 && (s.startsWith('$') || s.startsWith('\\(') || s.startsWith('\\['))

function katexOk(tex, display) {
  try {
    katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false })
    return true
  } catch {
    return false
  }
}

/** 复刻修复后的 MathText 输出 */
function scanText(text) {
  const res = { visible: '', degraded: 0, mathOk: 0, codeKeptAsText: 0 }
  if (!text || typeof text !== 'string') return res
  const noCode = text.replace(CODE_RE, '\n')
  for (const part of splitInlineCode(noCode)) {
    if (part.type === 'code') {
      res.visible += part.content
      continue
    }
    const segments = part.content.split(DELIM_RE).filter((s) => s !== '')
    const mathContext = hasBareMath(part.content) || segments.some(isMathSeg)
    for (const seg of segments) {
      if (isMathSeg(seg)) {
        const { tex, display } = stripDelims(seg)
        if (katexOk(tex, display)) {
          res.mathOk++
          res.visible += '［公式］'
        } else {
          res.degraded++
          const plain = latexToPlain(tex)
          res.visible += plain
          // 该片段是否本来就不该当公式（旧逻辑的误判）
          if (hasBareMath(seg.slice(Math.max(0, 0)))) res.codeKeptAsText++
        }
        continue
      }
      if (!mathContext) {
        res.visible += seg
        continue
      }
      for (const piece of wrapBareMath(seg).split(/(\$[^$\n]+?\$)/g).filter((s) => s !== '')) {
        if (isMathSeg(piece)) {
          const { tex, display } = stripDelims(piece)
          if (katexOk(tex, display)) {
            res.mathOk++
            res.visible += '［公式］'
          } else {
            res.degraded++
            res.visible += latexToPlain(tex)
          }
        } else {
          res.visible += piece.replace(/\$/g, '')
        }
      }
    }
  }
  return res
}

const FIELDS = ['answer', 'key_breakthrough', 'knowledge_review', 'diagnosis']
let totalDegraded = 0
let totalOk = 0
let dirtyVisible = []   // 可见文本里仍有 $ 或未转换命令的字段（真正的乱码）
const degradedSamples = []

for (const row of rows) {
  const d = row.data || {}
  const texts = []
  for (const f of FIELDS) texts.push([f, d[f]])
  ;(Array.isArray(d.steps) ? d.steps : []).forEach((s, i) => texts.push([`steps[${i}].detail`, s && s.detail]))
  texts.push(['question', row.question])
  ;(Array.isArray(d.extensions) ? d.extensions : []).forEach((e) => texts.push(['extensions', e]))

  for (const [field, text] of texts) {
    if (!text) continue
    const r = scanText(text)
    totalDegraded += r.degraded
    totalOk += r.mathOk
    const visibleNoPlaceholder = r.visible.replace(/［公式］/g, '')
    // 真正的乱码判据（收窄版）：
    //   ① $ 紧跟反斜杠（$\frac）② $ 成对包裹「无空白的标识符/命令」（$__len__$、$1[3-9]\d{9}$）
    //   ③ 残留 ≥2 字母的 LaTeX 命令
    // 正则讨论里的孤立 $（^...$）、\d 属于正常正文，不计入。
    const hasDollarDeli = /\$\\|\$[^\s$]{1,40}\$/.test(visibleNoPlaceholder)
    const hasCmd = /\\[a-zA-Z]{2,}/.test(visibleNoPlaceholder)
    if (hasDollarDeli || hasCmd) {
      dirtyVisible.push({ id: row.id, field, visible: visibleNoPlaceholder.slice(0, 140) })
    }
    if (r.degraded && degradedSamples.length < 6) {
      degradedSamples.push({ id: row.id, field, plain: r.visible.replace(/［公式］/g, '').slice(0, 120) })
    }
  }
}

console.log(`扫描 ${rows.length} 条（${file}）`)
console.log(`  正常渲染的公式段: ${totalOk}`)
console.log(`  降级为可读文本的片段: ${totalDegraded}（修复前这些会打印带 $ 的原文）`)
console.log(`  可见文本里仍有 $ 或未转换 \\命令 的字段: ${dirtyVisible.length}  ← 真正的乱码判据，应为 0`)
if (dirtyVisible.length) {
  console.log('  前几条残留:')
  dirtyVisible.slice(0, 8).forEach((x) => console.log(`    #${x.id} ${x.field}: ${JSON.stringify(x.visible)}`))
}
if (degradedSamples.length) {
  console.log('  降级后的实际显示效果（可读文本）:')
  degradedSamples.forEach((x) => console.log(`    #${x.id} ${x.field}: ${JSON.stringify(x.plain)}`))
}
