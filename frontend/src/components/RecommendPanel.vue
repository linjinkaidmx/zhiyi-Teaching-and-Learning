<template>
  <div class="card rec">
    <div class="head">
      <div>
        <div class="title">举一反三 · 同类题推荐</div>
        <div class="sub">根据「知识点 + 错因」双维度匹配，难度递进训练</div>
      </div>
      <el-button text @click="emit('close')">收起</el-button>
    </div>

    <div v-if="list.length" class="list">
      <div v-for="q in list" :key="q.id" class="item">
        <div class="meta">
          <el-tag
            size="small"
            :type="q.difficulty === '基础' ? 'success' : q.difficulty === '进阶' ? 'warning' : 'danger'"
            effect="plain"
          >
            {{ q.difficulty }}
          </el-tag>
          <span class="q-text"><MathText :text="q.question" /></span>
        </div>
        <div class="ops">
          <el-button link type="primary" @click="toggle(q.id)">
            {{ expanded === q.id ? '收起' : '查看答案' }}
          </el-button>
          <el-divider direction="vertical" />
          <el-button link type="success" :disabled="saved(q)" @click="join(q)">
            {{ saved(q) ? '已在练习本' : '加入练习本' }}
          </el-button>
        </div>
        <div v-if="expanded === q.id" class="detail">
          <div><b>思路：</b><MathText :text="q.hint" /></div>
          <div class="ans"><b>答案：</b><MathText :text="q.answer" /></div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂未匹配到同类题，先积累更多错题吧" :image-size="80" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MathText from './MathText.vue'
import { recommendSimilar, fallbackQuestions } from '../utils/recommend'

const props = defineProps({
  result: Object,
  joinedIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'join'])
const expanded = ref(null)

const list = computed(() => {
  const hit = recommendSimilar(props.result, 4)
  return hit.length ? hit : fallbackQuestions(props.result?.subject, 3)
})

function toggle(id) {
  expanded.value = expanded.value === id ? null : id
}

/** 题库题的 id 是数字，练习本记录 id 是字符串，统一前缀后比较避免误判 */
function saved(q) {
  return (props.joinedIds || []).includes(String(q.id))
}

/**
 * 题库题转成练习本记录的结构。
 * 题库没有错因与错误步骤，source 标为 bank，练习本列表据此显示「待练习」而非错因标签。
 */
function join(q) {
  emit('join', {
    // 沿用题库 id，便于练习本去重
    id: String(q.id),
    source: 'bank',
    subject: q.subject || '',
    question: q.question || '',
    knowledge_points: q.knowledge_points || [],
    correct_answer: q.answer || '',
    solution_steps: q.hint ? [`思路提示：${q.hint}`] : [],
    difficulty: q.difficulty || '',
  })
}
</script>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.title {
  font-size: 16px;
  font-weight: 500;
}
.sub {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 4px;
}
.item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.meta {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.q-text {
  font-size: 14px;
  line-height: 1.6;
  flex: 1;
}
.ops {
  text-align: right;
  margin-top: 4px;
}
.detail {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--brand-light);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
}
.ans {
  color: var(--success);
  margin-top: 4px;
}
</style>
