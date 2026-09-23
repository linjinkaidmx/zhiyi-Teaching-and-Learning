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
import { loadBook, saveBook } from '../book'
import { mergeErrorbook, mergeExams } from '../lib/syncMerge.js'
import { clearSession, getToken, getUserId, isLoggedIn, resetClientId, adoptSession } from '../auth'
import {
  initBook, getItems, getSettings, replaceItems, setPushHook, masteredCount, currentSpace,
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

export const session = reactive({
  space: 'guest', // 'guest' | 'account'
  userId: '',
  token: '',
  registeredAt: 0,
  syncing: false,
})

let pushTimer = null
let profileTimer = null

/** 进站初始化：恢复会话（有 token）或进入游客空间 */
export function initSession() {
  setPushHook(schedulePush)
  setCoursePushHook(schedulePush) // 课程 / 课表 / 考试安排改动同样防抖推送到云端
  setExamPushHook(schedulePush) // 模拟考试试卷（含作答与成绩）同样防抖推云
  bindVisibilitySync() // 从后台切回前台时自动拉取并合并（手机端常驻页面也能拿到另一端的改动）
  // 成就判定需要「已掌握」数
  setContextProvider(() => ({ mastered: masteredCount() }))

  if (isLoggedIn()) {
    session.space = 'account'
    session.userId = getUserId()
    session.token = getToken()
    initBook('account')
    initChat('account')
    initRecords('account')
    initCourses('account')
    initExams('account')
    initStats('account', getItems())
    initProfile('account')
    loadMeta()
    refreshCloud()
  } else {
    session.space = 'guest'
    session.userId = ''
    session.token = ''
    initBook('guest')
    initChat('guest')
    initRecords('guest')
    initCourses('guest')
    initExams('guest')
    initStats('guest', getItems())
    initProfile('guest')
  }
}

/** 登录 / 注册成功：切到账号空间，同步云端数据 */
export async function adoptLogin({ token, userId }) {
  session.space = 'account'
  session.userId = userId
  session.token = token
  const guest = loadBook('guest')
  try {
    const r = await api.sync.pull(token)
    const cloud = r.items || []
    if (cloud.length) {
      replaceItems(cloud, { persistNow: false })
    } else if (guest.length) {
      // 云端为空：游客本地错题首次上云
      replaceItems(guest, { persistNow: false })
      await api.sync.push(token, guest, statsForCloud()).catch(() => {})
    } else {
      replaceItems(loadBook('account'), { persistNow: false })
    }
    // 打卡统计：先切到账号空间（并用错题本历史回填一次），再与云端合并
    initStats('account', getItems())
    initChat('account')
    initRecords('account')
    initCourses('account')
    initExams('account')
    // 云端试卷（含作答与成绩）：按 id 合并落地
    if (Array.isArray(r.exams) && r.exams.length) {
      replacePapers(mergeExams(examsCloudPayload(), r.exams))
    }
    if (r.stats) {
      mergeStatsFromCloud(r.stats)
      if (isRicherLocal(r.stats)) api.sync.push(token, getItems(), statsForCloud()).catch(() => {})
    } else {
      api.sync.push(token, getItems(), statsForCloud()).catch(() => {})
    }
  } catch (e) {
    ElMessage.error(e.message)
    logout(true)
    return { ok: false, error: e.message }
  }
  saveBook(getItems(), 'account')
  // 个人资料：切到账号空间后拉取云端资料并合并
  initProfile('account')
  await loadMeta()
  return { ok: true }
}

/** 退出登录（silent = 不提示，用于 token 失效） */
export function logout(silent = false) {
  clearSession()
  session.space = 'guest'
  session.userId = ''
  session.token = ''
  session.registeredAt = 0
  resetClientId()
  initBook('guest')
  initChat('guest')
  initRecords('guest')
  initCourses('guest')
  initExams('guest')
  initStats('guest', getItems())
  initProfile('guest')
  if (!silent) ElMessage.success('已退出登录')
}

/** 改昵称成功后换会话（token 里编码昵称，必须换新的） */
export function renameSession({ token, nickname }) {
  adoptSession(nickname, token)
  session.userId = nickname
  session.token = token
  schedulePush()
}

/** 账号已注销：清空本地并回到游客空间 */
export function resetAfterDelete() {
  clearSession()
  session.space = 'guest'
  session.userId = ''
  session.token = ''
  session.registeredAt = 0
  resetClientId()
  replaceItems([], { persistNow: false })
  initStats('guest', [])
  initChat('guest')
  initRecords('guest')
  initCourses('guest')
  initProfile('guest')
  ElMessage.success('账号已注销')
}

// ---------------------------------------------------------------- 云端同步

export function schedulePush() {
  if (session.space !== 'account' || !session.token) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    api.sync.push(
      session.token, getItems(), statsForCloud(), coursesCloudPayload(),
      sessionsCloudPayload(), examsCloudPayload(),
    )
      .catch(() => {})
  }, 500)
}

export function scheduleProfilePush() {
  if (session.space !== 'account' || !session.token) return
  if (profileTimer) clearTimeout(profileTimer)
  profileTimer = setTimeout(() => {
    api.account.saveProfile(session.token, profileForCloud()).catch(() => {})
  }, 800)
}

/** 拉取云端资料与账号元信息（知一 ID / 加入时间） */
export async function loadMeta() {
  if (session.space !== 'account' || !session.token) return
  try {
    const r = await api.account.profile(session.token)
    if (!r.ok) return
    session.registeredAt = Number(r.registeredAt) || 0
    if (r.profile && Object.keys(r.profile).length) {
      mergeProfileFromCloud(r.profile)
      if (isLocalRicher(r.profile)) {
        api.account.saveProfile(session.token, profileForCloud()).catch(() => {})
      }
    }
  } catch {
    /* 资料拉取失败不影响主流程 */
  }
}

/** 会话恢复后拉取云端刷新（错题本按 id 合并取新，统计做合并） */
export async function refreshCloud() {
  try {
    const r = await api.sync.pull(session.token)
    if (r.items && r.items.length) {
      // 合并而非覆盖：本地 ∪ 云端，同 id 取 updatedAt 较新者（避免丢掉本端独有数据）
      const merged = mergeErrorbook(getItems(), r.items)
      replaceItems(merged, { persistNow: false })
      saveBook(getItems(), 'account')
    }
    if (r.stats) {
      mergeStatsFromCloud(r.stats)
      if (isRicherLocal(r.stats)) api.sync.push(session.token, getItems(), statsForCloud()).catch(() => {})
    }
    // 批次1：课程与学习记录按合并语义落地（墓碑防止"删了又被拉回来"）
    if (r.courses && Object.keys(r.courses).length) applyCloudCourses(r.courses)
    if (Array.isArray(r.sessions) && r.sessions.length) applyCloudSessions(r.sessions)
    // 模拟试卷：按 id 合并取新
    if (Array.isArray(r.exams) && r.exams.length) {
      replacePapers(mergeExams(examsCloudPayload(), r.exams))
    }
  } catch (e) {
    logout(true)
    ElMessage.warning('登录状态已失效，请重新登录')
  }
}

let visibilityBound = false
/** 从后台切回前台时静默拉取并合并（手机端页面常驻不刷新也能拿到另一端的改动） */
export function bindVisibilitySync() {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (session.space !== 'account' || !session.token || session.syncing) return
    refreshCloud().catch(() => {})
  })
}

/**
 * 手动「立即同步」：先拉取合并 → 再把合并结果推回云端（两端收敛到并集，不再互相覆盖）。
 * 覆盖：错题本 + 打卡统计 + 个人资料 + 课程/课表 + 学习记录。
 */
export async function syncNow() {
  if (session.space !== 'account' || !session.token) {
    // 未登录就地弹出登录框（登录成功后用户再点一次同步即可）
    openAuth('login')
    return false
  }
  session.syncing = true
  try {
    // ① 先拉云端并合并（错题本按 id 取新、统计合并、课表与记录按墓碑 + 取新合并）
    const r = await api.sync.pull(session.token)
    if (r.ok) {
      if (Array.isArray(r.items) && r.items.length) {
        const merged = mergeErrorbook(getItems(), r.items)
        replaceItems(merged, { persistNow: false })
        saveBook(getItems(), 'account')
      }
      if (r.stats) mergeStatsFromCloud(r.stats)
      if (r.courses && Object.keys(r.courses).length) applyCloudCourses(r.courses)
      if (Array.isArray(r.sessions) && r.sessions.length) applyCloudSessions(r.sessions)
      if (Array.isArray(r.exams) && r.exams.length) {
        replacePapers(mergeExams(examsCloudPayload(), r.exams))
      }
    }
    // ② 再把合并后的结果推回云端
    await api.sync.push(
      session.token, getItems(), statsForCloud(), coursesCloudPayload(),
      sessionsCloudPayload(), examsCloudPayload(),
    )
    await api.account.saveProfile(session.token, profileForCloud())
    ElMessage.success('已同步到云端')
    return true
  } catch (e) {
    ElMessage.error('同步失败：' + e.message)
    return false
  } finally {
    session.syncing = false
  }
}

/** 以云端覆盖本地（错题本与统计直接替换，不做合并） */
export async function pullOverwrite() {
  if (!session.token) return false
  session.syncing = true
  try {
    const r = await api.sync.pull(session.token)
    replaceItems(r.items || [], { persistNow: false })
    saveBook(getItems(), 'account')
    replaceStats(r.stats || {})
    applyCloudCourses(r.courses || {}, { merge: false })
    applyCloudSessions(r.sessions || [], { merge: false })
    replacePapers(r.exams || [])
    const p = await api.account.profile(session.token)
    if (p.ok && p.profile) mergeProfileFromCloud(p.profile)
    ElMessage.success('已用云端数据覆盖本地')
    return true
  } catch (e) {
    ElMessage.error(e.message)
    return false
  } finally {
    session.syncing = false
  }
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
    'zhiyi_settings',
  ]
  try {
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 隐私模式忽略 */
  }
  replaceItems([], { persistNow: false })
  initStats(session.space, [])
  initChat(session.space)
  initRecords(session.space)
  initCourses(session.space)
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
  if (mode === 'overwrite') {
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
