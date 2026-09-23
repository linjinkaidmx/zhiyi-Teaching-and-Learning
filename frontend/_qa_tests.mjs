/**
 * 班级测试 E2E（本地 uvicorn(MOCK) + CDP，单浏览器换账号）。
 * 链路：老师 AI 生成→发布测试；学生进班→开始答题→勾选+填空→一键提交→出分排名。
 * 前置：dist112 已拷入 backend/static。用法：node _qa_tests.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PY = 'C:/Users/ASUS/.workbuddy/binaries/python/envs/zhiyi/Scripts/python.exe'
const BACKEND_DIR = path.resolve(__dirname, '../backend')
const PORT = 9780 + ((process.pid % 50) + 10)
const CDP_PORT = PORT + 100
const WEB = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(400) }
  console.log('  · timeout: ' + label)
  return false
}
const waitSel = (sel, timeout = 8000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, timeout, sel)
const clickText = (txt) => ev(`(() => {
  const b = [...document.querySelectorAll('button, label, a')].find((x) => x.textContent.trim().includes(${JSON.stringify(txt)}))
  if (!b) return false
  b.click(); return true
})()`)
const clickLast = (txt) => ev(`(() => {
  const list = [...document.querySelectorAll('button, label, a')].filter((x) => x.textContent.trim().includes(${JSON.stringify(txt)}))
  if (!list.length) return false
  list[list.length - 1].click(); return true
})()`)
const setInput = async (id, val) => {
  await ev(`(() => { const el = document.querySelector(${JSON.stringify('#' + id)}); if (!el) return false
    el.value = ${JSON.stringify(val)}; el.dispatchEvent(new Event('input')); return true })()`)
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_tests_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  const login = async (nick) => {
    await send('Page.navigate', { url: WEB + '/' })
    await waitSel('.zy-page', 15000)
    const reg = await ev(`fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:${JSON.stringify(nick)},password:'pass123456',password_confirm:'pass123456'})}).then(r=>r.json())`)
    if (!reg?.ok) throw new Error('注册失败: ' + JSON.stringify(reg))
    await ev(`localStorage.setItem('zhiyi_account_token', ${JSON.stringify(reg.token)});
      localStorage.setItem('zhiyi_account_user', ${JSON.stringify(nick)}); 'ok'`)
    return reg.token
  }

  console.log('\n1. 老师：AI 生成 → 发布测试')
  await login('qtest_t_' + process.pid)
  await send('Page.navigate', { url: WEB + '/class' })
  await waitSel('.clsp__cert')
  await clickText('去认证')
  await waitSel('#t-name')
  await setInput('t-name', '测老师')
  await setInput('t-school', '测试大学')
  await clickText('完成认证')
  await waitFor(`!document.querySelector('.clsp__cert')`, 8000)
  await clickText('创建班级')
  await waitSel('#c-name')
  await setInput('c-name', '测试测试班')
  await clickLast('创建班级')
  await waitFor(`!!document.querySelector('.clsp__code')`, 8000)
  const classCode = await ev(`document.querySelector('.clsp__code')?.textContent.trim()`)
  ok(/^[A-Z0-9]{6}$/.test(classCode || ''), '建班得到班级码', classCode)

  await clickText('进入班级')
  await waitFor(`location.pathname.startsWith('/class/')`, 8000)
  await clickText('测试')
  await sleep(400)
  await clickText('发布测试')
  await waitSel('#t-title')
  await setInput('t-title', '第一次限时测验')
  await setInput('t-duration', '10')
  await clickText('AI 生成')
  await waitSel('#t-subject')
  await setInput('t-subject', '高等数学')
  await setInput('t-topic', '极限与连续')
  await clickText('AI 生成题目草稿')
  ok(await waitFor(`document.querySelectorAll('.clsd__qcard').length >= 1`, 30000, 'AI 草稿'), 'AI 生成题目草稿出现')
  const draftCount = await ev(`document.querySelectorAll('.clsd__qcard').length`)
  ok(draftCount >= 2, '草稿含多题', draftCount)
  await clickLast('发布测试')
  await sleep(800)
  const toastText = await ev(`[...document.querySelectorAll('[class*=toast]')].map((x) => x.textContent.trim()).join(' | ') || 'no-toast'`)
  console.log('TOAST:', toastText)
  ok(await waitFor(`[...document.querySelectorAll('.clsd__item-title')].some((e) => e.textContent.includes('第一次限时测验'))`, 10000), '测试列表出现新测试')
  await shot('tests_01_list.png')

  console.log('\n2. 学生：开始 → 作答 → 交卷')
  await login('qtest_s_' + process.pid)
  await send('Page.navigate', { url: WEB + '/class' })
  await waitSel('.clsp', 10000)
  await sleep(500)
  await clickText('加入班级')
  await waitSel('#j-code')
  await setInput('j-code', classCode)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '加入'); if (b) b.click(); return !!b })()`)
  await waitFor(`location.pathname.startsWith('/class/')`, 8000)
  await clickText('测试')
  await sleep(400)
  await clickText('第一次限时测验')
  await waitFor(`location.pathname.includes('/test/')`, 10000)
  await waitSel('.trun__intro', 10000)
  ok(await ev(`document.body.textContent.includes('每人只有一次作答机会')`), '开始页有一次机会提示')
  await clickText('开始答题')
  await waitFor(`!!document.querySelector('.trun__timer')`, 10000)
  ok(await ev(`!!document.querySelector('.trun__timer')`), '倒计时出现')
  ok(await ev(`!!document.querySelector('.trun__opt')`), '选择题选项渲染')
  await ev(`(() => { const opts = [...document.querySelectorAll('.trun__opt')]; if (opts.length) opts[0].click(); return opts.length })()`)
  await ev(`(() => { const b = document.querySelector('.trun__blank'); if (!b) return false; b.value = '4'; b.dispatchEvent(new Event('input')); return true })()`)
  await sleep(300)
  await shot('tests_02_run.png')
  await clickText('一键提交')
  ok(await waitFor(`document.body.textContent.includes('交卷成功') || document.body.textContent.includes('我的成绩')`, 10000), '交卷出分')
  ok(await waitFor(`!!document.querySelector('.trnk__row')`, 8000), '排行榜渲染')
  const myScore = await ev(`document.querySelector('.trun__score')?.textContent.trim()`)
  ok(!!myScore, '显示我的得分', myScore)
  await shot('tests_03_rank.png')

  console.log('\n3. 重复进入 = 结果页')
  await send('Page.navigate', { url: WEB + '/class' })
  await sleep(600)
  await clickText('测试')
  await sleep(400)
  await clickText('第一次限时测验')
  await waitFor(`location.pathname.includes('/test/')`, 10000)
  await sleep(600)
  ok(await ev(`document.body.textContent.includes('我的成绩')`), '重复进入直接显示成绩（不可重考）')

  ok(errors.length === 0, '无运行时异常', errors.slice(0, 3))
  console.log(`\n==============================================\n${fail === 0 ? '全部通过' : '存在失败'}（${pass} 项断言，失败 ${fail}）`)
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_tests_qa_' + process.pid + '.db')
const BOOT = [
  'import types, sys',
  "m = types.ModuleType('resource')",
  'm.RLIMIT_CPU = 0; m.RLIMIT_AS = 1; m.RLIMIT_CORE = 2',
  'm.setrlimit = lambda *a, **k: None',
  "sys.modules['resource'] = m",
  `import uvicorn; uvicorn.run('main:app', host='127.0.0.1', port=${PORT})`,
].join('; ')
const backend = spawn(PY, ['-c', BOOT], { cwd: BACKEND_DIR, stdio: 'ignore', env: { ...process.env, MOCK: '1', ZHIYI_DB: dbTmp } })

main().catch((e) => { console.error('E2E 异常:', e); process.exitCode = 1 }).finally(() => { try { backend.kill() } catch { /* ignore */ } })
