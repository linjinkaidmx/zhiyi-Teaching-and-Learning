/**
 * 验证：老师端「导出成绩表」下载 + 「打印报告」内容
 * 用法：node _qa_export_ui.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9260 + (process.pid % 50)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
const DL = path.join(OUT, 'dl')
fs.mkdirSync(DL, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  const list = await post('/api/homework/list', { token: ACC.teacher.token, class_id: ACC.class_id })
  const hw = (list.items || []).find((h) => (h.graded || 0) > 0) || (list.items || [])[0]

  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ex_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => {})
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => {})
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.teacher.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.teacher.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');'ok'`)
  // 拦截 window.print，避免 headless 下弹打印对话框阻塞脚本
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.print = function(){ window.__printed = true };" })

  await send('Page.navigate', { url: BASE + '/class/' + ACC.class_id + '/hw/' + hw.id })
  await waitSel('.zy-page', 25000)
  await sleep(2000)

  const ui = await ev(`(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean)
    return { hasExport: btns.some((t) => t.includes('导出成绩表')), hasPrint: btns.some((t) => t.includes('打印报告')), btns: btns.slice(0, 12) }
  })()`)
  ok(ui.hasExport && ui.hasPrint, '老师侧出现「导出成绩表」「打印报告」按钮', ui.btns)
  await shot('export_ui.png')

  // 点导出 → 等下载落盘
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('导出成绩表')); if(b) b.click(); return !!b })()`)
  let files = []
  for (let i = 0; i < 20; i++) { await sleep(600); files = fs.readdirSync(DL).filter((f) => f.endsWith('.csv')); if (files.length) break }
  ok(files.length >= 1, '点击后 CSV 文件已下载', files)
  if (files.length) {
    const content = fs.readFileSync(path.join(DL, files[0]), 'utf-8')
    ok(content.startsWith('\ufeff'), '下载文件带 BOM', content.slice(0, 3))
    ok(/学生/.test(content) && /得分/.test(content), '下载文件含成绩字段')
    console.log('  · 文件:', files[0], '| 前 60 字:', content.replace('\ufeff', '').slice(0, 60))
  }

  // 若还没生成报告，先生成（打印依赖报告数据）
  const hasReport = await ev(`!!document.querySelector('[class*=report]')`)
  console.log('  · 已有报告区:', hasReport)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('生成班级报告')); if(b && !b.disabled) b.click(); return !!b })()`)
  for (let i = 0; i < 40; i++) { await sleep(1000); const t = await ev(`document.body.innerText.includes('共性问题') || document.body.innerText.includes('班级报告')`); if (t) break }
  await sleep(1500)

  // 点打印报告 → 检查打印 DOM
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('打印报告')); if(b) b.click(); return !!b })()`)
  await sleep(1200)
  const pr = await ev(`(() => {
    const root = document.querySelector('.zy-print-root')
    return {
      printed: !!window.__printed,
      root: !!root,
      bodyClass: document.body.classList.contains('zy-printing'),
      title: root && root.querySelector('h2') ? root.querySelector('h2').textContent : '',
      sections: root ? [...root.querySelectorAll('.zy-print-item h3')].map((h) => h.textContent) : [],
      tables: root ? root.querySelectorAll('table').length : 0,
      rows: root ? root.querySelectorAll('table tr').length : 0,
      text: root ? root.innerText.replace(/\\s+/g, ' ').slice(0, 150) : '',
    }
  })()`)
  console.log('  ·', JSON.stringify(pr))
  ok(pr.printed, '打印流程被触发')
  ok(pr.root && pr.bodyClass, '打印容器与 printing 类已就绪')
  ok(pr.sections.length >= 4, '报告分节完整', pr.sections)
  ok(pr.tables >= 3 && pr.rows >= 8, '含概况/分布/明细表格', { tables: pr.tables, rows: pr.rows })
  ok(/班级概况/.test(pr.text) || /应交/.test(pr.text), '内容为班级概况数据', pr.text.slice(0, 60))
  await shot('print_preview.png')

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图/下载: ' + OUT)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
