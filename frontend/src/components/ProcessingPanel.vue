<template>
  <div class="processing">
    <div class="card">
      <img v-if="preview" :src="preview" class="thumb" alt="待识别的错题" />
      <el-progress :percentage="percent" :stroke-width="8" :show-text="false" />
      <div class="pct">{{ percent }}%</div>
      <ul class="steps">
        <li v-for="(s, i) in steps" :key="i" :class="cls(i)">
          <span class="dot"></span>
          <span>{{ s }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({ preview: String })

// 文案对「错题诊断」与「题目解答」两种模式均成立
const steps = [
  '读取题图 → 判断题型与学科',
  '检索关联知识 → 梳理解题路径',
  '生成完整解析 → 提炼知识点',
]
const percent = ref(8)
let timer = null

onMounted(() => {
  // 真实诊断由后端一次性返回，这里用渐进动画反馈等待状态
  timer = setInterval(() => {
    percent.value = Math.min(92, percent.value + Math.random() * 12 + 4)
  }, 700)
})

onUnmounted(() => clearInterval(timer))

function cls(i) {
  if (percent.value > (i + 1) * 30) return 'done'
  if (percent.value > i * 30) return 'active'
  return 'wait'
}
</script>

<style scoped>
.card {
  max-width: 520px;
  margin: 0 auto;
  text-align: center;
}
.thumb {
  max-height: 180px;
  max-width: 100%;
  object-fit: contain;
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.pct {
  font-size: 13px;
  color: var(--text-sub);
  margin: 8px 0 22px;
}
.steps {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  font-size: 14px;
  color: var(--text-sub);
}
.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border);
  flex: none;
}
.steps li.active {
  color: var(--brand);
}
.steps li.active .dot {
  border-color: var(--brand);
  background: var(--brand);
}
.steps li.done {
  color: var(--success);
}
.steps li.done .dot {
  border-color: var(--success);
  background: var(--success);
}
</style>
