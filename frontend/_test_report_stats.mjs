// 离线单测：Hero 副标题三档 / 下一章推导 / 今日课程 / 已掌握总结（2026-10-10）。node 直跑。
// 用法：node _test_report_stats.mjs
const { heroSubtitle, nextChapterOf, todayLessons, hasTimetable, reportOverview } =
  await import('./src/lib/reportStats.js')

let PASS = 0, FAIL = 0
const ok = (c, name, extra) => {
  if (c) { PASS++; console.log('  OK  ' + name) }
  else { FAIL++; console.log('  FAIL ' + name + '  ' + JSON.stringify(extra)) }
}

console.log('\n== 1. heroSubtitle 三档 ==')
ok(heroSubtitle({ pendingReview: 12 }) === '还记得那 12 道错题吗？再战一次就牢了', '待复习>0 档')
ok(heroSubtitle({ pendingReview: 0, todayQuestions: 5 }) === '5 题到手，今天状态在线', '今日有题档')
ok(heroSubtitle({}) === '别空手而归，拍一道题练练手', '空手档')
ok(heroSubtitle({ pendingReview: 3, todayQuestions: 5 }).includes('3 道错题'), '待复习优先于今日题')

console.log('\n== 2. nextChapterOf 下一章推导 ==')
const syl = {
  subject: '数据结构', total: 10, cursor: 4, kp_done: [0, 1, 2, 3],
  chapters: [
    { name: '第 1 章 绪论', count: 2 },
    { name: '第 2 章 线性表', count: 3 },
    { name: '第 3 章 栈与队列', count: 3 },
    { name: '第 4 章 树与二叉树', count: 2 },
  ],
}
let n = nextChapterOf(syl)
ok(n && n.subject === '数据结构', 'subject 透传', n)
ok(n.current === '第 2 章 线性表', 'cursor=4 落在第 2 章（idx 2-4 属第 2 章）', n)
ok(n.nextName === '第 3 章 栈与队列', '下一章名')
ok(n.doneSections === 4 && n.totalSections === 10, '节数进度')
ok(!n.isLastChapter && n.chapterNo === 2, '章号 2/4', n)

// 学到最后一章中途
n = nextChapterOf({ ...syl, cursor: 8, kp_done: [0,1,2,3,4,5,6,7] })
ok(n.isLastChapter && n.nextName === '第 4 章 树与二叉树', '最后一章未学完 → nextName=本章继续', n)

// 全部学完
n = nextChapterOf({ ...syl, cursor: 9, kp_done: [0,1,2,3,4,5,6,7,8,9] })
ok(n.finished === true, '学完标记')
ok(n.nextName === '', '学完无下一章')

// 单章兜底 + 空大纲
n = nextChapterOf({ subject: 'X', chapters: [{ name: 'A', count: 3 }], cursor: 0, kp_done: [], total: 3 })
ok(n && n.current === 'A' && n.isLastChapter, '单章结构')
ok(nextChapterOf(null) === null, 'null 大纲 → null')
ok(nextChapterOf({ subject: 'X', chapters: [], cursor: 0, total: 0 }) === null, '空章列表 → null')

console.log('\n== 3. todayLessons / hasTimetable ==')
const state = {
  courses: [{ id: 'c1', name: '数据结构' }, { id: 'c2', name: '高数' }],
  timetable: [
    { day: dow(), slot: 3, courseId: 'c1', location: 'A101' },
    { day: dow(), slot: 9, courseId: 'c2' },
    { day: ((dow() % 7) + 1), slot: 1, courseId: 'c1' }, // 明天的课，不该出现
  ],
}
function dow() { return ((new Date().getDay() + 6) % 7) + 1 }
const ls = todayLessons(state)
ok(ls.length === 2, '今天的课数量=2', ls)
ok(ls[0].name === '数据结构' && ls[0].start === '10:15', '第 3 节时段 10:15-10:55', ls[0])
ok(ls[1].name === '高数' && ls[1].start === '16:00', '按节次升序', ls[1])
ok(ls[0].location === 'A101', 'location 透传')
ok(todayLessons({ courses: [], timetable: [] }).length === 0, '空课表')
ok(hasTimetable(state) === true && hasTimetable({ timetable: [] }) === false, 'hasTimetable 判定')
ok(todayLessons(null).length === 0, 'null state 不炸')

console.log('\n== 4. reportOverview 已掌握总结 ==')
const book = [
  { kind: 'question', mastered: true },
  { kind: 'question', mastered: true },
  { kind: 'question', mastered: false },
  { kind: 'note', mastered: true }, // 笔记不计
]
const mbp = [
  { name: '二叉树', quiz: 10, mastery: 95 },
  { name: '排序', quiz: 8, mastery: 91 },
  { name: '动态规划', quiz: 6, mastery: 30 }, // <60 不进 best
  { name: '链表', quiz: 0, mastery: 0 },      // 无练习不计
]
const ro = reportOverview(book, mbp)
ok(ro.total === 3 && ro.mastered === 2, '总数/已掌握（笔记剔除）', ro)
ok(ro.rate === 67, '掌握率四舍五入', ro.rate)
ok(ro.bestPoints.length === 2 && ro.bestPoints[0].name === '二叉树', 'best 按掌握度排序', ro.bestPoints)
ok(ro.masteredPoints === 2, '掌握知识点数')
ok(reportOverview([]).total === 0 && reportOverview([]).rate === 0, '空错题本不炸')

console.log(`\n结果：${PASS} 通过 / ${FAIL} 失败`)
process.exit(FAIL ? 1 : 0)
