/**
 * 用户登录态（reactive 单例，全局共享）
 *
 * 登录流程：
 *   loginAs(token, nickname) -> 切换练习本到「账号数据空间」-> 拉取服务端记录做缓存
 * 退出流程：
 *   logout() -> 清 token -> 切回「游客数据空间」（本地旧数据原样保留）
 *
 * 启动时 initUser() 用本地 token 静默 verify，恢复会话。
 */
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { accountApi, recordApi, getToken, setToken, clearToken } from '../api/auth'
import { setBookSpace, writeAll, clearBook } from '../utils/storage'

export const user = reactive({
  token: '',
  nickname: '',
  userId: null,
  ready: false, // 是否已完成启动恢复
})

export function isLoggedIn() {
  return !!user.token
}

/** 应用启动时调用：有 token 就静默恢复会话 */
export async function initUser() {
  const t = getToken()
  if (!t) {
    user.ready = true
    return
  }
  try {
    const res = await accountApi.verify(t)
    user.token = res.token // 后端可能换发新 token
    user.nickname = res.nickname
    user.userId = res.userId ?? null
    setToken(res.token)
    await enterAccountSpace()
  } catch {
    clearToken()
  } finally {
    user.ready = true
  }
}

/** 登录/注册成功后调用：切空间 + 全量拉取服务端记录 */
export async function enterAccountSpace() {
  setBookSpace('account')
  try {
    const res = await recordApi.list()
    // 服务端记录写入账号空间缓存，离线可读
    clearBook() // 防止上次账号残留
    writeAll(res.records || [])
  } catch (e) {
    ElMessage.warning('同步练习本失败：' + e.message + '（稍后会自动重试）')
  }
}

/** 登录成功（弹窗里调） */
export async function loginAs(token, nickname, userId = null) {
  user.token = token
  user.nickname = nickname
  user.userId = userId
  setToken(token)
  await enterAccountSpace()
}

/** 退出登录 */
export function logout() {
  user.token = ''
  user.nickname = ''
  user.userId = null
  clearToken()
  setBookSpace('guest')
}

/**
 * 数据同步处理器：storage.js 每次写操作后回调
 * 登录状态下把变更推送到服务端；失败静默（本地已成功，不打断用户）
 */
export function handleStorageSync(kind, payload) {
  if (!isLoggedIn()) return
  if (kind === 'upsert') {
    recordApi.upsert(payload).catch((e) => console.warn('[sync] upsert failed:', e.message))
  } else if (kind === 'delete') {
    recordApi.remove(payload.rid).catch((e) => console.warn('[sync] delete failed:', e.message))
  }
}
