<template>
  <div class="zy-container zy-page wrongbook">
    <header class="wb__head">
      <div>
        <h1 class="t-h1">错题学习</h1>
        <p class="t-body-2">复习、巩固、直到掌握</p>
      </div>
      <div class="wb__head-ops">
        <!-- 复习设置：工具按钮 + 当前档位状态（2026-10-11） -->
        <button type="button" class="wb__tool" @click="settingsOpen = true">
          <span class="wb__tool-ic"><UiIcon name="settings" :size="14" /></span>
          <span>复习设置</span>
          <span class="wb__tool-st">{{ pace.label }} · {{ paceStatus }}</span>
        </button>
      </div>
    </header>
    <ReviewSettingsDialog v-model="settingsOpen" />

    <div class="wb__body" :class="{ 'is-detail-open': !!detail || !!noteDetail }">
      <div class="wb__side">
    <!-- 学情概览（原型 A3）：先看到掌握情况；2026-10-11 三个数字可点即筛 -->
    <section class="surface-standard wb__overview">
      <div class="wb__overview-head">
        <span class="wb__overview-title">学情概览</span>
      </div>
      <div class="wb__overview-nums">
        <button type="button" class="wb__num" :class="{ 'is-on': filters.mastery === 'all' }"
                @click="setMastery('all')"><b>{{ totalCount }}</b><i>错题</i></button>
        <button type="button" class="wb__num" :class="{ 'is-on': filters.mastery === 'learning' }"
                @click="setMastery('learning')"><b class="is-due">{{ poolCount }}</b><i>待巩固</i></button>
        <button type="button" class="wb__num" :class="{ 'is-on': filters.mastery === 'mastered' }"
                @click="setMastery('mastered')"><b class="is-mastered">{{ masteredCount }}</b><i>已掌握</i></button>
      </div>
      <div class="wb__overview-bar"><i :style="{ width: masteryPct + '%' }" /></div>
      <span class="t-label">掌握度 {{ masteryPct }}% · 点上方数字可直接筛选</span>
    </section>

    <!-- 自测练习入口横条（原型 A3，绿色）：自测只从本页进 -->
    <button type="button" class="wb__quiz-entry" :disabled="!poolCount" @click="startQuiz">
      <span class="wb__quiz-icon">✎</span>
      <span class="wb__quiz-main">
        <span class="wb__quiz-title">自测练习</span>
        <span class="t-label">{{ poolCount ? `待巩固 ${poolCount} 道 · 按复习节奏出题` : '没有待巩固的题，去拍题积累错题吧' }}</span>
      </span>
      <span class="wb__quiz-go">开始 →</span>
    </button>
      </div>

      <div class="wb__maincol">
    <!-- 筛选（2026-10-11：原生 select → 常驻自定义下拉，带计数徽标） -->
    <div class="wb__filters">
      <div class="wb__dd">
        <button type="button" class="wb__dd-btn" :class="{ 'is-on': !!filters.course }" @click.stop="toggleDd('course')">
          <span>{{ courseLabel }}</span><i class="wb__dd-ar">▾</i>
        </button>
        <div v-if="ddOpen === 'course'" class="wb__dd-menu" @click.stop>
          <button type="button" :class="{ 'is-on': !filters.course }" @click="pickCourse('')">全部课程</button>
          <button v-for="c in courses" :key="c.id" type="button" :class="{ 'is-on': filters.course === c.id }"
                  @click="pickCourse(c.id)">{{ c.name }}</button>
          <button type="button" :class="{ 'is-on': filters.course === NONE_COURSE }"
                  @click="pickCourse(NONE_COURSE)">未归类</button>
        </div>
      </div>

      <div class="wb__dd">
        <button type="button" class="wb__dd-btn" :class="{ 'is-on': !!filters.point }" @click.stop="toggleDd('point')">
          <span>{{ filters.point || '全部知识点' }}</span><i class="wb__dd-ar">▾</i>
        </button>
        <div v-if="ddOpen === 'point'" class="wb__dd-menu" @click.stop>
          <button type="button" :class="{ 'is-on': !filters.point }" @click="pickPoint('')">全部知识点</button>
          <button v-for="p in points" :key="p" type="button" :class="{ 'is-on': filters.point === p }"
                  @click="pickPoint(p)">{{ p }}</button>
        </div>
      </div>

      <div class="wb__dd">
        <button type="button" class="wb__dd-btn" :class="{ 'is-on': filters.mastery !== 'all' }" @click.stop="toggleDd('mastery')">
          <span>{{ masteryLabel }}</span>
          <span v-if="poolCount" class="wb__dd-cnt">{{ poolCount }}</span>
          <i class="wb__dd-ar">▾</i>
        </button>
        <div v-if="ddOpen === 'mastery'" class="wb__dd-menu" @click.stop>
          <button type="button" :class="{ 'is-on': filters.mastery === 'all' }" @click="pickMastery('all')">全部掌握程度</button>
          <button type="button" :class="{ 'is-on': filters.mastery === 'learning' }" @click="pickMastery('learning')">待巩固（{{ poolCount }}）</button>
          <button type="button" :class="{ 'is-on': filters.mastery === 'mastered' }" @click="pickMastery('mastered')">已掌握（{{ masteredCount }}）</button>
        </div>
      </div>

      <span class="wb__fcount">共 {{ filteredQ.length }} 题 · 按到期时间排序</span>
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
          <!-- 2026-10-11：卡片改 div（内层要有真按钮，button 不能嵌套）+ 状态色条 + 底部快捷操作 -->
          <div
            v-for="it in filteredQ"
            :key="it.id"
            class="wb__card"
            :class="`is-${cardTone(it)}`"
            role="button"
            tabindex="0"
            @click="openDetail(it)"
            @keydown.enter.prevent="openDetail(it)"
          >
            <div class="wb__card-body">
              <div class="wb__card-top">
                <span v-if="subjectLabel(it)" class="wb__ctag">{{ subjectLabel(it) }}</span>
                <span class="wb__cpill" :class="`is-${cardTone(it)}`">
                  {{ it.mastered ? '已掌握' : `连对 ${it.streak || 0}/2` }}
                </span>
                <span class="wb__cdue" :class="cardTone(it) === 'due' ? 'is-today' : (it.mastered ? 'is-ok' : 'is-wait')">
                  {{ dueText(it) }}
                </span>
              </div>
              <p class="wb__card-q"><MathText :content="it.question" /></p>
              <!-- 知识点行固定占位（最多 3 个）：无标签时保留行高，保证卡片等高 -->
              <div class="wb__card-tags">
                <span v-for="k in (it.knowledgePoints || []).slice(0, 3)" :key="k" class="wb__ckp">{{ k }}</span>
              </div>
              <div class="wb__card-meta">
                <span v-if="it.diagnosis" class="wb__card-reason"><MathText :content="it.diagnosis" /></span>
                <span class="wb__card-time">{{ reviewText(it) }}</span>
              </div>
            </div>
            <div class="wb__card-ops" @click.stop>
              <button type="button" class="wb__op is-pri" @click="redoOne(it)">{{ it.mastered ? '再练一遍' : '重做此题' }}</button>
              <button type="button" class="wb__op" @click="reExplain(it)">重新讲解</button>
              <button type="button" class="wb__op is-danger" @click="askRemove(it)">删除</button>
            </div>
          </div>
        </div>
      </template>

      <template v-if="filteredNotes.length">
        <div class="wb__group-title">笔记 · 知识点 · {{ filteredNotes.length }}</div>
        <div class="wb__grid">
          <div
            v-for="nt in filteredNotes"
            :key="nt.id"
            class="wb__card wb__card--note"
            role="button"
            tabindex="0"
            @click="noteDetail = nt"
            @keydown.enter.prevent="noteDetail = nt"
          >
            <div class="wb__card-body">
              <div class="wb__card-top">
                <span class="wb__ctag is-note">笔记</span>
                <span v-if="nt.source" class="wb__cpill">{{ nt.source }}</span>
              </div>
              <p class="wb__card-q wb__card-q--title">{{ nt.title }}</p>
              <p class="wb__card-q wb__card-q--sub">{{ noteSummary(nt.content) }}</p>
              <div class="wb__card-tags">
                <span v-for="k in (nt.knowledgePoints || []).slice(0, 3)" :key="k" class="wb__ckp">{{ k }}</span>
              </div>
            </div>
          </div>
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
                {{ detail.mastered ? '已掌握' : `连对 ${detail.streak || 0}/2` }}
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

            <!-- 复习计划（2026-10-11 新增）：把「复习中 x/2」翻译成人话 -->
            <section class="wb__block">
              <p class="wb__block-title">复习计划</p>
              <div class="wb__plan">
                <div class="wb__plan-row">
                  <span class="wb__plan-lab">掌握进度</span>
                  <span class="wb__plan-dots">
                    <i v-for="n in 2" :key="n" :class="{ 'is-on': (detail.streak || 0) >= n }" />
                  </span>
                  <span class="wb__plan-txt">
                    {{ detail.mastered ? '已掌握（可随时再练一遍）'
                      : `已连续答对 ${detail.streak || 0} 次，再答对 ${2 - Math.min(detail.streak || 0, 2)} 次即掌握` }}
                  </span>
                </div>
                <div class="wb__plan-row">
                  <span class="wb__plan-lab">下次回炉</span>
                  <span class="wb__plan-txt">{{ planNextText }}</span>
                </div>
                <div class="wb__plan-row">
                  <span class="wb__plan-lab">当前间隔</span>
                  <span class="wb__plan-txt">{{ planIntervalText }}</span>
                </div>
                <p class="wb__plan-note">连对 2 次即标记已掌握、之后不再自动回炉；答错则清零、当天就能再练。</p>
              </div>
            </section>

            <section v-if="detail.knowledgePoints && detail.knowledgePoints.length" class="wb__block">
              <p class="wb__block-title">知识点</p>
              <div class="wb__drawer-tags">
                <UiTag v-for="k in detail.knowledgePoints" :key="k" variant="brand-soft">{{ k }}</UiTag>
              </div>
            </section>
          </div>

          <footer class="wb__drawer-foot">
            <UiButton variant="primary" size="sm" @click="redoOne(detail)">重做此题</UiButton>
            <UiButton variant="ghost" size="sm" @click="reExplain(detail)">重新讲解</UiButton>
            <UiButton variant="ghost" size="sm" @click="openEdit">编辑</UiButton>
            <UiButton variant="ghost" size="sm" @click="print(detail)">打印</UiButton>
            <UiButton variant="ghost" size="sm" @click="shareOpen = true">分享</UiButton>
            <UiButton variant="ghost" size="sm" class="wb__danger wb__foot-del" @click="askRemove(detail)">删除</UiButton>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- 删除确认（2026-10-11：卡片/抽屉共用，避免误删） -->
    <UiModal :model-value="!!removeTarget" title="删除这道错题？" size="sm" z-index="var(--z-confirm)"
             @update:model-value="(v) => { if (!v) removeTarget = null }">
      <div v-if="removeTarget" class="wb__del">
        <p class="wb__del-desc">
          「{{ removeQuestionBrief }}」会从错题本移除，复习进度与自测记录一起清掉。
        </p>
        <p class="wb__del-warn">删除后无法恢复；如果只是想暂时不复习，可以直接练到「已掌握」。</p>
        <div class="wb__del-ops">
          <UiButton variant="ghost" @click="removeTarget = null">取消</UiButton>
          <button type="button" class="wb__del-btn" @click="confirmRemove">确认删除</button>
        </div>
      </div>
    </UiModal>

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
  <!-- 新手教程 -->
  <UiTour v-model="tourOpen" tour-key="wrongbook" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiTour from '../ui/UiTour.vue'
import { useTour } from '../lib/useTour.js'
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
import { paceOf, quizPool } from '../book.js'
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
const filters = ref({ course: '', point: '', mastery: 'all' })

/* ---------------- 筛选：下拉常驻 + 概览数字可点（2026-10-11） ---------------- */
const ddOpen = ref('')            // 当前展开的下拉：course / point / mastery / ''
function toggleDd(k) { ddOpen.value = ddOpen.value === k ? '' : k }
function closeDd() { ddOpen.value = '' }
onMounted(() => document.addEventListener('click', closeDd))
onUnmounted(() => document.removeEventListener('click', closeDd))

const NONE_COURSE = '__none__'
const courses = computed(() => coursesRef().value)

const courseLabel = computed(() => {
  if (!filters.value.course) return '全部课程'
  if (filters.value.course === NONE_COURSE) return '未归类'
  return courses.value.find((c) => c.id === filters.value.course)?.name || '全部课程'
})
const masteryLabel = computed(() => ({
  all: '全部掌握程度', learning: '待巩固', mastered: '已掌握',
}[filters.value.mastery] || '全部掌握程度'))

function setMastery(v) {
  filters.value = { ...filters.value, mastery: v }
  ddOpen.value = ''
}
function pickCourse(id) { filters.value = { ...filters.value, course: id }; closeDd() }
function pickPoint(p) { filters.value = { ...filters.value, point: p }; closeDd() }
function pickMastery(v) { filters.value = { ...filters.value, mastery: v }; closeDd() }

/* 卡片状态：due（今天该复习/逾期）/ learning（复习中）/ ok（已掌握） */
const NOW = () => Date.now()
function isDue(it) {
  if (it.mastered || it.kind === 'note') return false
  return !it.reviewAt || it.reviewAt <= NOW()
}
function cardTone(it) {
  if (it.mastered) return 'ok'
  return isDue(it) ? 'due' : 'learning'
}
/** 卡片时机文案（2026-10-11）：去掉"逾期/欠题"语气——已掌握不再排期 */
function dueText(it) {
  if (it.mastered) return '不再自动回炉 · 可随时再练'
  if (!it.reviewAt || it.reviewAt <= NOW()) return '今天可以练'
  const days = Math.ceil((it.reviewAt - NOW()) / 86400000)
  return days <= 1 ? '明天回炉' : `${days} 天后回炉`
}
/** 到期早的排前面（逾期越久越靠前），其次是复习中的，已掌握垫底 */
function sortByDue(list) {
  const rank = (it) => (it.mastered ? 2 : isDue(it) ? 0 : 1)
  return [...list].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r) return r
    const ra = Number(a.reviewAt) || 0
    const rb = Number(b.reviewAt) || 0
    return ra - rb
  })
}

/* 详情抽屉：复习计划文案（口径与 book.js 的 SRS 一致：连对 2 次即掌握） */
const planNextText = computed(() => {
  const d = detail.value || {}
  if (d.mastered) return '不再自动回炉（可随时再练）'
  if (!d.reviewAt) return '今天可以练'
  const ts = Number(d.reviewAt)
  if (ts <= Date.now()) return '今天可以练（已到回炉时间）'
  const days = Math.ceil((ts - Date.now()) / 86400000)
  return `${fmtDate(ts)}（${days} 天后）`
})
const planIntervalText = computed(() => {
  const d = detail.value || {}
  const rep = Number(d.repetitions) || 0
  if (!rep) return '还没开始（首次答对后按所选节奏回炉）'
  return `${Number(d.interval) || 1} 天（答对后隔这么久再考你一次）`
})
function fmtDate(ts) {
  const dt = new Date(Number(ts))
  if (Number.isNaN(dt.getTime())) return '—'
  const p = (x) => String(x).padStart(2, '0')
  return `${dt.getMonth() + 1}/${dt.getDate()} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/* 删除确认 */
const removeTarget = ref(null)
const removeQuestionBrief = computed(() => {
  const t = latexToPlain(String((removeTarget.value || {}).question || '这道题')).replace(/\s+/g, ' ').trim()
  return t.length > 24 ? `${t.slice(0, 24)}…` : t
})
function askRemove(it) { removeTarget.value = it }
function confirmRemove() {
  const it = removeTarget.value
  removeTarget.value = null
  if (!it) return
  remove(it)
}

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
const reviewSettings = settingsRef() // 复习设置（节奏档位），组卷口径与设置对话框共用
/** 当前复习节奏档位（按钮上直接显示状态，不用点进去看） */
const pace = computed(() => paceOf(reviewSettings.value))
const paceStatus = computed(() => (pace.value.days > 0 ? `${pace.value.days} 天后回炉` : '当天回炉'))
const settingsOpen = ref(false)
const pool = computed(() => quizPool(book.value, reviewSettings.value))
const poolCount = computed(() => pool.value.length)

/* 学情概览（原型 A3）：笔记（kind='note'）不计入错题统计 */
const questionsAll = computed(() => book.value.filter((i) => i.kind !== 'note'))
const totalCount = computed(() => questionsAll.value.length)
const masteredCount = computed(() => questionsAll.value.filter((i) => i.mastered).length)
const masteryPct = computed(() => (totalCount.value ? Math.round((masteredCount.value / totalCount.value) * 100) : 0))

/* 课程筛选选项来自课程表（courseStore）；points 见上方筛选区块 */
const points = computed(() => [...new Set(book.value.flatMap((i) => i.knowledgePoints || []).filter(Boolean))])

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
const filteredQ = computed(() => sortByDue(filtered.value.filter((it) => it.kind !== 'note')))
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

/**
 * 卡片副信息（2026-10-11 改版）：不再显示"下次复习 + 日期"这类欠债语气，
 * 回炉时间已由右上角标签表达（今天可以练 / 明天回炉 / 已掌握），这里只放客观事实。
 */
function reviewText(it) {
  const n = Number(it.quizCount) || 0
  if (!n) return it.createdAt ? '还没练过' : ''
  return `练过 ${n} 次`
}

function openDetail(it) {
  detail.value = it
}

function startQuiz() {
  // 带上来路与筛选上下文：自测页据此显示「从错题学习进入 · 待复习 3 道」并给返回入口
  const q = { from: 'wrongbook', f: filters.value.mastery }
  if (filters.value.point) q.point = filters.value.point
  router.push({ path: path(ROUTES.practice, { mode: 'original' }), query: q })
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
  router.push(path(ROUTES.practice, { mode: 'original' }) + '?focus=' + it.id + '&from=wrongbook')
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

/* 新手教程：首次进入本页自动弹（看过不再弹） */
const { tourOpen } = useTour('wrongbook')

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
/* 复习设置工具按钮（2026-10-11）：与 AI 课堂顶部同款规格 + 档位状态 */
.wb__tool {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: var(--border-subtle);
  background: var(--surface-1);
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease);
}
.wb__tool:hover { border-color: var(--primary-line); }
.wb__tool-ic {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  flex: none;
  display: grid;
  place-items: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.wb__tool-st { font-size: var(--fs-label); font-weight: 400; color: var(--text-muted); }

/* 筛选：常驻自定义下拉（2026-10-11 替换原生 select） */
.wb__filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.wb__dd { position: relative; }
.wb__dd-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.wb__dd-btn:hover { border-color: var(--primary-line); }
.wb__dd-btn.is-on {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
  color: var(--primary-text);
}
.wb__dd-cnt {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  border-radius: var(--radius-pill);
  padding: 1px 6px;
}
.wb__dd-ar { font-style: normal; color: var(--text-disabled); font-size: 10px; }
.wb__dd-menu {
  position: absolute;
  left: 0;
  top: 38px;
  z-index: 6;
  min-width: 168px;
  max-height: 280px;
  overflow: auto;
  padding: 5px;
  border-radius: 11px;
  border: var(--border-subtle);
  background: var(--surface-1);
  box-shadow: var(--shadow-elevated);
}
.wb__dd-menu button {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}
.wb__dd-menu button:hover { background: var(--primary-soft-3); }
.wb__dd-menu button.is-on { color: var(--primary-text); font-weight: 600; }
.wb__fcount { margin-left: auto; font-size: var(--fs-label); color: var(--text-muted); }

.wb__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--sp-3);
  /* 去掉 align-items:start：同一行卡片拉伸等高（2026-10-12 卡片统一高度） */
}
/* 卡片：状态色条 + 底部常驻操作（2026-10-11） */
.wb__card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%; /* 配合网格 stretch：同行卡片严格等高 */
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  background: var(--surface-1);
  box-shadow: var(--shadow-subtle);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.wb__card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--wb-strip, var(--surface-unit));
}
.wb__card.is-due { --wb-strip: #d0762a; }
.wb__card.is-learning { --wb-strip: var(--primary); }
.wb__card.is-ok { --wb-strip: #3f9c62; }
.wb__card:hover { transform: translateY(-1px); border-color: var(--primary-line); }
.wb__card-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  flex: 1; /* 撑开中部，让底部操作栏贴底 */
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
}
.wb__card-ops {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-top: var(--border-divider-soft);
  background: var(--surface-recess);
}
.wb__op {
  padding: 6px 11px;
  border-radius: 9px;
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--primary-text);
  font-family: inherit;
  font-size: var(--fs-label);
  font-weight: 600;
  cursor: pointer;
}
.wb__op:hover { border-color: var(--primary-line); }
.wb__op.is-pri {
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
}
.wb__op.is-danger {
  margin-left: auto;
  color: #c9503a;
  border-color: rgba(201, 80, 58, 0.3);
  font-weight: 400;
}
.wb__op.is-danger:hover { background: rgba(201, 80, 58, 0.06); }
.wb__card-top {
  display: flex;
  align-items: center;
  gap: 7px;
}
.wb__ctag {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  color: var(--primary-text);
  background: var(--primary-soft-3);
  border: 0.5px solid var(--primary-line);
  white-space: nowrap;
}
.wb__cpill {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  color: var(--text-tertiary);
  background: var(--surface-unit);
  border: 0.5px solid var(--border-subtle);
}
.wb__cpill.is-due { color: #a2571c; background: rgba(208, 118, 42, 0.1); border-color: rgba(208, 118, 42, 0.3); }
.wb__cpill.is-ok { color: #2f7a4d; background: rgba(63, 156, 98, 0.1); border-color: rgba(63, 156, 98, 0.3); }
.wb__cdue {
  margin-left: auto;
  font-size: 11px;
  white-space: nowrap;
}
.wb__cdue.is-today { color: #d0762a; font-weight: 700; }
.wb__cdue.is-wait { color: var(--text-muted); }
.wb__cdue.is-ok { color: #3f9c62; }
/* 题干走 MathText（公式完整渲染）；截断交给行数限制，
   不再按字符截 —— 按字符会把 $...$ 公式拦腰截断成残废公式。
   2026-10-12：加固定 3 行占位，短题也撑满 → 所有卡片等高 */
.wb__card-q {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  height: calc(var(--lh-relaxed) * 3em); /* 固定 3 行高：公式行略超高也被裁齐 */
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-secondary);
}
/* 公式里的行内块不能撑破 3 行容器 */
.wb__card-q :deep(.katex-display) {
  margin: 0;
}
.wb__ckp {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 7px;
  color: var(--primary-text);
  background: var(--primary-soft-3);
  border: 0.5px solid var(--primary-line);
}
.wb__card-tags {
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
  align-content: flex-start;
  min-height: 23px; /* 固定占一行（与标签实际高度一致）：无标签的卡也保留该行 */
}
.wb__card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  flex-wrap: nowrap; /* 禁止折行：诊断长文收缩、时间不换行 → meta 恒单行 */
  height: 20px; /* 固定单行高（time 文本继承 body 行高会撑到 22px） */
  line-height: 20px;
  margin-top: var(--sp-1);
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.wb__card-time {
  flex: none;
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
.wb__plan {
  display: grid;
  gap: 9px;
  padding: 12px 13px;
  border-radius: 12px;
  border: 0.5px solid var(--primary-line);
  background: var(--primary-soft-3);
}
.wb__plan-row { display: flex; align-items: center; gap: 10px; font-size: var(--fs-body-2); color: var(--text-secondary); }
.wb__plan-lab { flex: none; width: 62px; color: var(--text-tertiary); font-size: var(--fs-label); }
.wb__plan-dots { display: flex; gap: 4px; }
.wb__plan-dots i { width: 14px; height: 14px; border-radius: 5px; display: block; background: var(--primary-soft-1); }
.wb__plan-dots i.is-on { background: linear-gradient(135deg, #7c5cff, #5b47d6); }
.wb__plan-txt { min-width: 0; }
.wb__plan-note { font-size: var(--fs-label); color: var(--text-muted); line-height: 1.6; }
.wb__foot-del { margin-left: auto; }
.wb__del { display: grid; gap: 10px; }
.wb__del-desc { font-size: var(--fs-body-2); color: var(--text-secondary); line-height: 1.7; }
.wb__del-warn {
  font-size: var(--fs-label);
  color: #8f3a2b;
  line-height: 1.7;
  background: rgba(201, 80, 58, 0.07);
  border: 0.5px solid rgba(201, 80, 58, 0.22);
  border-radius: 10px;
  padding: 9px 11px;
}
.wb__del-ops { display: flex; justify-content: flex-end; gap: 10px; margin-top: 2px; }
.wb__del-btn {
  padding: 9px 18px;
  border-radius: 10px;
  border: 0;
  color: #fff;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #d76b56, #c9503a);
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
  /* 2026-10-11：三个数字无框化（外层已是卡片，避免卡片套卡片） */
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.wb__num {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: 0;
  border-radius: 10px;
  background: none;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.wb__num + .wb__num::before {
  content: "";
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: var(--border-subtle);
}
.wb__num:hover { background: var(--primary-soft-3); }
.wb__num.is-on { background: var(--primary-soft-2); }
.wb__num.is-on b { color: var(--primary-text); }
.wb__num.is-on i { color: var(--primary-text); }
.wb__num b {
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--text-primary);
}
.wb__num b.is-due { color: #d0762a; }
.wb__num b.is-mastered { color: #3f9c62; }
.wb__num i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-muted);
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
/* 笔记卡标题固定 2 行（与题目卡等高策略一致） */
.wb__card-q--title {
  -webkit-line-clamp: 2;
  line-clamp: 2;
  min-height: calc(var(--lh-relaxed) * 2em);
}
.wb__card-q--sub {
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  -webkit-line-clamp: 1;
  line-clamp: 1;
  min-height: calc(var(--lh-relaxed) * 1em);
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
