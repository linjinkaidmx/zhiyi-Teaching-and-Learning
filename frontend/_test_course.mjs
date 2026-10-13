/**
 * courseStore v2（课程表重做版）纯逻辑测试（Node，无需浏览器）
 * 用法：node _test_course.mjs
 */
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const {
  deletedIdsRef, coursesCloudPayload, applyCloudCourses,
  getCourse, coursesRef, timetableRef, examsRef, termRef, initCourses,
  addCourse, updateCourse, removeCourse,
  addSlot, removeSlot, slotAt, weekGrid, clearCourses, courseSummary,
  addExam, updateExam, removeExam, upcomingExams, examsOn, setTerm, weekInfo,
  SLOTS, DAYS, currentWeekIndex,
} = await import('./src/stores/courseStore.js')

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) { pass += 1; console.log('  ✓ ' + label) }
  else { fail += 1; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
}
const section = (t) => console.log('\n' + t)

section('1. 14 节次与 7 天')
ok(SLOTS.length === 14, '14 个节次')
ok(SLOTS[0].start === '08:30' && SLOTS[0].end === '09:15', '第1节 08:30-09:15')
ok(SLOTS[13].start === '21:10' && SLOTS[13].end === '21:45', '第14节 21:10-21:45')
ok(SLOTS[10].start === '19:00' && SLOTS[10].end === '19:40', '第11节 19:00-19:40')
ok(DAYS.length === 7 && DAYS[5] === '周六' && DAYS[6] === '周日', '含周六周日')

section('2. 课程（name/teacher/location）')
initCourses('guest')
ok(coursesRef().value.length === 0, '初始为空')
const c = addCourse({ name: '数据结构', teacher: '王老师', location: '教三 302' })
ok(!!c && c.id && c.location === '教三 302', '新增课程含教室')
ok(c.color, '自动配色')
ok(addCourse({ name: '   ' }) === null, '空名拒绝')
ok(c.term === undefined, '旧 term 字段已移除')
updateCourse(c.id, { location: '教一 101' })
ok(getCourse(c.id).location === '教一 101', '更新教室')

section('3. 章节功能已移除（读取时剔除历史字段）')
ok(!('chapters' in getCourse(c.id)), '新建课程不再带 chapters 字段', Object.keys(getCourse(c.id)))
ok(typeof addChapter === 'undefined' && typeof allPointNames === 'undefined', '章节相关 API 已从 store 移除')

section('4. 排课（day/slot/location/weeks）')
const s = addSlot({ courseId: c.id, day: 6, slot: 3, location: '教一 101', weeks: { type: 'odd' } })
ok(!!s && s.weeks.type === 'odd' && s.day === 6, '周六第3节单周排课')
ok(addSlot({ courseId: c.id, day: 6, slot: 3 }) === null, '同一格重复排课被拒绝')
ok(slotAt(6, 3) !== null, 'slotAt 命中')
ok(weekGrid().find((d) => d.day === 6).items.length === 1, '全量 weekGrid 含周六课')
ok(weekGrid(4).find((d) => d.day === 6).items.length === 0, '双周(4)过滤掉单周课')
ok(weekGrid(3).find((d) => d.day === 6).items.length === 1, '单周(3)保留单周课')

section('5. 考试')
const e = addExam({ courseId: c.id, name: '数据结构期末', date: '2099-06-20', startTime: '09:00', endTime: '11:00', location: '教三 201' })
ok(!!e && e.name === '数据结构期末', '加考试')
ok(examsOn('2099-06-20').length === 1, '按日期查考试')
const old = addExam({ name: '已过期', date: '2000-01-01' })
ok(upcomingExams(10).some((x) => x.id === e.id), '未来考试在近期列表')
ok(!upcomingExams(10).some((x) => x.id === old.id), '过期考试不进近期列表')
updateExam(e.id, { location: '教四 401' })
ok(examsRef().value.find((x) => x.id === e.id).location === '教四 401', '更新考试')
removeExam(e.id)
ok(examsRef().value.length === 1, '删除考试（剩 old）')

section('6. 学期设置')
ok(weekInfo().configured === false, '未设置时 configured=false')
setTerm({ startDate: '2026-09-07', totalWeeks: 20 })
const wi = weekInfo()
ok(wi.configured === true && wi.totalWeeks === 20 && wi.startDate === '2026-09-07', '设置学期')
ok(currentWeekIndex() > 0, '设置后当前周 > 0')
setTerm({ totalWeeks: 18 })
ok(weekInfo().totalWeeks === 18, '改学期长度')

section('7. 删除墓碑（换设备同步不复活）')
const s2 = addSlot({ courseId: c.id, day: 1, slot: 1 })
removeSlot(s2.id)
ok(coursesCloudPayload().deletedSlotIds.includes(String(s2.id)), '删除排课进墓碑')
const e2 = addExam({ name: '删我', date: '2099-01-01' })
removeExam(e2.id)
ok(coursesCloudPayload().deletedExamIds.includes(String(e2.id)), '删除考试进墓碑')
removeCourse(c.id)
ok(coursesCloudPayload().deletedIds.includes(String(c.id)), '删除课程进墓碑')

section('8. 云同步（覆盖 + 合并 + term 取新）')
initCourses('account')
addCourse({ name: '本地课', teacher: 'A' })
const remote = {
  courses: [{ id: 999, name: '云端课', teacher: 'B', location: '', chapters: [] }],
  timetable: [{ id: 888, courseId: 999, day: 2, slot: 2, location: '', weeks: { type: 'every' } }],
  exams: [{ id: 777, name: '云端考', date: '2099-02-02' }],
  term: { startDate: '2026-09-01', totalWeeks: 21, updatedAt: 200 },
  deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
}
applyCloudCourses(remote)
ok(coursesRef().value.length === 2, '合并后本地+云端课程并集')
ok(timetableRef().value.length === 1, '合并后排课并集')
ok(termRef().value.startDate === '2026-09-01', 'term 取 updatedAt 较新者')
ok(examsRef().value.length === 1, '合并后考试并集')

section('9. 覆盖式同步')
const localCourseId = coursesRef().value.find((x) => x.name === '本地课').id
applyCloudCourses({ courses: [], timetable: [], exams: [], term: { startDate: '', totalWeeks: 20, updatedAt: 0 }, deletedIds: [], deletedSlotIds: [], deletedExamIds: [] }, { merge: false })
ok(coursesRef().value.length === 0, 'merge=false 覆盖为空')
ok(localCourseId !== undefined, '（本地课 id 存在，仅被覆盖）')

section('10. 双空间隔离')
initCourses('guest')
addCourse({ name: '游客空间课' })
initCourses('account')
ok(coursesRef().value.length === 0, '账号空间与游客空间隔离')

section('11. 章节字段历史数据迁移')
// 模拟带 chapters 的旧数据，读取时应被剔除
store.set('zhiyi_schedule_v2', JSON.stringify({
  courses: [{ id: 'old1', name: '旧课', teacher: '', location: '', chapters: [{ id: 'c1', name: '第1章', points: [{ id: 'p1', name: '知识点' }] }] }],
  timetable: [], exams: [],
}))
initCourses('guest')
ok(!('chapters' in getCourse('old1')), '历史课程的 chapters 字段被剔除', Object.keys(getCourse('old1')))
ok(getCourse('old1').name === '旧课', '课程其余字段保留', getCourse('old1').name)

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
