/**
 * 全站「公式 / 英文未渲染」泄漏静态检测（离线，不需要服务）
 * ---------------------------------------------------------------------------
 * 做法：把 MathText / MarkdownText 两条渲染管线的「最终可见文本」用同一套逻辑模拟出来，
 *      再对可见文本跑泄漏特征正则。只有「真的会显示在页面上」的残留才会被报出来
 *      （KaTeX 渲染成功的公式不计，因为它不会把源码显示给用户）。
 *
 * 用法：node _test_math_leak.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import katex from 'katex'
import 'katex/contrib/mhchem'
import { hasBareMath, wrapBareMath, stripDelims, latexToPlain, normalizeLatex, sanitizePlain } from './src/mathtext.js'

const R = path.resolve('.')
const MATH_ON = true

/* ============================ 泄漏特征 ============================ */
/* 说明：作用于「最终会显示给用户的文本」。数学语料里出现下列任一字符即视为泄漏 */
const LEAK = [
  { id: 'backslash', re: /\\/, desc: '残留反斜杠（LaTeX 源码）' },
  // 只认「落单」的花括号：成对的大括号是正常正文（如「集合 {a,b}」）
  {
    id: 'brace',
    test: (s) => ((s.match(/[{]/g) || []).length + (s.match(/[}]/g) || []).length) % 2 === 1,
    desc: '残留落单的花括号（公式分组符）',
  },
  { id: 'sup-sub', re: /\^(?=[A-Za-z0-9{(\\])|(?<![A-Za-z0-9_])_(?![A-Za-z0-9_])/, desc: '残留上下标符号 ^ / _（标识符与 ^、 这类不算）' },
  { id: 'dollar', re: /\$/, desc: '残留 $ 定界符' },
  {
    id: 'cmd-noslash',
    re: /\b(?:overline|underline|frac|dfrac|sqrt|begin|end|pmatrix|bmatrix|cases|lim|sim|leq|geq|neq|infty|partial|theta|alpha|beta|lambda|sigma|omega|cdot|times|left|right|Longrightarrow|xrightarrow)\b/,
    desc: '命令名失去反斜杠（JS 字符串转义吃掉 \\）',
  },
  { id: 'html-ent', re: /&(?:amp|lt|gt|nbsp|quot|#\d+);/, desc: 'HTML 实体乱码' },
  { id: 'js-val', re: /\b(?:undefined|null|NaN|\[object Object\])\b/, desc: 'JS 值泄漏' },
]

/* ==================== 管线模拟：MathText ==================== */
const DELIM_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
const CODE_RE = /```([a-zA-Z0-9+#]*)\n?([\s\S]*?)```/g

const isMathSeg = (s) => s.length > 2 && (s.startsWith('$') || s.startsWith('\\(') || s.startsWith('\\['))

let katexOkCount = 0
let katexFailCount = 0
function katexOk(tex, display) {
  try {
    katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false })
    katexOkCount++
    return true
  } catch {
    katexFailCount++
    return false
  }
}

/** 行内代码段 → 视为「代码」，不算泄漏 */
function simMathText(text) {
  const out = []
  for (const part of splitByInlineCode(normalizeLatex(text))) {
    if (part.code) continue
    const segs = part.text.split(DELIM_RE).filter((s) => s !== '')
    const mathContext = hasBareMath(part.text) || segs.some(isMathSeg)
    for (const seg of segs) {
      if (isMathSeg(seg)) {
        const { tex, display } = stripDelims(seg)
        if (!MATH_ON) { out.push(latexToPlain(tex)); continue }
        if (!katexOk(tex, display)) out.push(latexToPlain(tex))
        continue
      }
      if (!mathContext) { out.push(sanitizePlain(seg)); continue }
      for (const piece of wrapBareMath(seg).split(/(\$[^$\n]+?\$)/g).filter((s) => s !== '')) {
        if (isMathSeg(piece)) {
          const { tex, display } = stripDelims(piece)
          if (!MATH_ON) { out.push(latexToPlain(tex)); continue }
          if (!katexOk(tex, display)) out.push(latexToPlain(tex))
        } else out.push(sanitizePlain(piece))
      }
    }
  }
  return out.join('')
}
function splitByInlineCode(text) {
  const out = []
  const re = /`([^`\n]+)`/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[1], code: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  if (!out.length) out.push({ text })
  return out
}

/* ================== 管线模拟：MarkdownText ================== */
const MD_INLINE_RE = /(\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g
const MD_DISPLAY_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/

function simInline(raw) {
  const out = []
  for (const seg of raw.split(MD_INLINE_RE)) {
    if (!seg) continue
    const isMath = seg.length > 2 && (seg.startsWith('$') || seg.startsWith('\\('))
    if (isMath) {
      const tex = seg.startsWith('$') ? seg.slice(1, -1) : seg.slice(2, -2)
      if (!MATH_ON) { out.push(latexToPlain(tex)); continue }
      if (!katexOk(tex, false)) out.push(latexToPlain(tex))
      continue
    }
    // 非定界段：补做「裸公式」识别（与 MarkdownText.vue 的 renderInline 一致）
    if (!hasBareMath(seg)) { out.push(plainInline(seg)); continue }
    for (const piece of wrapBareMath(seg).split(/(\$[^$\n]+?\$)/g)) {
      if (!piece) continue
      if (piece.length > 2 && piece.startsWith('$')) {
        const tex = piece.slice(1, -1)
        if (!MATH_ON) { out.push(latexToPlain(tex)); continue }
        if (!katexOk(tex, false)) out.push(latexToPlain(tex))
      } else out.push(plainInline(piece))
    }
  }
  return out.join('')
}
/** 普通段：先做加粗/行内代码，再过 sanitizePlain（与 MarkdownText 的 inlineHtml(sanitizePlain(seg)) 等价） */
function plainInline(seg) {
  return sanitizePlain(seg.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1'))
}

function simMarkdownText(text) {
  const out = []
  let last = 0, m
  CODE_RE.lastIndex = 0
  const parts = []
  const src = normalizeLatex(text)
  while ((m = CODE_RE.exec(src)) !== null) {
    if (m.index > last) parts.push({ text: src.slice(last, m.index) })
    parts.push({ code: true, text: m[2] })
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push({ text: src.slice(last) })
  if (!parts.length) parts.push({ text: src })

  for (const p of parts) {
    if (p.code) continue
    for (const seg of p.text.split(MD_DISPLAY_RE)) {
      if (!seg) continue
      const isDisplay = seg.length > 4 && (seg.startsWith('$$') || seg.startsWith('\\['))
      if (isDisplay) {
        const tex = seg.slice(2, -2)
        if (!MATH_ON) { out.push(latexToPlain(tex)); continue }
        if (!katexOk(tex, true)) out.push(latexToPlain(tex))
        continue
      }
      out.push(simInline(seg))
    }
  }
  return out.join('')
}

/* ============================ 扫描器 ============================ */
const hits = []
let scanned = 0
function check(where, raw, mode) {
  if (typeof raw !== 'string' || !raw) return
  // 源码里根本没 LaTeX 线索的，直接跳过（省噪声）
  if (!/[\\$^_{]|&(amp|lt|gt|nbsp);/.test(raw)) {
    // 仍要查 JS 值泄漏
    if (!/\b(undefined|null|NaN)\b/.test(raw)) return
  }
  scanned++
  const visible = mode === 'md' ? simMarkdownText(raw) : simMathText(raw)
  for (const r of LEAK) {
    if (r.test) {
      if (!r.test(visible)) continue
      const at = visible.search(/[{}]/)
      hits.push({ where, id: r.id, desc: r.desc, sample: visible.slice(Math.max(0, at - 24), at + 42).replace(/\n/g, '⏎') })
      break
    }
    const m = r.re.exec(visible)
    if (m) {
      const s = Math.max(0, m.index - 24)
      hits.push({ where, id: r.id, desc: r.desc, sample: visible.slice(s, m.index + 42).replace(/\n/g, '⏎') })
      break
    }
  }
}
function walk(obj, where, mode) {
  if (obj == null) return
  if (typeof obj === 'string') return check(where, obj, mode)
  if (Array.isArray(obj)) return obj.forEach((v, i) => walk(v, `${where}[${i}]`, mode))
  if (typeof obj === 'object') for (const k of Object.keys(obj)) walk(obj[k], `${where}.${k}`, mode)
}

/* ============ A. 数据源：考前速查（按 Reference.vue 的真实渲染方式） ============ */
const formulas = await import(pathToFileURL(path.join(R, 'src/ref/formulas.js')).href)
const codeData = await import(pathToFileURL(path.join(R, 'src/ref/code.js')).href)
for (const SEC of [formulas.CALC, formulas.LINEAR, formulas.PROB]) {
  for (const g of SEC.groups || []) {
    for (const it of g.items || []) {
      const where = `${SEC.name}/${g.title}/${it.name}`
      // Reference.vue: h(MathText, { content: '$$' + item.tex + '$$' })，note 直接走 MathText
      if (it.tex) check(`${where}.tex`, '$$' + it.tex + '$$', 'math')
      if (it.note) check(`${where}.note`, it.note, 'math')
    }
  }
}
/** 代码模板 / 复杂度表：只扫会显示的说明字段，code 本身是高亮代码不算泄漏 */
const CODE_SKIP = new Set(['code', 'lang', 'key', 'tags'])
function walkCode(obj, where) {
  if (obj == null) return
  if (typeof obj === 'string') return check(where, obj, 'md')
  if (Array.isArray(obj)) return obj.forEach((v, i) => walkCode(v, `${where}[${i}]`))
  if (typeof obj === 'object') for (const k of Object.keys(obj)) if (!CODE_SKIP.has(k)) walkCode(obj[k], `${where}.${k}`)
}
for (const it of codeData.CODE_TEMPLATES || []) walkCode(it, `CODE_TEMPLATES/${it.name}`)
for (const t of codeData.COMPLEXITY_TABLES || []) walkCode(t, `COMPLEXITY_TABLES/${t.name}`)

/* ============ B. 题库（backend/bank*.json）：只扫会展示的字段 ============ */
const BANK_FIELDS = ['question', 'answer', 'options', 'knowledge_points', 'explain', 'analysis']
for (const f of ['bank.json', 'bank_full.json', 'bank_full_1.json']) {
  const p = path.join(R, '..', 'backend', f)
  if (!fs.existsSync(p)) continue
  let data
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { continue }
  const list = Array.isArray(data) ? data : Object.values(data)
  list.forEach((it, i) => {
    if (!it || typeof it !== 'object') return
    for (const k of BANK_FIELDS) if (k in it) walk(it[k], `bank:${f}[${i}].${k}`, 'math')
  })
}

/* ============ C. 管线弱点：代表性 AI 输出语料 ============ */
const CORPUS = [
  ['裸公式无定界符（AI 常见）', '矩阵 $A$ 的迹记作 \\overline{p}，满足 \\frac{a}{b} 关系。'],
  ['裸公式·整段', '由 \\lim_{n\\to\\infty}\\frac{1}{n}=0 可知收敛。'],
  ['双反斜杠（JSON 双重转义）', '见 \\\\overline{p} 与 \\\\frac{1}{2}。'],
  ['未配对 $', '半径 $r 与面积 S 满足 $S=\\pi r^2$。'],
  ['跨行行内公式', '设 $x \\in \\mathbb{R}$\n且 $y>0$，则'],
  ['\\ce 化学式', '反应为 \\ce{2H2 + O2 -> 2H2O}。'],
  ['矩阵环境', '$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$'],
  ['分段函数', '$$f(x)=\\begin{cases} x, & x\\ge 0 \\\\ -x, & x<0 \\end{cases}$$'],
  ['纯英文命令名（JS 转义吃掉反斜杠）', 'overline{p} 表示 p 的平均值。'],
  ['命令名丢反斜杠·花括号(overline/mathbb)', '已知 P(overline{A})=0.3,P(Aoverline{B})=0.5，整数集 mathbb{Z}。'],
  ['命令名丢反斜杠·空格写法(vec/hat/bar)', 'Δ vec r=8hat i-2hat j m，样本均值 bar{x}=10。'],
  ['误伤检查·英文词不该动', '这句话里的 hat is、dot com、bar chart、pane 与 集合 {a,b} 都不该被改。'],
  ['上下标无花括号', '时间复杂度是 O(n^2) 与 a_1 的情形。'],
]
const base = { k: katexOkCount, f: katexFailCount }
const corpusRows = CORPUS.map(([label, text]) => {
  const md = simMarkdownText(text)
  const mt = simMathText(text)
  const bad = (vis) => (LEAK.find((r) => (r.test ? r.test(vis) : r.re.test(vis))) || {}).id || '—'
  return { label, md: bad(md), mt: bad(mt), mdOut: md.slice(0, 60), mtOut: mt.slice(0, 60) }
})

/* ==================== D. 源码级渲染漏点审计 ==================== */
/* 模板里直接插值「像 AI 文本」的字段、而该文件又没引入 MathText/MarkdownText → 高危泄漏点 */
const AI_FIELD_RE =
  /\{\{[^}]*\b(answer|explanation|explain|reason|content|feedback|comment|tips?|advice|reply|analysis|definition|principle|question|stem|solution|formula|expr|derivation|insight)\b[^}]*\}\}/
function vueFiles(dir) {
  return fs
    .readdirSync(path.join(R, dir))
    .filter((f) => f.endsWith('.vue'))
    .map((f) => path.join(dir, f))
}
const sourceLeaks = []
for (const f of [...vueFiles('src/pages'), ...vueFiles('src/components')]) {
  const src = fs.readFileSync(path.join(R, f), 'utf8')
  if (/Components\.vue$|MathText\.vue$|MarkdownText\.vue$/.test(f)) continue
  const covered = /MathText|MarkdownText/.test(src)
  src.split(/\r?\n/).forEach((line, i) => {
    if (AI_FIELD_RE.test(line) && !/placeholder|title=|aria-|generatedAt|loading \?|cached \?/.test(line)) {
        // 排除误报：只做字面量的条件表达式；已走 latexToPlain 的摘要函数（设计上就是纯文本预览）
        if (/\?\s*['"]|plain\(|latexToPlain\(|plainSummary\(|noteSummary\(/.test(line)) return
        sourceLeaks.push({ file: f, line: i + 1, covered, text: line.trim().slice(0, 110) })
      }
  })
}
// 未引入渲染组件的排前面（风险更高）
sourceLeaks.sort((a, b) => Number(a.covered) - Number(b.covered))

/* ============================ 报告 ============================ */
const lines = []
const P = (s = '') => { console.log(s); lines.push(s) }

P('='.repeat(74))
P('知一 2.0 · 公式/英文「未渲染泄漏」检测报告')
P('='.repeat(74))

P('\n## A+B. 数据源扫描（考前速查 / 题库）')
P('')
P(`扫描字符串 ${scanned} 个，命中 ${hits.length} 处`)
const byRule = {}
for (const h of hits) byRule[h.id] = (byRule[h.id] || 0) + 1
P('按规则：' + (Object.keys(byRule).map((k) => `${k}=${byRule[k]}`).join('  ') || '无'))
P('')
for (const h of hits) P(`- [${h.id}] ${h.where}\n  - ${h.desc}\n  - 可见残留： …${h.sample}…`)

P('\n## C. 渲染管线弱点（代表性 AI 输出语料）')
P('')
P('| 语料 | MarkdownText | MathText | 可见输出 |')
P('|---|---|---|---|')
for (const r of corpusRows) {
  P(`| ${r.label} | ${r.md} | ${r.mt} | ${(r.md !== '—' ? r.mdOut : r.mtOut).replace(/\|/g, '\\|')} |`)
}

P('\n## D. 源码级渲染漏点（未引入渲染组件却直接插值的内容）')
P('')
if (!sourceLeaks.length) P('无')
for (const s of sourceLeaks) P(`- ${s.file}:${s.line}\n  - ${s.text}`)

P('\n## 统计')
P('')
P(`- 数据源泄漏：${hits.length} 处`)
P(`- 管线弱点：${corpusRows.filter((r) => r.md !== '—' || r.mt !== '—').length} / ${corpusRows.length} 条语料在至少一条管线上泄漏`)
P(`- 源码级漏点：${sourceLeaks.length} 处`)

fs.writeFileSync(path.join(R, '_test_math_leak_report.md'), lines.join('\n'), 'utf8')
console.log('\n（完整清单已写入 _test_math_leak_report.md）')

