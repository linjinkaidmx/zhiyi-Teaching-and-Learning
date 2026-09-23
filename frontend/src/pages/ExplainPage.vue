<template>
  <div class="zy-container zy-page explain">
    <!-- 加载 / 找不到 -->
    <UiEmptyState
      v-if="notFound"
      title="没找到这道题"
      description="讲解结果在刷新后会回到错题本，或重新拍题识别。"
    >
      <template #action>
        <UiButton variant="primary" @click="$router.push(ROUTES.capture)">去拍题</UiButton>
      </template>
    </UiEmptyState>

    <template v-else>
      <!-- 顶部操作栏 -->
      <div class="explain__topbar">
        <UiButton variant="ghost" size="sm" @click="goBack">
          <UiIcon name="arrowRight" :size="16" style="transform: rotate(180deg)" /> 返回
        </UiButton>
        <div class="explain__topbar-right">
          <div class="explain__depth" role="radiogroup" aria-label="讲解深度">
            <button
              v-for="d in DEPTHS"
              :key="d.key"
              type="button"
              class="explain__depth-btn"
              :class="{ 'is-active': currentDepth === d.key }"
              @click="pickDepth(d.key)"
            >
              {{ d.label }}
            </button>
          </div>
          <span v-if="depthDirty" class="explain__depth-hint">已切换深度，需重新生成生效</span>
          <UiButton v-if="item.status !== 'loading'" variant="ghost" size="sm" @click="regenerate">
            <UiIcon name="refresh" :size="16" /> 重新生成
          </UiButton>
        </div>
      </div>

      <!-- 文档型讲解：桌面左原题 / 右讲解 -->
      <div class="explain__layout">
        <aside class="explain__aside surface-standard">
          <button class="explain__aside-head" type="button" @click="questionOpen = !questionOpen">
            <span class="t-h3">原题</span>
            <span class="explain__chevron" :class="{ 'is-open': questionOpen }">▾</span>
          </button>
          <div v-show="questionOpen" class="explain__q">
            <MathText :content="item.text" />
            <div v-if="item.attempt" class="explain__attempt t-label">你的作答：{{ item.attempt }}</div>
          </div>
        </aside>

        <main class="explain__main">
          <!-- 讲解加载中：顶部 AI 状态 + 骨架 -->
          <div v-if="item.status === 'loading'" class="explain__loading surface-standard">
            <div class="explain__ai">
              <UiAiLogo state="working" size="md" />
              <span class="t-body-2">{{ streamRows.length ? 'AI 正在讲解（逐段生成中）…' : 'AI 正在生成讲解…' }}</span>
            </div>
            <!-- 批次3：服务端增量字段 → 边生成边显示（比骨架屏更有信息量） -->
            <div v-if="streamRows.length" class="explain__stream">
              <div v-for="row in streamRows" :key="row.path" class="explain__stream-row">
                <div class="t-label explain__stream-label">{{ row.label }}</div>
                <p class="t-body explain__stream-text">
                  {{ row.text }}<span v-if="row.active" class="ai-caret" />
                </p>
              </div>
            </div>
            <UiSkeleton v-else variant="card" />
          </div>

          <UiErrorState
            v-else-if="item.status === 'error'"
            title="讲解生成失败"
            :description="item.error"
            retry-text="重新生成"
            @retry="regenerate"
          />

          <div v-else-if="item.result" class="explain__doc">
            <div class="explain__meta">
              <UiTag v-if="item.result.source === 'bank'" variant="success">题库秒答</UiTag>
              <UiTag v-if="item.result.subject" variant="info">{{ item.result.subject }}</UiTag>
              <UiTag v-if="item.result.question_type" variant="neutral">{{ item.result.question_type }}</UiTag>
            </div>

            <!-- 折叠控制 -->
            <div class="explain__fold-ops">
              <UiButton variant="text" size="sm" @click="expandAll = !expandAll">
                {{ expandAll ? '收起全部' : '展开全部' }}
              </UiButton>
            </div>

            <section v-for="sec in visibleSections" :key="sec.key" class="explain__section">
              <button class="explain__section-head" type="button" @click="toggle(sec)">
                <span class="t-h3">{{ sec.title }}</span>
                <span class="explain__chevron" :class="{ 'is-open': sec.open }">▾</span>
              </button>
              <div v-show="sec.open" class="explain__section-body">
                <!-- 解题步骤：逐条渲染 -->
                <template v-if="sec.key === 'steps'">
                  <div v-for="(s, i) in sec.content" :key="i" class="explain__step">
                    <div class="explain__step-title">{{ i + 1 }}. <MathText :content="s.title" /></div>
                    <MathText :content="s.detail" />
                  </div>
                </template>
                <!-- 举一反三：逐条渲染 -->
                <template v-else-if="sec.key === 'extensions'">
                  <div v-for="(e, i) in sec.content" :key="i" class="explain__ext">
                    <span class="explain__ext-no">{{ i + 1 }}</span>
                    <MathText :content="e" />
                  </div>
                </template>
                <MathText v-else :content="sec.content" />
              </div>
            </section>
          </div>
        </main>
      </div>

      <!-- 底部操作区（固定，不遮挡正文） -->
      <div class="explain__footer">
        <div class="explain__footer-bar">
          <UiButton
            :variant="saved ? 'ghost' : 'primary'"
            size="sm"
            :disabled="saved"
            @click="save"
          >
            {{ saved ? '已保存到错题本' : '保存到错题本' }}
          </UiButton>
          <UiButton variant="ghost" size="sm" @click="genVariants('similar')">生成相似题</UiButton>
          <UiButton variant="ghost" size="sm" @click="genVariants('variant')">生成变式题</UiButton>
          <UiButton v-if="item.result" variant="ghost" size="sm" @click="shareOpen = true">分享</UiButton>
        </div>

        <!-- 追问（真实流式） -->
        <div class="explain__follow">
          <div v-if="variants.length" class="explain__variants">
            <div v-for="v in variants" :key="v.id" class="explain__variant surface-standard">
              <span class="t-label">{{ v.kind === 'similar' ? '相似题' : '变式题' }}</span>
              <MathText :content="v.text" />
            </div>
          </div>

          <div v-for="m in followups" :key="m.id" class="explain__msg">
            <div class="explain__msg-q">{{ m.q }}</div>
            <div class="explain__msg-a">
              <MarkdownText v-if="!m.streaming" :content="m.a" />
              <span v-else class="explain__msg-stream">{{ m.a }}<span class="ai-caret" /></span>
            </div>
          </div>

          <div class="explain__input">
            <input
              v-model="draft"
              class="explain__input-field"
              type="text"
              placeholder="对这道题继续追问…"
              @keydown.enter.prevent="ask"
            />
            <UiButton v-if="!asking" variant="primary" size="sm" :disabled="!draft.trim()" @click="ask">追问</UiButton>
            <UiButton v-else variant="ghost" size="sm" @click="stop">停止</UiButton>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- 保存归类弹窗：把这道题归到某门课程（AI 已预选） -->
  <UiModal v-model="pickerOpen" title="归类到课程" size="sm">
    <p class="t-body-2">选一门课，方便在错题本按课程筛选。不选就归到「未归类」。</p>
    <div class="explain__courses">
      <button
        type="button"
        class="explain__course"
        :class="{ 'is-on': pickCourseId === '' }"
        @click="pickCourseId = ''"
      >
        <span>未归类</span>
      </button>
      <button
        v-for="c in coursesRef().value"
        :key="c.id"
        type="button"
        class="explain__course"
        :class="{ 'is-on': pickCourseId === c.id }"
        @click="pickCourseId = c.id"
      >
        <span class="explain__course-dot" :style="{ background: c.color || 'var(--primary)' }" />
        <span>{{ c.name }}</span>
      </button>
    </div>
    <template #footer>
      <UiButton variant="primary" block @click="confirmSave">保存到错题本</UiButton>
    </template>
  </UiModal>

  <!-- 分享到社区 -->
  <ShareDialog v-model="shareOpen" :card="shareCard" />
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiModal from '../ui/UiModal.vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import UiSkeleton from '../ui/UiSkeleton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiErrorState from '../ui/UiErrorState.vue'
import MathText from '../components/MathText.vue'
import MarkdownText from '../components/MarkdownText.vue'
import { ROUTES } from '../lib/routes.js'
import { api } from '../api'
import { flowRef, retryItem, reExplainText } from '../stores/flowStore'
import { addStudyMinutes } from '../stores/recordsStore'
import { recordAction } from '../stores/statsStore'
import { getItems, saveResult } from '../stores/bookStore'
import { coursesRef } from '../stores/courseStore'
import { matchCourse } from '../lib/courseMatch.js'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { makeVariants } from '../lib/adapter/variant.js'
import ShareDialog from '../components/ShareDialog.vue'

const route = useRoute()
const router = useRouter()
const questions = flowRef()

/** 题库秒答命中：同一道题只记一次（成就「秒答猎手」） */
const bankTracked = new Set()
watch(
  () => questions.value.map((q) => `${q.id}:${(q.result && q.result.source) || ''}`).join(','),
  () => {
    for (const q of questions.value) {
      if (q.result && q.result.source === 'bank' && !bankTracked.has(q.id)) {
        bankTracked.add(q.id)
        try {
          recordAction('bank', { title: String(q.text || '').slice(0, 40), brief: '题库秒答命中' })
        } catch {
          /* 埋点失败不影响讲解 */
        }
      }
    }
  },
  { immediate: true }
)

const id = computed(() => route.params.id)
const notFound = ref(false)

/** 找当前题：按 id 找；刷新后 flowStore 为空时，从错题本找回并重新讲解（此时只有 1 题，取第 0 题） */
const item = computed(() => {
  const byId = questions.value.find((q) => String(q.id) === String(id.value))
  if (byId) return byId
  if (questions.value.length === 1) return questions.value[0]
  return null
})

if (!item.value) {
  const hit = getItems().find((i) => String(i.id) === String(id.value))
  if (hit) {
    reExplainText(hit.question, hit.attempt || '')
  } else {
    notFound.value = true
  }
}

// 批次3：深度现在真传给后端（key 与后端 brief/standard/deep 一致）
const DEPTHS = [
  { key: 'brief', label: '基础' },
  { key: 'standard', label: '标准' },
  { key: 'deep', label: '深入' },
]
const currentDepth = computed(() => (item.value && item.value.depth) || 'standard')
/** 切了深度但还没重新生成 → 明确提示，避免"点了没反应" */
const depthDirty = computed(() => {
  const it = item.value
  return !!it && !!it.result && currentDepth.value !== (it.resultDepth || 'standard')
})
function pickDepth(k) {
  if (item.value) item.value.depth = k
}
const questionOpen = ref(true)
const expandAll = ref(false)
const collapsed = reactive(new Set())
const saved = ref(false)

const followups = ref([])
const draft = ref('')
const asking = ref(false)
const variants = ref([])
let followCtrl = null

/* 讲解结构（思路/步骤/答案展开，其余折叠；深度控制层级） */
const SECTIONS = [
  { key: 'answer', title: '最终答案', depth: 'basic', defaultOpen: true },
  { key: 'steps', title: '解题步骤', depth: 'basic', defaultOpen: true },
  { key: 'breakthrough', title: '关键突破口', depth: 'standard', defaultOpen: true },
  { key: 'knowledge', title: '知识点回顾', depth: 'standard', defaultOpen: false },
  { key: 'diagnosis', title: '易错点', depth: 'deep', defaultOpen: false },
  { key: 'extensions', title: '举一反三', depth: 'deep', defaultOpen: false },
]

/** 流式行：把服务端下发的字段按到达顺序铺出来（流式阶段只显示纯文本，完成后切结构化渲染） */
const FIELD_LABELS = {
  answer: '答案',
  key_breakthrough: '关键突破口',
  knowledge_review: '知识点讲解',
  diagnosis: '错因诊断',
}
function fieldLabel(path) {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path]
  let m = path.match(/^steps\[(\d+)\]\.(title|detail)$/)
  if (m) return `步骤 ${Number(m[1]) + 1} · ${m[2] === 'title' ? '小标题' : '推导'}`
  m = path.match(/^knowledge_points\[(\d+)\]$/)
  if (m) return `知识点 ${Number(m[1]) + 1}`
  m = path.match(/^extensions\[(\d+)\]$/)
  if (m) return `举一反三 ${Number(m[1]) + 1}`
  return path
}
const streamRows = computed(() => {
  const st = item.value && item.value.stream
  if (!st || !st.order || !st.order.length) return []
  return st.order.map((path) => ({
    path,
    label: fieldLabel(path),
    text: (st.fields[path] || '').trim(),
    active: st.active === path,
  })).filter((r) => r.text)
})

const sectionContent = computed(() => {
  const r = item.value && item.value.result
  if (!r) return {}
  return {
    answer: r.answer || '',
    steps: r.steps || [],
    breakthrough: r.key_breakthrough || '',
    knowledge: [r.knowledge_review, r.knowledge_points && r.knowledge_points.length ? `知识点：${r.knowledge_points.join('、')}` : ''].filter(Boolean).join('\n\n'),
    diagnosis: r.diagnosis || '',
    extensions: r.extensions || [],
  }
})

const DEPTH_ORDER = { brief: 0, standard: 1, deep: 2 }
const visibleSections = computed(() => {
  const c = sectionContent.value
  return SECTIONS.filter((s) => {
    if (!c[s.key]) return false
    if (DEPTH_ORDER[s.depth] > DEPTH_ORDER[currentDepth.value]) return false
    return true
  }).map((s) => ({
    ...s,
    content: c[s.key],
    open: expandAll.value ? true : collapsed.has(s.key) ? false : s.defaultOpen,
  }))
})

function toggle(sec) {
  if (collapsed.has(sec.key)) collapsed.delete(sec.key)
  else collapsed.add(sec.key)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push(ROUTES.capture)
}

function regenerate() {
  retryItem(item.value)
}

function save() {
  // 归类弹窗：预选 AI 匹配到的课程，用户可改或选「未归类」
  const subject = (item.value && item.value.result && item.value.result.subject) || ''
  const matched = matchCourse(subject, coursesRef().value)
  pickCourseId.value = matched ? matched.id : ''
  pickerOpen.value = true
}

/* ---------------- 保存归类弹窗 ---------------- */
const pickerOpen = ref(false)
const pickCourseId = ref('')

function confirmSave() {
  saveResult(item.value, pickCourseId.value)
  pickerOpen.value = false
  saved.value = true
  toast.success('已存入错题本')
}

/* ---------------- 分享到社区（论坛 / 学习小组） ---------------- */
const shareOpen = ref(false)
const shareCard = computed(() => {
  const r = (item.value && item.value.result) || {}
  return {
    question: (item.value && item.value.text) || '',
    answer: r.answer || '',
    steps: r.steps || [],
    knowledgePoints: r.knowledge_points || [],
    subject: r.subject || '',
  }
})

/* 追问（真实 SSE 流式） */
function ask() {
  const q = draft.value.trim()
  if (!q || asking.value) return
  const msg = { id: Date.now(), q, a: '', streaming: true }
  followups.value.push(msg)
  draft.value = ''
  asking.value = true
  followCtrl = new AbortController()
  api
    .followUp(
      {
        question: item.value.text,
        result: item.value.result || {},
        history: followups.value.filter((m) => !m.streaming).slice(-6).map((m) => `${m.q}\n${m.a}`),
        followup: q,
        mode: 'deep',
      },
      {
        signal: followCtrl.signal,
        onDelta: (d) => {
          msg.a += d
        },
      },
    )
    .then(() => {
      msg.streaming = false
      // 追问埋点（打卡/成就）+ 学习记录
      recordAction('followup', { title: q, brief: '追问' })
      // 追问记录随题保存（存入错题本时一并带走）
      if (!item.value.followups) item.value.followups = []
      item.value.followups.push({ q, a: msg.a })
    })
    .catch((e) => {
      msg.streaming = false
      if (e && e.name === 'AbortError') {
        if (!msg.a) msg.a = '（已停止）'
      } else {
        if (!msg.a) msg.a = '（追问失败：' + (e && e.message ? e.message : '网络异常') + '）'
      }
    })
    .finally(() => {
      asking.value = false
    })
}

function stop() {
  if (followCtrl) followCtrl.abort()
  asking.value = false
}

/* 相似题/变式题：走 lib/adapter/variant.js（真实 /api/variant，命中缓存不重复计费） */
const genLoading = ref(false)
async function genVariants(kind) {
  if (genLoading.value) return
  genLoading.value = true
  try {
    const list = await makeVariants(
      { question: item.value.text, answer: (item.value.result || {}).answer || '', subject: (item.value.result || {}).subject || '' },
      kind,
      2,
    )
    list.forEach((v) => variants.value.push({ id: Date.now() + Math.random(), kind, text: v.question, demo: v.demo }))
    if (list.some((v) => v.demo)) toast.info('已生成（演示数据）')
    else toast.success(list.some((v) => v.cached) ? '已生成（来自缓存）' : '已生成')
  } catch (e) {
    toastError(e, '生成失败')
  } finally {
    genLoading.value = false
  }
}

/* 学习时长（批次4）：讲解出来之后停留的时间算「学习时长」，AI 生成耗时不算 */
let readStart = 0
watch(
  () => item.value && item.value.status,
  (s) => { if (s === 'done' && !readStart) readStart = Date.now() },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (followCtrl) followCtrl.abort()
  if (readStart && item.value) {
    const minutes = (Date.now() - readStart) / 60000
    // 只有真在这道题上停留过才计入（<9 秒或 >120 分钟由纯函数过滤/封顶）
    addStudyMinutes('explain', minutes)
  }
})
</script>

<style scoped>
.explain {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-wide);
}
.explain__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.explain__topbar-right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.explain__depth {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  gap: 2px;
}
.explain__depth-hint {
  margin-left: var(--sp-2);
  font-size: var(--fs-label);
  color: var(--warning);
}
.explain__stream {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}
.explain__stream-row {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  border-left: 2px solid var(--primary-line);
}
.explain__stream-label {
  margin-bottom: var(--sp-1);
  color: var(--primary-text);
}
.explain__stream-text {
  margin: 0;
  color: var(--text-secondary);
  white-space: pre-wrap;
}
.explain__depth-btn {
  padding: 5px 14px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-tertiary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.explain__depth-btn.is-active {
  background: var(--primary);
  color: var(--text-on-primary);
}

.explain__layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: start;
}
.explain__aside {
  padding: var(--sp-4) var(--sp-5);
}
.explain__aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: 0;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0;
}
.explain__q {
  margin-top: var(--sp-3);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.explain__attempt {
  margin-top: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--text-muted);
}
.explain__chevron {
  color: var(--text-muted);
  transition: transform var(--dur) var(--ease);
}
.explain__chevron.is-open {
  transform: rotate(180deg);
}

.explain__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}
.explain__loading {
  padding: var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.explain__ai {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.explain__doc {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.explain__meta {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.explain__fold-ops {
  display: flex;
  justify-content: flex-end;
}
.explain__section {
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--grad-surface);
  box-shadow: var(--highlight-1), var(--shadow-subtle);
  overflow: hidden;
}
.explain__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--sp-3) var(--sp-5);
  background: none;
  border: 0;
  color: var(--text-primary);
  cursor: pointer;
}
.explain__section-body {
  padding: 0 var(--sp-5) var(--sp-4);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.explain__step {
  padding: var(--sp-2) 0;
}
.explain__step + .explain__step {
  border-top: var(--border-divider-soft);
}
.explain__step-title {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  margin-bottom: var(--sp-1);
}
.explain__ext {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
  padding: var(--sp-2) 0;
}
.explain__ext-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface-unit);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-label);
  flex: none;
  margin-top: 2px;
}

.explain__courses {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  max-height: 40vh;
  overflow-y: auto;
}
.explain__course {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-body);
  cursor: pointer;
  text-align: left;
}
.explain__course.is-on {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
  color: var(--primary-text);
}
.explain__course-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.explain__footer {
  position: sticky;
  bottom: 0;
  z-index: var(--z-sticky);
  margin: 0 calc(-1 * var(--sp-4));
  padding: var(--sp-3) var(--sp-4);
  background: color-mix(in srgb, var(--background) 92%, transparent);
  backdrop-filter: saturate(140%) blur(14px);
  border-top: var(--border-divider-soft);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}
.explain__footer-bar {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-3);
}
.explain__variants {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}
.explain__variant {
  padding: var(--sp-3) var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.explain__msg {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin-bottom: var(--sp-3);
}
.explain__msg-q {
  align-self: flex-end;
  max-width: 80%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--text-on-primary);
  font-size: var(--fs-body);
}
.explain__msg-a {
  max-width: 92%;
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.explain__msg-stream {
  white-space: pre-wrap;
}
.explain__input {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}
.explain__input-field {
  flex: 1;
  min-width: 0;
  padding: 10px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-default);
  border-top: var(--border-top-default);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
}
.explain__input-field:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}

@media (max-width: 900px) {
  .explain__layout {
    grid-template-columns: 1fr;
  }
  .explain__footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
  .explain {
    padding-bottom: 180px;
  }
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .explain {
    max-width: none;
  }
}
</style>
