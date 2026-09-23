import axios from 'axios'

// 与 diagnose.js 一致：构建时可注入 VITE_API_BASE，生产为空串走同源相对路径
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

const client = axios.create({ baseURL: API_BASE, timeout: 30000 })

/* ------------------------------------------------------------------ */
/* token 存取：localStorage 为主 + cookie 兜底（照搬参考项目的双写策略）  */
/* ------------------------------------------------------------------ */
const TOKEN_KEY = 'zhiyi_token'
const CK_TOKEN = 'zhiyi_acc'

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

function writeCookie(name, value, days) {
  const exp = new Date(Date.now() + days * 24 * 3600 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || readCookie(CK_TOKEN) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  writeCookie(CK_TOKEN, token, 30)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  writeCookie(CK_TOKEN, '', -1)
}

/** 带 token 的请求头 */
function authHeaders() {
  const t = getToken()
  return t ? { 'x-account-token': t } : {}
}

/** 社区接口统一调用：后端返回 {ok, msg?...} 格式，失败抛错并带中文消息 */
async function call(method, url, body = null) {
  try {
    const { data } = await client.request({
      method,
      url,
      data: body,
      headers: authHeaders(),
    })
    if (data && data.ok === false) {
      const err = new Error(data.msg || '请求失败')
      err.data = data
      throw err
    }
    return data
  } catch (e) {
    if (e.response && e.response.data && e.response.data.detail) {
      throw new Error(e.response.data.detail)
    }
    throw e
  }
}

/* ------------------------------------------------------------------ */
/* 账号                                                                 */
/* ------------------------------------------------------------------ */
export const accountApi = {
  register: (p) => call('post', '/api/account/register', p),
  login: (p) => call('post', '/api/account/login', p),
  verify: (token) => call('post', '/api/account/verify', { token }),
  recover: (p) => call('post', '/api/account/recover', p),
  changePassword: (p) => call('post', '/api/account/change-password', p),
}

/* ------------------------------------------------------------------ */
/* 错题同步                                                             */
/* ------------------------------------------------------------------ */
export const recordApi = {
  list: () => call('get', '/api/records'),
  upsert: (record) => call('post', '/api/records/upsert', { record }),
  remove: (rid) => call('post', '/api/records/delete', { rid }),
}

/* ------------------------------------------------------------------ */
/* 论坛                                                                 */
/* ------------------------------------------------------------------ */
export const forumApi = {
  list: (subject = '', page = 1) =>
    call('get', `/api/forum/posts?subject=${encodeURIComponent(subject)}&page=${page}`),
  detail: (id) => call('get', `/api/forum/posts/${id}`),
  create: (p) => call('post', '/api/forum/posts', p),
  like: (id) => call('post', `/api/forum/posts/${id}/like`),
  comment: (id, content, replyTo = null) =>
    call('post', `/api/forum/posts/${id}/comments`, { content, replyTo }),
  remove: (id) => call('post', `/api/forum/posts/${id}/delete`),
}

/* ------------------------------------------------------------------ */
/* 学习小组                                                             */
/* ------------------------------------------------------------------ */
export const groupApi = {
  create: (p) => call('post', '/api/group/create', p),
  join: (code) => call('post', '/api/group/join', { code }),
  list: () => call('get', '/api/group/list'),
  members: (gid) => call('get', `/api/group/${gid}/members`),
  shares: (gid) => call('get', `/api/group/${gid}/shares`),
  share: (gid, p) => call('post', `/api/group/${gid}/share`, p),
  removeShare: (shareId) => call('post', `/api/group/shares/${shareId}/delete`),
  quit: (gid) => call('post', `/api/group/${gid}/quit`),
  dissolve: (gid) => call('post', `/api/group/${gid}/dissolve`),
}
