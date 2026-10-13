/**
 * Hero 改版 + AI 学情报告 + 今日学习建议 的纯逻辑层（脱离浏览器可单测）。
 * ---------------------------------------------------------------------------
 *   heroSubtitle()      三档鼓励型动态副标题
 *   nextChapterOf()     教学大纲 payload → 「接下来往哪学」信息
 *   todayLessons()      课程表 state → 今天的课（含时段）
 *   reportOverview()    错题本 → 已掌握总结（免费自动算的部分）
 */

export function heroSubtitle({ pendingReview = 0, todayQuestions: todayQ = 0 } = {}) {
  if (pendingReview > 0) return `还记得那 ${pendingReview} 道错题吗？再战一次就牢了`
  if (todayQ > 0) return `${todayQ} 题到手，今天状态在线`
  return '别空手而归，拍一道题练练手'
}

/**
 * 教学大纲（teachSyllabi 的单条 payload）→ 下一步学什么。
 * 返回 null = 没开课或已学完；否则：
 *   { subject, current, nextName, doneSections, totalSections, isLastChapter }
 */
export function nextChapterOf(syl) {
  if (!syl || !Array.isArray(syl.chapters) || !syl.chapters.length) return null
  const chapters = syl.chapters
  const total = Math.max(1, Number(syl.total) || chapters.reduce((s, c) => s + (Number(c.count) || 0), 0))
  const cursor = Math.min(Math.max(0, Number(syl.cursor) || 0), total - 1)
  const done = Array.isArray(syl.kp_done) ? syl.kp_done.length : 0

  let acc = 0
  let ci = 0
  for (ci = 0; ci < chapters.length; ci++) {
    acc += Number(chapters[ci].count) || 0
    if (cursor < acc) break
  }
  const ci2 = Math.min(ci, chapters.length - 1)
  const chapterStart = acc - (Number(chapters[ci2].count) || 0)
  const inChapterIdx = cursor - chapterStart
  const cur = chapters[ci2]
  const next = chapters[ci2 + 1] || null

  if (next) {
    return {
      subject: syl.subject || syl.title || 'AI 课堂',
      current: cur ? cur.name : '',
      nextName: next.name,
      doneSections: done,
      totalSections: total,
      isLastChapter: false,
      chapterNo: ci2 + 1,
      chapterTotal: chapters.length,
      /** 当前章还剩几节没学（含游标所在节） */
      restInChapter: Math.max(1, (Number(cur.count) || 1) - inChapterIdx),
    }
  }
  // 最后一章：看节是否学完
  const lastDone = cursor >= total - 1
  return {
    subject: syl.subject || syl.title || 'AI 课堂',
    current: cur ? cur.name : '',
    nextName: lastDone ? '' : cur ? cur.name : '',
    doneSections: done,
    totalSections: total,
    isLastChapter: true,
    chapterNo: chapters.length,
    chapterTotal: chapters.length,
    restInChapter: Math.max(1, total - cursor),
    finished: lastDone && done >= total,
  }
}

/**
 * 课程表 state（courseStore 的 { courses, timetable }）→ 今天的课，按节次升序。
 * 返回 [{ name, start, end, location }]
 */
export function todayLessons(state, now = new Date()) {
  if (!state || !Array.isArray(state.timetable)) return []
  const day = ((now.getDay() + 6) % 7) + 1 // 周一=1 … 周日=7
  const courses = new Map((state.courses || []).map((c) => [c.id, c]))
  const slotsStart = { 1: '08:30', 2: '09:20', 3: '10:15', 4: '11:00', 5: '11:45', 6: '13:30', 7: '14:15', 8: '15:00', 9: '16:00', 10: '16:45', 11: '19:00', 12: '19:40', 13: '20:30', 14: '21:10' }
  const slotsEnd = { 1: '09:15', 2: '10:00', 3: '10:55', 4: '11:40', 5: '12:25', 6: '14:10', 7: '14:55', 8: '15:40', 9: '16:40', 10: '17:25', 11: '19:40', 12: '20:20', 13: '21:10', 14: '21:45' }
  return state.timetable
    .filter((s) => Number(s.day) === day)
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((s) => {
      const c = courses.get(s.courseId) || {}
      const k = Number(s.slot)
      return {
        name: c.name || s.name || '未命名课程',
        start: slotsStart[k] || '',
        end: slotsEnd[k] || '',
        location: s.location || c.location || '',
      }
    })
}

/** 课表是否有任何课（引导「去完善课表」的判定） */
export function hasTimetable(state) {
  return !!(state && Array.isArray(state.timetable) && state.timetable.length)
}

/**
 * 错题本 → 报告页第一段「已掌握总结」。
 * 返回 { total, mastered, rate, quizAccuracy, bestPoints:[{name, rate}] }
 */
export function reportOverview(book, masteryByPoint = []) {
  const list = Array.isArray(book) ? book : []
  const total = list.filter((it) => it && it.kind !== 'note').length
  const mastered = list.filter((it) => it && it.kind !== 'note' && it.mastered).length
  const points = (Array.isArray(masteryByPoint) ? masteryByPoint : [])
    .filter((p) => p && p.name && p.quiz > 0)
  const best = points
    .filter((p) => p.mastery >= 60)
    .sort((a, b) => b.mastery - a.mastery || b.quiz - a.quiz)
    .slice(0, 6)
  return {
    total,
    mastered,
    rate: total > 0 ? Math.round((mastered / total) * 100) : 0,
    bestPoints: best.map((p) => ({ name: p.name, rate: p.mastery })),
    masteredPoints: best.length,
  }
}
