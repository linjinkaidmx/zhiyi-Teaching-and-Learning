/**
 * 移动端前三页改版验证（离线自包含：本地起 vite preview + CDP 真机视口）
 * 用法：node _qa_mobile3.mjs
 * 覆盖：容器边距 / 首页层级 / 拍题页入口 / 底部导航 / 桌面回归
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUTDIR = process.argv[2] || 'dist57'
const REMOTE = process.env.QA_BASE || ''
const PORT = 9495
/* 端口随机化：上一轮若 preview 进程没退干净，会复用旧服务导致测到旧产物 */
const WEBPORT = 5200 + (process.pid % 300)
const WEB = `http://127.0.0.1:${WEBPORT}`
const BASE = REMOTE || WEB
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = REMOTE
  ? null
  : spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
process.on('exit', () => { try { preview.kill() } catch { /* noop */ } })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const f = path.join(OUT, name)
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'))
  return f
}

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value


async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(`!!document.querySelector('${sel}')`)) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

async function main() {
  if (!REMOTE) {
    for (let i = 0; i < 60; i += 1) {
      try { if ((await fetch(BASE + '/')).ok) break } catch { /* retry */ }
      await sleep(400)
    }
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(os.tmpdir(), 'qa_m3_' + process.pid)}`, 'about:blank'], { stdio: 'ignore' })
  process.on('exit', () => { try { chrome.kill() } catch { /* noop */ } })

  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* retry */ }
    await sleep(250)
  }
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')

  /* ---------- 移动端 390×844 ---------- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  section('1. 移动端底座：容器边距')
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.capture__channels')
  const dbg = await ev(`(() => {
    const el = document.querySelector('.zy-page')
    const s = el && getComputedStyle(el)
    return {
      innerWidth: window.innerWidth,
      mq767: window.matchMedia('(max-width: 767px)').matches,
      cls: el ? el.className : null,
      padLeft: s ? s.paddingLeft : null,
      padTop: s ? s.paddingTop : null,
      containerPadVar: s ? s.getPropertyValue('--container-pad') : null,
      rectWidth: el ? Math.round(el.getBoundingClientRect().width) : 0,
    }
  })()`)
  console.log('  · 诊断 → ' + JSON.stringify(dbg))
  const rules = await ev(`(() => {
    const out = []
    const walk = (rules, media) => {
      for (const r of rules) {
        if (r.media) { walk(r.cssRules, r.media.mediaText); continue }
        if (!r.selectorText) continue
        if (!/\\.zy-page|\\.home\\b/.test(r.selectorText)) continue
        if (!/padding/.test(r.cssText)) continue
        out.push({ sel: r.selectorText, media: media || '', css: r.cssText.slice(0, 120) })
      }
    }
    for (const sh of document.styleSheets) { try { walk(sh.cssRules, '') } catch { /* cross-origin */ } }
    return out
  })()`)
  console.log('  · 命中 padding 的规则 → ' + JSON.stringify(rules, null, 1))
  const pad = await ev(`(() => { const c = document.querySelector('.zy-page'); const s = c && getComputedStyle(c); return s ? { left: s.paddingLeft, right: s.paddingRight, width: Math.round(c.getBoundingClientRect().width) } : null })()`)
  ok(pad && pad.left === '16px' && pad.right === '16px', '页面容器左右边距收到 16px', pad)
  ok(pad && pad.width === 390, '页面容器满宽，内容区 = 390 - 32', pad && pad.width)

  section('2. 移动端首页：拍题为主')
  const home = await ev(`(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => { if (!el) return null; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' }
    const cam = q('.capture__channel--camera')
    const alb = q('.capture__channel--album')
    const drag = q('.capture__channel--drag')
    const startBtn = q('.capture__actions .ui-btn')
    const btns = [...document.querySelectorAll('.capture__actions .ui-btn')]
    return {
      cameraText: cam ? cam.textContent.trim() : null,
      cameraVisible: vis(cam),
      cameraBg: cam ? getComputedStyle(cam).backgroundColor : null,
      cameraWidth: cam ? Math.round(cam.getBoundingClientRect().width) : 0,
      albumVisible: vis(alb),
      dragVisible: vis(drag),
      startHidden: startBtn ? getComputedStyle(startBtn).display === 'none' : null,
      actionCount: btns.length,
      actionLabels: btns.map((b) => b.textContent.trim()),
      heroWidth: Math.round((q('.capture') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
      subHidden: q('.home__sub') ? getComputedStyle(q('.home__sub')).display === 'none' : null,
    }
  })()`)
  ok(home.cameraVisible, '拍照入口可见')
  ok(home.cameraText === '拍照解题', '拍照入口文案 = 拍照解题', home.cameraText)
  ok(home.cameraBg && home.cameraBg !== 'rgba(0, 0, 0, 0)', '拍照入口是主按钮（有实底）', home.cameraBg)
  ok(home.cameraWidth >= home.heroWidth - 40, '拍照按钮接近全宽（block 主 CTA）', { camera: home.cameraWidth, hero: home.heroWidth })
  ok(home.albumVisible, '相册入口可见（次级）')
  ok(home.dragVisible === false, '拖拽入口在移动端隐藏')
  ok(home.startHidden === true, '未选图时「开始识别」不占禁用大按钮')
  ok(home.actionLabels.some((t) => t.includes('AI 对话')), 'AI 对话作为次级动作仍可点', home.actionLabels)
  ok(home.subHidden !== false, '欢迎副标题在移动端收起')
  console.log('  → 截图 ' + (await shot('mobile-home.png')))

  section('3. 移动端首页：课表默认不出现')
  const sched = await ev(`(() => {
    const el = document.querySelector('.schedule')
    if (!el) return { exists: false }
    return { exists: true, display: getComputedStyle(el).display }
  })()`)
  ok(sched.exists === false || sched.display === 'none', '今日课程卡在移动端不显示', sched)

  section('4. 移动端拍题页')
  await send('Page.navigate', { url: BASE + '/capture' })
  await waitSel('.capture__channels')
  const cap = await ev(`(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => { if (!el) return null; return getComputedStyle(el).display !== 'none' }
    const cam = q('.capture__channel--camera')
    const drag = q('.capture__channel--drag')
    return {
      cameraVisible: vis(cam),
      cameraWidth: cam ? Math.round(cam.getBoundingClientRect().width) : 0,
      dropWidth: q('.capture__drop') ? Math.round(q('.capture__drop').getBoundingClientRect().width) : 0,
      dragVisible: vis(drag),
      hintVisible: vis(q('.capture__hint')),
      textareaVisible: vis(q('.capture__textarea')),
      toggleVisible: vis(q('.capture__text-toggle')),
      toggleText: q('.capture__text-toggle') ? q('.capture__text-toggle').textContent.trim() : null,
    }
  })()`)
  ok(cap.cameraVisible, '拍题页拍照入口可见')
  ok(cap.cameraWidth >= cap.dropWidth - 40, '拍题页拍照按钮接近全宽', { camera: cap.cameraWidth, drop: cap.dropWidth })
  ok(cap.dragVisible === false, '拍题页拖拽入口隐藏')
  ok(cap.hintVisible === false, '拖拽提示文案隐藏')
  ok(cap.toggleVisible === true, '「手动输入题目文字」折叠开关出现', cap.toggleText)
  ok(cap.textareaVisible === false, '文本框默认折叠')
  console.log('  → 截图 ' + (await shot('mobile-capture.png')))

  const opened = await ev(`(() => { document.querySelector('.capture__text-toggle').click(); return true })()`)
  await sleep(400)
  const cap2 = await ev(`(() => ({ textareaVisible: getComputedStyle(document.querySelector('.capture__textarea')).display !== 'none' }))()`)
  ok(opened && cap2.textareaVisible === true, '点开关后文本框展开')

  section('5. 底部导航')
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.ui-bottomnav')
  const nav = await ev(`(() => {
    const items = [...document.querySelectorAll('.ui-bottomnav__item')]
    const primary = document.querySelector('.ui-bottomnav__item.is-primary')
    const active = document.querySelector('.ui-bottomnav__item[aria-current="page"]')
    return {
      count: items.length,
      labels: items.map((i) => i.textContent.trim()),
      primaryLabel: primary ? primary.textContent.trim() : null,
      iconBg: primary ? getComputedStyle(primary.querySelector('.ui-bottomnav__icon')).backgroundColor : null,
      activeLabel: active ? active.textContent.trim() : null,
      navHeight: Math.round((document.querySelector('.ui-bottomnav') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height),
    }
  })()`)
  ok(nav.count === 5, '底部导航 5 项', nav.labels)
  ok(nav.primaryLabel === '拍题', '拍题项标记为主路径', nav.primaryLabel)
  ok(nav.iconBg && nav.iconBg !== 'rgba(0, 0, 0, 0)', '拍题项图标有淡紫圆底', nav.iconBg)
  ok(nav.activeLabel === '首页', '首页选中态正确', nav.activeLabel)

  /* ---------- 桌面回归 1440 ---------- */
  section('6. 桌面回归（1440×900，确认未受影响）')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.capture__channels')
  const desk = await ev(`(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => { if (!el) return null; return getComputedStyle(el).display !== 'none' }
    const c = q('.zy-container')
    return {
      padLeft: c ? getComputedStyle(c).paddingLeft : null,
      dragVisible: vis(q('.capture__channel--drag')),
      subVisible: vis(q('.home__sub')),
      sideTitleVisible: vis(q('.home__side-title')),
      bottomNavVisible: vis(q('.ui-bottomnav')),
      heroCols: q('.home__hero') ? getComputedStyle(q('.home__hero')).gridTemplateColumns : null,
    }
  })()`)
  const deskPad = await ev(`(() => { const c = document.querySelector('.zy-page'); return c ? getComputedStyle(c).paddingLeft : null })()`)
  console.log('  · 桌面页面容器左右 padding（既有值，本次不应改变）→ ' + deskPad)
  ok(deskPad === '0px', '桌面页面容器左右 padding 未受本次改动影响', deskPad)
  ok(desk.dragVisible !== false, '桌面保留拖拽入口')
  ok(desk.sideTitleVisible !== true, '桌面不显示「今日学习」合并标题', desk.sideTitleVisible)
  ok(desk.bottomNavVisible === false, '桌面不显示底部导航')
  ok(desk.heroCols && desk.heroCols.split(' ').length === 2, '桌面 Hero 仍是两栏', desk.heroCols)
  console.log('  → 截图 ' + (await shot('desktop-home.png')))

  await send('Page.navigate', { url: BASE + '/capture' })
  await waitSel('.capture__channels')
  const deskCap = await ev(`(() => {
    const q = (s) => document.querySelector(s)
    const vis = (el) => { if (!el) return null; return getComputedStyle(el).display !== 'none' }
    return {
      textareaVisible: vis(q('.capture__textarea')),
      toggleVisible: vis(q('.capture__text-toggle')),
      dragVisible: vis(q('.capture__channel--drag')),
      channelsRow: q('.capture__channels') ? getComputedStyle(q('.capture__channels')).flexDirection : null,
    }
  })()`)
  ok(deskCap.textareaVisible === true, '桌面文本框常驻展开')
  ok(deskCap.toggleVisible === false, '桌面不显示折叠开关')
  ok(deskCap.dragVisible === true, '桌面保留拖拽入口')
  ok(deskCap.channelsRow === 'row', '桌面入口仍是横向排列', deskCap.channelsRow)
  console.log('  → 截图 ' + (await shot('desktop-capture.png')))

  section('7. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? `移动端改版验证通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
