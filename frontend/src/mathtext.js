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
  // 长箭头（重积分符号 / 长等号箭头，2026-10-13 按真实内容补齐）
  'Longrightarrow', 'Longleftarrow', 'Longleftrightarrow', 'longmapsto',
  'oiint', 'oiiint', 'xrightarrow', 'xleftarrow', 'xleftrightarrow',
  'overset', 'underset', 'stackrel',
  // 常用算符名（避免降级时把英文名当正文打出来）
  'sgn', 'rank', 'diag', 'trace', 'Tr', 'erf', 'sinc', 'argmax', 'argmin', 'arg',
  'grad', 'curl', 'cov', 'var', 'median', 'mode', 'arcsinh', 'arccosh', 'arctanh',
  // 排版/间距/颜色
  'color', 'textcolor', 'phantom', 'hspace', 'vspace', 'mathstrut', 'smash', 'raisebox',
  'rule', 'genfrac', 'mathord', 'mathbin', 'mathrel', 'mathop', 'mathopen', 'mathclose',
  'mathpunct', 'mathinner', 'mod', 'bmod',
]

export const KNOWN_CMDS = new Set(CMD_LIST)

/** 裸文本里出现的 \cmd（且命令名已知） */
const KNOWN_CMD_RE = new RegExp('\\\\(' + CMD_LIST.join('|') + ')(?![a-zA-Z])')

/**
 * 「命令名被吞掉反斜杠」的识别：`overline{` / `Aoverline{B}` / `frac{1}{2}` 这类。
 * 取长度 ≥3 的命令名（长的优先），避免 `pane{` 这种英文词被 `ne` 误伤。
 */
const CMD_BRACE_WORDS = CMD_LIST.filter((c) => c.length >= 3).sort((a, b) => b.length - a.length)
const CMD_BRACE_SRC = '(?<!\\\\)(?:' + CMD_BRACE_WORDS.join('|') + ')(?=\\s*\\{)'
const CMD_BRACE_RE = new RegExp(CMD_BRACE_SRC)
const CMD_BRACE_RE_G = new RegExp(CMD_BRACE_SRC, 'g')
/**
 * 重音类命令的「空格写法」：`vec r` / `hat i` / `dot x` → `\vec r` / `\hat i`。
 * 只认「命令 + 空格 + **单个**变量且其后不是字母」，所以
 * `hat is`（后随 s）/ `dot com`（后随 o）都不会被误伤；`bar` 不入列（躲开 "bar chart"）。
 */
const ACCENT_SPACE_SRC = '(?<!\\\\)(?:vec|hat|dot|ddot|tilde|widehat|widetilde)(\\s+)(?=[A-Za-z](?![A-Za-z]))'
const ACCENT_SPACE_RE = new RegExp(ACCENT_SPACE_SRC)
const ACCENT_SPACE_RE_G = new RegExp(ACCENT_SPACE_SRC, 'g')

/** 判断「这段纯文本里是否混进了 LaTeX 残留」（用于决定要不要走可读降级） */
export function hasLatexNoise(s) {
  const t = String(s == null ? '' : s)
  if (/[\\$^_]/.test(t)) return true
  if (CMD_BRACE_RE.test(t) || ACCENT_SPACE_RE.test(t)) return true
  // 花括号落单（成对的是正常正文，如「集合 {a,b}」）
  const braces = (t.match(/[{]/g) || []).length + (t.match(/[}]/g) || []).length
  return braces % 2 === 1
}

/**
 * 给「被吞掉反斜杠的命令名」补回反斜杠：overline{ → \overline{、Aoverline{B} → A\overline{B}、hat i → \hat i
 *
 * 关键：先把**已经正确**的 `\cmd` 屏蔽成占位符再补。
 * 否则 `\dfrac{..}` 会被从中间认出 `frac` 而插成 `\d\frac{..}`（负向后顾只看紧邻一个字符，拦不住）。
 */
export function restoreCmdBackslash(s) {
  const raw = String(s == null ? '' : s)
  const holes = []
  const masked = raw.replace(/\\([A-Za-z]+)/g, (m) => {
    holes.push(m)
    return '\u0000' + (holes.length - 1) + '\u0000'
  })
  const fixed = masked.replace(CMD_BRACE_RE_G, (m) => '\\' + m).replace(ACCENT_SPACE_RE_G, (m) => '\\' + m)
  return fixed.replace(/\u0000(\d+)\u0000/g, (_, i) => holes[Number(i)])
}

/**
 * 裸公式 token（2026-10-13 增强）：
 *  - \cmd{...} / \cmd[n]{...} / \cmd_0^{...}（命令可带方括号参数、花括号参数、尾随上下标）
 *  - x^2 / x^{n} / O(n^2)（上标）
 *  - x_1 / x_{i} / F_x（下标；`_单字母` 要求后面不是字母数字，避免把 build_next / max_len 当公式）
 */
/** 一层嵌套的 {...}：让 `\frac{1}{\sqrt{1-x^2}}` 这类能整体成为公式 token（否则会切一半、把 { } 留在页面上） */
const GRP = '\\{(?:[^{}]|\\{[^{}]*\\})*\\}'

const BARE_TOKEN_RE = new RegExp(
  [
    // 「重音命令 + 空格写法」要连参数一起收：\vec r / \hat i / \bar x（否则会切成 $\vec$ 让 KaTeX 报错）
    '(?<!\\\\)\\\\(?:overrightarrow|widehat|widetilde|overline|underline|vec|hat|bar|dot|ddot|tilde)\\s?[A-Za-z](?![A-Za-z])',
    // \frac{a}{b} / \theta / \sec^2x / \oiint_0^{n} / \int_0^\infty
    '(?<!\\\\)\\\\[a-zA-Z]+(?:\\[[^\\]]*\\])*(?:' + GRP + ')*(?:[\\^_](?:' + GRP + '|[0-9]{1,3}|[a-zA-Z]|\\\\[a-zA-Z]+))*',
    // x^2 / x^{n} / n^2（数字/花括号总是安全；单字母要求后面不是字母数字）
    '[A-Za-z0-9)\\]]\\^(?:' + GRP + '|[0-9]{1,3}|[a-zA-Z](?![A-Za-z0-9])|\\\\[a-zA-Z]+)',
    // x_1 / x_{i} / F_x
    '(?<![A-Za-z0-9_])[A-Za-z0-9)\\]]_(?:' + GRP + '|[0-9]{1,3}|[a-zA-Z](?![A-Za-z0-9_])|\\\\[a-zA-Z]+)',
  ].join('|'),
  'g',
)

/** 该 token 是否值得当公式（\命令必须是已知的；上下标形态在正则里已收紧） */
export function isMathToken(tok) {
  if (!tok) return false
  if (tok.startsWith('\\')) {
    const m = /^\\([a-zA-Z]+)/.exec(tok)
    return !!m && KNOWN_CMDS.has(m[1])
  }
  // 下划线：`_数字` / `_{...}` / `_单字母`（正则已排除 snake_case）；上标同理
  return /^[A-Za-z0-9)\]]\^/.test(tok) || /^[A-Za-z0-9)\]]_/.test(tok)
}

/**
 * 归一化：JSON 链路双重转义残留的 `\\cmd` → `\cmd`。
 * 只处理「`\\` 紧跟一个**已知命令名**（≥2 字母）」这一种形态：
 *   - `\\overline{p}` → `\overline{p}`（双重转义 bug）
 *   - `\begin{cases}a\\x_1\end{cases}` 里的 `\\x_1` **不动**（合法的换行 + 变量）
 *   - `\\3` / `\\ b` / `\\\\` 也都不动
 */
export function normalizeLatex(text) {
  if (!text) return text
  // 1) 双重转义：\\cmd → \cmd（只认「\\ + 已知命令名」）
  const step1 = String(text).replace(/(?<!\\)\\\\(?=([a-zA-Z]{2,}))/g, (mm, w) => (KNOWN_CMDS.has(w) ? '\\' : mm))
  // 2) 丢了反斜杠的命令名：overline{ → \overline{、Aoverline{B} → A\overline{B}、vec r → \vec r
  return restoreCmdBackslash(step1)
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
  min: 'min', det: 'det', dim: 'dim', ker: 'ker', gcd: 'gcd', lcm: 'lcm',   bmod: 'mod',
  space: ' ',
  // 2026-10-13 补齐（原缺失 → 降级时会把英文命令名打到页面上）
  Longrightarrow: '⟹', Longleftarrow: '⟸', Longleftrightarrow: '⟺', longmapsto: '⟼',
  oiint: '∯', oiiint: '∰', xrightarrow: '→', xleftarrow: '←', xleftrightarrow: '↔',
  sgn: 'sgn', rank: 'rank', diag: 'diag', trace: 'tr', Tr: 'tr', erf: 'erf', sinc: 'sinc',
  argmax: 'argmax', argmin: 'argmin', arg: 'arg', grad: 'grad', curl: 'curl', cov: 'cov',
  var: 'var', median: 'median', mode: 'mode', arcsinh: 'arsinh', arccosh: 'arcosh', arctanh: 'artanh',
  mod: 'mod',
  // 三角函数/双曲（原缺失 → 降级时会把函数名整段丢掉）
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  sup: 'sup', inf: 'inf',
}

/** 需要“吃掉参数并原样输出内容”的命令（字体/文本/括号类） */
const PASSTHRU_CMDS = new Set([
  'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'mathbb', 'mathsf', 'mathtt', 'mathfrak',
  'boldsymbol', 'operatorname', 'ce', 'pu', 'boxed', 'overline', 'underline', 'hat', 'widehat',
  'bar', 'tilde', 'widetilde', 'dot', 'ddot', 'vec', 'underbrace', 'overbrace', 'cancel',
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'textstyle', 'limits', 'stackrel',
  'substack', 'begin', 'end', 'pmod',
  // 2026-10-13 补齐：这些命令都「吃掉参数、只输出内容」，降级时不留英文名
  'overset', 'underset', 'color', 'textcolor', 'phantom', 'hspace', 'vspace', 'mathstrut',
  'smash', 'raisebox', 'rule', 'genfrac', 'mathord', 'mathbin', 'mathrel', 'mathop',
  'mathopen', 'mathclose', 'mathpunct', 'mathinner', 'xrightarrow', 'xleftarrow', 'xleftrightarrow',
])

/** 上/下标 → Unicode 映射（降级显示用，避免残留 ^ _ 符号） */
const SUPS = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', '/': 'ᐟ', ' ': ' ',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ',
  m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
}
const SUBS = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', ' ': ' ',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
  s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
}

/** 可以作为单字符上标的特殊符号（白名单，避免把 `^、` 这类运算符说明改坏） */
const SUP_EXTRA = new Set(['∞', '*', "'", '+', '-', '°', '′', '‾', '¯'])

/**
 * LaTeX → 可读纯文本（仅在 KaTeX 渲染失败时使用）
 * \frac{a}{b} → a/b，\sqrt{x} → √(x)，\theta → θ，\text{中文} → 中文
 * **保证不残留**：反斜杠、花括号、$ 号、^ _ 符号、以及任何英文命令名。
 */
export function latexToPlain(tex) {
  // 「命令名被 JS 转义吃掉反斜杠」的修复（overline{p} → \overline{p}、Aoverline{B} → A\overline{B}）
  const src = restoreCmdBackslash(String(tex == null ? '' : tex))
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

    if (ch === '^' || ch === '_') {
      const isSub = ch === '_'
      i += 1 // 跳过 ^ / _ 本身
      let content = null
      let ok = false
      let direct = null // 命中「\符号」时直接输出的字符（如 ^\infty → ∞）
      if (src[i] === '{') {
        content = readGroup()
        ok = content !== null && content !== ''
      } else if (/[0-9]/.test(src[i] || '')) {
        const m = /^[0-9]{1,3}/.exec(src.slice(i))
        content = m[0]
        i += m[0].length
        ok = true
      } else if (/[A-Za-z]/.test(src[i] || '')) {
        // 单字母上下标：下标要排除 snake_case —— F_x 该转，max_len / build_next / TIME_WAIT 不该转
        const after = src[i + 1] || ''
        const prev = src[i - 2] || ''
        const prev2 = src[i - 3] || ''
        const snake = isSub && (/[A-Za-z0-9]/.test(after) || (/[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(prev2)))
        if (!snake) {
          content = src[i]
          i += 1
          ok = true
        }
      } else if (src[i] === '\\') {
        // ^\infty / _\alpha 这类：直接取符号本身
        const m2 = /^\\([a-zA-Z]+)/.exec(src.slice(i))
        if (m2 && SYMBOLS[m2[1]] !== undefined) {
          direct = SYMBOLS[m2[1]]
          i += m2[0].length
          ok = true
        }
      } else if (!isSub && SUP_EXTRA.has(src[i])) {
        // 上标后接特殊符号：1^∞ / A^* / x^' 这类（不吞标点，避免把 ^、 这种运算符说明改坏）
        content = src[i]
        i += 1
        ok = true
      }
      if (!ok) { out += ch; continue } // 不是上下标（如标识符里的 _）→ 原样保留
      if (direct !== null) { out += direct; continue }
      const table = isSub ? SUBS : SUPS
      const mapped = [...content].map((c) => table[c])
      out += mapped.every((x) => x !== undefined) ? mapped.join('') : '(' + latexToPlain(content) + ')'
      continue
    }

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
      // 未知命令：**绝不把英文命令名打到页面上** —— 有参数就只保留参数内容，否则整段丢弃
      while (src[i] === ' ') i++
      let took = false
      while (src[i] === '{') {
        const g = readGroup()
        if (g === null) break
        out += latexToPlain(g)
        took = true
        while (src[i] === ' ') i++
      }
      if (!took) continue
      continue
    }

    if (ch === '{' || ch === '}' || ch === '$') { i++; continue }
    if (ch === '~') { out += ' '; i++; continue }
    out += ch
    i++
  }

  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * 纯文本段兜底：含 LaTeX 噪声（反斜杠 / 花括号）时走可读降级，否则只清掉落单的 $。
 * 用于「数学上下文里未被包成公式的残留片段」，保证任何情况下都不把源码打到页面。
 */
export function sanitizePlain(text) {
  const s = String(text == null ? '' : text)
  // 「确实混进了 LaTeX 残留」才走可读降级（判定见 hasLatexNoise），避免误伤正常正文
  if (hasLatexNoise(s)) return latexToPlain(s)
  return s
}

/** 供外部复用的裸公式 token 正则（测试用） */
export const __BARE_TOKEN_RE = BARE_TOKEN_RE
