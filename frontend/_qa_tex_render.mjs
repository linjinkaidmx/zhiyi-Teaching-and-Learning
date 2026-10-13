/**
 * 验证：拍题页题面按教材式排版渲染（真分数线），且手动输入时有预览。
 * 用法：node _qa_tex_render.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9780 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const IMG = 'D:\\Document\\xwechat_files\\wxid_3yz9ktfbw74r22_d1e5\\temp\\RWTemp\\2026-09\\9e20f478899dc29eb19741386f9343c8\\0fa972404d09c57227bfca124b7ccfb5.jpg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(700) }
  console.log('  · timeout: ' + label); return false
}
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_tex_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zhiyi_setup_dismissed','1') } catch(e) {}` })
  await send('Page.navigate', { url: BASE + '/capture' })
  await waitFor(`!!document.querySelector('.zy-page')`, 25000, '页面加载')
  await sleep(1500)

  // ① 上传态：手动输入 LaTeX → 预览应渲染成公式
  await ev(`(() => { const b=document.querySelector('.capture__text-toggle'); if(b) b.click(); return true })()`)
  await sleep(800)
  await ev(`(() => { const ta=document.querySelector('.capture__textarea'); if(!ta) return 'no-ta'; const d=Object.getOwnPropertyDescriptor(ta.constructor.prototype,'value').set; d.call(ta, ${JSON.stringify('测试 (1) $\\oint_{l} \\frac{\\mathrm{d}z}{(z-a)(z-b)}$，$l$ 是包围 $a$、$b$ 两点的围线；')}); ta.dispatchEvent(new Event('input',{bubbles:true})); return 'ok' })()`)
  await sleep(1200)
  const pv = await ev(`(() => { const p=document.querySelector('.capture__preview-tex'); return p ? { shown:true, katex:p.querySelectorAll('.katex').length, frac:p.querySelectorAll('.katex .frac-line, .katex .frac, .katex .mfrac').length } : { shown:false } })()`)
  ok(pv.shown && pv.katex >= 2 && pv.frac >= 1, '① 手动输入 LaTeX 有教材式预览（真分数线）', pv)
  await shot('tex_preview.png')

  if (process.env.QA_PREVIEW_ONLY === '1') {
    console.log(`
结果：通过 ${pass}，失败 ${fail}`); console.log('截图目录: ' + OUT); chrome.kill(); process.exit(fail > 0 ? 1 : 0)
  }
  // ② 真实识别原图 → 列表卡片应渲染公式
  const doc = await send('DOM.getDocument', { depth: 0 })
  const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file][accept="image/*"]' })
  await send('DOM.setFileInputFiles', { files: [IMG], nodeId: node.nodeId })
  await sleep(2500)
  const started = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('识别整图')||x.textContent.includes('开始识别')); if(b){b.click(); return b.textContent.trim()} return false })()`)
  console.log('  点击：', started)
  if (!await waitFor(`document.querySelectorAll('.capture__card-text').length > 0`, 90000, '识别结果列表')) {
    await shot('tex_fail.png'); chrome.kill(); process.exit(1)
  }
  await sleep(2500)
  const res = await ev(`(() => {
    const cards=[...document.querySelectorAll('.capture__card-text')]
    return {
      cards: cards.length,
      katex: document.querySelectorAll('.capture__card-text .katex').length,
      frac: document.querySelectorAll('.capture__card-text .katex .mfrac, .capture__card-text .katex .frac-line').length,
      bare: cards.map(c=>c.innerText).filter(t=>/\\$[^$\\n]|\\\\frac|\\\\oint/.test(t)).length
    }
  })()`)
  ok(res.cards > 0, '② 识别到题目卡', res.cards)
  ok(res.katex >= 2, '③ 题面渲染为 KaTeX', res.katex)
  ok(res.frac >= 2, '④ 含真分数线结构', res.frac)
  ok(res.bare === 0, '⑤ 无 LaTeX 源码残留', res.bare)
  await shot('tex_list.png')

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图目录: ' + OUT)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
