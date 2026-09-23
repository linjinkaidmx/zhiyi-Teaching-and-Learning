<template>
  <div class="quiz">
    <!-- 阶段一：组卷设置 -->
    <div v-if="stage === 'setup'" class="card">
      <div class="title">自测</div>
      <div class="sub">系统会隐去答案，只看题干重新做一遍。答对累计，连续 2 次自动标记已掌握。</div>

      <div class="opt">
        <div class="opt-t">本次题量</div>
        <el-radio-group v-model="limit">
          <el-radio-button :value="5">5 题</el-radio-button>
          <el-radio-button :value="10">10 题</el-radio-button>
          <el-radio-button value="all">全部</el-radio-button>
        </el-radio-group>
      </div>

      <div class="opt">
        <div class="opt-t">范围</div>
        <el-switch v-model="includeMastered" active-text="把已掌握的题也算进来" />
      </div>

      <div class="avail">
        当前可抽 <b>{{ available }}</b> 题
        <span class="avail-s">优先抽：从未测过 &gt; 上次答错 &gt; 最久没测</span>
      </div>

      <div class="acts">
        <el-button type="primary" :disabled="!available" @click="start">开始自测</el-button>
        <el-button @click="emit('back')">返回练习本</el-button>
      </div>

      <el-empty v-if="!available" description="没有可测的题目，先去加入几道吧" :image-size="80" />
    </div>

    <!-- 阶段二：逐题作答 -->
    <div v-else-if="stage === 'quiz'" class="card">
      <div class="bar">
        <div class="prog">
          第 <b>{{ idx + 1 }}</b> / {{ papers.length }} 题
          <el-tag size="small" effect="plain">{{ cur.subject || '未分类' }}</el-tag>
        </div>
        <el-button link @click="quit">结束本次自测</el-button>
      </div>
      <el-progress :percentage="Math.round((idx / papers.length) * 100)" :stroke-width="6" :show-text="false" />

      <div class="stem-box">
        <div class="stem-t">题目</div>
        <div class="stem"><MathText :text="cur.question" /></div>
      </div>

      <div class="hint-row">
        <el-button v-if="!showHint" link type="warning" @click="showHint = true">
          想不起来？给我知识点提示
        </el-button>
        <div v-else class="hint">
          <el-tag v-for="k in cur.knowledge_points || []" :key="k" size="small" effect="plain">{{ k }}</el-tag>
          <el-tag v-if="!(cur.knowledge_points || []).length" size="small" type="info" effect="plain">
            这道题没有记录知识点
          </el-tag>
        </div>
      </div>

      <div class="input-t">你的作答</div>
      <el-input
        v-model="answer"
        type="textarea"
        :rows="5"
        resize="vertical"
        :readonly="committed"
        placeholder="把你的答案或解题思路写在这里。格式不必与标准答案完全一致，数学含义对就算对。"
      />

      <!-- 提交后：对照区 -->
      <div v-if="committed" class="reveal">
        <div class="rev-head">答案与解析</div>
        <div v-if="cur.correct_answer" class="block">
          <div class="block-t">标准答案</div>
          <div class="correct"><MathText :text="cur.correct_answer" /></div>
        </div>
        <div v-else class="nostd">
          这道题没有记录标准答案，请对照下面的解析自行判断。
        </div>
        <div v-if="(cur.solution_steps || []).length" class="block">
          <div class="block-t">分步解析</div>
          <ol class="steps">
            <li v-for="(s, i) in cur.solution_steps" :key="i"><MathText :text="s" /></li>
          </ol>
        </div>

        <div v-if="ai" class="ai">
          <div class="ai-head">
            <span class="ai-badge" :class="ai.verdict">AI 批改</span>
            <el-tag :type="AI_TEXT[ai.verdict].type" effect="light" size="small">
              {{ AI_TEXT[ai.verdict].label }}
            </el-tag>
          </div>
          <div class="ai-comment"><MathText :text="ai.comment" /></div>
          <div v-if="ai.key_mistake" class="ai-mistake">关键问题：<MathText :text="ai.key_mistake" /></div>
          <div class="ai-note">AI 判定仅供参考，最终以你自己的判断为准。</div>
        </div>

        <div class="judge">
          <div class="judge-t">你对这次作答的评价</div>
          <div class="judge-btns">
            <el-button type="success" @click="grade(true)">我答对了</el-button>
            <el-button type="danger" @click="grade(false)">还是不会</el-button>
            <el-button :loading="judging" :disabled="!!ai" @click="askAI">
              {{ ai ? '已批改' : '让 AI 帮我批改' }}
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="acts">
        <el-button type="primary" :disabled="!answer.trim()" @click="commit">提交作答</el-button>
        <el-button @click="answer = ''">清空</el-button>
      </div>
    </div>

    <!-- 阶段三：成绩单 -->
    <div v-else class="card">
      <div class="score">
        <div class="score-n">{{ stats.correct }}<span>/{{ results.length }}</span></div>
        <div class="score-l">
          本次正确率 <b>{{ stats.rate }}%</b>
          <div class="score-s">自测累计正确率 {{ accuracy }}%</div>
        </div>
      </div>

      <div v-if="weak.length" class="weak">
        <div class="block-t">还需要巩固的知识点</div>
        <el-tag v-for="k in weak" :key="k" type="danger" effect="light" class="weak-tag">{{ k }}</el-tag>
      </div>

      <div class="rev-list">
        <div v-for="(it, i) in results" :key="it.id" class="rev-row">
          <span class="idx">{{ i + 1 }}</span>
          <span class="mk" :class="it.ok ? 'ok' : 'no'">{{ it.ok ? '答对' : '答错' }}</span>
          <span class="rv-q">{{ it.question }}</span>
          <span class="rv-s" :class="it.after === '已掌握' ? 'ok' : ''">
            {{ it.before }} → {{ it.after }}
          </span>
        </div>
      </div>

      <div class="acts">
        <el-button type="primary" @click="stage = 'setup'">再测一组</el-button>
        <el-button @click="emit('back')">回到练习本</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import MathText from './MathText.vue'
import { getQuizList, submitQuizResult, getQuizAccuracy } from '../utils/storage'
import { judgeAnswer } from '../api/diagnose'

const emit = defineEmits(['back'])

const AI_TEXT = {
  correct: { label: '回答正确', type: 'success' },
  partial: { label: '部分正确', type: 'warning' },
  wrong: { label: '回答有误', type: 'danger' },
}

const stage = ref('setup') // setup | quiz | result
const limit = ref(5)
const includeMastered = ref(false)

const papers = ref([])
const idx = ref(0)
const answer = ref('')
const committed = ref(false)
const showHint = ref(false)
const judging = ref(false)
const ai = ref(null)
const results = ref([])

const available = computed(() => getQuizList({ limit: 'all', includeMastered: includeMastered.value }).length)
const cur = computed(() => papers.value[idx.value] || {})

const stats = computed(() => {
  const ok = results.value.filter((x) => x.ok).length
  return {
    correct: ok,
    rate: results.value.length ? Math.round((ok / results.value.length) * 100) : 0,
  }
})
const accuracy = computed(() => getQuizAccuracy())
const weak = computed(() => {
  const m = new Map()
  results.value
    .filter((x) => !x.ok)
    .forEach((x) => (x.knowledge_points || []).forEach((k) => m.set(k, (m.get(k) || 0) + 1)))
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((x) => x[0])
})

function start() {
  const list = getQuizList({ limit: limit.value, includeMastered: includeMastered.value })
  if (!list.length) return ElMessage.warning('没有可测的题目')
  papers.value = list
  results.value = []
  idx.value = 0
  resetItem()
  stage.value = 'quiz'
}

function resetItem() {
  answer.value = ''
  committed.value = false
  showHint.value = false
  judging.value = false
  ai.value = null
}

function commit() {
  if (!answer.value.trim()) return ElMessage.warning('先写点答案再提交')
  committed.value = true
}

async function askAI() {
  judging.value = true
  try {
    const res = await judgeAnswer({
      question: cur.value.question || '',
      correct_answer: cur.value.correct_answer || '',
      user_answer: answer.value,
    })
    if (res.success && res.data) {
      ai.value = res.data
      ElMessage.success('AI 批改完成')
    } else {
      ElMessage.error(res.error || 'AI 批改失败，可以自行对照下面的答案')
    }
  } catch (e) {
    ElMessage.error('批改请求失败：' + (e.response?.data?.detail || e.message))
  } finally {
    judging.value = false
  }
}

function grade(ok) {
  const it = cur.value
  const before = it.status || '未掌握'
  const saved = submitQuizResult(it.id, ok)
  results.value.push({
    id: it.id,
    question: it.question,
    knowledge_points: it.knowledge_points || [],
    ok,
    before,
    after: saved?.status || before,
  })
  next()
}

function next() {
  if (idx.value + 1 >= papers.value.length) {
    stage.value = 'result'
    return
  }
  idx.value++
  resetItem()
}

/** 中途退出：已经答过的题仍然计入，未答的不计 */
function quit() {
  if (!results.value.length) {
    stage.value = 'setup'
    return
  }
  stage.value = 'result'
}
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}
.title {
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 6px;
}
.sub {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.7;
  margin-bottom: 20px;
}
.opt {
  margin-bottom: 18px;
}
.opt-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 8px;
}
.avail {
  font-size: 13px;
  color: var(--text-sub);
  background: var(--bg);
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.avail b {
  color: var(--brand);
  font-size: 16px;
}
.avail-s {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
.acts {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.prog {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.prog b {
  color: var(--brand);
  font-size: 17px;
}
.stem-box {
  margin: 18px 0 14px;
}
.stem-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.stem {
  font-size: 15px;
  line-height: 1.8;
  background: var(--bg);
  padding: 14px 16px;
  border-radius: 8px;
}
.hint-row {
  min-height: 30px;
  margin-bottom: 8px;
}
.hint {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.input-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.reveal {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}
.rev-head {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}
.block {
  margin-bottom: 14px;
}
.block-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.correct {
  font-size: 15px;
  line-height: 1.7;
  color: var(--success);
  background: #eaf3de;
  padding: 12px 14px;
  border-radius: 8px;
}
.nostd {
  font-size: 13px;
  color: var(--text-sub);
  background: var(--bg);
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 14px;
}
.steps {
  padding-left: 20px;
  margin: 0;
}
.steps li {
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 8px;
}
.ai {
  background: var(--brand-soft);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.ai-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ai-badge {
  font-size: 13px;
  font-weight: 500;
}
.ai-comment {
  font-size: 14px;
  line-height: 1.7;
}
.ai-mistake {
  font-size: 13px;
  color: var(--danger);
  margin-top: 6px;
}
.ai-note {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 8px;
}
.judge {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.judge-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 10px;
}
.judge-btns {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.score {
  display: flex;
  align-items: baseline;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
}
.score-n {
  font-size: 42px;
  font-weight: 500;
  color: var(--brand);
  line-height: 1;
}
.score-n span {
  font-size: 20px;
  color: var(--text-sub);
}
.score-l {
  font-size: 14px;
}
.score-l b {
  color: var(--success);
  font-size: 18px;
}
.score-s {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 4px;
}
.weak {
  margin-bottom: 18px;
}
.weak-tag {
  margin: 0 8px 8px 0;
  white-space: normal;
  height: auto;
  line-height: 1.5;
  padding: 4px 10px;
}
.rev-list {
  margin-bottom: 20px;
}
.rev-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.idx {
  width: 22px;
  color: var(--text-sub);
  flex: none;
}
.mk {
  flex: none;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.mk.ok {
  color: var(--success);
  background: #eaf3de;
}
.mk.no {
  color: var(--danger);
  background: #fde3e3;
}
.rv-q {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rv-s {
  flex: none;
  font-size: 12px;
  color: var(--text-sub);
}
.rv-s.ok {
  color: var(--success);
}
</style>
