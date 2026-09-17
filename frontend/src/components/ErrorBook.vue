<template>
  <div class="book">
    <!-- 顶部一行紧凑统计（替代 4 张大卡片） -->
    <div class="stat-line">
      <span class="st"><b>{{ stats.total }}</b> 题</span>
      <span class="sep">·</span>
      <span class="st">待复习 <b class="warn">{{ stats.pending }}</b></span>
      <span class="sep">·</span>
      <span class="st">已掌握 <b>{{ stats.mastered }}</b></span>
      <span class="sep">·</span>
      <span class="st">自测正确率 <b>{{ quizAccuracy }}%</b></span>
    </div>

    <div v-if="list.length" class="mid">
      <div class="card">
        <div class="sec-t">知识点掌握度</div>
        <RadarChart :dimensions="kpStats" />
        <div class="legend">
          <div v-for="k in kpStats" :key="k.name" class="lg">
            <span class="dot" :class="{ done: k.rate >= 100, half: k.rate > 0 && k.rate < 100 }"></span>
            <span class="nm">{{ k.name }}</span>
            <span class="rt">{{ k.mastered }}/{{ k.total }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="sec-t">复习与自测</div>
        <div class="plan">
          <div class="plan-n">待复习 <b>{{ stats.pending }}</b> 题</div>
          <div class="plan-s">
            本周新增 {{ stats.weekNew }} 题，累计自测 {{ stats.quizTotal }} 次 ·
            建议优先攻克「{{ topWeak || '暂无' }}」
          </div>
          <div class="plan-btns">
            <el-button type="primary" size="small" @click="emit('quiz')">开始自测</el-button>
            <el-button size="small" @click="startReview">看解析复习</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="card list-card">
      <div class="list-head">
        <div class="sec-t">练习列表</div>
        <el-radio-group v-model="filter" size="small">
          <el-radio-button value="全部">全部</el-radio-button>
          <el-radio-button value="未掌握">未掌握</el-radio-button>
          <el-radio-button value="复习中">复习中</el-radio-button>
          <el-radio-button value="已掌握">已掌握</el-radio-button>
        </el-radio-group>
      </div>

      <el-empty v-if="!filtered.length" description="还没有题目，去加入第一道吧" :image-size="90" />

      <div
        v-for="it in filtered"
        :key="it.id"
        class="row clickable"
        :class="{ done: it.status === '已掌握' }"
        title="点击查看完整解析"
        @click="emit('review', it)"
      >
        <div class="tags">
          <span class="tag-chip brand">{{ it.subject || '未分类' }}</span>
          <span v-if="hasErrorType(it)" class="tag-chip" style="color: var(--danger); border-color: rgba(192,86,75,0.35); background: var(--danger-soft)">
            {{ it.error_type }}
          </span>
          <span v-else class="tag-chip">待练习</span>
          <span v-for="k in it.knowledge_points || []" :key="k" class="tag-chip">{{ k }}</span>
          <span class="time">{{ fmt(it.createdAt) }}</span>
        </div>
        <div class="q"><MathText :text="it.question" /></div>
        <div class="row-ops">
          <button class="link-act" @click.stop="emit('review', it)">查看解析</button>
          <button class="link-act" @click.stop="emit('share', it)">分享</button>
          <button v-if="it.status !== '已掌握'" class="link-act" @click.stop="mark(it.id, '已掌握')">
            标记已掌握
          </button>
          <button v-else class="link-act" @click.stop="mark(it.id, '复习中')">重新复习</button>
          <button class="link-act danger" @click.stop="del(it.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MathText from './MathText.vue'
import RadarChart from './RadarChart.vue'
import {
  getBook,
  updateStatus,
  removeRecord,
  getStats,
  getKnowledgeStats,
  getQuizAccuracy,
  hasErrorType,
} from '../utils/storage'

const emit = defineEmits(['review', 'quiz', 'share'])

const list = ref(getBook())
const filter = ref('全部')
const version = ref(0)

const stats = computed(() => {
  version.value
  return getStats()
})
const kpStats = computed(() => {
  version.value
  return getKnowledgeStats()
})
const quizAccuracy = computed(() => {
  version.value
  return getQuizAccuracy()
})
const filtered = computed(() => {
  version.value
  if (filter.value === '全部') return list.value
  return list.value.filter((x) => x.status === filter.value)
})
const topWeak = computed(() => {
  const weak = kpStats.value.filter((k) => k.rate < 100)
  return weak.length ? weak[0].name : ''
})

function refresh() {
  list.value = getBook()
  version.value++
}

function mark(id, status) {
  updateStatus(id, status)
  refresh()
  ElMessage.success(status === '已掌握' ? '已标记为掌握' : '已放回复习计划')
}

async function del(id) {
  try {
    await ElMessageBox.confirm('确定删除这条错题记录？', '提示', { type: 'warning' })
    removeRecord(id)
    refresh()
    ElMessage.success('已删除')
  } catch {
    /* 用户取消 */
  }
}

function startReview() {
  const first = list.value.find((x) => x.status !== '已掌握')
  if (!first) return ElMessage.info('没有待复习的题目了')
  ElMessage.success('已开始复习，点击列表可查看完整解析')
  emit('review', first)
}

function fmt(ts) {
  // 脏数据兜底：createdAt 缺失或非法时不渲染 NaN
  if (!ts || Number.isNaN(Number(ts))) return ''
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
</script>

<style scoped>
/* 顶部一行紧凑统计 */
.stat-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 4px 16px;
  font-size: 13px;
  color: var(--text-sub);
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
}
.stat-line .st b {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin-right: 2px;
}
.stat-line .st b.warn {
  color: var(--brand);
}
.stat-line .sep {
  color: var(--border-strong);
}
.mid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.sec-t {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}
.legend {
  margin-top: 8px;
}
.lg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-sub);
  padding: 3px 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  flex: none;
}
.dot.half {
  background: var(--brand);
}
.dot.done {
  background: var(--success);
}
.plan-btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.nm {
  flex: 1;
}
.plan-n {
  font-size: 14px;
  margin-bottom: 6px;
}
.plan-n b {
  color: var(--brand);
  font-size: 20px;
  font-family: var(--font-display);
}
.plan-s {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-bottom: 14px;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.list-head .sec-t {
  margin-bottom: 0;
}
.row {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  margin-bottom: 10px;
  background: #fff;
}
.row.clickable {
  cursor: pointer;
  transition: border-color 0.15s;
}
.row.clickable:hover {
  border-color: var(--brand);
}
.row.done {
  opacity: 0.55;
}
.tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.time {
  font-size: 12px;
  color: var(--text-faint);
  margin-left: auto;
}
.q {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}
.row-ops {
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}
@media (max-width: 900px) {
  .mid {
    grid-template-columns: 1fr;
  }
}
</style>
