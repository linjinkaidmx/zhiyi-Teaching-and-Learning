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
        <UiSegmented
          :model-value="sort"
          :options="SORTS.map((s) => ({ label: s.label, value: s.key }))"
          aria-label="排序"
          @change="switchSort"
        />
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
            <span class="comm__avatar" :style="avatarStyle(authorName(p.user_id))">{{ letterOf(authorName(p.user_id)) }}</span>
            <span class="comm__type" :class="p.type === 'question' ? 'is-q' : 'is-t'">
              <UiIcon :name="p.type === 'question' ? 'book' : 'pencil'" :size="11" />
              {{ p.type === 'question' ? '题目' : '感想' }}
            </span>
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
          <p v-else class="comm__post-body"><MathText :content="clip(p.content, 120)" /></p>
          <div class="comm__post-foot">
            <span class="comm__stat"><UiIcon name="chat" :size="14" /> {{ p.comment_count }}</span>
            <span class="comm__stat"><UiIcon name="thumbUp" :size="14" /> {{ p.like_count }}</span>
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
      <div class="comm__toolbar comm__toolbar--end">
        <UiButton variant="secondary" size="sm" icon="users" @click="joinOpen = true">加入小组</UiButton>
        <UiButton variant="primary" size="sm" icon="plus" @click="createOpen = true">创建小组</UiButton>
      </div>

      <div v-if="groups.length" class="comm__groups">
        <button v-for="g in groups" :key="g.id" type="button" class="comm__group surface-standard" @click="openGroup(g)">
          <div class="comm__group-head">
            <span class="comm__group-ic"><UiIcon name="users" :size="16" /></span>
            <span v-if="g.my_role === 'owner'" class="comm__badge-owner">组长</span>
          </div>
          <div class="comm__group-main">
            <span class="comm__group-name">{{ g.name }}</span>
            <span v-if="g.description" class="comm__group-desc">{{ g.description }}</span>
            <span v-else class="comm__group-desc is-empty">还没有小组简介</span>
          </div>
          <div class="comm__group-foot">
            <span class="comm__group-count"><UiIcon name="users" :size="13" /> {{ g.member_count }} 人</span>
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
            <button class="comm__drawer-close" type="button" aria-label="关闭" @click="closePost"><UiIcon name="close" :size="15" /></button>
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
              <UiButton variant="ghost" size="sm" icon="thumbUp" @click="onLike(post)">
                {{ post.like_count }} {{ post.liked ? '已赞' : '点赞' }}
              </UiButton>
              <UiButton v-if="isOwn(post)" variant="ghost" size="sm" class="comm__danger" @click="deletePost">删除</UiButton>
            </div>

            <div class="comm__comments">
              <h3 class="t-h3">评论（{{ comments.length }}）</h3>
              <div v-if="comments.length" class="comm__comment-list">
                <div v-for="c in comments" :key="c.id" class="comm__comment">
                  <div class="comm__comment-head">
                    <span class="comm__avatar is-sm" :style="avatarStyle(authorName(c.user_id))">{{ letterOf(authorName(c.user_id)) }}</span>
                    <span class="comm__post-author">{{ authorName(c.user_id) }}</span>
                    <span class="comm__post-time">{{ timeAgo(c.created_at) }}</span>
                  </div>
                  <p class="comm__comment-body"><MathText :content="c.content" /></p>
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
            <div class="comm__drawer-ops">
              <UiButton v-if="group.my_role === 'owner'" variant="ghost" size="sm" class="comm__danger" @click="dissolveGroup">解散小组</UiButton>
              <UiButton v-else variant="ghost" size="sm" class="comm__danger" @click="quitGroup">退出小组</UiButton>
              <button class="comm__drawer-close" type="button" aria-label="关闭" @click="closeGroup"><UiIcon name="close" :size="15" /></button>
            </div>
          </header>

          <div class="comm__drawer-body">
            <div class="comm__group-tools">
              <div class="comm__invite">
                <span class="t-label">邀请码</span>
                <code class="comm__code">{{ group.invite_code }}</code>
                <button class="comm__copy" type="button" title="复制邀请码" @click="copyInvite">
                  <UiIcon name="clipboard" :size="12" /> 复制
                </button>
              </div>
              <UiButton v-if="group.my_role === 'owner'" variant="ghost" size="sm" @click="inviteOpen = true">按昵称邀请</UiButton>
            </div>

            <div class="comm__members">
              <h3 class="t-h3">成员</h3>
              <div class="comm__member-list">
                <span v-for="m in members" :key="m.user_id" class="comm__member">
                  <span class="comm__avatar is-mini" :style="avatarStyle(authorName(m.user_id))">{{ letterOf(authorName(m.user_id)) }}</span>
                  <span class="comm__member-name">{{ m.user_id }}</span>
                  <span v-if="m.role === 'owner'" class="comm__badge-owner">组长</span>
                  <span v-else class="comm__member-time">{{ timeAgo(m.joined_at) }}加入</span>
                  <button
                    v-if="group.my_role === 'owner' && m.role !== 'owner'"
                    class="comm__member-del"
                    type="button"
                    title="移出小组"
                    @click="removeMember(m)"
                  ><UiIcon name="close" :size="12" /></button>
                </span>
              </div>
            </div>

            <div class="comm__msgs">
              <div class="comm__msgs-head">
                <h3 class="t-h3">讨论（{{ msgTotal }}）</h3>
                <UiButton
                  v-if="messages.length < msgTotal"
                  variant="text"
                  size="sm"
                  :loading="loadingMore"
                  @click="loadEarlier"
                >加载更早</UiButton>
              </div>
              <div ref="groupScroll" class="comm__msg-list">
                <div v-if="!messages.length" class="comm__empty">还没有消息，分享一道题或打个招呼吧。</div>
                <div
                  v-for="m in messages"
                  :key="m.id"
                  class="comm__msg"
                  :class="{ 'is-own': isOwnMsg(m), 'is-question': m.type === 'question' }"
                >
                  <span class="comm__avatar is-sm" :style="avatarStyle(authorName(m.user_id))">{{ letterOf(authorName(m.user_id)) }}</span>
                  <div class="comm__msg-main">
                    <div class="comm__msg-head">
                      <span class="comm__post-author">{{ authorName(m.user_id) }}</span>
                      <span class="comm__post-time">{{ timeAgo(m.created_at) }}</span>
                    </div>
                    <div class="comm__bubble">
                      <template v-if="m.type === 'question'">
                        <div class="comm__qmsg-q"><MathText :content="msgCard(m).question || ''" /></div>
                        <div v-if="msgCard(m).answer" class="comm__qmsg-row">
                          <span class="comm__qmsg-label">答案</span>
                          <MathText :content="msgCard(m).answer" />
                        </div>
                        <div v-if="(msgCard(m).knowledgePoints || []).length" class="comm__post-tags">
                          <UiTag v-for="k in msgCard(m).knowledgePoints" :key="k" variant="brand-soft">{{ k }}</UiTag>
                        </div>
                      </template>
                      <p v-else class="comm__msg-body comm__pre"><MathText :content="m.content" /></p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="comm__comment-input">
                <button class="comm__share-btn" type="button" title="分享错题到小组" @click="sharePickOpen = true">
                  <UiIcon name="plus" :size="16" />
                </button>
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

    <!-- 分享错题到小组 -->
    <UiModal v-model="sharePickOpen" title="分享错题到小组" size="md">
      <p class="t-body-2">选一道错题，把题干和答案分享到小组讨论，大家一起看。</p>
      <div v-if="shareItems.length" class="comm__share-list">
        <button
          v-for="it in shareItems"
          :key="it.id"
          type="button"
          class="comm__share-item"
          @click="shareToGroup(it)"
        >
          <MathText :content="it.question || ''" />
        </button>
      </div>
      <p v-else class="t-body-2">错题本还是空的，先去拍题保存几道再来分享。</p>
    </UiModal>
  </div>
  <!-- 新手教程 -->
  <UiTour v-model="tourOpen" tour-key="community" />
</template>

<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { recordAction } from '../statsStore'
import { useRoute } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiTour from '../ui/UiTour.vue'
import { useTour } from '../lib/useTour.js'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import MathText from '../components/MathText.vue'
import { api } from '../api'
import { session } from '../stores/sessionStore'
import { openAuth } from '../stores/uiStore'
import { bookRef } from '../stores/bookStore'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'

const TABS = [
  { label: '论坛', value: 'forum', icon: 'chat' },
  { label: '我的小组', value: 'group', icon: 'users' },
]
const SORTS = [
  { label: '最新', key: 'latest', icon: 'clock' },
  { label: '热门', key: 'hot', icon: 'flame' },
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
  if (v === 'forum') stopGroupStream()   // 切走时断开小组实时流
})
loadPosts(true)

onBeforeUnmount(() => {
  stopGroupStream()
})

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
    await api.forum.post(session.token, 'thought', postTitle.value.trim(), postContent.value.trim())
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
const msgTotal = ref(0)
const loadingMore = ref(false)
const groupScroll = ref(null)
let groupCtrl = null       // SSE 流的 AbortController
let seenIds = new Set()    // 消息去重（流 + 初始拉取可能重叠）

function scrollGroupBottom() {
  const el = groupScroll.value
  if (el) el.scrollTop = el.scrollHeight
}
function stopGroupStream() {
  if (groupCtrl) { groupCtrl.abort(); groupCtrl = null }
}
/** 实时流：后端每 2s 推 since 之后的新消息；按 id 去重、贴底时才自动滚 */
function startGroupStream(gid) {
  stopGroupStream()
  groupCtrl = new AbortController()
  const last = messages.value[messages.value.length - 1]
  const since = (last && last.created_at) || 0
  api.group.messagesStream(
    { token: session.token, group_id: gid, since },
    {
      signal: groupCtrl.signal,
      onItems: (items) => {
        const el = groupScroll.value
        const stick = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60
        let added = 0
        for (const m of items) {
          const k = String(m.id)
          if (!seenIds.has(k)) { seenIds.add(k); messages.value.push(m); added += 1 }
        }
        if (added) {
          msgTotal.value += added
          if (stick) nextTick(scrollGroupBottom)
        }
      },
      onEnd: () => {
        // 300s 超时/断流：抽屉还开着就重连
        if (group.value && group.value.id === gid) {
          setTimeout(() => { if (group.value && group.value.id === gid) startGroupStream(gid) }, 800)
        }
      },
    },
  ).catch(() => {})
}

async function openGroup(g) {
  try {
    const [d, msgs] = await Promise.all([
      api.group.detail(session.token, g.id),
      api.group.messages(session.token, g.id),
    ])
    group.value = { ...g, ...(d.group || {}) }
    members.value = d.members || []
    messages.value = msgs.items
    msgTotal.value = msgs.total
    seenIds = new Set(msgs.items.map((m) => String(m.id)))
    startGroupStream(g.id)
    nextTick(scrollGroupBottom)
  } catch (e) {
    toastError(e)
  }
}
function closeGroup() {
  stopGroupStream()
  group.value = null
  members.value = []
  messages.value = []
  msgDraft.value = ''
  msgTotal.value = 0
}

/** 本地追加一条自己发的消息（不等流回推，立即可见） */
function appendOwn(msg) {
  if (!msg) return
  const k = String(msg.id)
  if (seenIds.has(k)) return
  seenIds.add(k)
  messages.value.push(msg)
  msgTotal.value += 1
  nextTick(scrollGroupBottom)
}

async function sendMessage() {
  const text = msgDraft.value.trim()
  if (!text || !group.value) return
  try {
    const m = await api.group.send(session.token, group.value.id, 'text', text)
    msgDraft.value = ''
    appendOwn(m)
  } catch (e) {
    toastError(e)
  }
}

/** 加载更早的消息（往上接） */
async function loadEarlier() {
  if (!group.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const r = await api.group.messages(session.token, group.value.id, 100, messages.value.length)
    r.items.forEach((m) => seenIds.add(String(m.id)))
    messages.value = [...r.items, ...messages.value]
  } catch (e) {
    toastError(e)
  } finally {
    loadingMore.value = false
  }
}

/* ---------- 分享错题到小组 ---------- */
const sharePickOpen = ref(false)
const shareItems = computed(() =>
  (bookRef().value || []).filter((it) => it && it.kind !== 'note').slice(0, 30),
)
async function shareToGroup(it) {
  if (!group.value) return
  const card = JSON.stringify({
    question: it.question || '',
    answer: it.answer || '',
    steps: it.steps || [],
    knowledgePoints: it.knowledgePoints || [],
  })
  try {
    const m = await api.group.send(session.token, group.value.id, 'question', card)
    sharePickOpen.value = false
    appendOwn(m)
  } catch (e) {
    toastError(e)
  }
}

/* ---------- 退出 / 解散 / 移除成员 ---------- */
async function quitGroup() {
  if (!group.value) return
  ElMessageBox.confirm('退出后需要重新用邀请码才能加入，组内消息也不再对你可见。确定退出吗？', '退出小组', {
    type: 'warning', confirmButtonText: '退出', cancelButtonText: '取消',
  }).then(async () => {
    try {
      await api.group.quit(session.token, group.value.id)
      toast.success('已退出小组')
      closeGroup()
      loadGroups()
    } catch (e) {
      toastError(e)
    }
  }).catch(() => {})
}
async function dissolveGroup() {
  if (!group.value) return
  ElMessageBox.confirm('解散后小组与全部讨论记录会被清除，无法恢复。确定解散吗？', '解散小组', {
    type: 'warning', confirmButtonText: '解散', cancelButtonText: '取消',
  }).then(async () => {
    try {
      await api.group.dissolve(session.token, group.value.id)
      toast.success('小组已解散')
      closeGroup()
      loadGroups()
    } catch (e) {
      toastError(e)
    }
  }).catch(() => {})
}
async function removeMember(m) {
  if (!group.value) return
  ElMessageBox.confirm(`把 ${m.nickname || m.user_id} 移出小组？之后他可以重新用邀请码加入。`, '移除成员', {
    type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消',
  }).then(async () => {
    try {
      await api.group.removeMember(session.token, group.value.id, m.user_id)
      toast.success('已移除')
      const d = await api.group.detail(session.token, group.value.id)
      members.value = d.members || []
    } catch (e) {
      toastError(e)
    }
  }).catch(() => {})
}
/** 题目消息：解析卡片 JSON（题干/答案/知识点），解析失败退回纯文本 */
function msgCard(m) {
  try {
    const c = JSON.parse(m.content)
    if (c && typeof c === 'object') return c
  } catch {
    /* 非 JSON：当纯文本 */
  }
  return { question: m.content }
}
function msgQuestion(m) {
  return msgCard(m).question || m.content
}
/** 是不是自己发的（user_id 存的是昵称，与 session.userId 同源） */
function isOwnMsg(m) {
  return !!session.userId && m.user_id === session.userId
}
/** 复制邀请码（非 HTTPS 环境 clipboard 不可用时给出提示） */
async function copyInvite() {
  const code = (group.value && group.value.invite_code) || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    toast.success('邀请码已复制')
  } catch {
    toast.error('复制失败，请手动选中复制')
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

/* 作者字母头像：按名字哈希取一个稳定底色（与「我的」页头像同风格） */
const AVATAR_TONES = ['#7c5cff', '#3a78c0', '#2f7a4d', '#d0762a', '#c9503a', '#5b5bd6']
function avatarStyle(name) {
  const s = String(name || '?')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997
  return { background: AVATAR_TONES[h % AVATAR_TONES.length] }
}
function letterOf(name) {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?'
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

/* 新手教程：首次进入本页自动弹（看过不再弹） */
const { tourOpen } = useTour('community')

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
.comm__toolbar--end {
  justify-content: flex-end;
}
/* 分段控件宽度自适应，别被 flex 容器拉满整行 */
.comm > .ui-seg,
.comm__toolbar > .ui-seg {
  align-self: flex-start;
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
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.comm__post:hover {
  transform: translateY(-1px);
  border-color: var(--primary-line);
  box-shadow: var(--shadow-subtle);
}
.comm__post-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
/* 作者字母头像 */
.comm__avatar {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: var(--fw-medium);
}
.comm__avatar.is-sm {
  width: 22px;
  height: 22px;
  font-size: 11px;
}
.comm__avatar.is-mini {
  width: 20px;
  height: 20px;
  font-size: 10px;
}
/* 组长徽标 */
.comm__badge-owner {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  color: #fff;
  font-size: 10px;
  font-weight: var(--fw-medium);
}
/* 帖子类型 pill（带图标） */
.comm__type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
}
.comm__type.is-q {
  background: var(--primary-soft-3);
  color: var(--primary-text);
  border: 0.5px solid var(--primary-line);
}
.comm__type.is-t {
  background: var(--surface-unit);
  color: var(--text-tertiary);
  border: 0.5px solid var(--border-subtle);
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}

/* 小组卡片网格（替代一根长横条） */
.comm__groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
  gap: var(--sp-3);
}
.comm__group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4);
  cursor: pointer;
  text-align: left;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.comm__group:hover {
  transform: translateY(-2px);
  border-color: var(--primary-line);
  box-shadow: var(--shadow-elevated);
}
.comm__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.comm__group-ic {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.comm__group-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 44px;
}
.comm__group-name {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comm__group-desc {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  line-height: var(--lh-relaxed);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.comm__group-desc.is-empty {
  color: var(--text-disabled);
}
.comm__group-foot {
  display: flex;
  align-items: center;
  padding-top: var(--sp-2);
  border-top: var(--border-divider-soft);
}
.comm__group-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-label);
  color: var(--text-muted);
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
  align-items: center;
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
  align-items: center;
}
/* 分享错题：图标按钮（不占横向空间，输入框留足） */
.comm__share-btn {
  flex: none;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--primary-line);
  background: var(--primary-soft-2);
  color: var(--primary-text);
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.comm__share-btn:hover {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.comm__input {
  flex: 1;
  min-width: 0;
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
/* 抽屉分区：邀请码 / 成员 各自成块 */
.comm__group-tools,
.comm__members {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
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
.comm__copy {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--primary-line);
  background: var(--surface-1);
  color: var(--primary-text);
  font-family: inherit;
  font-size: var(--fs-label);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.comm__copy:hover {
  background: var(--primary-soft-2);
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
  padding: 4px 8px 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
}
.comm__member-name {
  color: var(--text-primary);
}
.comm__member-time {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.comm__member-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.comm__member-del:hover {
  background: rgba(201, 80, 58, 0.12);
  color: #c9503a;
}
.comm__drawer-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.comm__msgs {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.comm__msgs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.comm__msg-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 4px;
}
/* 分享错题选择列表 */
.comm__share-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  max-height: 52vh;
  overflow-y: auto;
}
.comm__share-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  line-height: var(--lh-relaxed);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.comm__share-item:hover {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
/* 消息气泡化：自己的靠右紫底，别人的靠左白底 */
.comm__msg {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
}
.comm__msg.is-own {
  flex-direction: row-reverse;
}
.comm__msg-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  max-width: 86%;
}
.comm__msg.is-own .comm__msg-main {
  align-items: flex-end;
}
.comm__msg-head {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
}
.comm__msg.is-own .comm__msg-head {
  flex-direction: row-reverse;
}
.comm__bubble {
  padding: 8px 12px;
  border-radius: 12px;
  border-top-left-radius: 4px;
  background: var(--surface-1);
  border: var(--border-subtle);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
  line-height: var(--lh-relaxed);
}
.comm__msg.is-own .comm__bubble {
  border-radius: 12px;
  border-top-right-radius: 4px;
  background: var(--primary);
  border-color: transparent;
  color: #fff;
}
.comm__msg.is-question .comm__bubble {
  background: var(--primary-soft-3);
  border-color: var(--primary-line);
  color: var(--text-primary);
}
.comm__msg-body {
  font-size: var(--fs-body-2);
  color: inherit;
  margin: 0;
  white-space: pre-wrap;
}
/* 分享的题目卡片：题干 + 答案 + 知识点 */
.comm__qmsg-q {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  line-height: var(--lh-relaxed);
}
.comm__qmsg-row {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  margin-top: 6px;
  padding-top: 6px;
  border-top: var(--border-divider-soft);
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.comm__qmsg-label {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.comm__msg .comm__post-tags {
  margin-top: 6px;
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
