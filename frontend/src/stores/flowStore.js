/**
 * flowStore · 出题讲解流程（多题串行讲解 + 合并/拆分/重出题）
 * ---------------------------------------------------------------------------
 * 从 App.vue 抽出（P2.5）。行为不变：串行讲解、代次（gen）打断旧循环、
 * 追问与「换个讲法」挂在题目项上随题保存。
 */
import { nextTick, reactive, ref } from 'vue'
import { api } from '../api'
import { nextId, splitQuestions } from '../book'
import { recordAction } from './statsStore'

const questions = ref([])
let gen = 0 // 讲解代次：合并/拆分/新增变式题时自增，打断旧的串行循环

/**
 * 识别状态（P4）：真实 /api/extract 请求期间，用「可理解的任务阶段」驱动进度文案。
 * 只展示用户能理解的任务状态，不展示模型内部思维链。
 */
export const recognizeState = reactive({
  status: 'idle', // idle | running | done | error | aborted
  step: 0, // 当前进行到第几步（0-based）
  steps: ['正在读取题目', '正在识别题目结构', '正在整理题目'],
  found: 0, // 识别完成后发现的题数
  error: '',
})

let recognizeCtrl = null
let stepTimers = []

export function flowRef() {
  return questions
}

export function getQuestions() {
  return questions.value
}

export function makeFlowItem(text, attempt = '') {
  return {
    id: nextId(),
    text,
    attempt,
    status: 'pending',
    result: null,
    error: '',
    followups: [],
    reteach: [],
  }
}

/** 是否有题目正在生成（供全局 AI 状态条使用） */
export function isGenerating() {
  return questions.value.some((i) => i.status === 'loading')
}

/** 识别图片（真实接口）：期间推进步骤文案，完成后返回题数与文本 */
export function recognize(imageBase64, mime) {
  clearStepTimers()
  recognizeCtrl = new AbortController()
  recognizeState.status = 'running'
  recognizeState.step = 0
  recognizeState.found = 0
  recognizeState.error = ''
  recognizeState.steps = ['正在读取题目', '正在识别题目结构', '正在整理题目']

  // 真实请求期间，用时间推进「可理解」的阶段提示（仅 UI 引导，非模型过程）
  stepTimers.push(setTimeout(() => { if (recognizeState.status === 'running') recognizeState.step = 1 }, 700))
  stepTimers.push(setTimeout(() => { if (recognizeState.status === 'running') recognizeState.step = 2 }, 1500))

  return api
    .extract(imageBase64, mime, recognizeCtrl.signal)
    .then((data) => {
      clearStepTimers()
      const q = (data && data.question) || ''
      if (!String(q).trim()) {
        recognizeState.status = 'error'
        recognizeState.error = '未识别到题目文字，请换一张更清晰的照片或直接输入文字'
        return null
      }
      const parts = splitQuestions(q)
      recognizeState.found = parts.length
      recognizeState.status = 'done'
      return { question: q, count: parts.length, texts: parts }
    })
    .catch((e) => {
      clearStepTimers()
      if (recognizeCtrl && recognizeCtrl.signal.aborted) recognizeState.status = 'aborted'
      else if (e && e.name === 'AbortError') recognizeState.status = 'aborted'
      else {
        recognizeState.status = 'error'
        recognizeState.error = e && e.message ? e.message : '识别失败，请重试'
      }
      return null
    })
}

export function abortRecognize() {
  clearStepTimers()
  if (recognizeCtrl) recognizeCtrl.abort()
}

function clearStepTimers() {
  stepTimers.forEach((t) => clearTimeout(t))
  stepTimers = []
}

/** 把识别到的多题文本送入讲解流程（逐个串行讲解） */
export function startFromTexts(texts) {
  const parts = Array.isArray(texts) && texts.length ? texts : splitQuestions(texts || '')
  questions.value = parts.map((text) => makeFlowItem(text))
  explainAll()
}

/** 从识别结果开始讲解（兼容旧签名：传整段文本或字符串数组） */
export function startFromText(question) {
  startFromTexts(Array.isArray(question) ? question : splitQuestions(question))
}

/** 从错题本里的题重新讲解（替换当前流程） */
export function reExplainText(text, attempt = '', depth = 'standard') {
  const item = makeFlowItem(text, attempt || '')
  item.depth = depth
  questions.value = [item]
  explainAll()
}

/**
 * 应用一条流式讲解事件（批次3）
 * 事件协议见后端 /api/explain/stream：{field,delta} / {field_done} / {done,result} / {error}
 */
function applyExplainEvent(item, ev) {
  if (ev.error) return ev.error
  if (ev.delta) {
    if (!item.stream) item.stream = { fields: {}, order: [], done: [], active: '' }
    const f = ev.field
    if (!(f in item.stream.fields)) {
      item.stream.fields[f] = ''
      item.stream.order.push(f)
    }
    item.stream.fields[f] += ev.delta
    item.stream.active = f
    return ''
  }
  if (ev.field_done) {
    if (item.stream && !item.stream.done.includes(ev.field_done)) item.stream.done.push(ev.field_done)
    if (item.stream && item.stream.active === ev.field_done) item.stream.active = ''
    return ''
  }
  if (ev.done) {
    item.result = ev.result || {}
    item.resultDepth = item.depth || 'standard'
    item.fromFallback = !!ev.fallback
    item.stream = null
    return ''
  }
  return ''
}

/** 单题讲解：走流式，失败在首 token 前由服务端降级 */
async function explainOne(item) {
  item.status = 'loading'
  item.error = ''
  item.stream = null
  let firstErr = ''
  try {
    await api.explainStream(
      { question: item.text, attempt: item.attempt || '', depth: item.depth || 'standard' },
      { onEvent: (ev) => { const e = applyExplainEvent(item, ev); if (e && !firstErr) firstErr = e } },
    )
  } catch (e) {
    firstErr = e.message || '讲解失败'
  }
  item.stream = null
  if (item.result) {
    item.status = 'done'
    recordAction('explain', { title: item.text }) // 打卡埋点：完成一次讲解（并进学习记录）
  } else {
    item.error = firstErr || '讲解失败，请重试'
    item.status = 'error'
  }
}

/** 串行讲解（失败逐题记录，不打断其他题） */
export async function explainAll() {
  const myGen = ++gen
  for (const item of questions.value) {
    if (myGen !== gen) return // 被合并/拆分/新增变式题打断
    if (item.status === 'done' || item.status === 'loading') continue
    await explainOne(item)
    if (myGen !== gen) return
  }
}

/** 切换某题的讲解深度（需重新生成才生效；只有内容真变了才重新调用模型） */
export function setDepth(item, depth) {
  item.depth = depth
  item.status = 'pending'
  item.result = null
  item.stream = null
  explainAll()
}

export function reset() {
  gen += 1
  questions.value = []
}

/** 补充某题的作答痕迹后重新讲解（作答痕迹逐题独立） */
export function setAttempt({ item, attempt }) {
  item.attempt = attempt
  item.status = 'pending'
  item.error = ''
  explainAll()
}

/** 把某题与上一题合并 */
export function mergeUp(index) {
  const arr = questions.value.slice()
  const prev = arr[index - 1]
  const cur = arr[index]
  if (!prev || !cur) return
  prev.text = (prev.text + '\n' + cur.text).trim()
  prev.status = 'pending'
  prev.result = null
  prev.error = ''
  arr.splice(index, 1)
  questions.value = arr
  explainAll()
}

/** 把某题按编辑后的多段文字拆分 */
export function splitItem({ index, texts }) {
  if (!texts || !texts.length) return
  const arr = questions.value.slice()
  arr.splice(index, 1, ...texts.map((text) => makeFlowItem(text)))
  questions.value = arr
  explainAll()
}

export function retryItem(item) {
  item.status = 'pending'
  item.error = ''
  explainAll()
}

/** 讲解里的「变式题」→ 追加为新的一题并讲解；已存在则返回该题 id */
export async function addVariant(text) {
  const t = (text || '').trim()
  if (!t) return ''
  const exist = questions.value.find((i) => (i.text || '').trim() === t)
  if (exist) return exist.id
  const item = makeFlowItem(t)
  questions.value = [...questions.value, item]
  await nextTick()
  explainAll()
  return item.id
}
