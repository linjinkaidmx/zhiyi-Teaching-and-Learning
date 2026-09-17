<template>
  <div>
    <header class="app-header">
      <div class="brand">
        <span class="logo">知一</span>
        <span class="slogan">知一而通万 · 举一反三</span>
      </div>
      <div class="nav">
        <el-button :type="view === 'home' ? 'primary' : 'default'" text @click="view = 'home'">
          拍题
        </el-button>
        <el-button :type="view === 'book' ? 'primary' : 'default'" text @click="goBook">
          练习本
        </el-button>
        <el-button :type="view === 'quiz' ? 'primary' : 'default'" text @click="view = 'quiz'">
          自测
        </el-button>
        <el-tag v-if="online" type="success" effect="plain" size="small">后端已连接</el-tag>
        <el-tag v-else type="danger" effect="plain" size="small">后端未连接</el-tag>
      </div>
    </header>

    <main class="app-main">
      <template v-if="view === 'home'">
        <UploadPanel v-if="state === 'idle'" @submit="onSubmit" />
        <ProcessingPanel v-else-if="state === 'loading'" :preview="previewUrl" />
        <template v-else-if="state === 'result'">
          <ResultPanel
            :preview="previewUrl"
            :result="result"
            :joined-ids="joinedIds"
            @reset="reset"
            @recommend="showRec = !showRec"
            @join="openJoin"
          />
          <RecommendPanel
            v-if="showRec"
            :result="result"
            :joined-ids="joinedIds"
            class="gap-top"
            @close="showRec = false"
            @join="openJoin"
          />
        </template>
      </template>

      <ErrorBook v-else-if="view === 'book'" @review="onReview" @quiz="view = 'quiz'" />

      <QuizPanel v-else @back="goBook" />
    </main>

    <JoinDialog v-model:visible="joinVisible" :record="joinRecord" @confirm="doJoin" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import UploadPanel from './components/UploadPanel.vue'
import ProcessingPanel from './components/ProcessingPanel.vue'
import ResultPanel from './components/ResultPanel.vue'
import RecommendPanel from './components/RecommendPanel.vue'
import ErrorBook from './components/ErrorBook.vue'
import QuizPanel from './components/QuizPanel.vue'
import JoinDialog from './components/JoinDialog.vue'
import { diagnoseImage, healthCheck } from './api/diagnose'
import { getBook, addRecord } from './utils/storage'

const state = ref('idle') // idle | loading | result
const view = ref('home') // home | book | quiz
const showRec = ref(false)
const previewUrl = ref('')
const result = ref(null)
const online = ref(false)

// 入库确认弹窗
const joinVisible = ref(false)
const joinRecord = ref({})
// 练习本里的 id 列表，used to控制「加入练习本」按钮的禁用态
const bookVersion = ref(0)
const joinedIds = computed(() => {
  bookVersion.value
  return getBook().map((x) => String(x.id))
})

onMounted(async () => {
  try {
    await healthCheck()
    online.value = true
  } catch {
    online.value = false
    ElMessage.warning('后端服务未连接，拍题功能暂不可用（练习本与自测仍可正常使用）')
  }
})

function onSubmit(file) {
  previewUrl.value = URL.createObjectURL(file)
  showRec.value = false
  state.value = 'loading'
  diagnoseImage(file)
    .then((res) => {
      if (res.success && res.data) {
        result.value = res.data
        state.value = 'result'
      } else {
        ElMessage.error(res.error || '识别失败，请重试')
        state.value = 'idle'
      }
    })
    .catch((e) => {
      ElMessage.error('请求失败：' + (e.response?.data?.detail || e.message))
      state.value = 'idle'
    })
}

function reset() {
  state.value = 'idle'
  result.value = null
  previewUrl.value = ''
  showRec.value = false
}

/** 打开入库确认弹窗，让用户先校对 AI 提取出的文字 */
function openJoin(record) {
  joinRecord.value = record || {}
  joinVisible.value = true
}

/** 弹窗确认后真正写入 localStorage */
function doJoin(patch) {
  addRecord(joinRecord.value, patch)
  bookVersion.value++
  ElMessage.success('已加入练习本，可在「自测」里检验自己')
}

function goBook() {
  view.value = 'book'
  bookVersion.value++
}

/** 从练习本点「查看解析」：回到拍题页查看该题解析 */
function onReview(record) {
  result.value = record
  previewUrl.value = ''
  showRec.value = true
  view.value = 'home'
  state.value = 'result'
}
</script>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gap-top {
  margin-top: 18px;
}
</style>
