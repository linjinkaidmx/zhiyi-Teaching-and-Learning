<!-- [LEGACY-P8] 本组件已无任何引用（功能已迁到 pages/* 与 ui/*），
     保留文件仅为回看对照，可随时删除。它仍引用 Element Plus，但不在构建图里。 -->
<template>
  <div class="practice">
    <!-- 未出题 -->
    <div v-if="!quiz && !generating">
      <el-button size="small" type="primary" plain @click="generate">练一练 ▶</el-button>
      <span class="muted" style="margin-left: 8px">让 AI 出一道同类题练手</span>
    </div>

    <!-- 出题中 -->
    <div v-else-if="generating" class="center muted">
      <el-progress :indeterminate="true" :duration="2" :show-text="false" style="width: 180px" />
      <div style="margin-top: 6px">正在出题…</div>
    </div>

    <!-- 题目与作答 -->
    <div v-else class="quiz-box">
      <div class="label">练习题<span class="muted" style="font-weight: 400">（AI 生成）</span></div>
      <div class="q"><MathText :content="quiz.question" /></div>

      <!-- 作答区 -->
      <div v-if="!judgeData">
        <el-input
          v-model="answer"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="写下你的答案、思路或代码"
        />
        <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap">
          <el-button size="small" type="primary" :loading="judging" :disabled="!answer.trim()" @click="submit">
            提交答案
          </el-button>
          <el-button size="small" @click="generate">换一题</el-button>
        </div>
      </div>

      <!-- 判分反馈 -->
      <div v-else class="feedback">
        <div class="fb-head">
          <el-tag :type="verdictTag" size="small">{{ verdictText }}</el-tag>
          <span class="muted">得分 {{ judgeData.score }}</span>
        </div>
        <div v-if="judgeData.comment" class="fb-item">
          <div class="label">批改意见</div>
          <MathText :content="judgeData.comment" />
        </div>
        <div class="fb-item">
          <div class="label">参考答案</div>
          <MathText :content="quiz.answer" />
        </div>
        <div v-if="quiz.analysis" class="fb-item">
          <div class="label">解析</div>
          <MathText :content="quiz.analysis" />
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <el-button size="small" type="primary" plain @click="saveToBook">存入错题本</el-button>
          <el-button size="small" @click="generate">再来一道</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import MathText from './MathText.vue'
import { api } from '../api'
import { recordAction } from '../statsStore'

const props = defineProps({
  knowledgePoints: { type: Array, default: () => [] },
  referenceQuestion: { type: String, default: '' },
  subject: { type: String, default: '' },
})
const emit = defineEmits(['save'])

const quiz = ref(null)
const answer = ref('')
const judgeData = ref(null)
const generating = ref(false)
const judging = ref(false)

const verdictTag = computed(() => {
  const v = judgeData.value?.verdict
  if (v === 'correct') return 'success'
  if (v === 'partial') return 'warning'
  return 'danger'
})
const verdictText = computed(() => {
  const v = judgeData.value?.verdict
  return { correct: '正确', partial: '部分正确', wrong: '需要改进' }[v] || '已批改'
})

async function generate() {
  generating.value = true
  judgeData.value = null
  answer.value = ''
  try {
    quiz.value = await api.generateQuiz(props.knowledgePoints, props.referenceQuestion, props.subject)
  } catch (e) {
    ElMessage.error(e.message)
    quiz.value = null
  } finally {
    generating.value = false
  }
}

async function submit() {
  if (!answer.value.trim() || !quiz.value) return
  judging.value = true
  try {
    judgeData.value = await api.judge(
      quiz.value.question,
      quiz.value.answer,
      answer.value,
      [],
      quiz.value.analysis || '',
      quiz.value.knowledge_points || props.knowledgePoints,
    )
    // 打卡埋点：针对性练习作答（答对计入正确数）
    recordAction('practice', { correct: judgeData.value?.verdict === 'correct' })
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    judging.value = false
  }
}

function saveToBook() {
  if (!quiz.value) return
  // 结构与 MultiResult 的 save-item 一致，便于上层直接复用保存逻辑
  emit('save', {
    text: quiz.value.question,
    attempt: answer.value || '',
    result: {
      subject: quiz.value.subject || props.subject || '未分类',
      question_type: quiz.value.question_type || '练习题',
      answer: quiz.value.answer,
      steps: quiz.value.analysis ? [{ title: '解析', detail: quiz.value.analysis }] : [],
      key_breakthrough: '',
      knowledge_points: quiz.value.knowledge_points || props.knowledgePoints || [],
      knowledge_review: quiz.value.analysis || '',
      extensions: [],
      diagnosis: judgeData.value?.comment || '',
    },
  })
  ElMessage.success('已存入错题本')
}
</script>

<style scoped>
.practice { margin-top: 8px; }
.center { text-align: center; padding: 12px 0; }
.label {
  font-size: 13px;
  font-weight: 600;
  color: #6b7686;
  margin: 10px 0 6px;
}
.quiz-box {
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fdfdfe;
}
.q { font-size: 14px; line-height: 1.7; }
.feedback { margin-top: 10px; }
.fb-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.fb-item { margin-top: 8px; }
</style>
