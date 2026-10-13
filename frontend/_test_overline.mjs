/**
 * 离线验证：截图里那道题（命令名丢反斜杠）修复后能否真正渲染。
 * 用法：node _test_overline.mjs
 */
import katex from 'katex'
import 'katex/contrib/mhchem'
import { normalizeLatex, hasBareMath, wrapBareMath } from './src/mathtext.js'

const CASES = [
  ['截图原题 id=262', '14. (1) 已知 P(\\overline{A})=0.3,P(B)=0.4,P(A\\overline{B})= 0.5，求条件概率 P(B A∪\\overline{B}).'],
  ['未修复形态（应被自动补回）', '14. (1) 已知 P(overline{A})=0.3,P(B)=0.4,P(Aoverline{B})= 0.5，求条件概率 P(B A∪overline{B}).'],
  ['物理：vec/hat 空格写法', 'Δ vec r=8hat i-2hat j m，bar{vec v}=4hat i-1hat j m/s'],
  ['统计：bar{x}', '样本均值 bar{x}=10，求 μ 的 95% 置信区间。'],
  ['代数：mathbb{Z}', '判断 (mathbb{Z}, +)、 (mathbb{Q}*, ×) 是否构成群。'],
  ['误伤检查（不该改动）', '这句话里的 hat is、dot com、bar chart、集合 {a,b} 都不该被改。'],
]

let bad = 0
for (const [label, src] of CASES) {
  const n = normalizeLatex(src)
  const pieces = wrapBareMath(n).split(/(\$[^$\n]+?\$)/g).filter((s) => s !== '')
  let ok = 0
  let fail = 0
  const residue = []
  for (const p of pieces) {
    if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) {
      try {
        katex.renderToString(p.slice(1, -1), { throwOnError: true, strict: false })
        ok++
      } catch (e) {
        fail++
        console.log('     ✗ KaTeX 失败:', JSON.stringify(p), String(e.message).slice(0, 70))
      }
    } else {
      // 落单的花括号才算残留（成对的如「集合 {a,b}」是正常正文）
      const braces = (p.match(/[{]/g) || []).length + (p.match(/[}]/g) || []).length
      if (/[\\$]/.test(p) || braces % 2 === 1) residue.push(p)
    }
  }
  const isNegativeCase = label.startsWith('误伤检查')
  const changed = n !== src
  const pass = fail === 0 && residue.length === 0 && (isNegativeCase ? !changed : true)
  if (!pass) bad++
  console.log(
    (pass ? '✓ ' : '✗ ') + label +
    `　KaTeX成功 ${ok}／失败 ${fail}　残留 ${JSON.stringify(residue)}` +
    (isNegativeCase ? `　是否被改=${changed}` : '')
  )
  if (changed && !isNegativeCase) console.log('     归一化 → ' + JSON.stringify(n.slice(0, 78)))
  console.log('     数学上下文=' + hasBareMath(n))
}
console.log('\n不符合预期: ' + bad)
process.exit(bad ? 1 : 0)
