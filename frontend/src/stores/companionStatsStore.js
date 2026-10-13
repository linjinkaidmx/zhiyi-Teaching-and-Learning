import { ref } from 'vue'

/**
 * 伴学统计缓存（2026-10-11）
 * ---------------------------------------------------------------------------
 * 伴学统计来自异步接口（/api/companion/stats），而成就判定的 context provider
 * 是同步的（App.vue 里注册）。所以这里做一层"当前伙伴统计"的本地缓存：
 *   CompanionPage 拉到数据后写入 → App 的 provider 同步读取 → 成就判定即时生效。
 * 口径：**当前这位伙伴**（用户拍板：成就殿堂的「伴学伙伴」分组按当前伙伴计）。
 */
const state = ref({ character: '', stats: {} })

export function setCompanionStats(character, stats) {
  state.value = { character: String(character || ''), stats: stats || {} }
}

export function clearCompanionStats() {
  state.value = { character: '', stats: {} }
}

export function companionStatsRef() {
  return state
}

/** 供 provider 直接取（同步） */
export function companionStats() {
  return state.value.stats || {}
}
