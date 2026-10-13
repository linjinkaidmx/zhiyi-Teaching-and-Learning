/**
 * 验证 ③ 群聊实时化：建立 SSE 流 → 发消息 → 断言 2~5s 内自动收到
 * 用法：node _qa_chatstream.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  const T = ACC.teacher.token
  const S = ACC.student.token
  const gid = ACC.class_id

  // 历史基线
  const hist = await post('/api/group/messages', { token: T, group_id: gid, limit: 100 })
  const cursor = hist.items.length ? Math.max(...hist.items.map((m) => Number(m.created_at) || 0)) : 0
  console.log('历史消息数:', hist.items.length, '| 游标:', cursor)

  console.log('\n===== 建立 SSE 流（学生端） =====')
  const ctrl = new AbortController()
  const received = []
  let connected = false
  const readerP = (async () => {
    const res = await fetch(BASE + '/api/group/messages/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: S, group_id: gid, since: cursor }),
      signal: ctrl.signal,
    })
    if (!res.ok || !res.body) throw new Error('流未建立 HTTP ' + res.status)
    connected = true
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const frames = buf.split('\n\n')
      buf = frames.pop() || ''
      for (const f of frames) {
        const line = f.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '{}') continue
        try {
          const d = JSON.parse(payload)
          if (Array.isArray(d.items)) received.push(...d.items)
        } catch { /* 忽略坏帧 */ }
      }
    }
  })().catch((e) => { if (!ctrl.signal.aborted) console.log('  流结束:', String(e.message).slice(0, 60)) })

  await sleep(2500)
  ok(connected, 'SSE 流已建立（HTTP 200 且可读）', connected)

  console.log('\n===== 老师发一条消息 =====')
  const text = '实时性验证 ' + Date.now()
  const sent = await post('/api/group/send', { token: T, group_id: gid, type: 'text', content: text })
  ok(sent.ok !== false, '消息发送成功', sent.error || 'ok')

  // 最多等 8 秒
  let found = null
  for (let i = 0; i < 16; i++) {
    await sleep(500)
    found = received.find((m) => (m.content || '').includes(text))
    if (found) break
  }
  ok(!!found, '2~8 秒内自动推送到流（无需刷新）', found ? { id: found.id, content: found.content.slice(0, 24) } : { received: received.length })
  ok(received.length >= 1, '流里至少收到一条新消息', received.length)

  console.log('\n===== 权限：非班级成员不能订阅 =====')
  const res2 = await fetch(BASE + '/api/group/messages/stream', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'bad-token', group_id: gid, since: Date.now() }),
  })
  const txt = await res2.text()
  ok(/denied/.test(txt), '无效身份被拒绝（denied 事件）', txt.slice(0, 40))

  ctrl.abort()
  await readerP.catch(() => {})
  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
