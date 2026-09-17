<template>
  <span class="math-text" v-html="html"></span>
</template>

<script setup>
/**
 * 数学文本渲染组件
 *
 * 背景：AI 返回的解析文本中，数学表达式记号形态不稳定——
 *   有时带 $...$ / $$...$$ / \(...\) / \[...\] 定界符（规范 LaTeX），
 *   有时裸输出 C_1 e^{2x} / \frac{a}{b}（无定界符），
 *   有时用 Unicode 数学字母（𝑥）或下标（C₁）。
 * 纯文本直接显示就成了"乱码"。
 *
 * 策略（三层降级，保证任何输入都不白屏）：
 *   1. 按定界符切分，公式段交给 KaTeX 渲染（throwOnError: false）
 *   2. 无定界符的文本段，用启发式正则找出"裸数学子串"（含 ^ _ \ 的
 *      连续西文片段），自动补 $ 后渲染——覆盖历史旧数据与模型偶尔不守规矩的情况
 *   3. 渲染失败时 katex 自身输出带红色标注的原文，仍可读
 */
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps({
  text: { type: String, default: '' },
})

// $$..$$ | $..$ | \(..\) | \[..\]
const DELIM = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g
// 含 ^ _ \ 的连续西文数学串（空格/运算符/花括号均属于表达式的一部分）
const MATHLIKE = /[A-Za-z0-9_{}^\\()+\-*/=.,! ]*[\\^_][A-Za-z0-9_{}^\\()+\-*/=.,! ]*/g

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderTex(tex, display) {
  const t = (tex || '').trim()
  if (!t) return ''
  try {
    return katex.renderToString(t, {
      throwOnError: false,
      displayMode: display,
      strict: 'ignore',
    })
  } catch {
    return esc(t)
  }
}

/** 无定界符文本：裸记号子串补 $ 渲染，其余转义输出 */
function renderPlain(seg) {
  if (!seg) return ''
  let out = ''
  let last = 0
  MATHLIKE.lastIndex = 0
  let m
  while ((m = MATHLIKE.exec(seg)) !== null) {
    const frag = m[0]
    // 过短或只有孤立符号的不值得渲染，按原文处理
    if (frag.trim().length < 2) continue
    out += esc(seg.slice(last, m.index))
    out += renderTex(frag, false)
    last = m.index + frag.length
  }
  out += esc(seg.slice(last))
  return out
}

const html = computed(() => {
  const src = props.text || ''
  if (!src) return ''

  let out = ''
  let last = 0
  DELIM.lastIndex = 0
  let m
  while ((m = DELIM.exec(src)) !== null) {
    out += renderPlain(src.slice(last, m.index))
    const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''
    out += renderTex(tex, !!(m[1] || m[4]))
    last = DELIM.lastIndex
  }
  out += renderPlain(src.slice(last))
  return out
})
</script>

<style scoped>
.math-text {
  line-height: inherit;
}
.math-text :deep(.katex) {
  font-size: 1.05em;
}
</style>
