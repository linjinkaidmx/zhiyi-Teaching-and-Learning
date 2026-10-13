<!-- [LEGACY-P8] 本组件已无任何引用（功能已迁到 pages/* 与 ui/*），
     保留文件仅为回看对照，可随时删除。它仍引用 Element Plus，但不在构建图里。 -->
<template>
  <div class="fu">
    <div class="fu-toolbar">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="fast">快答</el-radio-button>
        <el-radio-button value="deep">深思</el-radio-button>
      </el-radio-group>
      <span class="muted fu-hint">
        {{ sending
          ? 'AI 正在回答，答案会逐字出现…'
          : (mode === 'deep' ? '深思：讲得最透，需等十几秒到几十秒' : '快答：几秒出结果，适合简单确认') }}
      </span>
    </div>

    <div v-if="!followups.length && !inflight" class="fu-quick">
      <span class="muted" style="margin-right: 2px">试试这样问：</span>
      <button v-for="q in QUICK" :key="q" class="fu-chip" @click="send(q)">{{ q }}</button>
    </div>

    <!-- 已完成的追问 -->
    <div v-for="(f, i) in followups" :key="f.id" class="fu-item">
      <div class="fu-q">
        <span class="fu-tag">{{ f.mode === 'fast' ? '快答' : '深思' }}</span>
        <span class="fu-q-text">{{ f.q }}</span>
        <button class="fu-del" title="删除这条追问" @click="removeAt(i)">×</button>
      </div>
      <div class="fu-a"><MarkdownText :content="f.a" /></div>
    </div>

    <!-- 生成中的一条（流式阶段纯文本逐字显示，完成后并入上方列表由 MathText 渲染公式） -->
    <div v-if="inflight" class="fu-item">
      <div class="fu-q">
        <span class="fu-tag">{{ inflight.mode === 'fast' ? '快答' : '深思' }}</span>
        <span class="fu-q-text">{{ inflight.q }}</span>
      </div>
      <div class="fu-a">
        <div v-if="inflight.phase === 'thinking'" class="fu-thinking">
          <el-progress :indeterminate="true" :duration="2" :show-text="false" style="width: 110px" />
          <span class="muted">AI 思考中…</span>
        </div>
        <template v-else>
          <div class="fu-stream">{{ inflight.text }}</div>
          <div v-if="inflight.phase === 'error'" class="fu-err">
            <span>回答中断{{ inflight.errMsg ? '：' + inflight.errMsg : '' }}</span>
            <el-button size="small" type="warning" plain @click="regenerate">重试</el-button>
          </div>
        </template>
      </div>
    </div>

    <div class="fu-input">
      <el-input
        v-model="draft"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        :placeholder="reachedCap ? '已达追问上限，删除旧追问后可继续' : '还有哪里没看懂？直接问老师，例如「第二步为什么能这样变形」'"
        :disabled="sending || reachedCap"
        @keydown.enter="onEnter"
      />
      <div class="fu-actions">
        <span class="muted">
          {{ reachedCap ? `已达 ${MAX} 条上限，可删除旧追问后继续` : 'Enter 发送 · Shift+Enter 换行' }}
        </span>
        <el-button size="small" type="primary" :disabled="!draft.trim() || sending || reachedCap" @click="send()">
          {{ sending ? '回答中…' : '追问' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownText from './MarkdownText.vue'
import { api } from '../api'
import { nextId } from '../book'
import { recordAction } from '../statsStore'
import { getPrefs } from '../profileStore'

const MAX = 30
const MODE_KEY = 'zhiyi_followup_mode'
const QUICK = ['能再讲细一点吗', '为什么这一步成立', '换个方法讲讲', '举个具体例子', '这个知识点考试怎么考']

const props = defineProps({
  question: { type: String, default: '' },
  result: { type: Object, default: () => ({}) },
  followups: { type: Array, default: () => [] },
})
const emit = defineEmits(['update'])

// 默认档位取自「我的 → 偏好设置」；面板内的临时切换仍记在本地
const mode = ref(getPrefs().defaultMode === 'fast' ? 'fast' : 'deep')
watch(mode, (m) => localStorage.setItem(MODE_KEY, m))

const draft = ref('')
const sending = ref(false)
const inflight = ref(null) // { q, mode, text, phase: thinking|streaming|error, errMsg }
let ctrl = null
let unmounted = false

const reachedCap = computed(() => props.followups.length >= MAX)

/** 已完成的追问作为上下文（最近 6 轮，供模型保持前后一致） */
function historyFor() {
  return props.followups
    .slice(-6)
    .filter((f) => (f.a || '').trim())
    .map((f) => ({ q: f.q, a: f.a }))
}

function emitList(list) {
  emit('update', list)
}

async function send(preset) {
  const q = (typeof preset === 'string' ? preset : draft.value).trim()
  if (!q || sending.value || reachedCap.value) return
  if (q.length > 500) {
    ElMessage.warning('问题请控制在 500 字以内')
    return
  }
  draft.value = ''
  inflight.value = { q, mode: mode.value, text: '', phase: 'thinking', errMsg: '' }
  await run()
}

async function run() {
  const f = inflight.value
  if (!f) return
  sending.value = true
  ctrl = new AbortController()
  try {
    await api.followUp(
      { question: props.question, result: props.result, history: historyFor(), followup: f.q, mode: f.mode },
      {
        signal: ctrl.signal,
        onDelta: (d) => {
          if (inflight.value !== f) return
          f.text += d
          if (f.phase === 'thinking') f.phase = 'streaming'
        },
      },
    )
    finish()
  } catch (e) {
    if (unmounted || inflight.value !== f) return
    const msg = e && e.name === 'AbortError' ? '请求超时或已中断' : ((e && e.message) || '网络异常')
    f.phase = 'error'
    f.errMsg = msg
    if (!f.text) ElMessage.error('追问失败：' + msg)
  } finally {
    sending.value = false
  }
}

async function regenerate() {
  const f = inflight.value
  if (!f || sending.value) return
  f.text = ''
  f.phase = 'thinking'
  f.errMsg = ''
  await run()
}

/** 流式结束（或用户中断）后把这一条并入持久列表 */
function finish() {
  const f = inflight.value
  if (!f) return
  const a = (f.text || '').trim()
  inflight.value = null
  if (!a) return
  emitList([...props.followups, { id: nextId(), q: f.q, a, mode: f.mode, createdAt: new Date().toISOString() }])
  recordAction('followup')            // 打卡埋点：向 AI 追问
}

function removeAt(i) {
  emitList(props.followups.filter((_, idx) => idx !== i))
}

function onEnter(e) {
  if (e.shiftKey) return
  e.preventDefault()
  send()
}

// 切换题目时（组件未被 key 强制重建的兜底）丢弃进行中的追问，避免答错题
watch(() => props.question, () => {
  if (inflight.value) {
    if (ctrl) ctrl.abort()
    inflight.value = null
    sending.value = false
  }
})

onBeforeUnmount(() => {
  unmounted = true
  if (ctrl) ctrl.abort()
})
</script>

<style scoped>
.fu-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.fu-hint { font-size: 12.5px; }

.fu-quick {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.fu-chip {
  border: 1px solid #d3dbec;
  background: #f6f8fc;
  color: #35507a;
  border-radius: 999px;
  padding: 3px 11px;
  font-size: 12.5px;
  cursor: pointer;
}
.fu-chip:hover { border-color: #8b9cc0; background: #eef2f9; }

.fu-item {
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 10px;
  background: #fdfdfe;
}
.fu-q {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: #1f2733;
}
.fu-tag {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
  color: #35507a;
  border: 1px solid #d3dbec;
  background: #f2f5fa;
  border-radius: 999px;
  padding: 0 7px;
  margin-top: 1px;
}
.fu-q-text { flex: 1; min-width: 0; word-break: break-word; }
.fu-del {
  flex-shrink: 0;
  border: none;
  background: none;
  color: #b6c0cf;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.fu-del:hover { color: #b54444; }

.fu-a {
  margin-top: 8px;
  padding-left: 10px;
  border-left: 2px solid #e9edf5;
  font-size: 14px;
  line-height: 1.7;
}
.fu-stream {
  white-space: pre-wrap;
  word-break: break-word;
  color: #1f2733;
}
.fu-thinking {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.fu-err {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #b54444;
}

.fu-input { margin-top: 12px; }
.fu-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .fu-hint { display: none; }
  .fu-item { padding: 9px 11px; }
}
</style>
