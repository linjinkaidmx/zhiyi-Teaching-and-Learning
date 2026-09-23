/**
 * 设计系统页渲染冒烟（Node + Vite SSR）
 * 目的：在没有浏览器的环境里验证 DesignSystemPage 能真实渲染出内容，而不是白屏。
 * 用法：node _smoke_ds.mjs
 */
import { createServer } from 'vite'

// 组件 setup 会读取主题与 token 计算值，这里给出最小 stub
globalThis.document = {
  documentElement: { dataset: { theme: 'dark' }, classList: { add() {}, remove() {} } },
  createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {}, setAttribute() {} }),
  addEventListener() {},
  removeEventListener() {},
  body: { style: {} },
}
globalThis.window = { scrollY: 0, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456' })
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0)

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let failures = 0
const check = (cond, label, extra) => {
  if (cond) console.log('  ✓ ' + label)
  else {
    failures += 1
    console.log('  ✗ ' + label + (extra ? `  → ${extra}` : ''))
  }
}

try {
  const { renderToString } = await import('vue/server-renderer')
  const { createSSRApp } = await import('vue')

  const page = await server.ssrLoadModule('/src/pages/DesignSystemPage.vue')
  const app = createSSRApp(page.default)
  app.config.warnHandler = () => {}
  const html = await renderToString(app)

  console.log('\n渲染产物长度:', html.length)
  const must = [
    ['知一 V1 设计系统', '标题'],
    ['surface-standard', '普通表面'],
    ['surface-elevated', '重点表面'],
    ['surface-hero', '主模块表面'],
    ['background', 'background token'],
    ['surface-1', 'surface-1 token'],
    ['hero-surface', 'hero-surface token'],
    ['border-subtle', 'border-subtle token'],
    ['accent-glow', 'accent-glow token'],
    ['primary-hover', 'primary-hover token'],
    ['开始识别', 'Primary 按钮示例'],
    ['开始复习', 'CTA 按钮示例'],
    ['直接进入 AI 对话', 'Secondary 按钮示例'],
    ['继续学习 →', 'Ghost 按钮示例'],
    ['骨架屏', 'Skeleton 区块'],
    ['还没有错题', 'EmptyState 示例'],
    ['识别失败', 'ErrorState 示例'],
    ['指针与数组', 'Tag 示例'],
    ['ui-ai-bar', 'AI 全局状态条'],
    ['ui-ai-logo', 'AI Logo'],
    ['已知晓', '不存在的文案（应为 false）'],
  ]
  console.log('\n关键内容检查:')
  for (const [needle, label] of must) {
    const hit = html.includes(needle)
    if (label.includes('应为 false')) check(!hit, `未出现预期外内容：${needle}`)
    else check(hit, `包含 ${label}（${needle}）`)
  }
} catch (error) {
  failures += 1
  console.log('\n✗ 渲染失败:', error && error.message)
  console.log(error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : '')
} finally {
  await server.close()
}

console.log('\n' + '='.repeat(46))
console.log(failures === 0 ? '冒烟通过：设计系统页可正常渲染' : `冒烟失败：${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
