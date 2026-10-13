<template>
  <UiModal v-model="open" title="分享这道题" size="md">
    <div class="share__card">
      <div class="share__q"><MathText :content="card.question || ''" /></div>
      <div v-if="card.subject" class="share__meta">
        <UiTag variant="info">{{ card.subject }}</UiTag>
        <UiTag v-for="k in (card.knowledgePoints || []).slice(0, 3)" :key="k" variant="neutral">{{ k }}</UiTag>
      </div>
    </div>

    <p class="share__privacy">
      将公开：题干、答案、解析与知识点。错题本学情、AI 对话等学习数据不会公开。
    </p>

    <UiSegmented v-model="target" :options="TARGETS" aria-label="分享目标" />

    <!-- 分享到论坛 -->
    <template v-if="target === 'forum'">
      <label class="share__label" for="share-title">帖子标题（可选）</label>
      <input
        id="share-title"
        v-model="forumTitle"
        class="share__input"
        type="text"
        :placeholder="card.question ? latexToPlain(String(card.question)).replace(/\s+/g, ' ').trim().slice(0, 40) : '给帖子起个标题'"
      />
      <p class="share__hint">将发布到论坛，所有人可见。</p>
    </template>

    <!-- 分享到学习小组 -->
    <template v-else>
      <div v-if="myGroups.length" class="share__groups">
        <button
          v-for="g in myGroups"
          :key="g.id"
          type="button"
          class="share__group"
          :class="{ 'is-on': selectedGroupId === g.id }"
          @click="selectedGroupId = g.id"
        >
          <span class="share__group-name">{{ g.name }}</span>
          <span class="share__group-count">{{ g.member_count }} 人</span>
        </button>
      </div>
      <p v-else class="share__empty">你还没有加入任何学习小组，先去社区创建一个吧。</p>
    </template>

    <template #footer>
      <UiButton
        variant="primary"
        block
        :loading="sharing"
        :disabled="target === 'group' && !selectedGroupId"
        @click="submit"
      >
        {{ target === 'forum' ? '发布到论坛' : '发送到小组' }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UiModal from '../ui/UiModal.vue'
import UiButton from '../ui/UiButton.vue'
import UiTag from '../ui/UiTag.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import MathText from '../components/MathText.vue'
import { latexToPlain } from '../mathtext'
import { api } from '../api'
import { session } from '../stores/sessionStore'
import { openAuth } from '../stores/uiStore'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { ROUTES } from '../lib/routes.js'

const TARGETS = [
  { label: '论坛', value: 'forum' },
  { label: '学习小组', value: 'group' },
]

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  card: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const target = ref('forum')
const forumTitle = ref('')
const myGroups = ref([])
const selectedGroupId = ref('')
const sharing = ref(false)

function loadGroups() {
  if (session.space !== 'account' || !session.token) {
    myGroups.value = []
    return
  }
  api.group.my(session.token).then((groups) => {
    myGroups.value = groups || []
    if (myGroups.value.length && !selectedGroupId.value) {
      selectedGroupId.value = myGroups.value[0].id
    }
  }).catch(() => {})
}

watch(() => props.modelValue, (v) => {
  if (v) {
    target.value = 'forum'
    forumTitle.value = ''
    loadGroups()
  }
})

function submit() {
  if (session.space !== 'account' || !session.token) {
    openAuth('login')
    toast.info('登录后才能分享')
    return
  }
  sharing.value = true
  const done = () => {
    sharing.value = false
    open.value = false
    toast.success('分享成功')
    router.push({ path: ROUTES.community, query: { tab: target.value } })
  }
  const fail = (e) => {
    sharing.value = false
    toastError(e, '分享失败')
  }
  if (target.value === 'forum') {
    api.forum
      .post(session.token, 'question', forumTitle.value.trim(), '', { ...props.card })
      .then(done)
      .catch(fail)
  } else {
    const cardJson = JSON.stringify({ ...props.card })
    api.group
      .send(session.token, selectedGroupId.value, 'question', cardJson)
      .then(done)
      .catch(fail)
  }
}
</script>

<style scoped>
.share__card {
  padding: var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.share__q {
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-primary);
  margin-bottom: var(--sp-2);
}
.share__meta {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.share__privacy {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin: var(--sp-3) 0;
}
.share__label {
  display: block;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  margin: var(--sp-3) 0 var(--sp-2);
}
.share__input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
}
.share__input:focus {
  outline: none;
  border-color: var(--primary-line);
}
.share__hint {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  margin-top: var(--sp-2);
}
.share__groups {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.share__group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  cursor: pointer;
  text-align: left;
}
.share__group.is-on {
  border-color: var(--primary-line);
  background: var(--primary-soft-2);
}
.share__group-name {
  font-size: var(--fs-body);
  color: var(--text-primary);
}
.share__group-count {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.share__empty {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin-top: var(--sp-3);
}
</style>
