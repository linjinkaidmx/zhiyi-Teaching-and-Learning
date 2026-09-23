<template>
  <div class="zy-page">
    <div class="zy-container trun">
      <header class="trun__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBack">← 返回班级</UiButton>
        <h1 class="t-h1">{{ title || '班级测试' }}</h1>
        <p v-if="loaded" class="t-label">{{ questions.length }} 题 · 满分 {{ totalScore }} 分 · 限时 {{ Math.round(durationSec / 60) }} 分钟</p>
      </header>

      <UiErrorState v-if="loadError" :description="loadError" @retry="load" />

      <!-- 已提交：结果 + 排名 -->
      <template v-else-if="submitted">
        <section class="trun__card surface-standard">
          <h2 class="t-h3">我的成绩</h2>
          <div class="trun__result">
            <span class="trun__score">{{ result.score }}<i>/{{ totalScore }}</i></span>
            <span class="t-body-2">
              对 {{ resultCorrect }} 题 · 用时 {{ result.duration_sec }} 秒
              <template v-if="resultRank"> · 第 {{ resultRank }} 名</template>
            </span>
          </div>
        </section>

        <!-- 答错的题 → 勾选沉淀进个人错题本（班级教学 → 个人复习闭环） -->
        <section v-if="wrongList.length && !savedWrong" class="trun__card surface-standard">
          <div class="trun__wrong-head">
            <h2 class="t-h3">答错的 {{ wrongList.length }} 道题</h2>
            <button type="button" class="trun__wrong-all" @click="toggleAllWrong">
              {{ allWrongPicked ? '取消全选' : '全选' }}
            </button>
          </div>
          <p class="t-body-2 trun__wrong-tip">
            勾选后加入错题本，之后按遗忘曲线复习；点开错题可以让 AI 再讲一遍。
          </p>
          <div class="trun__wrong-list">
            <label v-for="it in wrongList" :key="it.index" class="trun__wrong-row">
              <input
                type="checkbox"
                class="trun__wrong-cb"
                :checked="wrongPicked.has(it.index)"
                @change="toggleWrong(it.index)"
              />
              <span class="trun__wrong-body">
                <b>{{ it.title }}</b>
                <i>
                  我的答案：{{ it.given || '未作答' }}
                  <em>正确答案：{{ it.answer }}</em>
                </i>
              </span>
            </label>
          </div>
          <UiButton variant="primary" block :disabled="!wrongPicked.size" @click="saveWrongToBook">
            加入错题本（{{ wrongPicked.size }} 道）
          </UiButton>
        </section>

        <section v-else-if="savedWrong" class="trun__card surface-standard">
          <h2 class="t-h3">已加入错题本</h2>
          <p class="t-body-2 trun__wrong-tip">{{ savedCount }} 道错题已沉淀到你的错题本，可以按遗忘曲线复习。</p>
          <UiButton variant="secondary" block @click="goWrongBook">去错题本复习 →</UiButton>
        </section>

        <TestRank :rank-data="rankData" />
      </template>

      <!-- 未开始：说明页 -->
      <template v-else-if="!started">
        <section class="trun__card surface-standard trun__intro">
          <p class="t-body-2">
            共 {{ questions.length }} 题，限时 {{ Math.round(durationSec / 60) }} 分钟。
            点「开始答题」后立即计时，倒计时结束会自动交卷（已作答内容会计分）。
            每人只有一次作答机会，请确认有足够时间再开始。
          </p>
          <UiButton variant="primary" block :loading="starting" @click="begin">开始答题</UiButton>
        </section>
      </template>

      <!-- 答题中 -->
      <template v-else>
        <div class="trun__layout">
        <div class="trun__col">
        <section class="trun__card surface-standard trun__timer-bar">
          <span class="trun__timer" :class="{ 'is-low': remainingSec <= 60 }">
            {{ fmtClock(remainingSec) }}
          </span>
          <span class="t-label">已答 {{ answeredCount }}/{{ questions.length }}</span>
        </section>

        <section
          v-for="(q, qi) in questions"
          :id="'trun-q-' + qi"
          :key="q.index"
          class="trun__card surface-standard"
        >
          <p class="trun__q-no">{{ qi + 1 }}. {{ q.type === 'choice' ? '选择题' : '填空题' }}（{{ q.score }} 分）</p>
          <p class="trun__q"><MathText :content="q.question" /></p>
          <div v-if="q.type === 'choice'" class="trun__opts">
            <button
              v-for="(o, oi) in q.options"
              :key="oi"
              type="button"
              class="trun__opt"
              :class="{ 'is-on': answers[q.index] === letter(oi) }"
              @click="answers[q.index] = letter(oi)"
            >
              <span class="trun__opt-letter">{{ letter(oi) }}</span>
              <span class="trun__opt-text">{{ o }}</span>
            </button>
          </div>
          <input
            v-else
            v-model="answers[q.index]"
            class="trun__blank"
            type="text"
            :placeholder="'填空答案' + (q.question.includes('____') ? '（对应 ____ 处）' : '')"
          />
        </section>

        <section class="trun__card surface-standard trun__submit">
          <p class="t-body-2" :class="{ 'trun__warn': unansweredCount > 0 }">
            {{ unansweredCount > 0 ? `还有 ${unansweredCount} 题未作答，提交后不能修改。` : '全部作答完成，检查后提交。' }}
          </p>
          <UiButton variant="primary" block :loading="submitting" @click="submit">
            一键提交
          </UiButton>
        </section>
        </div>

        <!-- 桌面端右栏：答题卡（移动端隐藏，保持单列原样） -->
        <aside class="trun__sheet">
          <div class="trun__sheet-card surface-standard">
            <div class="trun__sheet-head">
              <span class="t-h3">答题卡</span>
              <span class="t-label">已答 {{ answeredCount }}/{{ questions.length }}</span>
            </div>
            <div class="trun__grid">
              <button
                v-for="(q, qi) in questions"
                :key="q.index"
                type="button"
                class="trun__cell"
                :class="{ 'is-done': isAnswered(q) }"
                @click="scrollToQ(qi)"
              >
                {{ qi + 1 }}
              </button>
            </div>
            <div class="trun__legend">
              <span><i class="is-done" />已答 {{ answeredCount }}</span>
              <span><i />未答 {{ unansweredCount }}</span>
            </div>
          </div>

          <div class="trun__sheet-card surface-standard trun__sheet-side">
            <span class="trun__timer" :class="{ 'is-low': remainingSec <= 60 }">{{ fmtClock(remainingSec) }}</span>
            <span class="t-label">距自动交卷</span>
            <UiButton variant="primary" block :loading="submitting" @click="submit">一键提交</UiButton>
            <span class="t-label">每人仅一次机会 · 提交后不可修改</span>
          </div>
        </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { recordAction } from '../statsStore'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiErrorState from '../ui/UiErrorState.vue'
import MathText from '../components/MathText.vue'
import TestRank from '../components/TestRank.vue'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { ROUTES, path } from '../lib/routes.js'
import { api } from '../api.js'
import { getToken } from '../auth.js'
import { upsert, bookRef } from '../stores/bookStore.js'
import { makeItem } from '../book.js'

const route = useRoute()
const router = useRouter()
const testId = computed(() => String(route.params.tid || ''))

const title = ref('')
const totalScore = ref(0)
const durationSec = ref(600)
const questions = ref([])
const loaded = ref(false)
const loadError = ref('')
const started = ref(false)
const starting = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const answers = reactive({})
const result = ref({ score: 0, duration_sec: 0 })
const resultCorrect = ref(0)
const resultRank = ref(0)
/** 逐题明细（后端返回）→ 用于「答错的题」勾选沉淀进个人错题本 */
const resultItems = ref([])
const wrongPicked = ref(new Set())
const savedWrong = ref(false)
const savedCount = ref(0)
const rankData = ref({})
const remainingSec = ref(0)
let timer = null

const answeredCount = computed(() => questions.value.filter((q) => {
  const v = answers[q.index]
  return v !== undefined && String(v).trim() !== ''
}).length)
const unansweredCount = computed(() => questions.value.length - answeredCount.value)

const letter = (oi) => String.fromCharCode(65 + oi)

/** 题干摘要（列表里只做纯文本截断，详情在错题本里按公式渲染） */
function clipText(t, n = 46) {
  const v = String(t || '').replace(/\s+/g, ' ').trim()
  return v.length > n ? v.slice(0, n) + '…' : v
}

/** 答错的题（带本地题干） */
const wrongList = computed(() => {
  const byIndex = {}
  for (const q of questions.value) byIndex[q.index] = q
  return resultItems.value
    .filter((it) => !it.correct)
    .map((it) => ({ ...it, q: byIndex[it.index] || null, title: clipText(byIndex[it.index] && byIndex[it.index].question) }))
})
const allWrongPicked = computed(() => wrongList.value.length > 0 && wrongPicked.value.size >= wrongList.value.length)

function toggleWrong(index) {
  const next = new Set(wrongPicked.value)
  next.has(index) ? next.delete(index) : next.add(index)
  wrongPicked.value = next
}
function toggleAllWrong() {
  wrongPicked.value = allWrongPicked.value ? new Set() : new Set(wrongList.value.map((it) => it.index))
}

/**
 * 把勾选的错题写进个人错题本。
 * 只存「题目 + 我的答案 + 正确答案」，不生成解析（点开错题时再走讲解，成本归零）；
 * 同一道题已在本 → 更新答案并重置掌握进度，不产生重复条目。
 */
function saveWrongToBook() {
  const picked = wrongList.value.filter((it) => wrongPicked.value.has(it.index))
  if (!picked.length) return
  const book = bookRef().value || []
  const norm = (v) => String(v || '').replace(/\s+/g, '').toLowerCase()
  let n = 0
  for (const it of picked) {
    const q = it.q
    if (!q) continue
    const existed = book.find((x) => x && x.kind !== 'note' && norm(x.question) === norm(q.question))
    if (existed) {
      upsert({
        ...existed,
        attempt: String(it.given || ''),
        answer: String(it.answer || ''),
        streak: 0,
        mastered: false,
        reviewAt: 0,
        source: '班级测试',
      })
    } else {
      upsert({
        ...makeItem(
          q.question,
          String(it.given || ''),
          {
            subject: '班级测试',
            question_type: q.type === 'choice' ? '选择题' : '填空题',
            answer: String(it.answer || ''),
            steps: [],
            knowledge_points: [],
          },
          { courseId: '' }
        ),
        source: '班级测试',
      })
    }
    n++
  }
  // 只记一条学习动作（不逐题刷记录）
  try {
    recordAction('save', { title: `班级测试错题 ${n} 道`, brief: '存入错题本' })
  } catch {
    /* 埋点失败不影响入本 */
  }
  savedCount.value = n
  savedWrong.value = true
  toast.success(`已加入错题本 ${n} 道，可按遗忘曲线复习`)
}
function goWrongBook() {
  router.push(ROUTES.wrongbook)
}

/** 桌面答题卡：该题是否已作答 / 点击题号定位到题目 */
function isAnswered(q) {
  const v = answers[q.index]
  return v !== undefined && String(v).trim() !== ''
}
function scrollToQ(qi) {
  const el = document.getElementById('trun-q-' + qi)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function startTimer() {
  stopTimer()
  timer = setInterval(() => {
    if (remainingSec.value <= 0) {
      stopTimer()
      toast.error('时间到，自动交卷')
      submit(true)
      return
    }
    remainingSec.value -= 1
    if (remainingSec.value <= 0) {
      stopTimer()
      toast.error('时间到，自动交卷')
      submit(true)
    }
  }, 1000)
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

function begin() {
  starting.value = true
  doStart()
}

async function doStart(preview = false) {
  try {
    const r = await api.cls.testStart(getToken(), testId.value, preview ? 1 : 0)
    if (!r.ok) {
      toast.error(r.error || '无法开始')
      return
    }
    title.value = r.title
    totalScore.value = r.total_score
    durationSec.value = r.duration_sec
    questions.value = r.questions
    remainingSec.value = r.remaining_sec
    if (r.submitted) {
      submitted.value = true
      result.value = r.result || { score: 0, duration_sec: 0 }
      await loadRank()
      loaded.value = true
      return
    }
    loaded.value = true
    if (preview) return
    started.value = true
    startTimer()
  } catch (e) {
    loadError.value = e.message || '加载失败'
  }
  starting.value = false
}

async function submit(auto = false) {
  if (submitting.value) return
  if (!auto && unansweredCount.value > 0 && !window.confirm(`还有 ${unansweredCount.value} 题未作答，确定提交？`)) return
  submitting.value = true
  try {
    const r = await api.cls.testSubmit(getToken(), testId.value, { ...answers }, durationSec.value - remainingSec.value)
    if (!r.ok) {
      toast.error(r.error || '提交失败')
      submitting.value = false
      return
    }
    submitted.value = true
    started.value = false
    result.value = { score: r.score, duration_sec: r.duration_sec }
    resultItems.value = Array.isArray(r.items) ? r.items : []
    wrongPicked.value = new Set(resultItems.value.filter((it) => !it.correct).map((it) => it.index))
    savedWrong.value = false
    savedCount.value = 0
    resultCorrect.value = r.correct_count
    resultRank.value = r.rank || 0
    stopTimer()
    await loadRank()
    try {
      const rank = Number(r.rank) || 0
      const full = Number(test.value?.total_score || 0)
      recordAction('test', {
        title: String(test.value?.title || '班级测试').slice(0, 40),
        brief: `得分 ${r.score}`,
        top3: rank >= 1 && rank <= 3,
        perfect: full > 0 && Number(r.score) >= full,
      })
    } catch {
      /* 埋点失败不影响交卷 */
    }
    toast.success(auto ? '时间到，已自动交卷' : '交卷成功')
  } catch (e) {
    toastError(e, '提交失败，请重试')
  }
  submitting.value = false
}

async function loadRank() {
  try {
    rankData.value = await api.cls.testRank(getToken(), testId.value)
  } catch {
    rankData.value = {}
  }
}

function goBack() {
  router.push(path(ROUTES.classDetail, { id: String(route.params.id || '') }))
}

onMounted(() => {
  doStart(true)
})

onBeforeUnmount(stopTimer)
</script>

<style scoped>
.trun {
  max-width: var(--col-narrow);
}
.trun__head {
  margin-bottom: var(--sp-4);
}
.trun__card {
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-4);
}
.trun__intro .t-body-2 {
  margin-bottom: var(--sp-4);
}
.trun__timer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 62px;
  z-index: 2;
}
.trun__timer {
  font-size: 22px;
  font-weight: var(--fw-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.trun__timer.is-low {
  color: var(--danger, #e8443a);
}
.trun__q-no {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  margin-bottom: 4px;
}
.trun__q {
  font-size: var(--fs-body);
  color: var(--text-primary);
  margin-bottom: var(--sp-3);
}
.trun__opts {
  display: grid;
  gap: var(--sp-2);
}
.trun__opt {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: none;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.trun__opt:hover {
  background: var(--surface-hover, rgba(20, 30, 60, 0.04));
}
.trun__opt.is-on {
  border-color: var(--primary);
  background: var(--primary-soft-1, rgba(124, 92, 255, 0.12));
}
.trun__opt-letter {
  flex: none;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.trun__opt-text {
  color: var(--text-secondary);
  word-break: break-word;
}
.trun__blank {
  width: 100%;
}
.trun__submit .trun__warn {
  color: var(--warning-text, #b5722a);
  margin-bottom: var(--sp-2);
}
.trun__result {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.trun__score {
  font-size: 40px;
  font-weight: var(--fw-semibold);
  color: var(--primary-text);
}
.trun__score i {
  font-style: normal;
  font-size: var(--fs-body);
  color: var(--text-tertiary);
}

/* ---------------- 桌面端（≥1024px）：试卷 + 答题卡双栏 ---------------- */
.trun__layout {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.trun__sheet {
  display: none;
}
@media (min-width: 1024px) {
  .trun {
    max-width: none;
  }
  .trun__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 272px;
    gap: var(--sp-6);
    align-items: start;
  }
  .trun__col {
    min-width: 0;
  }
  .trun__sheet {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    position: sticky;
    top: 82px;
  }
  .trun__sheet-card {
    padding: var(--sp-4) var(--sp-5);
  }
  .trun__sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .trun__grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .trun__cell {
    height: 32px;
    border: var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-unit);
    color: var(--text-tertiary);
    font-family: inherit;
    font-size: var(--fs-body-2);
    font-weight: var(--fw-medium);
    cursor: pointer;
    transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .trun__cell:hover {
    border-color: var(--primary-line);
  }
  .trun__cell.is-done {
    background: var(--primary-cta);
    border-color: transparent;
    color: var(--text-on-primary);
  }
  .trun__legend {
    display: flex;
    gap: var(--sp-4);
    margin-top: var(--sp-3);
    font-size: var(--fs-label);
    color: var(--text-muted);
  }
  .trun__legend i {
    width: 11px;
    height: 11px;
    border-radius: 3px;
    display: inline-block;
    margin-right: 5px;
    vertical-align: -1px;
    background: var(--surface-unit);
    border: var(--border-subtle);
  }
  .trun__legend i.is-done {
    background: var(--primary-cta);
    border-color: transparent;
  }
  .trun__sheet-side {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    align-items: center;
    text-align: center;
  }
}

/* 答错的题：勾选沉淀进错题本 */
.trun__wrong-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.trun__wrong-all {
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--primary-text);
  cursor: pointer;
}
.trun__wrong-tip {
  margin-top: var(--sp-2);
  color: var(--text-muted);
}
.trun__wrong-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: var(--sp-3) 0;
}
.trun__wrong-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  cursor: pointer;
}
.trun__wrong-row:hover {
  border-color: var(--primary-line);
}
.trun__wrong-cb {
  margin-top: 2px;
  width: 16px;
  height: 16px;
  flex: none;
  accent-color: var(--primary);
}
.trun__wrong-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.trun__wrong-body b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  line-height: 1.5;
}
.trun__wrong-body i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: 1.6;
}
.trun__wrong-body i em {
  font-style: normal;
  color: var(--success);
  margin-left: var(--sp-2);
}
</style>
