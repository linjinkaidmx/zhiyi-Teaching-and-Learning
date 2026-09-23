<template>
  <div class="zy-container zy-page data">
    <header class="data__head">
      <div class="data__head-main">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">学习数据</h1>
        <p class="t-body-2">全部来自本机的错题本与打卡记录（云端同步后跨设备一致）</p>
      </div>
      <div class="data__head-ops">
        <UiButton variant="primary" size="sm" @click="reportOpen = true">成长报告</UiButton>
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.records)">学习记录</UiButton>
      </div>
    </header>

    <!-- 薄弱点专项练习：围绕某个知识点生成同类题并判分 -->
    <WeakPointPractice
      v-model:open="practiceOpen"
      :point="practicePoint"
      :ref-items="practiceRefs"
    />
    <!-- 学期成长报告：三档范围 + 打印 -->
    <GrowthReport v-model:open="reportOpen" />

    <!-- 概览 -->
    <section class="data__metrics">
      <div v-for="m in overviewMetrics" :key="m.label" class="data__metric surface-standard">
        <span class="t-metric">{{ m.value }}</span>
        <span class="t-caption data__metric-label">{{ m.label }}</span>
      </div>
    </section>

    <!-- 打卡与成就 -->
    <section class="surface-standard data__block">
      <h2 class="t-h3 data__block-title">打卡与成就</h2>
      <div class="data__chips">
        <span class="data__chip">当前连续 <b>{{ summary.current }}</b> 天</span>
        <span class="data__chip">最长连续 <b>{{ summary.longest }}</b> 天</span>
        <span class="data__chip">本月打卡 <b>{{ summary.monthDays }}</b> 天</span>
        <span class="data__chip">累计打卡 <b>{{ summary.checkedDays }}</b> 天</span>
        <span class="data__chip">成就 <b>{{ doneAch }}</b>/{{ achList.length }}</span>
      </div>
      <div class="data__ach">
        <UiTag v-for="a in achList.filter((x) => x.done).slice(0, 12)" :key="a.key" variant="success" level>
          {{ a.name }}
        </UiTag>
      </div>
      <p v-if="!doneAch" class="t-body-2">还没有解锁成就，拍题讲解、存入错题本、自测都会累积进度。</p>
    </section>

    <!-- 学习时长（批次4） -->
    <section class="surface-standard data__block">
      <h2 class="t-h3 data__block-title">学习时长 <span class="t-label">按你在讲解页/自测里的实际停留计时</span></h2>
      <div class="data__chips">
        <span class="data__chip">今天 <b>{{ humanMinutes(minutes.today) }}</b></span>
        <span class="data__chip">近 7 天 <b>{{ humanMinutes(minutes.week) }}</b></span>
        <span class="data__chip">日均（有记录的天） <b>{{ humanMinutes(minutes.dailyAvg) }}</b></span>
        <span class="data__chip">有学习的天数 <b>{{ minutes.activeDays }}</b>/7</span>
      </div>
      <div class="data__trend">
        <div v-for="d in weekMinutes" :key="d.label" class="data__trend-col" :title="`${d.label}：${humanMinutes(d.minutes)}`">
          <div class="data__trend-bar" :style="{ height: minuteBar(d.minutes) }" />
          <span class="data__trend-label">{{ d.label }}</span>
        </div>
      </div>
      <p v-if="!minutes.week" class="t-body-2">还没有时长数据：去讲解页看几道题、或做一次自测就会开始累计。</p>
    </section>

    <!-- AI 学情建议（批次4） -->
    <section class="surface-standard data__block">
      <div class="data__block-head">
        <h2 class="t-h3 data__block-title">AI 学情建议 <span class="t-label">点击才生成 · 24 小时内复用</span></h2>
        <UiButton variant="primary" size="sm" :loading="adviceLoading" :disabled="!overview.total" @click="genAdvice">
          {{ advice ? '重新生成' : '生成建议' }}
        </UiButton>
      </div>

      <p v-if="!overview.total" class="t-body-2">还没有错题数据，先拍几道题再看建议。</p>
      <p v-else-if="adviceErr" class="t-label data__advice-err">{{ adviceErr }}</p>
      <p v-else-if="!advice" class="t-body-2">
        会把你错题本的**聚合摘要**（知识点、练习次数、正确率）发给模型，不传题目全文；生成一次约几秒。
      </p>

      <template v-else>
        <p class="t-body data__advice-summary"><MathText :content="advice.summary" /></p>
        <div v-if="advice.weak_points && advice.weak_points.length" class="data__advice-list">
          <div v-for="w in advice.weak_points" :key="w.name" class="data__advice-item">
            <div class="data__advice-head">
              <span class="data__advice-name">{{ w.name }}</span>
              <span class="t-label">{{ latexToPlain(String(w.why || '')).replace(/\s+/g, ' ').trim() }}</span>
            </div>
            <p class="t-body-2 data__advice-advice">→ <MathText :content="w.advice" /></p>
          </div>
        </div>
        <div v-if="advice.reason_advice && advice.reason_advice.length" class="data__advice-list">
          <div v-for="r in advice.reason_advice" :key="r.type" class="data__advice-item">
            <div class="data__advice-head">
              <span class="data__advice-name">{{ r.type }}</span>
            </div>
            <p class="t-body-2 data__advice-advice">→ <MathText :content="r.advice" /></p>
          </div>
        </div>
        <p class="t-label data__advice-meta">
          {{ advice.cached ? '来自缓存' : '本次新生成' }}<template v-if="advice.generatedAt"> · {{ timeAgo(advice.generatedAt) }}</template>
          <template v-if="advice.demo"> · 演示数据（未配置模型 Key）</template>
        </p>
      </template>
    </section>

    <!-- 近 14 天新增 -->
    <section class="surface-standard data__block">
      <h2 class="t-h3 data__block-title">近 14 天新增错题</h2>
      <div v-if="!overview.total" class="t-body-2">还没有错题数据。</div>
      <div v-else class="data__trend">
        <div v-for="d in trend" :key="d.label" class="data__trend-col" :title="`${d.label}：${d.count} 道`">
          <div class="data__trend-bar" :style="{ height: barHeight(d.count) }" />
          <span class="data__trend-label">{{ d.label }}</span>
        </div>
      </div>
    </section>

    <!-- 薄弱知识点 -->
    <section class="surface-standard data__block">
      <h2 class="t-h3 data__block-title">薄弱知识点 <span class="t-label">按错误率排序</span></h2>
      <UiEmptyState
        v-if="!weak.length"
        title="还没有知识点数据"
        description="讲解结果里的知识点会自动汇总到这里；也可以从错题详情补充知识点。"
      />
      <ul v-else class="data__list">
        <li v-for="w in weak.slice(0, 8)" :key="w.name" class="data__row">
          <span class="data__row-name">{{ w.name }}</span>
          <span class="data__bar"><i :style="{ width: Math.round(w.errorRate * 100) + '%' }" data-kind="error" /></span>
          <span class="data__row-val">错误率 {{ Math.round(w.errorRate * 100) }}%</span>
          <span class="t-label data__row-meta">{{ w.total }} 道 · 已掌握 {{ w.mastered }}</span>
          <UiButton variant="ghost" size="sm" class="data__row-op" @click="openPractice(w)">练一组</UiButton>
        </li>
      </ul>
    </section>

    <!-- 知识点掌握度 -->
    <section class="surface-standard data__block">
      <h2 class="t-h3 data__block-title">知识点掌握度 <span class="t-label">按练习量排序</span></h2>
      <div v-if="!mastery.length" class="t-body-2">做过自测后这里会显示每个知识点的答对率。</div>
      <ul v-else class="data__list">
        <li v-for="m in mastery.slice(0, 8)" :key="m.name" class="data__row">
          <span class="data__row-name">{{ m.name }}</span>
          <span class="data__bar"><i :style="{ width: m.mastery + '%' }" data-kind="ok" /></span>
          <span class="data__row-val">掌握 {{ m.mastery }}%</span>
          <span class="t-label data__row-meta">练习 {{ m.quiz }} 次</span>
        </li>
      </ul>
    </section>

    <!-- 学习记录入口 -->
    <section class="surface-standard data__block">
      <div class="data__block-head">
        <h2 class="t-h3 data__block-title">学习记录</h2>
        <UiButton variant="text" size="sm" @click="$router.push(ROUTES.records)">查看全部记录 →</UiButton>
      </div>
      <div class="data__chips">
        <span class="data__chip">共 <b>{{ recordSummary.total }}</b> 条</span>
        <span class="data__chip">今天 <b>{{ recordSummary.today }}</b> 条</span>
        <span v-for="(n, t) in recordSummary.byType" :key="t" class="data__chip">
          {{ typeLabel(t) }} <b>{{ n }}</b>
        </span>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 学习数据（/data）：原「学情看板」迁入并扩展
 * 数据全部是真实的本地数据：错题本分析（book.js 纯函数）+ 打卡成就（statsStore）+ 学习记录（recordsStore）
 */
import { computed, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiTag from '../ui/UiTag.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import WeakPointPractice from '../components/WeakPointPractice.vue'
import GrowthReport from '../components/GrowthReport.vue'
import MathText from '../components/MathText.vue'
import { latexToPlain } from '../mathtext'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import { bookRef } from '../stores/bookStore'
import { analyzeWeakPoints, getOverview, getMasteryByPoint, getDailyTrend } from '../book.js'
import { statsRef, summary as statsSummary, achievementList } from '../statsStore'
import { recordSummary, RECORD_TYPES, studyMinutes, studyTimeByDay, humanMinutes } from '../stores/recordsStore'
import { analyzeStudy } from '../lib/adapter/analyze.js'

const items = computed(() => bookRef().value)
const s = statsRef()

const overview = computed(() => getOverview(items.value))
const summary = computed(() => (s.value, statsSummary()))
const achList = computed(() => (s.value, achievementList()))
const doneAch = computed(() => achList.value.filter((a) => a.done).length)
const weak = computed(() => analyzeWeakPoints(items.value))

/* ---------------- 薄弱点专项练习（扩展1） ---------------- */
const practiceOpen = ref(false)
const practicePoint = ref('')
const practiceRefs = ref([])

/** 打开某个知识点的专项练习：带上该知识点下的错题作为「参考原题」 */
function openPractice(w) {
  practicePoint.value = String(w.name || '')
  practiceRefs.value = (items.value || [])
    .filter((it) => Array.isArray(it.knowledgePoints) && it.knowledgePoints.includes(w.name))
    .slice(0, 2)
  practiceOpen.value = true
}

/* ---------------- 成长报告（扩展2） ---------------- */
const reportOpen = ref(false)
const mastery = computed(() => getMasteryByPoint(items.value))
const trend = computed(() => getDailyTrend(items.value, 14))

const overviewMetrics = computed(() => [
  { label: '错题总数', value: overview.value.total },
  { label: '已掌握', value: overview.value.mastered },
  { label: '自测正确率', value: `${overview.value.accuracy}%` },
  { label: '本周新增', value: overview.value.weekNew },
])

const maxTrend = computed(() => Math.max(1, ...trend.value.map((d) => d.count)))
function barHeight(count) {
  if (!count) return '2px'
  return `${Math.max(6, Math.round((count / maxTrend.value) * 64))}px`
}

const typeLabel = (t) => (RECORD_TYPES[t] ? RECORD_TYPES[t].label : t)

/* ---------------- 学习时长（批次4） ---------------- */
const minutes = computed(() => (s.value, studyMinutes()))
const weekMinutes = computed(() => (s.value, studyTimeByDay(7)))
const maxMinutes = computed(() => Math.max(1, ...weekMinutes.value.map((d) => d.minutes)))
function minuteBar(m) {
  if (!m) return '2px'
  return `${Math.max(6, Math.round((m / maxMinutes.value) * 64))}px`
}

/* ---------------- AI 学情建议（批次4） ---------------- */
const advice = ref(null)
const adviceLoading = ref(false)
const adviceErr = ref('')

/** 只传聚合摘要（省 token、也只暴露必要信息） */
function adviceSummary() {
  return {
    total: overview.value.total,
    mastered: overview.value.mastered,
    points: weak.value.slice(0, 12).map((w) => ({
      name: w.name, total: w.total, quiz: w.quiz, correct: w.correct, mastered: w.mastered,
    })),
    reasons: [], // 后续可从错因诊断文本做分类统计
  }
}

async function genAdvice() {
  if (adviceLoading.value) return
  adviceLoading.value = true
  adviceErr.value = ''
  try {
    const samples = items.value.slice(0, 5).map((it) => String(it.question || '').replace(/\s+/g, ' ').slice(0, 120))
    advice.value = await analyzeStudy({ summary: adviceSummary(), samples })
  } catch (e) {
    adviceErr.value = '生成失败：' + (e.message || '请稍后重试')
  } finally {
    adviceLoading.value = false
  }
}

function timeAgo(ts) {
  const diff = Date.now() - (Number(ts) || 0)
  if (diff < 60000) return '刚刚生成'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前生成`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前生成`
  return `${Math.floor(diff / 86400000)} 天前生成`
}
</script>

<style scoped>
.data {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-wide);
}
/* 桌面两栏（工作台增强）：头部与三数跨全宽，其余区块自动排两列 */
@media (min-width: 768px) {
  .data {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
  .data__head,
  .data__metrics {
    grid-column: 1 / -1;
  }
}
.data__head {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.data__head-main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.data__head-ops {
  display: flex;
  gap: var(--sp-2);
}
.data__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.data__metric {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4) var(--sp-5);
}
.data__metric-label {
  color: var(--text-tertiary);
}
.data__block {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.data__block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.data__block-title {
  color: var(--text-primary);
}
.data__chips {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.data__chip {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
}
.data__chip b {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.data__ach {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.data__trend {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 92px;
  padding-top: var(--sp-2);
}
.data__trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}
.data__trend-bar {
  width: 100%;
  max-width: 22px;
  border-radius: 3px 3px 0 0;
  background: var(--primary-soft-2);
  border-top: 1px solid var(--primary-line);
  transition: height var(--dur) var(--ease);
}
.data__trend-label {
  font-size: 10px;
  color: var(--text-muted);
  transform: rotate(-45deg);
  white-space: nowrap;
}
.data__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.data__row {
  display: grid;
  grid-template-columns: minmax(90px, 1.2fr) minmax(80px, 2fr) 96px minmax(90px, 1fr);
  align-items: center;
  gap: var(--sp-3);
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.data__row-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data__bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.data__bar > i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--warning);
}
.data__bar > i[data-kind='ok'] {
  background: var(--success);
}
.data__row-val {
  color: var(--text-secondary);
}
.data__row-meta {
  color: var(--text-muted);
  text-align: right;
}

@media (max-width: 900px) {
  .data__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .data__row {
    grid-template-columns: minmax(80px, 1fr) minmax(60px, 1.4fr) auto;
  }
  .data__row-meta {
    display: none;
  }
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .data {
    max-width: none;
  }
}

/* 薄弱点行内的「练一组」按钮 */
.data__row-op {
  flex: none;
  margin-left: var(--sp-2);
}
</style>
