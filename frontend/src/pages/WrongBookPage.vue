<template>
  <div class="zy-container zy-page wrongbook">
    <header class="wb__head">
      <div>
        <h1 class="t-h1">错题学习</h1>
        <p class="t-body-2">复习、巩固、直到掌握</p>
      </div>
      <div class="wb__head-ops">
        <UiButton variant="ghost" size="sm" @click="settingsOpen = true">
          <UiIcon name="settings" :size="14" /> 复习设置
        </UiButton>
      </div>
    </header>
    <ReviewSettingsDialog v-model="settingsOpen" />

    <div class="wb__body" :class="{ 'is-detail-open': !!detail || !!noteDetail }">
      <div class="wb__side">
    <!-- 学情概览（原型 A3）：先看到掌握情况 -->
    <section class="surface-standard wb__overview">
      <div class="wb__overview-head">
        <span class="wb__overview-title">学情概览</span>
      </div>
      <div class="wb__overview-nums">
        <span class="wb__num"><b>{{ totalCount }}</b><i>错题</i></span>
        <span class="wb__num"><b class="is-due">{{ poolCount }}</b><i>待复习</i></span>
        <span class="wb__num"><b class="is-mastered">{{ masteredCount }}</b><i>已掌握</i></span>
      </div>
      <div class="wb__overview-bar"><i :style="{ width: masteryPct + '%' }" /></div>
      <span class="t-label">掌握度 {{ masteryPct }}%</span>
    </section>

    <!-- 自测练习入口横条（原型 A3，绿色）：自测只从本页进 -->
    <button type="button" class="wb__quiz-entry" :disabled="!poolCount" @click="startQuiz">
      <span class="wb__quiz-icon">✎</span>
      <span class="wb__quiz-main">
        <span class="wb__quiz-title">自测练习</span>
        <span class="t-label">{{ poolCount ? `今日待复习 ${poolCount} 道 · 按遗忘曲线出题` : '没有待复习的题，去拍题积累错题吧' }}</span>
      </span>
      <span class="wb__quiz-go">开始 →</span>
    </button>
      </div>

      <div class="wb__maincol">
    <!-- 筛选（桌面内联 / 移动抽屉） -->
    <div class="wb__filters">
      <button class="wb__filter-toggle" type="button" @click="filterOpen = !filterOpen">
        <UiIcon name="settings" :size="16" /> 筛选
        <span class="wb__filter-count" v-if="activeFilterCount">{{ activeFilterCount }}</span>
      </button>

      <div class="wb__filter-body" :class="{ 'is-open': filterOpen }">
        <select v-model="filters.course" class="wb__select">
          <option value="">全部课程</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}</option>
          <option :value="NONE_COURSE">未归类</option>
        </select>
        <select v-model="filters.point" class="wb__select">
          <option value="">全部知识点</option>
          <option v-for="p in points" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="filters.mastery" class="wb__select">
          <option value="all">全部掌握程度</option>
          <option value="learning">待复习</option>
          <option value="mastered">已掌握</option>
        </select>
      </div>
    </div>

    <!-- 列表 -->
    <UiEmptyState
      v-if="!filtered.length"
      :title="items.length ? '没有符合筛选的错题' : '还没有错题'"
      :description="items.length ? '换个筛选条件试试' : '拍一道题，讲解后点「保存到错题本」，就会出现在这里。'"
    >
      <template #action>
        <UiButton variant="primary" @click="$router.push(ROUTES.capture)">去拍题</UiButton>
      </template>
    </UiEmptyState>

    <template v-else>
      <template v-if="filteredQ.length">
        <div class="wb__group-title">题目 · {{ filteredQ.length }}</div>
        <div class="wb__grid">
          <button
            v-for="it in filteredQ"
            :key="it.id"
            type="button"
            class="wb__card surface-standard"
            @click="openDetail(it)"
          >
            <div class="wb__card-top">
              <UiTag v-if="subjectLabel(it)" variant="info">{{ subjectLabel(it) }}</UiTag>
              <UiTag :variant="it.mastered ? 'success' : 'warning'" level>
                {{ it.mastered ? '已掌握' : `复习中 ${it.streak || 0}/2` }}
              </UiTag>
            </div>
            <p class="wb__card-q"><MathText :content="it.question" /></p>
            <div class="wb__card-tags">
              <UiTag v-for="k in (it.knowledgePoints || []).slice(0, 3)" :key="k" variant="neutral">{{ k }}</UiTag>
            </div>
            <div class="wb__card-meta">
              <span v-if="it.diagnosis" class="wb__card-reason"><MathText :content="it.diagnosis" /></span>
              <span class="wb__card-time">{{ reviewText(it) }}</span>
            </div>
          </button>
        </div>
      </template>

      <template v-if="filteredNotes.length">
        <div class="wb__group-title">笔记 · 知识点 · {{ filteredNotes.length }}</div>
        <div class="wb__grid">
          <button
            v-for="nt in filteredNotes"
            :key="nt.id"
            type="button"
            class="wb__card wb__card--note surface-standard"
            @click="noteDetail = nt"
          >
            <div class="wb__card-top">
              <UiTag variant="brand-soft">笔记</UiTag>
              <UiTag v-if="nt.source" variant="neutral">{{ nt.source }}</UiTag>
            </div>
            <p class="wb__card-q">{{ nt.title }}</p>
            <p class="wb__card-q wb__card-q--sub">{{ noteSummary(nt.content) }}</p>
            <div class="wb__card-tags">
              <UiTag v-for="k in (nt.knowledgePoints || []).slice(0, 3)" :key="k" variant="neutral">{{ k }}</UiTag>
            </div>
          </button>
        </div>
      </template>
    </template>
      </div>
    </div>

    <!-- 笔记详情抽屉 -->
    <Transition name="wb-drawer">
      <div v-if="noteDetail" class="wb__drawer" role="dialog" aria-modal="true">
        <div class="wb__drawer-mask" @click="noteDetail = null" />
        <div class="wb__drawer-panel surface-elevated">
          <header class="wb__drawer-head">
            <div class="wb__drawer-tags">
              <UiTag variant="brand-soft">笔记</UiTag>
              <UiTag v-if="noteDetail.source" variant="neutral">{{ noteDetail.source }}</UiTag>
            </div>
            <button class="wb__drawer-close" type="button" aria-label="关闭" @click="noteDetail = null">
              <UiIcon name="close" :size="16" />
            </button>
          </header>
          <div class="wb__drawer-body">
            <section class="wb__block">
              <h3 class="wb__block-title">{{ noteDetail.title }}</h3>
              <p class="wb__note-content wb__pre"><MathText :content="noteDetail.content || '（无正文）'" /></p>
            </section>
            <section v-if="noteDetail.knowledgePoints && noteDetail.knowledgePoints.length" class="wb__block">
              <h4 class="wb__block-label">知识点</h4>
              <UiTag v-for="k in noteDetail.knowledgePoints" :key="k" variant="brand-soft">{{ k }}</UiTag>
            </section>
            <section class="wb__block">
              <UiButton variant="ghost" block @click="removeNote(noteDetail)">删除这条笔记</UiButton>
            </section>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 详情抽屉 -->
    <Transition name="wb-drawer">
      <div v-if="detail" class="wb__drawer" role="dialog" aria-modal="true">
        <div class="wb__drawer-mask" @click="detail = null" />
        <div class="wb__drawer-panel surface-elevated">
          <header class="wb__drawer-head">
            <div class="wb__drawer-tags">
              <UiTag v-if="subjectLabel(detail)" variant="info">{{ subjectLabel(detail) }}</UiTag>
              <UiTag :variant="detail.mastered ? 'success' : 'warning'" level>
                {{ detail.mastered ? '已掌握' : `复习中 ${detail.streak || 0}/2` }}
              </UiTag>
            </div>
            <button class="wb__drawer-close" type="button" aria-label="关闭" @click="detail = null">
              <UiIcon name="close" :size="16" />
            </button>
          </header>

          <div class="wb__drawer-body">
            <section class="wb__block">
              <p class="wb__block-title">原题</p>
              <MathText :content="detail.question" />
            </section>

            <section v-if="detail.answer" class="wb__block">
              <p class="wb__block-title">答案</p>
              <MathText :content="detail.answer" />
            </section>

            <section v-if="detail.steps && detail.steps.length" class="wb__block">
              <p class="wb__block-title">解题步骤</p>
              <div v-for="(s, i) in detail.steps" :key="i" class="wb__step">
                <div class="wb__step-title">{{ i + 1 }}. <MathText :content="s.title" /></div>
                <MathText :content="s.detail" />
              </div>
            </section>

            <section v-if="detail.diagnosis" class="wb__block">
              <p class="wb__block-title">错题原因</p>
              <p class="wb__reason">{{ detail.diagnosis }}</p>
            </section>

            <section v-if="detail.knowledgePoints && detail.knowledgePoints.length" class="wb__block">
              <p class="wb__block-title">知识点</p>
              <div class="wb__drawer-tags">
                <UiTag v-for="k in detail.knowledgePoints" :key="k" variant="brand-soft">{{ k }}</UiTag>
              </div>
            </section>
          </div>

          <footer class="wb__drawer-foot">
            <UiButton variant="ghost" size="sm" @click="reExplain(detail)">重新讲解</UiButton>
            <UiButton variant="ghost" size="sm" @click="openEdit">编辑</UiButton>
            <UiButton variant="ghost" size="sm" @click="redoOne(detail)">重做此题</UiButton>
            <UiButton variant="ghost" size="sm" @click="print(detail)">打印</UiButton>
            <UiButton variant="ghost" size="sm" @click="shareOpen = true">分享</UiButton>
            <UiButton variant="ghost" size="sm" class="wb__danger" @click="remove(detail)">删除</UiButton>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- 分享到社区 -->
    <ShareDialog v-model="shareOpen" :card="shareCard" />

    <!-- 编辑错题 -->
    <UiModal v-model="editOpen" title="编辑错题">
      <div class="wb__edit-form">
        <UiInput v-model="editForm.question" type="textarea" :rows="4" label="题干" />
        <UiInput v-model="editForm.answer" type="textarea" :rows="2" label="答案" />
        <UiInput v-model="editForm.knowledgePoints" label="知识点（逗号分隔）" placeholder="如：定积分, 牛顿-莱布尼茨公式" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="editOpen = false">取消</UiButton>
        <UiButton variant="primary" @click="saveEdit">保存</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiModal from '../ui/UiModal.vue'
import UiInput from '../ui/UiInput.vue'
import MathText from '../components/MathText.vue'
import { ROUTES, path } from '../lib/routes.js'
import ReviewSettingsDialog from '../components/ReviewSettingsDialog.vue'
import { bookRef, remove as removeItem, settingsRef, upsert } from '../stores/bookStore'
import { coursesRef } from '../stores/courseStore'
import { quizPool } from '../book.js'
import { courseNameOf } from '../lib/courseMatch.js'
import { reExplainText } from '../stores/flowStore'
import { toast } from '../ui/toast.js'
import { latexToPlain } from '../mathtext'
import { printHtml, renderMathToHtml } from '../lib/print.js'
import { esc } from '../lib/dom.js'
import ShareDialog from '../components/ShareDialog.vue'

const router = useRouter()
const route = useRoute()
const book = bookRef()
const detail = ref(null)
const filterOpen = ref(false)
const filters = ref({ course: '', point: '', mastery: 'all' })

/* 分享到社区 */
const shareOpen = ref(false)
const shareCard = computed(() => {
  const d = detail.value || {}
  return {
    question: d.question || '',
    answer: d.answer || '',
    steps: d.steps || [],
    knowledgePoints: d.knowledgePoints || [],
    subject: d.subject || '',
  }
})

const items = computed(() => book.value)
const reviewSettings = settingsRef() // 复习设置（SRS），组卷口径与设置对话框共用
const settingsOpen = ref(false)
const pool = computed(() => quizPool(book.value, reviewSettings.value))
const poolCount = computed(() => pool.value.length)

/* 学情概览（原型 A3）：笔记（kind='note'）不计入错题统计 */
const questionsAll = computed(() => book.value.filter((i) => i.kind !== 'note'))
const totalCount = computed(() => questionsAll.value.length)
const masteredCount = computed(() => questionsAll.value.filter((i) => i.mastered).length)
const masteryPct = computed(() => (totalCount.value ? Math.round((masteredCount.value / totalCount.value) * 100) : 0))

/* 课程筛选：选项来自用户课程表（courseStore）+「未归类」 */
const NONE_COURSE = '__none__'
const courses = computed(() => coursesRef().value)
const points = computed(() => [...new Set(book.value.flatMap((i) => i.knowledgePoints || []).filter(Boolean))])

const activeFilterCount = computed(() => [filters.value.course, filters.value.point, filters.value.mastery !== 'all'].filter(Boolean).length)

function _passCoursePoint(it) {
  if (filters.value.course === NONE_COURSE && it.courseId) return false
  if (filters.value.course && filters.value.course !== NONE_COURSE && it.courseId !== filters.value.course) return false
  if (filters.value.point && !(it.knowledgePoints || []).includes(filters.value.point)) return false
  return true
}

const filtered = computed(() => book.value.filter((it) => {
  if (!(_passCoursePoint(it))) return false
  if (filters.value.mastery === 'mastered' && !it.mastered) return false
  if (filters.value.mastery === 'learning' && it.mastered) return false
  return true
}))

/* 分组：题目走完整筛选（含掌握状态），笔记只按课程/知识点筛 */
const filteredQ = computed(() => filtered.value.filter((it) => it.kind !== 'note'))
const filteredNotes = computed(() => book.value.filter((it) => it.kind === 'note' && _passCoursePoint(it)))

const noteDetail = ref(null)
function noteSummary(text, n = 60) {
  const t = latexToPlain(String(text || '')).replace(/\s+/g, ' ').trim()
  return t ? (t.length > n ? t.slice(0, n) + '…' : t) : '查看全文'
}
function removeNote(nt) {
  removeItem(nt.id)
  noteDetail.value = null
  toast.success('已删除笔记')
}

/** 卡片科目标签：已归类显示课程名，未归类显示 AI 判的学科名（参考） */
function subjectLabel(it) {
  return courseNameOf(it, courses.value) || it.subject || ''
}

function reviewText(it) {
  if (!it.reviewAt) return it.createdAt ? '来源：拍题' : ''
  const d = new Date(it.reviewAt)
  if (Number.isNaN(d.getTime())) return ''
  const p = (x) => String(x).padStart(2, '0')
  return `${it.mastered ? '复习于' : '下次复习'} ${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function openDetail(it) {
  detail.value = it
}

function startQuiz() {
  router.push(path(ROUTES.practice, { mode: 'original' }))
}

function reExplain(it) {
  detail.value = null
  reExplainText(it.question, it.attempt || '')
  router.push('/q/' + it.id)
}

/* 编辑错题（题干 / 答案 / 知识点） */
const editOpen = ref(false)
const editForm = ref({ question: '', answer: '', knowledgePoints: '' })

function openEdit() {
  const d = detail.value || {}
  editForm.value = {
    question: d.question || '',
    answer: d.answer || '',
    knowledgePoints: (d.knowledgePoints || []).join(', '),
  }
  editOpen.value = true
}

function saveEdit() {
  const updated = {
    ...detail.value,
    question: editForm.value.question.trim(),
    answer: editForm.value.answer.trim(),
    knowledgePoints: editForm.value.knowledgePoints.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
  }
  if (!updated.question) {
    toast.error('题干不能为空')
    return
  }
  upsert(updated)
  detail.value = updated
  editOpen.value = false
  toast.success('已保存')
}

/* 重做此题：跳自测原题模式，只考这一题 */
function redoOne(it) {
  detail.value = null
  router.push(path(ROUTES.practice, { mode: 'original' }) + '?focus=' + it.id)
}

function remove(it) {
  detail.value = null
  removeItem(it.id)
  toast.success('已删除')
}

function print(it) {
  const sections = []
  if (it.question) sections.push({ label: '原题', html: renderMathToHtml(it.question) })
  if (it.answer) sections.push({ label: '答案', html: renderMathToHtml(it.answer) })
  if (it.steps && it.steps.length) {
    sections.push({
      label: '解题步骤',
      html: it.steps.map((s, i) => `<p>${i + 1}. ${esc(s.title || '')}</p>${renderMathToHtml(s.detail || '')}`).join(''),
    })
  }
  if (it.diagnosis) sections.push({ label: '错题原因', html: renderMathToHtml(it.diagnosis) })
  printHtml('知一 · 错题', sections)
}

// 深链 /wrongbook/:id → 直接打开该题详情
watch(
  () => route.params.id,
  (id) => {
    if (!id) return
    const hit = book.value.find((i) => String(i.id) === String(id))
    if (hit) detail.value = hit
  },
  { immediate: true },
)
</script>

<style scoped>
.wrongbook {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-wide);
}
.wb__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.wb__filters {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.wb__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  align-self: flex-start;
  padding: 8px 14px;
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.wb__filter-count {
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft-1);
  color: var(--primary-text-strong);
  font-size: var(--fs-label);
}
.wb__filter-body {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.wb__select {
  min-width: 140px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--surface-1);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
}
.wb__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-3);
}
.wb__card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4);
  text-align: left;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.wb__card:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}
.wb__card-top {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
/* 题干走 MathText（公式完整渲染）；截断交给行数限制，
   不再按字符截 —— 按字符会把 $...$ 公式拦腰截断成残废公式 */
.wb__card-q {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-secondary);
}
/* 公式里的行内块不能撑破 3 行容器 */
.wb__card-q :deep(.katex-display) {
  margin: 0;
}
.wb__card-tags {
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
}
.wb__card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
  font-size: var(--fs-label);
  color: var(--text-muted);
}
/* 诊断摘要：单行收紧（走 MathText，含公式时不再露 $ 定界符） */
.wb__card-reason {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
  min-width: 0;
}

/* 详情抽屉 */
.wb__drawer {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  justify-content: flex-end;
}
.wb__drawer-mask {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 10, 0.6);
}
.wb__drawer-panel {
  position: relative;
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
}
.wb__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: var(--border-divider-soft);
}
.wb__drawer-tags {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.wb__drawer-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-tertiary);
  cursor: pointer;
}
.wb__drawer-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.wb__drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.wb__block-title {
  font-size: var(--fs-label);
  color: var(--text-muted);
  letter-spacing: 0.2px;
  margin-bottom: var(--sp-2);
}
.wb__block {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.wb__step {
  padding: var(--sp-2) 0;
}
.wb__step-title {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  margin-bottom: var(--sp-1);
}
.wb__reason {
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--text-secondary);
}
.wb__drawer-foot {
  display: flex;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  border-top: var(--border-divider-soft);
}
.wb__danger {
  color: var(--error);
}
.wb__danger:hover {
  border-color: var(--error);
}

.wb-drawer-enter-active,
.wb-drawer-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.wb-drawer-enter-active .wb__drawer-panel,
.wb-drawer-leave-active .wb__drawer-panel {
  transition: transform var(--dur-slow) var(--ease-out);
}
.wb-drawer-enter-from,
.wb-drawer-leave-to {
  opacity: 0;
}
.wb-drawer-enter-from .wb__drawer-panel,
.wb-drawer-leave-to .wb__drawer-panel {
  transform: translateX(24px);
}

@media (max-width: 767px) {
  .wb__grid {
    grid-template-columns: 1fr;
  }
  .wb__filter-body {
    display: none;
  }
  .wb__filter-body.is-open {
    display: flex;
  }
}

/* 学情概览卡（原型 A3） */
.wb__overview {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
}
.wb__overview-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.wb__overview-title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.wb__overview-nums {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
}
.wb__num {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wb__num b {
  font-size: var(--fs-h2);
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
}
.wb__num b.is-due {
  color: color-mix(in srgb, #b5722a 55%, var(--text-primary));
}
.wb__num b.is-mastered {
  color: color-mix(in srgb, #4a7a63 55%, var(--text-primary));
}
.wb__num i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.wb__overview-bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.wb__overview-bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--primary);
  transition: width var(--dur) var(--ease);
}

/* 自测练习入口横条（原型 A3，绿色） */
.wb__quiz-entry {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 0.5px solid color-mix(in srgb, #4a7a63 45%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, #4a7a63 12%, var(--card, #fff));
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.wb__quiz-entry:hover:not(:disabled) {
  border-color: color-mix(in srgb, #4a7a63 70%, transparent);
}
.wb__quiz-entry:disabled {
  opacity: 0.55;
  cursor: default;
}
.wb__quiz-icon {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: #4a7a63;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.wb__quiz-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wb__quiz-title {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.wb__quiz-go {
  flex: none;
  font-size: var(--fs-body-2);
  color: color-mix(in srgb, #4a7a63 55%, var(--text-primary));
  white-space: nowrap;
}

/* 桌面两栏（工作台增强）：左=学情+自测入口，右=筛选+列表 */
.wb__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
@media (min-width: 768px) {
  .wb__body {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: var(--sp-5);
    align-items: start;
  }
  .wb__side {
    position: sticky;
    top: 80px;
  }
}
.wb__group-title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  margin: var(--sp-4) 0 var(--sp-3);
}
.wb__group-title:first-of-type {
  margin-top: 0;
}
.wb__card--note {
  text-align: left;
}
.wb__card-q--sub {
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.wb__note-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
}

/* ---------------- 桌面端（≥1024px）：列表常驻 + 右侧详情面板 ---------------- */
@media (min-width: 1024px) {
  .wrongbook {
    max-width: none;
  }
  /* 详情不再弹层遮罩：右侧常驻面板，切题时列表始终可见 */
  .wb__drawer {
    top: 58px;
    left: 232px;
    right: 0;
    bottom: 0;
    z-index: var(--z-sticky);
    animation: none;
  }
  .wb__drawer-mask {
    display: none;
  }
  .wb__drawer-panel {
    max-width: 460px;
    border-left: var(--border-divider-soft);
  }
  .wb__body.is-detail-open .wb__maincol {
    padding-right: 476px;
  }
}
</style>
