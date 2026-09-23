<!-- [LEGACY-P8] 本组件已无任何引用（功能已迁到 pages/* 与 ui/*），
     保留文件仅为回看对照，可随时删除。它仍引用 Element Plus，但不在构建图里。 -->
<template>
  <div class="rt">
    <div class="rt-angles">
      <span class="muted">这一遍没听懂？换个角度再讲一次：</span>
      <button
        v-for="a in ANGLES"
        :key="a.key"
        class="rt-btn"
        :disabled="sending"
        @click="start(a)"
      >
        {{ a.label }}
      </button>
    </div>

    <!-- 生成中 -->
    <div v-if="inflight" class="rt-card">
      <div class="rt-head">
        <span class="rt-tag">{{ labelOf(inflight.angle) }}</span>
        <span class="muted">生成中…</span>
      </div>
      <div class="rt-body">
        <div v-if="inflight.phase === 'thinking'" class="rt-thinking">
          <el-progress :indeterminate="true" :duration="2" :show-text="false" style="width: 110px" />
          <span class="muted">AI 正在换角度重讲…</span>
        </div>
        <template v-else>
          <div class="rt-stream">{{ inflight.text }}</div>
          <div v-if="inflight.phase === 'error'" class="rt-err">
            <span>生成中断{{ inflight.errMsg ? '：' + inflight.errMsg : '' }}</span>
            <el-button size="small" type="warning" plain @click="regenerate">重试</el-button>
          </div>
        </template>
      </div>
    </div>

    <!-- 已生成的讲法：折叠保留、可与原讲解对照 -->
    <el-collapse v-if="reteach.length" v-model="openIds" class="rt-list">
      <el-collapse-item v-for="(r, i) in reteach" :key="r.id" :name="String(r.id)">
        <template #title>
          <span class="rt-tag">{{ r.angleLabel || labelOf(r.angle) }}</span>
          <span class="muted" style="margin-left: 8px">{{ fmtTime(r.createdAt) }}</span>
        </template>
        <div class="rt-body"><MarkdownText :content="r.content" /></div>
        <div class="rt-ops">
          <el-button size="small" text type="danger" @click="removeAt(i)">删除这一版</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownText from './MarkdownText.vue'
import { api } from '../api'
import { nextId } from '../book'
import { recordAction } from '../statsStore'

const ANGLES = [
  { key: 'basic', label: '更基础地讲' },
  { key: 'another', label: '换个方法' },
  { key: 'visual', label: '直观图像化' },
  { key: 'exam', label: '考点视角' },
]

const props = defineProps({
  question: { type: String, default: '' },
  result: { type: Object, default: () => ({}) },
  reteach: { type: Array, default: () => [] },
})
const emit = defineEmits(['update'])

const inflight = ref(null) // { angle, text, phase: thinking|streaming|error, errMsg }
const sending = ref(false)
const openIds = ref([])
let ctrl = null
let unmounted = false

function labelOf(key) {
  const a = ANGLES.find((x) => x.key === key)
  return a ? a.label : '换个讲法'
}

function fmtTime(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function start(a) {
  if (sending.value) return
  inflight.value = { angle: a.key, text: '', phase: 'thinking', errMsg: '' }
  run()
}

async function run() {
  const f = inflight.value
  if (!f) return
  sending.value = true
  ctrl = new AbortController()
  try {
    await api.reteach(
      { question: props.question, result: props.result, angle: f.angle },
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
    if (!f.text) ElMessage.error('换个讲法失败：' + msg)
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

function finish() {
  const f = inflight.value
  if (!f) return
  const content = (f.text || '').trim()
  inflight.value = null
  if (!content) return
  const entry = {
    id: nextId(),
    angle: f.angle,
    angleLabel: labelOf(f.angle),
    content,
    createdAt: new Date().toISOString(),
  }
  emit('update', [...props.reteach, entry])
  openIds.value = [...openIds.value, String(entry.id)]
  recordAction('reteach')             // 打卡埋点：换个讲法
}

function removeAt(i) {
  emit('update', props.reteach.filter((_, idx) => idx !== i))
}

// 切换题目时丢弃进行中的生成（组件未被 key 重建时的兜底）
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
.rt-angles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rt-btn {
  border: 1px solid #d3dbec;
  background: #f6f8fc;
  color: #35507a;
  border-radius: 999px;
  padding: 4px 13px;
  font-size: 12.5px;
  cursor: pointer;
}
.rt-btn:hover:not(:disabled) { border-color: #8b9cc0; background: #eef2f9; }
.rt-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.rt-card {
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 10px;
  background: #fdfdfe;
}
.rt-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.rt-tag {
  font-size: 11.5px;
  color: #35507a;
  border: 1px solid #d3dbec;
  background: #f2f5fa;
  border-radius: 999px;
  padding: 0 8px;
  line-height: 19px;
}
.rt-body { padding-left: 10px; border-left: 2px solid #e9edf5; }
.rt-stream {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2733;
}
.rt-thinking { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.rt-err {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #b54444;
}

.rt-list { margin-top: 10px; }
.rt-ops { margin-top: 10px; display: flex; justify-content: flex-end; }

@media (max-width: 768px) {
  .rt-angles .muted { width: 100%; }
}
</style>
