<template>
  <el-dialog
    :model-value="visible"
    title="加入练习本 · 确认题面"
    width="620px"
    :close-on-click-modal="false"
    @update:model-value="(v) => emit('update:visible', v)"
  >
    <div class="tip">
      AI 已从图片中提取出下面这些信息。<b>建议顺手校对一遍再入库</b>，
      尤其是公式里的符号和下标——自测时看到的就是这段文字。
    </div>

    <el-alert
      v-if="!form.question.trim()"
      type="warning"
      :closable="false"
      show-icon
      class="warn"
      title="没有识别到题干文字，请手动填写，否则自测时这道题会显示为空白。"
    />

    <el-form label-position="top" class="form">
      <el-form-item label="题目题干">
        <el-input v-model="form.question" type="textarea" :rows="3" resize="vertical" />
        <div v-if="form.question.trim()" class="preview">
          <span class="preview-t">预览</span>
          <MathText :text="form.question" />
        </div>
      </el-form-item>

      <div class="two">
        <el-form-item label="学科">
          <el-input v-model="form.subject" placeholder="如：高等数学" />
        </el-form-item>
        <el-form-item label="来源">
          <el-tag :type="SOURCE_META[form.source].type" effect="light" class="src-tag">
            {{ SOURCE_META[form.source].label }}
          </el-tag>
        </el-form-item>
      </div>

      <el-form-item label="知识点">
        <div class="kp">
          <el-tag
            v-for="(k, i) in form.knowledge_points"
            :key="k + i"
            closable
            effect="plain"
            class="kp-tag"
            @close="removeKp(i)"
          >
            {{ k }}
          </el-tag>
          <el-input
            v-model="kpInput"
            size="small"
            placeholder="添加知识点后回车"
            class="kp-input"
            @keyup.enter="addKp"
          />
        </div>
      </el-form-item>

      <el-form-item label="正确答案">
        <el-input v-model="form.correct_answer" type="textarea" :rows="2" resize="vertical" />
        <div v-if="form.correct_answer.trim()" class="preview">
          <span class="preview-t">预览</span>
          <MathText :text="form.correct_answer" />
        </div>
      </el-form-item>

      <el-form-item v-if="form.error_type" label="错因">
        <el-tag type="danger" effect="light">{{ form.error_type }}</el-tag>
        <span v-if="form.error_step > 0" class="step">出错在第 {{ form.error_step }} 步</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!form.question.trim()" @click="confirm">确认加入</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import MathText from './MathText.vue'

const props = defineProps({
  visible: Boolean,
  record: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:visible', 'confirm'])

const SOURCE_META = {
  diagnose: { label: '拍错题 · 错因诊断', type: 'danger' },
  solve: { label: '拍题 · 题目解答', type: 'success' },
  bank: { label: '同类题推荐', type: 'primary' },
}

const form = reactive({
  question: '',
  subject: '',
  source: 'diagnose',
  knowledge_points: [],
  correct_answer: '',
  error_type: '',
  error_step: 0,
})

const kpInput = ref('')

watch(
  () => [props.visible, props.record],
  () => {
    if (!props.visible) return
    const r = props.record || {}
    form.question = r.question || ''
    form.subject = r.subject || ''
    form.source = r.source || 'diagnose'
    form.knowledge_points = [...(r.knowledge_points || [])]
    form.correct_answer = r.correct_answer || ''
    form.error_type = r.error_type || ''
    form.error_step = r.error_step || 0
    kpInput.value = ''
  },
  { immediate: true, deep: true }
)

function addKp() {
  const v = kpInput.value.trim()
  if (!v) return
  if (!form.knowledge_points.includes(v)) form.knowledge_points.push(v)
  kpInput.value = ''
}

function removeKp(i) {
  form.knowledge_points.splice(i, 1)
}

function confirm() {
  emit('confirm', {
    question: form.question.trim(),
    subject: form.subject.trim(),
    knowledge_points: [...form.knowledge_points],
    correct_answer: form.correct_answer.trim(),
  })
  emit('update:visible', false)
}
</script>

<style scoped>
.tip {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-sub);
  background: var(--bg);
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 14px;
}
.warn {
  margin-bottom: 14px;
}
.form :deep(.el-form-item) {
  margin-bottom: 14px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.src-tag {
  height: 32px;
  line-height: 30px;
}
.kp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: 100%;
}
.kp-tag {
  white-space: normal;
  height: auto;
  line-height: 1.5;
  padding: 4px 10px;
}
.kp-input {
  width: 160px;
}
.step {
  font-size: 13px;
  color: var(--text-sub);
  margin-left: 10px;
}
.preview {
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.8;
}
.preview-t {
  font-size: 12px;
  color: var(--text-sub);
  margin-right: 8px;
}
</style>
