<template>
  <div class="code-editor">
    <div class="toolbar">
      <div class="ce__lang">
        <UiSelect v-model="lang" size="sm" :options="LANGS" />
      </div>
      <UiButton variant="primary" size="sm" :loading="running" @click="run">运行 ▶</UiButton>
      <span class="muted">可直接修改代码运行，查看真实输出（超时 8 秒自动终止）</span>
    </div>

    <textarea ref="ta" />

    <div class="io-row">
      <div class="io-col">
        <div class="label">输入 stdin（可选）</div>
        <UiInput v-model="stdinText" type="textarea" :rows="2" placeholder="程序若有输入，在这里填" />
      </div>
    </div>

    <div v-if="output || errorText" class="output-block">
      <div class="label">运行结果</div>
      <pre v-if="output" class="out-ok">{{ output }}</pre>
      <pre v-if="errorText" class="out-err">{{ errorText }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from '../ui/notify.js'
import { api } from '../api'
import { recordAction } from '../statsStore'

const props = defineProps({
  code: { type: String, default: '' },
  language: { type: String, default: 'python' },
})

const lang = ref(props.language)
const ta = ref(null)
const stdinText = ref('')
const output = ref('')
const errorText = ref('')
const running = ref(false)
let cm = null

function modeOf(l) {
  return l === 'c' ? 'text/x-csrc' : 'text/x-python'
}

onMounted(async () => {
  // CodeMirror 按需加载（首屏不下载约 200KB）
  try {
    const { ensureCodeMirror } = await import('../lib/lazyLibs.js')
    await ensureCodeMirror()
  } catch {
    /* 下面会因 window.CodeMirror 缺失直接 return，界面降级为纯文本域 */
  }
  if (!window.CodeMirror) return
  cm = window.CodeMirror.fromTextArea(ta.value, {
    mode: modeOf(lang.value),
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: false,
    viewportMargin: 12,
  })
  cm.setValue(props.code || '')
})

watch(lang, (v) => {
  if (cm) cm.setOption('mode', modeOf(v))
})

watch(() => props.code, (v) => {
  if (cm && v && cm.getValue() !== v) cm.setValue(v)
})

onBeforeUnmount(() => {
  if (cm) { cm.toTextArea(); cm = null }
})

async function run() {
  const code = cm ? cm.getValue() : props.code
  if (!code.trim()) { ElMessage.warning('代码为空'); return }
  running.value = true
  output.value = ''
  errorText.value = ''
  try {
    const r = await api.run(lang.value, code, stdinText.value)
    if (r.ok) {
      output.value = r.stdout || '(程序运行结束，无输出)'
      if (r.stderr) errorText.value = r.stderr
      recordAction('run')            // 打卡埋点：成功跑通一次代码
    } else {
      errorText.value = r.error + (r.stderr ? '\n\n' + r.stderr : '')
    }
  } catch (e) {
    errorText.value = e.message
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.code-editor {
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 12px;
  background: #fdfdfe;
  margin: 10px 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7686;
  margin-bottom: 6px;
}
.io-row { margin-top: 10px; }
.output-block { margin-top: 12px; }
:deep(.CodeMirror) {
  height: auto;
  min-height: 180px;
  border: 1px solid #e5e8ee;
  border-radius: 6px;
  font-size: 13px;
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
}
.out-ok, .out-err {
  margin: 0 0 8px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
  max-height: 260px;
  overflow: auto;
}
.out-ok { background: #f0f5f0; border: 1px solid #d8e6d8; color: #1f2733; }
.out-err { background: #fef0f0; border: 1px solid #f2c8c8; color: #b54444; }
</style>
