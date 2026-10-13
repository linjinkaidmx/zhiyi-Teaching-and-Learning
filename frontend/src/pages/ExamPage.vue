<template>
  <div class="zy-page">
    <div class="zy-container ex">
      <header class="ex__head">
        <div>
          <UiButton variant="soft" size="sm" class="zy-back" @click="goBackSmart($router)" icon="left">返回</UiButton>
          <h1 class="t-h1">模拟考试</h1>
          <p class="t-body-2">
            按题型生成 100 分制试卷，在线作答。交卷后选择题即时判、主观题由 AI 判分。
          </p>
        </div>
      </header>

      <section class="ex__modes">
        <button
          v-for="m in modeList"
          :key="m.key"
          type="button"
          class="ex__mode surface-standard"
          @click="startPaper(m.key)"
        >
          <span class="ex__mode-icon" :class="`is-${m.tone}`"><UiIcon :name="m.icon" :size="16" /></span>
          <span class="ex__mode-title">{{ m.label }}</span>
          <span class="ex__mode-desc">{{ m.desc }}</span>
          <span v-if="m.chips.length" class="ex__mode-chips">
            <span v-for="c in m.chips" :key="c" class="ex__chip">{{ c }}</span>
          </span>
          <span class="ex__mode-meta t-label">{{ m.summary }}</span>
          <span class="ex__mode-arrow" aria-hidden="true"><UiIcon name="arrowRight" :size="14" /></span>
        </button>
      </section>

      <section class="ex__history">
        <div class="ex__history-head">
          <h2 class="t-h3">历史成绩</h2>
          <div class="ex__history-stats">
            <span v-if="stats.count" class="t-label">
              共 {{ stats.count }} 张 · 平均 {{ stats.avg }} 分 · 最高 {{ stats.best }} 分
            </span>
            <span v-if="trend !== null" class="ex__trend" :class="trend >= 0 ? 'is-up' : 'is-down'">
              {{ trend >= 0 ? '↑' : '↓' }} 比上场{{ trend >= 0 ? '高' : '低' }} {{ Math.abs(trend) }} 分
            </span>
          </div>
        </div>

        <div v-if="stats.list.length" class="ex__list">
          <button
            v-for="p in stats.list"
            :key="p.id"
            type="button"
            class="ex__row surface-standard"
            @click="openResult(p)"
          >
            <span class="ex__row-main">
              <span class="ex__row-title">{{ p.title }}</span>
              <span class="t-label">
                {{ formatDate(p.createdAt) }} · {{ modeLabel(p.mode) }} · 用时 {{ formatDuration(p.durationSec) }}
              </span>
            </span>
            <span class="ex__row-score" :class="scoreTone(p.graded.total)">
              {{ p.graded.total }}<i>/100</i>
            </span>
          </button>
        </div>

        <UiEmptyState
          v-else
          title="还没有考试记录"
          description="选一种模式生成第一张试卷，交卷后成绩会出现在这里。"
        />
      </section>
    </div>
  </div>
  <!-- 新手教程 -->
  <UiTour v-model="tourOpen" tour-key="exam" />
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiTour from '../ui/UiTour.vue'
import { useTour } from '../lib/useTour.js'
import UiIcon from '../ui/UiIcon.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { goBackSmart } from '../lib/nav.js'
import { ROUTES } from '../lib/routes.js'
import { PAPER_MODES, TYPE_LABEL, formatDuration, historyStats } from '../lib/exam.js'
import { papersRef } from '../stores/examStore'

const router = useRouter()
const papers = papersRef()
const stats = computed(() => historyStats(papers.value))
/** 成绩色标三档：优秀 ≥85 绿 / 及格 60~84 橙 / 偏低 <60 红 */
function scoreTone(total) {
  const t = Number(total) || 0
  if (t >= 85) return 'is-high'
  if (t >= 60) return 'is-mid'
  return 'is-low'
}
/** 与上一场的分差（正=进步），不足两场返回 null */
const trend = computed(() => {
  const list = stats.value.list
  if (list.length < 2) return null
  const cur = Number(list[0].graded.total) || 0
  const prev = Number(list[1].graded.total) || 0
  return cur - prev
})

const MODE_META = {
  full: { icon: 'book', tone: 'purple' },
  choice: { icon: 'check', tone: 'green' },
  blank: { icon: 'edit', tone: 'orange' },
  custom: { icon: 'settings', tone: 'blue' },
}

const modeList = computed(() => [
  ...Object.values(PAPER_MODES).map((m) => {
    const parts = m.plan.map((p) => `${TYPE_LABEL[p.type]} ${p.count} 道`)
    const total = m.plan.reduce((s, p) => s + p.count, 0)
    return {
      key: m.key,
      label: m.label,
      desc: m.desc,
      /* 结构化：题型构成 chips + 汇总，比一长行更好扫 */
      chips: m.plan.filter((p) => p.count > 0).map((p) => `${TYPE_LABEL[p.type]} ${p.count}`),
      summary: `共 ${total} 题 · 100 分`,
      meta: `${parts.join(' + ')} · 共 ${total} 题 · 100 分`,
      icon: (MODE_META[m.key] || MODE_META.custom).icon,
      tone: (MODE_META[m.key] || MODE_META.custom).tone,
    }
  }),
  {
    key: 'custom',
    label: '自定义题量',
    desc: '自己决定各题型出几道、每题几分（如只出 5 道选择）',
    chips: [],
    summary: '题量与分值自由组合 · 100 分制',
    meta: '题量与分值自由组合 · 100 分制',
    icon: 'settings',
    tone: 'blue',
  },
])

function startPaper(mode) {
  router.push({ path: ROUTES.simExamRun, query: { mode } })
}

function openResult(paper) {
  router.push({ path: ROUTES.simExamRun, query: { paper: paper.id } })
}

function modeLabel(mode) {
  return (PAPER_MODES[mode] && PAPER_MODES[mode].label) || '自组卷'
}

function formatDate(ts) {
  const d = new Date(Number(ts) || 0)
  if (!Number(ts)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* 新手教程：首次进入本页自动弹（看过不再弹） */
const { tourOpen } = useTour('exam')

</script>

<style scoped>
.ex {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: var(--col-main);
}
.ex__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.ex__modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}
.ex__mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--sp-4);
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: border-color var(--dur) var(--ease);
}
.ex__mode:hover {
  border-color: var(--primary-line);
}
.ex__mode-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.ex__mode-icon.is-green {
  background: rgba(63, 156, 98, 0.12);
  color: #2f7a4d;
}
.ex__mode-icon.is-orange {
  background: rgba(208, 118, 42, 0.12);
  color: #d0762a;
}
.ex__mode-icon.is-blue {
  background: rgba(74, 144, 226, 0.12);
  color: #3a78c0;
}
.ex__mode-title {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.ex__mode-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: var(--lh-body);
}
.ex__mode-meta {
  color: var(--primary-text);
}
/* 题型构成 chips（比一长行更好扫） */
.ex__mode-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.ex__chip {
  padding: 1px 9px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft-1, rgba(124, 92, 255, 0.1));
  color: var(--primary-text);
  font-size: var(--fs-label);
}
.ex__mode-arrow {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  color: var(--text-disabled);
}
.ex__history {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ex__history-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.ex__history-stats {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
/* 与上一场的分差 */
.ex__trend {
  font-size: var(--fs-label);
  padding: 2px 10px;
  border-radius: var(--radius-pill);
}
.ex__trend.is-up {
  color: #2f7a4d;
  background: rgba(47, 122, 77, 0.12);
}
.ex__trend.is-down {
  color: #c0392b;
  background: rgba(192, 57, 43, 0.12);
}
.ex__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.ex__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease);
}
.ex__row:hover {
  border-color: var(--primary-line);
}
.ex__row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ex__row-title {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ex__row-score {
  flex: 0 0 auto;
  font-size: var(--fs-h3);
  color: var(--primary-text);
}
/* 成绩色标三档：优秀 / 及格 / 偏低 */
.ex__row-score.is-high {
  color: #2f7a4d;
}
.ex__row-score.is-mid {
  color: #b5722a;
}
.ex__row-score.is-low {
  color: #c0392b;
}
.ex__row-score i {
  font-size: var(--fs-label);
  font-style: normal;
  color: var(--text-muted);
}
@media (max-width: 767px) {
  .ex__modes {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (min-width: 768px) {
  .ex__modes {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 768px) {
  .ex__modes {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .ex {
    max-width: none;
  }
}
</style>
