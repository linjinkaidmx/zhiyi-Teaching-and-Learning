/**
 * 双击返回键退出 · 真机行为验证（离线自包含：本地 vite preview + CDP）
 * 用法：node _qa_exitguard.mjs [outDir]
 * 说明：浏览器没有「返回键」的 CDP 按键，history.back() 与之等价。
 *       「真正退出」会把页面导航走，故放在最后一节。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9496
const OUTDIR = process.argv[2] || 'dist61'
const WEBPORT = 5300 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: 'ignore',
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

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
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

const state = () =>
  ev(`(() => ({
    path: location.pathname,
    len: history.length,
    toast: (document.body.textContent || '').includes('再按一次退出知一'),
    bye: !!document.querySelector('.zy-bye'),
  }))()`)

async function openHome(width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 900, deviceScaleFactor: width < 768 ? 2 : 1, mobile: width < 768 })
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel(width < 768 ? '.ui-bottomnav' : '.home__body')
  await sleep(600)
}

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_exit_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch('http://127.0.0.1:' + PORT + '/json/version')).ok) break } catch { /* retry */ }
    await sleep(250)
  }
  const t = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(m.error.message))
      else p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')

  section('1. 从首页进子页再返回：应正常回首页，不提示退出')
  await openHome(390)
  await ev(`document.querySelectorAll('.ui-bottomnav__item')[4].click()`)
  await sleep(900)
  const atMore = await state()
  ok(atMore.path === '/more', '已进入更多页', atMore)
  await ev(`history.back()`)
  await sleep(900)
  const backHome = await state()
  ok(backHome.path === '/', '返回键回到首页', backHome)
  ok(backHome.toast === false, '此时不弹「再按一次退出」', backHome)

  section('2. 首页第一次返回：留在首页 + 提示')
  await ev(`history.back()`)
  await sleep(500)
  const first = await state()
  ok(first.path === '/', '仍在首页（没有跳回上一个页面）', first)
  ok(first.toast === true, '提示「再按一次退出知一」', first)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'mobile-exit-toast.png'), Buffer.from(shot.data, 'base64'))

  section('3. 间隔超时后：重新计数（不算双击）')
  await openHome(390)
  await ev(`history.back()`)
  await sleep(2600)
  await ev(`history.back()`)
  await sleep(500)
  const slow = await state()
  ok(slow.path === '/', '间隔超过 2s 后仍留在首页（未误触发退出）', slow)

  section('4. 桌面不启用（返回键仍是普通后退）')
  await openHome(1440)
  await ev(`history.back()`)
  await sleep(500)
  const desk = await state()
  ok(desk.toast === false, '桌面按返回不出现退出提示', desk)

  section('5. 2 秒内第二次返回：真正退出')
  await openHome(390)
  await ev(`history.back()`)
  await sleep(400)
  await ev(`history.back()`)
  await sleep(1600)
  let second
  try {
    second = await state()
  } catch {
    second = { navigatedAway: true }
  }
  ok(second.navigatedAway || second.path !== '/' || second.bye === true, '已离开首页（退出站点或显示「已退出」）', second)

  section('6. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '双击退出验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
