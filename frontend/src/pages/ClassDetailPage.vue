<template>
  <div class="zy-page">
    <div class="zy-container clsd">
      <header class="clsd__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <div class="clsd__title-row">
          <h1 class="t-h1">{{ cls?.name || '班级' }}</h1>
          <span v-if="isTeacher" class="clsd__badge">老师</span>
        </div>
        <p v-if="cls" class="t-body-2">
          {{ meta.subject || '未设科目' }}<template v-if="meta.grade"> · {{ meta.grade }}</template>
          <template v-if="isTeacher"> · 班级码 <code class="clsd__code">{{ cls.invite_code }}</code></template>
        </p>
      </header>

      <UiSegmented v-model="tab" :options="TAB_OPTIONS" />

      <!-- ============ 群聊 ============ -->
      <section v-show="tab === 'chat'" class="clsd__chat">
        <div ref="chatBox" class="clsd__msgs">
          <div
            v-for="m in messages"
            :key="m.id"
            class="clsd__msg"
            :class="{ 'clsd__msg--mine': m.user_id === session.userId && m.type === 'text' }"
          >
            <div v-if="m.type !== 'text'" class="clsd__sys">{{ m.type === 'feedback' ? '批改反馈' : '班级动态' }} · {{ m.content }}</div>
            <template v-else>
              <span class="clsd__msg-user">{{ m.user_id }}</span>
              <div class="clsd__msg-bubble surface-elevated"><MathText :content="m.content" /></div>
            </template>
          </div>
          <p v-if="!messages.length" class="t-label clsd__chat-empty">还没有消息，说点什么吧</p>
        </div>
        <div class="clsd__chat-input">
          <input
            v-model="draft"
            class="clsd__chat-text"
            type="text"
            placeholder="发消息…"
            maxlength="500"
            @keydown.enter="send"
          />
          <UiButton variant="primary" size="sm" :loading="sending" :disabled="!draft.trim()" @click="send">发送</UiButton>
          <UiButton variant="ghost" size="sm" @click="loadMessages">刷新</UiButton>
        </div>
      </section>

      <!-- ============ 作业 ============ -->
      <section v-show="tab === 'hw'" class="clsd__hw">
        <div class="clsd__hw-head">
          <h2 class="t-h3">作业</h2>
          <UiButton v-if="isTeacher" variant="primary" size="sm" @click="openAssign">布置作业</UiButton>
        </div>

        <div v-if="hwList.length" class="clsd__list">
          <button
            v-for="hw in hwList"
            :key="hw.id"
            type="button"
            class="clsd__item surface-standard"
            @click="openHomework(hw)"
          >
            <span class="clsd__item-main">
              <span class="clsd__item-title">
                {{ hw.title }}
                <span v-if="hw.images_count" class="clsd__hw-imgtag">图 {{ hw.images_count }}</span>
              </span>
              <span class="t-label">
                <template v-if="isTeacher">已交 {{ hw.submitted || 0 }}/{{ hw.total_students }} · 已批 {{ hw.graded || 0 }}</template>
                <template v-else>
                  {{ hw.my_submission ? (hw.my_submission.graded_at ? `已批 · ${hw.my_submission.score} 分` : '已提交，待批改') : '未提交' }}
                  <template v-if="hw.due_at"> · 截止 {{ fmtDate(hw.due_at) }}</template>
                </template>
              </span>
            </span>
            <span class="clsd__arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <UiEmptyState v-else title="还没有作业" :description="isTeacher ? '点右上角布置第一份作业。' : '老师布置作业后会出现在这里。'" />
      </section>

      <!-- ============ 笔记 / 知识点 ============ -->
      <section v-show="tab === 'notes'" class="clsd__hw">
        <div class="clsd__hw-head">
          <h2 class="t-h3">笔记 · 知识点</h2>
          <UiButton v-if="isTeacher" variant="primary" size="sm" @click="openNote">发布笔记</UiButton>
        </div>

        <div v-if="noteList.length" class="clsd__list">
          <button
            v-for="nt in noteList"
            :key="nt.id"
            type="button"
            class="clsd__item surface-standard"
            @click="openNoteView(nt)"
          >
            <span class="clsd__item-main">
              <span class="clsd__item-title">
                {{ nt.title }}
                <span v-if="nt.images_count" class="clsd__hw-imgtag">图 {{ nt.images_count }}</span>
              </span>
              <span class="t-label">
                {{ nt.content ? plainSummary(nt.content, 40) : '查看详情' }}
                <template v-if="nt.created_at"> · {{ fmtDate(nt.created_at) }}</template>
              </span>
            </span>
            <span class="clsd__arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <UiEmptyState v-else title="还没有笔记" :description="isTeacher ? '点右上角发布第一篇知识点或笔记。' : '老师发布笔记后会出现在这里，可一键存入错题学习。'" />
      </section>

      <!-- ============ 测试 ============ -->
      <section v-show="tab === 'tests'" class="clsd__hw">
        <div class="clsd__hw-head">
          <h2 class="t-h3">测试</h2>
          <UiButton v-if="isTeacher" variant="primary" size="sm" @click="openTestCreate">发布测试</UiButton>
        </div>

        <div v-if="testList.length" class="clsd__list">
          <button
            v-for="t in testList"
            :key="t.id"
            type="button"
            class="clsd__item surface-standard"
            @click="openTest(t)"
          >
            <span class="clsd__item-main">
              <span class="clsd__item-title">{{ t.title }}</span>
              <span class="t-label">
                {{ t.question_count }} 题 · {{ t.total_score }} 分 · 限时 {{ Math.round(t.duration_sec / 60) }} 分钟
                <template v-if="isTeacher"> · 已考 {{ t.attempt_count }} 人</template>
                <template v-else-if="t.my_score !== null && t.my_score !== undefined">
                  · 我的成绩 {{ t.my_score }} 分{{ t.my_timeout ? '（超时）' : '' }}
                </template>
                <template v-else> · 未参加</template>
              </span>
            </span>
            <span class="clsd__arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <UiEmptyState v-else title="还没有测试" :description="isTeacher ? '点右上角发布第一场测试（自己出题或 AI 生成）。' : '老师发布测试后会出现在这里。'" />
      </section>

      <!-- ============ 成员 ============ -->
      <section v-show="tab === 'members'" class="clsd__members">
        <div class="clsd__hw-head">
          <h2 class="t-h3">成员 · {{ members.length }} 人</h2>
          <UiButton v-if="isTeacher" variant="ghost" size="sm" @click="inviteOpen = true">按昵称拉人</UiButton>
        </div>
        <div class="clsd__member-list">
          <div v-for="m in members" :key="m.user_id" class="clsd__member surface-standard">
            <span class="clsd__member-name">{{ m.user_id }}</span>
            <span v-if="m.role === 'teacher'" class="clsd__badge">老师</span>
          </div>
        </div>
      </section>

      <!-- 布置作业弹窗 -->
      <UiModal v-model="assignOpen" title="布置作业" size="md">
        <label class="clsd__label" for="hw-title">作业标题</label>
        <input id="hw-title" v-model="hwForm.title" class="clsd__input" type="text" placeholder="例如：第 3 周作业" />
        <label class="clsd__label" for="hw-content">作业内容（题目 / 要求，可粘多题；有图时可留空）</label>
        <textarea id="hw-content" v-model="hwForm.content" class="clsd__input clsd__textarea" rows="6" placeholder="1. 求 …&#10;2. 证明 …" />
        <label class="clsd__label">作业图片（选填，最多 9 张；可直接拍试卷）</label>
        <div class="clsd__imgs">
          <div v-for="(im, i) in hwForm.images" :key="i" class="clsd__img">
            <img :src="im" alt="作业图片" />
            <button type="button" class="clsd__img-del" aria-label="移除这张图" @click="hwForm.images.splice(i, 1)">×</button>
          </div>
          <label v-if="hwForm.images.length < 9" class="clsd__img-add">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              class="clsd__file"
              @change="onPickHwImages"
            />
            ＋ 拍照 / 选图
          </label>
        </div>
        <label class="clsd__label" for="hw-ref">参考答案 / 评分要点（选填，给 AI 批改用）</label>
        <textarea id="hw-ref" v-model="hwForm.reference" class="clsd__input clsd__textarea" rows="3" placeholder="写清楚采分点，批改会更准" />
        <label class="clsd__label" for="hw-due">截止时间（选填）</label>
        <input id="hw-due" v-model="hwForm.due" class="clsd__input" type="datetime-local" />
        <UiButton variant="primary" block :loading="assignBusy" :disabled="!hwForm.title.trim() || (!hwForm.content.trim() && !hwForm.images.length)" @click="submitAssign">
          发布作业
        </UiButton>
      </UiModal>

      <!-- 发布笔记弹窗 -->
      <UiModal v-model="noteAssignOpen" title="发布笔记 / 知识点" size="md">
        <label class="clsd__label" for="note-title">标题</label>
        <input id="note-title" v-model="noteForm.title" class="clsd__input" type="text" placeholder="例如：定积分三大方法" />
        <label class="clsd__label" for="note-content">内容（知识点 / 讲解，学生可一键存入错题学习）</label>
        <textarea id="note-content" v-model="noteForm.content" class="clsd__input clsd__textarea" rows="6" placeholder="换元法：…&#10;分部积分：…" />
        <label class="clsd__label">配图（选填，最多 9 张）</label>
        <div class="clsd__imgs">
          <div v-for="(im, i) in noteForm.images" :key="i" class="clsd__img">
            <img :src="im" alt="笔记配图" />
            <button type="button" class="clsd__img-del" aria-label="移除这张图" @click="noteForm.images.splice(i, 1)">×</button>
          </div>
          <label v-if="noteForm.images.length < 9" class="clsd__img-add">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              class="clsd__file"
              @change="onPickNoteImages"
            />
            ＋ 拍照 / 选图
          </label>
        </div>
        <UiButton variant="primary" block :loading="noteBusy" :disabled="!noteForm.title.trim() || (!noteForm.content.trim() && !noteForm.images.length)" @click="submitNote">
          发布笔记
        </UiButton>
      </UiModal>

      <!-- 笔记详情弹窗 -->
      <UiModal v-model="noteViewOpen" :title="noteView?.title || '笔记'" size="lg">
        <p v-if="noteView?.content" class="clsd__note-content clsd__pre"><MathText :content="noteView.content" /></p>
        <p v-else-if="noteViewImages.length" class="t-body-2 clsd__note-content">以图片内容为准。</p>
        <div v-if="noteViewImages.length" class="clsd__note-imgs">
          <img v-for="(im, i) in noteViewImages" :key="i" :src="im" class="clsd__note-img" alt="笔记配图" />
        </div>
        <p v-if="!noteViewImages.length && noteView?.images_count" class="t-body-2">配图加载中…</p>
        <div class="clsd__note-ops">
          <UiButton v-if="!isTeacher" variant="primary" block @click="saveNoteToBook">
            保存到错题学习
          </UiButton>
          <UiButton v-if="isTeacher" variant="ghost" block @click="removeNote">删除这篇笔记</UiButton>
        </div>
      </UiModal>

      <!-- 发布测试弹窗 -->
      <UiModal v-model="testOpen" title="发布测试" size="lg">
        <label class="clsd__label" for="t-title">测试标题</label>
        <input id="t-title" v-model="testForm.title" class="clsd__input" type="text" placeholder="例如：第三章限时测验" />
        <label class="clsd__label" for="t-duration">限时（分钟，1~180）</label>
        <input id="t-duration" v-model.number="testForm.durationMin" class="clsd__input" type="number" min="1" max="180" />
        <label class="clsd__label">出题方式</label>
        <UiSegmented v-model="testForm.source" :options="[{ label: '自己出题', value: 'manual' }, { label: 'AI 生成', value: 'ai' }]" />

        <template v-if="testForm.source === 'manual' && !testForm.items.length">
          <p class="t-body-2 clsd__gen-tip">从空白试卷开始：逐题添加选择题或填空题，发布后班级成员限时作答。</p>
          <UiButton variant="ghost" block @click="addTestQuestion('choice')">＋ 添加第一题</UiButton>
        </template>

        <template v-if="testForm.source === 'ai' && !testForm.items.length">
          <label class="clsd__label" for="t-subject">学科</label>
          <input id="t-subject" v-model="testForm.subject" class="clsd__input" type="text" placeholder="例如：高等数学" />
          <label class="clsd__label" for="t-topic">考察范围（选填）</label>
          <input id="t-topic" v-model="testForm.topic" class="clsd__input" type="text" placeholder="例如：第 1-3 章 极限与连续" />
          <div class="clsd__grid2">
            <div>
              <label class="clsd__label" for="t-cc">选择题数量</label>
              <input id="t-cc" v-model.number="testForm.choiceCount" class="clsd__input" type="number" min="0" max="50" />
            </div>
            <div>
              <label class="clsd__label" for="t-cs">每题分值</label>
              <input id="t-cs" v-model.number="testForm.choiceScore" class="clsd__input" type="number" min="0.5" step="0.5" />
            </div>
            <div>
              <label class="clsd__label" for="t-bc">填空题数量</label>
              <input id="t-bc" v-model.number="testForm.blankCount" class="clsd__input" type="number" min="0" max="50" />
            </div>
            <div>
              <label class="clsd__label" for="t-bs">每题分值</label>
              <input id="t-bs" v-model.number="testForm.blankScore" class="clsd__input" type="number" min="0.5" step="0.5" />
            </div>
          </div>
          <UiButton variant="primary" block :loading="testBusy" :disabled="!(testForm.choiceCount > 0 || testForm.blankCount > 0)" @click="generateTest">
            AI 生成题目草稿
          </UiButton>
          <p class="t-body-2 clsd__gen-tip">生成后进入下方草稿编辑，可修改题干、选项、答案后再发布。</p>
        </template>

        <template v-if="testForm.items.length">
          <label class="clsd__label">题目草稿（共 {{ testForm.items.length }} 题 · 合计 {{ testTotalScore }} 分）</label>
          <div v-for="(q, i) in testForm.items" :key="i" class="clsd__qcard">
            <div class="clsd__qcard-head">
              <span class="clsd__qcard-no">{{ i + 1 }}. {{ q.type === 'choice' ? '选择题' : '填空题' }}（{{ q.score }} 分）</span>
              <button type="button" class="clsd__img-del" aria-label="删除该题" @click="testForm.items.splice(i, 1)">×</button>
            </div>
            <textarea v-model="q.question" class="clsd__input clsd__textarea" rows="2" placeholder="题干（可用 LaTeX，行内公式 $...$）" />
            <template v-if="q.type === 'choice'">
              <input v-for="(o, oi) in q.options" :key="oi" v-model="q.options[oi]" class="clsd__input" type="text" :placeholder="String.fromCharCode(65 + oi) + '. 选项内容'" />
              <label class="clsd__label">正确答案</label>
              <UiSegmented v-model="q.answer" :options="q.options.slice(0, 4).map((_, oi) => ({ label: String.fromCharCode(65 + oi), value: String.fromCharCode(65 + oi) }))" />
            </template>
            <template v-else>
              <label class="clsd__label">标准答案（判分按精确匹配，去空格比对）</label>
              <input v-model="q.answer" class="clsd__input" type="text" placeholder="例如：1/2 或 f'(x)=2x" />
            </template>
          </div>
          <div class="clsd__grid2">
            <UiButton variant="ghost" block @click="addTestQuestion('choice')">＋ 加一道选择题</UiButton>
            <UiButton variant="ghost" block @click="addTestQuestion('blank')">＋ 加一道填空题</UiButton>
          </div>
          <UiButton variant="primary" block :loading="testBusy" :disabled="!testForm.title.trim() || !testForm.items.length" @click="submitTest">
            发布测试
          </UiButton>
        </template>
      </UiModal>

      <!-- 测试排名弹窗 -->
      <UiModal v-model="rankOpen" :title="rankTest ? `排名 · ${rankTest.title}` : '排名'" size="md">
        <p class="t-body-2 clsd__rank-head">
          已考 {{ rankData.attempt_count || 0 }} / {{ rankData.total_students || 0 }} 人 · 满分 {{ rankTest?.total_score }} 分 · 得分高且用时短者靠前
        </p>
        <div v-if="rankData.rank && rankData.rank.length" class="clsd__rank-list">
          <div
            v-for="r in rankData.rank"
            :key="r.user_id"
            class="clsd__rank-row"
            :class="{ 'is-me': r.is_me }"
          >
            <span class="clsd__rank-no">{{ r.rank }}</span>
            <span class="clsd__rank-name">{{ r.user_id }}<UiTag v-if="r.is_timeout" variant="warning">超时</UiTag></span>
            <span class="clsd__rank-score">{{ r.score }} 分<i>· {{ r.duration_sec }} 秒 · 对 {{ r.correct_count }} 题</i></span>
          </div>
        </div>
        <p v-else class="t-body-2">还没有人提交。</p>
      </UiModal>

      <!-- 按昵称拉人弹窗 -->
      <UiModal v-model="inviteOpen" title="按昵称拉学生进班" size="sm">
        <p class="t-body-2">输入对方注册知一时用的昵称，直接拉进班级。</p>
        <label class="clsd__label" for="inv-nick">昵称</label>
        <input id="inv-nick" v-model="inviteNick" class="clsd__input" type="text" />
        <UiButton variant="primary" block :loading="inviteBusy" :disabled="!inviteNick.trim()" @click="submitInvite">拉进班级</UiButton>
      </UiModal>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiModal from '../ui/UiModal.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { goBackSmart } from '../lib/nav.js'
import { ROUTES, path } from '../lib/routes.js'
import { api } from '../api.js'
import { getToken } from '../auth.js'
import { session } from '../stores/sessionStore.js'
import { readImageDataUrl, shrinkIfNeeded } from '../lib/imageFile.js'
import { makeNoteItem } from '../book.js'
import MathText from '../components/MathText.vue'
import { latexToPlain } from '../mathtext'
import { upsert as bookUpsert } from '../stores/bookStore'

const route = useRoute()
const router = useRouter()
const classId = computed(() => String(route.params.id || ''))

const TAB_OPTIONS = [
  { label: '群聊', value: 'chat' },
  { label: '作业', value: 'hw' },
  { label: '笔记', value: 'notes' },
  { label: '测试', value: 'tests' },
  { label: '成员', value: 'members' },
]
const tab = ref('chat')

const cls = ref(null)
const isTeacher = ref(false)
const members = ref([])
const messages = ref([])
const hwList = ref([])

const chatBox = ref(null)
const draft = ref('')
const sending = ref(false)

const assignOpen = ref(false)
const assignBusy = ref(false)
const hwForm = reactive({ title: '', content: '', reference: '', due: '', images: [] })

async function onPickHwImages(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length) return
  const room = 9 - hwForm.images.length
  if (room <= 0) {
    toast.error('作业图片最多 9 张')
    return
  }
  const pick = files.slice(0, room)
  if (files.length > room) toast.error(`最多再选 ${room} 张，已自动截取`)
  for (const f of pick) {
    const r = await readImageDataUrl(f, { onError: (m) => toast.error(m) })
    if (!r) continue
    hwForm.images.push(await shrinkIfNeeded(r.dataUrl))
  }
}

const inviteOpen = ref(false)
const inviteBusy = ref(false)
const inviteNick = ref('')

const meta = computed(() => {
  const m = cls.value?.meta
  if (typeof m === 'string') {
    try { return JSON.parse(m || '{}') } catch { return {} }
  }
  return m || {}
})

onMounted(() => {
  loadClass()
  // 群聊：先拉历史，再按 tab 决定是否接实时流
  if (tab.value === 'chat') openChat()
  else loadMessages()
  loadHomework()
})

// 离开页面时关闭群聊实时流，避免长连接残留
onBeforeUnmount(() => stopChatStream())

async function loadClass() {
  try {
    const r = await api.group.detail(getToken(), classId.value)
    if (r.ok) {
      cls.value = r.group
      members.value = r.members || []
      isTeacher.value = (cls.value.my_role || '') === 'teacher' || (cls.value.owner_id || '') === session.userId
    } else {
      toast.error(r.error || '班级不存在')
    }
  } catch {
    toast.error('班级信息加载失败')
  }
}

async function loadMessages() {
  try {
    const d = await api.group.messages(getToken(), classId.value, 100)
    messages.value = d.items
    await nextTick()
    scrollBottom()
  } catch {
    /* 静默：聊天历史失败不打断 */
  }
}
/** 进入群聊：先拉历史再接实时流 */
async function openChat() {
  await loadMessages()
  chatRetry = 0
  startChatStream()
}

/* ============================================================================
   群聊实时化：进群聊 tab 建立 SSE 增量流，切走/离开页面关闭
   ---------------------------------------------------------------------------
   只推「比当前最新消息更新」的消息，前端按 id 去重；服务端 300s 自动结束，
   这里用指数退避重连（最多 3 次），避免网络抖动后一直断着。
   ============================================================================ */
let chatStreamCtrl = null
let chatStreamTimer = null
let chatRetry = 0

function stopChatStream() {
  if (chatStreamCtrl) {
    chatStreamCtrl.abort()
    chatStreamCtrl = null
  }
  if (chatStreamTimer) {
    clearTimeout(chatStreamTimer)
    chatStreamTimer = null
  }
}

function scheduleChatReconnect() {
  if (tab.value !== 'chat') return
  chatRetry += 1
  if (chatRetry > 3) return
  const wait = Math.min(1500 * chatRetry, 6000)
  if (chatStreamTimer) clearTimeout(chatStreamTimer)
  chatStreamTimer = setTimeout(() => startChatStream(), wait)
}

async function startChatStream() {
  stopChatStream()
  if (tab.value !== 'chat' || !classId.value || !getToken()) return
  const ctrl = new AbortController()
  chatStreamCtrl = ctrl
  // 游标：已有消息取最新时间，没有则从现在开始（历史由 loadMessages 负责）
  const since = messages.value.length
    ? Math.max(...messages.value.map((m) => Number(m.created_at) || 0))
    : Date.now()
  try {
    await api.group.messagesStream(
      { token: getToken(), group_id: classId.value, since },
      {
        signal: ctrl.signal,
        onItems: (items) => {
          const known = new Set(messages.value.map((m) => m.id))
          const fresh = items.filter((m) => !known.has(m.id))
          if (!fresh.length) return
          messages.value = [...messages.value, ...fresh]
          chatRetry = 0
          nextTick(() => scrollBottom())
        },
        onEnd: () => {
          if (!ctrl.signal.aborted) scheduleChatReconnect()
        },
      },
    )
  } catch {
    if (!ctrl.signal.aborted) scheduleChatReconnect()
  }
}

function scrollBottom() {
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  try {
    await api.group.send(getToken(), classId.value, 'text', text)
    draft.value = ''
    await loadMessages()
  } catch (e) {
    toastError(e, '发送失败')
  }
  sending.value = false
}

async function loadHomework() {
  try {
    const d = await api.cls.homeworkList(getToken(), classId.value)
    hwList.value = d.items
    isTeacher.value = isTeacher.value || d.is_teacher
  } catch {
    toast.error('作业列表加载失败')
  }
  try {
    noteList.value = await api.cls.noteList(getToken(), classId.value)
  } catch {
    noteList.value = []
  }
  loadTests()
}

/* ---------------- 笔记 / 知识点 ---------------- */
const noteList = ref([])
const noteAssignOpen = ref(false)
const noteBusy = ref(false)
const noteForm = reactive({ title: '', content: '', images: [] })
const noteView = ref(null)
const noteViewOpen = ref(false)
const noteViewImages = ref([])

function openNote() {
  noteForm.title = ''
  noteForm.content = ''
  noteForm.images = []
  noteAssignOpen.value = true
}

async function onPickNoteImages(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length) return
  const room = 9 - noteForm.images.length
  if (room <= 0) {
    toast.error('笔记图片最多 9 张')
    return
  }
  if (files.length > room) toast.error(`最多再选 ${room} 张，已自动截取`)
  for (const f of files.slice(0, room)) {
    const r = await readImageDataUrl(f, { onError: (m) => toast.error(m) })
    if (!r) continue
    noteForm.images.push(await shrinkIfNeeded(r.dataUrl))
  }
}

async function submitNote() {
  if (noteBusy.value) return
  noteBusy.value = true
  try {
    await api.cls.noteCreate(getToken(), classId.value, noteForm.title, noteForm.content, [...noteForm.images])
    noteAssignOpen.value = false
    toast.success('笔记已发布，班级群已通知')
    noteList.value = await api.cls.noteList(getToken(), classId.value)
  } catch (e) {
    toastError(e, '发布失败')
  }
  noteBusy.value = false
}

async function openNoteView(nt) {
  noteView.value = nt
  noteViewImages.value = []
  noteViewOpen.value = true
  if (nt.images_count) {
    try {
      noteViewImages.value = await api.cls.noteImages(getToken(), nt.id)
    } catch {
      noteViewImages.value = []
    }
  }
}

function saveNoteToBook() {
  const nt = noteView.value
  if (!nt) return
  bookUpsert(makeNoteItem({ title: nt.title, content: nt.content, source: '班级笔记' }))
  toast.success('已存入错题学习 · 笔记分组')
}

function plainSummary(text, n = 40) {
  const t = latexToPlain(String(text || '')).replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

async function removeNote() {
  const nt = noteView.value
  if (!nt) return
  try {
    await api.cls.noteDelete(getToken(), nt.id)
    noteViewOpen.value = false
    toast.success('已删除')
    noteList.value = await api.cls.noteList(getToken(), classId.value)
  } catch (e) {
    toastError(e, '删除失败')
  }
}

/* ---------------- 班级测试 ---------------- */
const testList = ref([])
const testOpen = ref(false)
const testBusy = ref(false)
const testForm = reactive({
  title: '', durationMin: 30, source: 'manual',
  subject: '', topic: '', choiceCount: 5, choiceScore: 10, blankCount: 5, blankScore: 10,
  items: [],
})
const testTotalScore = computed(() => testForm.items.reduce((s, q) => s + (Number(q.score) || 0), 0))
const rankOpen = ref(false)
const rankTest = ref(null)
const rankData = ref({})

function openTestCreate() {
  testForm.title = ''
  testForm.durationMin = 30
  testForm.source = 'manual'
  testForm.subject = ''
  testForm.topic = ''
  testForm.items = []
  testOpen.value = true
}

function addTestQuestion(type = 'choice') {
  if (type === 'blank') {
    testForm.items.push({ type: 'blank', question: '', answer: '', score: testForm.blankScore || 5 })
  } else {
    testForm.items.push({ type: 'choice', question: '', options: ['A. ', 'B. ', 'C. ', 'D. '], answer: 'A', score: testForm.choiceScore || 5 })
  }
  testForm.source = 'manual'
}

async function loadTests() {
  try {
    const d = await api.cls.testList(getToken(), classId.value)
    testList.value = d.tests
    isTeacher.value = isTeacher.value || d.is_teacher
  } catch {
    toast.error('测试列表加载失败')
  }
}

function openTest(t) {
  if (isTeacher.value || t.my_score !== null && t.my_score !== undefined) {
    showRank(t)
    return
  }
  router.push(path(ROUTES.classTestRun, { id: classId.value, tid: t.id }))
}

async function showRank(t) {
  rankTest.value = t
  rankData.value = {}
  rankOpen.value = true
  try {
    rankData.value = await api.cls.testRank(getToken(), t.id)
  } catch (e) {
    toastError(e, '排名加载失败')
  }
}

async function generateTest() {
  if (testBusy.value) return
  testBusy.value = true
  try {
    const items = await api.cls.testGenerate(getToken(), classId.value, {
      subject: testForm.subject,
      topic: testForm.topic,
      choice_count: testForm.choiceCount,
      choice_score: testForm.choiceScore,
      blank_count: testForm.blankCount,
      blank_score: testForm.blankScore,
    })
    testForm.items = items
    toast.success(`已生成 ${items.length} 题，请在下方检查修改`)
  } catch (e) {
    toastError(e, 'AI 生成失败')
  }
  testBusy.value = false
}

async function submitTest() {
  if (testBusy.value) return
  testBusy.value = true
  try {
    await api.cls.testCreate(getToken(), classId.value, testForm.title, Math.round(testForm.durationMin * 60), testForm.items)
    testOpen.value = false
    toast.success('测试已发布，班级群已通知')
    loadTests()
  } catch (e) {
    toastError(e, '发布失败')
  }
  testBusy.value = false
}

function openAssign() {
  hwForm.title = ''
  hwForm.content = ''
  hwForm.reference = ''
  hwForm.due = ''
  hwForm.images = []
  assignOpen.value = true
}

async function submitAssign() {
  if (assignBusy.value) return
  assignBusy.value = true
  try {
    const due = hwForm.due ? new Date(hwForm.due).getTime() : 0
    await api.cls.createHomework(getToken(), classId.value, hwForm.title, hwForm.content, hwForm.reference, due, [...hwForm.images])
    assignOpen.value = false
    toast.success('作业已发布，班级群已通知')
    loadHomework()
  } catch (e) {
    toastError(e, '发布失败')
  }
  assignBusy.value = false
}

async function submitInvite() {
  if (inviteBusy.value) return
  inviteBusy.value = true
  try {
    const r = await api.group.invite(getToken(), classId.value, inviteNick.value.trim())
    if (r.ok) {
      toast.success(`已拉「${r.nickname}」进班`)
      inviteOpen.value = false
      loadClass()
    } else {
      toast.error(r.error || '邀请失败')
    }
  } catch (e) {
    toastError(e, '邀请失败')
  }
  inviteBusy.value = false
}

function openHomework(hw) {
  router.push(path(ROUTES.homeworkDetail, { id: classId.value, hid: hw.id }))
}

function fmtDate(ts) {
  const d = new Date(Number(ts))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(tab, (v) => {
  if (v === 'chat') startChatStream()
  else stopChatStream()
  if (v === 'chat') nextTick(scrollBottom)
})
</script>

<style scoped>
.clsd {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.clsd__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.clsd__title-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.clsd__badge {
  font-size: var(--fs-label);
  color: var(--primary-text);
  background: var(--primary-soft);
  border-radius: var(--radius-pill);
  padding: 2px 10px;
}
.clsd__code {
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--primary-text);
}
.clsd__chat {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.clsd__msgs {
  height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-1);
}
.clsd__msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 78%;
}
.clsd__msg--mine {
  align-self: flex-end;
  align-items: flex-end;
}
.clsd__msg-user {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.clsd__msg-bubble {
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  word-break: break-word;
  white-space: pre-wrap;
}
.clsd__sys {
  align-self: center;
  max-width: 92%;
  font-size: var(--fs-label);
  color: var(--text-muted);
  background: var(--surface-unit);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  text-align: center;
  word-break: break-all;
}
.clsd__chat-empty {
  text-align: center;
  padding: var(--sp-4);
}
.clsd__chat-input {
  display: flex;
  gap: var(--sp-2);
}
.clsd__chat-text {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 8px 14px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  background: var(--surface-unit);
}
.clsd__hw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.clsd__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.clsd__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.clsd__item:hover {
  border-color: var(--primary-line);
}
.clsd__item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.clsd__item-title {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
.clsd__hw-imgtag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary-text);
  font-size: var(--fs-label);
}

/* 布置作业：图片九宫格 */
.clsd__imgs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
  margin: var(--sp-2) 0 var(--sp-3);
}
.clsd__img {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: var(--border-subtle);
}
.clsd__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.clsd__img-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: rgba(20, 26, 38, 0.62);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.clsd__img-add {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px dashed var(--border-strong, #c9cfdb);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  font-size: var(--fs-label);
  cursor: pointer;
}
.clsd__file {
  display: none;
}
.clsd__arrow {
  color: var(--text-disabled);
}
.clsd__member-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--sp-2);
}
.clsd__member {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 10px var(--sp-3);
}
.clsd__member-name {
  font-size: var(--fs-body);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clsd__label {
  display: block;
  font-size: var(--fs-label);
  color: var(--text-muted);
  margin: var(--sp-2) 0 4px;
}
.clsd__input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  background: var(--surface-unit);
}
.clsd__textarea {
  resize: vertical;
  line-height: var(--lh-body);
}
.clsd__note-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}
.clsd__note-imgs {
  display: grid;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.clsd__note-img {
  width: 100%;
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  display: block;
}
.clsd__note-ops {
  margin-top: var(--sp-4);
  display: grid;
  gap: var(--sp-2);
}
.clsd__grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2) var(--sp-3);
}
.clsd__gen-tip {
  margin: var(--sp-2) 0;
  color: var(--text-tertiary);
}
.clsd__qcard {
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3);
  margin-bottom: var(--sp-3);
  display: grid;
  gap: var(--sp-2);
}
.clsd__qcard-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.clsd__qcard-no {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.clsd__rank-head {
  margin-bottom: var(--sp-3);
}
.clsd__rank-list {
  display: grid;
  gap: var(--sp-2);
}
.clsd__rank-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
}
.clsd__rank-row.is-me {
  background: var(--primary-soft-2, rgba(124, 92, 255, 0.1));
}
.clsd__rank-no {
  width: 26px;
  font-weight: var(--fw-semibold);
  color: var(--text-secondary);
}
.clsd__rank-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}
.clsd__rank-score {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.clsd__rank-score i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .clsd {
    max-width: none;
  }
}
</style>

