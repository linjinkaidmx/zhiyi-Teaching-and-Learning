<template>
  <el-dialog v-model="visible" :title="post ? post.title : '帖子详情'" width="640px" top="6vh">
    <div v-if="loading" class="center-hint"><el-skeleton :rows="4" animated /></div>
    <template v-else-if="post">
      <div class="post-meta">
        <el-tag v-if="post.type === 'question'" type="warning" size="small">错题分享</el-tag>
        <el-tag v-if="post.subject" size="small" effect="plain">{{ post.subject }}</el-tag>
        <span class="meta-text">{{ post.author }} · {{ post.createdAt }}</span>
        <el-button v-if="post.mine" text type="danger" size="small" class="del-btn"
          @click="removePost">删除</el-button>
      </div>

      <div v-if="post.content" class="post-content">{{ post.content }}</div>

      <div v-if="post.type === 'question'" class="qcard">
        <div class="qcard-label">题目</div>
        <div class="stem"><MathText :text="post.question" /></div>
        <div v-if="post.knowledgePoints && post.knowledgePoints.length" class="kp-row">
          <el-tag v-for="k in post.knowledgePoints" :key="k" size="small" effect="plain">
            {{ k }}
          </el-tag>
          <el-tag v-if="post.errorType" size="small" type="danger" effect="plain">
            {{ post.errorType }}
          </el-tag>
        </div>
        <el-collapse class="ans-collapse">
          <el-collapse-item title="查看答案 / 解析">
            <div class="stem"><MathText :text="post.answer || '（作者未提供答案）'" /></div>
            <div v-if="post.hint" class="hint">思路：{{ post.hint }}</div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <div class="like-row">
        <el-button :type="post.liked ? 'primary' : 'default'" round
          @click="toggleLike">
          点赞 {{ post.likeCount }}
        </el-button>
        <span class="meta-text">评论 {{ post.commentCount }}</span>
      </div>

      <el-divider>评论</el-divider>

      <div v-if="!comments.length" class="center-hint muted">还没有评论，来说两句吧</div>
      <div v-for="c in comments" :key="c.id" class="comment">
        <div class="comment-head">
          <span class="comment-author">{{ c.nickname }}</span>
          <span class="meta-text">{{ c.createdAt }}</span>
        </div>
        <div v-if="c.replyTo" class="reply-ref">
          回复 @{{ nicknameOf(c.replyTo) }}
        </div>
        <div class="comment-body">{{ c.content }}</div>
        <div class="comment-actions">
          <el-button text size="small" @click="startReply(c)">回复</el-button>
        </div>
      </div>

      <div class="comment-editor">
        <div v-if="replyTarget" class="replying">
          回复 @{{ replyTarget.nickname }}
          <el-button text size="small" @click="cancelReply">取消</el-button>
        </div>
        <div class="editor-row">
          <el-input v-model="commentText" :placeholder="logged ? '友善发言，共同进步' : '登录后才能评论'"
            :disabled="!logged" maxlength="500" @keydown.enter.prevent="submitComment" />
          <el-button type="primary" :disabled="!logged || !commentText.trim()"
            :loading="commentLoading" @click="submitComment">发送</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MathText from './MathText.vue'
import { forumApi } from '../api/auth'
import { isLoggedIn } from '../store/user'

const props = defineProps({
  visible: { type: Boolean, default: false },
  postId: { type: [Number, String], default: null },
})
const emit = defineEmits(['update:visible', 'changed'])

const logged = computed(() => isLoggedIn())

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const post = ref(null)
const comments = ref([])
const loading = ref(false)
const commentText = ref('')
const commentLoading = ref(false)
const replyTarget = ref(null)

watch(visible, (v) => {
  if (v && props.postId) load()
})

async function load() {
  loading.value = true
  replyTarget.value = null
  commentText.value = ''
  try {
    const res = await forumApi.detail(props.postId)
    post.value = res.post
    comments.value = res.comments || []
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function nicknameOf(cid) {
  const c = comments.value.find((x) => x.id === cid)
  return c ? c.nickname : ''
}

async function toggleLike() {
  if (!logged.value) return void ElMessage.warning('请先登录')
  try {
    const res = await forumApi.like(post.value.id)
    post.value.liked = res.liked
    post.value.likeCount = res.likeCount
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function startReply(c) {
  replyTarget.value = c
}

function cancelReply() {
  replyTarget.value = null
}

async function submitComment() {
  const text = commentText.value.trim()
  if (!text) return
  commentLoading.value = true
  try {
    await forumApi.comment(post.value.id, text, replyTarget.value ? replyTarget.value.id : null)
    commentText.value = ''
    replyTarget.value = null
    await load() // 刷新评论与计数
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    commentLoading.value = false
  }
}

async function removePost() {
  try {
    await ElMessageBox.confirm('确定删除这篇帖子吗？评论也会一并删除。', '删除帖子', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await forumApi.remove(post.value.id)
    ElMessage.success('已删除')
    visible.value = false
    emit('changed')
  } catch (e) {
    ElMessage.error(e.message)
  }
}
</script>

<style scoped>
.post-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.meta-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.del-btn {
  margin-left: auto;
}
.post-content {
  white-space: pre-wrap;
  line-height: 1.7;
  margin-bottom: 14px;
}
.qcard {
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.qcard-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.stem {
  line-height: 1.7;
}
.kp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.ans-collapse {
  margin-top: 10px;
  --el-collapse-header-height: 36px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 6px;
}
.like-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.comment {
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.comment-head {
  display: flex;
  gap: 10px;
  align-items: baseline;
}
.comment-author {
  font-weight: 500;
}
.reply-ref {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-top: 2px;
}
.comment-body {
  margin-top: 4px;
  white-space: pre-wrap;
}
.comment-actions {
  margin-top: 2px;
}
.comment-editor {
  margin-top: 14px;
}
.replying {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-bottom: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.editor-row {
  display: flex;
  gap: 8px;
}
.center-hint {
  text-align: center;
  padding: 20px 0;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
