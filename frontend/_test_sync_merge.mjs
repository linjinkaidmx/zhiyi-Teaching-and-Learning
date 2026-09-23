/**
 * 批次1 前端测试：云端合并语义（课程 / 学习记录）
 * 重点验证「删了又被拉回来」这个最容易出错的场景。
 * 用法：node _test_sync_merge.mjs
 */
const { mergeCourses, mergeSchedule, mergeSessions, mergeErrorbook, MAX_SESSIONS, MAX_COURSES } = await import('./src/lib/syncMerge.js')

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

const C = (id, name = '课' + id) => ({ id, name, chapters: [] })

section('1. 课程：本地优先 + 云端补缺')
let m = mergeCourses({ courses: [C('a', '本地数据结构')] }, { courses: [C('a', '云端旧名'), C('b', '云端高数')] })
ok(m.courses.length === 2, '并集后 2 门课', m.courses.map((c) => c.name))
ok(m.courses.find((c) => c.id === 'a').name === '本地数据结构', '同 id 时以本地为准（本地是当前真身）')
ok(!!m.courses.find((c) => c.id === 'b'), '云端独有的课被补进来')

section('2. 关键场景：本地删掉的课不能被杀回来')
// 设备A 删了 X（墓碑在本地）→ 推送后云端带墓碑；设备B 本地仍有 X → 合并必须丢掉 X
m = mergeCourses(
  { courses: [C('x', '数据结构'), C('y', '高数')], deletedIds: ['x'] },
  { courses: [C('x', '数据结构'), C('z', '线代')], deletedIds: ['x'] },
)
ok(!m.courses.find((c) => c.id === 'x'), '墓碑里的课程被剔除（不会复活）')
ok(!!m.courses.find((c) => c.id === 'y') && !!m.courses.find((c) => c.id === 'z'), '其它课程保留')
ok(m.deletedIds.includes('x'), '墓碑保留在合并结果里（继续传给下一个设备）')

section('3. 墓碑取并集')
m = mergeCourses({ courses: [], deletedIds: ['a'] }, { courses: [], deletedIds: ['b'] })
ok(m.deletedIds.includes('a') && m.deletedIds.includes('b'), '两侧墓碑取并集', m.deletedIds)

section('4. 课表：并集 + 剔除已不存在课程的排课')
m = mergeCourses(
  { courses: [C('a')], timetable: [{ id: 's1', courseId: 'a', day: 1, slot: 1 }, { id: 's2', courseId: 'gone', day: 2, slot: 1 }] },
  { courses: [], timetable: [{ id: 's3', courseId: 'a', day: 3, slot: 2 }, { id: 's1', courseId: 'a', day: 9, slot: 9 }] },
)
ok(m.timetable.length === 2, '课表并集去重后 2 条（s1 去重 + s3）', m.timetable.map((s) => s.id))
ok(m.timetable.find((s) => s.id === 's1').day === 1, '同 id 排课以本地为准')
ok(!m.timetable.find((s) => s.id === 's2'), '课程不存在的排课被剔除')

section('5. 课程上限保护')
const many = { courses: Array.from({ length: 80 }, (_, i) => C('c' + i)) }
m = mergeCourses(many, {})
ok(m.courses.length === MAX_COURSES, `课程裁剪到上限 ${MAX_COURSES}`)

section('6. 学习记录：并集去重 + 倒序 + 截断')
const S = (id, ts) => ({ id, type: 'quiz', title: 't' + id, createdAt: ts })
m = mergeSessions([S('a', 100), S('b', 300)], [S('b', 300), S('c', 200)])
ok(m.length === 3, '按 id 去重（b 只出现一次）')
ok(m.map((x) => x.id).join(',') === 'b,c,a', '按 createdAt 倒序', m.map((x) => x.id))

const big = Array.from({ length: 250 }, (_, i) => S('l' + i, i))
const big2 = Array.from({ length: 250 }, (_, i) => S('r' + i, 1000 + i))
m = mergeSessions(big, big2)
ok(m.length === MAX_SESSIONS, `合并后截断到 ${MAX_SESSIONS}`)
ok(m[0].createdAt === 1249, '保留最新的记录（最新的一条在最前）', m[0])

section('8. 同 id 按 updatedAt 取新 —— 修复「修改同步不过去」')
// 云端更新 → 采用云端（此前「本地优先」会把云端的新版本丢掉）
let s1 = mergeSchedule(
  { courses: [{ id: 'c1', name: '旧名', updatedAt: 1000 }], timetable: [], exams: [] },
  { courses: [{ id: 'c1', name: '新名', updatedAt: 2000 }], timetable: [], exams: [] },
)
ok(s1.courses[0].name === '新名', '课程：云端 updatedAt 更新 → 采用云端')
// 本地更新 → 采用本地
let s2 = mergeSchedule(
  { courses: [{ id: 'c1', name: '本地新名', updatedAt: 3000 }], timetable: [], exams: [] },
  { courses: [{ id: 'c1', name: '云端旧名', updatedAt: 2000 }], timetable: [], exams: [] },
)
ok(s2.courses[0].name === '本地新名', '课程：本地 updatedAt 更新 → 采用本地')
// 旧数据（无时间戳）→ 本地优先兜底（兼容改造前行为）
let s3 = mergeSchedule(
  { courses: [{ id: 'c1', name: '本地旧数据' }], timetable: [], exams: [] },
  { courses: [{ id: 'c1', name: '云端旧数据' }], timetable: [], exams: [] },
)
ok(s3.courses[0].name === '本地旧数据', '旧数据（无 updatedAt）→ 本地优先兜底')
// 排课修改
let s4 = mergeSchedule(
  { courses: [{ id: 'c1', updatedAt: 1 }], timetable: [{ id: 't1', courseId: 'c1', location: '旧教室', updatedAt: 1000 }], exams: [] },
  { courses: [{ id: 'c1', updatedAt: 1 }], timetable: [{ id: 't1', courseId: 'c1', location: '新教室', updatedAt: 2000 }], exams: [] },
)
ok(s4.timetable[0].location === '新教室', '排课：取 updatedAt 较新者（改教室能同步）')
// 考试修改
let s5 = mergeSchedule(
  { courses: [], timetable: [], exams: [{ id: 'e1', name: '旧考试', updatedAt: 1000 }] },
  { courses: [], timetable: [], exams: [{ id: 'e1', name: '新考试', updatedAt: 2000 }] },
)
ok(s5.exams[0].name === '新考试', '考试：取 updatedAt 较新者')

section('9. 错题本合并（新增）')
const E = (id, createdAt, updatedAt, q) => ({ id, createdAt, updatedAt, question: q })
let e1 = mergeErrorbook([E('a', 100, 1000, '本地题A')], [E('a', 100, 2000, '云端题A'), E('b', 200, 2000, '云端题B')])
ok(e1.length === 2, '错题本：按 id 并集', e1.map((x) => x.question))
ok(e1.find((x) => x.id === 'a').question === '云端题A', '错题本：同 id 取 updatedAt 较新者')
ok(!!e1.find((x) => x.id === 'b'), '错题本：云端独有条目被补进来')
ok(e1[0].createdAt === 200, '错题本：按 createdAt 倒序')
ok(mergeErrorbook(null, undefined).length === 0, '错题本：null/undefined 安全')
let e2 = mergeErrorbook([E('x', 1, 100, '本地')], [E('x', 1, 50, '云端较旧')])
ok(e2[0].question === '本地', '错题本：本地较新时保留本地')

section('7. 异常输入不炸')
ok(mergeCourses(null, undefined).courses.length === 0, 'null/undefined 入参安全')
ok(mergeSessions(null, undefined).length === 0, 'null/undefined 入参安全')
ok(mergeSessions([{ id: 'x' }, null, 5, { noId: 1 }], []).length === 1, '非法记录被过滤，只剩合法项')
ok(mergeCourses({ courses: [null, { noId: 1 }, C('ok')] }, {}).courses.length === 1, '非法课程被过滤')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
