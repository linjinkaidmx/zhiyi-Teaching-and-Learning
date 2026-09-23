<template>
  <div class="zy-container zy-page ach">
    <header class="ach__head">
      <div>
        <h1 class="t-h1">成就殿堂</h1>
        <p class="t-body-2">已解锁 <b>{{ doneCount }}</b> / {{ total }} 枚奖章 · 拍照、讲解、自测、班级、考试、社区都有专属奖章</p>
      </div>
      <div class="ach__head-ring">
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r="31" fill="none" stroke="var(--surface-unit)" stroke-width="8" />
          <circle
            cx="38" cy="38" r="31" fill="none" stroke="var(--primary)" stroke-width="8" stroke-linecap="round"
            :stroke-dasharray="195" :stroke-dashoffset="195 - (195 * doneCount) / Math.max(1, total)"
            transform="rotate(-90 38 38)"
          />
          <text x="38" y="44" text-anchor="middle" font-size="17" font-weight="700" fill="var(--text-primary)">
            {{ Math.round((doneCount / Math.max(1, total)) * 100) }}%
          </text>
        </svg>
      </div>
    </header>

    <!-- 稀有度总览 -->
    <div class="ach__summary">
      <div v-for="r in rarityCards" :key="r.key" class="ach__sum surface-standard">
        <BadgeMedal :rarity="r.key" :totem="r.totem" size="md" />
        <div class="ach__sum-txt">
          <b>{{ r.done }}<em>/{{ r.total }}</em></b>
          <span>{{ r.name }}奖章</span>
        </div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="ach__filters">
      <UiSegmented v-model="filter" :options="filterOptions" />
      <span class="t-label ach__hint">未解锁的奖章会显示当前进度，悬停或点开可看条件</span>
    </div>

    <!-- 分组 -->
    <section v-for="g in groups" :key="g.name" class="ach__group">
      <div class="ach__group-head">
        <h2 class="t-h3">{{ g.name }}</h2>
        <span class="ach__group-count">{{ g.done }} / {{ g.list.length }}</span>
      </div>
      <div class="ach__grid">
        <button
          v-for="a in g.list"
          :key="a.key"
          type="button"
          class="ach__cell"
          :class="{ 'is-done': a.done }"
          @click="openDetail(a)"
        >
          <BadgeMedal
            :rarity="a.rarity"
            :totem="a.hidden && !a.done ? 'question' : a.totem"
            size="lg"
            :locked="!a.done"
            :name="a.name"
          />
          <b class="ach__cell-name">{{ a.hidden && !a.done ? '？？？' : a.name }}</b>
          <i class="ach__cell-desc">{{ a.hidden && !a.done ? '隐藏成就，解锁后揭晓' : a.desc }}</i>
          <span class="ach__cell-rarity" :class="`is-${a.rarity}`">{{ rarityName[a.rarity] }}</span>
          <div v-if="!a.done" class="ach__bar">
            <i :style="{ width: pct(a) + '%' }" />
          </div>
          <div v-else class="ach__cell-at">{{ dateText(a.at) }} 解锁</div>
        </button>
      </div>
    </section>

    <UiEmptyState
      v-if="!groups.length"
      title="这个筛选下没有奖章"
      description="换一个筛选条件看看，或者去拍照搜题开始攒第一枚。"
    />

    <!-- 详情 -->
    <UiModal v-model="detailOpen" :title="detail ? detail.name : '成就详情'" size="sm">
      <div v-if="detail" class="ach__detail">
        <BadgeMedal :rarity="detail.rarity" :totem="detail.totem" size="xl" :locked="!detail.done" :name="detail.name" />
        <div class="ach__detail-rarity" :class="`is-${detail.rarity}`">
          {{ rarityName[detail.rarity] }} · {{ detail.group }}
        </div>
        <p class="t-body ach__detail-desc">{{ detail.desc }}</p>
        <div v-if="detail.done" class="ach__detail-meta">已于 {{ dateText(detail.at) }} 解锁</div>
        <template v-else>
          <div class="ach__bar ach__bar--wide">
            <i :style="{ width: pct(detail) + '%' }" />
          </div>
          <div class="ach__detail-meta">进度 {{ detail.value }} / {{ detail.target }}</div>
        </template>
        <p v-if="detail.requiresGoal && !detail.done" class="t-label ach__detail-tip">{{ detail.requiresGoal }}</p>
      </div>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * 成就殿堂：总览 + 8 个功能域分组 + 未解锁进度 + 隐藏成就灰影。
 * 数据完全来自本地统计（statsStore），登录后随打卡数据一起云同步。
 */
import { computed, ref } from 'vue'
import BadgeMedal from '../ui/BadgeMedal.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { achievementList, statsRef } from '../statsStore'
import { GROUPS, RARITY, RARITY_NAME } from '../achievements.js'

const stats = statsRef()
const filter = ref('all')
const detailOpen = ref(false)
const detail = ref(null)

const rarityName = RARITY_NAME
const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '已解锁', value: 'done' },
  { label: '未解锁', value: 'todo' },
]

const all = computed(() => (stats.value, achievementList()))
const total = computed(() => all.value.length)
const doneCount = computed(() => all.value.filter((a) => a.done).length)

const rarityCards = computed(() => ['common', 'rare', 'epic', 'legend'].map((k) => {
  const list = all.value.filter((a) => a.rarity === k)
  return {
    key: k,
    name: RARITY[k].name,
    totem: { common: 'book', rare: 'search', epic: 'chat', legend: 'exam' }[k],
    done: list.filter((a) => a.done).length,
    total: list.length,
  }
}))

/** 分组展示：组内已解锁优先，其次按进度从高到低 */
const groups = computed(() => {
  const f = filter.value
  return GROUPS.map((name) => {
    let list = all.value.filter((a) => a.group === name)
    if (f === 'done') list = list.filter((a) => a.done)
    if (f === 'todo') list = list.filter((a) => !a.done)
    const sorted = [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1
      return pctNum(b) - pctNum(a)
    })
    return { name, done: list.filter((a) => a.done).length, list: sorted }
  }).filter((g) => g.list.length)
})

function pctNum(a) {
  return a.target > 0 ? Math.min(100, Math.round((a.value / a.target) * 100)) : 0
}
const pct = (a) => pctNum(a)

function dateText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function openDetail(a) {
  // 隐藏成就未解锁时不剧透：只给模糊提示
  detail.value = a.hidden && !a.done
    ? { ...a, name: '？？？', desc: '隐藏成就，解锁后揭晓条件' }
    : a
  detailOpen.value = true
}
</script>

<style scoped>
.ach {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
.ach__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-5);
}
.ach__head h1 {
  margin-bottom: var(--sp-2);
}
.ach__head-ring {
  flex: none;
}

/* 稀有度总览 */
.ach__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.ach__sum {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
}
.ach__sum-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ach__sum-txt b {
  font-size: var(--fs-h1);
  font-weight: var(--fw-medium);
  letter-spacing: -0.03em;
  color: var(--text-primary);
}
.ach__sum-txt b em {
  font-style: normal;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
}
.ach__sum-txt span {
  font-size: var(--fs-label);
  color: var(--text-muted);
}

.ach__filters {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.ach__hint {
  color: var(--text-muted);
}

/* 分组 */
.ach__group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ach__group-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.ach__group-count {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.ach__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: var(--sp-3);
}
.ach__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-3) var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  cursor: pointer;
  text-align: center;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ach__cell:hover {
  transform: translateY(-2px);
  border-color: var(--primary-line);
  background: var(--surface-hover);
}
.ach__cell.is-done {
  border-color: rgba(124, 92, 255, 0.24);
  background: linear-gradient(180deg, var(--primary-soft-3), transparent 60%), var(--surface-1);
}
.ach__cell-name {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ach__cell.is-done .ach__cell-name {
  color: var(--primary-text-strong);
}
.ach__cell-desc {
  font-size: var(--fs-label);
  font-style: normal;
  color: var(--text-muted);
  line-height: 1.5;
  min-height: 2.4em;
}
.ach__cell-rarity {
  font-size: var(--fs-label);
  border-radius: var(--radius-pill);
  padding: 1px 8px;
  color: var(--text-tertiary);
  background: var(--surface-unit);
}
.ach__cell-rarity.is-epic {
  color: #96650f;
  background: rgba(242, 191, 78, 0.18);
}
.ach__cell-rarity.is-legend {
  color: var(--primary-text);
  background: var(--primary-soft-1);
}
.ach__bar {
  width: 100%;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.ach__bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, #7e68f7, var(--primary-cta));
}
.ach__bar--wide {
  width: 100%;
  height: 7px;
  margin-top: var(--sp-2);
}
.ach__cell-at {
  font-size: var(--fs-label);
  color: var(--success);
}

/* 详情 */
.ach__detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0 var(--sp-1);
}
.ach__detail-rarity {
  font-size: var(--fs-label);
  border-radius: var(--radius-pill);
  padding: 2px 10px;
  color: var(--text-tertiary);
  background: var(--surface-unit);
}
.ach__detail-rarity.is-epic {
  color: #96650f;
  background: rgba(242, 191, 78, 0.18);
}
.ach__detail-rarity.is-legend {
  color: var(--primary-text);
  background: var(--primary-soft-1);
}
.ach__detail-desc {
  margin-top: var(--sp-1);
}
.ach__detail-meta {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.ach__detail-tip {
  color: var(--warning);
}

@media (max-width: 767px) {
  .ach__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ach__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ach__head-ring {
    display: none;
  }
}

/* 桌面端：内容区已让出侧栏，铺开更多列 */
@media (min-width: 1024px) {
  .ach {
    max-width: none;
  }
  .ach__grid {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }
}
</style>
