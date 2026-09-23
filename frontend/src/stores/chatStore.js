/**
 * chatStore · AI 对话（会话列表 + 消息），本地存储先行
 * ---------------------------------------------------------------------------
 * 存储：zhiyi_chat_v1（游客）/ zhiyi_chat_account_v1（账号），与本项目其他数据一致的双空间策略。
 * 后端「AI 对话」接口尚未就绪，发送逻辑经 lib/adapter/chat.js（现为 Mock，接口到位只改 adapter）。
 */
import { ref, computed } from 'vue'
import { nextId } from '../book.js'
import { latexToPlain } from '../mathtext.js'

const GUEST_KEY = 'zhiyi_chat_v1'
const ACCOUNT_KEY = 'zhiyi_chat_account_v1'
const MAX_CONVERSATIONS = 50
const MAX_MESSAGES = 100

export const conversations = ref([])
const activeId = ref('')
let space = 'guest'

const keyOf = (sp) => (sp === 'account' ? ACCOUNT_KEY : GUEST_KEY)

function readStore(sp) {
  try {
    const raw = localStorage.getItem(keyOf(sp))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeStore() {
  try {
    localStorage.setItem(keyOf(space), JSON.stringify(conversations.value.slice(0, MAX_CONVERSATIONS)))
  } catch {
    /* 隐私模式忽略 */
  }
}

export function initChat(sp) {
  space = sp === 'account' ? 'account' : 'guest'
  conversations.value = readStore(space)
  activeId.value = conversations.value[0]?.id || ''
  return conversations.value
}

export function chatRef() {
  return conversations
}

export function activeChatRef() {
  return computed(() => conversations.value.find((c) => c.id === activeId.value) || null)
}

// 注意：会话 id 是数字（nextId()），而路由参数 /chat/:id 是字符串 →
// 所有按 id 的查找必须做字符串归一，否则详情页永远找不到会话（实测踩过）。
const idKey = (x) => (x == null ? '' : String(x))

export function setActive(id) {
  activeId.value = id
}

export function getChat(id) {
  const k = idKey(id)
  return conversations.value.find((c) => idKey(c.id) === k) || null
}

/** 新建会话（返回新会话 id） */
export function createChat(title = '新对话') {
  const conv = {
    id: nextId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  conversations.value = [conv, ...conversations.value].slice(0, MAX_CONVERSATIONS)
  activeId.value = conv.id
  writeStore()
  return conv.id
}

export function renameChat(id, title) {
  const conv = getChat(id)
  if (!conv) return
  conv.title = String(title || '').trim().slice(0, 24) || '新对话'
  conv.updatedAt = Date.now()
  writeStore()
}

export function removeChat(id) {
  const k = idKey(id)
  conversations.value = conversations.value.filter((c) => idKey(c.id) !== k)
  if (idKey(activeId.value) === k) activeId.value = conversations.value[0]?.id || ''
  writeStore()
}

export function clearChats() {
  conversations.value = []
  activeId.value = ''
  writeStore()
}

/** 追加一条消息（role: user | assistant） */
export function appendMessage(chatId, message) {
  const conv = getChat(chatId)
  if (!conv) return null
  const msg = {
    id: nextId(),
    role: message.role,
    text: message.text || '',
    context: message.context || [], // 引用学习内容（只含用户勾选项）
    streaming: !!message.streaming,
    error: '',
    createdAt: Date.now(),
  }
  conv.messages = [...conv.messages, msg].slice(-MAX_MESSAGES)
  conv.updatedAt = Date.now()
  // 首条用户消息作为标题
  if (conv.title === '新对话' && msg.role === 'user' && msg.text) {
    conv.title = latexToPlain(msg.text).replace(/\s+/g, ' ').slice(0, 18)
  }
  writeStore()
  return msg
}

export function updateMessage(chatId, msgId, patch) {
  const conv = getChat(chatId)
  if (!conv) return
  const msg = conv.messages.find((m) => m.id === msgId)
  if (!msg) return
  Object.assign(msg, patch)
  conv.updatedAt = Date.now()
  writeStore()
}

/** 删除某条消息及其后的内容（重新生成时用） */
export function truncateAfter(chatId, msgId) {
  const conv = getChat(chatId)
  if (!conv) return
  const i = conv.messages.findIndex((m) => m.id === msgId)
  if (i >= 0) conv.messages = conv.messages.slice(0, i + 1)
  writeStore()
}

export function getSpace() {
  return space
}
