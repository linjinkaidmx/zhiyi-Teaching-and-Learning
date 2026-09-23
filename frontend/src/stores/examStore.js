/**
 * examStore · 模拟考试试卷（localStorage 双空间 + 云同步）
 * ---------------------------------------------------------------------------
 * 与 courseStore / recordsStore 同一套范式：
 *   纯逻辑在 lib/exam.js，这里只负责「存哪儿、怎么存、什么时候推云」。
 *   - 双空间：游客 zhiyi_exam_v1 / 账号 zhiyi_exam_account_v1
 *   - 写后同步：由 sessionStore 注入 pushHook（防抖推云），避免 store 反向依赖
 *   - 保留上限 MAX_PAPERS 张（按 createdAt 倒序截断）
 */
import { computed, ref } from 'vue'

const KEY = 'zhiyi_exam_v1'
const KEY_ACC = 'zhiyi_exam_account_v1'
export const MAX_PAPERS = 60

let space = 'guest'
const state = ref({ papers: [] })

const kk = (sp) => (sp === 'account' ? KEY_ACC : KEY)
const asArray = (x) => (Array.isArray(x) ? x : [])

function _empty() {
  return { papers: [] }
}

function read(sp) {
  try {
    const raw = localStorage.getItem(kk(sp))
    if (!raw) return _empty()
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return _empty()
    return { papers: asArray(o.papers).filter((p) => p && p.id) }
  } catch {
    return _empty()
  }
}

let pushHook = () => {}
/** 由 sessionStore 注入「写后同步」 */
export function setExamPushHook(fn) {
  pushHook = typeof fn === 'function' ? fn : () => {}
}

function write() {
  try {
    localStorage.setItem(kk(space), JSON.stringify(state.value))
  } catch {
    /* 隐私模式忽略 */
  }
  pushHook()
}

export function initExams(sp) {
  space = sp === 'account' ? 'account' : 'guest'
  state.value = read(space)
  return state.value.papers
}

export function papersRef() {
  return computed(() => state.value.papers)
}

export function currentSpace() {
  return space
}

/** 新增或更新一张试卷（自动打 updatedAt 供云端合并取新） */
export function savePaper(paper) {
  if (!paper || !paper.id) return null
  const next = { ...paper, updatedAt: Date.now() }
  const idx = state.value.papers.findIndex((p) => p.id === next.id)
  let arr
  if (idx >= 0) {
    arr = state.value.papers.slice()
    arr[idx] = next
  } else {
    arr = [next, ...state.value.papers]
  }
  arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  state.value.papers = arr.slice(0, MAX_PAPERS)
  write()
  return next
}

export function getPaper(id) {
  return state.value.papers.find((p) => p.id === id) || null
}

export function removePaper(id) {
  state.value.papers = state.value.papers.filter((p) => p.id !== id)
  write()
}

/** 云端合并结果落地（不触发回推，避免来回同步） */
export function replacePapers(list) {
  const arr = asArray(list).filter((p) => p && p.id)
  arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  state.value.papers = arr.slice(0, MAX_PAPERS)
  try {
    localStorage.setItem(kk(space), JSON.stringify(state.value))
  } catch {
    /* 忽略 */
  }
}

/** 云同步载荷（账号空间才推送） */
export function examsCloudPayload() {
  return state.value.papers
}
