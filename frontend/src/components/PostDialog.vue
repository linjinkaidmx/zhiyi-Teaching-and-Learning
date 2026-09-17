<template>
  <el-dialog v-model="visible" title="发帖" width="560px" :close-on-click-modal="false">
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="帖子类型">
        <el-radio-group v-model="form.type" :disabled="!!preset">
          <el-radio value="question">错题分享</el-radio>
          <el-radio value="text">经验讨论</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="!preset && form.type === 'question'" label="从练习本导入（可选）">
        <el-select v-model="importId" placeholder="选择练习本里的一道题" clearable filterable
          @change="onImport">
          <el-option v-for="it in myBook" :key="it.id" :value="String(it.id)"
            :label="truncate(it.question || it.id)" />
        </el-select>
      </el-form-item>

      <el-form-item label="标题">
        <el-input v-model="form.title" maxlength="80" show-word-limit
          placeholder="一句话说清这篇帖子" />
      </el-form-item>

      <template v-if="form.type === 'question'">
        <el-form-item label="题干">
          <el-input v-model="form.question" type="textarea" :rows="3" />
          <div class="preview"><MathText :text="form.question" /></div>
        </el-form-item>
        <el-form-item label="知识点（回车添加）">
          <div class="kp-editor">
            <el-tag v-for="(k, i) in form.knowledgePoints" :key="k" closable
              @close="form.knowledgePoints.splice(i, 1)">
              {{ k }}
            </el-tag>
            <el-input v-model="kpInput" class="kp-input" size="small"
              placeholder="如：二叉树遍历" @keydown.enter.prevent="addKp" />
          </div>
        </el-form-item>
        <el-form-item label="典型错因（可选）">
          <el-select v-model="form.errorType" clearable placeholder="选择错因">
            <el-option v-for="t in ERROR_TYPES" :key="t" :value="t" :label="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="答案 / 解析（可选）">
          <el-input v-model="form.answer" type="textarea" :rows="3" />
          <div class="preview"><MathText :text="form.answer" /></div>
        </el-form-item>
      </template>

      <el-form-item label="正文">
        <el-input v-model="form.content" type="textarea" :rows="4" maxlength="5000" show-word-limit
          placeholder="说说这道题你踩过的坑，或者想讨论的问题" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">发布</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MathText from './MathText.vue'
import { forumApi } from '../api/auth'
import { getBook } from '../utils/storage'

const ERROR_TYPES = ['概念理解错误', '计算失误', '审题偏差', '方法错误', '知识盲区']

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 从练习本/小组分享进来时预填的错题数据 */
  preset: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'posted'])

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const form = reactive({
  type: 'question',
  title: '',
  content: '',
  subject: '',
  question: '',
  answer: '',
  hint: '',
  knowledgePoints: [],
  errorType: '',
})
const kpInput = ref('')
const importId = ref('')
const loading = ref(false)

const myBook = computed(() => getBook().filter((x) => (x.question || '').trim()))

watch(visible, (v) => {
  if (!v) return
  importId.value = ''
  if (props.preset) {
    // 从练习本分享：预填错题卡
    Object.assign(form, {
      type: 'question',
      title: truncate(props.preset.question || '', 40),
      content: '',
      subject: props.preset.subject || '',
      question: props.preset.question || '',
      answer: props.preset.correct_answer || props.preset.answer || '',
      hint: props.preset.hint || '',
      knowledgePoints: [...(props.preset.knowledge_points || [])],
      errorType: props.preset.error_type || '',
    })
  } else {
    Object.assign(form, {
      type: 'question',
      title: '', content: '', subject: '', question: '', answer: '', hint: '',
      knowledgePoints: [], errorType: '',
    })
  }
})

function truncate(s, n) {
  s = s || ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function addKp() {
  const v = kpInput.value.trim()
  if (v && !form.knowledgePoints.includes(v)) form.knowledgePoints.push(v)
  kpInput.value = ''
}

function onImport(id) {
  const it = myBook.value.find((x) => String(x.id) === String(id))
  if (!it) return
  Object.assign(form, {
    title: truncate(it.question, 40),
    subject: it.subject || '',
    question: it.question || '',
    answer: it.correct_answer || '',
    hint: it.hint || '',
    knowledgePoints: [...(it.knowledge_points || [])],
    errorType: it.error_type || '',
  })
}

async function submit() {
  if (!form.title.trim()) return void ElMessage.warning('请填写标题')
  if (form.type === 'question' && !form.question.trim()) {
    return void ElMessage.warning('错题分享帖必须包含题干')
  }
  loading.value = true
  try {
    await forumApi.create({
      type: form.type,
      title: form.title.trim(),
      content: form.content,
      subject: form.subject,
      question: form.question,
      answer: form.answer,
      hint: form.hint,
      knowledgePoints: form.knowledgePoints,
      errorType: form.errorType,
    })
    ElMessage.success('发布成功')
    visible.value = false
    emit('posted')
  } catch (e) {
    ElMessage.error(e.message || '发布失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.kp-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.kp-input {
  width: 140px;
}
.preview {
  width: 100%;
  margin-top: 6px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
  min-height: 20px;
}
</style>
