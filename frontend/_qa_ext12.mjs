/**
 * 验证扩展1/2：学习数据页的「成长报告」与薄弱点「练一组」
 * 用法：node _qa_ext12.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9380 + (process.pid % 40)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
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
const clickText = (t) => ev(`(() => { const b=[...document.querySelectorAll('button')].find(x => (x.textContent||'').includes(${JSON.stringify(t)}) && !x.disabled); if (b) { b.click(); return true } return false })()`)
// 只点弹窗内的按钮：页面上可能有同名元素（曾误点「全部」跳到学习记录页）
const clickInModal = (t) => ev(`(() => {
  const root = document.querySelector('.ui-modal')
  if (!root) return false
  const b = [...root.querySelectorAll('button')].find(x => (x.textContent || '').includes(${JSON.stringify(t)}) && !x.disabled)
  if (b) { b.click(); return true }
  return false
})()`)

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_e12_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');'ok'`)

  console.log('\n===== 学习数据页入口 =====')
  await send('Page.navigate', { url: BASE + '/data' })
  await waitSel('.zy-page', 25000)
  await sleep(2500)
  const entry = await ev(`(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
    return {
      report: btns.some((t) => t.includes('成长报告')),
      practice: btns.filter((t) => t.includes('练一组')).length,
      weakRows: document.querySelectorAll('.data__row').length,
    }
  })()`)
  console.log('  ·', JSON.stringify(entry))
  ok(entry.report, '页头出现「成长报告」按钮', entry.report)
  ok(entry.practice >= 1, '薄弱点行出现「练一组」按钮', entry.practice)

  console.log('\n===== 扩展2：成长报告 =====')
  await clickText('成长报告')
  await sleep(1800)
  const rep = await ev(`(() => {
    const txt = document.body.innerText
    return {
      hasMetrics: /学习时长|错题总数|已掌握/.test(txt),
      hasRange: /近 30 天|近 180 天|全部记录/.test(txt),
      hasConclusion: /这段时间共整理了|先攒几道错题/.test(txt),
      hasPrint: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('打印')),
      hasCopy: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('复制数据摘要')),
    }
  })()`)
  console.log('  ·', JSON.stringify(rep))
  ok(rep.hasMetrics && rep.hasRange, '报告含关键数字与范围切换', rep)
  ok(rep.hasConclusion, '报告含自动总结', rep.hasConclusion)
  ok(rep.hasPrint && rep.hasCopy, '报告可打印 / 可复制摘要', rep)
  await shot('ext2_report.png')
  // 切到「全部」再截图，验证范围切换不报错
  await clickInModal('全部')
  await sleep(1200)
  await shot('ext2_report_all.png')
  const repAll = await ev(`(() => ({ stillOk: /关键|错题总数|学习时长/.test(document.body.innerText) }))()`)
  ok(repAll.stillOk, '切换到「全部」范围后报告仍正常渲染', repAll.stillOk)
  await clickInModal('关闭')
  await sleep(800)

  console.log('\n===== 扩展1：薄弱点「练一组」 =====')
  // 重新加载页面，确保成长报告弹窗已彻底关闭（避免遮罩挡住点击）
  await send('Page.navigate', { url: BASE + '/data' })
  await waitSel('.zy-page', 25000)
  await sleep(2200)
  const clickedPractice = await clickText('练一组')
  console.log('  · 点击练一组:', clickedPractice)
  await sleep(1500)
  let first = await ev(`(() => {
    const m = document.querySelector('.ui-modal')
    const t = m ? m.innerText : ''
    return { generating: /正在围绕/.test(t) || /正在围绕/.test(document.body.innerText), hasModal: !!m && /专项练习/.test(t) }
  })()`)
  ok(first.hasModal, '打开专项练习弹窗', first)
  ok(first.generating, '显示生成中状态', first.generating)
  await shot('ext1_loading.png')

  // 等生成完成（AI 出题，最多 60s）
  let ready = false
  for (let i = 0; i < 40; i++) {
    await sleep(1500)
    ready = await ev(`(() => { const m = document.querySelector('.ui-modal'); return !!m && /第 1 \\/ 3 题|提交这一题/.test(m.innerText) })()`)
    if (ready) break
  }
  ok(ready, '题目生成完成（出现作答区）', ready)
  const q = await ev(`(() => {
    const ta = document.querySelector('.wpp__input')
    return { hasInput: !!ta, stemLen: (document.querySelector('.wpp__stem') || {}).textContent?.trim().length || 0 }
  })()`)
  console.log('  ·', JSON.stringify(q))
  ok(q.hasInput, '作答输入框已就绪', q.hasInput)
  ok(q.stemLen > 8, '题干已渲染', q.stemLen)
  await shot('ext1_quiz.png')

  // 作答并判分（走真实 /api/judge）
  if (q.hasInput) {
    await ev(`(() => {
      const ta = document.querySelector('.wpp__input')
      const setter = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value').set
      setter.call(ta, '我的解答：按定义逐步推导，最后得到结果。')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await sleep(600)
    await clickInModal('提交这一题')
    let judged = false
    for (let i = 0; i < 40; i++) {
      await sleep(1500)
      judged = await ev(`(() => { const m = document.querySelector('.ui-modal'); return !!m && /答对了|还差一点/.test(m.innerText) })()`)
      if (judged) break
    }
    ok(judged, '判分完成并展示结果与解析（走 /api/judge）', judged)
    await shot('ext1_judged.png')
  }

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图: ' + OUT)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
