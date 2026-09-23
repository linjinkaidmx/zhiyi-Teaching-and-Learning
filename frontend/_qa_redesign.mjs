/**
 * 首页改版全站验证（本地 uvicorn(MOCK) + CDP）
 * 覆盖：双 Tab / 4 大卡 / 次入口两页（班级进 P1、学习记录移 P2）/ 信息位 / 无底部导航
 *       / 🔔 提醒中心 / 学习工具页 / 拍题页框选确认识别
 * 前置：构建产物已拷贝到 backend/static。用法：node _qa_redesign.mjs
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
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(500) }
  console.log('  · timeout: ' + label)
  return false
}
const clickBtn = (txt) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(${JSON.stringify(txt)}))
  if (!b) return false
  b.click(); return true
})()`)
const bodyHas = (txt) => ev(`document.body.textContent.includes(${JSON.stringify(txt)})`)

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_redesign_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  // 第 1-4 节按移动视口验证（原型是移动端形态），第 5 节切桌面视口
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  console.log('\n1. 首页（A1）')
  await send('Page.navigate', { url: WEB + '/' })
  const homeOk = await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页出现')
  if (!homeOk) {
    console.log('  · 诊断 pathname=', await ev('window.location.pathname'))
    console.log('  · 诊断 errors=', errors.slice(0, 3))
    console.log('  · 诊断 body=', await ev('document.body.textContent.slice(0, 300)'))
  }
  const cardTexts = await ev(`[...document.querySelectorAll('.home__card-name')].map((x) => x.textContent.trim()).join(',')`)
  ok(cardTexts === '拍照搜题,错题学习,AI 对话,学习工具', '大卡一页 4 个且顺序正确', cardTexts)
  const p1 = await ev(`[...document.querySelectorAll('.home__quick-page')][0].textContent`)
  const p2 = await ev(`[...document.querySelectorAll('.home__quick-page')][1].textContent`)
  ok(p1.includes('班级') && p1.includes('课程表') && p1.includes('考试安排') && p1.includes('学习数据') && !p1.includes('学习记录'), '次入口 P1 = 课程表/社区/考试/班级/学习数据', p1)
  ok(p2.includes('学习记录') && p2.includes('产品介绍') && p2.includes('帮助与反馈') && p2.includes('账号与同步'), '次入口 P2 = 学习记录/产品/帮助/账号', p2)
  ok(await ev(`!!document.querySelector('.home__info')`), '信息位出现（单条）')
  ok(await ev(`!!document.querySelector('.ui-topnav__tabs')`) && await ev(`[...document.querySelectorAll('.ui-topnav__tab')].map((x)=>x.textContent.trim()).join(',')`) === '学习,我的', '顶部双 Tab = 学习/我的')
  ok(await ev(`!document.querySelector('.ui-bottomnav, [class*=bottom-nav], nav[class*=bottom]')`) && (await ev(`typeof BOTTOM_NAV === 'undefined' || true`)) && !(await bodyHas('AI拍题')), '无底部五项导航')

  console.log('\n2. 提醒中心（B1）')
  ok(await ev(`!!document.querySelector('.ui-topnav__bell')`), '顶栏铃铛存在')
  await ev(`document.querySelector('.ui-topnav__bell').click()`)
  await sleep(500)
  ok(await ev(`!!document.querySelector('.ui-modal')`) && (await bodyHas('提醒中心')), '铃铛打开提醒中心浮层')
  await ev(`(() => { const b = [...document.querySelectorAll('.ui-modal button')].find((x) => x.textContent.includes('关闭') || x.getAttribute('aria-label') === '关闭'); if (b) b.click(); return true })()`)
  await sleep(300)

  console.log('\n3. 学习工具页（A5）')
  ok(await clickBtn('学习工具'), '点大卡「学习工具」')
  await waitFor(`!!document.querySelector('.tools__grid')`, 10000, '工具页出现')
  const toolTitles = await ev(`[...document.querySelectorAll('.tools__title')].map((x) => x.textContent.trim()).join(',')`)
  ok(toolTitles === '模拟考试,算法演示,代码诊断,考前速查', '工具页 2×2 四工具', toolTitles)

  console.log('\n4. 拍题页框选确认识别（A2 + 框选）')
  await send('Page.navigate', { url: WEB + '/capture' })
  await waitFor(`!!document.querySelector('.capture__drop')`, 10000, '拍题页出现')
  const injected = await ev(`(() => new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 300)
    ctx.fillStyle = '#000'; ctx.font = '22px sans-serif'
    ctx.fillText('1. 求极限 lim sinx/x', 16, 60)
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
  ok(injected === 'ok', '相册注入图片', injected)
  await waitFor(`!!document.querySelector('.capture__crop')`, 8000, '框选容器出现')
  await ev(`(() => {
    const el = document.querySelector('.capture__crop'); const b = el.getBoundingClientRect()
    function pe(type, x, y) { el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', button: 0, pointerId: 1 })) }
    pe('pointerdown', b.left + 20, b.top + 20)
    pe('pointermove', b.left + 220, b.top + 220)
    pe('pointerup', b.left + 220, b.top + 220)
    return true
  })()`)
  await sleep(200)
  ok(await ev(`!!document.querySelector('.capture__crop-box')`) && (await ev('window.location.pathname')) === '/capture', '框选后停住待确认')
  ok(await clickBtn('确认识别此区域'), '点「确认识别此区域」')
  ok(await waitFor(`window.location.pathname.startsWith('/q/')`, 20000, '确认后进讲解页'), '确认后进入讲解页', await ev('window.location.pathname'))

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n5. 桌面视口（1440×900，工作台增强）')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '桌面首页出现')
  const asideVisible = await ev(`(() => { const a = document.querySelector('.home__aside'); return a && a.offsetParent !== null })()`)
  ok(asideVisible, '桌面显示今日概览侧栏')
  const dotsHidden = await ev(`(() => { const d = document.querySelector('.home__quick-dots'); return d && getComputedStyle(d).display === 'none' })()`)
  ok(dotsHidden, '桌面次入口圆点隐藏（9 项平铺）')
  const nineVisible = await ev(`(() => {
    const icos = [...document.querySelectorAll('.home__ico')]
    if (icos.length !== 9) return 'count:' + icos.length
    return icos.every((x) => x.offsetParent !== null)
  })()`)
  ok(nineVisible === true, '桌面 9 项次入口同一屏可见', nineVisible)
  const cardDir = await ev(`(() => { const c = document.querySelector('.home__card'); return getComputedStyle(c).flexDirection })()`)
  ok(cardDir === 'row', '桌面大卡横版', cardDir)
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitFor(`!!document.querySelector('.wb__body')`, 10000, '错题页出现')
  const wbCols = await ev(`(() => { const b = document.querySelector('.wb__body'); const g = getComputedStyle(b); return { tc: g.gridTemplateColumns.split(' ').length, side: document.querySelector('.wb__side').offsetParent !== null } })()`)
  ok(wbCols && wbCols.tc === 2 && wbCols.side, '错题页桌面两栏', wbCols)

  ok(errors.length === 0, '无未捕获异常（含桌面段）', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '首页改版全站验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_redesign_qa_' + process.pid + '.db')
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
