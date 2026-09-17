<template>
  <div class="result">
    <div class="left card">
      <div class="label">原题</div>
      <img v-if="preview" :src="preview" class="origin" alt="原题图片" />
      <div v-else class="no-img">该记录未保存原图</div>
      <div class="cap">{{ preview ? '原图 · 点击放大' : '仅保留了文字信息' }}</div>
    </div>

    <div class="right card">
      <div class="mode-bar">
        <el-tag v-if="isDiagnose" type="danger" effect="dark" size="small">错因诊断</el-tag>
        <el-tag v-else type="success" effect="dark" size="small">题目解答</el-tag>
        <el-tag v-if="r.subject" type="primary" effect="light" size="small">{{ r.subject }}</el-tag>
        <el-tag v-for="k in r.knowledge_points || []" :key="k" size="small" effect="plain">
          {{ k }}
        </el-tag>
        <el-tag v-if="isDiagnose && r.error_type" type="danger" effect="light" size="small">
          {{ r.error_type }}
        </el-tag>
      </div>

      <div v-if="!isInvalid && r.question" class="stem">
        <div class="block-t">题目原文</div>
        <div class="qbox"><MathText :text="r.question" /></div>
      </div>

      <el-empty
        v-if="isInvalid"
        :description="r.tip || '未能识别到题目内容，请换一张更清晰的图片'"
        :image-size="90"
      />

      <el-tabs v-else v-model="tab" class="tabs">
        <el-tab-pane v-if="isDiagnose" label="诊断摘要" name="summary">
          <div class="err-title">{{ r.error_type }}</div>
          <div v-if="r.error_step > 0" class="err-step">
            错误出现在第 <b>{{ r.error_step }}</b> 步
          </div>
          <div class="block">
            <div class="block-t">错因分析</div>
            <div class="analysis"><MathText :text="r.error_analysis" /></div>
          </div>
          <div class="block">
            <div class="block-t">正确答案</div>
            <div class="correct"><MathText :text="r.correct_answer" /></div>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="isDiagnose" label="你的作答" name="answer">
          <pre class="answer"><MathText :text="r.student_answer" /></pre>
        </el-tab-pane>

        <el-tab-pane v-if="!isDiagnose" label="题目" name="question">
          <div class="block">
            <div class="block-t">答案</div>
            <div class="correct"><MathText :text="r.correct_answer" /></div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="分步解析" name="steps">
          <ol class="solutions">
            <li
              v-for="(s, i) in r.solution_steps || []"
              :key="i"
              :class="{ wrong: isDiagnose && i + 1 === r.error_step }"
            >
              <MathText :text="s" />
            </li>
          </ol>
        </el-tab-pane>

        <el-tab-pane label="知识拓展" name="knowledge">
          <div v-if="r.key_insight" class="block">
            <div class="block-t">解题关键</div>
            <div class="insight"><MathText :text="r.key_insight" /></div>
          </div>
          <div v-if="r.knowledge_explanation" class="block">
            <div class="block-t">知识点讲解</div>
            <div class="analysis"><MathText :text="r.knowledge_explanation" /></div>
          </div>
          <div v-if="(r.related_points || []).length" class="block">
            <div class="block-t">延伸学习</div>
            <div class="related">
              <el-tag v-for="p in r.related_points" :key="p" effect="plain" class="rp">
                {{ p }}
              </el-tag>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <div class="actions">
        <el-button v-if="!isInvalid" type="primary" :disabled="saved" @click="join">
          {{ saved ? '已在练习本中' : '加入练习本' }}
        </el-button>
        <el-button v-if="!isInvalid" @click="emit('recommend')">举一反三 · 看同类题</el-button>
        <el-button @click="emit('reset')">{{ isDiagnose ? '再诊断一道' : '再拍一道' }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import MathText from './MathText.vue'

const props = defineProps({
  preview: String,
  result: Object,
  // 已存在于练习本中的记录 id，用于控制按钮态
  joinedIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['reset', 'recommend', 'join'])

const r = computed(() => props.result || {})
// 历史练习本记录没有 mode 字段，按 diagnose 兼容处理
const mode = computed(() => r.value.mode || 'diagnose')
const isDiagnose = computed(() => mode.value === 'diagnose')
const isInvalid = computed(() => mode.value === 'invalid')
const saved = computed(() => !!r.value.id && (props.joinedIds || []).includes(r.value.id))

const tab = ref(isDiagnose.value ? 'summary' : 'question')

function join() {
  emit('join', { ...r.value, source: isDiagnose.value ? 'diagnose' : 'solve' })
}
</script>

<style scoped>
.result {
  display: grid;
  grid-template-columns: 40% 60%;
  gap: 20px;
}
.label {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 10px;
}
.origin {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: zoom-in;
}
.no-img {
  width: 100%;
  padding: 40px 0;
  text-align: center;
  color: var(--text-sub);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
.cap {
  font-size: 12px;
  color: var(--text-sub);
  text-align: center;
  margin-top: 10px;
}
.mode-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.stem {
  margin-bottom: 16px;
}
.tabs {
  min-height: 280px;
}
.err-title {
  font-size: 19px;
  font-weight: 500;
  color: var(--danger);
  margin-bottom: 6px;
}
.err-step {
  font-size: 14px;
  color: var(--text-sub);
  margin-bottom: 18px;
}
.block {
  margin-bottom: 18px;
}
.block-t {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.qbox {
  font-size: 15px;
  line-height: 1.8;
  background: var(--bg);
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 18px;
}
.analysis,
.insight {
  font-size: 14px;
  line-height: 1.75;
  background: var(--brand-light);
  padding: 12px 14px;
  border-radius: 8px;
}
.correct {
  font-size: 15px;
  line-height: 1.7;
  color: var(--success);
  background: #eaf3de;
  padding: 12px 14px;
  border-radius: 8px;
}
.answer {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
  color: var(--text);
}
.solutions {
  padding-left: 20px;
  margin: 0;
}
.solutions li {
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 10px;
}
.solutions li.wrong {
  color: var(--danger);
}
.related {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rp {
  white-space: normal;
  height: auto;
  line-height: 1.5;
  padding: 4px 10px;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
@media (max-width: 900px) {
  .result {
    grid-template-columns: 1fr;
  }
}
</style>
