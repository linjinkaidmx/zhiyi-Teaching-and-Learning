/**
 * P7 AI 对话：存储 + 流式 Mock 的纯逻辑测试（Node，无需浏览器）
 * 用法：node _test_chat.mjs
 */
// localStorage 打桩（chatStore 依赖）
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const {
  conversations, initChat, createChat, getChat, removeChat, renameChat, clearChats,
  appendMessage, updateMessage, truncateAfter, setActive,
} = await import('./src/stores/chatStore.js')
const { sendMock } = await import('./src/lib/mock/chat.js')
// 真实后端已实现 → config 里 MOCK.chat=false；本测试只验证 Mock 逻辑本身，故临时置真
const { MOCK } = await import('./src/config/app.js')
MOCK.chat = true

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + label)
  } else {
    fail += 1
    console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
  }
}
const section = (t) => console.log('\n' + t)

section('1. 会话存储（双空间 + 持久化）')
initChat('guest')
ok(conversations.value.length === 0, '游客空间初始为空')
const id1 = createChat()
ok(!!id1 && getChat(id1), '新建会话成功')
ok(conversations.value.length === 1, '会话进入列表')

appendMessage(id1, { role: 'user', text: '帮我讲讲指针和数组的区别，越细越好' })
ok(getChat(id1).title !== '新对话', '首条用户消息自动成为标题')
ok(getChat(id1).title.length <= 18, '标题被截断到 18 字内', getChat(id1).title)

const a1 = appendMessage(id1, { role: 'assistant', text: '第一段', streaming: true })
ok(getChat(id1).messages.length === 2, '助手消息已追加')
updateMessage(id1, a1.id, { text: '第一段第二段', streaming: false })
ok(getChat(id1).messages[1].text === '第一段第二段' && getChat(id1).messages[1].streaming === false, '消息可增量更新并结束流式')

ok(store.get('zhiyi_chat_v1') && JSON.parse(store.get('zhiyi_chat_v1')).length === 1, '已写入游客 localStorage key')

section('2. 重新生成 / 截断语义')
const u2 = appendMessage(id1, { role: 'user', text: '再来一道类似的' })
appendMessage(id1, { role: 'assistant', text: '第二条回答' })
ok(getChat(id1).messages.length === 4, '现在共 4 条消息')
truncateAfter(id1, u2.id)
ok(getChat(id1).messages.length === 3, 'truncateAfter 截掉该条之后的内容（保留用户消息本身）')
ok(getChat(id1).messages[2].role === 'user', '截断后最后一条是用户消息（可原地重跑）')

section('2.5 关键回归：路由参数是字符串，也要能查到会话（真实踩过的 bug）')
const idStr = createChat()
appendMessage(idStr, { role: 'user', text: '用字符串 id 查找' })
ok(!!getChat(idStr), '数字 id 能查到')
ok(!!getChat(String(idStr)), '字符串 id 也能查到（路由参数就是字符串）')
ok(getChat(String(idStr)).messages.length === 1, '字符串 id 查到的是同一个会话')
setActive(String(idStr))
removeChat(String(idStr))
ok(!getChat(idStr), '用字符串 id 删除也能生效（不会删不掉）')
ok(conversations.value.length === 1, '只删掉目标会话，其余不受影响', conversations.value.length)

section('2.6 关键回归：历史消息必须能按「显式 id」取到（sent 时 route 还没更新）')
const cid = createChat()
appendMessage(cid, { role: 'user', text: '第一问' })
appendMessage(cid, { role: 'assistant', text: '第一答' })
appendMessage(cid, { role: 'assistant', text: '', streaming: true })
const usable = (getChat(cid).messages || []).filter((m) => !m.streaming && !m.error)
ok(usable.length === 2, '流式中/出错的助手消息不进历史', usable.length)
ok(usable[0].text === '第一问' && usable[1].text === '第一答', '历史内容与顺序正确')
ok(getChat(String(cid)) !== null, '用字符串 id 也能取到（路由参数形态）')
removeChat(cid)

section('3. 双空间隔离')
initChat('account')
ok(conversations.value.length === 0, '切到账号空间后看不到游客会话')
const id2 = createChat()
appendMessage(id2, { role: 'user', text: '账号空间的对话' })
ok(store.get('zhiyi_chat_account_v1') && store.get('zhiyi_chat_account_v1').includes('账号空间的对话'), '账号空间写入独立 key')
initChat('guest')
ok(getChat(id1) && getChat(id1).messages.length === 3, '切回游客空间数据仍在')

section('4. 删除 / 重命名 / 清空')
renameChat(id1, '概率论问题')
ok(getChat(id1).title === '概率论问题', '重命名生效')
removeChat(id1)
ok(!getChat(id1), '删除生效')
clearChats()
ok(conversations.value.length === 0, '清空生效')

section('5. 流式 Mock（onDelta 逐段 + 可中断）')
let assembled = ''
// 这里直接测 Mock 流式逻辑；真实 /api/chat/stream 由线上 CDP 检查覆盖（见 _p9_probe.mjs 第 8 节）
const res = await sendMock(
  { messages: [{ role: 'user', text: '什么是时间复杂度？' }], context: [{ id: 1, title: '二分查找错题', brief: '数组' }] },
  { onDelta: (c) => { assembled += c } },
)
ok(res && res.ok === true, '流式调用成功返回')
ok(assembled.length > 40, '逐段回调拼出完整回答', assembled.length)
ok(assembled.includes('二分查找错题'), '引用的学习内容进入回答上下文')
ok(assembled.includes('时间复杂度'), '用户问题进入回答')

let aborted = ''
let abortedOk = false
const ctrl = new AbortController()
try {
  await sendMock(
    { messages: [{ role: 'user', text: 'x' }], context: [] },
    { onDelta: (c) => { aborted += c; if (aborted.length > 10) ctrl.abort() }, signal: ctrl.signal },
  )
} catch (e) {
  abortedOk = e && e.name === 'AbortError'
}
ok(abortedOk, '中断时抛 AbortError（供「停止生成」使用）')
ok(aborted.length < 600, '中断后不再继续产出', aborted.length)

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
