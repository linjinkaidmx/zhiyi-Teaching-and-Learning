<template>
  <div class="group-view">
    <!-- 未登录 -->
    <el-empty v-if="!logged" description="登录后可以创建小组、和同学共享错题">
      <el-button type="primary" @click="$emit('need-login')">去登录 / 注册</el-button>
    </el-empty>

    <template v-else>
      <!-- ============ 小组列表 ============ -->
      <template v-if="!current">
        <div class="toolbar">
          <el-button type="primary" @click="createVisible = true">创建小组</el-button>
          <div class="join-row">
            <el-input v-model="joinCode" class="code-input" maxlength="6" placeholder="输入 6 位小组码"
              @keydown.enter.prevent="join" />
            <el-button :disabled="joinCode.trim().length !== 6" :loading="joining" @click="join">
              加入
            </el-button>
          </div>
        </div>

        <div v-if="loading" class="center-hint"><el-skeleton :rows="4" animated /></div>
        <el-empty v-else-if="!groups.length" description="还没有加入任何小组，创建一个或凭小组码加入吧" />
        <div v-else class="group-list">
          <div v-for="g in groups" :key="g.id" class="group-card" @click="openGroup(g)">
            <div class="group-info">
              <div class="group-name">
                {{ g.name }}
                <el-tag size="small" :type="g.role === 'owner' ? 'warning' : 'info'" effect="plain">
                  {{ g.role === 'owner' ? '组长' : '成员' }}
                </el-tag>
              </div>
              <div class="group-meta">{{ g.subject || '综合' }} · {{ g.memberCount }} 人</div>
              <div v-if="g.intro" class="group-intro">{{ g.intro }}</div>
            </div>
            <div class="group-code">
              <span class="code-label">小组码</span>
              <span class="code-value">{{ g.code }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 小组详情 ============ -->
      <template v-else>
        <div class="detail-head">
          <el-button text @click="current = null">← 返回</el-button>
          <div class="detail-title">
            <span class="detail-name">{{ current.name }}</span>
            <el-tag size="small" effect="plain" class="code-tag">小组码 {{ current.code }}</el-tag>
            <el-tag size="small" :type="current.role === 'owner' ? 'warning' : 'info'" effect="plain">
              {{ current.role === 'owner' ? '组长' : '成员' }}
            </el-tag>
          </div>
          <el-button v-if="current.isOwner" text type="danger" size="small" @click="dissolve">
            解散小组
          </el-button>
          <el-button v-else text type="danger" size="small" @click="quit">退出小组</el-button>
        </div>

        <el-tabs v-model="tab">
          <!-- 共享错题 -->
          <el-tab-pane label="共享错题" name="shares">
            <div class="shares-toolbar">
              <el-button type="primary" plain size="small" @click="openShareDialog">
                分享我的错题进组
              </el-button>
            </div>
            <el-empty v-if="!shares.length" description="还没有人分享错题" :image-size="80" />
            <div v-else class="share-list">
              <div v-for="s in shares" :key="s.id" class="share-card">
                <div class="share-head">
                  <el-tag v-if="s.subject" size="small" effect="plain">{{ s.subject }}</el-tag>
                  <span class="meta-text">{{ s.author }} 分享 · {{ s.createdAt }}</span>
                  <div class="share-actions">
                    <el-button text type="primary" size="small" @click="saveToBook(s)">
                      保存到我的练习本
                    </el-button>
                    <el-button v-if="s.userId === myUserId || current.isOwner" text type="danger"
                      size="small" @click="removeShare(s)">撤回</el-button>
                  </div>
                </div>
                <div class="stem"><MathText :text="s.question" /></div>
                <div class="kp-row">
                  <el-tag v-for="k in s.knowledgePoints.slice(0, 5)" :key="k" size="small"
                    effect="plain">{{ k }}</el-tag>
                  <el-tag v-if="s.errorType" size="small" type="danger" effect="plain">
                    {{ s.errorType }}
                  </el-tag>
                </div>
                <div v-if="s.note" class="share-note">📝 {{ s.note }}</div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 学习榜 -->
          <el-tab-pane label="成员与学习榜" name="members">
            <el-empty v-if="!members.length" description="暂无数据" :image-size="80" />
            <el-table v-else :data="rankedMembers" size="large">
              <el-table-column label="#" width="52">
                <template #default="{ $index }">
                  <span :class="['rank', 'rank-' + ($index + 1)]">{{ $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="nickname" label="成员" min-width="110">
                <template #default="{ row }">
                  {{ row.nickname }}
                  <el-tag v-if="row.role === 'owner'" size="small" type="warning" effect="plain">
                    组长
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="recordTotal" label="练习数" width="90" sortable />
              <el-table-column prop="mastered" label="已掌握" width="90" sortable />
              <el-table-column label="自测正确率" width="120" sortable
                :sort-method="(a, b) => (a.accuracy || 0) - (b.accuracy || 0)">
                <template #default="{ row }">
                  {{ row.accuracy === null ? '未测' : row.accuracy + '%' }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </template>

    <!-- 建组弹窗 -->
    <el-dialog v-model="createVisible" title="创建学习小组" width="420px">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="小组名">
          <el-input v-model="createForm.name" maxlength="30" placeholder="如：数据结构冲鸭" />
        </el-form-item>
        <el-form-item label="主攻学科">
          <el-select v-model="createForm.subject" placeholder="可选" clearable style="width: 100%">
            <el-option v-for="s in SUBJECTS" :key="s" :value="s" :label="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="createForm.intro" type="textarea" :rows="2" maxlength="200"
            placeholder="小组目标、学习节奏等（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="create">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分享错题进组弹窗 -->
    <el-dialog v-model="shareDialogVisible" title="分享错题进组" width="480px">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="选择练习本里的题">
          <el-select v-model="shareForm.rid" filterable placeholder="选择一道题" style="width: 100%">
            <el-option v-for="it in shareableBook" :key="it.id" :value="String(it.id)"
              :label="truncate(it.question || String(it.id), 40)" />
          </el-select>
        </el-form-item>
        <el-form-item label="给组员的话（可选）">
          <el-input v-model="shareForm.note" type="textarea" :rows="2" maxlength="200"
            placeholder="如：这题我判满条件总是记错，大家注意" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shareDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!shareForm.rid" :loading="sharing" @click="doShare">
          分享
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MathText from './MathText.vue'
import { groupApi } from '../api/auth'
import { isLoggedIn, user } from '../store/user'
import { addRecord, getBook } from '../utils/storage'

const SUBJECTS = ['高等数学', '线性代数', '概率论与数理统计', '数据结构', '算法', '操作系统', '计算机网络']

const emit = defineEmits(['need-login'])

const logged = computed(() => isLoggedIn())
const myUserId = computed(() => user.userId || null)

const groups = ref([])
const loading = ref(false)
const current = ref(null)
const tab = ref('shares')
const members = ref([])
const shares = ref([])

const createVisible = ref(false)
const creating = ref(false)
const createForm = ref({ name: '', subject: '', intro: '' })

const joinCode = ref('')
const joining = ref(false)

const shareDialogVisible = ref(false)
const sharing = ref(false)
const shareForm = ref({ rid: '', note: '' })

onMounted(loadGroups)

async function loadGroups() {
  if (!logged.value) return
  loading.value = true
  try {
    const res = await groupApi.list()
    groups.value = res.groups || []
  } catch (e) {
    console.warn('[group] load failed:', e.message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!createForm.value.name.trim()) return void ElMessage.warning('请填写小组名')
  creating.value = true
  try {
    const res = await groupApi.create(createForm.value)
    ElMessage.success(`创建成功！小组码 ${res.group.code}，分享给同学吧`)
    createVisible.value = false
    createForm.value = { name: '', subject: '', intro: '' }
    await loadGroups()
    openGroup(res.group)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    creating.value = false
  }
}

async function join() {
  joining.value = true
  try {
    const res = await groupApi.join(joinCode.value.trim().toUpperCase())
    ElMessage.success(`已加入「${res.group.name}」`)
    joinCode.value = ''
    await loadGroups()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    joining.value = false
  }
}

async function openGroup(g) {
  current.value = g
  tab.value = 'shares'
  await Promise.all([loadMembers(), loadShares()])
}

async function loadMembers() {
  try {
    const res = await groupApi.members(current.value.id)
    members.value = res.members || []
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function loadShares() {
  try {
    const res = await groupApi.shares(current.value.id)
    shares.value = res.shares || []
  } catch (e) {
    ElMessage.error(e.message)
  }
}

const rankedMembers = computed(() =>
  [...members.value].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0)
    || b.recordTotal - a.recordTotal))

function getBookSafe() {
  try {
    return getBook()
  } catch (e) {
    console.warn('[GroupView] getBook failed:', e)
    return []
  }
}

/**
 * 可以分享的题：排除本组已经分享过的。
 * 用 ref 而非 computed —— getBook() 读的是 localStorage，不是响应式依赖，
 * 用 computed 会因为依赖收集不到而永远缓存旧值；改为每次打开弹窗时刷新，
 * 保证「进入小组后才新加的题」也能立刻出现在下拉里。
 */
const shareableBook = ref([])

function refreshShareable() {
  const shared = new Set(shares.value.map((s) => s.rid))
  shareableBook.value = getBookSafe().filter(
    (x) => (x.question || '').trim() && !shared.has(String(x.id)))
}

function openShareDialog() {
  shareForm.value = { rid: '', note: '' }
  refreshShareable()
  shareDialogVisible.value = true
}

async function doShare() {
  const it = getBookSafe().find((x) => String(x.id) === shareForm.value.rid)
  if (!it) return
  sharing.value = true
  try {
    await groupApi.share(current.value.id, {
      rid: String(it.id),
      subject: it.subject || '',
      question: it.question || '',
      hint: it.hint || '',
      answer: it.correct_answer || '',
      knowledgePoints: it.knowledge_points || [],
      errorType: it.error_type || '',
      note: shareForm.value.note,
    })
    ElMessage.success('已分享到小组')
    shareDialogVisible.value = false
    shareForm.value = { rid: '', note: '' }
    await loadShares()
    refreshShareable()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    sharing.value = false
  }
}

/** 组员的错题保存进自己的练习本（source=share） */
function saveToBook(s) {
  addRecord(
    {
      id: `share-${s.id}`,
      subject: s.subject,
      question: s.question,
      correct_answer: s.answer,
      hint: s.hint,
      knowledge_points: s.knowledgePoints,
      error_type: s.errorType,
      source: 'share',
    },
    { source: 'share' },
  )
  ElMessage.success('已保存到练习本，可在「自测」里检验自己')
}

async function removeShare(s) {
  try {
    await ElMessageBox.confirm('确定撤回这条共享吗？', '撤回共享', { type: 'warning' })
  } catch {
    return
  }
  try {
    await groupApi.removeShare(s.id)
    ElMessage.success('已撤回')
    await loadShares()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function quit() {
  try {
    await ElMessageBox.confirm('确定退出该小组吗？', '退出小组', { type: 'warning' })
  } catch {
    return
  }
  try {
    await groupApi.quit(current.value.id)
    ElMessage.success('已退出')
    current.value = null
    await loadGroups()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function dissolve() {
  try {
    await ElMessageBox.confirm('解散后组内所有共享错题将被删除，确定吗？', '解散小组', {
      type: 'warning', confirmButtonText: '解散', cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await groupApi.dissolve(current.value.id)
    ElMessage.success('小组已解散')
    current.value = null
    await loadGroups()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function truncate(s, n) {
  s = s || ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<style scoped>
.group-view {
  max-width: 760px;
  margin: 0 auto;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.join-row {
  display: flex;
  gap: 8px;
}
.code-input {
  width: 180px;
}
.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.group-card:hover {
  border-color: var(--el-color-primary-light-5);
}
.group-name {
  font-weight: 500;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}
.group-intro {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin-top: 6px;
}
.group-code {
  text-align: right;
}
.code-label {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.code-value {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--el-color-primary);
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.detail-name {
  font-size: 16px;
  font-weight: 500;
}
.shares-toolbar {
  margin-bottom: 12px;
}
.share-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.share-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 16px;
}
.share-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.share-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.share-actions .el-button {
  padding: 0 4px;
}
.stem {
  line-height: 1.7;
}
.kp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.share-note {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 6px 10px;
}
.rank {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  background: var(--el-fill-color);
}
.rank-1 {
  background: #f5c4b3;
  color: #712b13;
  font-weight: 600;
}
.rank-2 {
  background: #d3d1c7;
  color: #444441;
  font-weight: 600;
}
.rank-3 {
  background: #fac775;
  color: #633806;
  font-weight: 600;
}
.meta-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.center-hint {
  text-align: center;
  padding: 48px 0;
}
</style>
