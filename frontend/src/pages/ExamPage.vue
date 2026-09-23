<template>
  <div class="zy-page">
    <div class="zy-container ex">
      <header class="ex__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">模拟考试</h1>
        <p class="t-body-2">
          按题型生成 100 分制试卷，在线作答。交卷后选择题即时判、主观题由 AI 判分。
        </p>
      </header>

      <section class="ex__modes">
        <button
          v-for="m in modeList"
          :key="m.key"
          type="button"
          class="ex__mode surface-standard"
          @click="startPaper(m.key)"
        >
          <span class="ex__mode-title">{{ m.label }}</span>
          <span class="ex__mode-desc">{{ m.desc }}</span>
          <span class="ex__mode-meta t-label">{{ m.meta }}</span>
          <span class="ex__mode-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      <section class="ex__history">
        <div class="ex__history-head">
          <h2 class="t-h3">历史成绩</h2>
          <span v-if="stats.count" class="t-label">
            共 {{ stats.count }} 张 · 平均 {{ stats.avg }} 分 · 最高 {{ stats.best }} 分
          </span>
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
            <span class="ex__row-score">{{ p.graded.total }}<i>/100</i></span>
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
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { goBackSmart } from '../lib/nav.js'
import { ROUTES } from '../lib/routes.js'
import { PAPER_MODES, TYPE_LABEL, formatDuration, historyStats } from '../lib/exam.js'
import { papersRef } from '../stores/examStore'

const router = useRouter()
const papers = papersRef()
const stats = computed(() => historyStats(papers.value))

const modeList = computed(() => [
  ...Object.values(PAPER_MODES).map((m) => {
    const parts = m.plan.map((p) => `${TYPE_LABEL[p.type]} ${p.count} 道`)
    const total = m.plan.reduce((s, p) => s + p.count, 0)
    return { key: m.key, label: m.label, desc: m.desc, meta: `${parts.join(' + ')} · 共 ${total} 题 · 100 分` }
  }),
  {
    key: 'custom',
    label: '自定义题量',
    desc: '自己决定各题型出几道、每题几分（如只出 5 道选择）',
    meta: '题量与分值自由组合 · 100 分制',
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
