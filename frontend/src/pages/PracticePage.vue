<template>
  <div class="zy-container zy-page practice">
    <header class="pr__head">
      <div>
        <h1 class="t-h1">自测练习</h1>
        <p class="t-body-2">选择练习方式，检测掌握程度</p>
      </div>
      <div class="pr__head-ops">
        <UiButton variant="ghost" size="sm" @click="settingsOpen = true">
          <UiIcon name="settings" :size="14" /> 复习设置
        </UiButton>
      </div>
    </header>
    <ReviewSettingsDialog v-model="settingsOpen" />

    <!-- 模式选择 -->
    <div class="pr__modes" role="radiogroup" aria-label="练习模式">
      <button
        v-for="m in MODES"
        :key="m.key"
        type="button"
        class="pr__mode surface-standard"
        :class="{ 'is-active': mode === m.key }"
        @click="setMode(m.key)"
      >
        <UiIcon :name="m.icon" :size="20" />
        <span class="pr__mode-title">{{ m.title }}</span>
        <span class="pr__mode-desc">{{ m.desc }}</span>
      </button>
    </div>

    <!-- 组卷配置 -->
    <div v-if="stage === 'config'" class="pr__config">
      <!-- 原题复习 -->
      <template v-if="mode === 'original'">
        <UiEmptyState v-if="!pool.length" title="暂无可复习的错题" description="错题都掌握后，或添加新错题后再来。">
          <template #action><UiButton variant="primary" @click="$router.push(ROUTES.capture)">去拍题</UiButton></template>
        </UiEmptyState>
        <template v-else>
          <p class="t-body">待复习 {{ pool.length }} 道。选练习题数：</p>
          <CountPicker :count="count" :max="pool.length" @change="count = $event" />
          <UiButton variant="primary" size="lg" @click="startOriginal">开始练习</UiButton>
        </template>
      </template>

      <!-- 变式题 -->
      <template v-else-if="mode === 'variation'">
        <UiEmptyState v-if="!pool.length" title="暂无可生成变式的错题" description="先添加错题，再来生成变式题。">
          <template #action><UiButton variant="primary" @click="$router.push(ROUTES.capture)">去拍题</UiButton></template>
        </UiEmptyState>
        <template v-else>
          <p class="t-body">
          从待复习的 {{ pool.length }} 道题各生成一道变式题（同知识点换数据）。选数量：
        </p>
        <p class="t-label">变式题由 AI 逐题生成，同一道题重复练习会命中缓存、不会重复计费。</p>
          <CountPicker :count="count" :max="pool.length" @change="count = $event" />
          <UiButton variant="primary" size="lg" :loading="generating" @click="startVariation">
          {{ genText || '生成变式题' }}
        </UiButton>
        </template>
      </template>

      <!-- AI 新出题 -->
      <template v-else>
        <p class="t-body">选择要考察的知识点（可多选）：</p>
        <div v-if="points.length" class="pr__kp">
          <button
            v-for="p in points"
            :key="p"
            type="button"
            class="pr__kp-chip"
            :class="{ 'is-active': selectedKps.has(p) }"
            @click="toggleKp(p)"
          >
            {{ p }}
          </button>
          <button type="button" class="pr__kp-chip" :class="{ 'is-active': selectedKps.size === 0 }" @click="selectedKps.clear()">
            全部
          </button>
        </div>
        <p v-else class="t-body-2">错题本里还没有知识点，去拍题或从错题里补充知识点后再来。</p>
        <p class="t-body">出题数量：</p>
        <CountPicker :count="count" :max="10" @change="count = $event" />
        <UiButton variant="primary" size="lg" :disabled="!points.length" :loading="generating" @click="startGenerated">
          开始出题
        </UiButton>
      </template>
    </div>

    <!-- 答题 -->
    <div v-else-if="stage === 'answering'" class="pr__quiz">
      <div class="pr__progress surface-standard">
        <span class="t-caption">第 {{ idx + 1 }} / {{ paper.length }} 题</span>
        <div class="pr__bar"><span :style="{ width: pct + '%' }" /></div>
      </div>

      <section class="surface-standard pr__q">
        <div class="pr__q-meta">
          <UiTag v-if="current.subject" variant="info">{{ current.subject }}</UiTag>
          <UiTag v-if="current.questionType" variant="neutral">{{ current.questionType }}</UiTag>
        </div>
        <MathText :content="current.text" />
      </section>

      <section class="pr__answer">
        <textarea v-model="myAnswer" class="pr__input" rows="5" placeholder="拍照/上传手写作答，自动识别填入；也可直接输入…" />

        <!-- 作答照片：转录中 / 转录结果可校对 -->
        <div v-if="answerImg" class="pr__shot">
          <img :src="answerImg" alt="作答照片" />
          <div class="pr__shot-side">
            <span v-if="transcribing" class="t-caption pr__shot-status">
              <span class="pr__shot-spinner" />正在识别手写内容…
            </span>
            <template v-else>
              <span class="t-caption pr__shot-status is-ok">已识别填入，请检查修改后再判分</span>
              <div class="pr__shot-ops">
                <UiButton variant="ghost" size="sm" @click="albumInput.click()">换一张</UiButton>
                <UiButton variant="ghost" size="sm" @click="removeShot">移除</UiButton>
              </div>
            </template>
          </div>
        </div>

        <div class="pr__entry-ops">
          <UiButton variant="secondary" size="sm" :disabled="transcribing" @click="cameraInput.click()">
            <template #icon><UiIcon name="camera" :size="16" /></template>
            拍照作答
          </UiButton>
          <UiButton variant="ghost" size="sm" :disabled="transcribing" @click="albumInput.click()">
            <template #icon><UiIcon name="image" :size="16" /></template>
            相册上传
          </UiButton>
          <span class="t-caption pr__entry-hint">支持 Ctrl+V 粘贴截图</span>
        </div>

        <div class="pr__answer-ops">
          <UiButton variant="primary" :disabled="!myAnswer.trim() || judging" :loading="judging" @click="submitJudge">AI 判分</UiButton>
          <UiButton variant="ghost" size="sm" @click="revealAnswer">看答案</UiButton>
        </div>
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="sr-only" @change="onAnswerFile" />
        <input ref="albumInput" type="file" accept="image/*" class="sr-only" @change="onAnswerFile" />
      </section>

      <section v-if="revealed" class="pr__verdict surface-elevated" :data-v="verdict.verdict">
        <div class="pr__verdict-head">
          <span class="t-h3">{{ verdictText }}</span>
          <span v-if="verdict.score != null" class="t-body-2">{{ verdict.score }} 分</span>
        </div>
        <p v-if="verdict.comment" class="t-body pr__verdict-comment">{{ verdict.comment }}</p>
        <section class="pr__ref">
          <p class="t-label">参考答案</p>
          <MathText :content="current.answer" />
        </section>
        <section v-if="current.analysis" class="pr__ref">
          <p class="t-label">解析</p>
          <MarkdownText :content="current.analysis" />
        </section>
        <div class="pr__mark">
          <UiButton variant="cta" @click="mark(true)">我会了</UiButton>
          <UiButton variant="ghost" @click="mark(false)">没掌握</UiButton>
        </div>
      </section>
    </div>

    <!-- 结果 -->
    <section v-else class="pr__result">
      <UiCard title="练习结果" surface="elevated">
        <div class="pr__summary">
          <div class="pr__sum-item"><span class="t-metric">{{ summary.total }}</span><span class="t-caption">作答</span></div>
          <div class="pr__sum-item"><span class="t-metric">{{ summary.correct }}</span><span class="t-caption">答对</span></div>
          <div class="pr__sum-item"><span class="t-metric">{{ summary.masteredCount }}</span><span class="t-caption">新掌握</span></div>
        </div>
        <p v-if="summary.masteredCount" class="t-body-2">{{ summary.masteredCount }} 道题已掌握，移出复习队列。</p>
        <div class="pr__result-ops">
          <UiButton variant="primary" @click="$router.push(ROUTES.wrongbook)">回错题学习</UiButton>
          <UiButton variant="ghost" @click="stage = 'config'">再来一组</UiButton>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiCard from '../ui/UiCard.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import MathText from '../components/MathText.vue'
import MarkdownText from '../components/MarkdownText.vue'
import { ROUTES } from '../lib/routes.js'
import { api } from '../api'
import ReviewSettingsDialog from '../components/ReviewSettingsDialog.vue'
import { bookRef, upsert, settingsRef } from '../stores/bookStore'
import { quizPool, applyAnswer } from '../book.js'
import { recordAction } from '../stores/statsStore'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { readImageDataUrl } from '../lib/imageFile.js'
import { makeVariants } from '../lib/adapter/variant.js'
import CountPicker from './_CountPicker.vue'

const route = useRoute()
const router = useRouter()
const book = bookRef()

const MODES = [
  { key: 'original', title: '原题复习', desc: '重做错题本里的原题', icon: 'book' },
  { key: 'variation', title: '变式题', desc: '由原题生成变式', icon: 'refresh' },
  { key: 'generated', title: 'AI 新出题', desc: '按知识点生成新题', icon: 'sparkle' },
]

const mode = ref(String(route.params.mode || 'original'))
const stage = ref('config') // config | answering | result
const count = ref(10)
const generating = ref(false)
const genText = ref('')
let qStartAt = 0 // 每题开始作答的时刻（用于学习时长）
const selectedKps = reactive(new Set())

const paper = ref([]) // [{ text, answer, analysis, subject, questionType, refId }]
const idx = ref(0)
const myAnswer = ref('')
const judging = ref(false)
const revealed = ref(false)
const verdict = ref({ verdict: '', score: null, comment: '' })
const summary = reactive({ total: 0, correct: 0, masteredCount: 0 })

/* ---- 作答照片转录（拍照/上传 → 识别位逐字转录 → 填入作答框供校对）---- */
const answerImg = ref('') // 缩略图（压缩后的 dataURL）
const transcribing = ref(false)
const cameraInput = ref(null)
const albumInput = ref(null)
let transcribeSeq = 0 // 防竞态：连拍/换图时作废旧请求的返回

function onAnswerFile(event) {
  const file = event.target.files && event.target.files[0]
  event.target.value = '' // 允许重复选择同一文件
  if (file) transcribeShot(file)
}

async function transcribeShot(file) {
  const r = await readImageDataUrl(file, { onError: toast.error })
  if (!r) return
  const seq = ++transcribeSeq
  answerImg.value = r.dataUrl
  transcribing.value = true
  try {
    // mode=answer：识别位按「手写作答转录」prompt 逐字转写，保留原始错误
    const data = await api.extract(r.dataUrl, r.mime, null, 'answer')
    if (seq !== transcribeSeq) return // 期间已换图/移除，丢弃旧结果
    const text = (data && data.question) || ''
    if (!text.trim()) {
      toast.error('没识别到手写作答，请重拍一张，或直接输入')
      return
    }
    myAnswer.value = text // 作答照片即作答本体，覆盖填入；转录可能有误，判分前可修改
    toast.success('已识别手写作答，检查无误后点「AI 判分」')
  } catch (e) {
    if (seq === transcribeSeq) toastError(e, '识别失败，可重试或直接输入')
  } finally {
    if (seq === transcribeSeq) transcribing.value = false
  }
}

function removeShot() {
  transcribeSeq += 1 // 转录中移除：作废进行中的请求
  transcribing.value = false
  answerImg.value = ''
}

function clearShot() {
  transcribeSeq += 1
  transcribing.value = false
  answerImg.value = ''
}

function onWindowPaste(e) {
  if (stage.value !== 'answering') return
  const items = (e.clipboardData && e.clipboardData.items) || []
  for (const item of items) {
    if (item.kind === 'file' && /^image\//.test(item.type)) {
      const f = item.getAsFile()
      if (f) {
        e.preventDefault()
        transcribeShot(f)
      }
      return
    }
  }
}
onMounted(() => window.addEventListener('paste', onWindowPaste))

/* 错题本「重做此题」：?focus=<id> 存在且该题在池中 → 跳过选卷直接开始 */
const focusId = ref('')
onMounted(() => {
  const fid = route.query.focus
  if (fid && pool.value.some((it) => String(it.id) === String(fid))) {
    focusId.value = String(fid)
    startOriginal()
  }
})
onBeforeUnmount(() => window.removeEventListener('paste', onWindowPaste))

const reviewSettings = settingsRef() // 复习设置（SRS 开关/间隔），组卷与写回共用
const settingsOpen = ref(false)
const pool = computed(() => quizPool(book.value, reviewSettings.value))
const points = computed(() => [...new Set(book.value.flatMap((i) => i.knowledgePoints || []).filter(Boolean))])
const subject = computed(() => book.value.find((i) => i.subject)?.subject || '')
const current = computed(() => paper.value[idx.value])
const pct = computed(() => (paper.value.length ? Math.round((idx.value / paper.value.length) * 100) : 0))
const verdictText = computed(() => ({ correct: '回答正确', partial: '部分正确', wrong: '回答错误' }[verdict.value.verdict] || '参考答案'))

function setMode(key) {
  mode.value = key
  stage.value = 'config'
}

function toggleKp(p) {
  if (selectedKps.has(p)) selectedKps.delete(p)
  else selectedKps.add(p)
}

function initPaper() {
  qStartAt = Date.now()
  idx.value = 0
  myAnswer.value = ''
  clearShot()
  revealed.value = false
  verdict.value = { verdict: '', score: null, comment: '' }
  Object.assign(summary, { total: 0, correct: 0, masteredCount: 0 })
}

/* 原题复习：真实 SRS */
function startOriginal() {
  // 错题本「重做此题」带 ?focus=<id>：只考这一题
  const base = focusId.value
    ? pool.value.filter((it) => String(it.id) === focusId.value)
    : [...pool.value].sort(() => Math.random() - 0.5).slice(0, count.value)
  const picked = base
  if (!picked.length) {
    toast.info('暂无可复习的题')
    return
  }
  paper.value = picked.map((it) => ({
    text: it.question,
    answer: it.answer,
    analysis: '',
    subject: it.subject,
    questionType: it.questionType,
    refId: it.id,
  }))
  initPaper()
  stage.value = 'answering'
}

/* 变式题：逐题调用 /api/variant（后端有缓存，重复练习同题不再计费）；不写回 SRS */
async function startVariation() {
  generating.value = true
  genText.value = '正在生成变式题…'
  const src = [...pool.value].sort(() => Math.random() - 0.5).slice(0, count.value)
  const items = []
  try {
    for (let i = 0; i < src.length; i += 1) {
      const it = src[i]
      genText.value = `正在生成变式题 ${i + 1}/${src.length}…`
      const list = await makeVariants(
        { question: it.question, answer: it.answer, subject: it.subject },
        'variant',
        1,
      )
      const v = list[0]
      if (!v) continue
      items.push({
        text: v.question,
        answer: v.answer || it.answer,
        analysis: v.analysis || '',
        subject: it.subject,
        questionType: v.questionType || it.questionType,
        refId: '',
      })
    }
  } catch (e) {
    toastError(e, '生成失败，请重试')
  } finally {
    generating.value = false
    genText.value = ''
  }
  paper.value = items
  if (!paper.value.length) {
    toast.info('生成失败，请重试')
    return
  }
  initPaper()
  stage.value = 'answering'
}

/* AI 新出题：真实 /api/generate-quiz，逐题调用 */
async function startGenerated() {
  const kps = selectedKps.size ? [...selectedKps] : points.value
  if (!kps.length) return
  generating.value = true
  try {
    const items = []
    for (let i = 0; i < count.value; i += 1) {
      const d = await api.generateQuiz(kps, '', subject.value)
      if (d && d.question) {
        items.push({
          text: d.question,
          answer: d.answer || '',
          analysis: d.analysis || '',
          subject: d.subject || subject.value,
          questionType: d.question_type || '',
          refId: '',
        })
      }
    }
    paper.value = items
    if (!paper.value.length) {
      toast.error('出题失败，请重试')
      return
    }
    initPaper()
    stage.value = 'answering'
  } catch (e) {
    toast.error('出题失败：' + e.message)
  } finally {
    generating.value = false
  }
}

function revealAnswer() {
  revealed.value = true
  verdict.value = { verdict: '', score: null, comment: '' }
}

function submitJudge() {
  if (!current.value || judging.value) return
  judging.value = true
  api
    .judge(current.value.text, current.value.answer, myAnswer.value, [], '', [])
    .then((data) => {
      verdict.value = data || { verdict: 'wrong', score: null, comment: '' }
      revealed.value = true
      record(data && data.verdict === 'correct')
    })
    .catch((e) => toastError(e))
    .finally(() => (judging.value = false))
}

function mark(ok) {
  record(ok)
  next()
}

function record(ok) {
  summary.total++
  if (ok) summary.correct++
  // 仅原题复习写回 SRS（变式/新出题不影响错题本掌握度）
  if (mode.value === 'original' && current.value.refId) {
    const orig = book.value.find((i) => i.id === current.value.refId)
    if (orig) {
      const it = applyAnswer(orig, ok, reviewSettings.value)
      upsert(it)
      if (it.mastered && !orig.mastered) summary.masteredCount++
    }
  }
  const minutes = qStartAt ? (Date.now() - qStartAt) / 60000 : 0
  qStartAt = Date.now() // 下一题重新计时
  recordAction('quiz', {
    correct: ok,
    minutes,
    title: (current.value && current.value.text) || '',
    brief: mode.value === 'original' ? '原题复习' : mode.value === 'variation' ? '变式题' : 'AI 新出题',
  })
}

function next() {
  if (idx.value + 1 >= paper.value.length) {
    stage.value = 'result'
  } else {
    idx.value++
    qStartAt = Date.now()
    myAnswer.value = ''
    clearShot()
    revealed.value = false
    verdict.value = { verdict: '', score: null, comment: '' }
  }
}
</script>

<style scoped>
.practice {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: 760px;
}
.pr__head {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.pr__head-ops {
  display: flex;
  gap: var(--sp-2);
}
.pr__modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.pr__mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.pr__mode.is-active {
  border-color: var(--primary-line);
  box-shadow: var(--highlight-1), 0 0 0 1px var(--primary-line);
}
.pr__mode-title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.pr__mode-desc {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.pr__kp {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin: var(--sp-2) 0;
}
.pr__kp-chip {
  padding: 6px 14px;
  border: var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.pr__kp-chip.is-active {
  border-color: var(--primary-line);
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.pr__progress {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
}
.pr__bar {
  height: 3px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.pr__bar > span {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-pill);
  transition: width var(--dur-slow) var(--ease);
}
.pr__q {
  padding: var(--sp-5);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.pr__q-meta {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.pr__answer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pr__input {
  width: 100%;
  resize: vertical;
  min-height: 96px;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
}
.pr__input:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.pr__answer-ops {
  display: flex;
  gap: var(--sp-2);
}
.pr__entry-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.pr__entry-hint {
  color: var(--text-tertiary);
}
.pr__shot {
  display: flex;
  gap: var(--sp-3);
  align-items: flex-start;
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.pr__shot img {
  width: 96px;
  height: 96px;
  object-fit: contain; /* 作答确认需要看全内容，不裁边 */
  background: #fff;
  border-radius: var(--radius-sm);
  flex: none;
}
.pr__shot-side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  flex: 1;
  min-width: 0;
}
.pr__shot-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
}
.pr__shot-status.is-ok {
  color: var(--ai-completed-ring);
}
.pr__shot-ops {
  display: flex;
  gap: var(--sp-2);
}
.pr__shot-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--primary-line);
  border-top-color: transparent;
  animation: pr-spin 0.8s linear infinite;
  flex: none;
}
@keyframes pr-spin {
  to { transform: rotate(360deg); }
}
.pr__verdict {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pr__verdict[data-v='correct'] {
  border-top-color: var(--ai-completed-ring);
}
.pr__verdict[data-v='wrong'] {
  border-top-color: var(--error);
}
.pr__verdict-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.pr__verdict-comment {
  color: var(--text-secondary);
}
.pr__ref {
  padding-top: var(--sp-3);
  border-top: var(--border-divider-soft);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.pr__mark {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.pr__result .pr__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.pr__sum-item {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.pr__result-ops {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
}

@media (max-width: 767px) {
  .pr__modes {
    grid-template-columns: 1fr;
  }
  /* 移动端没有键盘粘贴习惯，隐藏提示给按钮腾地方 */
  .pr__entry-hint {
    display: none;
  }
}
</style>
