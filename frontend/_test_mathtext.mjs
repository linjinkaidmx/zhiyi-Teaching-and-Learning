/**
 * MathText / mathtext.js 回归测试：确保「代码标识符、正则、转义字符」不再被当公式，
 * 且任何渲染失败都不会把带 $ 的 LaTeX 原文打到页面上。
 * 用法：node _test_mathtext.mjs
 *
 * 判据（核心不变量）：模拟渲染后的可见文本里，不出现 `$` 定界符、不出现未转换的 `\命令`。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import katex from 'katex'
import 'katex/contrib/mhchem'

const here = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(here, '_mathtext_tmp.mjs')
writeFileSync(TMP, readFileSync(path.join(here, 'src', 'mathtext.js'), 'utf8'))
const M = await import('./_mathtext_tmp.mjs')

const DELIM_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g

function katexOk(tex, display) {
  try {
    katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false })
    return true
  } catch {
    return false
  }
}

/** 复刻 MathText.renderMathInText 的可见输出：数学成功 → <MATH>tex</MATH>，失败 → 可读纯文本 */
function simulate(text) {
  const out = []
  const isMathSeg = (s) => s.length > 2 && (s.startsWith('$') || s.startsWith('\\(') || s.startsWith('\\['))
  for (const part of M.splitInlineCode(text)) {
    if (part.type === 'code') {
      out.push(part.content)
      continue
    }
    const segments = part.content.split(DELIM_RE).filter((s) => s !== '')
    const mathContext = M.hasBareMath(part.content) || segments.some(isMathSeg)
    for (const seg of segments) {
      if (isMathSeg(seg)) {
        const { tex, display } = M.stripDelims(seg)
        out.push(katexOk(tex, display) ? `<MATH>${tex}</MATH>` : M.latexToPlain(tex))
        continue
      }
      if (!mathContext) {
        out.push(seg)
        continue
      }
      for (const piece of M.wrapBareMath(seg).split(/(\$[^$\n]+?\$)/g).filter((s) => s !== '')) {
        if (isMathSeg(piece)) {
          const { tex, display } = M.stripDelims(piece)
          out.push(katexOk(tex, display) ? `<MATH>${tex}</MATH>` : M.latexToPlain(tex))
        } else {
          out.push(piece.replace(/\$/g, ''))
        }
      }
    }
  }
  return out.join('')
}

/** 去掉 <MATH> 占位后，可见文本里不该出现 $ 或未转换的 LaTeX 命令 */
function visibleClean(text) {
  const visible = simulate(text).replace(/<MATH>[\s\S]*?<\/MATH>/g, '［公式］')
  return { clean: !visible.includes('$') && !/\\[a-zA-Z]{2,}/.test(visible), visible }
}

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label) }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
}
const eq = (got, want, label) => ok(got === want, label, { got, want })
const section = (t) => console.log('\n' + t)

// ---------------------------------------------------------------- 1. 裸公式识别（不再误判代码）
section('1. 裸公式识别：代码/正则/转义不该被当公式')
{
  const NOT_MATH = [
    '__len__', '__getitem__', '__init__', 'max_len', 'snake_case', 'user_id', 'a_b_c',
    '1[3-9]\\d{9}', '`[\\w.+-]+`', ' \\n ↔ \\r\\n', '\\w', '\\d{9}', '\\t', 'x = y + 1',
    'C++', 'i++', '#include <stdio.h>', 'array[0]', 'n*m',
  ]
  NOT_MATH.forEach((s) => ok(M.hasBareMath(s) === false, `不当公式：${JSON.stringify(s)}`))

  const IS_MATH = ['\\frac{1}{2}', '\\theta', '\\sqrt{x}', 'x^2', 'x_{i}', 'a_1', 'e^{-x}', '\\sum_{n=1}^{\\infty}', '\\ce{H2O}']
  IS_MATH.forEach((s) => ok(M.hasBareMath(s) === true, `该当公式：${JSON.stringify(s)}`))
}

// ---------------------------------------------------------------- 2. 包裹只命中该命中的
section('2. 包裹范围：只包住数学部分，代码原样保留')
{
  const w = M.wrapBareMath('求 x^2 的导数，用 \\frac{1}{2} 表示系数')
  ok(w.includes('$x^2$'), 'x^2 被包裹')
  ok(w.includes('$\\frac{1}{2}$'), '\\frac{1}{2} 被包裹')
  eq(M.wrapBareMath('调用 __len__ 与 1[3-9]\\d{9}'), '调用 __len__ 与 1[3-9]\\d{9}', '代码/正则保持原样')
  eq(M.wrapBareMath('转义字符 \\n 与 \\t'), '转义字符 \\n 与 \\t', '转义字符保持原样')
}

// ---------------------------------------------------------------- 3. 真正是公式的都能渲染成功
section('3. 真公式仍走 KaTeX 并渲染成功')
{
  const CASES = ['\\frac{1}{2}', '\\sqrt{1-x^2}', '\\theta + \\tan x', '\\sum_{n=1}^{\\infty}\\frac{1}{n^2}',
    '\\int_0^1 x^2\\,dx', '\\ce{2H2 + O2 -> 2H2O}', 'x^{2n}', '\\begin{cases}a&x>0\\\\b&x\\le0\\end{cases}']
  CASES.forEach((tex) => ok(katexOk(tex, false), `KaTeX 可渲染：${JSON.stringify(tex)}`))
  const sim = simulate('求 $\\frac{x^2}{\\sqrt{1-x^2}}$ 的积分，注意 \\theta 与 \\tan x 的关系')
  ok(sim.includes('<MATH>\\frac{x^2}{\\sqrt{1-x^2}}</MATH>'), '定界符内公式走 KaTeX')
  ok(!sim.includes('$'), '输出里没有残留的 $ 定界符')
}

// ---------------------------------------------------------------- 4. 降级：渲染失败也给可读文本
section('4. 渲染失败降级为可读文本（不再打印 $ 与反斜杠命令）')
{
  eq(M.latexToPlain('\\frac{1}{2}'), '1/2', '\\frac → a/b')
  eq(M.latexToPlain('\\sqrt{x}'), '√(x)', '\\sqrt → √(x)')
  eq(M.latexToPlain('\\sqrt[3]{x}'), '√[3](x)', '\\sqrt[n]{} → √[n]()')
  eq(M.latexToPlain('\\theta+\\tan x'), 'θ+tan x', '希腊字母与三角命令 → 符号')
  eq(M.latexToPlain('\\text{面积}'), '面积', '\\text{} 去壳')
  eq(M.latexToPlain('\\alpha\\times\\beta\\le\\infty'), 'α×β≤∞', '常用符号映射')
  eq(M.latexToPlain('\\binom{n}{k}'), 'C(n, k)', '\\binom → C(n, k)')
  ok(M.latexToPlain('\\sqrt').includes('√'), '畸形 \\sqrt 不崩且给出 √')
  ok(M.latexToPlain('\\frac{1}{').length >= 1, '括号不闭合也不崩')

  const bad = ['\\frac{1}{2', '\\sqrt', '\\theta', '\\alpha_beta', 'x^2', '\\unknowncmd{x}', '$$']
  bad.forEach((tex) => {
    const plain = M.latexToPlain(tex)
    ok(!plain.includes('$') && !/\\[a-zA-Z]/.test(plain), `降级输出干净：${JSON.stringify(tex)} → ${JSON.stringify(plain)}`)
  })
}

// ---------------------------------------------------------------- 5. 端到端不变量：可见文本里没有裸 LaTeX
section('5. 端到端不变量：任意输入都不出现「未渲染的 LaTeX 源码」')
{
  const SAMPLES = [
    // 取自线上题库/真实讲解中真实出现过的片段
    'Python 中 list 的 __len__ 与 __getitem__ 支持 for 循环，`__iter__` 返回迭代器。',
    '正则 1[3-9]\\d{9} 匹配手机号；`[\\w.+-]+` 匹配邮箱用户部分。',
    'C 语言里 \\n 是换行，\\r\\n 是回车换行，\\t 是制表符。',
    '变量 max_len、user_id、snake_case 都要注意。',
    '面积公式 $S=\\pi r^2$，体积 $V=\\frac{4}{3}\\pi r^3$。',
    '设 $\\theta\\in(0,\\frac{\\pi}{2})$，则 $\\tan\\theta=\\frac{\\beta}{\\rho}$。',
    '化学方程式 $\\ce{2H2 + O2 -> 2H2O}$ 与浓度 $c=\\frac{n}{V}$。',
    '畸形写法：$\\frac{1}{2 与 $\\sqrt 以及孤立的 $ 符号',
    '矩阵 $\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$ 的行列式为 $ad-bc$。',
    '代码块：\n```c\nprintf("%d\\n", x);\n```\n之后继续讲 $\\sum_{i=1}^{n}i$。',
    'BFS 用队列，复杂度 $O(V+E)$；DFS 用栈。',
    '这个公式 $O(n^2)$ 与 $O(n\\log n)$ 的差别很大。',
  ]
  SAMPLES.forEach((s) => {
    const { clean, visible } = visibleClean(s)
    ok(clean, `无裸 LaTeX 残留：${JSON.stringify(s.slice(0, 34))}`, { visible: visible.slice(0, 120) })
  })

  // 畸形 LaTeX（拍题 OCR 常见）：降级后必须是可读文本，且不出现 $ 与未转换命令
  const mal = visibleClean('畸形写法：$\\frac{1}{2 与 $\\sqrt 以及孤立的 $ 符号')
  ok(mal.clean, '畸形/未闭合定界符也输出干净文本', { visible: mal.visible })
  ok(!mal.visible.includes('\\sqrt'), '裸 \\sqrt 被降级为 √', { visible: mal.visible })

  // 代码块内容不被公式处理破坏
  const vis = simulate('代码：\n```c\nprintf("%d\\n", x);\n```')
  ok(vis.includes('printf("%d\\n", x);'), '代码块内容原样保留')
}

// ---------------------------------------------------------------- 6. 行内代码
section('6. 行内代码识别')
{
  const parts = M.splitInlineCode('调用 `__len__` 与 `__iter__` 两个方法')
  eq(parts.filter((p) => p.type === 'code').length, 2, '识别出 2 段行内代码')
  eq(parts.filter((p) => p.type === 'code')[0].content, '__len__', '行内代码内容正确')
  eq(M.splitInlineCode('没有代码').length, 1, '无代码时单段文本')
}

console.log('\n' + '='.repeat(48))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)

try { unlinkSync(TMP) } catch { /* ignore */ }
process.exit(fail === 0 ? 0 : 1)
