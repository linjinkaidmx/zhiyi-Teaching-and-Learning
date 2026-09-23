<template>
  <div class="zy-container zy-page comm">
    <header class="comm__head">
      <h1 class="t-h1">知一社区</h1>
      <p class="t-body-2">和同学讨论题目、分享学习心得</p>
    </header>

    <UiSegmented v-model="tab" :options="TABS" aria-label="社区板块" />

    <!-- ============ 论坛 ============ -->
    <template v-if="tab === 'forum'">
      <div class="comm__toolbar">
        <div class="comm__sort" role="radiogroup" aria-label="排序">
          <button
            v-for="s in SORTS"
            :key="s.key"
            type="button"
            class="comm__sort-btn"
            :class="{ 'is-active': sort === s.key }"
            @click="switchSort(s.key)"
          >
            {{ s.label }}
          </button>
        </div>
        <UiButton variant="primary" size="sm" @click="onNewPost">发帖</UiButton>
      </div>

      <div v-if="posts.length" class="comm__posts">
        <article
          v-for="p in posts"
          :key="p.id"
          class="comm__post surface-standard"
          @click="openPost(p)"
        >
          <div class="comm__post-head">
            <UiTag :variant="p.type === 'question' ? 'info' : 'neutral'">{{ p.type === 'question' ? '题目' : '感想' }}</UiTag>
            <span class="comm__post-author">{{ authorName(p.user_id) }}</span>
            <span class="comm__post-time">{{ timeAgo(p.created_at) }}</span>
          </div>
          <h3 v-if="p.title" class="t-h3 comm__post-title">{{ p.title }}</h3>
          <template v-if="p.type === 'question' && p.card">
            <p class="comm__post-q"><MathText :content="p.card.question || ''" /></p>
            <div v-if="(p.card.knowledgePoints || []).length" class="comm__post-tags">
              <UiTag v-for="k in (p.card.knowledgePoints || []).slice(0, 3)" :key="k" variant="brand-soft">{{ k }}</UiTag>
            </div>
          </template>
          <p v-else class="comm__post-body">{{ clip(p.content, 120) }}</p>
          <div class="comm__post-foot">
            <span class="comm__stat">💬 {{ p.comment_count }}</span>
            <span class="comm__stat">👍 {{ p.like_count }}</span>
          </div>
        </article>

        <UiButton v-if="posts.length < total" variant="ghost" size="sm" block :loading="loading" @click="loadMore">加载更多</UiButton>
      </div>
      <UiEmptyState v-else-if="!loading" title="论坛还没有帖子" description="分享第一道题，或写下你的学习感想。">
        <template #action><UiButton variant="primary" @click="onNewPost">发第一篇帖</UiButton></template>
      </UiEmptyState>
    </template>

    <!-- ============ 我的小组 ============ -->
    <template v-else>
      <div class="comm__toolbar">
        <UiButton variant="ghost" size="sm" @click="joinOpen = true">加入小组</UiButton>
        <UiButton variant="primary" size="sm" @click="createOpen = true">创建小组</UiButton>
      </div>

      <div v-if="groups.length" class="comm__groups">
        <button v-for="g in groups" :key="g.id" type="button" class="comm__group surface-standard" @click="openGroup(g)">
          <div class="comm__group-main">
            <span class="t-h3">{{ g.name }}</span>
            <span v-if="g.description" class="comm__group-desc">{{ g.description }}</span>
          </div>
          <div class="comm__group-side">
            <span class="comm__group-count">{{ g.member_count }} 人</span>
            <span v-if="g.my_role === 'owner'" class="comm__group-owner">组长</span>
          </div>
        </button>
      </div>
      <UiEmptyState v-else title="还没有加入任何小组" description="创建一个学习小组，或输入邀请码加入同学的小组。">
        <template #action>
          <UiButton variant="primary" @click="createOpen = true">创建小组</UiButton>
        </template>
      </UiEmptyState>
    </template>

    <!-- ============ 帖子详情抽屉 ============ -->
    <Transition name="comm-drawer">
      <div v-if="post" class="comm__drawer" role="dialog" aria-modal="true">
        <div class="comm__drawer-mask" @click="closePost" />
        <div class="comm__drawer-panel surface-elevated">
          <header class="comm__drawer-head">
            <div class="comm__drawer-tags">
              <UiTag :variant="post.type === 'question' ? 'info' : 'neutral'">{{ post.type === 'question' ? '题目' : '感想' }}</UiTag>
              <span class="comm__post-author">{{ authorName(post.user_id) }}</span>
              <span class="comm__post-time">{{ timeAgo(post.created_at) }}</span>
            </div>
            <button class="comm__drawer-close" type="button" aria-label="关闭" @click="closePost">✕</button>
          </header>

          <div class="comm__drawer-body">
            <h2 v-if="post.title" class="t-h2">{{ post.title }}</h2>

            <template v-if="post.type === 'question' && post.card">
              <div class="comm__qcard">
                <div class="comm__qcard-q"><MathText :content="post.card.question || ''" /></div>
                <div class="comm__qcard-a" v-if="post.card.answer">
                  <div class="t-label">答案</div>
                  <MathText :content="post.card.answer" />
                </div>
                <div v-if="(post.card.steps || []).length" class="comm__qcard-steps">
                  <div class="t-label">解析</div>
                  <div v-for="(s, i) in post.card.steps" :key="i" class="comm__qcard-step">
                    <div class="comm__qcard-step-t">{{ i + 1 }}. <MathText :content="s.title" /></div>
                    <MathText :content="s.detail" />
                  </div>
                </div>
                <div v-if="(post.card.knowledgePoints || []).length" class="comm__post-tags">
                  <UiTag v-for="k in post.card.knowledgePoints" :key="k" variant="brand-soft">{{ k }}</UiTag>
                </div>
              </div>
            </template>
            <p v-else class="comm__drawer-content comm__pre"><MathText :content="post.content" /></p>

            <div class="comm__actions">
              <UiButton variant="ghost" size="sm" @click="onLike(post)">
                👍 {{ post.like_count }} {{ post.liked ? '已赞' : '点赞' }}
              </UiButton>
              <UiButton v-if="isOwn(post)" variant="ghost" size="sm" class="comm__danger" @click="deletePost">删除</UiButton>
            </div>

            <div class="comm__comments">
              <h3 class="t-h3">评论（{{ comments.length }}）</h3>
              <div v-if="comments.length" class="comm__comment-list">
                <div v-for="c in comments" :key="c.id" class="comm__comment">
                  <div class="comm__comment-head">
                    <span class="comm__post-author">{{ authorName(c.user_id) }}</span>
                    <span class="comm__post-time">{{ timeAgo(c.created_at) }}</span>
                  </div>
                  <p class="comm__comment-body">{{ c.content }}</p>
                </div>
              </div>
              <p v-else class="comm__empty">还没有评论，来说两句。</p>

              <div class="comm__comment-input">
                <input
                  v-model="commentDraft"
                  class="comm__input"
                  type="text"
                  placeholder="写下你的评论…"
                  @keydown.enter.prevent="submitComment"
                />
                <UiButton variant="primary" size="sm" :disabled="!commentDraft.trim()" @click="submitComment">评论</UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ 小组详情抽屉 ============ -->
    <Transition name="comm-drawer">
      <div v-if="group" class="comm__drawer" role="dialog" aria-modal="true">
        <div class="comm__drawer-mask" @click="closeGroup" />
        <div class="comm__drawer-panel surface-elevated">
          <header class="comm__drawer-head">
            <div class="comm__drawer-tags">
              <span class="t-h3">{{ group.name }}</span>
              <span class="comm__group-count">{{ members.length }} 人</span>
            </div>
            <button class="comm__drawer-close" type="button" aria-label="关闭" @click="closeGroup">✕</button>
          </header>

          <div class="comm__drawer-body">
            <div class="comm__group-tools">
              <div class="comm__invite">
                <span class="t-label">邀请码</span>
                <code class="comm__code">{{ group.invite_code }}</code>
              </div>
              <UiButton v-if="group.my_role === 'owner'" variant="ghost" size="sm" @click="inviteOpen = true">按昵称邀请</UiButton>
            </div>

            <div class="comm__members">
              <h3 class="t-h3">成员</h3>
              <div class="comm__member-list">
                <span v-for="m in members" :key="m.user_id" class="comm__member">
                  {{ m.user_id }}<span v-if="m.role === 'owner'" class="comm__group-owner">组长</span>
                </span>
              </div>
            </div>

            <div class="comm__msgs">
              <h3 class="t-h3">讨论</h3>
              <div v-if="messages.length" class="comm__msg-list">
                <div v-for="m in messages" :key="m.id" class="comm__msg" :class="{ 'is-question': m.type === 'question' }">
                  <div class="comm__msg-head">
                    <span class="comm__post-author">{{ authorName(m.user_id) }}</span>
                    <span class="comm__post-time">{{ timeAgo(m.created_at) }}</span>
                  </div>
                  <template v-if="m.type === 'question'">
                    <div class="comm__msg-q"><MathText :content="msgQuestion(m)" /></div>
                  </template>
                  <p v-else class="comm__msg-body comm__pre"><MathText :content="m.content" /></p>
                </div>
              </div>
              <p v-else class="comm__empty">还没有消息，分享一道题或打个招呼吧。</p>

              <div class="comm__comment-input">
                <input
                  v-model="msgDraft"
                  class="comm__input"
                  type="text"
                  placeholder="发消息…"
                  @keydown.enter.prevent="sendMessage"
                />
                <UiButton variant="primary" size="sm" :disabled="!msgDraft.trim()" @click="sendMessage">发送</UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ 弹窗 ============ -->
    <UiModal v-model="postOpen" title="发帖" size="md">
      <label class="comm__label" for="post-title">标题</label>
      <input id="post-title" v-model="postTitle" class="comm__input" type="text" placeholder="一句话概括" />
      <label class="comm__label" for="post-content">内容</label>
      <textarea id="post-content" v-model="postContent" class="comm__input comm__textarea" rows="4" placeholder="写下你的学习感想、遇到的困难或心得…" />
      <template #footer>
        <UiButton variant="primary" block :loading="submitting" :disabled="!postTitle.trim() || !postContent.trim()" @click="submitPost">发布</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="createOpen" title="创建学习小组" size="sm">
      <label class="comm__label" for="g-name">小组名称</label>
      <input id="g-name" v-model="groupName" class="comm__input" type="text" placeholder="例如：高数互助小组" />
      <label class="comm__label" for="g-desc">简介（可选）</label>
      <input id="g-desc" v-model="groupDesc" class="comm__input" type="text" placeholder="这个小组是干嘛的" />
      <template #footer>
        <UiButton variant="primary" block :loading="submitting" :disabled="!groupName.trim()" @click="submitCreateGroup">创建</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="joinOpen" title="加入学习小组" size="sm">
      <p class="t-body-2">输入组长分享的邀请码。</p>
      <input v-model="inviteCode" class="comm__input" type="text" placeholder="8 位邀请码" />
      <template #footer>
        <UiButton variant="primary" block :loading="submitting" :disabled="!inviteCode.trim()" @click="submitJoin">加入</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="inviteOpen" title="按昵称邀请" size="sm">
      <p class="t-body-2">输入对方注册知一时用的昵称，直接拉进小组。</p>
      <input v-model="inviteNickname" class="comm__input" type="text" placeholder="对方的昵称" />
      <template #footer>
        <UiButton variant="primary" block :loading="submitting" :disabled="!inviteNickname.trim()" @click="submitInvite">邀请</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { recordAction } from '../statsStore'
import { useRoute } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiTag from '../ui/UiTag.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import MathText from '../components/MathText.vue'
import { api } from '../api'
import { session } from '../stores/sessionStore'
import { openAuth } from '../stores/uiStore'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'

const TABS = [
  { label: '论坛', value: 'forum' },
  { label: '我的小组', value: 'group' },
]
const SORTS = [
  { label: '最新', key: 'latest' },
  { label: '热门', key: 'hot' },
]

const route = useRoute()
const loggedIn = computed(() => session.space === 'account' && !!session.token)

const tab = ref(String(route.query.tab || 'forum'))
watch(() => route.query.tab, (v) => {
  if (v === 'forum' || v === 'group') tab.value = v
})

function requireLogin() {
  if (!loggedIn.value) {
    openAuth('login')
    toast.info('登录后才能操作')
    return false
  }
  return true
}

/* ---------- 论坛 ---------- */
const sort = ref('latest')
const posts = ref([])
const total = ref(0)
const loading = ref(false)
const LIMIT = 20

async function loadPosts(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    const r = await api.forum.list(sort.value, LIMIT, reset ? 0 : posts.value.length)
    posts.value = reset ? r.items : [...posts.value, ...r.items]
    total.value = r.total
  } catch (e) {
    toastError(e)
  } finally {
    loading.value = false
  }
}
function switchSort(k) {
  sort.value = k
  loadPosts(true)
}
function loadMore() {
  loadPosts(false)
}
watch(tab, (v) => {
  if (v === 'forum' && !posts.value.length) loadPosts(true)
  if (v === 'group' && !groups.value.length) loadGroups()
})
loadPosts(true)

/* ---------- 帖子详情 ---------- */
const post = ref(null)
const comments = ref([])
const commentDraft = ref('')
async function openPost(p) {
  try {
    const [detail, cmts] = await Promise.all([
      api.forum.detail(p.id),
      api.forum.comments(p.id),
    ])
    post.value = { ...detail, liked: false }
    comments.value = cmts
  } catch (e) {
    toastError(e)
  }
}
function closePost() {
  post.value = null
  comments.value = []
  commentDraft.value = ''
}
async function onLike(p) {
  if (!requireLogin()) return
  try {
    const r = await api.forum.like(session.token, p.id)
    p.liked = r.liked
    p.like_count = r.count
  } catch (e) {
    toastError(e)
  }
}
async function submitComment() {
  if (!requireLogin()) return
  if (!commentDraft.value.trim() || !post.value) return
  try {
    await api.forum.comment(session.token, post.value.id, commentDraft.value.trim())
    commentDraft.value = ''
    comments.value = await api.forum.comments(post.value.id)
    if (post.value.comment_count != null) post.value.comment_count++
  } catch (e) {
    toastError(e)
  }
}
function isOwn(p) {
  return loggedIn.value && p.user_id === session.userId
}
async function deletePost() {
  if (!post.value) return
  try {
    await api.forum.deletePost(session.token, post.value.id)
    toast.success('已删除')
    closePost()
    loadPosts(true)
  } catch (e) {
    toastError(e)
  }
}

/* ---------- 发帖 ---------- */
const postOpen = ref(false)
const postTitle = ref('')
const postContent = ref('')
const submitting = ref(false)
function onNewPost() {
  if (!requireLogin()) return
  postOpen.value = true
}
async function submitPost() {
  submitting.value = true
  try {
    await api.forum.post(session.token, 'thought', postTitle.value.trim(), postContent.value.trim(), null)
    postOpen.value = false
    postTitle.value = ''
    postContent.value = ''
    toast.success('已发布')
    try {
      recordAction('post', { title: postTitle.value.trim().slice(0, 40) || '社区发帖', brief: '发布帖子' })
    } catch {
      /* 埋点失败不影响发布 */
    }
    loadPosts(true)
  } catch (e) {
    toastError(e)
  } finally {
    submitting.value = false
  }
}

/* ---------- 小组 ---------- */
const groups = ref([])
async function loadGroups() {
  if (!loggedIn.value) {
    groups.value = []
    return
  }
  try {
    groups.value = await api.group.my(session.token)
  } catch (e) {
    toastError(e)
  }
}
if (tab.value === 'group') loadGroups()

const group = ref(null)
const members = ref([])
const messages = ref([])
const msgDraft = ref('')
async function openGroup(g) {
  try {
    const [d, msgs] = await Promise.all([
      api.group.detail(session.token, g.id),
      api.group.messages(session.token, g.id),
    ])
    group.value = { ...g, ...(d.group || {}) }
    members.value = d.members || []
    messages.value = msgs.items
  } catch (e) {
    toastError(e)
  }
}
function closeGroup() {
  group.value = null
  members.value = []
  messages.value = []
  msgDraft.value = ''
}
async function sendMessage() {
  if (!msgDraft.value.trim() || !group.value) return
  try {
    await api.group.send(session.token, group.value.id, 'text', msgDraft.value.trim())
    msgDraft.value = ''
    const r = await api.group.messages(session.token, group.value.id)
    messages.value = r.items
  } catch (e) {
    toastError(e)
  }
}
function msgQuestion(m) {
  try {
    const c = JSON.parse(m.content)
    return c.question || m.content
  } catch {
    return m.content
  }
}

/* ---------- 建组 / 加入 / 邀请 ---------- */
const createOpen = ref(false)
const groupName = ref('')
const groupDesc = ref('')
async function submitCreateGroup() {
  if (!requireLogin()) return
  submitting.value = true
  try {
    await api.group.create(session.token, groupName.value.trim(), groupDesc.value.trim())
    createOpen.value = false
    groupName.value = ''
    groupDesc.value = ''
    toast.success('小组已创建')
    loadGroups()
  } catch (e) {
    toastError(e)
  } finally {
    submitting.value = false
  }
}

const joinOpen = ref(false)
const inviteCode = ref('')
async function submitJoin() {
  if (!requireLogin()) return
  submitting.value = true
  try {
    await api.group.join(session.token, inviteCode.value.trim())
    joinOpen.value = false
    inviteCode.value = ''
    toast.success('已加入小组')
    loadGroups()
  } catch (e) {
    toastError(e)
  } finally {
    submitting.value = false
  }
}

const inviteOpen = ref(false)
const inviteNickname = ref('')
async function submitInvite() {
  if (!group.value) return
  submitting.value = true
  try {
    await api.group.invite(session.token, group.value.id, inviteNickname.value.trim())
    inviteOpen.value = false
    inviteNickname.value = ''
    toast.success('已邀请')
    const d = await api.group.detail(session.token, group.value.id)
    members.value = d.members || []
  } catch (e) {
    toastError(e)
  } finally {
    submitting.value = false
  }
}

/* ---------- 工具 ---------- */
function authorName(id) {
  return id || '已注销'
}
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - Number(ts)
  if (diff < 0) return '刚刚'
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  const dt = new Date(Number(ts))
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}
function clip(text, n) {
  const s = String(text || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<style scoped>
.comm {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.comm__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.comm__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.comm__sort {
  display: flex;
  gap: var(--sp-2);
}
.comm__sort-btn {
  padding: 5px 14px;
  border: var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.comm__sort-btn.is-active {
  border-color: var(--primary-line);
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.comm__posts {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__post {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  cursor: pointer;
}
.comm__post-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.comm__post-author {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
}
.comm__post-time {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  margin-left: auto;
}
.comm__post-title {
  margin: 0;
}
.comm__post-q {
  font-size: var(--fs-body);
  color: var(--text-primary);
  line-height: var(--lh-relaxed);
  margin: 0;
}
.comm__post-body {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
  margin: 0;
  white-space: pre-wrap;
}
.comm__post-tags {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.comm__post-foot {
  display: flex;
  gap: var(--sp-4);
}
.comm__stat {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}

.comm__groups {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  cursor: pointer;
  text-align: left;
}
.comm__group-main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.comm__group-desc {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.comm__group-side {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-shrink: 0;
}
.comm__group-count {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.comm__group-owner {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-size: var(--fs-label);
}

/* 抽屉 */
.comm__drawer {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
}
.comm__drawer-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}
.comm__drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(560px, 100vw);
  overflow-y: auto;
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.comm__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.comm__drawer-tags {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.comm__drawer-close {
  border: 0;
  background: none;
  font-size: var(--fs-body);
  color: var(--text-tertiary);
  cursor: pointer;
}
.comm__drawer-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.comm__drawer-content {
  font-size: var(--fs-body);
  color: var(--text-primary);
  line-height: var(--lh-relaxed);
  white-space: pre-wrap;
  margin: 0;
}
.comm__qcard {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.comm__qcard-q {
  font-size: var(--fs-body);
  color: var(--text-primary);
  line-height: var(--lh-relaxed);
}
.comm__qcard-a {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
}
.comm__qcard-step {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
}
.comm__qcard-step-t {
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.comm__actions {
  display: flex;
  gap: var(--sp-2);
}
.comm__danger {
  color: var(--error) !important;
}
.comm__comments {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__comment-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__comment {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.comm__comment-head {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
}
.comm__comment-body {
  font-size: var(--fs-body);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--lh-relaxed);
}
.comm__comment-input {
  display: flex;
  gap: var(--sp-2);
}
.comm__input {
  flex: 1;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
}
.comm__input:focus {
  outline: none;
  border-color: var(--primary-line);
}
.comm__textarea {
  resize: vertical;
  min-height: 96px;
}
.comm__label {
  display: block;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  margin: var(--sp-3) 0 var(--sp-2);
}
.comm__empty {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin: 0;
}
.comm__group-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.comm__invite {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.comm__code {
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-size: var(--fs-body);
  letter-spacing: 0.08em;
}
.comm__member-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.comm__member {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
}
.comm__msgs {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__msg-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__msg {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.comm__msg.is-question {
  border: var(--border-subtle);
  background: var(--primary-soft-3);
}
.comm__msg-head {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  margin-bottom: var(--sp-1);
}
.comm__msg-body {
  font-size: var(--fs-body);
  color: var(--text-primary);
  margin: 0;
  white-space: pre-wrap;
}
.comm__msg-q {
  font-size: var(--fs-body);
  color: var(--text-primary);
}

.comm-drawer-enter-active,
.comm-drawer-leave-active {
  transition: opacity 0.25s ease;
}
.comm-drawer-enter-active .comm__drawer-panel,
.comm-drawer-leave-active .comm__drawer-panel {
  transition: transform 0.25s ease;
}
.comm-drawer-enter-from,
.comm-drawer-leave-to {
  opacity: 0;
}
.comm-drawer-enter-from .comm__drawer-panel,
.comm-drawer-leave-to .comm__drawer-panel {
  transform: translateX(30px);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .comm {
    max-width: none;
  }
}
</style>
