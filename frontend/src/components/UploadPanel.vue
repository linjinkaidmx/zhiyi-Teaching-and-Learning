<template>
  <div class="upload">
    <div
      class="dropzone"
      :class="{ active: dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="pick"
    >
      <div class="dz-icon">+</div>
      <div class="dz-title">粘贴或拖入题目图片</div>
      <div class="dz-sub">
        支持 Ctrl+V 粘贴截图 / JPG / PNG，单张 ≤ 10MB<br />
        系统自动判断：有作答痕迹就查错因，只有题目就给解答
      </div>
      <el-button type="primary" size="large" @click.stop="pick">选择文件</el-button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        hidden
        @change="onPick"
      />
    </div>

    <div class="ways">
      <div class="way"><b>粘贴截图</b><span>Ctrl+V 直接粘贴</span></div>
      <div class="way"><b>拖拽上传</b><span>把图片拖进上方区域</span></div>
      <div class="way"><b>选择文件</b><span>从本地挑选图片</span></div>
    </div>

    <p class="tip">在页面任意位置按 Ctrl+V，即可直接粘贴剪贴板中的截图</p>
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
.dropzone {
  border: 2px dashed var(--border);
  border-radius: 16px;
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s;
}
.dropzone:hover,
.dropzone.active {
  border-color: var(--brand);
  background: var(--brand-light);
}
.dz-icon {
  font-size: 44px;
  color: var(--brand);
  line-height: 1;
}
.dz-title {
  font-size: 20px;
  font-weight: 500;
}
.dz-sub {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.ways {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 20px;
}
.way {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.way b {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}
.way span {
  font-size: 12px;
  color: var(--text-sub);
}
.tip {
  text-align: center;
  color: var(--text-sub);
  font-size: 13px;
  margin-top: 18px;
}
</style>
