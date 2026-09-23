/**
 * courseStore · 课程表（重做版 v2）
 * ---------------------------------------------------------------------------
 * 相比 v1 的变化：
 *  - 节次：5 个合并大节 → 14 个精确到分钟的小节（SLOTS，start/end）
 *  - 课程：去掉 term，新增 location（教室）；teacher 保留
 *  - 排课：新增 weeks（每周/单周/双周/自定义区间）+ 可覆盖教室
 *  - 新增：考试 exams、学期设置 term（第一周周一 + 学期周数）
 *  - 存储：单一 key `zhiyi_schedule_v2`（guest/account 双空间），旧 v1 key 不再读取
 *  - 删除墓碑：courses / timetable / exams 各自独立，换设备同步不复活
 */
import { ref, computed } from 'vue'
import { nextId } from '../book.js'
import { mergeSchedule, MAX_COURSES, MAX_TOMBSTONES } from '../lib/syncMerge.js'
import { weekIndexFor, weekActiveIn, mondayOf, toDateStr, parseDate } from '../lib/termCalc.js'

const asArray = (x) => (Array.isArray(x) ? x : [])

const KEY = 'zhiyi_schedule_v2'
const KEY_ACC = 'zhiyi_schedule_account_v2'
// v1 旧 key：不再读取，初始化时清掉，避免残留
const LEGACY_KEYS = [
  'zhiyi_courses_v1', 'zhiyi_courses_account_v1',
  'zhiyi_timetable_v1', 'zhiyi_timetable_account_v1',
  'zhiyi_courses_deleted_v1', 'zhiyi_courses_deleted_account_v1',
]

/** 课程卡片可选底色 */
export const COURSE_COLORS = ['#3d5a8a', '#4a7a63', '#7a5f3d', '#6b4a7a', '#3d6a7a', '#7a3d4a']

/** 14 节，精确到分钟（用户确认的作息） */
export const SLOTS = [
  { key: 1, start: '08:30', end: '09:15' },
  { key: 2, start: '09:20', end: '10:00' },
  { key: 3, start: '10:15', end: '10:55' },
  { key: 4, start: '11:00', end: '11:40' },
  { key: 5, start: '11:45', end: '12:25' },
  { key: 6, start: '13:30', end: '14:10' },
  { key: 7, start: '14:15', end: '14:55' },
  { key: 8, start: '15:00', end: '15:40' },
  { key: 9, start: '16:00', end: '16:40' },
  { key: 10, start: '16:45', end: '17:25' },
  { key: 11, start: '19:00', end: '19:40' },
  { key: 12, start: '19:40', end: '20:20' },
  { key: 13, start: '20:30', end: '21:10' },
  { key: 14, start: '21:10', end: '21:45' },
]
export const SLOT_LABELS = SLOTS.map((s) => `第 ${s.key} 节 ${s.start}-${s.end}`)
export const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const DEFAULT_TERM = { startDate: '', totalWeeks: 20, updatedAt: 0 }

const state = ref(_emptyState())
let space = 'guest'

function _emptyState() {
  return {
    courses: [],
    timetable: [],
    exams: [],
    term: { ...DEFAULT_TERM },
    deletedIds: [],
    deletedSlotIds: [],
    deletedExamIds: [],
  }
}

const kk = (sp) => (sp === 'account' ? KEY_ACC : KEY)

function read(sp) {
  try {
    const raw = localStorage.getItem(kk(sp))
    if (!raw) return _emptyState()
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return _emptyState()
    return {
      // 章节功能已移除：读取时顺手剔除历史数据里的 chapters 字段（避免旧数据继续占空间）
      courses: asArray(o.courses).map((c) => {
        if (!c || typeof c !== 'object' || !('chapters' in c)) return c
        const { chapters, ...rest } = c
        return rest
      }),
      timetable: asArray(o.timetable),
      exams: asArray(o.exams),
      term: o.term && typeof o.term === 'object' ? { ...DEFAULT_TERM, ...o.term } : { ...DEFAULT_TERM },
      deletedIds: asArray(o.deletedIds).map(String),
      deletedSlotIds: asArray(o.deletedSlotIds).map(String),
      deletedExamIds: asArray(o.deletedExamIds).map(String),
    }
  } catch {
    return _emptyState()
  }
}

let pushHook = () => {}
/** 由 sessionStore 注入「写后同步」，避免 store 之间反向依赖 */
export function setCoursePushHook(fn) {
  pushHook = typeof fn === 'function' ? fn : () => {}
}
/** 打更新时间戳：多端合并时用于判定「哪一端更新」 */
function touch(o) {
  if (o && typeof o === 'object') o.updatedAt = Date.now()
  return o
}

function write() {
  try {
    localStorage.setItem(kk(space), JSON.stringify(state.value))
  } catch {
    /* 隐私模式忽略 */
  }
  pushHook()
}

export function initCourses(sp) {
  space = sp === 'account' ? 'account' : 'guest'
  state.value = read(space)
  // 清掉 v1 旧 key（不再读取；数据按需求清空、从零开始）
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 忽略 */
  }
  return state.value.courses
}

// ---------------- 引用与汇总

export function coursesRef() { return computed(() => state.value.courses) }
export function timetableRef() { return computed(() => state.value.timetable) }
export function examsRef() { return computed(() => state.value.exams) }
export function termRef() { return computed(() => state.value.term) }

export function courseSummary() {
  return computed(() => ({
    courses: state.value.courses.length,
    slots: state.value.timetable.length,
    exams: state.value.exams.length,
  }))
}

// ---------------- 课程

export function getCourse(id) {
  return state.value.courses.find((c) => c.id === id) || null
}

export function addCourse({ name, teacher = '', location = '', color = '' }) {
  const c = {
    id: nextId(),
    name: String(name || '').trim().slice(0, 30),
    teacher: String(teacher || '').trim().slice(0, 16),
    location: String(location || '').trim().slice(0, 20),
    color: color || COURSE_COLORS[state.value.courses.length % COURSE_COLORS.length],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  if (!c.name) return null
  state.value.courses = [...state.value.courses, c]
  write()
  return c
}

export function updateCourse(id, patch) {
  const c = getCourse(id)
  if (!c) return
  Object.assign(c, patch)
  touch(c)
  write()
}

export function removeCourse(id) {
  state.value.courses = state.value.courses.filter((c) => c.id !== id)
  state.value.timetable = state.value.timetable.filter((s) => s.courseId !== id)
  state.value.exams = state.value.exams.map((e) => (e.courseId === id ? { ...e, courseId: null } : e))
  if (id && !state.value.deletedIds.includes(String(id))) {
    state.value.deletedIds = [String(id), ...state.value.deletedIds].slice(0, MAX_TOMBSTONES)
  }
  write()
}

// ---------------- 课程表

export function addSlot({ courseId, day, slot, location = '', weeks }) {
  if (!courseId || !day || !slot) return null
  const dup = state.value.timetable.find((s) => s.day === Number(day) && s.slot === Number(slot))
  if (dup) return null // 同一格只放一门课
  const s = {
    id: nextId(),
    courseId,
    day: Number(day),
    slot: Number(slot),
    location: String(location || '').slice(0, 20),
    weeks: weeks && weeks.type ? weeks : { type: 'every' },
    updatedAt: Date.now(),
  }
  state.value.timetable = [...state.value.timetable, s]
  write()
  return s
}

export function removeSlot(id) {
  state.value.timetable = state.value.timetable.filter((s) => s.id !== id)
  if (id && !state.value.deletedSlotIds.includes(String(id))) {
    state.value.deletedSlotIds = [String(id), ...state.value.deletedSlotIds].slice(0, MAX_TOMBSTONES)
  }
  write()
}

export function slotAt(day, slot) {
  return state.value.timetable.find((s) => s.day === Number(day) && s.slot === Number(slot)) || null
}

/** 当前第几周（未设学期基准则 0） */
export function currentWeekIndex(now = new Date()) {
  if (!state.value.term.startDate) return 0
  return weekIndexFor(toDateStr(now), state.value.term.startDate)
}

/** 本周第几周 + 学期信息（供课程表顶部展示） */
export function weekInfo(now = new Date()) {
  const t = state.value.term
  const w = t.startDate ? weekIndexFor(toDateStr(now), t.startDate) : 0
  return { week: w, totalWeeks: t.totalWeeks, startDate: t.startDate, configured: !!t.startDate }
}

/** 按天汇总的周课表（可传 weekIndex 过滤本周实际上的课；不传则全量） */
export function weekGrid(weekIndex) {
  const filterOn = typeof weekIndex === 'number' && weekIndex > 0
  return DAYS.map((label, i) => {
    const day = i + 1
    let items = state.value.timetable
      .filter((s) => s.day === day)
      .filter((s) => (filterOn ? weekActiveIn(s.weeks, weekIndex) : true))
      .sort((a, b) => a.slot - b.slot)
      .map((s) => ({ ...s, course: getCourse(s.courseId) }))
    return { label, day, items }
  })
}

// ---------------- 考试

export function addExam({ courseId = null, name, date, startTime = '', endTime = '', location = '', note = '' }) {
  const e = {
    id: nextId(),
    courseId: courseId || null,
    name: String(name || '').trim().slice(0, 30),
    date: String(date || ''),
    startTime: String(startTime || '').slice(0, 5),
    endTime: String(endTime || '').slice(0, 5),
    location: String(location || '').slice(0, 20),
    note: String(note || '').slice(0, 60),
    updatedAt: Date.now(),
  }
  if (!e.name || !e.date) return null
  state.value.exams = [...state.value.exams, e]
  write()
  return e
}

export function updateExam(id, patch) {
  const e = state.value.exams.find((x) => x.id === id)
  if (!e) return
  Object.assign(e, patch)
  touch(e)
  write()
}

export function removeExam(id) {
  state.value.exams = state.value.exams.filter((e) => e.id !== id)
  if (id && !state.value.deletedExamIds.includes(String(id))) {
    state.value.deletedExamIds = [String(id), ...state.value.deletedExamIds].slice(0, MAX_TOMBSTONES)
  }
  write()
}

/** 按日期升序的近期考试（含未来，不含已过很久的） */
export function upcomingExams(limit = 5, now = new Date()) {
  const today = toDateStr(now)
  return state.value.exams
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .filter((e) => e.date >= today)
    .slice(0, limit)
}

/** 某天（dateStr）的考试列表 */
export function examsOn(dayDateStr) {
  return state.value.exams.filter((e) => e.date === dayDateStr)
}

// ---------------- 学期设置

export function setTerm({ startDate, totalWeeks }) {
  const t = state.value.term
  const sd = String(startDate || '').trim()
  const tw = Number(totalWeeks)
  if (sd) t.startDate = sd
  if (tw && tw >= 1 && tw <= 60) t.totalWeeks = tw
  t.updatedAt = Date.now()
  state.value.term = { ...t }
  write()
}

export function clearCourses() {
  state.value = _emptyState()
  write()
}

// ---------------- 云端同步（批次1 扩展）

export function coursesCloudPayload() {
  return { ...state.value }
}

export function applyCloudCourses(remote, opts = {}) {
  if (opts.merge === false) {
    const r = remote && typeof remote === 'object' ? remote : {}
    state.value = {
      courses: asArray(r.courses).slice(0, MAX_COURSES),
      timetable: asArray(r.timetable).slice(0, MAX_COURSES * 14),
      exams: asArray(r.exams).slice(0, MAX_COURSES),
      term: r.term && typeof r.term === 'object' ? { ...DEFAULT_TERM, ...r.term } : { ...DEFAULT_TERM },
      deletedIds: asArray(r.deletedIds).map(String).slice(0, MAX_TOMBSTONES),
      deletedSlotIds: asArray(r.deletedSlotIds).map(String).slice(0, MAX_TOMBSTONES),
      deletedExamIds: asArray(r.deletedExamIds).map(String).slice(0, MAX_TOMBSTONES),
    }
    write()
    return { ...state.value }
  }
  const merged = mergeSchedule({ ...state.value }, remote || {})
  state.value = merged
  write()
  return merged
}

export function deletedIdsRef() { return computed(() => state.value.deletedIds) }

export { nextId }
