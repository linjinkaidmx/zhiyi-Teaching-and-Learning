/**
 * MathText 的纯逻辑层（不依赖 DOM，可在 Node 里用真实 KaTeX 做回归测试）
 *
 * 解决两类「乱码」：
 * 1) 裸公式识别过宽：过去任何含 `_`、`^`、`\命令` 的文本都会被自动包成 $...$，
 *    于是代码标识符（`__len__`）、正则（`1[3-9]\d{9}`）、转义字符（`\n`）都被当成公式，
 *    KaTeX 必然失败 → 降级时把带 $ 的原文打印出来，页面就出现 `$__len__$` 这种乱码。
 *    → 现在只认「已知 LaTeX 命令」与 `x^2`/`x_1` 这类明确结构。
 * 2) 渲染失败后的降级不当：过去直接打印含定界符的原文。
 *    → 现在剥掉定界符并做 LaTeX→Unicode 近似转换，显示成可读的数学，而不是源码。
 */

/** 已知 LaTeX 命令（理工科常用；只有这些才值得当公式渲染） */
const CMD_LIST = [
  // 结构
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'binom', 'dbinom', 'tbinom', 'overline', 'underline',
  'underbrace', 'overbrace', 'stackrel', 'substack', 'begin', 'end', 'left', 'right',
  'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'textstyle', 'limits', 'boxed', 'cancel',
  // 字体
  'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'mathbb', 'mathsf', 'mathtt', 'mathfrak',
  'boldsymbol', 'operatorname', 'vec', 'hat', 'widehat', 'bar', 'tilde', 'widetilde', 'dot', 'ddot',
  'ce', 'pu',
  // 希腊字母
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'varpi', 'rho', 'varrho', 'sigma',
  'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  // 运算与符号
  'times', 'cdot', 'div', 'pm', 'mp', 'ast', 'star', 'circ', 'bullet', 'oplus', 'otimes', 'odot',
  'cup', 'cap', 'bigcup', 'bigcap', 'bigoplus', 'bigotimes', 'bigvee', 'bigwedge', 'setminus',
  'sum', 'prod', 'coprod', 'int', 'iint', 'iiint', 'oint', 'lim', 'sup', 'inf', 'max', 'min',
  'log', 'ln', 'lg', 'exp', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'det', 'dim', 'ker', 'deg', 'gcd', 'lcm', 'bmod', 'pmod',
  // 关系与集合
  'le', 'leq', 'leqslant', 'ge', 'geq', 'geqslant', 'ne', 'neq', 'approx', 'equiv', 'sim', 'simeq',
  'cong', 'propto', 'asymp', 'll', 'gg', 'in', 'notin', 'ni', 'subset', 'supset', 'subseteq',
  'supseteq', 'subsetneq', 'emptyset', 'varnothing', 'forall', 'exists', 'nexists', 'neg', 'land',
  'lor', 'therefore', 'because', 'perp', 'parallel', 'nparallel', 'mid', 'nmid', 'angle', 'triangle',
  'square', 'diamond',
  // 箭头
  'to', 'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow',
  'mapsto', 'uparrow', 'downarrow', 'updownarrow', 'longrightarrow', 'longleftarrow', 'implies',
  'iff', 'nearrow', 'searrow',
  // 其他
  'infty', 'partial', 'nabla', 'prime', 'hbar', 'ell', 'Re', 'Im', 'aleph', 'wp', 'deg', 'S',
  'lfloor', 'rfloor', 'lceil', 'rceil', 'langle', 'rangle', 'lVert', 'rVert', 'Vert', 'vert',
  'quad', 'qquad', 'ldots', 'cdots', 'vdots', 'ddots', 'dots', 'space', 'textwidth',
]

export const KNOWN_CMDS = new Set(CMD_LIST)

/** 裸文本里出现的 \cmd（且命令名已知） */
const KNOWN_CMD_RE = new RegExp('\\\\(' + CMD_LIST.join('|') + ')(?![a-zA-Z])')

/** 裸公式 token：\cmd{...} 或 x^2 / x_{i} 这类明确结构 */
const BARE_TOKEN_RE = new RegExp(
  [
    '(?<!\\\\)\\\\[a-zA-Z]+(?:\\{[^{}]*\\})*',                        // \frac{a}{b} / \theta
    '[A-Za-z0-9)\\]]\\^(?:\\{[^{}]*\\}|[0-9A-Za-z]{1,3})',           // x^2 / x^{n} / e^{-x}
    '[A-Za-z0-9)\\]]_(?:\\{[^{}]*\\}|[0-9]{1,3})',                   // x_1 / x_{i}（下标只认数字或花括号）
  ].join('|'),
  'g',
)

/** 该 token 是否值得当公式（命令必须是已知的；上下标必须紧贴变量且形态明确） */
export function isMathToken(tok) {
  if (!tok) return false
  if (tok.startsWith('\\')) {
    const m = /^\\([a-zA-Z]+)/.exec(tok)
    return !!m && KNOWN_CMDS.has(m[1])
  }
  // 下划线：只有 `_数字` 或 `_{...}` 才算下标，避免把 max_len / snake_case / __len__ 当公式
  return /^[A-Za-z0-9)\]]\^/.test(tok) || /^[A-Za-z0-9)\]]_(?:\{|[0-9])/.test(tok)
}

/** 文本里是否含有值得渲染的裸数学 */
export function hasBareMath(text) {
  if (!text) return false
  if (KNOWN_CMD_RE.test(text)) return true
  BARE_TOKEN_RE.lastIndex = 0
  let m
  while ((m = BARE_TOKEN_RE.exec(text)) !== null) {
    if (isMathToken(m[0])) return true
  }
  return false
}

/** 把裸数学 token 包成 $...$（只包裹真正像公式的部分，代码标识符/正则不动） */
export function wrapBareMath(text) {
  if (!text) return text
  BARE_TOKEN_RE.lastIndex = 0
  return text.replace(BARE_TOKEN_RE, (m) => (isMathToken(m) ? ` $${m}$ ` : m))
}

/** 去掉 $...$ / \(..\) / \[..\] 定界符 */
export function stripDelims(seg) {
  if (seg.startsWith('$$') && seg.endsWith('$$')) return { tex: seg.slice(2, -2), display: true }
  if (seg.startsWith('\\[') && seg.endsWith('\\]')) return { tex: seg.slice(2, -2), display: true }
  if (seg.startsWith('\\(') && seg.endsWith('\\)')) return { tex: seg.slice(2, -2), display: false }
  if (seg.startsWith('$') && seg.endsWith('$')) return { tex: seg.slice(1, -1), display: false }
  return { tex: seg, display: false }
}

/** 行内代码切分：`code` → { type:'code' } */
export function splitInlineCode(text) {
  const out = []
  const re = /`([^`\n]+)`/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', content: text.slice(last, m.index) })
    out.push({ type: 'code', content: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', content: text.slice(last) })
  if (!out.length) out.push({ type: 'text', content: text })
  return out
}

/** 常用 LaTeX 命令 → Unicode 符号（降级显示用） */
const SYMBOLS = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘', bullet: '•',
  oplus: '⊕', otimes: '⊗', odot: '⊙', cup: '∪', cap: '∩', bigcup: '⋃', bigcap: '⋂', setminus: '∖',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  le: '≤', leq: '≤', leqslant: '≤', ge: '≥', geq: '≥', geqslant: '≥', ne: '≠', neq: '≠',
  approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', asymp: '≈',
  ll: '≪', gg: '≫', in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆',
  supseteq: '⊇', subsetneq: '⊊', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃',
  nexists: '∄', neg: '¬', land: '∧', lor: '∨', therefore: '∴', because: '∵', perp: '⊥',
  parallel: '∥', nparallel: '∦', mid: '∣', nmid: '∤', angle: '∠', triangle: '△', square: '□',
  diamond: '⋄', infty: '∞', partial: '∂', nabla: '∇', prime: '′', hbar: 'ℏ', ell: 'ℓ',
  aleph: 'ℵ', wp: '℘', deg: '°', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
  langle: '⟨', rangle: '⟩', lVert: '‖', rVert: '‖', Vert: '‖', vert: '|',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐',
  Leftrightarrow: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓', updownarrow: '↕',
  longrightarrow: '→', longleftarrow: '←', implies: '⇒', iff: '⇔', nearrow: '↗', searrow: '↘',
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', ddots: '⋱',
  quad: ' ', qquad: '  ',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  log: 'log', ln: 'ln', lg: 'lg', exp: 'exp', lim: 'lim', sup: 'sup', inf: 'inf', max: 'max',
  min: 'min', det: 'det', dim: 'dim', ker: 'ker', gcd: 'gcd', lcm: 'lcm', bmod: 'mod',
  'space': ' ',
}

/** 需要“吃掉参数并原样输出内容”的命令（字体/文本/括号类） */
const PASSTHRU_CMDS = new Set([
  'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'mathbb', 'mathsf', 'mathtt', 'mathfrak',
  'boldsymbol', 'operatorname', 'ce', 'pu', 'boxed', 'overline', 'underline', 'hat', 'widehat',
  'bar', 'tilde', 'widetilde', 'dot', 'ddot', 'vec', 'underbrace', 'overbrace', 'cancel',
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'textstyle', 'limits', 'stackrel',
  'substack', 'begin', 'end', 'pmod',
])

/**
 * LaTeX → 可读纯文本（仅在 KaTeX 渲染失败时使用）：
 * \frac{a}{b} → a/b，\sqrt{x} → √(x)，\theta → θ，\text{中文} → 中文，去掉 {} 与残留 $、反斜杠。
 */
export function latexToPlain(tex) {
  const src = String(tex == null ? '' : tex)
  let i = 0
  let out = ''

  const readGroup = () => {
    while (src[i] === ' ') i++
    if (src[i] !== '{') return null
    let depth = 0
    const start = i + 1
    let j = i
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const content = src.slice(start, j)
    i = j + 1
    return content
  }

  while (i < src.length) {
    const ch = src[i]

    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(src.slice(i))
      if (!m) {
        // \, \; \! \ 等间距命令 → 空格；其余丢掉反斜杠保留字符
        const next = src[i + 1]
        i += 2
        if (next === undefined) continue
        out += /[ ,;:!]/.test(next) ? ' ' : next
        continue
      }
      const name = m[1]
      i += m[0].length

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
        const a = readGroup()
        const b = readGroup()
        if (a !== null && b !== null) out += `${latexToPlain(a)}/${latexToPlain(b)}`
        else if (a !== null) out += latexToPlain(a)
        continue
      }
      if (name === 'sqrt') {
        // \sqrt{x} 或 \sqrt[n]{x}（方括号里是指数）
        let idx = null
        while (src[i] === ' ') i++
        if (src[i] === '[') {
          const close = src.indexOf(']', i)
          if (close > 0) {
            idx = src.slice(i + 1, close)
            i = close + 1
          }
        }
        const arg = readGroup()
        if (arg !== null) {
          out += idx !== null ? `√[${latexToPlain(idx)}](${latexToPlain(arg)})` : `√(${latexToPlain(arg)})`
        } else {
          out += idx !== null ? `√[${latexToPlain(idx)}]` : '√'
        }
        continue
      }
      if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
        const a = readGroup()
        const b = readGroup()
        if (a !== null && b !== null) out += `C(${latexToPlain(a)}, ${latexToPlain(b)})`
        continue
      }
      if (PASSTHRU_CMDS.has(name)) {
        const a = readGroup()
        if (a !== null) out += latexToPlain(a)
        continue // 不带参数的 \left \right 等：不输出命令名
      }
      if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name]
        continue
      }
      // 未知命令：保留名字，至少仍可读
      out += name
      continue
    }

    if (ch === '{' || ch === '}' || ch === '$') {
      i++
      continue
    }
    if (ch === '~') {
      out += ' '
      i++
      continue
    }
    out += ch
    i++
  }

  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

/** 供外部复用的裸公式 token 正则（测试用） */
export const __BARE_TOKEN_RE = BARE_TOKEN_RE
