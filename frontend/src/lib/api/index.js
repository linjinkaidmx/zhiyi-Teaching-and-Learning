/**
 * 真实 API 客户端（P2 起由 adapter 统一调用）
 * ---------------------------------------------------------------------------
 * 契约来源：现有后端（backend/main.py），**接口路径与字段名已冻结**，不得改名。
 * 已存在真实接口（禁止再写 Mock）：
 *   /api/extract      题目识别
 *   /api/explain      AI 讲解
 *   /api/judge        批改
 *   /api/followup     题内追问（SSE 流式）
 *   /api/reteach      换个讲法（SSE 流式）
 * 账号与同步：/api/account/*（register/login/verify/change-password/recover/
 *   profile/profile/save/rename/delete/reset-backup）、/api/sync/push|pull
 * 其他：/api/run（代码运行）、/api/generate-quiz、/api/debug、/api/feedback
 *
 * 说明：现有 pages 仍在用 src/api.js（同一批接口）；P2 迁移时统一切到本文件。
 */
import { API_BASE } from '../../config/app.js'

export async function request(path, payload = {}, options = {}) {
  const { timeout = 30000, signal } = options
  const controller = new AbortController()
  const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal || controller.signal,
    })
    if (!res.ok) throw new Error(`请求失败（${res.status}）`)
    const body = await res.json()
    if (body && body.ok === false) throw new Error(body.error || '请求失败')
    return body
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const api = {
  extract: (imageBase64, mime) => request('/api/extract', { image_base64: imageBase64, mime }),
  explain: (question, attempt) => request('/api/explain', { question, attempt }),
  judge: (payload) => request('/api/judge', payload),
  run: (lang, code, stdin) => request('/api/run', { lang, code, stdin }),
  debug: (payload) => request('/api/debug', payload),
  syncPush: (token, items, stats) => request('/api/sync/push', { token, items, stats }),
  syncPull: (token) => request('/api/sync/pull', { token }),
}
