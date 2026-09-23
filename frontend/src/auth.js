// 知一 · 账号会话管理（本地 clientId + 无状态 token，双写 localStorage + cookie 兜底）
// cookie 兜底应对微信内置浏览器 / 手机浏览器丢弃 localStorage 的场景

const LS_CID = 'zhiyi_client_id'
const LS_ACC = 'zhiyi_account_token'
const LS_UID = 'zhiyi_account_user'
const CK_ACC = 'zy_acc'

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}
function writeCookie(name, val, days = 30) {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 3600 * 1000)
  document.cookie = `${name}=${encodeURIComponent(val)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
}
function eraseCookie(name) {
  document.cookie = `${name}=; max-age=0; path=/`
}

/** 游客设备标识：首次生成，之后复用 */
export function getClientId() {
  let cid = ''
  try { cid = localStorage.getItem(LS_CID) || '' } catch (e) {}
  if (!cid) {
    cid = 'c_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
    try { localStorage.setItem(LS_CID, cid) } catch (e) {}
  }
  return cid
}

export function resetClientId() {
  const cid = 'c_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
  try { localStorage.setItem(LS_CID, cid) } catch (e) {}
  return cid
}

export function getToken() {
  try { return localStorage.getItem(LS_ACC) || readCookie(CK_ACC) || '' } catch (e) { return '' }
}

export function getUserId() {
  try { return localStorage.getItem(LS_UID) || '' } catch (e) { return '' }
}

export function isLoggedIn() {
  return !!getToken()
}

/** 登录/注册成功后写入会话（token + 当前昵称） */
export function adoptSession(userId, token) {
  try {
    localStorage.setItem(LS_ACC, token)
    localStorage.setItem(LS_UID, userId)
  } catch (e) {}
  writeCookie(CK_ACC, token)
}

export function clearSession() {
  try {
    localStorage.removeItem(LS_ACC)
    localStorage.removeItem(LS_UID)
  } catch (e) {}
  eraseCookie(CK_ACC)
}
