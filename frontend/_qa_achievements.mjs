/**
 * 成就模块验证：殿堂页渲染 / 轻提示 toast / 全屏揭晓 / 移动端布局
 * 用法：node _qa_achievements.mjs   （QA_DIST 默认 dist127）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DIST = process.env.QA_DIST || 'dist127'
const PORT = 9860 + (process.pid % 60)
const CDP = 9760 + (process.pid % 60)
const WEB = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(400) } console.log('  · timeout: ' + l); return false }
const waitSel = (sel, t = 15000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

/* 注入：接近解锁的统计（algo 差 1 次到史诗）+ 已看 9 个算法（差 1 个到稀有） */
const STATS = {
  version: 1,
  days: { '2026-09-21': { count: 4, actions: { explain: 4 }, checked: true, goalMet: false, shield: false } },
  streak: { current: 2, longest: 2, lastCheckin: '2026-09-21', shields: 0, nextShieldIn: 5 },
  totals: {
    explain: 5, quiz: 2, practice: 1, correct: 2, followup: 1, reteach: 1, debug: 2, run: 3, ref: 2, export: 1, save: 0,
    masteredMax: 1, search: 5, bank: 3, multi: 0, exam: 1, algo: 49, hw: 1, note: 1, post: 0,
    course: 0, examPlan: 0, profile: 0, cls: 0, perfect: 0, stickyFix: 0, ontime: 0, hwPerfect: 0, examPerfect: 0, top3: 0,
    night: 0, comeback: 0,
  },
  achievements: { first_explain: { at: '2026-09-20T10:00:00.000Z' } },
  settings: { goalEnabled: false, goalQuestions: 5 },
  refSeen: ['calc'],
  algoSeen: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'],
  backfillDone: true,
}
const SEED = `(() => {
  try {
    localStorage.setItem('zhiyi_setup_dismissed', '1')
    const raw = ${JSON.stringify(JSON.stringify(STATS))}
    localStorage.setItem('zhiyi_stats_v1', raw)
    localStorage.setItem('zhiyi_stats_account_v1', raw)
  } catch (e) {}
  return true
})()`

async function main() {
  const prev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ach_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  console.log('\n===== ① 成就殿堂页 =====')
  await send('Page.navigate', { url: WEB + '/achievements' })
  await waitSel('.zy-page', 25000)
  await sleep(1800)
  const hall = await ev(`(() => {
    const cells = document.querySelectorAll('.ach__cell')
    const rar = document.querySelectorAll('.ach__sum')
    const groups = document.querySelectorAll('.ach__group')
    const locked = document.querySelectorAll('.ach__cell .bm.is-locked').length
    const badges = document.querySelectorAll('.ach__cell svg.bm').length
    const hidden = [...cells].filter((c) => c.textContent.includes('？？？')).length
    const empty = [...document.querySelectorAll('.ach__cell svg.bm')].filter((s) => s.querySelectorAll('path,rect,circle,line').length < 3).length
    return { cells: cells.length, rar: rar.length, groups: groups.length, locked, badges, hidden, empty,
      ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }
  })()`)
  console.log('  ·', JSON.stringify(hall))
  ok(hall.cells === 51, '殿堂展示 51 枚奖章', hall.cells)
  ok(hall.badges === 51 && hall.empty === 0, '每枚都渲染出奖章图形', { badges: hall.badges, emptyGraphic: hall.empty })
  ok(hall.rar === 4, '四档稀有度总览', hall.rar)
  ok(hall.groups === 8, '8 个功能域分组', hall.groups)
  ok(hall.hidden >= 2, '隐藏成就显示为 ？？？', hall.hidden)
  ok(hall.locked > 30, '未解锁奖章灰度显示', hall.locked)
  ok(!hall.ovf, '殿堂页无横向溢出')
  await shot('ach_hall.png')

  // 详情弹窗
  await ev(`(() => { const c = document.querySelector('.ach__cell'); if (c) c.click(); return true })()`)
  await sleep(900)
  const modal = await ev(`!!document.querySelector('.ach__detail') && !!document.querySelector('.ach__detail .bm')`)
  ok(modal, '点击奖章弹出详情（含大奖章）')
  await shot('ach_detail.png')
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '关闭' || x.getAttribute('aria-label') === '关闭'); if (b) b.click(); return true })()`)
  await sleep(600)

  console.log('\n===== ② 打开算法演示 → 同时触发稀有（轻提示）与史诗（全屏） =====')
  await send('Page.navigate', { url: WEB + '/tools?tool=algo' })
  await waitSel('.zy-page', 25000)
  await sleep(1500)
  const mounted = await ev(`!!document.querySelector('[class*=algo]')`)
  ok(mounted, '进入算法演示（工具页按 query 直达）')
  await sleep(2600)
  const dbg = await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_stats_v1') || '{}')
    return { algoTotals: (st.totals || {}).algo, algoSeen: (st.algoSeen || []).length, achCount: Object.keys(st.achievements || {}).length }
  })()`)
  console.log('  · 埋点后统计:', JSON.stringify(dbg))
  const celebrate = await ev(`(() => ({
    toast: document.querySelectorAll('.ach-toast').length,
    toastText: (document.querySelector('.ach-toast__name') || {}).textContent || '',
    toastBadge: document.querySelectorAll('.ach-toast .bm').length,
    reveal: document.querySelectorAll('.ach-reveal').length,
    revealName: (document.querySelector('.ach-reveal__name') || {}).textContent || '',
    revealRarity: (document.querySelector('.ach-reveal__rarity') || {}).textContent || '',
    revealMedal: document.querySelectorAll('.ach-reveal .bm').length,
  }))()`)
  console.log('  ·', JSON.stringify(celebrate))
  ok(celebrate.reveal === 1, '史诗成就弹出全屏揭晓', celebrate.reveal)
  ok(/可视化控/.test(celebrate.revealName), '揭晓的是「可视化控」', celebrate.revealName)
  ok(/史诗/.test(celebrate.revealRarity), '显示稀有度「史诗」', celebrate.revealRarity)
  ok(celebrate.revealMedal === 1, '揭晓里有奖章 SVG')
  ok(celebrate.toast >= 1, '普通/稀有成就同时显示顶部轻提示', celebrate.toast)
  ok(celebrate.toastBadge >= 1, '轻提示内含小奖章', celebrate.toastBadge)
  await shot('ach_reveal.png')
  // 验证自动收起（点「知道了」）
  await ev(`(() => { const b = [...document.querySelectorAll('.ach-reveal button')].find((x) => x.textContent.includes('知道了')); if (b) b.click(); return true })()`)
  await sleep(1200)
  const after = await ev(`document.querySelectorAll('.ach-reveal').length`)
  ok(after === 0, '点「知道了」后收起', after)

  console.log('\n===== ③ 移动端 390 =====')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: WEB + '/achievements' })
  await waitSel('.zy-page', 25000)
  await sleep(1600)
  const m = await ev(`(() => ({
    cells: document.querySelectorAll('.ach__cell').length,
    cols: getComputedStyle(document.querySelector('.ach__grid')).gridTemplateColumns.split(' ').length,
    ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }))()`)
  ok(m.cells === 51 && !m.ovf, '移动端殿堂页正常（无溢出）', m)
  await shot('ach_mobile.png')

  console.log('\n运行时错误:', JSON.stringify(errors.slice(0, 3)))
  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图目录: ' + OUT)
  chrome.kill(); prev.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
