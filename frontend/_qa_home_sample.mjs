/** 首页改版样图渲染自检 + 截图（临时）。用法：node _qa_home_sample.mjs */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE = 'file:///' + path.resolve(__dirname, '../docs/首页改版-2x2大卡-样图.html').replace(/\\/g, '/')
const CDP = 9960 + (process.pid % 50)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_hs_' + process.pid), '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FILE })
  await sleep(2200)

  const info = await ev(`(() => {
    const arts = [...document.querySelectorAll('.card__art')]
    // <use> 引用的图形在影子树里，查子节点必然为空：改为检查 use 是否真正渲染出尺寸（getBBox）
    const emptyArt = arts.filter((a) => { const u = a.querySelector('use'); if (!u) return true; try { const b = u.getBBox(); return b.width < 1 || b.height < 1 } catch { return true } }).length
    const c4 = document.querySelector('.cards--4')
    const c2 = document.querySelector('.cards--2')
    const lines = document.querySelectorAll('.sea__line').length
    const boats = document.querySelectorAll('.sea__boat').length
    const phones = document.querySelectorAll('.phone').length
    const icons = [...document.querySelectorAll('.quick__ico svg')]
    const emptyIco = icons.filter((i) => { const u = i.querySelector('use'); if (!u) return true; try { const b = u.getBBox(); return b.width < 1 || b.height < 1 } catch { return true } }).length
    return {
      phones, arts: arts.length, emptyArt,
      cols4: c4 ? getComputedStyle(c4).gridTemplateColumns.split(' ').length : 0,
      cols2: c2 ? getComputedStyle(c2).gridTemplateColumns.split(' ').length : 0,
      cardW: c2 ? Math.round(c2.querySelector('.card').getBoundingClientRect().width) : 0,
      cardH: c2 ? Math.round(c2.querySelector('.card').getBoundingClientRect().height) : 0,
      art2: c2 ? Math.round(c2.querySelector('.card__art').getBoundingClientRect().width) : 0,
      art4: c4 ? Math.round(c4.querySelector('.card__art').getBoundingClientRect().width) : 0,
      icons: icons.length, emptyIco,
      lines, boats,
      h: document.documentElement.scrollHeight,
    }
  })()`)
  console.log(JSON.stringify(info, null, 1))
  ok(info.phones === 5, '5 个手机画板（对比 2 + 首屏 + 背景 + 深色）', info.phones)
  ok(info.emptyArt === 0 && info.arts >= 20, '卡片图案全部渲染（真实素材）', { total: info.arts, empty: info.emptyArt })
  ok(info.cols4 === 4, '对比组左侧为一行 4 卡', info.cols4)
  ok(info.cols2 === 2, '新方案为 2×2', info.cols2)
  ok(info.art2 === 46 && info.art4 === 34, '图标尺寸 46（新）/ 34（现状）', { new: info.art2, old: info.art4 })
  ok(info.cardW > 150, '2×2 卡片宽度约 170', info.cardW)
  ok(info.cardH >= 110, '2×2 卡片高度约 118', info.cardH)
  ok(info.emptyIco === 0 && info.icons >= 15, '次入口图标全部渲染', { total: info.icons, empty: info.emptyIco })
  ok(info.boats >= 5 && info.lines >= 12, '每条画板都有小船与水线', { boats: info.boats, lines: info.lines })

  const secs = await ev(`[...document.querySelectorAll('.sec')].map((s) => { const r = s.getBoundingClientRect(); return { y: r.y + scrollY, h: r.height } })`)
  for (let i = 0; i < secs.length; i++) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: secs[i].y, width: 1280, height: Math.min(secs[i].h, 1600), scale: 1 } })
    fs.writeFileSync(path.join(OUT, `sec${i + 1}.png`), Buffer.from(r.data, 'base64'))
  }
  console.log('截图:', OUT, '共', secs.length, '张')
  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  chrome.kill(); process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
