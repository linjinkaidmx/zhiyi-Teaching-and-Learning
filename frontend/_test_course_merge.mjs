import { setAccountScope, accountKey } from './src/lib/accountScope.js'
setAccountScope('test-user')
// 离线单测：courseStore 同名卡自动合并（2026-10-10）。node 直跑，mock localStorage。
// 用法：node _test_course_merge.mjs
const store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
}

const { initCourses, addCourse, addSlot, addExam, coursesRef } = await import('./src/stores/courseStore.js')

let PASS = 0, FAIL = 0
const ok = (c, name, extra) => {
  if (c) { PASS++; console.log('  OK  ' + name) }
  else { FAIL++; console.log('  FAIL ' + name + '  ' + JSON.stringify(extra)) }
}

initCourses('account')

// 造数据：高数两张同名卡（一张有排课+考试，一张只有名字）、数据结构两铜同名卡、乒乓球一张
const math1 = addCourse({ name: '高等数学', teacher: '张老师' })
const math2 = addCourse({ name: '高等数学！' })                      // 归一化同名
addSlot({ courseId: math2.id, day: 1, slot: 1, location: 'A101' })  // 排课挂在 math2
addExam({ courseId: math2.id, name: '期中考', date: '2026-11-01' })
const ds1 = addCourse({ name: '数据结构' })
const ds2 = addCourse({ name: ' 数据 结构 ' })                       // 归一化同名
const pingpong = addCourse({ name: '乒乓球' })

console.log('\n== 1. initCourses 时自动合并 ==')
const list = initCourses('account').map((c) => c.name)
ok(list.filter((n) => n.includes('高等数学')).length === 1, '高数合并剩一张', list)
ok(list.filter((n) => n.includes('数据结构')).length === 1, '数据结构合并剩一张', list)
ok(list.includes('乒乓球'), '单张卡不受影响')

console.log('\n== 2. 排课与考试归到保留卡，不丢失 ==')
const courses = coursesRef().value
const keptMath = courses.find((c) => c.name.includes('高等数学'))
const slots = JSON.parse(localStorage.getItem(accountKey('zhiyi_schedule_account_v2'))).timetable
  .filter((s) => s.courseId === keptMath.id)
const exams = JSON.parse(localStorage.getItem(accountKey('zhiyi_schedule_account_v2'))).exams
  .filter((e) => e.courseId === keptMath.id)
ok(slots.length === 1 && slots[0].location === 'A101', 'math2 的排课时段改挂到保留卡', slots)
ok(exams.length === 1 && exams[0].name === '期中考', '考试引用改挂到保留卡', exams)

console.log('\n== 3. 删除的卡进墓碑（云同步另一端也会删） ==')
// 保留规则：被时段/考试引用多的卡胜出 → math2 保留；数据结构两张完全等价（同毫秒时间戳），
// 保留哪张不确定——断言「恰好一张进墓碑」而不是具体哪张
const tomb = JSON.parse(localStorage.getItem(accountKey('zhiyi_schedule_account_v2'))).deletedIds.map(String)
ok(tomb.includes(String(math1.id)), 'math1（无引用，对手有排课+考试）进墓碑', tomb)
const dsIds = [String(ds1.id), String(ds2.id)]
ok(dsIds.filter((id) => tomb.includes(id)).length === 1, '数据结构两卡恰好一张进墓碑', tomb)
ok(!tomb.includes(String(math2.id)) && !tomb.includes(String(pingpong.id))
   && !dsIds.every((id) => tomb.includes(id)), '保留卡与无关卡不进墓碑', tomb)
const keptIsMath2 = courses.find((c) => c.id === math2.id)
ok(!!keptIsMath2, '保留的是被引用多的 math2')

console.log('\n== 4. 幂等：再跑一次不变化 ==')
const n0 = coursesRef().value.length
initCourses('account')
ok(coursesRef().value.length === n0, '重复初始化数量不变')

console.log('\n------ %d passed, %d failed ------', PASS, FAIL)
console.log(`------ ${PASS} passed, ${FAIL} failed ------`)
process.exit(FAIL ? 1 : 0)
