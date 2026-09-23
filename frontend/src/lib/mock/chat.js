/**
 * AI 对话 · Mock 服务（后端接口未就绪）
 * ---------------------------------------------------------------------------
 * 与真实接口同形：接收 { messages, context }，用 onDelta 逐段回调（模拟流式），
 * 支持 AbortSignal 中断。后端就绪后删除本文件，改由 adapter 调真实接口。
 * 注意：这里回的是「演示内容」，不假装是真实模型回答。
 */
import { MOCK } from '../../config/app.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 根据引用内容与提问，拼一段结构化的演示回答 */
function compose(payload) {
  const ctx = payload.context || []
  const last = [...(payload.messages || [])].reverse().find((m) => m.role === 'user')
  const q = (last && last.text) || ''

  const lines = []
  if (ctx.length) {
    lines.push(`先说你引用的 ${ctx.length} 条内容：`)
    ctx.forEach((c, i) => lines.push(`${i + 1}. ${c.title}${c.brief ? `（${c.brief}）` : ''}`))
    lines.push('')
  }
  lines.push('这是**演示回答**（AI 对话接口尚未接入后端），先说明我会怎么回答：')
  lines.push('')
  lines.push(`1. 先确认你问的是：${q || '（空）'}`)
  lines.push('2. 再给出结论与理由，必要时分步骤展开')
  lines.push('3. 最后给可以继续追问的方向')
  lines.push('')
  lines.push('接口就绪后，这里会替换为真实模型的流式输出，交互（流式 / 停止 / 重新生成 / 引用范围）保持不变。')
  return lines.join('\n')
}

/**
 * 流式发送
 * @param {{messages:Array, context:Array}} payload
 * @param {{onDelta:Function, signal:AbortSignal}} handlers
 */
export async function sendMock(payload, { onDelta, signal } = {}) {
  if (!MOCK.chat) throw new Error('AI 对话后端未实现（MOCK.chat=false）')
  const text = compose(payload)
  const chunks = text.match(/[\s\S]{1,6}/g) || []
  for (const chunk of chunks) {
    if (signal && signal.aborted) {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }
    if (onDelta) onDelta(chunk)
    await wait(18)
  }
  return { ok: true }
}
