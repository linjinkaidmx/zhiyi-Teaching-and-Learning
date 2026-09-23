<template>
  <span ref="host" class="math-text"></span>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import katex from 'katex'
import 'katex/contrib/mhchem' // 化学：支持 \ce{} 方程式
import { hasBareMath, wrapBareMath, stripDelims, splitInlineCode, latexToPlain } from '../mathtext'
import { profileRef } from '../profileStore'

const props = defineProps({
  content: { type: String, default: '' },
})

const host = ref(null)
const prefs = profileRef()
const mathOn = () => prefs.value.prefs.renderMath !== false

// 定界符切分：$$...$$、$...$、\[...\]、\(...\)
const DELIM_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
// 代码块：```lang\n...\n```
const CODE_RE = /```([a-zA-Z0-9+#]*)\n?([\s\S]*?)```/g

function tryKatex(tex, display) {
  try {
    const span = document.createElement(display ? 'div' : 'span')
    katex.render(tex, span, { displayMode: display, throwOnError: true, strict: false })
    return span
  } catch {
    return null
  }
}

function textNode(t) {
  return document.createTextNode(t)
}

/** 行内代码：`__len__` → <code> */
function inlineCodeNode(content) {
  const el = document.createElement('code')
  el.className = 'zx-inline-code'
  el.textContent = content
  return el
}

function isMathSeg(seg) {
  return seg.length > 2 && (seg.startsWith('$') || seg.startsWith('\\(') || seg.startsWith('\\['))
}

/** 渲染一个已定界的公式段；失败则降级为可读纯文本 */
function renderMathSeg(seg, el) {
  const { tex, display } = stripDelims(seg)
  // 「公式渲染」关闭：直接给可复制文本（不跑 KaTeX，翻页更快）
  if (!mathOn()) {
    el.appendChild(textNode(latexToPlain(tex)))
    return false
  }
  const node = tryKatex(tex, display)
  if (node) {
    el.appendChild(node)
    return false
  }
  el.appendChild(textNode(latexToPlain(tex)))
  return true
}

/**
 * 渲染一段文本：
 * - 定界符内的公式走 KaTeX
 * - 无定界符的裸片段只在「确实像公式」时才补定界符（代码标识符、正则、\n 这类不再误判）
 * - 渲染失败 → 降级为「剥掉定界符 + LaTeX 转可读文本」，绝不把 $ 号打到页面上
 */
function renderMathInText(text, el) {
  if (!text) return false
  const segments = text.split(DELIM_RE).filter((s) => s !== '')
  // 该段文本是否处于「数学上下文」：含裸公式，或含成对的公式定界符
  const mathContext = hasBareMath(text) || segments.some(isMathSeg)

  let failed = false
  for (const seg of segments) {
    if (isMathSeg(seg)) {
      if (renderMathSeg(seg, el)) failed = true
      continue
    }
    if (!mathContext) {
      el.appendChild(textNode(seg))
      continue
    }
    // 数学上下文里的纯文本：补裸公式定界符，并清掉孤立的 $（多为丢失配对的定界符）
    for (const piece of wrapBareMath(seg).split(/(\$[^$\n]+?\$)/g).filter((s) => s !== '')) {
      if (isMathSeg(piece)) {
        if (renderMathSeg(piece, el)) failed = true
      } else {
        el.appendChild(textNode(piece.replace(/\$/g, '')))
      }
    }
  }
  return failed
}

/** 渲染纯文本段（先切行内代码，再逐段处理公式） */
function renderText(raw, el) {
  if (!raw) return
  let failed = false
  for (const part of splitInlineCode(raw)) {
    if (part.type === 'code') {
      el.appendChild(inlineCodeNode(part.content))
    } else {
      if (renderMathInText(part.content, el)) failed = true
    }
  }
  // 极端兜底：整段都没渲染出内容时，给出可读纯文本（而不是带 $ 的原文）
  if (failed && !el.childNodes.length) el.textContent = latexToPlain(raw)
}

/** 构建代码块节点（有 hljs 则高亮） */
function buildCodeNode(lang, code) {
  const pre = document.createElement('pre')
  pre.className = 'zy-code'
  const codeEl = document.createElement('code')
  if (lang) codeEl.className = 'language-' + lang
  codeEl.textContent = code
  if (typeof window !== 'undefined' && window.hljs) {
    try { window.hljs.highlightElement(codeEl) } catch (e) { /* 高亮失败不影响显示 */ }
  }
  pre.appendChild(codeEl)
  return pre
}

function render() {
  const el = host.value
  if (!el) return
  el.textContent = ''
  const raw = props.content || ''
  if (!raw) return

  // 先按代码块切段，其余部分走文本+公式渲染
  const segs = []
  let last = 0
  let m
  CODE_RE.lastIndex = 0
  while ((m = CODE_RE.exec(raw)) !== null) {
    if (m.index > last) segs.push({ type: 'text', content: raw.slice(last, m.index) })
    segs.push({ type: 'code', lang: m[1] || '', content: m[2] })
    last = m.index + m[0].length
  }
  if (last < raw.length) segs.push({ type: 'text', content: raw.slice(last) })
  if (!segs.length) segs.push({ type: 'text', content: raw })

  for (const s of segs) {
    if (s.type === 'code') {
      el.appendChild(buildCodeNode(s.lang, s.content))
    } else {
      renderText(s.content, el)
    }
  }
}

onMounted(render)
watch(() => props.content, render)
// 公式渲染开关变化时重绘
watch(() => prefs.value.prefs.renderMath, render)
</script>

<style scoped>
.zy-code {
  background: var(--surface-recess);
  border: var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.65;
}
.zy-code code {
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
  white-space: pre;
  background: none;
  padding: 0;
  color: var(--text-primary);
}
:deep(.zx-inline-code) {
  background: var(--surface-unit);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
  font-size: 0.92em;
  color: var(--primary-text);
  word-break: break-all;
}
</style>
