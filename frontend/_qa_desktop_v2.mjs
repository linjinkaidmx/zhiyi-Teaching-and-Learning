/**
 * 桌面端改造 · 双形态视觉验证
 * ---------------------------------------------------------------------------
 * 用法：
 *   node _qa_desktop.mjs              # 桌面全部页面 + 移动抽查
 *   QA_ONLY=/capture node _qa_desktop.mjs
 * 依赖 dist116 已构建（vite preview）。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DIST = process.env.QA_DIST || 'dist116'
const PREVIEW_PORT = 9620 + (process.pid % 200)
const CDP_PORT = 9520 + (process.pid % 200)
const WEB = `http://127.0.0.1:${PREVIEW_PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })

const DESKTOP_PAGES = [
  ['/', 'home'], ['/capture', 'capture'], ['/wrongbook', 'wrongbook'],
  ['/class', 'class'], ['/records', 'records'], ['/data', 'data'],
  ['/community', 'community'], ['/timetable', 'timetable'], ['/tools', 'tools'], ['/me', 'mine'],
]
const MOBILE_PAGES = [['/', 'home'], ['/wrongbook', 'wrongbook'], ['/class', 'class']]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(400) }
  console.log('  · timeout: ' + label); return false
}
const waitSel = (sel, t = 20000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
}

async function main() {
  const prev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PREVIEW_PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }

  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_desk_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')

  // 预置：跳过首次引导 + 注入演示错题/记录，便于截图反映真实形态
  const seed = `(() => {
    try {
      localStorage.setItem('zhiyi_setup_dismissed', '1')
      const ITEMS = [
        { q: '用主定理求 T(n) = 2T(n/2) + O(n) 的时间复杂度', kp: '算法分析', src: '班级作业', streak: 1, due: 0 },
        { q: '快速排序平均时间复杂度推导', kp: '排序', src: '拍照搜题', streak: 1, due: 0 },
        { q: '栈与队列的区别（简答）', kp: '线性表', src: '班级作业', streak: 0, due: 86400000 },
        { q: '二阶常系数齐次微分方程通解', kp: '高等数学', src: '拍照搜题', streak: 1, due: 604800000 }
      ]
      const book = ITEMS.map((it, i) => ({
        id: 'seed' + i, question: it.q, attempt: '', subject: '计算机', questionType: '简答', answer: '—',
        steps: [], keyBreakthrough: '', knowledgePoints: [it.kp], knowledgeReview: '', extensions: [], diagnosis: '',
        followups: [], reteach: [], streak: it.streak, quizCount: it.streak, correctCount: it.streak, mastered: false,
        reviewAt: Date.now() + it.due, interval: 1, repetitions: it.streak, courseId: '', source: it.src,
        createdAt: new Date(Date.now() - 3600000 * (i + 2)).toISOString()
      }))
      localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify(book))
      localStorage.setItem('zhiyi_errorbook_account_v1', JSON.stringify(book))
      const recs = [
        { id: 'r1', type: 'explain', title: '用主定理求递归式时间复杂度，并给出 Python 实现', brief: '6 个步骤 · 1 次追问', createdAt: Date.now() - 720000, synced: false, correct: null, minutes: 8, questionId: '' },
        { id: 'r2', type: 'quiz', title: '错题自测：排序与查找（8 题）', brief: '正确 6 / 8', createdAt: Date.now() - 3600000, synced: false, correct: null, minutes: 12, questionId: '' },
        { id: 'r3', type: 'save', title: '栈与队列的区别（简答）', brief: '已存入错题本', createdAt: Date.now() - 86400000, synced: false, correct: null, minutes: 0, questionId: '' },
        { id: 'r4', type: 'followup', title: '为什么这里不能用主定理第一类情形？', brief: '追问 1 次', createdAt: Date.now() - 172800000, synced: false, correct: null, minutes: 3, questionId: '' }
      ]
      localStorage.setItem('zhiyi_records_v1', JSON.stringify(recs))
      localStorage.setItem('zhiyi_records_account_v1', JSON.stringify(recs))
    } catch (e) {}
    return true
  })()`
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed })

  const only = process.env.QA_ONLY

  // ---------------- 桌面 ----------------
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  console.log('\n===== 桌面 1440×900 =====')
  for (const [url, name] of DESKTOP_PAGES) {
    if (only && url !== only) continue
    errors.length = 0
    await send('Page.navigate', { url: WEB + url })
    await waitSel('.zy-page', 20000)
    await sleep(1500)
    const chk = await ev(`(() => {
      const side = document.querySelector('.ui-sidenav')
      const bar = document.querySelector('.ui-topbar')
      const nav = document.querySelector('.ui-topnav')
      const cs = side ? getComputedStyle(side) : null
      return {
        sideShown: !!cs && cs.display !== 'none',
        sideW: side ? Math.round(side.getBoundingClientRect().width) : 0,
        barShown: !!bar && getComputedStyle(bar).display !== 'none',
        navShown: !!nav && getComputedStyle(nav).display !== 'none',
        hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        textLen: document.body.innerText.replace(/\\s/g, '').length,
        err: ${JSON.stringify(errors)}.length
      }
    })()`)
    await shot(`d_${name}.png`)
    const bad = !chk.sideShown || !chk.barShown || chk.navShown || chk.hOverflow || chk.textLen < 20
    console.log(`  ${bad ? '✗' : '✓'} ${name.padEnd(10)} 侧栏=${chk.sideShown ? chk.sideW + 'px' : '隐藏'} 工具条=${chk.barShown} 旧顶栏=${chk.navShown ? '仍显示(异常)' : '已隐藏'} 横向溢出=${chk.hOverflow} 文本=${chk.textLen}`)
  }

  // ---------------- 移动（回归） ----------------
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  console.log('\n===== 移动 390×844（回归：应为原样） =====')
  for (const [url, name] of MOBILE_PAGES) {
    if (only && url !== only) continue
    errors.length = 0
    await send('Page.navigate', { url: WEB + url })
    await waitSel('.zy-page', 20000)
    await sleep(1300)
    const chk = await ev(`(() => {
      const side = document.querySelector('.ui-sidenav')
      const bar = document.querySelector('.ui-topbar')
      const nav = document.querySelector('.ui-topnav')
      return {
        sideHidden: !side || getComputedStyle(side).display === 'none',
        barHidden: !bar || getComputedStyle(bar).display === 'none',
        navShown: !!nav && getComputedStyle(nav).display !== 'none',
        hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      }
    })()`)
    await shot(`m_${name}.png`)
    const bad = !chk.sideHidden || !chk.barHidden || !chk.navShown || chk.hOverflow
    console.log(`  ${bad ? '✗' : '✓'} ${name.padEnd(10)} 侧栏隐藏=${chk.sideHidden} 工具条隐藏=${chk.barHidden} 顶栏显示=${chk.navShown} 横向溢出=${chk.hOverflow}`)
  }

  console.log('\n运行时错误:', JSON.stringify(errors.slice(0, 4)))
  console.log('截图目录: .learnbuddy/_desktop')
  chrome.kill(); prev.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
