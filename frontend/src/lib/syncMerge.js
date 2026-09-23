/**
 * 云端合并的纯逻辑（批次1：课程 / 学习记录）
 * ---------------------------------------------------------------------------
 * 抽成纯函数的原因：合并语义最容易出错（尤其是"删了又被拉回来"），
 * 放这里可以脱离浏览器与 localStorage 直接跑测试。
 *
 * 合并原则：
 *   课程 / 排课 / 考试 —— 按 id 并集，同 id 取 updatedAt 较新者（旧数据无时间戳时本地优先兜底）；
 *                        两侧墓碑（deletedIds）取并集并据此剔除
 *   错题本 —— 按 id 并集，同 id 取 updatedAt 较新者（错题本暂无墓碑，删除不跨端）
 *   记录 —— 按 id 并集去重，按 createdAt 倒序，截断上限
 */

export const MAX_SESSIONS = 300
export const MAX_COURSES = 60
export const MAX_TOMBSTONES = 200

const asArray = (x) => (Array.isArray(x) ? x : [])
const key = (x) => (x == null ? '' : String(x))

/**
 * 同 id 冲突策略：取 updatedAt 较新的一方。
 * 无时间戳（旧数据）视为 0 —— 此时前者（本地）优先，保持改造前的兼容行为。
 */
function pickNewer(a, b) {
  const ta = Number(a && a.updatedAt) || 0
  const tb = Number(b && b.updatedAt) || 0
  return tb > ta ? b : a
}

/** 课程 / 章节 / 知识点 / 课表 合并 */
export function mergeCourses(localInput, remoteInput) {
  // 显式兜底：默认参数只对 undefined 生效，null 会穿透（云端返回 null 是常见情况）
  const local = localInput && typeof localInput === 'object' ? localInput : {}
  const remote = remoteInput && typeof remoteInput === 'object' ? remoteInput : {}
  const lDel = asArray(local.deletedIds).map(key)
  const rDel = asArray(remote.deletedIds).map(key)
  const deleted = [...new Set([...lDel, ...rDel])].slice(0, MAX_TOMBSTONES)
  const dead = new Set(deleted)

  const byId = new Map()
  // 同 id 冲突时按 updatedAt 取新（旧数据无时间戳 → 本地优先兜底）
  asArray(local.courses).forEach((c) => {
    if (c && c.id != null && !dead.has(key(c.id))) byId.set(key(c.id), c)
  })
  asArray(remote.courses).forEach((c) => {
    if (!c || c.id == null || dead.has(key(c.id))) return
    const cur = byId.get(key(c.id))
    byId.set(key(c.id), cur ? pickNewer(cur, c) : c)
  })
  const courses = [...byId.values()].slice(0, MAX_COURSES)

  // 课表：按 id 并集（同 id 取新），且剔除"课程已不存在"的排课
  const alive = new Set(courses.map((c) => key(c.id)))
  const slotMap = new Map()
  asArray(local.timetable).forEach((s) => {
    if (s && s.id != null) slotMap.set(key(s.id), s)
  })
  asArray(remote.timetable).forEach((s) => {
    if (!s || s.id == null) return
    const cur = slotMap.get(key(s.id))
    slotMap.set(key(s.id), cur ? pickNewer(cur, s) : s)
  })
  const timetable = [...slotMap.values()].filter((s) => alive.has(key(s.courseId)))

  return { courses, timetable, deletedIds: deleted }
}

/**
 * 课程表 v2 整体合并（批次课程表重做）
 * 输入/输出都是 { courses, timetable, exams, term, deletedIds, deletedSlotIds, deletedExamIds }
 * 语义：course/timetable/exam 各自「id 并集 + 同 id 取 updatedAt 较新者 + 墓碑剔除」；term 取 updatedAt 较新者。
 */
export function mergeSchedule(localInput, remoteInput) {
  const local = localInput && typeof localInput === 'object' ? localInput : {}
  const remote = remoteInput && typeof remoteInput === 'object' ? remoteInput : {}
  const asArr = (x) => (Array.isArray(x) ? x : [])
  const union = (a, b) => [...new Set([...asArr(a).map(key), ...asArr(b).map(key)])].slice(0, MAX_TOMBSTONES)

  const deletedIds = union(local.deletedIds, remote.deletedIds)
  const deletedSlotIds = union(local.deletedSlotIds, remote.deletedSlotIds)
  const deletedExamIds = union(local.deletedExamIds, remote.deletedExamIds)
  const deadCourse = new Set(deletedIds)
  const deadSlot = new Set(deletedSlotIds)
  const deadExam = new Set(deletedExamIds)

  // 课程：id 并集 + 同 id 取 updatedAt 较新者 + 剔除墓碑
  const courseMap = new Map()
  asArr(local.courses).forEach((c) => { if (c && c.id != null && !deadCourse.has(key(c.id))) courseMap.set(key(c.id), c) })
  asArr(remote.courses).forEach((c) => {
    if (!c || c.id == null || deadCourse.has(key(c.id))) return
    const cur = courseMap.get(key(c.id))
    courseMap.set(key(c.id), cur ? pickNewer(cur, c) : c)
  })
  const courses = [...courseMap.values()].slice(0, MAX_COURSES)
  const alive = new Set(courses.map((c) => key(c.id)))

  // 排课：id 并集 + 同 id 取新 + 剔除 slot 墓碑 + 剔除课程已删
  const slotMap = new Map()
  asArr(local.timetable).forEach((s) => { if (s && s.id != null && !deadSlot.has(key(s.id))) slotMap.set(key(s.id), s) })
  asArr(remote.timetable).forEach((s) => {
    if (!s || s.id == null || deadSlot.has(key(s.id))) return
    const cur = slotMap.get(key(s.id))
    slotMap.set(key(s.id), cur ? pickNewer(cur, s) : s)
  })
  const timetable = [...slotMap.values()].filter((s) => alive.has(key(s.courseId)))

  // 考试：id 并集 + 同 id 取新 + 剔除墓碑
  const examMap = new Map()
  asArr(local.exams).forEach((e) => { if (e && e.id != null && !deadExam.has(key(e.id))) examMap.set(key(e.id), e) })
  asArr(remote.exams).forEach((e) => {
    if (!e || e.id == null || deadExam.has(key(e.id))) return
    const cur = examMap.get(key(e.id))
    examMap.set(key(e.id), cur ? pickNewer(cur, e) : e)
  })
  const exams = [...examMap.values()]

  // 学期：取 updatedAt 较新者（相同则本地优先）
  const lt = local.term && typeof local.term === 'object' ? local.term : {}
  const rt = remote.term && typeof remote.term === 'object' ? remote.term : {}
  const term = (Number(rt.updatedAt) || 0) > (Number(lt.updatedAt) || 0) ? rt : lt

  return { courses, timetable, exams, term, deletedIds, deletedSlotIds, deletedExamIds }
}

/** 学习记录合并（只追加 + 去重 + 排序 + 截断） */
export function mergeSessions(local = [], remote = [], limit = MAX_SESSIONS) {
  const byId = new Map()
  asArray(local).forEach((r) => {
    if (r && r.id != null && !byId.has(key(r.id))) byId.set(key(r.id), r)
  })
  asArray(remote).forEach((r) => {
    if (r && r.id != null && !byId.has(key(r.id))) byId.set(key(r.id), r)
  })
  return [...byId.values()]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit)
}

/**
 * 模拟试卷合并：按 id 并集，同 id 取 updatedAt 较新者（与课程/错题本同一套策略），
 * 输出按 createdAt 倒序（与列表展示一致）。
 */
export function mergeExams(local = [], remote = []) {
  const byId = new Map()
  asArray(local).forEach((p) => {
    if (p && p.id != null) byId.set(key(p.id), p)
  })
  asArray(remote).forEach((p) => {
    if (!p || p.id == null) return
    const cur = byId.get(key(p.id))
    byId.set(key(p.id), cur ? pickNewer(cur, p) : p)
  })
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

/**
 * 错题本合并：按 id 并集，同 id 取 updatedAt 较新者（旧数据无时间戳 → 本地优先兜底）。
 * 排序与本地一致（createdAt 倒序）。
 *
 * 已知限制：错题本暂无删除墓碑 —— 一端删除后，若另一端仍持有该条目并再次推送，
 * 该条目会被合并回来。要彻底解决需引入 deletedIds 墓碑（与课程/课表同一套机制）。
 */
export function mergeErrorbook(local = [], remote = []) {
  const byId = new Map()
  asArray(local).forEach((it) => {
    if (it && it.id != null) byId.set(key(it.id), it)
  })
  asArray(remote).forEach((it) => {
    if (!it || it.id == null) return
    const cur = byId.get(key(it.id))
    byId.set(key(it.id), cur ? pickNewer(cur, it) : it)
  })
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}
