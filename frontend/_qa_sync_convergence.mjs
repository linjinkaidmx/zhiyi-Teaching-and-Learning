/**
 * 多端同步收敛性 · 端到端验证（真实服务器 + 真实合并逻辑）
 * ---------------------------------------------------------------------------
 * 模拟两台设备走真实 /api/sync/push + /api/sync/pull，配合前端 mergeSchedule / mergeErrorbook，
 * 断言：①B 端能拿到 A 端数据 ②A 端改了课程（修改）B 端能同步到 ③两端错题本收敛为并集。
 * 用法：node _qa_sync_convergence.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://193.112.28.51:3300').replace(/\/$/, '')
const { mergeSchedule, mergeErrorbook } = await import('./src/lib/syncMerge.js')

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const post = async (p, body) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

const now = Date.now()
const T1 = now - 10000
const T2 = now

async function main() {
  console.log('目标服务器：' + BASE)
  const nick = 'synctest' + String(now).slice(-8)
  const pw = 'test123456'

  // 注册临时测试账号
  const reg = await post('/api/account/register', { nickname: nick, password: pw, password_confirm: pw, client_id: 'qa-sync' })
  if (!reg.ok) {
    console.log('  ✗ 注册测试账号失败：' + (reg.error || ''))
    process.exit(1)
  }
  const token = reg.token
  console.log('  · 测试账号 ' + nick + ' 已注册')

  // ---------- 设备 A：有 1 门课 + 1 道错题，推送
  const courseA = { id: 'c1', name: '数据结构', teacher: '王老师', location: '教三302', chapters: [], updatedAt: T1 }
  const itemA = { id: 'q1', question: '计算积分', subject: '高等数学', knowledgePoints: ['定积分'], streak: 0, mastered: false, createdAt: T1, updatedAt: T1 }
  const pushA = await post('/api/sync/push', { token, items: [itemA], stats: {}, courses: { courses: [courseA], timetable: [], exams: [], deletedIds: [], deletedSlotIds: [], deletedExamIds: [] }, sessions: [] })
  ok(pushA.ok, '设备A 推送成功', pushA)

  // ---------- 设备 B（本地为空）：拉取 + 合并
  const pullB = await post('/api/sync/pull', { token })
  const bCourses = mergeSchedule({ courses: [] }, pullB.courses || {})
  const bItems = mergeErrorbook([], pullB.items || [])
  ok(bCourses.courses.length === 1 && bCourses.courses[0].name === '数据结构', 'B 端拿到 A 端课程', bCourses.courses.map((c) => c.name))
  ok(bItems.length === 1 && bItems[0].id === 'q1', 'B 端拿到 A 端错题')

  // ---------- 设备 B：改课程名（修改场景）+ 新增一道错题 → 推送
  const courseB = { ...bCourses.courses[0], name: '数据结构（B改）', updatedAt: T2 }
  const itemB = { id: 'q2', question: '求极限', subject: '高等数学', knowledgePoints: ['极限'], streak: 0, mastered: false, createdAt: T2, updatedAt: T2 }
  const pushB = await post('/api/sync/push', {
    token,
    items: [itemA, itemB],
    stats: {},
    courses: { ...bCourses, courses: [courseB] },
    sessions: [],
  })
  ok(pushB.ok, '设备B 推送成功（改课程名 + 加错题）')

  // ---------- 设备 A：拉取 + 合并（A 本地仍是旧课程名 / 只有 q1）
  const pullA = await post('/api/sync/pull', { token })
  const aMerged = mergeSchedule({ courses: [courseA], timetable: [], exams: [], deletedIds: [], deletedSlotIds: [], deletedExamIds: [] }, pullA.courses || {})
  const aItems = mergeErrorbook([itemA], pullA.items || [])
  ok(aMerged.courses[0].name === '数据结构（B改）', '①A 端拿到 B 端对课程的【修改】（此前会同步失败）', aMerged.courses[0].name)
  ok(aItems.length === 2 && !!aItems.find((i) => i.id === 'q2'), '②错题本收敛为并集（q1 + q2）', aItems.map((i) => i.id))

  // ---------- 反向再推一次，验证最终收敛一致
  await post('/api/sync/push', { token, items: aItems, stats: {}, courses: aMerged, sessions: [] })
  const finalPull = await post('/api/sync/pull', { token })
  const finalItems = mergeErrorbook([], finalPull.items || [])
  const finalCourses = mergeSchedule({ courses: [] }, finalPull.courses || {})
  ok(finalItems.length === 2, '③云端最终错题数 = 2（无丢失、无重复）', finalItems.length)
  ok(finalCourses.courses.length === 1 && finalCourses.courses[0].name === '数据结构（B改）', '④云端最终课程名 = B 改后的版本', finalCourses.courses[0].name)

  // 清理测试账号
  const del = await post('/api/account/delete', { token, password: pw })
  console.log('  · 测试账号清理：' + (del.ok ? '已删除' : '删除失败（可手动忽略）'))

  console.log('\n' + '='.repeat(46))
  console.log(fail === 0 ? `多端同步收敛验证通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
