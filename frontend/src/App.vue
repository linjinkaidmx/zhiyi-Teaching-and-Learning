<template>
  <div>
    <header class="app-header">
      <div class="brand">
        <span class="logo">知一</span>
        <span class="slogan">知一而通万 · 举一反三</span>
      </div>
      <div class="nav">
        <span class="nav-link" :class="{ active: view === 'home' }" @click="view = 'home'">拍题</span>
        <span class="nav-link" :class="{ active: view === 'book' }" @click="goBook">练习本</span>
        <span class="nav-link" :class="{ active: view === 'quiz' }" @click="view = 'quiz'">自测</span>
        <span class="nav-link" :class="{ active: view === 'forum' }" @click="view = 'forum'">论坛</span>
        <span class="nav-link" :class="{ active: view === 'group' }" @click="view = 'group'">小组</span>
        <span class="net-chip" :class="online ? 'on' : 'off'">
          {{ online ? '后端已连接' : '后端未连接' }}
        </span>

        <el-dropdown v-if="user.token" trigger="click" @command="onUserCommand">
          <span class="user-chip">
            <span class="user-avatar">{{ avatarChar }}</span>
            {{ user.nickname }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>账号数据已云端同步</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-else type="primary" size="small" plain @click="authVisible = true">
          登录 / 注册
        </el-button>
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

      <!-- key 里带登录态：登录/退出时强制重挂载，读取新数据空间 -->
      <ErrorBook
        v-else-if="view === 'book'"
        :key="'book-' + spaceKey"
        @review="onReview"
        @quiz="view = 'quiz'"
        @share="openShare"
      />

      <QuizPanel v-else-if="view === 'quiz'" :key="'quiz-' + spaceKey" @back="goBook" />

      <ForumView v-else-if="view === 'forum'" @need-login="authVisible = true" />

      <GroupView v-else-if="view === 'group'" @need-login="authVisible = true" />
    </main>

    <JoinDialog v-model:visible="joinVisible" :record="joinRecord" @confirm="doJoin" />
    <AuthDialog v-model:visible="authVisible" />
    <ShareDialog v-model:visible="shareVisible" :record="shareRecord" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import UploadPanel from './components/UploadPanel.vue'
import ProcessingPanel from './components/ProcessingPanel.vue'
import ResultPanel from './components/ResultPanel.vue'
import RecommendPanel from './components/RecommendPanel.vue'
import ErrorBook from './components/ErrorBook.vue'
import QuizPanel from './components/QuizPanel.vue'
import JoinDialog from './components/JoinDialog.vue'
import AuthDialog from './components/AuthDialog.vue'
import ShareDialog from './components/ShareDialog.vue'
import ForumView from './components/ForumView.vue'
import GroupView from './components/GroupView.vue'
import { diagnoseImage, healthCheck } from './api/diagnose'
import { getBook, addRecord, setSyncHandler } from './utils/storage'
import { user, initUser, logout, handleStorageSync } from './store/user'

const state = ref('idle') // idle | loading | result
const view = ref('home') // home | book | quiz | forum | group
const showRec = ref(false)
const previewUrl = ref('')
const result = ref(null)
const online = ref(false)

// 登录弹窗 / 分享弹窗
const authVisible = ref(false)
const shareVisible = ref(false)
const shareRecord = ref({})

// 入库确认弹窗
const joinVisible = ref(false)
const joinRecord = ref({})
// 练习本里的 id 列表，used to控制「加入练习本」按钮的禁用态
const bookVersion = ref(0)
const joinedIds = computed(() => {
  bookVersion.value
  return getBook().map((x) => String(x.id))
})

// 数据空间标识：登录/退出变化时重挂载练习本与自测
const spaceKey = computed(() => (user.token ? 'account' : 'guest'))

const avatarChar = computed(() => (user.nickname || '?').slice(0, 1).toUpperCase())

onMounted(async () => {
  setSyncHandler(handleStorageSync)
  await initUser()
  try {
    await healthCheck()
    online.value = true
  } catch {
    online.value = false
    ElMessage.warning('后端服务未连接，拍题功能暂不可用（练习本与自测仍可正常使用）')
  }
})

function onUserCommand(cmd) {
  if (cmd === 'logout') doLogout()
}

async function doLogout() {
  try {
    await ElMessageBox.confirm('退出后练习本将切回本机的游客数据。', '退出登录', {
      confirmButtonText: '退出', cancelButtonText: '取消', type: 'warning',
    })
  } catch {
    return
  }
  logout()
  bookVersion.value++
  ElMessage.success('已退出登录')
}

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

/** 弹窗确认后真正写入存储 */
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

/** 从练习本点「分享」：打开分享弹窗（论坛 / 小组） */
function openShare(record) {
  shareRecord.value = record || {}
  shareVisible.value = true
}
</script>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  padding: 4px 6px;
  border-radius: 6px;
  outline: none;
}
.user-chip:hover {
  background: var(--el-fill-color-light);
}
.user-avatar {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
}
.gap-top {
  margin-top: 18px;
}
</style>
