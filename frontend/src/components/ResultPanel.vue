<!-- [LEGACY-P8] 本组件已无任何引用（功能已迁到 pages/* 与 ui/*），
     保留文件仅为回看对照，可随时删除。它仍引用 Element Plus，但不在构建图里。 -->
<template>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px">
      <h3 class="section-title">题目讲解</h3>
      <div style="display: flex; gap: 10px; flex-shrink: 0">
        <el-button size="small" @click="$emit('back')">返回重出题</el-button>
        <el-button v-if="showSave" size="small" type="primary" @click="save">存入错题本</el-button>
      </div>
    </div>

    <!-- 题干 -->
    <div class="block">
      <div class="label">题目</div>
      <MathText :content="question" />
      <template v-if="result.question_type || result.subject || result.source === 'bank'">
        <el-tag v-if="result.source === 'bank'" size="small" type="success" style="margin-top: 8px; margin-right: 8px">题库秒答</el-tag>
        <el-tag size="small" style="margin-top: 8px; margin-right: 8px" type="info">{{ result.subject }}</el-tag>
        <el-tag size="small" style="margin-top: 8px">{{ result.question_type }}</el-tag>
      </template>
      <div v-if="matchedAlgo" style="margin-top: 10px">
        <el-button size="small" type="success" plain @click="$emit('go-algo', matchedAlgo)">
          看动画演示：{{ ALGORITHMS[matchedAlgo].name }} ↗
        </el-button>
      </div>
    </div>

    <!-- 答案 -->
    <div class="block">
      <div class="label">答案</div>
      <div class="answer-box"><MathText :content="result.answer" /></div>
    </div>

    <!-- 代码题：可编辑并在线运行 -->
    <div v-if="codeInfo" class="block">
      <div class="label">动手试试（可修改后运行）</div>
      <CodeEditor :code="codeInfo.code" :language="codeInfo.lang" />
    </div>

    <!-- 步骤 -->
    <div class="block">
      <div class="label">解题步骤</div>
      <div v-for="(s, i) in result.steps" :key="i" class="step">
        <div class="step-no">{{ i + 1 }}. <MathText :content="s.title" /></div>
        <MathText :content="s.detail" />
      </div>
    </div>

    <!-- 突破口 -->
    <div v-if="result.key_breakthrough" class="block">
      <div class="label">关键突破口</div>
      <MathText :content="result.key_breakthrough" />
    </div>

    <!-- 知识点系统讲解 -->
    <div v-if="result.knowledge_review" class="block">
      <div class="label">知识点系统讲解
        <el-tag v-for="k in result.knowledge_points" :key="k" size="small" effect="plain" style="margin-left: 6px">{{ k }}</el-tag>
      </div>
      <MathText :content="result.knowledge_review" />
    </div>

    <!-- 错因诊断 -->
    <div v-if="result.diagnosis" class="block">
      <div class="label">错因诊断</div>
      <div class="diagnosis"><MathText :content="result.diagnosis" /></div>
    </div>

    <!-- 举一反三：可点击，点进去走完整讲解 -->
    <div v-if="result.extensions && result.extensions.length" class="block">
      <div class="label">举一反三（点击任意变式题可查看完整解答）</div>
      <div
        v-for="(e, i) in result.extensions"
        :key="i"
        class="ext-card"
        :class="{ done: isExplained(e) }"
        @click="onVariant(e)"
      >
        <span class="ext-no">{{ i + 1 }}</span>
        <div class="ext-body"><MathText :content="e" /></div>
        <span class="ext-action">{{ isExplained(e) ? '已讲解 ›' : '查看解答 ›' }}</span>
      </div>
    </div>

    <!-- 追问老师：带着题干与讲解上下文的多轮问答（流式） -->
    <div class="block">
      <div class="label">追问老师</div>
      <FollowUpPanel
        :question="question"
        :result="result"
        :followups="followups"
        @update="(list) => emit('update-followups', list)"
      />
    </div>

    <!-- 换个讲法：换角度重讲，不覆盖原讲解 -->
    <div class="block">
      <div class="label">换个讲法</div>
      <ReteachPanel
        :question="question"
        :result="result"
        :reteach="reteach"
        @update="(list) => emit('update-reteach', list)"
      />
    </div>

    <!-- 针对性练习：基于本题知识点让 AI 出新题练手 -->
    <div class="block">
      <div class="label">针对性练习</div>
      <PracticePanel
        :knowledge-points="result.knowledge_points || []"
        :reference-question="question"
        :subject="result.subject || ''"
        @save="(p) => emit('save-practice', p)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import MathText from './MathText.vue'
import CodeEditor from './CodeEditor.vue'
import { matchAlgo, ALGORITHMS } from '../algorithms'
import PracticePanel from './PracticePanel.vue'
import FollowUpPanel from './FollowUpPanel.vue'
import ReteachPanel from './ReteachPanel.vue'

const props = defineProps({
  question: { type: String, default: '' },
  attempt: { type: String, default: '' },
  result: { type: Object, required: true },
  showSave: { type: Boolean, default: true },
  explainedTexts: { type: Array, default: () => [] }, // 已讲解过的题面，用于标记变式题状态
  followups: { type: Array, default: () => [] },     // 该题的追问记录
  reteach: { type: Array, default: () => [] },       // 该题的「换个讲法」版本
})
const emit = defineEmits(['back', 'saved', 'explain-variant', 'go-algo', 'save-practice', 'update-followups', 'update-reteach'])

function isExplained(text) {
  return props.explainedTexts.includes((text || '').trim())
}

/** 题目对应的算法演示（命中则提供「看动画演示」入口） */
const matchedAlgo = computed(() => matchAlgo(props.question, props.result.knowledge_points))

/** 代码题检测：题目/答案/步骤中若含 ``` 代码块，则提供一个可运行的编辑器 */
const codeInfo = computed(() => {
  const parts = [
    props.question || '',
    props.result.answer || '',
    ...(props.result.steps || []).map((s) => s.detail || ''),
  ]
  const src = parts.join('\n')
  const m = src.match(/```([a-zA-Z0-9+#]*)\n([\s\S]*?)```/)
  if (!m) return null
  const raw = (m[1] || '').toLowerCase()
  let lang = 'python'
  if (raw === 'c' || raw === 'cpp' || raw === 'c++' || raw === 'java') lang = 'c'
  else if (raw.includes('py')) lang = 'python'
  const code = (m[2] || '').trim()
  if (!code) return null
  return { lang, code }
})

function onVariant(text) {
  emit('explain-variant', text)
}

function save() {
  emit('saved')
  ElMessage.success('已存入错题本')
}
</script>

<style scoped>
.block { margin-top: 18px; }
.label {
  font-size: 13px;
  font-weight: 600;
  color: #6b7686;
  margin-bottom: 8px;
}
.answer-box {
  background: #f0f5f0;
  border: 1px solid #d8e6d8;
  border-radius: 8px;
  padding: 12px 14px;
}
.step { padding: 8px 0 8px 14px; border-left: 2px solid #e5e8ee; margin-bottom: 6px; }
.step-no { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
.diagnosis {
  background: #fdf6ec;
  border: 1px solid #f3e0c0;
  border-radius: 8px;
  padding: 12px 14px;
}
.ext-card {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  background: #fdfdfe;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.ext-card:hover {
  border-color: #185fa5;
  background: #f5f9ff;
}
.ext-card.done {
  border-style: dashed;
  background: #f7f8fa;
}
.ext-body { flex: 1; min-width: 0; font-size: 14px; line-height: 1.6; }
.ext-action {
  flex-shrink: 0;
  font-size: 12px;
  color: #185fa5;
}
.ext-card.done .ext-action { color: #888780; }
.ext-no {
  flex-shrink: 0;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #e9edf5;
  color: #35507a;
  font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center;
}
</style>
