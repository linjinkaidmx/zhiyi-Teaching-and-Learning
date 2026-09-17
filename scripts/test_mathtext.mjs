// 验证 MathText 的切分与渲染逻辑（不依赖浏览器，直接在 node 里跑）
import katex from './zhiyi/frontend/node_modules/katex/dist/katex.mjs'

const DELIM = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g
const MATHLIKE = /[A-Za-z0-9_{}^\\()+\-*/=.,! ]*[\\^_][A-Za-z0-9_{}^\\()+\-*/=.,! ]*/g

function renderTex(tex, display) {
  const t = (tex || '').trim()
  if (!t) return ''
  try {
    return katex.renderToString(t, { throwOnError: false, displayMode: display, strict: 'ignore' })
  } catch {
    return '[RAW]' + t
  }
}

function analyze(src) {
  const parts = []
  let last = 0
  DELIM.lastIndex = 0
  let m
  while ((m = DELIM.exec(src)) !== null) {
    const before = src.slice(last, m.index)
    if (before) parts.push({ type: 'text', v: before })
    const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''
    parts.push({ type: 'tex', v: tex, display: !!(m[1] || m[4]) })
    last = DELIM.lastIndex
  }
  const tail = src.slice(last)
  if (tail) parts.push({ type: 'text', v: tail })

  // 对 text 段做裸记号检测
  for (const p of parts) {
    if (p.type !== 'text') continue
    p.bare = []
    MATHLIKE.lastIndex = 0
    let mm
    while ((mm = MATHLIKE.exec(p.v)) !== null) {
      if (mm[0].trim().length >= 2) p.bare.push(mm[0])
    }
  }
  return parts
}

const CASES = [
  "求微分方程 $y'' - 3y' + 2y = 0$ 的通解",
  'y = C_1 e^x + C_2 e^{2x}，其中 C_1、C_2 为任意常数',
  '特征根为 $r_{1,2} = \\frac{1}{3} \\pm \\frac{\\sqrt{2}}{3}i$，通解为 $y = e^{x/3}(C_1\\cos\\frac{\\sqrt{2}}{3}x)$',
  '该方程为二阶常系数齐次线性微分方程，纯中文叙述没有任何公式',
  '代入方程得到特征方程 r^2 - 3r + 2 = 0，因式分解得 (r - 1)(r - 2) = 0',
  '已知 $\\lambda_1 = 3$，求对应的特征向量',
  '矩阵 A = [[1, 2], [2, 1]] 的行列式记为 |A|',
  '积分结果为 $$\\int_0^1 x^2 dx = \\frac{1}{3}$$ 请记住',
]

let pass = 0
let fail = 0
for (const c of CASES) {
  const parts = analyze(c)
  console.log('INPUT :', c)
  for (const p of parts) {
    if (p.type === 'tex') {
      const html = renderTex(p.v, p.display)
      const ok = html.includes('katex') && !html.includes('katex-error')
      ok ? pass++ : fail++
      console.log(`  [TEX ${p.display ? 'display' : 'inline'}] "${p.v}" -> ${ok ? 'OK' : 'RENDER_ERROR'}`)
    } else {
      if (p.bare.length) {
        for (const b of p.bare) {
          const html = renderTex(b, false)
          const ok = html.includes('katex') && !html.includes('katex-error')
          ok ? pass++ : fail++
          console.log(`  [BARE->TEX] "${b}" -> ${ok ? 'OK' : 'RENDER_ERROR'}`)
        }
      } else {
        console.log(`  [TEXT] "${p.v.slice(0, 40)}${p.v.length > 40 ? '...' : ''}" (纯文本直出)`)
      }
    }
  }
  console.log('')
}
console.log(`render results: pass=${pass} fail=${fail}`)
