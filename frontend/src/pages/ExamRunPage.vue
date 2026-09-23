<template>
  <div class="zy-page">
    <div class="zy-container er">
      <header class="er__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="onBack">← 返回</UiButton>
        <h1 class="t-h1">{{ headTitle }}</h1>
        <p class="t-body-2">{{ headDesc }}</p>
      </header>

      <!-- ① 组卷配置 -->
      <template v-if="step === 'config'">
        <section class="er__block surface-standard">
          <div class="er__label">题型</div>
          <div class="er__modes">
            <button
              v-for="m in modeList"
              :key="m.key"
              type="button"
              class="er__mode"
              :class="{ 'is-active': mode === m.key }"
              @click="mode = m.key"
            >
              <span class="er__mode-title">{{ m.label }}</span>
              <span class="t-label">{{ m.meta }}</span>
            </button>
          </div>

          <!-- 自定义题量：题量自己填，分值自动凑整（也可手改） -->
          <div v-if="mode === 'custom'" class="er__custom">
            <div v-for="r in customRows" :key="r.type" class="er__custom-row">
              <span class="er__custom-label">{{ typeLabel(r.type) }}</span>
              <UiNumber v-model="r.count" :min="0" :max="MAX_PAPER_QUESTIONS" size="sm" @change="onCountChange" />
              <span class="t-label">道 × 每题</span>
              <UiNumber v-model="r.score" :min="0" :max="100" size="sm" @change="onScoreChange(r)" />
              <span class="t-label">分</span>
              <span class="er__custom-sub">= {{ (Number(r.count) || 0) * (Number(r.score) || 0) }} 分</span>
            </div>
            <div class="er__custom-sum" :class="{ 'is-bad': !customOk }">
              <template v-if="customSum.total <= 0">请至少给一种题型填数量</template>
              <template v-else-if="customSum.total > MAX_PAPER_QUESTIONS">
                题目合计 {{ customSum.total }} 道，超过上限 {{ MAX_PAPER_QUESTIONS }} 道
              </template>
              <template v-else-if="customSum.score !== PAPER_TOTAL">
                合计 {{ customSum.total }} 道题 · {{ customSum.score }} 分（总分需正好 {{ PAPER_TOTAL }} 分，可手改每题分值调整）
              </template>
              <template v-else>
                合计 {{ customSum.total }} 道题 · {{ PAPER_TOTAL }} 分 ✓（数量为 0 的题型不会出题）
              </template>
            </div>
          </div>
        </section>

        <section class="er__block surface-standard">
          <div class="er__label">
            考察范围
            <span class="t-label">（已默认选中你错得最多的知识点，可增删）</span>
          </div>
          <div v-if="kpOptions.length" class="er__kps">
            <button
              v-for="k in kpOptions"
              :key="k.name"
              type="button"
              class="er__kp"
              :class="{ 'is-active': pickedKps.includes(k.name) }"
              @click="toggleKp(k.name)"
            >
              {{ k.name }}<i>{{ k.count }}</i>
            </button>
          </div>
          <p v-else class="t-label">错题本里还没有知识点，将按「大学理工科通用」范围内出题。</p>
        </section>

        <section class="er__block surface-standard">
          <div class="er__label">限时</div>
          <div class="er__limits">
            <button
              v-for="l in LIMIT_OPTIONS"
              :key="l.value"
              type="button"
              class="er__limit"
              :class="{ 'is-active': limitMin === l.value }"
              @click="limitMin = l.value"
            >
              {{ l.label }}
            </button>
          </div>
        </section>

        <div class="er__actions er__actions--end">
          <UiButton variant="primary" @click="generate">开始考试</UiButton>
        </div>
      </template>

      <!-- ② 组卷中 -->
      <section v-else-if="step === 'generating'" class="er__loading surface-standard">
        <span class="er__spinner" aria-hidden="true" />
        <p class="t-body-2">正在按你的范围出一张 100 分卷子，约 10~20 秒…</p>
        <p class="t-label">（选择题 4 个选项、填空题留空格位、解答题给参考答案）</p>
      </section>

      <!-- ③ 作答 -->
      <template v-else-if="step === 'answering'">
        <div class="er__bar surface-standard">
          <span class="t-label">第 {{ idx + 1 }} / {{ questions.length }} 题</span>
          <span class="t-label">{{ typeLabel(current.type) }} · {{ current.score }} 分</span>
          <span class="er__timer" :class="{ 'is-warn': remaining !== null && remaining <= 300 }">{{ timerText }}</span>
        </div>

        <div class="er__nav">
          <button
            v-for="(q, i) in questions"
            :key="q.id"
            type="button"
            class="er__navdot"
            :class="{ 'is-done': isAnswered(q.id), 'is-cur': i === idx }"
            @click="idx = i"
          >
            {{ i + 1 }}
          </button>
        </div>

        <section class="er__q surface-standard">
          <div class="er__q-text">
            <MathText :content="current.question" />
          </div>

          <div v-if="current.type === 'choice'" class="er__options">
            <button
              v-for="(o, i) in current.options"
              :key="i"
              type="button"
              class="er__option"
              :class="{ 'is-active': letterOf(current, i) === answers[current.id] }"
              @click="answers[current.id] = letterOf(current, i)"
            >
              <MathText :content="o" />
            </button>
          </div>

          <div v-else class="er__answer">
            <textarea
              v-model="answers[current.id]"
              class="er__textarea"
              :rows="current.type === 'solution' ? 7 : 2"
              placeholder="在这里作答（也可以拍照录入手写答案，识别后可再修改）"
            />
            <div class="er__answer-ops">
              <label class="er__photo">
                <input type="file" accept="image/*" @change="onPhoto($event, current.id)" />
                <span>{{ photoBusy === current.id ? '识别中…' : '📷 拍照录入' }}</span>
              </label>
              <span class="t-label">按你写的原样转录，不改对错</span>
            </div>
          </div>
        </section>

        <div class="er__actions er__actions--between">
          <UiButton variant="ghost" :disabled="idx === 0" @click="idx -= 1">上一题</UiButton>
          <UiButton v-if="idx < questions.length - 1" variant="ghost" @click="idx += 1">下一题</UiButton>
          <UiButton variant="primary" @click="submit">
            {{ unansweredCount ? `交卷（还有 ${unansweredCount} 题未答）` : '交卷' }}
          </UiButton>
        </div>
      </template>

      <!-- ④ 判卷中 -->
      <section v-else-if="step === 'grading'" class="er__loading surface-standard">
        <span class="er__spinner" aria-hidden="true" />
        <p class="t-body-2">正在判卷…</p>
        <p class="t-label">选择题已即时判完，主观题正在由 AI 批改（约 5~15 秒）</p>
      </section>

      <!-- ⑤ 成绩与复盘 -->
      <template v-else-if="step === 'result'">
        <section class="er__score surface-standard">
          <div class="er__score-main">
            <span class="er__score-num">{{ grade.total }}</span>
            <span class="er__score-full">/ 100</span>
          </div>
          <div class="er__score-meta t-label">
            得分率 {{ grade.rate }}% · 用时 {{ formatDuration(durationSec) }} · 对 {{ grade.correctCount }} 题 / 错 {{ grade.wrongCount }} 题
            <template v-if="paper && paper.limitMin"> · 限时 {{ paper.limitMin }} 分钟</template>
          </div>
          <div class="er__chips">
            <span v-for="(v, k) in grade.byType" :key="k" class="er__chip">
              {{ typeLabel(k) }} {{ v.got }} / {{ v.full }}
            </span>
          </div>
          <p class="t-label er__note">
            选择题按标准答案判；主观题由 AI 按采分点估算，仅供参考。
          </p>
        </section>

        <section v-if="wrongList.length" class="er__block surface-standard">
          <div class="er__label">
            错题
            <span class="t-label">（勾选后加入错题本，交给掌握度算法安排复习）</span>
          </div>
          <label v-for="w in wrongList" :key="w.id" class="er__wrong-row">
            <input type="checkbox" :checked="pickedWrong.includes(w.id)" @change="toggleWrong(w.id)" />
            <span class="er__wrong-text">{{ plain(w.question, 70) }}</span>
            <span class="t-label">{{ w.score }}</span>
          </label>
          <div class="er__actions er__actions--end">
            <UiButton variant="primary" :disabled="!pickedWrong.length || savedToBook" @click="addToBook">
              {{ savedToBook ? `已加入 ${savedToBook} 题` : `加入错题本（${pickedWrong.length}）` }}
            </UiButton>
          </div>
        </section>

        <section class="er__review">
          <h2 class="t-h3">逐题复盘</h2>
          <div v-for="(r, i) in grade.perQuestion" :key="r.id" class="er__review-item surface-standard">
            <div class="er__review-head">
              <span class="er__review-idx">{{ i + 1 }}</span>
              <span class="t-label">{{ typeLabel(r.type) }} · {{ r.got }} / {{ r.full }} 分</span>
              <span class="er__review-tag" :class="r.correct ? 'is-right' : r.partial ? 'is-part' : 'is-wrong'">
                {{ r.correct ? '正确' : r.partial ? '部分得分' : '错误' }}
              </span>
            </div>
            <div class="er__review-q"><MathText :content="questionOf(r.id)" /></div>
            <div class="er__review-row">
              <span class="t-label">你的作答</span>
              <span class="er__review-val">{{ r.userAnswer || '（未作答）' }}</span>
            </div>
            <div class="er__review-row">
              <span class="t-label">参考答案</span>
              <span class="er__review-val"><MathText :content="answerOf(r.id)" /></span>
            </div>
            <div v-if="r.comment" class="er__review-row">
              <span class="t-label">AI 评语</span>
              <span class="er__review-val">{{ r.comment }}</span>
            </div>
            <details v-if="explanationOf(r.id)" class="er__review-exp">
              <summary class="t-label">看解析</summary>
              <div class="er__review-exp-body"><MathText :content="explanationOf(r.id)" /></div>
            </details>
          </div>
        </section>

        <div class="er__actions er__actions--between">
          <UiButton variant="ghost" @click="restartSame">重做本卷</UiButton>
          <UiButton variant="primary" @click="generateAgain">同配置再出一张</UiButton>
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
import UiNumber from '../ui/UiNumber.vue'
import MathText from '../components/MathText.vue'
import { api } from '../api.js'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { ROUTES } from '../lib/routes.js'
import { readImageDataUrl } from '../lib/imageFile.js'
import { latexToPlain } from '../mathtext.js'
import {
  PAPER_MODES, PAPER_TOTAL, TYPE_LABEL, MAX_PAPER_QUESTIONS, buildPlan, buildCustomPlan, customSummary,
  applyScores, validatePlan, splitForGrading, combineGrade, formatDuration, remainingSeconds,
  wrongToBookCandidates,
} from '../lib/exam.js'
import { papersRef, savePaper, getPaper } from '../stores/examStore'
import { bookRef, upsert } from '../stores/bookStore'
import { makeItem } from '../book.js'

const route = useRoute()
const router = useRouter()
const papers = papersRef()
const book = bookRef()

const LIMIT_OPTIONS = [
  { label: '不限时', value: 0 },
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
  { label: '120 分钟', value: 120 },
]

const step = ref('config')            // config | generating | answering | grading | result
const mode = ref('full')
const limitMin = ref(0)
const pickedKps = ref([])
const idx = ref(0)
const answers = reactive({})
const questions = ref([])
const plan = ref([])
const paper = ref(null)                // 当前试卷（保存/复盘用）
const grade = ref({ total: 0, rate: 0, correctCount: 0, wrongCount: 0, perQuestion: [], byType: {} })
const durationSec = ref(0)
const photoBusy = ref(null)
const pickedWrong = ref([])
const savedToBook = ref(0)
const now = ref(Date.now())

let tickTimer = null
let startedAt = 0

/* ---------------- 头部文案 ---------------- */
const headTitle = computed(() => {
  if (step.value === 'result') return '考试成绩'
  if (step.value === 'answering') return paper.value ? paper.value.title : '考试中'
  return '模拟考试'
})
const headDesc = computed(() => {
  if (step.value === 'result') return '看错在哪、把错题收进错题本，比分数更重要。'
  if (step.value === 'answering') return '交卷后选择题即时判分，主观题由 AI 批改。'
  return '选好题型与范围，生成一张 100 分制试卷。'
})

const modeList = computed(() => [
  ...Object.values(PAPER_MODES).map((m) => {
    const total = m.plan.reduce((s, p) => s + p.count, 0)
    const parts = m.plan.map((p) => `${TYPE_LABEL[p.type]} ${p.count}`)
    return { key: m.key, label: m.label, meta: `${parts.join(' + ')} · ${total} 题` }
  }),
  { key: 'custom', label: '自定义题量', meta: '自己定题型、题数与分值' },
])

/** 自定义题量的三行（数量 0 = 不出该题型） */
const customRows = ref([
  { type: 'choice', count: 5, score: 20, manual: false },
  { type: 'blank', count: 0, score: 0, manual: false },
  { type: 'solution', count: 0, score: 0, manual: false },
])

const customSum = computed(() => customSummary(customRows.value))
const customOk = computed(() => customSum.value.total > 0
  && customSum.value.total <= MAX_PAPER_QUESTIONS
  && customSum.value.score === PAPER_TOTAL)

/** 数量变化 → 全部回到「自动分值」（重新找整齐解） */
function onCountChange() {
  customRows.value.forEach((r) => { r.manual = false })
  recalcCustom()
}

/** 用户手改某行分值 → 该行标记为手工，其余行保持不变 */
function onScoreChange(row) {
  if (row) row.manual = true
}

/** 用整齐解自动填充「未手改」的行的每题分值 */
function recalcCustom() {
  const counts = {}
  customRows.value.forEach((r) => {
    const n = Math.floor(Number(r.count) || 0)
    if (n > 0) counts[r.type] = n
  })
  const plan = buildPlan('custom', counts)
  const byType = new Map(plan.map((p) => [p.type, p.score]))
  customRows.value.forEach((r) => {
    if (r.manual) return
    r.score = byType.get(r.type) || 0
  })
}

/** 知识点候选：错题本里出现次数倒序（出现越多越薄弱） */
const kpOptions = computed(() => {
  const m = new Map()
  ;(book.value || []).forEach((it) => {
    ;(it.knowledgePoints || []).forEach((k) => {
      const key = String(k || '').trim()
      if (key) m.set(key, (m.get(key) || 0) + 1)
    })
  })
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([name, count]) => ({ name, count }))
})

const current = computed(() => questions.value[idx.value] || {})
const unansweredCount = computed(() => questions.value.filter((q) => !isAnswered(q.id)).length)
/** 本次做错的题（含部分得分），用于结果页勾选入错题本 */
const wrongList = computed(() => {
  if (step.value !== 'result') return []
  return wrongToBookCandidates(paper.value || { id: 'tmp', questions: questions.value }, grade.value)
})
const remaining = computed(() => remainingSeconds(startedAt, limitMin.value, now.value))
const timerText = computed(() => {
  if (remaining.value !== null) return `剩余 ${formatDuration(remaining.value)}`
  return `已用 ${formatDuration(Math.floor((now.value - startedAt) / 1000))}`
})

function typeLabel(t) {
  return TYPE_LABEL[t] || '题目'
}
function isAnswered(id) {
  return String(answers[id] ?? '').trim().length > 0
}
function letterOf(q, i) {
  return String.fromCharCode(65 + i)
}
function clip(s, n) {
  const t = String(s || '')
  return t.length > n ? `${t.slice(0, n)}…` : t
}
/** 列表里的题干：把 LaTeX 转成 Unicode 纯文本，避免显示成源码 */
function plain(s, n) {
  let t = String(s || '')
  try {
    t = latexToPlain(t)
  } catch {
    /* 转换失败保留原文 */
  }
  return clip(t.replace(/\s+/g, ' ').trim(), n)
}
function questionOf(id) {
  const q = questions.value.find((x) => String(x.id) === String(id))
  return q ? q.question : ''
}
function answerOf(id) {
  const q = questions.value.find((x) => String(x.id) === String(id))
  return q ? (q.answer || '') : ''
}
function explanationOf(id) {
  const q = questions.value.find((x) => String(x.id) === String(id))
  return q ? (q.explanation || '') : ''
}

function toggleKp(name) {
  const i = pickedKps.value.indexOf(name)
  if (i >= 0) pickedKps.value.splice(i, 1)
  else pickedKps.value.push(name)
}
function toggleWrong(id) {
  const i = pickedWrong.value.indexOf(id)
  if (i >= 0) pickedWrong.value.splice(i, 1)
  else pickedWrong.value.push(id)
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  const q = route.query || {}
  if (q.mode && (PAPER_MODES[q.mode] || q.mode === 'custom')) mode.value = q.mode
  pickedKps.value = kpOptions.value.slice(0, Math.min(5, kpOptions.value.length)).map((k) => k.name)
  recalcCustom() // 自定义题量的分值先按整齐解填好
  if (q.paper) {
    const p = getPaper(String(q.paper))
    if (p) {
      resumePaper(p)
      return
    }
    toast.info('这张试卷不在本机（可能已删除）')
  }
  startTick()
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
})

function startTick() {
  if (tickTimer) return
  tickTimer = setInterval(() => {
    now.value = Date.now()
    if (step.value === 'answering' && remaining.value === 0) {
      toast.info('时间到，已自动交卷')
      submit(true)
    }
  }, 1000)
}

/** 打开历史试卷：未判分 → 继续作答；已判分 → 看结果 */
function resumePaper(p) {
  paper.value = p
  questions.value = p.questions || []
  plan.value = p.plan || []
  mode.value = p.mode || 'full'
  limitMin.value = Number(p.limitMin) || 0
  Object.keys(answers).forEach((k) => delete answers[k])
  Object.entries(p.answers || {}).forEach(([k, v]) => { answers[k] = v })
  startedAt = Number(p.startedAt) || Date.now()
  durationSec.value = Number(p.durationSec) || 0
  if (p.graded) {
    grade.value = p.graded
    pickedWrong.value = wrongToBookCandidates(p, p.graded).map((w) => w.id)
    step.value = 'result'
  } else {
    step.value = 'answering'
    startTick()
  }
}

/* ---------------- 组卷 ---------------- */
async function generate() {
  const p = mode.value === 'custom' ? buildCustomPlan(customRows.value) : buildPlan(mode.value)
  const v = validatePlan(p)
  if (!v.ok) {
    toast.error(v.error)
    return
  }
  if (v.total > MAX_PAPER_QUESTIONS) {
    toast.error(`一次最多 ${MAX_PAPER_QUESTIONS} 题`)
    return
  }
  step.value = 'generating'
  try {
    const data = await api.generatePaper({
      mode: mode.value,
      plan: p.map((x) => ({ type: x.type, count: x.count, score: x.score })),
      knowledge_points: pickedKps.value,
      subject: '',
      difficulty: 'standard',
    })
    const qs = applyScores(data.questions || [], p)
    if (!qs.length) throw new Error('组卷结果为空，请重试')
    questions.value = qs
    plan.value = p
    Object.keys(answers).forEach((k) => delete answers[k])
    idx.value = 0
    startedAt = Date.now()
    now.value = startedAt
    durationSec.value = 0
    pickedWrong.value = []
    savedToBook.value = 0
    paper.value = savePaper({
      id: `p${Date.now()}`,
      createdAt: Date.now(),
      mode: mode.value,
      title: data.title || '模拟试卷',
      totalScore: data.totalScore || 100,
      limitMin: limitMin.value,
      startedAt,
      questions: qs,
      plan: p.map((x) => ({ type: x.type, count: x.count, score: x.score, extras: x.extras })),
      answers: {},
      graded: null,
    })
    step.value = 'answering'
    startTick()
    toast.success(`已生成 ${qs.length} 道题`)
  } catch (e) {
    step.value = 'config'
    toastError(e, '组卷失败，请重试')
  }
}

/* ---------------- 交卷判分 ---------------- */
async function submit(auto = false) {
  if (step.value !== 'answering') return
  if (!auto && unansweredCount.value) {
    const go = window.confirm(`还有 ${unansweredCount.value} 题未作答，确定交卷？`)
    if (!go) return
  }
  step.value = 'grading'
  durationSec.value = Math.floor((Date.now() - startedAt) / 1000)
  const snapshot = {}
  Object.entries(answers).forEach(([k, v]) => { snapshot[k] = v })
  // 选择题本地判（不花额度）
  const { graded: localGraded, pending } = splitForGrading(questions.value, snapshot)
  let judgeResults = []
  if (pending.length) {
    try {
      const r = await api.judgePaper(pending)
      judgeResults = r.results || []
    } catch (e) {
      toast.error(`主观题批改失败：${e.message}（选择题成绩仍然有效）`)
    }
  }
  const g = combineGrade(questions.value, snapshot, localGraded, judgeResults)
  grade.value = g
  // 打卡/成就埋点：完成一次模拟考试（满分额外记一次事件）
  try {
    const full = Number(g?.totalScore ?? g?.total ?? 0)
    recordAction('exam', {
      title: '模拟考试',
      brief: `得分 ${g?.score ?? 0}${full ? '/' + full : ''}`,
      examPerfect: full > 0 && Number(g?.score) >= full,
    })
  } catch {
    /* 埋点失败不影响交卷 */
  }
  const saved = savePaper({
    ...(paper.value || {}),
    answers: snapshot,
    durationSec: durationSec.value,
    graded: g,
  })
  paper.value = saved
  // 错题默认全勾（用户可自行取消），避免逐个点
  pickedWrong.value = wrongToBookCandidates(saved || { id: 'tmp', questions: questions.value }, g).map((w) => w.id)
  step.value = 'result'
  toast.success(`得分 ${g.total} / 100`)
}

/* ---------------- 错题入本 ---------------- */
function addToBook() {
  const p = paper.value
  if (!p) return
  const byId = new Map(wrongList.value.map((c) => [c.id, c]))
  let added = 0
  pickedWrong.value.forEach((id) => {
    const c = byId.get(id)
    if (!c) return
    const item = makeItem(
      c.question,
      '（模拟考试错题）',
      {
        subject: p.subject || (pickedKps.value[0] || '模拟考试'),
        answer: c.answer,
        knowledge_points: c.knowledgePoints,
        diagnosis: c.explanation,
      },
      { courseId: '' },
    )
    upsert(item)
    added += 1
  })
  savedToBook.value = added
  toast.success(`已加入错题本 ${added} 题`)
}

/* ---------------- 其它操作 ---------------- */
function restartSame() {
  if (!paper.value) return
  Object.keys(answers).forEach((k) => delete answers[k])
  idx.value = 0
  startedAt = Date.now()
  now.value = startedAt
  durationSec.value = 0
  grade.value = { total: 0, rate: 0, correctCount: 0, wrongCount: 0, perQuestion: [], byType: {} }
  pickedWrong.value = []
  savedToBook.value = 0
  paper.value = savePaper({ ...paper.value, answers: {}, graded: null, startedAt, durationSec: 0 })
  step.value = 'answering'
  startTick()
}

function generateAgain() {
  step.value = 'config'
}

function onBack() {
  if (step.value === 'answering') {
    if (!window.confirm('离开后本次作答会保留在「历史成绩」里（未判分），确定离开？')) return
  }
  router.push(ROUTES.simExam)
}

/* ---------------- 拍照录入手写答案 ---------------- */
async function onPhoto(ev, qid) {
  const file = ev.target.files && ev.target.files[0]
  ev.target.value = ''
  if (!file) return
  photoBusy.value = qid
  try {
    const r = await readImageDataUrl(file)
    const data = await api.extract(r.dataUrl, r.mime, null, 'answer')
    const text = String((data && (data.text || data.question)) || '').trim()
    if (!text) {
      toast.error('没能识别出文字，换一张更清晰的试试')
      return
    }
    answers[qid] = answers[qid] ? `${answers[qid]}\n${text}` : text
    toast.success('已转录，可继续修改')
  } catch (e) {
    toastError(e, '识别失败')
  } finally {
    photoBusy.value = null
  }
}
</script>

<style scoped>
.er {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.er__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.er__block {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.er__label {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
.er__modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-2);
}
.er__mode {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--sp-3);
  text-align: left;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  cursor: pointer;
}
.er__mode.is-active {
  border-color: var(--primary-line);
  background: var(--primary-soft, rgba(120, 140, 240, 0.12));
}
.er__mode-title {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
/* 自定义题量：题量 + 每题分值 + 小计 */
.er__custom {
  margin-top: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: var(--border-divider-soft);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.er__custom-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.er__custom-label {
  flex: 0 0 52px;
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
.er__custom-row .ui-number {
  width: 72px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-label);
}
.er__custom-row .ui-number:focus {
  outline: none;
  border-color: var(--primary-line);
}
.er__custom-sub {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.er__custom-sum {
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--success, #2e7d32);
}
.er__custom-sum.is-bad {
  color: var(--danger, #c0392b);
}
.er__kps,
.er__limits,
.er__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.er__kp,
.er__limit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
  cursor: pointer;
}
.er__kp.is-active,
.er__limit.is-active {
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.er__kp i {
  font-style: normal;
  color: var(--text-muted);
}
.er__loading {
  padding: var(--sp-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  text-align: center;
}
.er__spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--primary);
  animation: er-spin 0.8s linear infinite;
}
@keyframes er-spin {
  to {
    transform: rotate(360deg);
  }
}
.er__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  flex-wrap: wrap;
}
.er__timer {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  font-size: var(--fs-label);
}
.er__timer.is-warn {
  color: var(--danger, #c0392b);
}
.er__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.er__navdot {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-muted);
  font-size: var(--fs-label);
  cursor: pointer;
}
.er__navdot.is-done {
  color: var(--primary-text);
  border-color: var(--primary-line);
}
.er__navdot.is-cur {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.er__q {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.er__q-text {
  font-size: var(--fs-body-2);
  line-height: var(--lh-body);
  color: var(--text-primary);
}
.er__options {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.er__option {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 10px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}
.er__option.is-active {
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.er__answer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.er__textarea {
  width: 100%;
  padding: 10px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
  line-height: var(--lh-body);
  resize: vertical;
  font-family: inherit;
}
.er__textarea:focus {
  outline: none;
  border-color: var(--primary-line);
}
.er__answer-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.er__photo {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
  cursor: pointer;
}
.er__photo input {
  display: none;
}
.er__actions {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
}
.er__actions--end {
  justify-content: flex-end;
}
.er__actions--between {
  justify-content: space-between;
}
.er__score {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: center;
  text-align: center;
}
.er__score-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.er__score-num {
  font-size: 40px;
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.er__score-full {
  color: var(--text-muted);
}
.er__score-meta {
  color: var(--text-secondary);
}
.er__chip {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  border: var(--border-divider-soft);
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
.er__note {
  color: var(--text-muted);
}
.er__wrong-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  border-top: var(--border-divider-soft);
  cursor: pointer;
}
.er__wrong-text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.er__review {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.er__review-item {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.er__review-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.er__review-idx {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-unit);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
.er__review-tag {
  margin-left: auto;
  font-size: var(--fs-label);
}
.er__review-tag.is-right {
  color: var(--success, #2e7d32);
}
.er__review-tag.is-part {
  color: var(--warning, #b26a00);
}
.er__review-tag.is-wrong {
  color: var(--danger, #c0392b);
}
.er__review-q {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  line-height: var(--lh-body);
}
.er__review-row {
  display: flex;
  gap: var(--sp-3);
  align-items: baseline;
}
.er__review-row > .t-label {
  flex: 0 0 64px;
  color: var(--text-muted);
}
.er__review-val {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.er__review-exp summary {
  cursor: pointer;
  color: var(--primary-text);
}
.er__review-exp-body {
  padding-top: var(--sp-2);
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
@media (max-width: 767px) {
  .er__modes {
    grid-template-columns: minmax(0, 1fr);
  }
  .er__score-num {
    font-size: 34px;
  }
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .er {
    max-width: none;
  }
}
</style>
