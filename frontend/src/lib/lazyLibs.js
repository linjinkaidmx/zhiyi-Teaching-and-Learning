/**
 * 重库按需加载（首屏不再下载）
 * ---------------------------------------------------------------------------
 * 原先 index.html 里有 4 个同步 <script>：chart.umd.js(200KB) + codemirror(167KB)
 * + python/clike 两个 mode(28KB)，首次访问要白白下载约 396KB，而它们只被
 * 「学习报告（图表）」与「代码编辑器」用到。
 *
 * 这里改成用到时才注入，并且同一资源只加载一次（并发调用共享同一个 Promise），
 * 失败会清掉缓存以便重试。
 *
 * 保留在 index.html 的：highlight.min.js（被 MarkdownText / MathText 等高频文本组件
 * 使用，改为按需会波及渲染路径，收益不划算）、两个小体积 CSS（合计 7KB）。
 */

const scriptCache = {}
const cssCache = {}

function loadScript(src) {
  if (scriptCache[src]) return scriptCache[src]
  scriptCache[src] = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => {
      delete scriptCache[src]
      reject(new Error('资源加载失败，请检查网络后重试'))
    }
    document.head.appendChild(el)
  })
  return scriptCache[src]
}

function loadCss(href) {
  if (cssCache[href]) return cssCache[href]
  cssCache[href] = new Promise((resolve) => {
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href
    el.onload = () => resolve(true)
    el.onerror = () => resolve(true) // 样式失败不阻断功能
    document.head.appendChild(el)
  })
  return cssCache[href]
}

/** 图表库（学习报告页用） */
export function ensureChart() {
  if (typeof window !== 'undefined' && window.Chart) return Promise.resolve(true)
  return loadScript('/chart.umd.js')
}

/** 代码编辑器（在线判题 / 代码诊断用）：核心 + 两种语言 mode + 主题样式 */
export function ensureCodeMirror() {
  if (typeof window !== 'undefined' && window.CodeMirror) return Promise.resolve(true)
  return loadScript('/cm/codemirror.min.js')
    .then(() => loadScript('/cm/mode/python/python.min.js'))
    .then(() => loadScript('/cm/mode/clike/clike.min.js'))
    .then(() => loadCss('/cm/cm0.min.css'))
}
