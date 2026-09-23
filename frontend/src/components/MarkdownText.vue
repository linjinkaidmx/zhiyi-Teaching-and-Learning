<template>
  <div ref="host" class="md-text"></div>
</template>

<script setup>
// AI 散文渲染：Markdown（小标题/列表/加粗/行内代码）+ LaTeX（KaTeX）+ 代码块（hljs）
// MathText 用于结构化字段（答案/步骤），本组件用于模型自由生成的长文本。
import { ref, watch, onMounted } from 'vue'
import katex from 'katex'
import 'katex/contrib/mhchem' // 化学：支持 \ce{} 方程式
import { latexToPlain } from '../mathtext'
import { profileRef } from '../profileStore'

const props = defineProps({
  content: { type: String, default: '' },
})

const host = ref(null)
const prefs = profileRef()
const mathOn = () => prefs.value.prefs.renderMath !== false

// 独立公式块（可跨行）：$$...$$ 或 \[...\]
const DISPLAY_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/
// 行内公式：$...$ 或 \(...\)
const INLINE_RE = /(\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g
// 代码块：```lang\n...\n```
const CODE_RE = /```([a-zA-Z0-9+#]*)\n?([\s\S]*?)```/g

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 公式节点：渲染开关关闭或渲染失败 → 返回可读纯文本节点（不打印 $ 号） */
function mathNode(tex, display) {
  if (!mathOn()) return document.createTextNode(latexToPlain(tex))
  const node = katexNode(tex, display)
  if (node) return node
  return document.createTextNode(latexToPlain(tex))
}

function katexNode(tex, display) {
  try {
    const el = document.createElement(display ? 'div' : 'span')
    katex.render(tex, el, { displayMode: display, throwOnError: true, strict: false })
    return el
  } catch {
    return null
  }
}

/** 纯文本 → 加粗 / 行内代码（先转义防注入） */
function inlineHtml(text) {
  const wrap = document.createElement('span')
  wrap.innerHTML = esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  return wrap
}

/** 行内渲染：LaTeX 走 KaTeX，其余走加粗/代码；公式渲染失败时降级为可读纯文本（不打印 $ 号） */
function renderInline(raw, el) {
  for (const seg of raw.split(INLINE_RE)) {
    if (!seg) continue
    const isMath = seg.length > 2 && (seg.startsWith('$') || seg.startsWith('\\('))
    if (isMath) {
      const tex = seg.startsWith('$') ? seg.slice(1, -1) : seg.slice(2, -2)
      const node = mathNode(tex, false)
      if (node.nodeType === 1) {
        el.appendChild(node)
        continue
      }
      el.appendChild(inlineHtml(latexToPlain(tex)))
      continue
    }
    el.appendChild(inlineHtml(seg))
  }
}

function codeBlock(lang, code) {
  const pre = document.createElement('pre')
  pre.className = 'zy-code'
  const codeEl = document.createElement('code')
  if (lang) codeEl.className = 'language-' + lang
  codeEl.textContent = code
  if (typeof window !== 'undefined' && window.hljs) {
    try {
      window.hljs.highlightElement(codeEl)
    } catch {
      /* 高亮失败不影响显示 */
    }
  }
  pre.appendChild(codeEl)
  return pre
}

/** 行块解析：小标题 / 有序无序列表 / 段落 */
function parseLines(text, out) {
  let list = null
  const flush = () => {
    if (list) {
      out.push(list)
      list = null
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) {
      flush()
      continue
    }
    const h = t.match(/^(#{1,4})\s*(.+)$/)
    if (h) {
      flush()
      const el = document.createElement('div')
      el.className = 'md-h md-h' + h[1].length
      renderInline(h[2], el)
      out.push(el)
      continue
    }
    const ul = t.match(/^[-*•]\s+(.+)$/)
    if (ul) {
      if (!list || list.tagName !== 'UL') {
        flush()
        list = document.createElement('ul')
        list.className = 'md-ul'
      }
      const li = document.createElement('li')
      renderInline(ul[1], li)
      list.appendChild(li)
      continue
    }
    const ol = t.match(/^(\d+)\s*[.、)]\s*(.+)$/)
    if (ol) {
      if (!list || list.tagName !== 'OL') {
        flush()
        list = document.createElement('ol')
        list.className = 'md-ol'
      }
      const li = document.createElement('li')
      renderInline(ol[2], li)
      list.appendChild(li)
      continue
    }
    flush()
    const p = document.createElement('p')
    p.className = 'md-p'
    renderInline(t, p)
    out.push(p)
  }
  flush()
}

function render() {
  const el = host.value
  if (!el) return
  el.textContent = ''
  const raw = props.content || ''
  if (!raw) return

  // 1) 切代码块
  const parts = []
  let last = 0
  let m
  CODE_RE.lastIndex = 0
  while ((m = CODE_RE.exec(raw)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: raw.slice(last, m.index) })
    parts.push({ type: 'code', lang: m[1] || '', content: m[2] })
    last = m.index + m[0].length
  }
  if (last < raw.length) parts.push({ type: 'text', content: raw.slice(last) })
  if (!parts.length) parts.push({ type: 'text', content: raw })

  for (const p of parts) {
    if (p.type === 'code') {
      el.appendChild(codeBlock(p.lang, p.content))
      continue
    }
    // 2) 文本段：先摘出独立公式块（避免被按行切断），其余按行解析块结构
    const out = []
    for (const seg of p.content.split(DISPLAY_RE)) {
      if (!seg) continue
      const isDisplay = seg.length > 4 && (seg.startsWith('$$') || seg.startsWith('\\['))
      if (isDisplay) {
        const tex = seg.startsWith('$$') ? seg.slice(2, -2) : seg.slice(2, -2)
        const node = mathNode(tex, true)
        if (node.nodeType === 1) {
          const wrap = document.createElement('div')
          wrap.className = 'md-math'
          wrap.appendChild(node)
          out.push(wrap)
          continue
        }
        // 渲染关闭或失败：降级为可读纯文本，绝不把 $$ 原文打到页面上
        const p2 = document.createElement('p')
        p2.className = 'md-p'
        p2.appendChild(inlineHtml(latexToPlain(tex)))
        out.push(p2)
        continue
      }
      parseLines(seg, out)
    }
    for (const n of out) el.appendChild(n)
  }
}

onMounted(render)
watch(() => props.content, render)
// 公式渲染开关变化时重绘
watch(() => prefs.value.prefs.renderMath, render)
</script>

<style scoped>
.md-text { font-size: var(--fs-body); line-height: var(--lh-body); color: var(--text-secondary); }
.md-text :deep(.md-p) { margin: 6px 0; }
.md-text :deep(.md-h) { font-weight: 700; margin: 10px 0 6px; }
.md-text :deep(.md-h1) { font-size: 16px; }
.md-text :deep(.md-h2) { font-size: 15px; }
.md-text :deep(.md-h3), .md-text :deep(.md-h4) { font-size: 14.5px; }
.md-text :deep(.md-ul), .md-text :deep(.md-ol) { margin: 6px 0 6px 20px; padding: 0; }
.md-text :deep(.md-ul li), .md-text :deep(.md-ol li) { margin: 3px 0; line-height: 1.7; }
.md-text :deep(.md-math) { margin: 8px 0; overflow-x: auto; }
.md-text :deep(strong) { color: var(--text-primary); font-weight: 700; }
.md-text :deep(code) {
  background: var(--surface-unit);
  border-radius: 4px;
  padding: 0 4px;
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
  font-size: 12.5px;
}
.md-text :deep(.zy-code) {
  background: var(--surface-recess);
  border: var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.65;
}
.md-text :deep(.zy-code code) {
  background: none;
  padding: 0;
  white-space: pre;
  color: var(--text-primary);
}
</style>
