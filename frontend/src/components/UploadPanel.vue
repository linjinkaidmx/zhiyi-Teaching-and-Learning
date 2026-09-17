<template>
  <div class="upload-layout">
    <!-- 左：上传区（60%） -->
    <div
      class="dropzone"
      :class="{ active: dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="pick"
    >
      <div class="dz-icon">+</div>
      <div class="dz-title">拖入题目截图，或直接 Ctrl+V 粘贴</div>
      <div class="dz-sub">JPG / PNG ≤ 10MB · 自动判断查错因还是给解答</div>
      <el-button type="primary" size="large" @click.stop="pick">选择文件</el-button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        hidden
        @change="onPick"
      />
    </div>

    <!-- 右：竖排三步流程（替代原三卡片） -->
    <div class="side">
      <div class="steps">
        <div class="step">
          <span class="step-num">1</span>
          <div class="step-text">
            <b>拍题即诊断</b>
            <span>识别错因、知识点与解答</span>
          </div>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <div class="step-text">
            <b>间隔自测</b>
            <span>按掌握度智能组卷复习</span>
          </div>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <div class="step-text">
            <b>小组互鉴</b>
            <span>共享错题，看同伴在哪摔跤</span>
          </div>
        </div>
      </div>

      <div class="brand-card">
        <b>知一而通万</b>
        <span>今天也要举一反三</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['submit'])
const dragging = ref(false)
const fileInput = ref(null)
const MAX = 10 * 1024 * 1024

function validate(file) {
  if (!file) return false
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件（JPG / PNG）')
    return false
  }
  if (file.size > MAX) {
    ElMessage.warning('图片不能超过 10MB')
    return false
  }
  return true
}

function submit(file) {
  if (validate(file)) emit('submit', file)
}

function pick() {
  fileInput.value?.click()
}

function onPick(e) {
  submit(e.target.files?.[0])
  e.target.value = ''
}

function onDrop(e) {
  dragging.value = false
  submit(e.dataTransfer?.files?.[0])
}

function onPaste(e) {
  const items = e.clipboardData?.items || []
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      submit(it.getAsFile())
      break
    }
  }
}

onMounted(() => window.addEventListener('paste', onPaste))
onUnmounted(() => window.removeEventListener('paste', onPaste))
</script>

<style scoped>
.upload-layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
  align-items: start;
}

.dropzone {
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  min-height: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.2s, background 0.2s;
}
.dropzone:hover,
.dropzone.active {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.dz-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 26px;
  font-weight: 300;
  color: var(--brand);
  border: 1.5px solid rgba(47, 111, 94, 0.4);
  border-radius: 50%;
  line-height: 1;
}
.dz-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.dz-sub {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-bottom: 8px;
}

/* 右侧 */
.side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.steps {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 20px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 0;
}

.step + .step {
  border-top: 1px solid var(--border);
}

.step-num {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 50%;
}

.step-text b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.step-text span {
  font-size: 12.5px;
  color: var(--text-sub);
}

.brand-card {
  padding: 18px 20px;
  background: var(--brand);
  border-radius: var(--radius);
  color: #fff;
}

.brand-card b {
  display: block;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-card span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.85;
}

@media (max-width: 860px) {
  .upload-layout {
    grid-template-columns: 1fr;
  }
  .dropzone {
    min-height: 280px;
  }
}
</style>
