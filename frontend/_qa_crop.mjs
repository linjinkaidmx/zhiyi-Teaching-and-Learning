/**
 * 拍题「首页框选裁剪 + 确认/取消」端到端验证（本地 uvicorn(MOCK) + CDP）
 * 链路：首页注入图片 → 框选容器 → 拖拽画框（框选盒出现）→ 松手【不识别】→ 取消清除选区
 *       → 再画框 → 点「确认识别此区域」→ 跳拍题页自动识别 → 进讲解页 /q/
 * 前置：构建产物已拷贝到 backend/static。用法：node _qa_crop.mjs
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
const PORT = 9780 + (process.pid % 60)
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
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(500) }
  console.log('  · timeout: ' + label)
  return false
}
const clickBtn = (txt) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(${JSON.stringify(txt)}))
  if (!b) return false
  b.click(); return true
})()`)

/** 在 .capture__crop 上模拟拖拽：down(move)up */
async function drag(x1, y1, x2, y2) {
  return ev(`(() => {
    const el = document.querySelector('.capture__crop'); const b = el.getBoundingClientRect()
    function pe(type, x, y) { el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', button: 0, pointerId: 1 })) }
    pe('pointerdown', b.left + ${x1}, b.top + ${y1})
    pe('pointermove', b.left + ${x2}, b.top + ${y2})
    pe('pointerup', b.left + ${x2}, b.top + ${y2})
    return true
  })()`)
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_crop_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')

  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.capture__zone')`, 15000, '首页拍题区出现')

  // 注入 400x300 图片到首页相册 input
  const injected = await ev(`(() => new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 300)
    ctx.fillStyle = '#000'; ctx.font = '22px sans-serif'
    ctx.fillText('1. 已知向量 a=(2,-1,3)', 16, 60)
    ctx.fillText('求 a 的模长', 16, 100)
    c.toBlob((blob) => {
      const file = new File([blob], 'qa.png', { type: 'image/png' })
      const dt = new DataTransfer(); dt.items.add(file)
      const inp = document.querySelectorAll('.capture input[type=file]')[0]
      if (!inp) { resolve('no-input'); return }
      inp.files = dt.files
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      resolve('ok')
    }, 'image/png')
  }))()`)
  ok(injected === 'ok', '首页相册注入图片', injected)

  ok(await waitFor(`!!document.querySelector('.capture__crop')`, 10000, '框选容器出现'), '框选容器出现')
  const hint = await ev(`(document.querySelector('.capture__crop-hint') || {}).textContent || ''`)
  ok(hint.includes('框选'), '框选提示文案', hint)

  // 画框 → 框选盒出现
  await drag(20, 20, 220, 220)
  await sleep(200)
  ok(await ev(`!!document.querySelector('.capture__crop-box')`), '拖拽后框选盒出现')

  // 松手后【不识别】：仍在首页，且出现「确认识别此区域」
  const stayHome = await ev(`window.location.pathname === '/'`)
  ok(stayHome, '松手后不自动识别（仍在首页）', await ev('window.location.pathname'))
  const hasConfirm = await ev(`[...document.querySelectorAll('button')].some((x) => x.textContent.includes('确认识别此区域'))`)
  ok(hasConfirm, '出现「确认识别此区域」按钮')

  // 取消 → 清除选区，按钮回到「识别整图」
  ok(await clickBtn('取消'), '点击「取消」')
  await sleep(200)
  ok(await ev(`!document.querySelector('.capture__crop-box')`), '取消后选区清除')
  ok(await ev(`[...document.querySelectorAll('button')].some((x) => x.textContent.includes('识别整图'))`), '取消后回到「识别整图」')

  // 再画框 → 点「确认识别此区域」→ 跳拍题页自动识别 → 进 /q/
  await drag(20, 20, 220, 220)
  await sleep(200)
  ok(await clickBtn('确认识别此区域'), '点击「确认识别此区域」')
  const navigated = await waitFor(`window.location.pathname.startsWith('/q/')`, 20000, '确认后进入讲解页')
  ok(navigated, '确认后跳转识别并进入讲解页', await ev('window.location.pathname'))

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '首页框选确认流程验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_crop_qa_' + process.pid + '.db')
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
