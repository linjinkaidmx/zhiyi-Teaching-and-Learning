/**
 * AI 对话 · adapter（批次2：接真实后端）
 * ---------------------------------------------------------------------------
 * MOCK.chat = true  → 本地演示流式（后端未实现时）
 * MOCK.chat = false → 走真实 /api/chat/stream（后端已实现）
 * UI 契约不变：{ onDelta, signal }；中断抛 AbortError。
 */
import { MOCK } from '../../config/app.js'
import { api } from '../../api'
import { sendMock } from '../mock/chat.js'

/**
 * 发送对话（流式）
 * @param {{messages:Array<{role:string,text:string}>, context:Array<{id,title,brief}>}} payload
 * @param {{onDelta:(chunk:string)=>void, signal?:AbortSignal}} handlers
 */
export async function sendMessage(payload, handlers = {}) {
  const body = {
    messages: (payload.messages || []).map((m) => ({ role: m.role, text: m.text })),
    context: (payload.context || []).map((c) => ({ title: c.title, brief: c.brief || '' })),
  }
  if (MOCK.chat) {
    return sendMock(body, handlers)
  }
  let ok = false
  await api.chatStream(body, {
    signal: handlers.signal,
    onDelta: handlers.onDelta,
    onDone: () => {
      ok = true
    },
  })
  return { ok }
}
