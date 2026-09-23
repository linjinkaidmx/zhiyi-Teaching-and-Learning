/**
 * 班级笔记 + 学生多图提交 E2E（本地 uvicorn(MOCK) + CDP，单浏览器换账号）。
 * 链路：老师认证→建班→布置作业→发布笔记(带图)；学生进班→多图提交→笔记保存到错题学习→分组断言。
 * 前置：dist110 已拷入 backend/static。用法：node _qa_notes.mjs
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

const ADD_NOTE_IMG = `(() => new Promise((resolve) => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 360
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#e8f6ee'; ctx.fillRect(0, 0, 480, 360)
  ctx.fillStyle = '#000'; ctx.font = '24px serif'; ctx.fillText('笔记配图', 40, 80)
  canvas.toBlob((blob) => {
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'note.jpg', { type: 'image/jpeg' }))
    const input = document.querySelector('.clsd__file')
    if (!input) return resolve('no-input')
    input.files = dt.files
    input.dispatchEvent(new Event('change'))
    resolve('ok')
  }, 'image/jpeg')
}))()`

const ADD_HW_IMGS = `(() => new Promise((resolve) => {
  const mk = (n, color) => new Promise((done) => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 640
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color; ctx.fillRect(0, 0, 480, 640)
    ctx.fillStyle = '#000'; ctx.font = '24px serif'; ctx.fillText(n, 40, 80)
    canvas.toBlob((blob) => done(new File([blob], n + '.jpg', { type: 'image/jpeg' })), 'image/jpeg')
  })
  Promise.all([mk('页一', '#eef2fb'), mk('页二', '#fbf1ee')]).then((files) => {
    const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f))
    const input = document.querySelector('.hwd__file')
    if (!input) return resolve('no-input')
    input.files = dt.files
    input.dispatchEvent(new Event('change'))
    resolve('ok')
  })
}))()`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_notes_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  console.log('\n1. 老师：认证 → 建班 → 布置作业 → 发布笔记')
  await login('nte_t_' + process.pid)
  await send('Page.navigate', { url: WEB + '/class' })
  await waitSel('.clsp__cert')
  await clickText('去认证')
  await waitSel('#t-name')
  await setInput('t-name', '笔老师')
  await setInput('t-school', '笔记大学')
  await clickText('完成认证')
  await waitFor(`!document.querySelector('.clsp__cert')`, 8000)
  await clickText('创建班级')
  await waitSel('#c-name')
  await setInput('c-name', '笔记测试班')
  await clickLast('创建班级')
  await waitFor(`!!document.querySelector('.clsp__code')`, 8000)
  const classCode = await ev(`document.querySelector('.clsp__code')?.textContent.trim()`)
  ok(/^[A-Z0-9]{6}$/.test(classCode || ''), '建班得到班级码', classCode)
  await clickText('进入班级')
  await waitFor(`location.pathname.startsWith('/class/')`, 8000)

  await clickText('作业')
  await sleep(300)
  await clickText('布置作业')
  await waitSel('#hw-title')
  await setInput('hw-title', '多图提交作业')
  await setInput('hw-content', '1. 求极限 2. 证明连续')
  await clickLast('发布作业')
  ok(await waitFor(`[...document.querySelectorAll('.clsd__item-title')].some((e) => e.textContent.includes('多图提交作业'))`, 10000), '作业已发布')

  await clickText('笔记')
  await sleep(300)
  await clickText('发布笔记')
  await waitSel('#note-title')
  await setInput('note-title', '定积分三大方法')
  await setInput('note-content', '换元法：…\\n分部积分：…')
  const addN = await ev(ADD_NOTE_IMG)
  ok(addN === 'ok', '注入笔记配图', addN)
  ok(await waitFor(`document.querySelectorAll('.clsd__img').length === 1`, 8000), '笔记配图缩略图出现')
  await clickLast('发布笔记')
  ok(await waitFor(`[...document.querySelectorAll('.clsd__item-title')].some((e) => e.textContent.includes('定积分三大方法'))`, 10000), '笔记列表出现新笔记')
  ok(await waitFor(`!!document.querySelector('.clsd__hw-imgtag')`, 5000), '笔记带「图 1」标记')
  await shot('notes_01_teacher.png')

  console.log('\n2. 学生：进班 → 多图提交 → 保存笔记到错题学习')
  await login('nte_s_' + process.pid)
  await send('Page.navigate', { url: WEB + '/class' })
  await waitSel('.clsp', 10000)
  await sleep(500)
  await clickText('加入班级')
  await waitSel('#j-code')
  await setInput('j-code', classCode)
  await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '加入')
    if (!b) return false
    b.click(); return true
  })()`)
  await waitFor(`location.pathname.startsWith('/class/')`, 8000)
  await clickText('作业')
  await sleep(300)
  await clickText('多图提交作业')
  await waitSel('.hwd__card', 10000)
  const addH = await ev(ADD_HW_IMGS)
  ok(addH === 'ok', '学生注入 2 张答卷图', addH)
  ok(await waitFor(`document.querySelectorAll('.hwd__imgwrap').length === 2`, 8000), '学生提交区出现 2 张缩略图')
  await clickText('提交作业')
  ok(await waitFor(`document.body.textContent.includes('已提交，等老师批改') || document.body.textContent.includes('已提交')`, 10000), '多图提交成功')
  await shot('notes_02_submitted.png')

  await send('Page.navigate', { url: WEB + '/class' })
  await sleep(600)
  await clickText('笔记')
  await sleep(400)
  await clickText('定积分三大方法')
  await waitSel('.clsd__note-content', 8000)
  ok(await ev(`document.body.textContent.includes('换元法')`), '笔记详情显示全文')
  ok(await waitFor(`!!document.querySelector('.clsd__note-img')`, 8000), '笔记详情显示配图')
  await clickText('保存到错题学习')
  ok(await waitFor(`document.body.textContent.includes('已存入错题学习')`, 8000), '保存成功 toast')
  const bookRaw = await ev(`JSON.parse(localStorage.getItem('zhiyi_errorbook_account_v1') || localStorage.getItem('zhiyi_errorbook_v1') || '[]').map((i) => ({ kind: i.kind || 'question', title: i.title }))`)
  ok(Array.isArray(bookRaw) && bookRaw.some((i) => i.kind === 'note' && i.title === '定积分三大方法'), '错题本本地数据含 note 条目', bookRaw)
  await shot('notes_03_saved.png')

  console.log('\n3. 错题学习分组展示')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__group-title', 10000)
  const titles = await ev(`[...document.querySelectorAll('.wb__group-title')].map((x) => x.textContent.trim())`)
  ok(titles.some((x) => x.includes('笔记')), '错题学习出现「笔记」分组', titles)
  ok(await waitFor(`[...document.querySelectorAll('.wb__card--note .wb__card-q')].some((e) => e.textContent.includes('定积分三大方法'))`, 5000), '笔记卡显示标题')
  ok(await ev(`!!document.querySelector('.wb__card--note .wb__card-q--sub')`), '笔记卡显示内容摘要')
  await shot('notes_04_wrongbook.png')

  ok(errors.length === 0, '无运行时异常', errors.slice(0, 3))
  console.log(`\n==============================================\n${fail === 0 ? '全部通过' : '存在失败'}（${pass} 项断言，失败 ${fail}）`)
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_notes_qa_' + process.pid + '.db')
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
