<template>
  <div class="book">
    <div class="stats">
      <div class="stat"><div class="num">{{ stats.total }}</div><div class="lb">练习总数</div></div>
      <div class="stat hl"><div class="num">{{ stats.pending }}</div><div class="lb">待复习</div></div>
      <div class="stat ok"><div class="num">{{ stats.mastered }}</div><div class="lb">已掌握</div></div>
      <div class="stat">
        <div class="num">{{ quizAccuracy }}<i>%</i></div>
        <div class="lb">自测正确率</div>
      </div>
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
          <el-tag size="small" effect="plain">{{ it.subject || '未分类' }}</el-tag>
          <el-tag v-if="hasErrorType(it)" size="small" type="danger" effect="light">
            {{ it.error_type }}
          </el-tag>
          <el-tag v-else size="small" type="primary" effect="light">待练习</el-tag>
          <el-tag v-for="k in it.knowledge_points || []" :key="k" size="small" effect="plain">
            {{ k }}
          </el-tag>
          <span class="time">{{ fmt(it.createdAt) }}</span>
        </div>
        <div class="q"><MathText :text="it.question" /></div>
        <div class="row-ops">
          <el-button link type="primary" @click.stop="emit('review', it)">查看解析</el-button>
          <el-button v-if="it.status !== '已掌握'" link type="success" @click.stop="mark(it.id, '已掌握')">
            标记已掌握
          </el-button>
          <el-button v-else link @click.stop="mark(it.id, '复习中')">重新复习</el-button>
          <el-button link type="danger" @click.stop="del(it.id)">删除</el-button>
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

const emit = defineEmits(['review', 'quiz'])

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
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.stat {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.stat .num {
  font-size: 26px;
  font-weight: 500;
}
.stat .lb {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 4px;
}
.stat.hl .num {
  color: var(--brand);
}
.stat.ok .num {
  color: var(--success);
}
.mid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.sec-t {
  font-size: 14px;
  font-weight: 500;
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
.stat .num i {
  font-size: 15px;
  font-style: normal;
  color: var(--text-sub);
  margin-left: 1px;
}
.nm {
  flex: 1;
}
.plan-n {
  font-size: 15px;
  margin-bottom: 6px;
}
.plan-n b {
  color: var(--brand);
  font-size: 20px;
}
.plan-s {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 14px;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.row {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.row.clickable {
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.row.clickable:hover {
  border-color: var(--brand);
  box-shadow: 0 2px 10px rgba(83, 74, 183, 0.12);
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
  color: var(--text-sub);
  margin-left: auto;
}
.q {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}
.row-ops {
  text-align: right;
}
@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .mid {
    grid-template-columns: 1fr;
  }
}
</style>
