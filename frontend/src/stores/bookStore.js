/**
 * bookStore · 错题本与复习设置
 * ---------------------------------------------------------------------------
 * 从 App.vue 抽出（P2.5）。数据契约不变：仍用 book.js 的纯逻辑 + 双空间 localStorage，
 * 字段名、localStorage key、SRS 规则一律不动。
 */
import { ref } from 'vue'
import {
  loadBook, saveBook, makeItem, upsertItem, removeItem, loadSettings, saveSettings,
} from '../book'
import { evaluateNow, recordAction } from './statsStore'

const items = ref([])
const settings = ref(loadSettings())
let space = 'guest'
let pushHook = () => {}

/** 进站 / 切换空间时调用（space: 'guest' | 'account'） */
export function initBook(sp) {
  space = sp === 'account' ? 'account' : 'guest'
  items.value = loadBook(space)
  settings.value = loadSettings()
  return items.value
}

/** 由 sessionStore 注入「写后同步」钩子，避免 store 之间循环依赖 */
export function setPushHook(fn) {
  pushHook = typeof fn === 'function' ? fn : () => {}
}

export function bookRef() {
  return items
}

export function getItems() {
  return items.value
}

export function getSettings() {
  return settings.value
}

/** 复习设置的响应式引用（供组件绑定） */
export function settingsRef() {
  return settings
}

export function currentSpace() {
  return space
}

/** 仅供统计层用于成就判定 */
export function masteredCount() {
  return items.value.filter((i) => i.mastered).length
}

export function persist() {
  saveBook(items.value, space)
  evaluateNow({ mastered: masteredCount() }) // 掌握状态变化也可能达成成就
  pushHook()
}

export function upsert(item) {
  // 打更新时间戳：多端合并时用于判定「哪一端更新」（错题本按 id 取 updatedAt 较新者）
  item.updatedAt = Date.now()
  items.value = upsertItem(items.value, item)
  persist()
  return item
}

export function remove(id) {
  items.value = removeItem(items.value, id)
  persist()
}

/** 直接把某题的讲解结果存入错题本（courseId = 用户手动归类到的课程，空为未归类） */
export function saveResult(item, courseId = '') {
  const extras = { followups: item.followups || [], reteach: item.reteach || [], courseId: String(courseId || '') }
  items.value = upsertItem(items.value, makeItem(item.text, item.attempt, item.result, extras))
  persist()
  recordAction('save', { title: item.text })
}

/** 覆盖式写入（云端拉取 / 导入 / 清空） */
export function replaceItems(next, { persistNow = true } = {}) {
  items.value = Array.isArray(next) ? next : []
  if (persistNow) {
    saveBook(items.value, space)
    pushHook()
  }
}

export function updateSettings(patch) {
  settings.value = { ...settings.value, ...patch }
  saveSettings(settings.value)
  return settings.value
}
