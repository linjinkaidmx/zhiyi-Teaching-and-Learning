<template>
  <div class="forum-view">
    <div class="toolbar">
      <el-select v-model="subject" class="subject-filter" placeholder="全部学科" clearable
        @change="reload">
        <el-option v-for="s in SUBJECTS" :key="s" :value="s" :label="s" />
      </el-select>
      <el-button type="primary" :disabled="!logged"
        :title="logged ? '' : '登录后才能发帖'" @click="postDialogVisible = true">
        发帖
      </el-button>
    </div>

    <el-alert v-if="!logged" type="info" :closable="false" show-icon class="login-tip"
      title="登录后可以发帖、点赞和评论，浏览不需要登录" />

    <div v-if="loading" class="center-hint"><el-skeleton :rows="5" animated /></div>
    <div v-else-if="!posts.length" class="center-hint muted">
      还没有帖子，{{ logged ? '发第一帖吧' : '登录后发第一帖吧' }}
    </div>

    <div v-else class="post-list">
      <div v-for="p in posts" :key="p.id" class="post-card" @click="openDetail(p)">
        <div class="card-head">
          <el-tag v-if="p.type === 'question'" type="warning" size="small">错题分享</el-tag>
          <el-tag v-else size="small" type="info" effect="plain">讨论</el-tag>
          <span class="card-title">{{ p.title }}</span>
        </div>
        <div v-if="p.type === 'question' && p.question" class="card-stem">
          <MathText :text="truncate(p.question, 120)" />
        </div>
        <div v-else-if="p.content" class="card-content">{{ truncate(p.content, 140) }}</div>
        <div class="card-kps">
          <el-tag v-for="k in p.knowledgePoints.slice(0, 4)" :key="k" size="small" effect="plain">
            {{ k }}
          </el-tag>
          <el-tag v-if="p.errorType" size="small" type="danger" effect="plain">{{ p.errorType }}</el-tag>
        </div>
        <div class="card-foot">
          <span class="meta-text">{{ p.author }} · {{ p.createdAt }}</span>
          <span class="meta-text">赞 {{ p.likeCount }} · 评 {{ p.commentCount }}</span>
        </div>
      </div>
    </div>

    <div v-if="total > posts.length" class="pager">
      <el-pagination layout="prev, pager, next" :page-size="pageSize" :total="total"
        :current-page="page" @current-change="onPage" />
    </div>

    <PostDialog v-model:visible="postDialogVisible" @posted="reload" />
    <PostDetailDialog v-model:visible="detailVisible" :post-id="detailId" @changed="reload" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import MathText from './MathText.vue'
import PostDialog from './PostDialog.vue'
import PostDetailDialog from './PostDetailDialog.vue'
import { forumApi } from '../api/auth'
import { isLoggedIn } from '../store/user'

const SUBJECTS = ['高等数学', '线性代数', '概率论与数理统计', '数据结构', '算法', '操作系统', '计算机网络']

const pageSize = 20
const subject = ref('')
const page = ref(1)
const total = ref(0)
const posts = ref([])
const loading = ref(false)

const logged = computed(() => isLoggedIn())

const postDialogVisible = ref(false)
const detailVisible = ref(false)
const detailId = ref(null)

onMounted(reload)

async function reload() {
  loading.value = true
  try {
    const res = await forumApi.list(subject.value, page.value)
    posts.value = res.posts || []
    total.value = res.total || 0
  } catch (e) {
    posts.value = []
    total.value = 0
    console.warn('[forum] load failed:', e.message)
  } finally {
    loading.value = false
  }
}

function onPage(p) {
  page.value = p
  reload()
}

function openDetail(p) {
  detailId.value = p.id
  detailVisible.value = true
}

function truncate(s, n) {
  s = s || ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<style scoped>
.forum-view {
  max-width: 760px;
  margin: 0 auto;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.subject-filter {
  width: 180px;
}
.toolbar .el-button {
  margin-left: auto;
}
.login-tip {
  margin-bottom: 14px;
}
.post-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.post-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.post-card:hover {
  border-color: var(--el-color-primary-light-5);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title {
  font-weight: 500;
  font-size: 15px;
}
.card-stem {
  margin-top: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.card-content {
  margin-top: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  white-space: pre-wrap;
}
.card-kps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}
.meta-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.center-hint {
  text-align: center;
  padding: 48px 0;
}
.muted {
  color: var(--el-text-color-secondary);
}
</style>
