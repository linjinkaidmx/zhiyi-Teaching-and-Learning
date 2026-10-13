/**
 * 模拟考试端到端验证（本地 vite preview + CDP + 真实模型）
 * 链路：更多 → 模拟考试 → 选「仅选择题」→ 开始考试（真实组卷）→ 作答 → 交卷（本地判 + AI 判）
 *       → 成绩页 → 错题加入错题本 → 返回看历史
 * 耗时较长（组卷 10~20s、判卷 5~15s），断言留足等待。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9650 + (process.pid % 100)
const OUTDIR = process.argv[2] || 'dist96'
const WEBPORT = 5950 + (process.pid % 100)
// QA_BASE 指向已部署环境（同源带后端）；不传则用本地 vite preview（仅能跑前端逻辑）
const QA_BASE = (process.env.QA_BASE || '').replace(/\/$/, '')
const WEB = QA_BASE || ('http://127.0.0.1:' + WEBPORT)
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = QA_BASE ? null : spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}

const errItem = (id, kps) => ({
  id, question: `错题 ${id}：求 $\\lim\\limits_{x\\to 0}\\frac{e^x-1-x}{x^2}$`,
  subject: '高等数学', answer: '$\\frac12$', knowledgePoints: kps,
  streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0,
  interval: 1, repetitions: 0, createdAt: new Date().toISOString(),
})

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}
/** 等待某个表达式为真（用于等模型返回） */
async function waitFor(expr, timeout = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(expr)) return true } catch { /* retry */ }
    await sleep(800)
  }
  return false
}
const clickText = (txt, sel = 'button') => ev(`(() => {
  const b = [...document.querySelectorAll('${sel}')].find((x) => x.textContent.includes(${JSON.stringify(txt)}))
  if (!b) return false
  b.click(); return true
})()`)

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_exam_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch('http://127.0.0.1:' + PORT + '/json/version')).ok) break } catch { /* retry */ }
    await sleep(250)
  }
  const t = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
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
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  // 准备：注入错题本（提供知识点，让「考察范围」有内容）
  await send('Page.navigate', { url: WEB + '/more' })
  await waitSel('.zy-page')
  await ev(`(() => {
    localStorage.removeItem('zhiyi_exam_v1')
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([
      ${JSON.stringify(errItem(1, ['洛必达法则', '未定式极限']))},
      ${JSON.stringify(errItem(2, ['定积分', '分部积分']))},
      ${JSON.stringify(errItem(3, ['洛必达法则', '等价无穷小']))},
    ]))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/more' })
  await waitSel('.zy-page')
  await sleep(900)

  // ① 更多页入口
  const hasEntry = await ev(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('模拟考试'))`)
  ok(hasEntry, '「更多」页有「模拟考试」入口')
  await clickText('模拟考试')
  await sleep(1200)
  ok((await ev('location.pathname')) === '/exam', '入口跳到 /exam', await ev('location.pathname'))
  await waitSel('.ex__modes')

  // ② 主页：三种模式 + 空历史
  const home = await ev(`(() => ({
    modes: [...document.querySelectorAll('.ex__mode-title')].map((e) => e.textContent.trim()),
    empty: !!document.querySelector('.ui-empty-state, .zy-empty'),
    list: document.querySelectorAll('.ex__row').length,
  }))()`)
  ok(home.modes.length === 4, '主页列出四种模式（含自定义题量）', home.modes)
  ok(home.list === 0, '初始没有历史成绩')

  // ③ 选「仅选择题」→ 进答题页
  await ev(`[...document.querySelectorAll('.ex__mode')].find((b) => b.textContent.includes('仅选择题')).click()`)
  await sleep(1200)
  ok((await ev('location.pathname')) === '/exam/run', '进入答题页')
  await waitSel('.er__block')
  const cfg = await ev(`(() => ({
    modes: document.querySelectorAll('.er__mode').length,
    activeMode: (document.querySelector('.er__mode.is-active .er__mode-title') || {}).textContent || '',
    kps: [...document.querySelectorAll('.er__kp')].map((e) => e.textContent.replace(/\\s+/g, '')),
    pickedKps: document.querySelectorAll('.er__kp.is-active').length,
    limits: document.querySelectorAll('.er__limit').length,
  }))()`)
  console.log('  · 配置页 →', JSON.stringify(cfg))
  ok(cfg.modes === 4, '配置页可选题型（含自定义）')
  ok(cfg.activeMode === '仅选择题', '带过来 URL 里的模式', cfg.activeMode)
  ok(cfg.kps.length >= 2 && cfg.pickedKps >= 2, '范围默认选中错题本薄弱知识点', { 候选: cfg.kps.length, 已选: cfg.pickedKps })
  ok(cfg.limits === 5, '限时可选（含不限时）', cfg.limits)

  // ③b 自定义题量面板
  await ev(`[...document.querySelectorAll('.er__mode')].find((b) => b.textContent.includes('自定义题量')).click()`)
  await sleep(600)
  const panel = await ev(`(() => {
    const rows = [...document.querySelectorAll('.er__custom-row')]
    return {
      open: !!document.querySelector('.er__custom'),
      rows: rows.length,
      fields: document.querySelectorAll('.er__custom-row .ui-number').length,
      sum: (document.querySelector('.er__custom-sum') || {}).textContent.replace(/\\s+/g, ' ').trim(),
    }
  })()`)
  console.log('  · 自定义面板 →', JSON.stringify(panel))
  ok(panel.open && panel.rows === 3 && panel.fields === 6, '自定义面板 3 行、每行「题量 + 每题分值」', panel)
  ok(/合计 5 道题 · 100 分/.test(panel.sum), '默认 5 道选择 × 20 分 = 100 分', panel.sum)

  // 填空改成 3 道 → 分值自动凑整齐（5×11 + 3×15 = 100）
  await ev(`(() => {
    const n = document.querySelectorAll('.er__custom-row')[1].querySelectorAll('.ui-number')
    n[0].value = '3'
    n[0].dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(700)
  const afterCustom = await ev(`(() => ({
    pairs: [...document.querySelectorAll('.er__custom-row')].map((r) => {
      const n = r.querySelectorAll('.ui-number')
      return [n[0].value, n[1].value]
    }),
    sum: (document.querySelector('.er__custom-sum') || {}).textContent.replace(/\\s+/g, ' ').trim(),
  }))()`)
  console.log('  · 改题量后 →', JSON.stringify(afterCustom))
  ok(afterCustom.pairs[0][1] === '11' && afterCustom.pairs[1][1] === '15', '分值自动凑整齐（选择 11、填空 15）', afterCustom.pairs)
  ok(/合计 8 道题 · 100 分/.test(afterCustom.sum), '合计 8 道题 = 100 分', afterCustom.sum)

  // 手改分值让总分不等于 100 → 应给出提示
  await ev(`(() => {
    const n = document.querySelectorAll('.er__custom-row')[1].querySelectorAll('.ui-number')
    n[1].value = '10'
    n[1].dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(600)
  const badCustom = await ev(`(() => ({
    sum: (document.querySelector('.er__custom-sum') || {}).textContent.replace(/\\s+/g, ' ').trim(),
    isBad: !!document.querySelector('.er__custom-sum.is-bad'),
  }))()`)
  ok(badCustom.isBad && /总分需正好 100/.test(badCustom.sum), '手改后总分不是 100 时给出提示', badCustom.sum)

  // 切回「仅选择题」继续标准流程
  await ev(`[...document.querySelectorAll('.er__mode')].find((b) => b.textContent.includes('仅选择题')).click()`)
  await sleep(600)

  // ④ 开始考试 → 真实组卷
  console.log('  · 开始组卷（等模型，最多 120s）…')
  await clickText('开始考试')
  await sleep(1500)
  ok(await ev(`!!document.querySelector('.er__loading')`), '显示组卷中状态')
  const generated = await waitFor(`!!document.querySelector('.er__options')`, 140000)
  ok(generated, '组卷完成并进入答题（出现选择题选项）')
  if (!generated) {
    console.log('  ! 组卷未在时限内完成，后续断言跳过')
    try { chrome.kill() } catch { /* noop */ }
    try { if (preview) preview.kill() } catch { /* noop */ }
    process.exit(1)
    return
  }
  const answer = await ev(`(() => {
    const qs = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}')
    const p = (qs.papers || [])[0] || {}
    return {
      count: (p.questions || []).length,
      total: (p.questions || []).reduce((s, q) => s + (q.score || 0), 0),
      navdots: document.querySelectorAll('.er__navdot').length,
      timer: (document.querySelector('.er__timer') || {}).textContent || '',
      hasMath: !!document.querySelector('.er__q-text'),
    }
  })()`)
  console.log('  · 答题页 →', JSON.stringify(answer))
  ok(answer.count === 20, '仅选择题生成 20 题', answer.count)
  ok(answer.total === 100, '合计 100 分', answer.total)
  ok(answer.navdots === answer.count, '题号导航与题数一致', answer.navdots)
  ok(/已用|剩余/.test(answer.timer), '显示计时', answer.timer)

  // ⑤ 作答：每题选 A，并故意留 3 题空白
  await ev(`(() => {
    const opts = document.querySelectorAll('.er__option')
    if (opts[0]) opts[0].click()
    return true
  })()`)
  await sleep(400)
  const answered = await ev(`(() => {
    // 逐题作答：前 17 题选 A，后 3 题留空
    const qs = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}')
    const paper = (qs.papers || [])[0] || {}
    const ids = (paper.questions || []).map((q) => q.id)
    return ids.length
  })()`)
  console.log('  · 题数 →', answered)
  // 用编程方式填答案（比逐题点击稳）：直接写 localStorage 的 paper.answers 再刷新
  await ev(`(() => {
    const raw = localStorage.getItem('zhiyi_exam_v1')
    const st = JSON.parse(raw || '{}')
    const p = (st.papers || [])[0]
    if (!p) return false
    p.answers = {}
    p.questions.forEach((q, i) => { if (i < p.questions.length - 3) p.answers[q.id] = 'A' })
    localStorage.setItem('zhiyi_exam_v1', JSON.stringify(st))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/exam/run?paper=' + (await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}')
    return ((st.papers || [])[0] || {}).id || ''
  })()`)) })
  await waitSel('.er__options')
  await sleep(900)
  const answeredUi = await ev(`document.querySelectorAll('.er__navdot.is-done').length`)
  ok(answeredUi === 17, '作答状态回填（17 题已答 / 3 题空白）', answeredUi)

  // ⑥ 交卷 → 本地判 + AI 判
  console.log('  · 交卷判分（等模型，最多 120s）…')
  await ev(`window.confirm = () => true`)
  await clickText('交卷')
  const graded = await waitFor(`!!document.querySelector('.er__score-num')`, 140000)
  ok(graded, '判卷完成并进入成绩页')
  if (graded) {
    const res = await ev(`(() => {
      const st = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}')
      const p = (st.papers || [])[0] || {}
      return {
        total: (document.querySelector('.er__score-num') || {}).textContent || '',
        meta: (document.querySelector('.er__score-meta') || {}).textContent.replace(/\\s+/g, ' ').trim(),
        chips: [...document.querySelectorAll('.er__chip')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()),
        wrongRows: document.querySelectorAll('.er__wrong-row').length,
        reviewItems: document.querySelectorAll('.er__review-item').length,
        gradedTotal: p.graded && p.graded.total,
        savedAnswers: Object.keys(p.answers || {}).length,
        durationSec: p.durationSec,
        hasNote: !!document.querySelector('.er__note'),
      }
    })()`)
    console.log('  · 成绩页 →', JSON.stringify(res))
    ok(Number(res.total) >= 0 && Number(res.total) <= 100, '总分在 0~100', res.total)
    ok(/得分率|对 .* 题/.test(res.meta), '显示得分率与对错题数', res.meta)
    ok(res.chips.length === 1, '分题型得分（仅选择题 1 类）', res.chips)
    ok(res.reviewItems === 20, '逐题复盘 20 条', res.reviewItems)
    ok(res.wrongRows >= 1, '列出错题供勾选入错题本', res.wrongRows)
    ok(res.savedAnswers === 17, '已保存 17 题作答', res.savedAnswers)
    ok(res.gradedTotal === Number(res.total), '成绩已落库', { 页面: res.total, 存储: res.gradedTotal })
    ok(res.hasNote, '标注「AI 评分仅供参考」')

    // ⑦ 错题加入错题本
    const before = await ev(`(JSON.parse(localStorage.getItem('zhiyi_errorbook_v1') || '[]')).length`)
    await clickText('加入错题本')
    await sleep(1200)
    const after = await ev(`(JSON.parse(localStorage.getItem('zhiyi_errorbook_v1') || '[]')).length`)
    ok(after > before, '错题已加入错题本', { 之前: before, 之后: after })

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, 'exam-result.png'), Buffer.from(shot.data, 'base64'))
  }

  // ⑧ 返回主页看历史
  await clickText('← 返回')
  await sleep(1200)
  await waitSel('.ex__list')
  const hist = await ev(`(() => ({
    rows: document.querySelectorAll('.ex__row').length,
    title: (document.querySelector('.ex__row-title') || {}).textContent || '',
    score: (document.querySelector('.ex__row-score') || {}).textContent || '',
    summary: (document.querySelector('.ex__history-head .t-label') || {}).textContent.replace(/\\s+/g, ' ').trim(),
  }))()`)
  console.log('  · 历史 →', JSON.stringify(hist))
  ok(hist.rows === 1, '历史出现 1 条记录', hist.rows)
  ok(/\/100/.test(hist.score), '历史显示分数', hist.score)
  ok(/平均/.test(hist.summary), '历史显示平均分', hist.summary)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '模拟考试端到端通过（' + pass + ' 项）' : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  try { chrome.kill() } catch { /* noop */ }
  try { if (preview) preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { chrome?.kill(); preview?.kill() } catch { /* noop */ }; process.exit(1) })
