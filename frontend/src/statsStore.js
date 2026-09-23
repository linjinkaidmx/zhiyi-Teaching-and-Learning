/**
 * 打卡/成就的响应式存储层：包装纯逻辑（stats.js），负责持久化、上下文注入、解锁通知、云同步出入参。
 * 组件内直接 import 使用即可（模块级单例），无需逐层传 props。
 */
import { ref } from 'vue'
import { ACHIEVEMENTS } from './achievements.js'
import { logLearning } from './stores/recordsStore.js'
import {
  emptyStats, loadStats, saveStats, normalize,
  record as pureRecord, backfill as pureBackfill, mergeStats, isRicher,
  evaluate, buildContext, progressOf, summary as pureSummary, dateKey,
} from './stats.js'

const stats = ref(emptyStats())
let space = 'guest'
let ctxProvider = () => ({})
const unlockListeners = new Set()
const changeListeners = new Set()

function ctx() {
  try { return ctxProvider() || {} } catch { return {} }
}

function persist() {
  saveStats(stats.value, space)
}

function notify(r, { silentUnlock = false, src = '' } = {}) {
  if (r.unlocked && r.unlocked.length && !silentUnlock) {
    unlockListeners.forEach((fn) => {
      try { fn(r.unlocked, src) } catch { /* 通知失败不影响主流程 */ }
    })
  }
  changeListeners.forEach((fn) => {
    try { fn(stats.value) } catch { /* ignore */ }
  })
}

function apply(r, opts) {
  stats.value = r.stats
  persist()
  notify(r, opts)
}

/** 初始化（进站 / 切换空间时调用）；items 用于一次性历史回填 */
export function initStats(sp, items) {
  space = sp || 'guest'
  const loaded = loadStats(space)
  const r = pureBackfill(loaded, items || [])
  stats.value = r.stats
  persist()
  notify(r, { src: 'backfill' })
  return r
}

export function setContextProvider(fn) {
  ctxProvider = fn
}

export function onUnlock(fn) {
  unlockListeners.add(fn)
  return () => unlockListeners.delete(fn)
}

export function onStatsChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

export function statsRef() {
  return stats
}

export function getStats() {
  return stats.value
}

export function summary() {
  return pureSummary(stats.value)
}

/** 成就墙数据：定义 + 进度 + 解锁信息 */
export function achievementList() {
  const c = buildContext(stats.value, ctx())
  return ACHIEVEMENTS.map((a) => ({ ...a, ...progressOf(stats.value, a, c) }))
}

/** 记录一次实质学习动作（会触发打卡判定、每日目标判定、成就判定与解锁通知） */
export function recordAction(type, opts = {}) {
  const r = pureRecord(stats.value, type, { ...opts, ctx: ctx() })
  apply(r)
  // 顺带写一条学习记录（P8）：所有埋点自动进「学习记录」，opts.title/brief 可选带上下文
  try {
    logLearning(type, opts)
  } catch {
    /* 记录失败不影响打卡 */
  }
  return r
}

/** 仅在需要时重新判定成就（例如错题本「已掌握」数变化） */
export function evaluateNow(extra = {}) {
  const r = evaluate(stats.value, { ...ctx(), ...extra })
  apply(r)
  return r
}

/** 每日目标设置 */
export function updateGoal(patch) {
  const s = normalize(stats.value)
  s.settings = { ...s.settings, ...patch }
  const today = dateKey()
  const d = s.days[today]
  if (d) {
    d.goalMet = s.settings.goalEnabled
      ? ((d.actions.quiz || 0) + (d.actions.practice || 0)) >= s.settings.goalQuestions
      : false
  }
  apply(evaluate(s, ctx()))
}

/** 合并云端统计（换设备/登录时）；合并结果更丰富则回推由调用方决定 */
export function mergeFromCloud(remote) {
  if (!remote || typeof remote !== 'object') return false
  const before = JSON.stringify(stats.value)
  stats.value = mergeStats(stats.value, remote)
  persist()
  // 合并带来的解锁不再弹提示（避免登录瞬间刷屏）
  notify({ stats: stats.value, unlocked: [] }, { silentUnlock: true })
  return JSON.stringify(stats.value) !== before
}

/** 提供给云同步的数据 */
export function statsForCloud() {
  return stats.value
}

/** 直接替换统计（用于「以云端覆盖本地」与导入覆盖） */
export function replaceStats(remote) {
  stats.value = normalize(remote && typeof remote === 'object' ? remote : {})
  persist()
  notify({ stats: stats.value, unlocked: [] }, { silentUnlock: true })
  return stats.value
}

/** 本地统计是否比云端更丰富（决定是否需要回推云端） */
export function isRicherLocal(remote) {
  return isRicher(stats.value, remote)
}

/** 退出登录：切回游客空间 */
export function resetToGuest(items) {
  initStats('guest', items)
}
