<template>
  <div class="zy-container zy-page report">
    <header class="report__head">
      <div class="report__head-main">
        <UiButton variant="soft" size="sm" class="zy-back" @click="goBackSmart($router)" icon="left">返回</UiButton>
        <h1 class="t-h1">AI 学情报告</h1>
        <p class="t-body-2">基于你的错题本、学习记录与 AI 课堂进度自动生成</p>
      </div>
      <div class="report__head-ops">
        <UiButton v-if="ov.total" variant="ghost" size="sm" icon="printer" @click="printReport">打印报告</UiButton>
      </div>
    </header>

    <!-- 薄弱点专项练习（与学习数据页同款） -->
    <WeakPointPractice
      v-model:open="practiceOpen"
      :point="practicePoint"
      :ref-items="practiceRefs"
    />

    <!-- ① 已掌握总结（规则计算，免费即时） -->
    <section class="surface-standard report__block">
      <h2 class="t-h3 report__block-title">
        <span class="report__block-icon"><UiIcon name="data" :size="15" /></span>
        已掌握总结
        <span class="t-label">自动计算，无需等待</span>
      </h2>
      <template v-if="ov.total">
        <div class="report__metrics">
          <div v-for="m in metrics" :key="m.label" class="report__metric" :class="`is-${m.tone}`">
            <span class="report__metric-icon"><UiIcon :name="m.icon" :size="15" /></span>
            <b>{{ m.value }}</b>
            <i>{{ m.label }}</i>
          </div>
        </div>
        <div v-if="ov.bestPoints.length" class="report__best">
          <span class="t-label">掌握最好的知识点</span>
          <span v-for="p in ov.bestPoints" :key="p.name" class="report__best-chip">
            {{ p.name }} <b>{{ p.rate }}%</b>
          </span>
        </div>
      </template>
      <template v-else>
        <p class="t-body-2">还没有错题数据，报告从你拍下第一道题开始积累。</p>
        <UiButton variant="primary" size="sm" @click="$router.push(ROUTES.capture)">去拍第一道题</UiButton>
      </template>
    </section>

    <!-- ② 薄弱点与 AI 建议（点击才生成，24h 缓存） -->
    <section class="surface-standard report__block">
      <div class="report__block-head">
        <h2 class="t-h3 report__block-title">
          <span class="report__block-icon"><UiIcon name="sparkle" :size="15" /></span>
          薄弱点与 AI 建议
          <span class="t-label">点击才生成 · 24 小时内复用</span>
        </h2>
        <UiButton variant="primary" size="sm" :loading="adviceLoading" :disabled="!ov.total" @click="genAdvice">
          {{ advice ? '重新生成' : '生成建议' }}
        </UiButton>
      </div>

      <p v-if="!ov.total" class="t-body-2">先拍几道题、存进错题本，这里就能给出针对性建议。</p>
      <p v-else-if="adviceErr" class="t-label report__advice-err">{{ adviceErr }}</p>
      <p v-else-if="!advice" class="t-body-2">会把错题本的聚合摘要（知识点、练习次数、正确率）发给模型，不传题目全文；生成一次约几秒。</p>

      <template v-else>
        <p class="t-body report__advice-summary"><MathText :content="advice.summary" /></p>
        <div v-if="advice.weak_points && advice.weak_points.length" class="report__advice-list">
          <div v-for="(w, i) in advice.weak_points" :key="w.name" class="report__advice-item">
            <div class="report__advice-head">
              <span class="report__advice-name">
                <span class="report__advice-no">{{ i + 1 }}</span>
                {{ w.name }}
              </span>
              <button type="button" class="report__practice" @click="openPractice(w)">
                <span class="report__practice-ic"><UiIcon name="play" :size="11" /></span>
                练一组
              </button>
            </div>
            <p class="report__advice-advice">→ <MathText :content="w.advice" /></p>
          </div>
        </div>
        <p class="t-label report__advice-meta">
          {{ advice.cached ? '来自缓存' : '本次新生成' }}<template v-if="advice.generatedAt"> · {{ timeAgo(advice.generatedAt) }}</template>
          <template v-if="advice.demo"> · 演示数据（未配置模型 Key）</template>
        </p>
      </template>
    </section>

    <!-- ③ 接下来往哪学（AI 课堂进度推算） -->
    <section class="surface-standard report__block">
      <h2 class="t-h3 report__block-title">
        <span class="report__block-icon"><UiIcon name="play" :size="15" /></span>
        接下来往哪学
        <span class="t-label">来自 AI 课堂的学习进度</span>
      </h2>

      <template v-if="next">
        <div class="report__next">
          <b>《{{ next.subject }}》学到 {{ next.chapterNo }}/{{ next.chapterTotal }} 章 · {{ next.current }}</b>
          <div class="report__progress"><i :style="{ width: nextPct + '%' }" /></div>
          <p v-if="next.nextName">下一章：{{ next.nextName }}</p>
          <p v-else-if="next.finished">这门课已经学完，可以开一门新的一起了</p>
          <p v-else>本章还剩 {{ next.restInChapter }} 节，学完做章末测试再进下一章</p>
          <UiButton variant="primary" size="sm" @click="goTeacher">去 AI 课堂继续学 →</UiButton>
        </div>
      </template>
      <template v-else-if="nextLoading">
        <p class="t-body-2">正在读取你的学习进度…</p>
      </template>
      <template v-else>
        <p class="t-body-2">还没有在 AI 课堂开过课——选一门正在学的课，AI 老师会按章节带你学。</p>
        <UiButton variant="primary" size="sm" @click="goTeacher">去 AI 课堂开一门课</UiButton>
      </template>
    </section>

    <!-- 引导：没填课表时提示完善（学情报告不含课表数据，但建议入口需要） -->
    <section v-if="!hasTable" class="report__guide surface-standard">
      <div>
        <b>完善课程表，让建议更贴合你的安排</b>
        <p>填好本周课表后，「今日学习建议」能结合你的课程时间给出安排。</p>
      </div>
      <UiButton variant="primary" size="sm" @click="$router.push(ROUTES.timetable)">去完善课表</UiButton>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MathText from '../components/MathText.vue'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import WeakPointPractice from '../components/WeakPointPractice.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import { getOverview, getMasteryByPoint, analyzeWeakPoints } from '../book.js'
import { bookRef } from '../stores/bookStore'
import { coursesRef, timetableRef } from '../stores/courseStore'
import { reportOverview, nextChapterOf } from '../lib/reportStats.js'
import { analyzeStudy } from '../lib/adapter/analyze.js'
import { printHtml, renderMathToHtml } from '../lib/print.js'
import { esc } from '../lib/dom.js'
import { api } from '../api'

const router = useRouter()

const book = bookRef()
const ov = computed(() => reportOverview(book.value, getMasteryByPoint(book.value)))
const overview = computed(() => getOverview(book.value))
const quizAccuracy = computed(() => Number(overview.value.accuracy) || 0)

/** ① 指标卡（图标 + 语义色，与学习数据页概览卡一致） */
const metrics = computed(() => [
  { label: '累计错题', value: ov.value.total, icon: 'book', tone: 'purple' },
  { label: '已掌握', value: ov.value.mastered, icon: 'check', tone: 'green' },
  { label: '掌握率', value: `${ov.value.rate}%`, icon: 'target', tone: 'amber' },
  { label: '自测正确率', value: `${quizAccuracy.value}%`, icon: 'sparkle', tone: 'blue' },
])

/* ---- 薄弱点专项练习（与学习数据页同款） ---- */
const practiceOpen = ref(false)
const practicePoint = ref('')
const practiceRefs = ref([])
function openPractice(w) {
  practicePoint.value = String(w.name || '')
  practiceRefs.value = (book.value || [])
    .filter((it) => Array.isArray(it.knowledgePoints) && it.knowledgePoints.includes(w.name))
    .slice(0, 2)
  practiceOpen.value = true
}
const hasTable = computed(() => {
  const t = timetableRef().value
  return Array.isArray(t) && t.length > 0 && (coursesRef().value || []).length > 0
})

/* ---- ② AI 建议（与学习数据页同款逻辑：聚合摘要 + 样例题，点击才生成） ---- */
const advice = ref(null)
const adviceLoading = ref(false)
const adviceErr = ref('')

function adviceSummary() {
  const o = overview.value
  const pts = getMasteryByPoint(book.value)
  const weak = analyzeWeakPoints(book.value) || []
  return {
    total: o.total, mastered: o.mastered, accuracy: o.accuracy,
    points: pts.slice(0, 12).map((p) => ({ name: p.name, quiz: p.quiz })),
    reasons: [],
    weak_names: weak.slice(0, 5).map((w) => w.name),
  }
}
function adviceSamples() {
  return (book.value || [])
    .filter((it) => it && it.kind !== 'note' && !it.mastered)
    .slice(0, 5)
    .map((it) => String(it.question || '').slice(0, 120))
}
async function genAdvice() {
  if (adviceLoading.value) return
  adviceLoading.value = true
  adviceErr.value = ''
  try {
    advice.value = await analyzeStudy({ summary: adviceSummary(), samples: adviceSamples() })
  } catch (e) {
    adviceErr.value = '生成失败：' + (e.message || '请稍后重试')
  } finally {
    adviceLoading.value = false
  }
}

/* ---- ③ 接下来往哪学（AI 课堂进度） ---- */
const next = ref(null)
const nextLoading = ref(false)

async function loadNext() {
  nextLoading.value = true
  try {
    const r = await api.teachSyllabi()
    const list = r.list || []
    // 优先进行中的课；都没进度时取最近更新的
    const active = list.find((s) => s.status === 'active') || list[0] || null
    if (active) next.value = nextChapterOf(active)
  } catch {
    /* 未登录或未开课都归为「没有进度」，走引导态 */
  } finally {
    nextLoading.value = false
  }
}

function goTeacher() {
  router.push(ROUTES.teacher)
}

/** ③ AI 课堂章节进度百分比 */
const nextPct = computed(() => {
  const n = next.value
  if (!n || !n.chapterTotal) return 0
  return Math.min(100, Math.round((n.chapterNo / n.chapterTotal) * 100))
})

/** 打印报告（与错题/讲解页同款打印通道） */
function printReport() {
  const sections = []
  sections.push({
    label: '已掌握总结',
    html: `<p>累计错题 ${ov.value.total} · 已掌握 ${ov.value.mastered} · 掌握率 ${ov.value.rate}% · 自测正确率 ${quizAccuracy.value}%</p>`,
  })
  if (ov.value.bestPoints.length) {
    sections.push({
      label: '掌握最好的知识点',
      html: `<p>${ov.value.bestPoints.map((p) => `${esc(p.name)} ${p.rate}%`).join(' · ')}</p>`,
    })
  }
  if (advice.value) {
    sections.push({ label: 'AI 建议摘要', html: renderMathToHtml(advice.value.summary || '') })
    if (advice.value.weak_points && advice.value.weak_points.length) {
      sections.push({
        label: '薄弱点建议',
        html: advice.value.weak_points.map((w) => `<p><b>${esc(w.name)}</b>：${renderMathToHtml(w.advice || '')}</p>`).join(''),
      })
    }
  }
  if (next.value) {
    sections.push({
      label: '接下来往哪学',
      html: `<p>《${esc(next.value.subject)}》学到 ${next.value.chapterNo}/${next.value.chapterTotal} 章 · ${esc(next.value.current || '')}</p>`,
    })
  }
  printHtml('知一 · 学情报告', sections)
}

function timeAgo(ts) {
  const d = Date.now() - Number(ts || 0)
  if (d < 60000) return '刚刚'
  if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`
  return `${Math.floor(d / 3600000)} 小时前`
}

onMounted(loadNext)
</script>

<style scoped>
.report__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--sp-5);
}
.report__head-main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.report__head .t-h1 {
  margin: 0;
}
.report__block {
  margin-bottom: var(--sp-4);
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
/* UiButton 在纵向 flex 里别被拉成通栏 */
.report__block > .ui-btn {
  align-self: flex-start;
}
.report__block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.report__block-title {
  margin: 0;
}
.report__head-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.report__block-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: var(--sp-2);
  border-radius: var(--radius-sm);
  background: var(--primary-soft-2);
  color: var(--primary-text);
  vertical-align: -4px;
}
.report__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.report__metric {
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.report__metric-icon {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.report__metric b {
  font-size: var(--fs-h2, 20px);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.report__metric i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.report__metric.is-green .report__metric-icon {
  background: rgba(63, 156, 98, 0.12);
  color: #2f7a4d;
}
.report__metric.is-amber .report__metric-icon {
  background: rgba(208, 118, 42, 0.12);
  color: #a2571c;
}
.report__metric.is-blue .report__metric-icon {
  background: rgba(58, 120, 192, 0.12);
  color: #3a78c0;
}
/* 掌握最好的知识点：chip 化 */
.report__best {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.report__best-chip {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: rgba(63, 156, 98, 0.1);
  border: 0.5px solid rgba(63, 156, 98, 0.3);
  color: #2f7a4d;
  font-size: var(--fs-label);
}
.report__best-chip b {
  font-weight: var(--fw-medium);
}
.report__advice-summary {
  margin: 0;
}
.report__advice-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.report__advice-item {
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  border: var(--border-subtle);
  padding: 12px 16px;
}
.report__advice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
/* 弱点标题：序号徽标 + 加重，和正文拉开层次 */
.report__advice-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-body);
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--text-primary);
}
.report__advice-no {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
/* 「练一组」行动按钮：浅紫渐变底 + 圆形图标 + hover 实心，做出层次 */
.report__practice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 13px 0 6px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--primary-line);
  background: linear-gradient(135deg, var(--primary-soft-1), var(--primary-soft-2));
  color: var(--primary-text);
  font-family: inherit;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(124, 92, 255, 0.12);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
    border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.report__practice-ic {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: #fff;
  transition: background var(--dur) var(--ease);
}
.report__practice:hover {
  border-color: var(--primary);
  color: #fff;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  box-shadow: 0 3px 9px rgba(124, 92, 255, 0.3);
  transform: translateY(-1px);
}
.report__practice:hover .report__practice-ic {
  background: rgba(255, 255, 255, 0.26);
}
.report__practice:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(124, 92, 255, 0.2);
}
.report__advice-advice {
  margin: 6px 0 0;
  font-size: var(--fs-body-2);
  line-height: var(--lh-body);
  color: var(--text-tertiary);
}
.report__advice-meta {
  color: var(--text-muted);
}
.report__advice-err {
  color: var(--danger, #a32d2d);
}
.report__next {
  border-radius: var(--radius-md);
  background: var(--primary-soft-3);
  border: 0.5px solid var(--primary-line);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.report__progress {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.report__progress i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--primary);
  transition: width var(--dur) var(--ease);
}
.report__next b {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.report__next p {
  margin: 0;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.report__guide {
  border: 0.5px solid rgba(208, 118, 42, 0.35);
  background: var(--warning-soft, rgba(240, 161, 74, 0.12));
  padding: var(--sp-4) var(--sp-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-direction: row;
}
.report__guide b {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: #a2571c;
}
.report__guide p {
  margin: 3px 0 0;
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
@media (max-width: 720px) {
  .report__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .report__guide {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
