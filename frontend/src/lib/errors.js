/**
 * 统一错误分类与用户可见文案
 * ---------------------------------------------------------------------------
 * 背景：原先各页面自己写 catch 文案，网络异常会直接把浏览器的英文原文
 * （Failed to fetch / The operation was aborted）弹给用户，也没有重试引导。
 *
 * 约定：全站三类可判定的异常 + 一类兜底
 *   1. 网络异常（断网 / DNS / 连接被拒）→ 让用户检查网络
 *   2. 服务繁忙或超时（AI 调用慢、请求超时）→ 让用户稍后重试
 *   3. 登录状态过期 → 引导重新登录
 *   4. 业务规则拒绝（老师权限、已过截止、重复提交等）→ 直接显示后端给的说明
 *
 * 纯逻辑，可离线断言（见 frontend/_test_errors.mjs）
 */
import { toast } from '../ui/toast.js'

const NETWORK_RE = /failed to fetch|networkerror|load failed|net::|err_(?:connection|network|internet)|网络|断网/i
const TIMEOUT_RE = /aborted|timeout|timed out|超时|请求过慢/i
const AUTH_RE = /请先登录|未登录|登录已过期|登录过期|token/i
const RULE_RE = /只有|无权|不能|不在|已过截止|重复|已提交|上限|最多|不存在|不匹配/i

/**
 * 把任意异常归类成 { kind, title, hint, canRetry }。
 * title 一定是可以直接给用户看的中文短句。
 */
export function classifyError(e) {
  // 注意：Error 对象的 message 可能为空串，此时不能退化成 String(e)（会得到 "Error"）
  const raw = e && typeof e === 'object' ? String(e.message || '') : String(e || '')
  const msg = raw.trim()
  if (TIMEOUT_RE.test(msg)) {
    return { kind: 'timeout', title: '服务响应较慢，这次没等到结果', hint: '稍等几秒再试一次；连续失败可以先不用图片。', canRetry: true }
  }
  if (NETWORK_RE.test(msg)) {
    return { kind: 'network', title: '网络连接失败', hint: '检查一下网络（或换个 Wi-Fi/流量）再试。', canRetry: true }
  }
  if (AUTH_RE.test(msg)) {
    return { kind: 'auth', title: '登录状态已过期', hint: '重新登录后就能继续。', canRetry: false }
  }
  if (msg && RULE_RE.test(msg)) {
    return { kind: 'rule', title: msg, hint: '', canRetry: false }
  }
  return { kind: 'server', title: msg || '操作失败', hint: msg ? '' : '如果反复出现，把这一步的操作告诉我。', canRetry: true }
}

/** 统一的错误提示：title 必显，hint 拼在后面（不额外弹第二条 toast） */
export function toastError(e, fallback) {
  const c = classifyError(e)
  const title = !c.title || c.title === '操作失败' ? fallback || '操作失败' : c.title
  toast.error(c.hint ? `${title} · ${c.hint}` : title)
  return c
}

/** 用于页面内联错误态（如 UiErrorState 的文案） */
export function errorText(e, fallback) {
  const c = classifyError(e)
  const title = !c.title || c.title === '操作失败' ? fallback || '加载失败' : c.title
  return c.hint ? `${title}（${c.hint}）` : title
}
