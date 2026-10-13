<template>
  <div class="zy-container zy-page chat">
    <div class="chat__layout">
      <!-- 会话列表 -->
      <aside v-show="showList" class="chat__list">
        <header class="chat__list-head">
          <h1 class="t-h2">AI 对话</h1>
          <UiButton variant="primary" size="sm" @click="newChat">＋ 新对话</UiButton>
        </header>

        <p class="t-label chat__note">与题目无关的开放式问答，可引用你的错题与讲解</p>

        <UiEmptyState
          v-if="!conversations.length"
          title="还没有对话"
          description="点「新对话」开始；问什么都行，也可以引用错题让我结合着讲。"
        />

        <ul v-else class="chat__items">
          <li v-for="c in conversations" :key="c.id">
            <div class="chat__item" :class="{ 'is-active': c.id === chatId }" @click="openChat(c.id)">
              <span class="chat__item-ic"><UiIcon name="chatDots" :size="15" /></span>
              <div class="chat__item-body">
                <div class="chat__item-title">{{ c.title }}</div>
                <div class="t-label chat__item-meta">{{ c.messages.length }} 条 · {{ timeText(c.updatedAt) }}</div>
              </div>
              <button class="chat__item-del" type="button" aria-label="删除对话" @click.stop="doRemove(c.id)">
                <UiIcon name="trash" :size="14" />
              </button>
            </div>
          </li>
        </ul>
      </aside>

      <!-- 对话详情 -->
      <section v-show="showDetail" class="chat__main">
        <header class="chat__main-head">
          <UiButton v-show="isMobile" variant="soft" size="sm" class="zy-back" @click="backToList" icon="left">对话</UiButton>
          <h2 class="t-h3 chat__main-title">{{ conv ? conv.title : 'AI 对话' }}</h2>
          <UiButton v-if="conv" variant="ghost" size="sm" @click="pickerOpen = true">引用学习内容</UiButton>
        </header>

        <div ref="scroller" class="chat__scroll">
          <UiEmptyState
            v-if="!conv || !conv.messages.length"
            title="开始一段新对话"
            description="可以直接提问，也可以先「引用学习内容」把错题带进来一起问。"
          >
            <template #action>
              <div class="chat__starter">
                <span class="t-label chat__starter-head">试试问这些：</span>
                <div class="chat__starter-grid">
                  <button v-for="s in starters" :key="s" type="button" class="chat__starter-btn" @click="sendStarter(s)">
                    <span class="chat__starter-ic"><UiIcon name="sparkle" :size="14" /></span>
                    <span class="chat__starter-text">{{ s }}</span>
                  </button>
                </div>
              </div>
            </template>
          </UiEmptyState>

          <div v-for="m in conv ? conv.messages : []" :key="m.id" class="chat__msg" :data-role="m.role">
            <UiAiLogo v-if="m.role === 'assistant'" :state="m.streaming ? 'streaming' : 'completed'" size="sm" class="chat__avatar" />
            <div class="chat__col">
              <div class="chat__bubble">
                <div v-if="m.context && m.context.length" class="chat__ctx">
                  <span class="t-label">引用 {{ m.context.length }} 条：</span>
                  <UiTag v-for="c in m.context" :key="c.id" variant="brand-soft">{{ c.title }}</UiTag>
                </div>
                <MarkdownText v-if="m.role === 'assistant' && !m.streaming" :content="m.text" />
                <p v-else-if="m.role === 'user'" class="chat__plain chat__pre"><MathText :content="m.text" /></p>
                <p v-else class="chat__plain">{{ m.text }}<span v-if="m.streaming" class="ai-caret" /></p>
                <p v-if="m.error" class="t-label chat__err">{{ m.error }}</p>
              </div>
              <div v-if="m.role === 'assistant' && !m.streaming" class="chat__msg-ops">
                <button class="chat__msg-op" type="button" title="重新生成" @click="regenerate(m)">
                  <UiIcon name="refresh" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer class="chat__foot">
          <!-- 知识点快捷提问：点一下填入输入框，可改几个字再发送 -->
          <div v-if="kpQuestions.length" class="chat__suggests">
            <div class="chat__suggests-head">
              <span class="t-label">关于「{{ kpName }}」，你可以直接问：</span>
              <span v-if="suggestsLoading" class="t-label chat__suggests-loading">AI 正在生成更贴合的问题…</span>
            </div>
            <div class="chat__suggests-list">
              <button
                v-for="q in kpQuestions"
                :key="q"
                type="button"
                class="chat__sugg"
                @click="useSuggest(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>
          <div v-if="pendingContext.length" class="chat__pending">
            <span class="t-label">将引用：</span>
            <UiTag v-for="c in pendingContext" :key="c.id" variant="brand-soft" clickable @click="dropContext(c.id)">
              {{ c.title }} ×
            </UiTag>
          </div>
          <div class="chat__input">
            <textarea
              v-model="draft"
              class="chat__textarea"
              rows="1"
              placeholder="想问什么？Enter 发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="send"
            />
            <UiButton v-if="!sending" variant="primary" size="sm" :disabled="!draft.trim()" @click="send">发送</UiButton>
            <UiButton v-else variant="ghost" size="sm" @click="stop">停止</UiButton>
          </div>
          <p class="t-label chat__tip">回答由 AI 生成，可能有误；涉及计算请自己再验算一遍。</p>
        </footer>
      </section>
    </div>

    <!-- 引用学习内容选择器 -->
    <UiModal v-model="pickerOpen" title="引用学习内容" size="lg">
      <p class="t-body-2">只勾选你要引用的内容，未勾选的不会带进对话。</p>
      <div v-if="!contextOptions.length" class="pick__empty t-body-2">错题本还是空的，先去拍题或保存几道错题。</div>
      <ul v-else class="pick__list">
        <li v-for="c in contextOptions" :key="c.id">
          <label class="pick__row">
            <input type="checkbox" :checked="isPicked(c.id)" @change="togglePick(c)" />
            <span class="pick__title">{{ c.title }}</span>
            <span class="t-label pick__brief">{{ c.brief }}</span>
          </label>
        </li>
      </ul>
      <template #footer>
        <UiButton variant="ghost" @click="pickerOpen = false">取消</UiButton>
        <UiButton variant="primary" @click="confirmPick">确定引用（{{ picked.length }}）</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * AI 对话（/chat 列表 + /chat/:id 详情）
 * ---------------------------------------------------------------------------
 * 桌面：左列表 + 右详情；移动：列表 ↔ 详情按路由切换（返回按钮回列表）。
 * 发送走 lib/adapter/chat.js（当前 Mock 流式），交互（流式/停止/重新生成/引用）与真实接口一致。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import MarkdownText from '../components/MarkdownText.vue'
import MathText from '../components/MathText.vue'
import { latexToPlain } from '../mathtext'
import { ROUTES } from '../lib/routes.js'
import { sendMessage } from '../lib/adapter/chat.js'
import { buildQuestions } from '../lib/kpQuestions.js'
import { fetchBetterQuestions, mergeQuestions } from '../lib/kpQuestionsAi.js'
import {
  conversations, createChat, getChat, removeChat, appendMessage, updateMessage,
  truncateAfter, setActive,
} from '../stores/chatStore'
import { getItems } from '../stores/bookStore'
import { toast } from '../ui/toast.js'

const route = useRoute()
const router = useRouter()

const draft = ref('')
const sending = ref(false)
const pickerOpen = ref(false)
const picked = ref([])
const pendingContext = ref([])
const scroller = ref(null)
const isMobile = ref(false)
let ctrl = null

const chatId = computed(() => String(route.params.id || ''))
const conv = computed(() => (chatId.value ? getChat(chatId.value) : null))
/* 带 ?kp= 进来时手机上也要进详情区，否则只能看到会话列表、看不到候选问题 */
const kpName = computed(() => String(route.query.kp || '').trim())
const showList = computed(() => (!isMobile.value || !chatId.value) && !kpName.value)
const showDetail = computed(() => !isMobile.value || !!chatId.value || !!kpName.value)

/* 错题本 → 可引用内容（只列用户自己保存的错题）——题干摘要先转纯文本符号，避免 LaTeX 源码残留 */
const contextOptions = computed(() =>
  getItems().slice(0, 50).map((it) => ({
    id: it.id,
    title: latexToPlain(String(it.question || '')).replace(/\s+/g, ' ').slice(0, 40),
    brief: (it.knowledgePoints || []).slice(0, 3).join('、'),
  })),
)

function updateIsMobile() {
  isMobile.value = window.innerWidth < 640
}

// 会话存储由 sessionStore.initSession() 按空间初始化（App 启动时已执行）
updateIsMobile()
window.addEventListener('resize', updateIsMobile)

/* ---------------- 知识点快捷提问（首页推荐知识点点进来） ---------------- */
const suggests = ref([])
const suggestsLoading = ref(false)
let kpCtrl = null

/** 该知识点在错题本里的错题（用于「错因诊断」条与自动引用） */
const kpWrongItems = computed(() => {
  const name = kpName.value
  if (!name) return []
  return getItems().filter((it) => (it.knowledgePoints || []).some((k) => String(k).trim() === name))
})

/** 候选问题：模板先出，AI 回来后替换 */
const kpQuestions = computed(() => {
  const name = kpName.value
  if (!name) return []
  return suggests.value.length ? suggests.value : buildQuestions(name, { wrongCount: kpWrongItems.value.length })
})

function resetSuggests() {
  suggests.value = []
  suggestsLoading.value = false
  if (kpCtrl) {
    kpCtrl.abort()
    kpCtrl = null
  }
}

async function loadSuggests() {
  const name = kpName.value
  if (!name) {
    resetSuggests()
    return
  }
  // 先用模板（含错题诊断条）秒出，AI 回来后整体替换
  suggests.value = buildQuestions(name, { wrongCount: kpWrongItems.value.length })
  suggestsLoading.value = true
  kpCtrl = new AbortController()
  const signal = kpCtrl.signal
  try {
    const better = await fetchBetterQuestions(name, { signal })
    // 期间用户可能已经走了、或已经发过消息
    if (signal.aborted || kpName.value !== name) return
    if (better.length) {
      suggests.value = mergeQuestions(name, better, { wrongCount: kpWrongItems.value.length })
    }
  } catch {
    /* 静默：保留模板问题 */
  } finally {
    if (!signal.aborted) suggestsLoading.value = false
  }
}

/** 点候选问题：填入输入框（可改），同时把该知识点的一道错题挂为引用 */
function useSuggest(q) {
  draft.value = q
  const wrong = kpWrongItems.value[0]
  if (wrong) {
    const opt = contextOptions.value.find((o) => o.id === wrong.id)
    if (opt && !pendingContext.value.some((c) => c.id === opt.id)) {
      pendingContext.value = [opt]
    }
  }
  // 用过一次就收起，并把 URL 上的 kp 去掉（刷新不再冒出来）
  resetSuggests()
  router.replace({ path: chatId.value ? `/chat/${chatId.value}` : ROUTES.chat })
  nextTick(() => {
    const el = document.querySelector('.chat__textarea')
    if (el) el.focus()
  })
}

/** 会话标题：从知识点进来时用知识点命名 */
const pendingTitle = computed(() => kpName.value)

function timeText(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()}`
}

/** 会话列表：最后一条消息预览 */
function lastPreview(c) {
  const msgs = c.messages || []
  if (!msgs.length) return ''
  const last = msgs[msgs.length - 1]
  const t = latexToPlain(String(last.text || '')).replace(/\s+/g, ' ').trim()
  return t.length > 26 ? t.slice(0, 26) + '…' : t
}

/** 空对话态建议问题 */
const starters = [
  '帮我解释一个高数概念',
  '总结我的错题薄弱点',
  '推荐一个学习方法',
  '结合一道错题讲讲',
]
function sendStarter(text) {
  draft.value = text
  send()
}

function newChat() {
  const id = createChat()
  router.push(`/chat/${id}`)
  nextTick(() => scrollBottom())
}

function openChat(id) {
  setActive(id)
  router.push(`/chat/${id}`)
}

function backToList() {
  router.push(ROUTES.chat)
}

function doRemove(id) {
  removeChat(id)
  if (chatId.value === id) router.push(ROUTES.chat)
  toast.info('已删除对话')
}

function scrollBottom() {
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

/* ---------------- 引用学习内容 ---------------- */
function isPicked(id) {
  return picked.value.some((p) => p.id === id)
}
function togglePick(c) {
  if (isPicked(c.id)) picked.value = picked.value.filter((p) => p.id !== c.id)
  else picked.value = [...picked.value, c]
}
function confirmPick() {
  // 已发送过的引用不重复带
  const used = new Set(pendingContext.value.map((p) => p.id))
  pendingContext.value = [...pendingContext.value, ...picked.value.filter((p) => !used.has(p.id))]
  picked.value = []
  pickerOpen.value = false
}
function dropContext(id) {
  pendingContext.value = pendingContext.value.filter((p) => p.id !== id)
}

/* ---------------- 发送 / 流式 / 停止 / 重新生成 ---------------- */
/**
 * 取用于模型的历史消息。
 * 必须按**显式传入的会话 id** 取，不能用 route 推导的 conv：
 * send() 里 createChat() 之后 router.push 是异步的，此刻 route.params.id 还没更新，
 * 用 conv.value 会拿到 null → 历史为空 → 模型收不到任何对话（实测踩过，表现为回答空白）。
 */
function historyFor(chatIdForHistory) {
  const c = getChat(chatIdForHistory)
  if (!c) return []
  return c.messages
    .filter((m) => !m.streaming && !m.error)
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text }))
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  let id = chatId.value
  if (!id) {
    // 从知识点进来时，用知识点名当会话标题（比「新对话」好找）
    id = createChat(pendingTitle.value || '新对话')
    router.push(`/chat/${id}`)
  }
  resetSuggests() // 发出任意一条后，候选问题就收起
  appendMessage(id, { role: 'user', text, context: pendingContext.value })
  const ctx = pendingContext.value
  pendingContext.value = []
  draft.value = ''
  await runAssistant(id, ctx)
}

async function runAssistant(id, context) {
  const placeholder = appendMessage(id, { role: 'assistant', text: '', streaming: true, context: [] })
  if (!placeholder) return
  sending.value = true
  ctrl = new AbortController()
  await nextTick()
  scrollBottom()
  try {
    await sendMessage(
      { messages: historyFor(id), context },
      {
        signal: ctrl.signal,
        onDelta: (chunk) => {
          updateMessage(id, placeholder.id, { text: (getChat(id)?.messages.find((m) => m.id === placeholder.id)?.text || '') + chunk })
          scrollBottom()
        },
      },
    )
    updateMessage(id, placeholder.id, { streaming: false })
  } catch (e) {
    const aborted = e && e.name === 'AbortError'
    updateMessage(id, placeholder.id, {
      streaming: false,
      error: aborted ? '' : `生成失败：${(e && e.message) || '网络异常'}`,
      text: getChat(id)?.messages.find((m) => m.id === placeholder.id)?.text || '',
    })
    if (aborted) toast.info('已停止生成')
  } finally {
    sending.value = false
    ctrl = null
    scrollBottom()
  }
}

function stop() {
  if (ctrl) ctrl.abort()
  sending.value = false
}

/** 重新生成：截掉该条及之后的助手内容，用它前面的用户消息重跑 */
async function regenerate(msg) {
  if (sending.value || !conv.value) return
  const msgs = conv.value.messages
  const idx = msgs.findIndex((m) => m.id === msg.id)
  if (idx < 0) return
  const userMsg = [...msgs.slice(0, idx)].reverse().find((m) => m.role === 'user')
  if (!userMsg) return
  truncateAfter(chatId.value, userMsg.id)
  await runAssistant(chatId.value, userMsg.context || [])
}

watch(() => route.fullPath, () => {
  updateIsMobile()
  // 换会话 / 清掉 kp 时重新判断要不要显示候选问题
  loadSuggests()
  nextTick(() => scrollBottom())
})

onMounted(() => {
  loadSuggests()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
  if (ctrl) ctrl.abort()
  if (kpCtrl) kpCtrl.abort()
})

</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  max-width: 1280px;
}
.chat__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: stretch;
}
.chat__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--grad-surface);
  box-shadow: var(--highlight-1), var(--shadow-subtle);
}
.chat__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.chat__note {
  color: var(--text-muted);
  line-height: var(--lh-body);
}
.chat__items {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.chat__item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.chat__item:hover {
  background: var(--surface-hover);
}
.chat__item.is-active {
  background: var(--primary-soft-3);
  box-shadow: inset 2px 0 0 var(--primary);
}
/* 会话图标块 */
.chat__item-ic {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-unit);
  color: var(--text-tertiary);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.chat__item:hover .chat__item-ic {
  background: var(--primary-soft-3);
  color: var(--primary-text);
}
.chat__item.is-active .chat__item-ic {
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.chat__item-body {
  flex: 1;
  min-width: 0;
}
.chat__item-title {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat__item.is-active .chat__item-title {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.chat__item-meta {
  color: var(--text-muted);
  margin-top: 2px;
}
/* 删除按钮：默认隐藏，悬停或当前项才出现（防误触） */
.chat__item-del {
  flex: none;
  border: 0;
  background: none;
  color: var(--text-muted);
  line-height: 1;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease),
    opacity var(--dur) var(--ease);
}
.chat__item:hover .chat__item-del,
.chat__item.is-active .chat__item-del {
  opacity: 1;
}
.chat__item-del:hover {
  color: var(--error, #c0392b);
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
}

.chat__main {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px); /* 全高布局：占满视口，输入框贴底 */
  min-height: 480px;
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--grad-surface);
  box-shadow: var(--highlight-1), var(--shadow-subtle);
  overflow: hidden;
}
.chat__main-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-5);
  border-bottom: var(--border-divider-soft);
}
.chat__main-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat__scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.chat__msg {
  display: flex;
  flex-direction: row;
  gap: var(--sp-2);
  align-items: flex-start;
}
.chat__msg[data-role='user'] {
  flex-direction: row-reverse;
}
.chat__avatar {
  margin-top: 2px;
}
.chat__col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  max-width: 78%;
}
.chat__msg[data-role='user'] .chat__col {
  align-items: flex-end;
}
.chat__bubble {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
  background: var(--surface-1);
  border: var(--border-subtle);
}
.chat__msg[data-role='user'] .chat__bubble {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: transparent;
  border-top-right-radius: var(--radius-sm);
}
.chat__msg[data-role='assistant'] .chat__bubble {
  border-top-left-radius: var(--radius-sm);
}
.chat__plain {
  white-space: pre-wrap;
}
.chat__ctx {
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
  margin-bottom: var(--sp-2);
}
.chat__err {
  color: var(--error);
  margin-top: var(--sp-2);
}
/* 回答操作：悬停才出现，图标按钮不占视觉 */
.chat__msg-ops {
  display: flex;
  gap: var(--sp-2);
  opacity: 0;
  transition: opacity var(--dur) var(--ease);
}
.chat__msg:hover .chat__msg-ops {
  opacity: 1;
}
.chat__msg-op {
  border: 0;
  background: none;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.chat__msg-op:hover {
  color: var(--primary-text);
  background: var(--primary-soft-3);
}
.chat__foot {
  border-top: var(--border-divider-soft);
  padding: var(--sp-3) var(--sp-5) var(--sp-4);
}
/* 知识点快捷提问（首页推荐知识点点进来时出现） */
.chat__suggests {
  margin-bottom: var(--sp-3);
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.chat__suggests-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-2);
}
.chat__suggests-loading {
  color: var(--primary-text);
}
.chat__suggests-list {
  display: flex;
  gap: var(--sp-2);
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}
.chat__sugg {
  flex: none;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--primary-line);
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.chat__sugg:hover {
  background: var(--primary-soft-2);
  border-color: var(--primary);
}
/* 空对话态建议问题：卡片网格（图标 + 文字） */
.chat__starter {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: center;
}
.chat__starter-head {
  text-align: center;
}
.chat__starter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
  gap: var(--sp-2);
  width: 100%;
  max-width: 560px;
}
.chat__starter-btn {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  text-align: left;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.chat__starter-btn:hover {
  transform: translateY(-1px);
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
  color: var(--text-primary);
}
.chat__starter-ic {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.chat__starter-text {
  min-width: 0;
}
.chat__pending {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-2);
}
.chat__input {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
}
.chat__textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  max-height: 140px;
  padding: 10px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-default);
  border-top: var(--border-top-default);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
}
.chat__textarea:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.chat__tip {
  margin-top: var(--sp-2);
  color: var(--text-muted);
}

.pick__empty {
  padding: var(--sp-4) 0;
}
.pick__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin-top: var(--sp-3);
  max-height: 46vh;
  overflow-y: auto;
}
.pick__row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.pick__row:hover {
  background: var(--surface-hover);
}
.pick__title {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick__brief {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .chat__layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .chat__main {
    height: auto;
    min-height: 62vh;
  }
  .chat__bubble {
    max-width: 92%;
  }
}
</style>
