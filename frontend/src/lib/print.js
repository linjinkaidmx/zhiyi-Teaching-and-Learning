/**
 * 打印导出（v1）：复用 print.css 的约定
 * ---------------------------------------------------------------------------
 * 约定：body.zy-printing 时隐藏应用本体，只显示 .zy-print-root；
 *       .zy-print-paper / .zy-print-item 提供白底黑字 + 断页规则（见 styles/print.css）。
 */
import { esc } from './dom.js'
import katex from 'katex'
import { wrapBareMath, latexToPlain } from '../mathtext.js'

/** 把文本里的行内/块级公式渲染成 KaTeX HTML（打印用，失败降级为可读纯文本） */
export function renderMathToHtml(text) {
  const src = wrapBareMath(String(text || ''))
  let out = esc(src)
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => mathHtml(tex, true))
  out = out.replace(/\$([^$\n]+?)\$/g, (_, tex) => mathHtml(tex, false))
  return out.replace(/\n/g, '<br/>')
}

function mathHtml(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false })
  } catch {
    return esc(latexToPlain(tex))
  }
}

/** 把一段 HTML 打进打印区并唤起系统打印 */
export function printHtml(title, sections) {
  // sections: [{ label, html }]
  const body = sections
    .map(
      (s) =>
        `<section class="zy-print-item">` +
        `<h3>${esc(s.label || '')}</h3>` +
        `<div>${s.html || ''}</div>` +
        `</section>`,
    )
    .join('')

  let root = document.querySelector('.zy-print-root')
  if (!root) {
    root = document.createElement('div')
    root.className = 'zy-print-root'
    document.body.appendChild(root)
  }
  root.innerHTML = `<div class="zy-print-paper"><h2>${esc(title || '')}</h2>${body}</div>`

  document.body.classList.add('zy-printing')
  const cleanup = () => {
    document.body.classList.remove('zy-printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  // 延迟打印，确保样式生效
  setTimeout(() => window.print(), 60)
}
