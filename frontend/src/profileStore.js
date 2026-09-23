/**
 * 个人资料的响应式存储层：包装 profile.js 纯逻辑，负责持久化、云端合并、偏好读取。
 * 组件直接 import 使用（模块级单例），不逐层传 props。
 */
import { ref } from 'vue'
import {
  emptyProfile, normalizeProfile, loadProfile, saveProfile, mergeProfile, isProfileRicher,
  storageUsageKB,
} from './profile.js'

const profile = ref(emptyProfile())
let space = 'guest'
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => {
    try { fn(profile.value) } catch { /* 忽略 */ }
  })
}

function persist() {
  saveProfile(profile.value, space)
}

/** 进站 / 切换空间时调用 */
export function initProfile(sp) {
  space = sp || 'guest'
  profile.value = loadProfile(space)
  notify()
  return profile.value
}

export function profileRef() {
  return profile
}

export function getProfile() {
  return profile.value
}

export function getPrefs() {
  return profile.value.prefs
}

export function onProfileChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 局部更新资料（prefs 支持部分更新） */
export function updateProfile(patch = {}) {
  const next = { ...profile.value, ...patch }
  if (patch.prefs) next.prefs = { ...profile.value.prefs, ...patch.prefs }
  profile.value = normalizeProfile(next)
  persist()
  notify()
  return profile.value
}

export function updatePref(key, value) {
  return updateProfile({ prefs: { [key]: value } })
}

/** 云端资料合并（登录/拉取时） */
export function mergeFromCloud(remote) {
  if (!remote || typeof remote !== 'object') return false
  const before = JSON.stringify(profile.value)
  profile.value = mergeProfile(profile.value, remote)
  persist()
  notify()
  return JSON.stringify(profile.value) !== before
}

/** 本地资料是否比云端更完整（决定是否回推） */
export function isLocalRicher(remote) {
  return isProfileRicher(profile.value, remote)
}

export function profileForCloud() {
  return profile.value
}

/** 导入备份：覆盖本地资料（保留偏好） */
export function applyImportedProfile(imported) {
  profile.value = mergeProfile({ ...profile.value, ...normalizeProfile(imported), prefs: profile.value.prefs }, null)
  persist()
  notify()
}

export function usageKB() {
  return storageUsageKB()
}
