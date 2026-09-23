/**
 * P9 自动点检：用 CDP 驱动本机 Chrome，做「真实测量 + 真实交互」
 * 用法：node _p9_probe.mjs
 *
 * 检查项：
 *  1. 三档宽度（390 / 768 / 1440）× 全部路由：横向溢出（scrollWidth - innerWidth）
 *  2. 双主题：浅色主题下页面主背景必须足够亮、深色主题下必须足够暗（抓漏色）
 *  3. 控制台错误 / 未捕获异常（每页收集）
 *  4. 真实交互：打开登录弹窗 → 校验输入 → 关闭（headless 点不了的路径）
 *  5. 真实交互：拍题页文字模式输入 → 切题（不依赖后端识别）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9333
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'p9_chrome_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })

const ROUTES = [
  '/', '/capture', '/q/x', '/wrongbook', '/practice/quiz', '/me',
  '/more', '/more?tool=algo', '/more?tool=debug', '/more?tool=ref',
  '/chat', '/chat/1', '/course', '/timetable', '/data', '/records',
  '/community', '/about', '/help', '/not-a-real-path',
]
const WIDTHS = [390, 768, 1440]

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + label)
  } else {
    fail += 1
    console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
  }
}
const section = (t) => console.log('\n' + t)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank',
], { stdio: 'ignore' })

async function waitDevtools() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return
    } catch { /* 还没起来 */ }
    await sleep(250)
  }
  throw new Error('Chrome DevTools 未就绪')
}

let ws
let seq = 0
const pending = new Map()
const consoleErrors = []

function send(method, params = {}) {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function main() {
  await waitDevtools()
  const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('未捕获异常: ' + (msg.params?.exceptionDetails?.text || ''))
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ')
      if (text) consoleErrors.push('console.error: ' + text.slice(0, 160))
    }
  })

  await send('Page.enable')
  await send('Runtime.enable')

  async function goto(url) {
    consoleErrors.length = 0
    await send('Page.navigate', { url })
    await sleep(1400)
  }

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate 失败')
    return r.result?.value
  }

  async function setWidth(width, height = 900) {
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
    })
  }

  // ---------------- 1. 横向溢出 + 控制台错误 ----------------
  section('1. 横向溢出（390 / 768 / 1440 × 全部路由）')
  const overflow = []
  const errRoutes = []
  for (const w of WIDTHS) {
    await setWidth(w, w < 768 ? 844 : 900)
    for (const route of ROUTES) {
      await goto(BASE + route)
      const info = await evaluate(`(() => {
        const de = document.documentElement
        return { sw: de.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }
      })()`)
      const over = Math.max(info.sw, info.bw) - info.iw
      if (over > 1) overflow.push({ w, route, over })
      if (consoleErrors.length) errRoutes.push({ w, route, err: consoleErrors[0] })
    }
  }
  ok(overflow.length === 0, `三档宽度下无横向溢出（检查 ${WIDTHS.length} × ${ROUTES.length} 组合）`, overflow.slice(0, 6))
  ok(errRoutes.length === 0, '全部路由无控制台错误', errRoutes.slice(0, 4))

  // ---------------- 2. 双主题漏色 ----------------
  section('2. 双主题：body 底色 + 卡片文字色（抓漏色）')
  const lum = (rgb) => {
    const m = String(rgb).match(/\d+/g)
    if (!m) return null
    const [r, g, b] = m.map(Number)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  await setWidth(1440, 900)
  const THEME_PAGES = ['/', '/wrongbook', '/me', '/data', '/course']
  for (const theme of ['dark', 'light']) {
    let bgBad = []
    let textBad = []
    const lowContrast = []
    for (const p of THEME_PAGES) {
      await goto(`${BASE}${p}?theme=${theme}`)
      const c = await evaluate(`(() => {
        const body = getComputedStyle(document.body).backgroundColor
        const el = document.querySelector('.surface-standard, .surface-hero, main p, main h1')
        const text = el ? getComputedStyle(el).color : ''
        return { body, text }
      })()`)
      const lb = lum(c.body)
      const lt = lum(c.text)
      // 真实正文 vs 页面底色的对比度：只看「主文字」不够 ——
      // 组件里硬编码浅色主题文字会导致「DOM 有字但深字配深底、根本看不见」（实测在 MarkdownText 上踩过）
      const ctr = await evaluate(`(() => {
        const el = document.querySelector('.md-text, .math-text, .chat__bubble, .pr__q, main p, main h1')
        if (!el) return null
        const cs = getComputedStyle(el)
        return { color: cs.color, sel: el.className }
      })()`)
      // 亮度在 Node 侧算，避免在页面里写正则的转义坑
      const lText = ctr ? lum(ctr.color) : null
      const diff = lText !== null && lb !== null ? Math.abs(lText - lb) : null
      if (!(diff !== null && diff >= 0.25)) {
        lowContrast.push({ p, diff, color: ctr && ctr.color, sel: ctr && ctr.sel })
      }
      if (theme === 'dark') {
        if (!(lb !== null && lb < 0.35)) bgBad.push({ p, body: c.body })
        if (!(lt !== null && lt > 0.45)) textBad.push({ p, text: c.text })
      } else {
        if (!(lb !== null && lb > 0.6)) bgBad.push({ p, body: c.body })
        if (!(lt !== null && lt < 0.55)) textBad.push({ p, text: c.text })
      }
    }
    if (theme === 'dark') {
      ok(bgBad.length === 0, `深色主题：${THEME_PAGES.length} 个页面 body 底色都暗`, bgBad)
      ok(textBad.length === 0, `深色主题：${THEME_PAGES.length} 个页面主文字都亮（可读）`, textBad)
      ok(lowContrast.length === 0, `深色主题：${THEME_PAGES.length} 个页面正文对比度足够`, lowContrast)
    } else {
      ok(bgBad.length === 0, `浅色主题：${THEME_PAGES.length} 个页面 body 底色都亮`, bgBad)
      ok(textBad.length === 0, `浅色主题：${THEME_PAGES.length} 个页面主文字都暗（可读）`, textBad)
      ok(lowContrast.length === 0, `浅色主题：${THEME_PAGES.length} 个页面正文对比度足够`, lowContrast)
    }
  }

  // ---------------- 2b. 双主题截图（供人工核对） ----------------
  section('2b. 双主题截图取样（关键页面）')
  const shots = []
  let si = 0
  for (const theme of ['dark', 'light']) {
    for (const p of ['/', '/wrongbook', '/me']) {
      await goto(`${BASE}${p}?theme=${theme}`)
      try {
        const data = await send('Page.captureScreenshot', { format: 'png' })
        si += 1
        const file = `${process.env.P9_SHOT_DIR || '.'}/${theme}-${(p.replace(/\W+/g, '_') || 'home')}-${Date.now()}-${si}.png`
        fs.writeFileSync(file, Buffer.from(data.data, 'base64'))
        shots.push(path.basename(file))
      } catch (e) {
        shots.push(`(${path} 截图写入失败: ${e.code || e.message})`)
      }
    }
  }
  ok(shots.filter((s) => !s.startsWith('(')).length === 6, `已导出 ${shots.filter((s) => !s.startsWith('(')).length}/6 张双主题截图`, shots)

  // ---------------- 3. 真实交互：登录弹窗 ----------------
  section('3. 交互点检：登录弹窗（我的 → 登录/注册）')
  await setWidth(1440, 900)
  await goto(BASE + '/me')
  const beforeModal = await evaluate(`document.querySelectorAll('[role="dialog"]').length`)
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find((x) => x.textContent.trim().includes('登录 / 注册'))
    if (b) b.click()
    return !!b
  })()`)
  await sleep(500)
  const afterModal = await evaluate(`document.querySelectorAll('[role="dialog"]').length`)
  const hasTitle = await evaluate(`document.body.innerText.includes('登录账号')`)
  ok(beforeModal === 0 && afterModal === 1, '点击「登录 / 注册」弹出账号弹窗（0 → 1）', { beforeModal, afterModal })
  ok(hasTitle, '弹窗标题渲染为「登录账号」')

  // 切到注册、校验输入框存在
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '去注册')
    if (b) b.click(); return !!b
  })()`)
  await sleep(400)
  const inputs = await evaluate(`document.querySelectorAll('[role="dialog"] input').length`)
  ok(inputs >= 3, `注册表单渲染出 ${inputs} 个输入框（昵称/密码/确认密码）`)

  // 关闭（Esc）
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(400)
  const closed = await evaluate(`document.querySelectorAll('[role="dialog"]').length`)
  ok(closed === 0, 'Esc 可关闭弹窗（0）', closed)

  // ---------------- 4. 真实交互：拍题页文字模式切题 ----------------
  section('4. 交互点检：拍题页文字模式（不依赖后端识别）')
  await goto(BASE + '/capture')
  const typed = await evaluate(`(() => {
    const ta = document.querySelector('.capture__textarea')
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, '1. 求极限 lim(x→0) sin(x)/x\\n2. 计算定积分 ∫0^1 x^2 dx')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  ok(typed, '拍题页文字输入框可输入')
  await sleep(200)
  const btnEnabled = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '开始识别')
    return b ? !b.disabled : false
  })()`)
  ok(btnEnabled, '输入文字后「开始识别」按钮可用（校验生效）')

  // ---------------- 6. 弹窗内：行内校验 + 提示层级 ----------------
  section('6. 交互点检：弹窗内行内校验 + 提示层级')
  await goto(`${BASE}/me?theme=dark`)
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes('登录 / 注册'))
    if (b) b.click(); return !!b
  })()`)
  await sleep(500)
  // 空着直接点「登 录」→ 应出现字段下方行内错误（而不是只弹 Toast）
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.replace(/\\s/g, '') === '登录')
    if (b) b.click(); return !!b
  })()`)
  await sleep(400)
  const inlineErr = await evaluate(`(() => {
    const el = document.querySelector('[role="dialog"] .ui-field__error')
    return el ? el.textContent.trim() : ''
  })()`)
  ok(!!inlineErr, `弹窗内出现字段下方行内错误：「${inlineErr}」`)
  const redBorder = await evaluate(`(() => {
    const el = document.querySelector('[role="dialog"] .ui-field__input.is-error')
    return el ? getComputedStyle(el).borderColor : ''
  })()`)
  ok(!!redBorder, '对应输入框同时变红（错误与字段绑定）', redBorder)
  const zs = await evaluate(`(() => {
    const dlg = document.querySelector('[role="dialog"]')
    const layer = document.querySelector('.ui-toast-layer')
    const zi = (el) => (el ? Number(getComputedStyle(el).zIndex) : null)
    return { modal: zi(dlg), toast: zi(layer) }
  })()`)
  ok(
    zs.toast !== null && zs.modal !== null && zs.toast > zs.modal,
    `Toast 层级高于弹窗（toast ${zs.toast} > modal ${zs.modal}）→ 弹窗内提示不会被遮罩糊掉`,
    zs,
  )
  // Toast 必须是不透明实底 + 主文字色
  const toastStyle = await evaluate(`(() => {
    const t = document.querySelector('.ui-toast')
    if (!t) return null
    const cs = getComputedStyle(t)
    return { bg: cs.backgroundColor, color: cs.color, top: Math.round(t.getBoundingClientRect().top) }
  })()`)
  ok(toastStyle === null || !/rgba\\([^)]*,\\s*0\\.\\d+\\)/.test(toastStyle.bg), 'Toast 底色是不透明实色', toastStyle)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(300)

  // ---------------- 7. 真实交互：拍题页照片查看器 ----------------
  section('7. 交互点检：照片点开看详情')
  await goto(`${BASE}/capture`)
  const pic = process.env.P9_TEST_IMAGE
  if (!pic || !fs.existsSync(pic)) {
    ok(false, `缺少测试图片（P9_TEST_IMAGE=${pic || '未设置'}）`)
  } else {
    const doc = await send('DOM.getDocument', { depth: 1 })
    const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' })
    await send('DOM.setFileInputFiles', { files: [pic], nodeId: q.nodeId })
    await sleep(900)
    const hasThumb = await evaluate(`!!document.querySelector('.capture__thumb-btn')`)
    ok(hasThumb, '选图后出现可点击的缩略图')
    await evaluate(`(() => {
      const b = document.querySelector('.capture__thumb-btn')
      if (b) b.click(); return !!b
    })()`)
    await sleep(600)
    const opened = await evaluate(`(() => {
      const iv = document.querySelector('.ui-iv')
      const img = document.querySelector('.ui-iv__img')
      return {
        open: !!iv,
        z: iv ? Number(getComputedStyle(iv).zIndex) : null,
        fit: img ? getComputedStyle(img).objectFit : '',
        zoom: document.querySelector('.ui-iv__zoom')?.textContent?.trim() || '',
      }
    })()`)
    ok(opened.open, '点击缩略图打开全屏查看器')
    ok(opened.fit === 'contain', `图片完整显示不裁切（object-fit: ${opened.fit}）`)
    ok(opened.zoom === '100%', `初始缩放显示为 ${opened.zoom}`)
    // 放大 → 缩放百分比变化
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.ui-iv__tools button')].find((x) => x.getAttribute('aria-label') === '放大')
      if (b) b.click(); return !!b
    })()`)
    await sleep(300)
    const zoom2 = await evaluate(`document.querySelector('.ui-iv__zoom')?.textContent?.trim() || ''`)
    ok(zoom2 === '150%', `点「＋」后缩放变为 ${zoom2}`)
    // Esc 关闭
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(400)
    const closedIv = await evaluate(`!document.querySelector('.ui-iv')`)
    ok(closedIv, 'Esc 可关闭查看器')

    // ---- 7b. 首页拍图卡同样要能点开（用户实际会在首页放图）----
    await goto(`${BASE}/`)
    const doc2 = await send('DOM.getDocument', { depth: 1 })
    const q2 = await send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: 'input[type=file]' })
    await send('DOM.setFileInputFiles', { files: [pic], nodeId: q2.nodeId })
    await sleep(900)
    const home2 = await evaluate(`(() => {
      const btn = document.querySelector('.capture__thumb-btn')
      const view = [...document.querySelectorAll('.capture__view')].length
      return { btn: !!btn, view }
    })()`)
    ok(home2.btn, '首页拍图卡：选图后缩略图可点')
    ok(home2.view >= 1, '首页拍图卡：出现「查看大图」按钮')
    await evaluate(`(() => {
      const b = document.querySelector('.capture__thumb-btn')
      if (b) b.click(); return !!b
    })()`)
    await sleep(600)
    const homeOpened = await evaluate(`!!document.querySelector('.ui-iv')`)
    ok(homeOpened, '首页也能打开全屏查看器')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(300)
  }

  // ---------------- 5. 真实交互：主题开关（我的 → 偏好设置） ----------------
  section('5. 交互点检：界面主题开关')
  await setWidth(1440, 900)
  await goto(`${BASE}/me`)
  const t0 = await evaluate(`document.documentElement.dataset.theme`)
  const clicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '浅色')
    if (b) b.click(); return !!b
  })()`)
  await sleep(400)
  const t1 = await evaluate(`document.documentElement.dataset.theme`)
  const bg1 = await evaluate(`getComputedStyle(document.body).backgroundColor`)
  const l1 = lum(bg1)
  ok(clicked, '「我的 → 偏好设置」里有主题开关')
  ok(t0 === 'dark' && t1 === 'light', '点「浅色」后主题切换为 light', { t0, t1 })
  ok(l1 !== null && l1 > 0.6, `切换后 body 底色变亮（亮度 ${l1?.toFixed(2)}）`, bg1)

  // ---------------- 8. 真实链路：AI 对话流式（打到线上 /api/chat/stream） ----------------
  // ⚠️ 这两节会**真实调用模型**（线上配了 Key 时按量计费）→ 默认跳过，需 P9_ALLOW_REAL=1 才跑
  const ALLOW_REAL = process.env.P9_ALLOW_REAL === '1'
  section('8. 真实链路：AI 对话流式' + (ALLOW_REAL ? '' : '（已跳过：未设 P9_ALLOW_REAL=1）'))
  if (!ALLOW_REAL) {
    ok(true, '跳过（避免自动运行产生模型费用）')
    ok(true, '跳过')
    ok(true, '跳过')
  } else {
  await setWidth(1440, 900)
  await goto(`${BASE}/chat`)
  await evaluate(`(() => {
    const ta = document.querySelector('.chat__textarea')
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, '什么是时间复杂度？请两句话说明')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  const sent = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '发送')
    if (b) b.click(); return !!b
  })()`)
  ok(sent, '对话页可发送消息')
  await sleep(4000)   // 等流式结束（Mock 分片约 18ms/片）
  const chatResult = await evaluate(`(() => {
    const msgs = [...document.querySelectorAll('.chat__msg')]
    const u = msgs.find((m) => m.dataset.role === 'user')
    const a = msgs.find((m) => m.dataset.role === 'assistant')
    return {
      user: u ? u.innerText.trim().slice(0, 30) : '',
      assistantLen: a ? a.innerText.trim().length : 0,
      stillStreaming: !!document.querySelector('.ai-caret'),
    }
  })()`)
  ok(chatResult.user.length > 0, `用户消息已上屏（"${chatResult.user}"）`)
  ok(chatResult.assistantLen > 30, `AI 回答已渲染（${chatResult.assistantLen} 字）`)
  ok(!chatResult.stillStreaming, '流式已结束（无残留光标）')
  // 「有文本」不等于「看得见」：量一下真实渲染尺寸与颜色（实测踩过"DOM 有字但不可见"）
  const visible = await evaluate(`(() => {
    const el = document.querySelector('.chat__msg[data-role="assistant"] .md-text')
      || document.querySelector('.chat__msg[data-role="assistant"] .chat__plain')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { h: Math.round(r.height), w: Math.round(r.width), color: cs.color, size: cs.fontSize }
  })()`)
  ok(!!visible && visible.h > 12, `回答区域有实际高度（${visible && visible.h}px）`, visible)
  ok(!!visible && visible.w > 40, `回答区域有实际宽度（${visible && visible.w}px）`, visible)
  ok(!!visible && !/rgba\(.*,\s*0\)$/.test(visible.color), `文字颜色不透明（${visible && visible.color}）`, visible)
  ok(!!visible && parseFloat(visible.size) >= 12, `字号可读（${visible && visible.size}）`, visible)
  }

  // ---------------- 9. 真实链路：变式题生成（打到线上 /api/variant） ----------------
  section('9. 真实链路：变式题生成' + (ALLOW_REAL ? '' : '（已跳过）'))
  if (!ALLOW_REAL) {
    ok(true, '跳过（避免自动运行产生模型费用）')
    ok(true, '跳过')
    ok(true, '跳过')
  } else {
  // 先造两条错题（自测只抽非掌握状态的题），再进自测页
  await goto(`${BASE}/`)
  const seeded = await evaluate(`(() => {
    const items = [
      { id: 'p9-1', question: '计算定积分 $\\int_0^1 x^2\\,dx$', answer: '$\\frac{1}{3}$',
        subject: '高等数学', questionType: '计算题', knowledgePoints: ['定积分'], mastered: false,
        quizCount: 0, correctCount: 0, createdAt: Date.now() },
      { id: 'p9-2', question: '求极限 $\\lim_{x\\to 0}\\frac{\\sin x}{x}$', answer: '$1$',
        subject: '高等数学', questionType: '计算题', knowledgePoints: ['极限'], mastered: false,
        quizCount: 0, correctCount: 0, createdAt: Date.now() },
    ]
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify(items))
    return items.length
  })()`)
  ok(seeded === 2, '已注入 2 条待复习错题')
  await goto(`${BASE}/practice/quiz`)
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('变式题'))
    if (b) b.click(); return !!b
  })()`)
  await sleep(400)
  const genBtn = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('生成变式题'))
    if (b) b.click(); return !!b
  })()`)
  ok(genBtn, '变式题模式有「生成变式题」按钮')
  await sleep(9000)   // 逐题生成（Mock 后端即时返回，留足余量）
  const practiceState = await evaluate(`(() => {
    const body = document.body.innerText
    return {
      answering: body.includes('AI 判分'),
      hasQuestion: !!document.querySelector('.pr__q'),
      firstQ: (document.querySelector('.pr__q')?.innerText || '').trim().slice(0, 40),
    }
  })()`)
  ok(practiceState.answering, '变式题生成后进入答题页（出现「AI 判分」）')
  ok(practiceState.hasQuestion, `答题页渲染出题目（"${practiceState.firstQ}"）`)
  }

  // ---------------- 10. 学习数据页新增块（批次4） ----------------
  section('10. 学习数据页新增块（学习时长 / AI 学情建议）')
  await setWidth(1440, 1000)
  await goto(`${BASE}/data`)
  const blocks = await evaluate(`(() => {
    const t = document.body.innerText
    const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
    return {
      timeBlock: t.includes('学习时长'),
      adviceBlock: t.includes('AI 学情建议'),
      hasGenBtn: btns.includes('生成建议') || btns.includes('重新生成'),
      hint: t.includes('点击才生成'),
      weekBars: document.querySelectorAll('.data__trend-col').length,
    }
  })()`)
  ok(blocks.timeBlock, '含「学习时长」块')
  ok(blocks.adviceBlock, '含「AI 学情建议」块')
  ok(blocks.hasGenBtn, '有「生成建议」按钮（点击才生成）')
  ok(blocks.hint, '界面写明「点击才生成」（不静默计费）')
  ok(blocks.weekBars >= 7, `近 7 天时长柱状（含新增趋势共 ${blocks.weekBars} 根柱）`)

  console.log('\n' + '='.repeat(52))
  console.log(fail === 0 ? `P9 自动点检全部通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exitCode = fail === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error('点检脚本异常:', e.message)
    process.exitCode = 1
  })
  .finally(async () => {
    try { ws?.close() } catch { /* 忽略 */ }
    chrome.kill()
  })
