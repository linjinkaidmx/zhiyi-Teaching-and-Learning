/**
 * 班级模块端到端验证（本地 uvicorn(MOCK) + CDP 双浏览器实例）
 * 链路：教师认证 → 创建班级(班级码) → 学生凭码加入 → 老师布置作业 → 学生拍照提交
 *       → 老师 AI 批改(单份) → 生成班级报告 → 发到班级群 → 学生看到评语
 * 两个 Chrome 实例（独立 profile）：同源 localStorage 会互相顶号，必须隔离。
 * 前置：构建产物已拷贝到 backend/static。用法：node _qa_class.mjs
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
const PORT = 9750 + (process.pid % 100)
const WEB = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}

/** 一个 Chrome 实例 = 一个独立 profile = 一套会话 */
function makeBrowser(tag, cdpPort) {
  const b = { tag, errors: [] }
  let ws
  let seq = 0
  const pending = new Map()

  const send = (m, p = {}) => {
    const id = ++seq
    ws.send(JSON.stringify({ id, method: m, params: p }))
    return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
  }
  b.send = send
  b.ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
  b.waitSel = async (sel, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try { if (await b.ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
      await sleep(300)
    }
    return false
  }
  b.waitFor = async (expr, timeout = 20000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try { if (await b.ev(expr)) return true } catch { /* retry */ }
      await sleep(500)
    }
    return false
  }
  b.clickText = (txt, sel = 'button') => b.ev(`(() => {
    const b = [...document.querySelectorAll('${sel}')].find((x) => x.textContent.trim().includes(${JSON.stringify(txt)}))
    if (!b) return false
    b.click(); return true
  })()`)
  // 弹窗 teleport 到 body 末尾：同名按钮（如「创建班级」）必须取最后一个
  b.clickLast = (txt, sel = 'button') => b.ev(`(() => {
    const b = [...document.querySelectorAll('${sel}')].filter((x) => x.textContent.trim().includes(${JSON.stringify(txt)})).pop()
    if (!b) return false
    b.click(); return true
  })()`)
  b.clickExact = (txt, sel = 'button') => b.ev(`(() => {
    const b = [...document.querySelectorAll('${sel}')].find((x) => x.textContent.trim() === ${JSON.stringify(txt)})
    if (!b) return false
    b.click(); return true
  })()`)
  b.setInput = (id, val) => b.ev(`(() => {
    const el = document.getElementById(${JSON.stringify(id)})
    if (!el) return false
    el.value = ${JSON.stringify(val)}
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  b.shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
    return name
  }

  b.start = async () => {
    b.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
      '--remote-debugging-port=' + cdpPort,
      '--user-data-dir=' + path.join(os.tmpdir(), `qa_class_${tag}_` + process.pid),
      'about:blank'], { stdio: 'ignore' })
    for (let i = 0; i < 40; i += 1) {
      try { if ((await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok) break } catch { /* retry */ }
      await sleep(250)
    }
    const t = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        if (m.error) p.reject(new Error(m.error.message))
        else p.resolve(m.result)
        return
      }
      if (m.method === 'Runtime.exceptionThrown') b.errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
    })
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  }

  b.loginAs = async (nick) => {
    await send('Page.navigate', { url: WEB + '/' })
    await b.waitSel('.zy-page')
    const reg = await b.ev(`fetch('/api/account/register',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname:${JSON.stringify(nick)},password:'pass123456',password_confirm:'pass123456'})
    }).then(r=>r.json())`)
    if (!reg?.ok) throw new Error('注册失败: ' + JSON.stringify(reg))
    await b.ev(`localStorage.setItem('zhiyi_account_token', ${JSON.stringify(reg.token)});
      localStorage.setItem('zhiyi_account_user', ${JSON.stringify(nick)}); 'ok'`)
    await send('Page.navigate', { url: WEB + '/class' })
    await b.waitSel('.clsp')
    await sleep(700)
    return reg.token
  }

  b.close = () => { try { b.proc?.kill() } catch { /* ignore */ } }
  return b
}

const SET_HW_IMAGE = `(() => new Promise((resolve) => {
  const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 800)
  ctx.fillStyle = '#000'; ctx.font = '26px serif'
  ctx.fillText('1. 解：原式 = 1', 40, 80)
  ctx.fillText('2. 证明：连续函数定义……', 40, 150)
  canvas.toBlob((blob) => {
    const f = new File([blob], 'hw.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer(); dt.items.add(f)
    const input = document.querySelector('input[type=file]')
    if (!input) return resolve('no-input')
    input.files = dt.files
    input.dispatchEvent(new Event('change'))
    resolve('ok')
  }, 'image/jpeg')
}))()`

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(500)
  }

  const tea = makeBrowser('tea', 9850 + (process.pid % 100))
  const stu = makeBrowser('stu', 9851 + (process.pid % 100))
  await tea.start()
  await stu.start()

  const TEA = 'qa_tea_' + process.pid
  const STU = 'qa_stu_' + process.pid

  // ========== 老师侧：认证 → 建班 → 布置作业 ==========
  await tea.loginAs(TEA)
  ok(await tea.waitSel('.clsp__cert'), '老师侧显示教师认证卡')
  await tea.clickText('去认证')
  await tea.waitSel('#t-name')
  await tea.setInput('t-name', '王老师')
  await tea.setInput('t-school', '某某大学')
  await tea.setInput('t-subject', '高等数学')
  await tea.clickText('完成认证')
  ok(await tea.waitFor(`!document.querySelector('.clsp__cert')`, 8000), '认证后认证卡消失')
  await tea.shot('class_01_certified.png')

  await tea.clickText('创建班级')
  await tea.waitSel('#c-name')
  await tea.setInput('c-name', '高数（2）班')
  await tea.setInput('c-subject', '高等数学')
  await tea.setInput('c-grade', '大一')
  await tea.clickLast('创建班级')
  ok(await tea.waitFor(`!!document.querySelector('.clsp__code')`, 8000), '创建后展示班级码')
  const classCode = await tea.ev(`document.querySelector('.clsp__code')?.textContent.trim()`)
  ok(/^[A-Z0-9]{6}$/.test(classCode || ''), '班级码为 6 位', classCode)
  await tea.clickText('进入班级')
  ok(await tea.waitFor(`location.pathname.startsWith('/class/') && document.querySelectorAll('button').length > 0`, 8000), '进入班级详情页')
  await sleep(800)
  ok(await tea.ev(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='作业')`), '详情页有三个 tab（作业按钮存在）')

  await tea.clickExact('作业')
  await tea.clickText('布置作业')
  await tea.waitSel('#hw-title')
  await tea.setInput('hw-title', '第一次作业')
  await tea.setInput('hw-content', '1. 求 lim(x→0) sin x / x\n2. 证明 f(x)=x² 在 R 连续')
  await tea.setInput('hw-ref', '1. 极限为 1；2. 用连续函数定义')
  await tea.clickText('发布作业')
  ok(await tea.waitFor(`[...document.querySelectorAll('.clsd__item-title')].some(e=>e.textContent.includes('第一次作业'))`, 8000), '作业列表出现新作业')
  await tea.shot('class_02_homework_list.png')

  // ========== 学生侧：凭码加入 → 拍照提交 ==========
  await stu.loginAs(STU)
  await stu.clickText('加入班级')
  await stu.waitSel('#j-code')
  await stu.setInput('j-code', classCode)
  await stu.clickLast('加入')
  ok(await stu.waitFor(`location.pathname.startsWith('/class/')`, 8000), '学生凭班级码进入班级详情')
  await sleep(700)

  await stu.clickExact('作业')
  ok(await stu.waitFor(`[...document.querySelectorAll('.clsd__item')].some(e=>e.textContent.includes('未提交'))`, 8000), '学生作业列表显示未提交')
  await stu.clickText('第一次作业')
  await stu.waitSel('.hwd__upload')
  const picked = await stu.ev(SET_HW_IMAGE)
  ok(picked === 'ok', '学生选择作业图片', picked)
  ok(await stu.waitFor(`!!document.querySelector('.hwd__preview')`, 10000), '图片预览出现')
  await stu.ev(`(() => { const el = document.querySelector('.hwd__textarea'); if (el) { el.value = '第 2 题写在背面'; el.dispatchEvent(new Event('input', {bubbles:true})) } return true })()`)
  await stu.clickText('提交作业')
  ok(await stu.waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('重新拍一张')) || document.body.textContent.includes('待批改')`, 15000), '提交成功，状态变为待批改')
  await stu.shot('class_03_student_submitted.png')

  // ========== 老师侧：批改 → 报告 → 推送 ==========
  await tea.send('Page.navigate', { url: WEB + '/class' })
  await tea.waitSel('.clsp__item')
  await tea.ev(`[...document.querySelectorAll('.clsp__item')][0].click()`)
  await sleep(900)
  await tea.clickExact('作业')
  await sleep(400)
  ok(await tea.waitFor(`[...document.querySelectorAll('.clsd__item')].some(e=>e.textContent.includes('已交 1/1'))`, 8000), '老师看到已交 1/1')
  await tea.clickText('第一次作业')
  await tea.waitSel('.hwd__stu-list')
  ok(await tea.ev(`document.body.textContent.includes('已交，待批改')`), '老师视角显示待批改')
  await tea.clickText('AI 批改')
  ok(await tea.waitFor(`document.body.textContent.includes('已批 · 85 分')`, 30000), 'MOCK 批改完成 85 分')
  await tea.shot('class_04_graded.png')

  await tea.clickText('生成班级报告')
  ok(await tea.waitFor(`!!document.querySelector('.hwd__stats')`, 30000), '班级报告生成（统计区出现）')
  const stats = await tea.ev(`[...document.querySelectorAll('.hwd__stat')].map(e=>e.textContent.trim())`)
  ok(stats.some((s) => s.includes('平均')), '报告含平均分统计', stats)
  await tea.shot('class_05_report.png')

  await tea.clickText('发到班级群')
  await sleep(800)
  // 群聊 tab 在班级详情页；作业详情页没有，先回去
  await tea.send('Page.navigate', { url: WEB + '/class' })
  await tea.waitSel('.clsp__item')
  await tea.ev(`[...document.querySelectorAll('.clsp__item')][0].click()`)
  await sleep(900)
  await tea.clickExact('群聊')
  await sleep(600)
  const sysMsg = await tea.ev(`[...document.querySelectorAll('.clsd__sys')].map(e=>e.textContent).join('|')`)
  ok((sysMsg || '').includes('班级报告'), '班级群收到报告消息', sysMsg)
  await tea.shot('class_06_group_report.png')

  // ========== 学生侧：看到评语与群消息 ==========
  await stu.send('Page.navigate', { url: WEB + '/class' })
  await stu.waitSel('.clsp__item')
  await stu.ev(`[...document.querySelectorAll('.clsp__item')][0].click()`)
  await sleep(900)
  await stu.clickExact('作业')
  await sleep(400)
  await stu.clickText('第一次作业')
  ok(await stu.waitFor(`!!document.querySelector('.hwd__score')`, 10000), '学生看到自己的得分')
  const score = await stu.ev(`document.querySelector('.hwd__score')?.textContent.trim()`)
  ok((score || '').startsWith('85'), '学生得分 85', score)
  ok(await stu.ev(`!!document.querySelector('.hwd__fb-item')`), '学生看到逐题评语')
  await stu.shot('class_07_student_feedback.png')

  // 学生回班级页看群消息（群聊 tab 在班级详情页）
  await stu.send('Page.navigate', { url: WEB + '/class' })
  await stu.waitSel('.clsp__item')
  await stu.ev(`[...document.querySelectorAll('.clsp__item')][0].click()`)
  await sleep(900)
  await stu.clickExact('群聊')
  await sleep(600)
  ok(await stu.ev(`document.body.textContent.includes('班级报告')`), '学生群聊里可见班级报告消息')

  console.log(`\n通过 ${pass} · 失败 ${fail}`)
  const allErrors = [...tea.errors, ...stu.errors]
  if (allErrors.length) console.log('页面异常:', allErrors.slice(0, 3))
  tea.close()
  stu.close()
  process.exit(fail || allErrors.length ? 1 : 0)
}

// ---------------- 启动本地后端 ----------------
const dbTmp = path.join(os.tmpdir(), 'zhiyi_class_qa_' + process.pid + '.db')
// Windows 打桩 resource（main.py 依赖 Unix 专有模块），与 _test_class.py 同款
const BOOT = [
  "import types, sys",
  "m = types.ModuleType('resource')",
  "m.RLIMIT_CPU = 0; m.RLIMIT_AS = 1; m.RLIMIT_CORE = 2",
  "m.setrlimit = lambda *a, **k: None",
  "sys.modules['resource'] = m",
  `import uvicorn; uvicorn.run('main:app', host='127.0.0.1', port=${PORT})`,
].join('; ')
const backend = spawn(PY, ['-c', BOOT], {
  cwd: BACKEND_DIR,
  stdio: 'ignore',
  env: { ...process.env, MOCK: '1', ZHIYI_DB: dbTmp },
})

main()
  .catch((e) => { console.error('E2E 异常:', e); process.exitCode = 1 })
  .finally(() => {
    try { backend.kill() } catch { /* ignore */ }
  })
