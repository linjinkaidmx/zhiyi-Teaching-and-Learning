<template>
  <div class="cd surface-standard">
    <h3 class="t-h2 cd__title">代码诊断</h3>
    <p class="t-body-2 cd__desc">贴上你的代码（和报错信息），AI 帮你定位错误、解释原因、给出修正后的代码。</p>

    <!-- 代码输入 -->
    <p class="t-label cd__label">你的代码</p>
    <textarea ref="ta" />

    <!-- 辅助信息 -->
    <div class="cd__grid">
      <label class="cd__col">
        <span class="t-label cd__label">语言（可选，不填自动识别）</span>
        <UiSelect v-model="lang" :options="LANG_OPTIONS" placeholder="自动识别" />
      </label>
      <label class="cd__col">
        <span class="t-label cd__label">报错信息（可选）</span>
        <UiInput v-model="error" type="textarea" :rows="2" placeholder="如编译器/运行时的报错，或「输出不对」等" />
      </label>
    </div>

    <label class="cd__col cd__col--full">
      <span class="t-label cd__label">想做什么 / 哪里卡住了（可选）</span>
      <UiInput v-model="description" type="textarea" :rows="2" placeholder="例如：想实现冒泡排序，但结果不对" />
    </label>

    <div class="cd__ops">
      <UiButton variant="primary" :loading="loading" @click="doDebug">开始诊断</UiButton>
    </div>

    <!-- 诊断结果 -->
    <div v-if="result" class="cd__result">
      <div class="cd__result-head">
        <h3 class="t-h2 cd__title">诊断结果</h3>
        <UiTag v-if="result.error_type" :variant="typeTag(result.error_type)">{{ result.error_type }}</UiTag>
      </div>

      <section v-if="result.error_location" class="cd__block">
        <p class="t-label cd__label">错误位置</p>
        <MathText :content="result.error_location" />
      </section>

      <section v-if="result.reason" class="cd__block">
        <p class="t-label cd__label">错误原因</p>
        <MathText :content="result.reason" />
      </section>

      <section v-if="result.fix" class="cd__block">
        <p class="t-label cd__label">修改建议</p>
        <MathText :content="result.fix" />
      </section>

      <section v-if="result.corrected_code" class="cd__block">
        <p class="t-label cd__label">修正后的代码</p>
        <MathText :content="result.corrected_code" />
      </section>

      <section v-if="result.knowledge_points && result.knowledge_points.length" class="cd__block">
        <p class="t-label cd__label">涉及知识点</p>
        <div class="cd__tags">
          <UiTag v-for="k in result.knowledge_points" :key="k" variant="neutral">{{ k }}</UiTag>
        </div>
      </section>

      <section v-if="result.tips" class="cd__block">
        <p class="t-label cd__label">避坑建议</p>
        <MathText :content="result.tips" />
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * 代码诊断（v1）：从 EP 版迁移，逻辑逐字保留（CodeMirror 挂载、接口调用、埋点）
 * el-select/el-input/el-tag/el-button → Ui*；样式改为 tokens（深色下也正常）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from '../ui/notify.js'
import MathText from './MathText.vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiTag from '../ui/UiTag.vue'
import { api } from '../api'
import { recordAction } from '../statsStore'

const LANG_OPTIONS = [
  { label: 'Python', value: 'python' },
  { label: 'C', value: 'c' },
  { label: 'C++', value: 'cpp' },
  { label: 'Java', value: 'java' },
]

const ta = ref(null)
const lang = ref('')
const error = ref('')
const description = ref('')
const result = ref(null)
const loading = ref(false)
let cm = null

onMounted(async () => {
  // CodeMirror 按需加载（首屏不下载约 200KB）
  try {
    const { ensureCodeMirror } = await import('../lib/lazyLibs.js')
    await ensureCodeMirror()
  } catch {
    /* 加载失败则降级为纯文本域 */
  }
  if (!window.CodeMirror) return
  cm = window.CodeMirror.fromTextArea(ta.value, {
    mode: 'text/x-python',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: false,
    viewportMargin: 12,
    placeholder: '// 在这里粘贴你的代码',
  })
})

onBeforeUnmount(() => {
  if (cm) { cm.toTextArea(); cm = null }
})

function typeTag(t) {
  if (t.includes('语法')) return 'error'
  if (t.includes('逻辑')) return 'warning'
  if (t.includes('运行')) return 'error'
  if (t.includes('性能')) return 'info'
  return 'info'
}

async function doDebug() {
  const startedAt = Date.now()
  const code = cm ? cm.getValue() : ''
  if (!code.trim()) { ElMessage.warning('请先粘贴代码'); return }
  loading.value = true
  result.value = null
  try {
    result.value = await api.debug(code, error.value, lang.value, description.value)
    ElMessage.success('诊断完成')
    recordAction('debug', { title: description.value || '代码诊断', brief: lang.value || '自动识别', minutes: (Date.now() - startedAt) / 60000 }) // 打卡埋点
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.cd__title {
  margin: 0;
}
.cd__desc {
  margin: var(--sp-2) 0 var(--sp-4);
}
.cd__label {
  display: block;
  margin: var(--sp-3) 0 var(--sp-2);
}
.cd__grid {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: var(--sp-4);
  margin-top: var(--sp-2);
}
.cd__col {
  display: flex;
  flex-direction: column;
}
.cd__col--full {
  margin-top: var(--sp-2);
}
.cd__ops {
  margin-top: var(--sp-4);
}
:deep(.CodeMirror) {
  height: auto;
  min-height: 200px;
  border: var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--fs-body-2);
  font-family: var(--font-mono);
  background: var(--surface-recess);
  color: var(--text-primary);
}
.cd__result {
  margin-top: var(--sp-6);
  border-top: var(--border-divider);
  padding-top: var(--sp-4);
}
.cd__result-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.cd__block {
  margin-top: var(--sp-4);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
.cd__tags {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .cd__grid {
    grid-template-columns: 1fr;
  }
}
</style>
