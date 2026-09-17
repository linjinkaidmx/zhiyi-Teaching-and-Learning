<template>
  <el-dialog v-model="visible" title="分享这道题" width="440px">
    <el-alert v-if="!logged" type="info" :closable="false" show-icon class="gap-bottom"
      title="分享功能需要登录后使用" />
    <template v-else>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="分享到哪里">
          <el-radio-group v-model="target">
            <el-radio value="forum">论坛（公开，所有人可见）</el-radio>
            <el-radio value="group">小组（仅组内成员可见）</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="target === 'forum'">
          <el-form-item label="帖子标题">
            <el-input v-model="title" maxlength="80" show-word-limit />
          </el-form-item>
          <el-form-item label="想说的话（可选）">
            <el-input v-model="content" type="textarea" :rows="3" maxlength="5000"
              placeholder="分享一下你当时是怎么错的、怎么想通的" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="选择小组">
            <el-select v-model="groupId" placeholder="选择一个我所在的小组" style="width: 100%"
              :loading="groupsLoading">
              <el-option v-for="g in groups" :key="g.id" :value="g.id"
                :label="`${g.name}（${g.memberCount} 人）`" />
            </el-select>
          </el-form-item>
          <el-form-item label="给组员的话（可选）">
            <el-input v-model="note" type="textarea" :rows="3" maxlength="200"
              placeholder="如：这题我判满条件总是记错，大家注意" />
          </el-form-item>
        </template>
      </el-form>

      <div class="stem-preview">
        <div class="preview-label">将分享的题目</div>
        <MathText :text="record.question || '（该记录没有题干）'" />
      </div>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!logged || !canSubmit" :loading="loading"
        @click="submit">
        分享
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MathText from './MathText.vue'
import { forumApi, groupApi } from '../api/auth'
import { isLoggedIn } from '../store/user'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 练习本里的记录对象 */
  record: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:visible'])

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const logged = computed(() => isLoggedIn())

const target = ref('forum')
const title = ref('')
const content = ref('')
const groupId = ref(null)
const note = ref('')
const groups = ref([])
const groupsLoading = ref(false)
const loading = ref(false)

watch(visible, (v) => {
  if (!v) return
  if (!logged.value) return
  target.value = 'forum'
  title.value = truncate(props.record.question || '', 40)
  content.value = ''
  note.value = ''
  groupId.value = null
  loadGroups()
})

watch(target, (t) => {
  if (t === 'group' && !groups.value.length) loadGroups()
})

async function loadGroups() {
  groupsLoading.value = true
  try {
    const res = await groupApi.list()
    groups.value = res.groups || []
  } catch {
    groups.value = []
  } finally {
    groupsLoading.value = false
  }
}

const canSubmit = computed(() => {
  if (!props.record.question) return false
  if (target.value === 'forum') return !!title.value.trim()
  return !!groupId.value
})

async function submit() {
  loading.value = true
  try {
    if (target.value === 'forum') {
      await forumApi.create({
        type: 'question',
        title: title.value.trim(),
        content: content.value,
        subject: props.record.subject || '',
        question: props.record.question || '',
        answer: props.record.correct_answer || '',
        hint: props.record.hint || '',
        knowledgePoints: props.record.knowledge_points || [],
        errorType: props.record.error_type || '',
      })
      ElMessage.success('已分享到论坛')
    } else {
      await groupApi.share(groupId.value, {
        rid: String(props.record.id || ''),
        subject: props.record.subject || '',
        question: props.record.question || '',
        hint: props.record.hint || '',
        answer: props.record.correct_answer || '',
        knowledgePoints: props.record.knowledge_points || [],
        errorType: props.record.error_type || '',
        note: note.value,
      })
      ElMessage.success('已分享到小组')
    }
    visible.value = false
  } catch (e) {
    ElMessage.error(e.message || '分享失败')
  } finally {
    loading.value = false
  }
}

function truncate(s, n) {
  s = s || ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<style scoped>
.gap-bottom {
  margin-bottom: 14px;
}
.stem-preview {
  margin-top: 6px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  line-height: 1.7;
}
.preview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
</style>
