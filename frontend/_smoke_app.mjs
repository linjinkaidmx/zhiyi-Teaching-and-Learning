/**
 * 应用渲染冒烟（Node + Vite SSR + 内存路由）
 * 目的：在没有浏览器的环境里证明 App.vue 在各路由下都能渲染出内容（而不是白屏）。
 * 用法：node _smoke_app.mjs
 */
import { createServer } from 'vite'

// App.vue 及其依赖会在 setup / 模块加载阶段接触浏览器 API，给出最小 stub
const store = new Map()
globalThis.localStorage = {
  get length() {
    return store.size
  },
  key: (i) => [...store.keys()][i] || null,
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
globalThis.document = {
  documentElement: { dataset: { theme: 'dark' }, classList: { add() {}, remove() {}, toggle() {} } },
  body: { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, removeChild() {} },
  createElement: () => ({
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    setAttribute() {},
    getContext: () => ({}),
    toDataURL: () => '',
  }),
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  cookie: '',
}
globalThis.window = {
  scrollY: 0,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  location: { pathname: '/', search: '', hash: '', href: 'http://localhost/' },
  history: { pushState() {}, replaceState() {}, state: null },
  getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
  navigator: { userAgent: 'node', clipboard: null },
}
globalThis.history = globalThis.window.history
globalThis.location = globalThis.window.location
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456' })
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0)
globalThis.matchMedia = globalThis.window.matchMedia
// Node 22 的 navigator 是只读 getter，用 defineProperty 覆盖
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: null, userAgent: 'node' },
    configurable: true,
  })
} catch {
  /* 保留原生 navigator 即可 */
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

let failures = 0
const check = (cond, label, extra) => {
  if (cond) console.log('  ✓ ' + label)
  else {
    failures += 1
    console.log('  ✗ ' + label + (extra !== undefined ? `  → ${String(extra).slice(0, 200)}` : ''))
  }
}

// 各路由应出现的关键内容（证明该路由渲染到了对应页面，而不是空白/报错）
const CASES = [
  { path: '/', expect: ['知一', '今天准备解决哪几道题'], label: '首页（P3，欢迎语 + 骨架屏）' },
  { path: '/capture', expect: ['AI 拍题'], label: 'AI拍题（P4 新版）' },
  { path: '/q/nonexistent', expect: ['没找到这道题'], label: '讲解页（P5，无数据空态）' },
  { path: '/wrongbook', expect: ['错题学习'], label: '错题学习（P6 新版）' },
  { path: '/practice/quiz', expect: ['自测练习'], label: '自测（P6 新版）' },
  { path: '/me', expect: ['学习资料', '偏好设置', '数据管理'], label: '我的（P6 迁 v1）' },
  { path: '/more', expect: ['更多', '算法演示', '考前速查'], label: '更多（新外壳）' },
  { path: '/chat', expect: ['AI 对话', '新对话'], label: 'AI对话（P7 列表）' },
  { path: '/chat/abc', expect: ['AI 对话'], label: 'AI对话详情（P7）' },
  { path: '/course', expect: ['我的课程'], label: '我的课程（P8）' },
  { path: '/timetable', expect: ['课程表'], label: '课程表（P8）' },
  { path: '/exams', expect: ['考试安排'], label: '考试安排（课程表重做）' },
  { path: '/data', expect: ['学习数据', '薄弱知识点'], label: '学习数据（P8）' },
  { path: '/records', expect: ['学习记录'], label: '学习记录（P8）' },
  { path: '/community', expect: ['即将上线', '知一社区'], label: '社区介绍（P8）' },
  { path: '/about', expect: ['关于知一'], label: '产品介绍（P8）' },
  { path: '/help', expect: ['帮助与反馈', '常见问题'], label: '帮助反馈（P8）' },
  { path: '/not-a-real-path', expect: ['页面不存在'], label: '404 兜底' },
]

try {
  const { renderToString } = await import('vue/server-renderer')
  const { createSSRApp } = await import('vue')
  const { createRouter, createMemoryHistory } = await import('vue-router')
  const { routes } = await server.ssrLoadModule('/src/router/index.js')
  const App = (await server.ssrLoadModule('/src/App.vue')).default

  for (const c of CASES) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const app = createSSRApp(App)
    app.config.warnHandler = () => {}
    app.config.errorHandler = () => {}
    app.use(router)
    await router.push(c.path)
    await router.isReady()
    let html = ''
    try {
      html = await renderToString(app)
    } catch (error) {
      check(false, `${c.label} 渲染（${c.path}）`, error && error.message)
      continue
    }
    const missing = c.expect.filter((needle) => !html.includes(needle))
    check(html.length > 400 && missing.length === 0, `${c.label} 渲染（${c.path}，${html.length} 字节）`, {
      missing,
      head: html.slice(0, 120),
    })
  }
} catch (error) {
  failures += 1
  console.log('\n✗ 冒烟脚本异常:', error && error.message)
  if (error && error.stack) console.log(error.stack.split('\n').slice(0, 5).join('\n'))
} finally {
  await server.close()
}

console.log('\n' + '='.repeat(46))
console.log(failures === 0 ? '冒烟通过：全部路由都能渲染' : `冒烟失败：${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
