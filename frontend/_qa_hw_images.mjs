/**
 * 老师布置作业图片功能 E2E（本地 uvicorn(MOCK) + CDP，单浏览器）。
 * 链路：登录→认证→建班→作业 tab→布置作业（不填文字，注入 2 张图）→缩略图/删除→发布
 *       →列表「图 2」标记→详情页九宫格→点开大图弹窗→无文字时提示文案。
 * 前置：dist109 已拷入 backend/static。用法：node _qa_hw_images.mjs
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

const ADD_FILES = `(() => new Promise((resolve) => {
  const mk = (n, color) => new Promise((done) => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 640
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color; ctx.fillRect(0, 0, 480, 640)
    ctx.fillStyle = '#000'; ctx.font = '24px serif'
    ctx.fillText(n, 40, 80)
    canvas.toBlob((blob) => done(new File([blob], n + '.jpg', { type: 'image/jpeg' })), 'image/jpeg')
  })
  Promise.all([mk('题一', '#e8f0fb'), mk('题二', '#fdeeee')]).then((files) => {
    const dt = new DataTransfer()
    files.forEach((f) => dt.items.add(f))
    const input = document.querySelector('.clsd__file')
    if (!input) return resolve('no-input')
    input.files = dt.files
    input.dispatchEvent(new Event('change'))
    resolve('ok')
  })
}))()`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_hwimg_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  console.log('\n1. 登录 + 认证 + 建班')
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.zy-page', 15000)
  const reg = await ev(`fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'hwq_${process.pid}',password:'pass123456',password_confirm:'pass123456'})}).then(r=>r.json())`)
  ok(reg?.ok, '注册老师账号')
  await ev(`localStorage.setItem('zhiyi_account_token', ${JSON.stringify(reg.token)});
    localStorage.setItem('zhiyi_account_user', 'hwq_${process.pid}'); 'ok'`)
  await send('Page.navigate', { url: WEB + '/class' })
  await waitSel('.clsp__cert')
  await clickText('去认证')
  await waitSel('#t-name')
  await setInput('t-name', '图老师')
  await setInput('t-school', '图片大学')
  await setInput('t-subject', '高等数学')
  await clickText('完成认证')
  ok(await waitFor(`!document.querySelector('.clsp__cert')`, 8000), '认证完成')
  await clickText('创建班级')
  await waitSel('#c-name')
  await setInput('c-name', '图片作业班')
  await setInput('c-subject', '高等数学')
  await clickLast('创建班级')
  await waitFor(`!!document.querySelector('.clsp__code')`, 8000)
  await clickText('进入班级')
  ok(await waitFor(`location.pathname.startsWith('/class/')`, 8000), '进入班级详情')

  console.log('\n2. 布置作业：注入两张图（不填文字）')
  await clickText('作业')
  await sleep(400)
  await clickText('布置作业')
  await waitSel('#hw-title')
  await setInput('hw-title', '图片作业一')
  ok(await ev(`(() => { const i = document.querySelector('.clsd__file'); return !!i && i.hasAttribute('multiple') && i.hasAttribute('capture') })()`), '上传控件支持多选且带拍照 capture')
  const add = await ev(ADD_FILES)
  ok(add === 'ok', '注入 2 张图片文件', add)
  ok(await waitFor(`document.querySelectorAll('.clsd__img').length === 2`, 8000), '弹窗内出现 2 张缩略图')
  await ev(`document.querySelector('.clsd__img-del').click()`)
  ok(await waitFor(`document.querySelectorAll('.clsd__img').length === 1`, 5000), '可删除单张缩略图')
  await ev(ADD_FILES)
  ok(await waitFor(`document.querySelectorAll('.clsd__img').length === 3`, 8000), '再次注入后共 3 张')
  await shot('hwimg_01_modal.png')
  ok(await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '发布作业'); return b && !b.disabled })()`), '有图无文字时发布按钮可用')

  console.log('\n3. 发布 → 列表标记')
  await clickText('发布作业')
  ok(await waitFor(`[...document.querySelectorAll('.clsd__item-title')].some((e) => e.textContent.includes('图片作业一'))`, 10000), '列表出现新作业')
  ok(await waitFor(`!!document.querySelector('.clsd__hw-imgtag')`, 5000), '列表带「图 N」标记')
  const tag = await ev(`document.querySelector('.clsd__hw-imgtag')?.textContent.trim()`)
  ok(tag === '图 3', '标记数量正确', tag)
  await shot('hwimg_02_list.png')

  console.log('\n4. 详情页九宫格 + 大图')
  await clickText('图片作业一')
  await waitSel('.hwd__card', 10000)
  ok(await waitFor(`document.querySelectorAll('.hwd__img-thumb').length === 3`, 10000), '详情页展示 3 张题目图')
  ok(await ev(`document.body.textContent.includes('本次作业以图片题目为准')`), '无文字时有图片提示文案')
  await ev(`document.querySelectorAll('.hwd__img-thumb')[1].click()`)
  ok(await waitFor(`!!document.querySelector('.hwd__full-img')`, 8000), '点击缩略图打开大图弹窗')
  const title = await ev(`[...document.querySelectorAll('.ui-modal__title, [class*=modal] h2, [class*=modal] h3')].map((x) => x.textContent.trim()).find((t) => t.includes('作业题目图片'))`)
  ok(title === '作业题目图片 2/3', '大图弹窗带序号标题', title)
  await shot('hwimg_03_detail.png')

  ok(errors.length === 0, '无运行时异常', errors.slice(0, 3))

  console.log('\n5. 清理测试账号（注销级联删班级与作业）')
  if (process.env.QA_BASE) {
    const del = await ev(`fetch('/api/account/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${JSON.stringify(reg.token)},password:'pass123456'})}).then(r=>r.json())`)
    ok(del?.ok, '测试账号已注销（云端数据级联清理）', del)
  } else {
    console.log('  · 本地 MOCK 库即用即弃，跳过')
  }

  console.log(`\n==============================================\n${fail === 0 ? '全部通过' : '存在失败'}（${pass} 项断言，失败 ${fail}）`)
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_hwimg_qa_' + process.pid + '.db')
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
