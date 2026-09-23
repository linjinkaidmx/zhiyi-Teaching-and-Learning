/**
 * 桌面端交互验证：错题本右侧详情面板 / 搜题 focus=text / Ctrl+K 全局搜题 / 侧栏跳转
 * 用法：node _qa_desktop_interact.mjs   （QA_DIST 默认 dist118）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DIST = process.env.QA_DIST || 'dist118'
const PORT = 9740 + (process.pid % 80)
const CDP = 9660 + (process.pid % 80)
const WEB = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(400) }
  console.log('  · timeout: ' + label); return false
}
const waitSel = (sel, t = 15000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }

const SEED = `try {
  localStorage.setItem('zhiyi_setup_dismissed','1')
  const q = (i, t, kp, due, extra) => Object.assign({ id:'s'+i, question:t, attempt:'', subject:'计算机', questionType:'简答', answer:'Θ(n log n)', steps:[{title:'比较 $f(n)$ 与 $n^{\\\\log_b a}$', detail:'同阶 → 第二类'},{title:'代入公式得紧确界', detail:'T(n) = Θ(n log n)'}], keyBreakthrough:'比较 f(n) 与 n^log_b a', knowledgePoints:[kp], knowledgeReview:'', extensions:[], diagnosis:'', followups:[], reteach:[], streak:1, quizCount:1, correctCount:1, mastered:false, reviewAt:Date.now()+due, interval:1, repetitions:1, courseId:'', source:'班级作业', createdAt:new Date().toISOString() }, extra || {})
  const book = [q(1,'用主定理求 T(n) = 2T(n/2) + O(n) 的时间复杂度','算法分析',0), q(2,'快速排序平均时间复杂度推导','排序',0), q(3,'栈与队列的区别（简答）','线性表',86400000)]
  localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify(book))
  localStorage.setItem('zhiyi_errorbook_account_v1', JSON.stringify(book))
} catch (e) {}`

async function main() {
  const prev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_it_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED })

  console.log('\n===== 桌面交互验证 =====')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.zy-page', 20000); await sleep(1600)

  // 1) 错题本：点击卡片 → 右侧常驻面板
  const clicked = await ev(`(() => { const c = document.querySelector('.wb__card'); if (!c) return false; c.click(); return true })()`)
  ok(clicked, '① 点击错题卡片')
  await waitSel('.wb__drawer', 8000)
  await sleep(900)
  const panel = await ev(`(() => {
    const d = document.querySelector('.wb__drawer')
    const m = document.querySelector('.wb__drawer-mask')
    const p = document.querySelector('.wb__drawer-panel')
    if (!d || !p) return null
    const cs = getComputedStyle(d); const rs = p.getBoundingClientRect()
    return {
      pos: cs.position, top: cs.top, left: cs.left,
      mask: m ? getComputedStyle(m).display : 'none',
      panelW: Math.round(rs.width), panelRight: Math.round(rs.right),
      bodyCls: (document.querySelector('.wb__body') || {}).className || ''
    }
  })()`)
  ok(!!panel && panel.pos === 'fixed', '② 详情为常驻面板（fixed）', panel && panel.pos)
  ok(!!panel && panel.mask === 'none', '③ 桌面端无遮罩层', panel && panel.mask)
  ok(!!panel && panel.panelW > 380, '④ 面板宽度合理', panel && panel.panelW)
  ok(!!panel && /is-detail-open/.test(panel.bodyCls), '⑤ 列表区让位（is-detail-open）', panel && panel.bodyCls)
  const stepKatex = await ev(`document.querySelectorAll('.wb__drawer .katex').length`)
  ok(stepKatex >= 2, '⑥ 详情内步骤标题公式已渲染', stepKatex)
  await shot('it_wrongbook_panel.png')

  // 2) Ctrl+K 全局搜题
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75 })
  await sleep(1500)
  const url1 = await ev('location.pathname + location.search')
  ok(/\/capture/.test(url1), '⑦ Ctrl+K 跳到拍题页', url1)
  const focused = await ev(`(() => { const a = document.activeElement; return a ? (a.className || a.tagName) : 'none' })()`)
  ok(/capture__textarea/.test(String(focused)), '⑧ 文本域自动聚焦', focused)
  await shot('it_capture_focus.png')

  // 3) 侧栏导航
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.zy-page', 20000); await sleep(1400)
  const navClick = await ev(`(() => { const items = [...document.querySelectorAll('.ui-sidenav__item')]; const target = items.find((x) => x.textContent.includes('错题学习')); if (!target) return 'not-found'; target.click(); return 'clicked' })()`)
  await sleep(1600)
  const url2 = await ev('location.pathname')
  ok(navClick === 'clicked' && url2 === '/wrongbook', '⑨ 侧栏跳转错题学习', url2)
  const onCount = await ev(`document.querySelectorAll('.ui-sidenav__item.is-on').length`)
  ok(onCount === 1, '⑩ 侧栏当前项唯一高亮', onCount)

  // 4) Hero 主 CTA
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.zy-page', 20000); await sleep(1400)
  await ev(`(() => { const b = document.querySelector('.home__hero-btn'); if (b) b.click(); return true })()`)
  await sleep(1500)
  const url3 = await ev('location.pathname')
  ok(/\/capture/.test(url3), '⑪ Hero「拍照搜题」跳转', url3)

  // 5) 顶部面包屑随页面变化
  await send('Page.navigate', { url: WEB + '/data' })
  await waitSel('.zy-page', 20000); await sleep(1300)
  const crumb = await ev(`(() => { const c = document.querySelector('.ui-topbar__crumb'); return c ? c.textContent.replace(/\\s+/g, ' ').trim() : 'none' })()`)
  ok(/学习数据/.test(String(crumb)), '⑫ 面包屑显示当前页', crumb)

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图目录: ' + OUT)
  chrome.kill(); prev.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
