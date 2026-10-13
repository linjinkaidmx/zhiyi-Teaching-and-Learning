<template>
  <div class="ck">
    <!-- 今天还没学习时的提醒条 -->
    <div v-if="!sum.checkedToday" class="ck-alert">
      今天还没开始，来一道题就续上了<template v-if="sum.current"> · 当前连续 {{ sum.current }} 天</template>
    </div>

    <!-- 连续 / 最长 / 本月 / 护盾 -->
    <div class="ck-nums">
      <div class="ck-num">
        <span class="ck-num-v">{{ sum.current }}</span>
        <span class="ck-num-k">当前连续（天）</span>
      </div>
      <div class="ck-num">
        <span class="ck-num-v">{{ sum.longest }}</span>
        <span class="ck-num-k">最长连续（天）</span>
      </div>
      <div class="ck-num">
        <span class="ck-num-v">{{ sum.monthDays }}</span>
        <span class="ck-num-k">本月打卡（天）</span>
      </div>
      <div class="ck-num">
        <span class="ck-num-v">{{ sum.shields }}<em>/2</em></span>
        <span class="ck-num-k">护盾 · 再连续 {{ sum.nextShieldIn }} 天补 1 张</span>
      </div>
    </div>

    <!-- 每日目标 -->
    <div class="ck-goal">
      <template v-if="sum.goalEnabled">
        <span class="ck-goal-t">今日目标</span>
        <div class="ck-bar"><div class="ck-bar-in" :class="{ done: sum.goalMet }" :style="{ width: pct + '%' }"></div></div>
        <span class="ck-goal-n" :class="{ done: sum.goalMet }">
          {{ sum.todayQuestions }}/{{ sum.goalTarget }} 题{{ sum.goalMet ? ' · 已达成' : '' }}
        </span>
      </template>
      <span v-else class="ck-goal-t">每日目标已关闭，仅记录打卡与连续</span>
      <span class="muted" style="font-size: 12px">在「我的 → 偏好设置」里调整目标</span>
    </div>

    <!-- 近 13 周热力格 -->
    <div class="ck-heat-wrap">
      <div class="ck-heat">
        <div v-for="(col, ci) in sum.heat" :key="ci" class="ck-col">
          <span
            v-for="cell in col"
            :key="cell.key"
            class="ck-cell"
            :class="cellClass(cell)"
            :title="cellTitle(cell)"
          ></span>
        </div>
      </div>
      <div class="ck-legend muted">
        <span>近 13 周</span>
        <span class="ck-cell lv0"></span><span class="ck-cell lv1"></span>
        <span class="ck-cell lv2"></span><span class="ck-cell lv3"></span>
        <span>少 → 多</span>
        <span class="ck-cell shield"></span><span>护盾日</span>
      </div>
    </div>

    <!-- 成就：离解锁最近的 3 枚 + 殿堂入口（全部奖章在成就殿堂页） -->
    <div class="ck-ach">
      <div class="ck-ach-head">
        <span class="ck-ach-t">成就 {{ doneCount }}/{{ list.length }}</span>
        <button type="button" class="ck-ach-all" @click="goHall">成就殿堂 →</button>
      </div>
      <div v-if="nearList.length" class="ck-near-list">
        <button v-for="a in nearList" :key="a.key" type="button" class="ck-near" @click="goHall">
          <BadgeMedal
            :rarity="a.rarity"
            :totem="a.hidden ? 'question' : a.totem"
            size="md"
            locked
            :name="a.name"
          />
          <span class="ck-near-body">
            <span class="ck-near-n">{{ a.hidden ? '？？？' : a.name }}</span>
            <span class="ck-near-d">{{ a.hidden ? '隐藏成就' : subOf(a) }}</span>
            <span class="ck-near-bar"><i :style="{ width: pctOf(a) + '%' }" /></span>
          </span>
        </button>
      </div>
      <p v-else class="ck-near-empty">全部奖章已集齐，去成就殿堂看看你的收藏。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BadgeMedal from '../ui/BadgeMedal.vue'
import { summary, achievementList, statsRef } from '../statsStore'
import { ROUTES } from '../lib/routes.js'

const s = statsRef()
// 依赖 stats ref：数据一变，下面两个 computed 自动重算
const sum = computed(() => (s.value, summary()))
const list = computed(() => (s.value, achievementList()))

const doneCount = computed(() => list.value.filter((a) => a.done).length)

const router = useRouter()
const goHall = () => router.push(ROUTES.achievements)

/** 离解锁最近的三枚（按进度百分比降序），给一个"再努一把就到手"的钩子 */
const nearList = computed(() =>
  list.value
    .filter((a) => !a.done && a.target > 0)
    .map((a) => ({ ...a, _p: Math.min(100, Math.round((a.value / a.target) * 100)) }))
    .sort((x, y) => y._p - x._p)
    .slice(0, 3)
)
const pctOf = (a) => Math.min(100, Math.round(((a.value || 0) / a.target) * 100))
const pct = computed(() => {
  if (!sum.value.goalEnabled) return 0
  return Math.min(100, Math.round((sum.value.todayQuestions / sum.value.goalTarget) * 100))
})

// 每日目标的开关与题数已移到「我的 → 偏好设置」，这里只读展示进度

function cellClass(cell) {
  if (cell.future) return 'future'
  if (cell.shield && !cell.count) return 'shield'
  if (!cell.count) return 'lv0'
  if (cell.count <= 2) return 'lv1'
  if (cell.count <= 5) return 'lv2'
  return 'lv3'
}

function cellTitle(cell) {
  if (cell.future) return cell.key
  const parts = [`${cell.key} · ${cell.count} 个学习动作`]
  if (cell.goalMet) parts.push('达成每日目标')
  if (cell.shield) parts.push('护盾保住的一天')
  if (!cell.checked) parts.push('未打卡')
  return parts.join(' · ')
}

function fmtDate(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function subOf(a) {
  if (a.done) return (a.backfilled ? '回填解锁 · ' : '') + fmtDate(a.at)
  if (a.requiresGoal && !sum.value.goalEnabled) return a.requiresGoal
  return `进度 ${a.value}/${a.target}`
}

function tip(a) {
  return `${a.group}｜${a.desc}${a.done ? '（已解锁）' : `（进度 ${a.value}/${a.target}）`}`
}
</script>

<style scoped>
.ck { margin-top: 4px; }

/* 提示条 */
.ck-alert {
  background: #fdf8ee;
  border: 1px solid #ecd9b0;
  color: #96690f;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  margin-bottom: 12px;
}

/* 四数 */
.ck-nums {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.ck-num {
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fdfdfe;
}
.ck-num-v {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #35507a;
  line-height: 1.2;
}
.ck-num-v em { font-size: 13px; font-style: normal; color: #8b9cc0; }
.ck-num-k { display: block; font-size: 12px; color: #6b7686; margin-top: 4px; }

/* 每日目标 */
.ck-goal {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.ck-goal-t { font-size: 13px; font-weight: 600; color: #1f2733; flex-shrink: 0; }
.ck-bar {
  flex: 1;
  min-width: 120px;
  height: 8px;
  border-radius: 999px;
  background: #eef1f6;
  overflow: hidden;
}
.ck-bar-in {
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: #8b9cc0;
  transition: width .3s ease;
}
.ck-bar-in.done { background: #3e7a26; }
.ck-goal-n { font-size: 12.5px; color: #6b7686; flex-shrink: 0; }
.ck-goal-n.done { color: #3e7a26; font-weight: 600; }
.ck-goal-set { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* 热力格 */
.ck-heat-wrap { margin-top: 14px; }
.ck-heat { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 4px; }
.ck-col { display: flex; flex-direction: column; gap: 3px; }
.ck-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #eef1f6;
  display: inline-block;
}
.ck-cell.lv0 { background: #eef1f6; }
.ck-cell.lv1 { background: #c8d6ea; }
.ck-cell.lv2 { background: #8ba6cf; }
.ck-cell.lv3 { background: #35507a; }
.ck-cell.shield { background: #ecd9b0; border: 1px solid #c9a96a; }
.ck-cell.future { background: transparent; border: 1px dashed #e5e8ee; }
.ck-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 6px;
  flex-wrap: wrap;
}

/* 成就墙 */
.ck-ach { margin-top: 16px; }
.ck-ach-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ck-ach-t { font-size: 13.5px; font-weight: 700; color: #35507a; }
.ck-ach-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.ck-badge {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 8px 10px;
  background: #f7f8fa;
  opacity: 0.72;
}
.ck-badge.done {
  opacity: 1;
  background: #f2f6fb;
  border-color: #bcc7dd;
}
.ck-badge-ic {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #e9edf5;
  color: #8b9cc0;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ck-badge.done .ck-badge-ic { background: #35507a; color: #fff; }
.ck-badge-body { min-width: 0; }
.ck-badge-n {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1f2733;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ck-badge-g {
  font-size: 10.5px;
  font-style: normal;
  font-weight: 400;
  color: #8b9cc0;
  margin-left: 5px;
}
.ck-badge-d {
  display: block;
  font-size: 11.5px;
  color: #6b7686;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .ck-nums { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ck-ach-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ck-goal { gap: 6px; }
  .ck-bar { min-width: 100%; order: 3; }
}

/* 成就：即将解锁三枚 + 入口 */
.ck-ach-all {
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--primary-text);
  cursor: pointer;
  padding: 0;
}
.ck-ach-all:hover { text-decoration: underline; }
.ck-near-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ck-near {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.ck-near:hover { border-color: var(--primary-line); }
.ck-near-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ck-near-n {
  font-size: 13px;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ck-near-d {
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ck-near-bar {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: var(--surface-unit);
  overflow: hidden;
}
.ck-near-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7e68f7, var(--primary-cta));
}
.ck-near-empty {
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>
