/**
 * sessionStore · 登录态 + 双空间 + 云端同步 + 数据管理
 * ---------------------------------------------------------------------------
 * 从 App.vue 抽出（P2.5）。会话（token/昵称/空间）与同步天然耦合，放在同一 store 避免循环依赖。
 * 同步语义：本地任意改动（错题本 / 课程课表）防抖推送；拉取侧一律「合并」而非覆盖
 *（错题本与课程/课表/考试按 id 并集 + updatedAt 取新），切换回前台时自动拉取合并。
 */
import { reactive } from 'vue'
import { ElMessage } from '../ui/notify.js'
import { openAuth } from './uiStore'
import { api } from '../api'
import { loadBook, saveBook, nextId } from '../book'
import { mergeErrorbook, mergeExams } from '../lib/syncMerge.js'
import { clearSession, getToken, getUserId, isLoggedIn, resetClientId, adoptSession, getAccountId } from '../auth'
import { clearCustomCache, initCompanionScope } from '../lib/companions.js'
import {
  initBook, getItems, getSettings, replaceItems, setPushHook, masteredCount, currentSpace, getDeletedIds, mergeDeletedIds,
} from './bookStore'
import {
  initStats, setContextProvider, mergeFromCloud as mergeStatsFromCloud,
  statsForCloud, isRicherLocal, replaceStats,
} from './statsStore'
import {
  initProfile, mergeFromCloud as mergeProfileFromCloud,
  profileForCloud, isLocalRicher, getProfile,
} from './profileStore'
import { validateImport } from '../profile.js'
import { initChat } from './chatStore'
import { initRecords, sessionsCloudPayload, applyCloudSessions } from './recordsStore'
import { initCourses, coursesCloudPayload, applyCloudCourses, setCoursePushHook } from './courseStore'
import { initExams, setExamPushHook, examsCloudPayload, replacePapers } from './examStore'

import { setAccountScope, accountKey } from '../lib/accountScope.js'
import { clearCompanionStats } from './companionStatsStore.js'
export const session = reactive({ space: 'guest', userId: '', accountId: '', token: '', registeredAt: 0, syncing: false, epoch: 0 })
let pushTimer = null
let profileTimer = null
const stamp = () => ({ epoch: session.epoch, token: session.token })
const valid = s => s.epoch === session.epoch && s.token === session.token
const authError = e => e?.status === 401 || ['AUTH_INVALID', 'AUTH_REQUIRED'].includes(e?.code)

function cancelPending() {
  clearTimeout(pushTimer); clearTimeout(profileTimer)
  pushTimer = profileTimer = null
  session.epoch++
}
function initStores(space) {
  initBook(space); initChat(space); initRecords(space); initCourses(space); initExams(space)
  initStats(space, getItems()); initProfile(space)
  clearCompanionStats(); initCompanionScope()
}
function enterAccount(id) {
  session.accountId = String(id)
  setAccountScope(id)
  session.space = 'account'
  initStores('account')
}
function applyCloud(r, overwrite = false) {
  mergeDeletedIds(r.deleted_ids || [])
  replaceItems(overwrite ? (r.items || []) : mergeErrorbook(getItems(), r.items || []), { persistNow: false })
  saveBook(getItems(), 'account')
  if (r.stats) mergeStatsFromCloud(r.stats)
  if (r.courses) applyCloudCourses(r.courses, { merge: !overwrite })
  if (r.sessions) applyCloudSessions(r.sessions)
  if (r.exams) replacePapers(overwrite ? r.exams : mergeExams(examsCloudPayload(), r.exams))
}
function payload() {
  return [session.token, getItems(), statsForCloud(), coursesCloudPayload(), sessionsCloudPayload(), examsCloudPayload(), getDeletedIds()]
}
export function initSession() {
  setPushHook(schedulePush); setCoursePushHook(schedulePush); setExamPushHook(schedulePush)
  bindVisibilitySync()
  setContextProvider(() => ({ mastered: masteredCount() }))
  if (isLoggedIn()) {
    session.token = getToken(); session.userId = getUserId()
    const id = getAccountId()
    if (id) enterAccount(id)
    else { setAccountScope(''); initStores('guest') }
    refreshCloud()
  } else { setAccountScope(''); initStores('guest') }
}

export async function adoptLogin({ token, userId, accountId }) {
  cancelPending(); clearCustomCache()
  session.token = token; session.userId = userId; session.accountId = ''; session.registeredAt = 0
  // Never infer ownership of old unscoped account or guest caches.
  setAccountScope(''); session.space = 'guest'; initStores('guest')
  const s = stamp()
  if (accountId) enterAccount(accountId)
  try {
    const r = await api.sync.pull(token)
    if (!valid(s)) return { ok: false, stale: true }
    const id = r.account_id || accountId
    if (!id) throw new Error('账号身份暂时无法确认，请稍后重试')
    if (session.accountId && session.accountId !== String(id)) throw Object.assign(new Error('账号身份不一致'), {code: 'AUTH_INVALID'})
    if (!session.accountId) enterAccount(id)
    adoptSession(userId, token, id)
    applyCloud(r)
    await loadMeta()
    return { ok: true }
  } catch (e) {
    if (!valid(s)) return { ok: false, stale: true }
    if (authError(e)) logout(true)
    else ElMessage.warning('暂时无法同步，已保留本机数据：' + e.message)
    return { ok: false, error: e.message }
  }
}
export function logout(silent = false) {
  cancelPending(); clearCustomCache(); clearSession(); setAccountScope('')
  Object.assign(session, { space: 'guest', userId: '', accountId: '', token: '', registeredAt: 0, syncing: false })
  resetClientId(); initStores('guest')
  if (!silent) ElMessage.success('已退出登录')
}
export function renameSession({ token, nickname }) {
  cancelPending()
  adoptSession(nickname, token, session.accountId)
  session.userId = nickname; session.token = token
  schedulePush()
}
export function resetAfterDelete() { logout(true); ElMessage.success('账号已注销') }

export function schedulePush() {
  if (session.space !== 'account' || !session.token || !session.accountId) return
  clearTimeout(pushTimer)
  const s = stamp()
  pushTimer = setTimeout(async () => {
    if (!valid(s)) return
    try {
      const r = await api.sync.push(...payload())
      if (!valid(s)) return
      if (r.dropped > 0) ElMessage.warning(`云同步：${r.dropped} 条数据因格式问题未保存`)
      if (r.deleted_ids) mergeDeletedIds(r.deleted_ids)
    } catch (e) {
      if (valid(s) && authError(e)) logout(true)
    }
  }, 500)
}
export function scheduleProfilePush() {
  if (session.space !== 'account' || !session.token) return
  clearTimeout(profileTimer)
  const s = stamp()
  profileTimer = setTimeout(() => {
    if (valid(s)) api.account.saveProfile(s.token, profileForCloud()).catch(() => {})
  }, 800)
}
export async function loadMeta() {
  if (!session.token || !session.accountId) return
  const s = stamp()
  try {
    const r = await api.account.profile(s.token)
    if (!valid(s) || !r.ok) return
    session.registeredAt = Number(r.registeredAt) || 0
    if (r.profile) mergeProfileFromCloud(r.profile)
  } catch (e) { if (valid(s) && authError(e)) logout(true) }
}
export async function refreshCloud() {
  if (!session.token) return false
  const s = stamp()
  try {
    const r = await api.sync.pull(s.token)
    if (!valid(s)) return false
    const id = r.account_id || session.accountId
    if (!id) return false
    if (session.accountId && session.accountId !== String(id)) throw Object.assign(new Error('账号身份不一致'), {code: 'AUTH_INVALID'})
    if (!session.accountId) enterAccount(id)
    adoptSession(session.userId, s.token, id)
    applyCloud(r)
    await loadMeta()
    return true
  } catch (e) {
    if (!valid(s)) return false
    if (authError(e)) { logout(true); ElMessage.warning('登录状态已失效，请重新登录') }
    return false
  }
}
let visibilityBound = false
export function bindVisibilitySync() {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.token && !session.syncing) refreshCloud()
  })
}
export async function syncNow() {
  if (!session.token) { openAuth('login'); return false }
  const s = stamp(); session.syncing = true
  try {
    if (!await refreshCloud() || !valid(s)) return false
    await api.sync.push(...payload())
    if (!valid(s)) return false
    await api.account.saveProfile(s.token, profileForCloud())
    if (valid(s)) ElMessage.success('已同步到云端')
    return valid(s)
  } catch (e) { if (valid(s)) ElMessage.error('同步失败：' + e.message); return false }
  finally { if (valid(s)) session.syncing = false }
}
export async function pullOverwrite() {
  if (!session.token || !session.accountId) return false
  const s = stamp(); session.syncing = true
  try {
    const r = await api.sync.pull(s.token)
    if (!valid(s)) return false
    applyCloud(r, true)
    await loadMeta()
    if (valid(s)) ElMessage.success('已用云端数据覆盖本地')
    return valid(s)
  } catch (e) { if (valid(s)) ElMessage.error(e.message); return false }
  finally { if (valid(s)) session.syncing = false }
}

// ---------------------------------------------------------------- 数据管理

/** 清空本机数据（云端保留；不动登录态） */
export function clearLocalData() {
  const keys = [
    'zhiyi_errorbook_v1', 'zhiyi_errorbook_account_v1',
    'zhiyi_stats_v1', 'zhiyi_stats_account_v1',
    'zhiyi_profile_v1', 'zhiyi_profile_account_v1',
    'zhiyi_chat_v1', 'zhiyi_chat_account_v1',
    'zhiyi_records_v1', 'zhiyi_records_account_v1',
    'zhiyi_courses_v1', 'zhiyi_courses_account_v1',
    'zhiyi_timetable_v1', 'zhiyi_timetable_account_v1',
    'zhiyi_courses_deleted_v1', 'zhiyi_courses_deleted_account_v1',
    'zhiyi_settings_v1', 'zhiyi_schedule_account_v2', 'zhiyi_schedule_v2', 'zhiyi_exam_account_v1', 'zhiyi_exam_v1',
  ]
  try {
    keys.forEach((k) => localStorage.removeItem(session.space === 'account' ? accountKey(k) : k))
  } catch {
    /* 隐私模式忽略 */
  }
  replaceItems([], { persistNow: false })
  initStats(session.space, [])
  initChat(session.space)
  initRecords(session.space)
  initCourses(session.space)
  initExams(session.space)
  initProfile(session.space)
  ElMessage.success('本机数据已清空（云端未动）')
}

/** 导入备份：merge 合并 / overwrite 覆盖 */
export function applyImport({ obj, mode }) {
  const v = validateImport(obj)
  if (!v.ok) {
    ElMessage.error(v.error)
    return { ok: false, error: v.error }
  }
  const dead = new Set(getDeletedIds())
  v.items = v.items.map(it => dead.has(String(it.id)) ? { ...it, id: nextId(), updatedAt: Date.now() } : it)
  if (mode === 'overwrite') {
    mergeDeletedIds(getItems().filter(it => !v.items.some(n => String(n.id) === String(it.id))).map(it => it.id))
    replaceItems(v.items.filter((it) => it && it.id != null), { persistNow: false })
  } else {
    const next = [...getItems()]
    for (const it of v.items) {
      if (!it || it.id == null) continue
      const i = next.findIndex((x) => x.id === it.id)
      if (i >= 0) next[i] = it
      else next.push(it)
    }
    replaceItems(next, { persistNow: false })
  }
  if (v.stats) {
    if (mode === 'overwrite') replaceStats(v.stats)
    else mergeStatsFromCloud(v.stats)
  }
  if (v.profile) mergeProfileFromCloud(v.profile)
  persistAll()
  ElMessage.success(`导入完成：错题 ${v.counts.items} 条`)
  return { ok: true, count: v.counts.items }
}

/** 落盘 + 推云端（供数据管理使用） */
export function persistAll() {
  saveBook(getItems(), currentSpace())
  schedulePush()
}

export { getSettings, getProfile }
