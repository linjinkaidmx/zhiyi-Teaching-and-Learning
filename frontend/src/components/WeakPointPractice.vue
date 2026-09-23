<template>
  <UiModal :model-value="open" :title="`薄弱点专项练习 · ${point}`" size="lg" @update:model-value="$emit('update:open', $event)">
    <!-- 生成中 -->
    <div v-if="stage === 'generating'" class="wpp__loading">
      <UiSkeleton v-for="i in 3" :key="i" height="72" />
      <p class="t-body-2 wpp__hint">正在围绕「{{ point }}」出 {{ COUNT }} 道同类题，通常需要十几秒…</p>
    </div>

    <!-- 生成失败 -->
    <div v-else-if="stage === 'error'" class="wpp__error">
      <p class="t-body-2">{{ errMsg }}</p>
      <div class="wpp__ops">
        <UiButton variant="primary" @click="generate">重新生成</UiButton>
        <UiButton variant="ghost" @click="close">关闭</UiButton>
      </div>
    </div>

    <!-- 作答与判分 -->
    <template v-else>
      <div class="wpp__progress t-label">
        第 {{ curIndex + 1 }} / {{ quizzes.length }} 题 · 已答对 {{ correctCount }}
      </div>

      <article v-for="(q, i) in quizzes" v-show="i === curIndex" :key="i" class="wpp__q">
        <MathText class="wpp__stem" :content="q.question" />
        <textarea
          v-model="answers[i]"
          class="wpp__input"
          rows="4"
          :disabled="!!results[i]"
          placeholder="写下你的解答过程或最终答案（可以写公式，用 $...$）"
        />
        <div v-if="results[i]" class="wpp__result" :class="results[i].ok ? 'is-ok' : 'is-bad'">
          <div class="wpp__result-head">
            <b>{{ results[i].ok ? '答对了' : '还差一点' }}</b>
            <span v-if="results[i].score !== null" class="t-label">{{ results[i].score }} 分</span>
          </div>
          <p class="t-body-2"><b>参考解答：</b><MathText :content="q.answer" /></p>
          <p v-if="q.analysis" class="t-body-2"><b>解析：</b><MathText :content="q.analysis" /></p>
          <p v-if="results[i].feedback" class="t-body-2"><MathText :content="results[i].feedback" /></p>
        </div>
      </article>

      <div class="wpp__ops">
        <template v-if="!results[curIndex]">
          <UiButton variant="primary" :loading="judging" :disabled="!String(answers[curIndex] || '').trim()" @click="submitOne">
            提交这一题
          </UiButton>
          <UiButton variant="ghost" @click="skipOne">跳过</UiButton>
        </template>
        <UiButton v-else-if="curIndex < quizzes.length - 1" variant="primary" @click="nextOne">下一题</UiButton>
        <template v-else>
          <UiButton variant="primary" @click="saveWrongOnly">把答错的存入错题本</UiButton>
          <UiButton variant="ghost" @click="close">完成</UiButton>
        </template>
      </div>

      <p v-if="allDone" class="t-label wpp__summary">
        本次练习完成：{{ correctCount }} / {{ quizzes.length }} 题正确。
      </p>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 薄弱点专项练习
 * ---------------------------------------------------------------------------
 * 从「学习数据 → 薄弱知识点」点进来：围绕该知识点生成 N 道同类题，逐题作答，
 * 交给现有 /api/judge 判分并展示解析；答错的题可一键存进错题本。
 *
 * 只做「练 + 存错题」：掌握度的提升交给错题本的自测流程（连续答对 2 次才算掌握），
 * 避免这里臆造掌握度、和 SRS 规则打架。
 */
import { computed, ref, watch } from 'vue'
import UiModal from '../ui/UiModal.vue'
import UiButton from '../ui/UiButton.vue'
import UiSkeleton from '../ui/UiSkeleton.vue'
import MathText from './MathText.vue'
import { api } from '../api.js'
import { getToken } from '../auth.js'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { upsert, bookRef } from '../stores/bookStore.js'
import { makeItem } from '../book.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 薄弱知识点名 */
  point: { type: String, default: '' },
  /** 该知识点下的错题（用于取参考原题，让新题更贴近学生实际遇到的形式） */
  refItems: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:open'])

const COUNT = 3

const stage = ref('generating')   // generating | quiz | error
const errMsg = ref('')
const quizzes = ref([])
const answers = ref([])
const results = ref([])
const curIndex = ref(0)
const judging = ref(false)

const correctCount = computed(() => results.value.filter((r) => r && r.ok).length)
const allDone = computed(() => results.value.length === quizzes.value.length && quizzes.value.length > 0)

function reset() {
  stage.value = 'generating'
  errMsg.value = ''
  quizzes.value = []
  answers.value = []
  results.value = []
  curIndex.value = 0
  judging.value = false
}

/** 并发出题：3 道同类题（单次接口只出一题，并发 3 次换取速度） */
async function generate() {
  if (!props.point) return
  reset()
  const ref = (props.refItems[0] && props.refItems[0].question) || ''
  try {
    const rs = await Promise.all(
      Array.from({ length: COUNT }, () =>
        api.generateQuiz([props.point], ref).catch(() => null)
      )
    )
    const ok = rs.filter((r) => r && r.question)
    if (!ok.length) throw new Error('这次没能生成题目')
    quizzes.value = ok
    answers.value = ok.map(() => '')
    results.value = ok.map(() => null)
    stage.value = 'quiz'
  } catch (e) {
    errMsg.value = e.message || '生成失败，请重试'
    stage.value = 'error'
  }
}

/** 判分：ok 以「分数是否达到 60」为准，缺分数时退回 correct 字段 */
function parseJudge(d) {
  const score = d && d.score !== undefined && d.score !== null ? Number(d.score) : null
  let ok = false
  if (score !== null && !Number.isNaN(score)) ok = score >= 60
  else if (d && typeof d.correct === 'boolean') ok = d.correct
  else if (d && typeof d.is_correct === 'boolean') ok = d.is_correct
  return { ok, score: score !== null && !Number.isNaN(score) ? Math.round(score) : null, feedback: String((d && (d.feedback || d.comment)) || '') }
}

async function submitOne() {
  const i = curIndex.value
  const q = quizzes.value[i]
  const my = String(answers.value[i] || '').trim()
  if (!q || !my || judging.value) return
  judging.value = true
  try {
    const d = await api.judge(q.question, q.answer, my, [], '', [props.point])
    results.value[i] = parseJudge(d)
    if (!results.value[i].ok) {
      // 答错的自动进错题本（与「练一组」的目的直接相关，不用再点一次）
      saveToBook(q, my)
    }
  } catch (e) {
    toastError(e, '判分失败，可重试')
  }
  judging.value = false
}

function skipOne() {
  const i = curIndex.value
  results.value[i] = { ok: false, score: null, feedback: '' }
  if (curIndex.value < quizzes.value.length - 1) curIndex.value += 1
}

function nextOne() {
  if (curIndex.value < quizzes.value.length - 1) curIndex.value += 1
}

/** 把一道题存入错题本（同题干已存在则跳过，避免重复堆积） */
function saveToBook(q, myAnswer) {
  const book = bookRef().value || []
  const norm = (v) => String(v || '').replace(/\s+/g, '').toLowerCase()
  if (book.some((x) => x && x.kind !== 'note' && norm(x.question) === norm(q.question))) return
  upsert({
    ...makeItem(q.question, myAnswer, {
      subject: q.subject || '专项练习',
      question_type: q.question_type || '计算题',
      answer: q.answer || '',
      steps: [],
      knowledge_points: [props.point],
    }, { courseId: '' }),
    source: '专项练习',
  })
}

/** 收尾：把这一轮答错但还没存过的补存一次 */
function saveWrongOnly() {
  let n = 0
  const book = bookRef().value || []
  const norm = (v) => String(v || '').replace(/\s+/g, '').toLowerCase()
  quizzes.value.forEach((q, i) => {
    if (!results.value[i] || results.value[i].ok) return
    if (book.some((x) => x && x.kind !== 'note' && norm(x.question) === norm(q.question))) return
    saveToBook(q, answers.value[i])
    n += 1
  })
  toast.success(n ? `已存入错题本 ${n} 道` : '答错的题都已在错题本里了')
  close()
}

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (v) => {
    if (v) generate()
    else reset()
  }
)
</script>

<style scoped>
.wpp__loading {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.wpp__hint {
  color: var(--text-muted);
  margin-top: var(--sp-2);
}
.wpp__progress {
  color: var(--text-muted);
  margin-bottom: var(--sp-3);
}
.wpp__stem {
  display: block;
  font-size: var(--fs-body);
  line-height: 1.8;
  margin-bottom: var(--sp-3);
}
.wpp__input {
  width: 100%;
  font-family: inherit;
  font-size: var(--fs-body-2);
  line-height: 1.7;
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  color: var(--text-primary);
  resize: vertical;
}
.wpp__result {
  margin-top: var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.wpp__result.is-ok {
  background: color-mix(in srgb, var(--success) 8%, transparent);
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
}
.wpp__result.is-bad {
  background: color-mix(in srgb, var(--danger) 7%, transparent);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}
.wpp__result-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.wpp__ops {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
  flex-wrap: wrap;
}
.wpp__summary {
  margin-top: var(--sp-3);
  color: var(--text-muted);
}
</style>
