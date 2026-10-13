<template>
  <Transition name="daily-panel">
    <section v-if="open" class="daily">
      <div class="daily__head">
        <div>
          <h2 class="daily__title">今日学习建议</h2>
          <p class="daily__cap">结合课程表、薄弱点与学习进度，AI 生成 · 24 小时内复用</p>
        </div>
        <button type="button" class="daily__btn" :disabled="loading || !canGen" @click="gen">
          {{ loading ? '生成中…' : advice ? '重新生成' : '生成今日建议' }}
        </button>
      </div>

      <div class="daily__chips">
        <div class="daily__chip is-blue">
          <b>{{ lessons.length ? `今天 ${lessons.length} 节课` : '今天没有课' }}</b>
          <i>{{ lessons.length ? lessons.map((l) => l.name).join(' · ') : '可以自由安排' }}</i>
        </div>
        <div class="daily__chip is-amber">
          <b>{{ due }} 道错题到期</b>
          <i>{{ due ? `预计 ${Math.max(1, Math.round(due * 2.5))} 分钟` : '暂无到期复习' }}</i>
        </div>
        <div class="daily__chip is-purple">
          <b>薄弱点 top{{ weakTop.length || 0 }}</b>
          <i>{{ weakTop.length ? weakTop.map((w) => w.name).join(' · ') : '还没有薄弱点数据' }}</i>
        </div>
      </div>

      <div v-if="err" class="daily__err">{{ err }}</div>
      <p v-else-if="!advice && !loading && canGen" class="daily__hint">
        会把今天的课表时段、到期复习数、薄弱知识点名发给 AI（不传题目全文），生成一次约几秒。
      </p>

      <div v-if="advice" class="daily__items">
        <div v-for="(it, i) in advice.items" :key="i" class="daily__item">
          <b>{{ i + 1 }}. {{ it.title }}</b>
          <i>理由：<MathText :content="it.reason" /></i>
        </div>
        <p v-if="advice.summary" class="daily__sum"><MathText :content="advice.summary" /></p>
        <p class="daily__meta">
          {{ advice.cached ? '来自缓存' : '本次新生成' }}<template v-if="generatedAt"> · {{ timeAgo(generatedAt) }}</template>
        </p>
      </div>

      <div v-if="!hasTable" class="daily__guide">
        <div>
          <b>还没有填写课程表，建议内容会不完整</b>
          <p>花 2 分钟填上课表，AI 就能结合你的课程安排给出建议</p>
        </div>
        <button type="button" class="daily__guide-btn" @click="$router.push(ROUTES.timetable)">去完善课表</button>
      </div>
    </section>
  </Transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ROUTES } from '../lib/routes.js'
import { api } from '../api'
import { MOCK } from '../config/app.js'
import { todayLessons, hasTimetable } from '../lib/reportStats.js'
import { analyzeWeakPoints } from '../book.js'
import { coursesRef, timetableRef } from '../stores/courseStore'
import { bookRef } from '../stores/bookStore'
import MathText from '../components/MathText.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 到期复习数（父组件已算好，避免重复计算） */
  due: { type: Number, default: 0 },
  /** AI 课堂下一章（父组件传入或 null） */
  nextChapter: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const advice = ref(null)
const loading = ref(false)
const err = ref('')
const generatedAt = ref(0)
const nextFetched = ref(null)

const courseState = computed(() => ({
  courses: coursesRef().value,
  timetable: timetableRef().value,
}))
const lessons = computed(() => todayLessons(courseState.value))
const hasTable = computed(() => hasTimetable(courseState.value))
const weakTop = computed(() => {
  const weak = analyzeWeakPoints(bookList.value) || []
  return weak.slice(0, 3).map((w) => ({ name: w.name, errorRate: Math.round((w.errorRate || 0) * 100) + '%' }))
})

const bookList = bookRef()

const canGen = computed(() => lessons.value.length > 0 || props.due > 0 || weakTop.value.length > 0 || !!nextFetched.value)

function payloadSummary() {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return {
    date,
    lessons: lessons.value.slice(0, 8),
    due: props.due,
    weak_points: weakTop.value,
    next_chapter: nextFetched.value
      ? { subject: nextFetched.value.subject, current: nextFetched.value.current, name: nextFetched.value.nextName }
      : null,
  }
}

async function gen() {
  if (loading.value) return
  loading.value = true
  err.value = ''
  try {
    if (MOCK.analysis) {
      // 离线演示：与后端 MOCK 内容一致的占位
      await new Promise((r) => setTimeout(r, 400))
      advice.value = {
        items: [
          { title: lessons.value[0] ? `${lessons.value[0].start} 有${lessons.value[0].name}课，课前过一遍讲义` : '先清掉到期的错题，从错误率最高的开始', reason: '错误率最高的知识点，记忆快过期了，先复习性价比最高' },
          { title: nextFetched.value ? `空闲时段开 AI 课堂学「${nextFetched.value.nextName || nextFetched.value.current}」，预计 25 分钟` : '拍一道新题，积累今天的记录', reason: '今天剩余空闲时段较长，适合推进新内容' },
        ],
        summary: '演示数据（未配置模型 Key 时显示）。',
        cached: false,
      }
    } else {
      const r = await api.analyzeDaily({ summary: payloadSummary() })
      advice.value = { ...(r.data || {}), cached: !!r.cached }
    }
    generatedAt.value = Date.now()
  } catch (e) {
    err.value = '生成失败：' + (e.message || '请稍后重试')
  } finally {
    loading.value = false
  }
}

function timeAgo(ts) {
  const d = Date.now() - Number(ts || 0)
  if (d < 60000) return '刚刚'
  if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`
  return `${Math.floor(d / 3600000)} 小时前`
}

// 面板打开时同步一次父组件给的下一章信息（父组件负责拉 syllabi）
watch(
  () => [props.open, props.nextChapter],
  ([o, n]) => {
    if (o && n) nextFetched.value = n
  },
  { immediate: true },
)
</script>

<style scoped>
.daily {
  margin-top: var(--sp-4);
  padding: var(--sp-5);
  border: 1px solid var(--primary-line, #c8d8ea);
  border-radius: var(--radius-lg);
  background: var(--surface, #fff);
}
.daily__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}
.daily__title {
  font-size: var(--fs-h2, 17px);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.daily__cap {
  margin-top: 2px;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.daily__btn {
  flex: none;
  border: 0;
  border-radius: var(--radius-sm);
  background: #0f6e56;
  color: #fff;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  padding: 9px 18px;
  cursor: pointer;
  white-space: nowrap;
}
.daily__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.daily__btn:not(:disabled):hover {
  background: #0c5c48;
}
.daily__chips {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}
.daily__chip {
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.daily__chip b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.daily__chip i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily__chip.is-blue { background: #e6f1fb; }
.daily__chip.is-blue b { color: #0c447c; }
.daily__chip.is-amber { background: #faeeda; }
.daily__chip.is-amber b { color: #854f0b; }
.daily__chip.is-purple { background: #eeedfe; }
.daily__chip.is-purple b { color: #3c3489; }
html[data-theme='dark'] .daily__chip.is-blue { background: rgba(24, 95, 165, 0.22); }
html[data-theme='dark'] .daily__chip.is-amber { background: rgba(133, 79, 11, 0.22); }
html[data-theme='dark'] .daily__chip.is-purple { background: rgba(83, 74, 183, 0.22); }

.daily__hint {
  margin-top: var(--sp-3);
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.daily__err {
  margin-top: var(--sp-3);
  font-size: var(--fs-body-2);
  color: var(--danger, #a32d2d);
}
.daily__items {
  margin-top: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.daily__item {
  border-radius: var(--radius-md);
  background: #e1f5ee;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
html[data-theme='dark'] .daily__item { background: rgba(15, 110, 86, 0.2); }
.daily__item b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: #085041;
  line-height: 1.5;
}
html[data-theme='dark'] .daily__item b { color: #9fe1cb; }
.daily__item i {
  font-style: normal;
  font-size: var(--fs-label);
  color: #0f6e56;
}
html[data-theme='dark'] .daily__item i { color: #5dcaa5; }
.daily__sum {
  margin-top: var(--sp-2);
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.daily__meta {
  margin-top: 2px;
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.daily__guide {
  margin-top: var(--sp-4);
  border-radius: var(--radius-md);
  background: #faece7;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
html[data-theme='dark'] .daily__guide { background: rgba(153, 60, 29, 0.22); }
.daily__guide b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: #993c1d;
}
html[data-theme='dark'] .daily__guide b { color: #f5c4b3; }
.daily__guide p {
  margin-top: 3px;
  font-size: var(--fs-label);
  color: #712b13;
}
html[data-theme='dark'] .daily__guide p { color: #d9a08c; }
.daily__guide-btn {
  flex: none;
  border: 0;
  border-radius: var(--radius-sm);
  background: #993c1d;
  color: #fff;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  padding: 9px 16px;
  cursor: pointer;
  white-space: nowrap;
}
.daily__guide-btn:hover {
  background: #712b13;
}
.daily-panel-enter-active, .daily-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.daily-panel-enter-from, .daily-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (max-width: 720px) {
  .daily__chips {
    grid-template-columns: 1fr;
  }
  .daily__head {
    flex-direction: column;
  }
  .daily__btn {
    width: 100%;
  }
  .daily__guide {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
