<!-- [LEGACY-P8] 本组件已无任何引用（功能已迁到 pages/* 与 ui/*），
     保留文件仅为回看对照，可随时删除。它仍引用 Element Plus，但不在构建图里。 -->
<template>
  <div class="card">
    <!-- ① 身份区 -->
    <div class="pf-head">
      <div class="pf-avatar-wrap">
        <div class="pf-avatar" :style="{ background: avatarBg }" title="点击上传头像" @click="pickAvatar">
          <img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
          <span v-else class="pf-avatar-letter">{{ letter }}</span>
        </div>
        <div class="pf-avatar-ops">
          <el-button size="small" @click="pickAvatar">上传头像</el-button>
          <el-button v-if="profile.avatar" size="small" text @click="updateProfile({ avatar: '' })">移除</el-button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="pf-file" @change="onFile" />
      </div>

      <div class="pf-id">
        <div class="pf-name-row">
          <span class="pf-name">{{ displayName }}</span>
          <el-button v-if="loggedIn" size="small" text type="primary" @click="openRename">改昵称</el-button>
          <span v-else class="pf-tag">未登录 · 资料只存本机</span>
        </div>
        <div class="pf-meta">
          知一 ID {{ userId || '—' }}<template v-if="joinedText"> · {{ joinedText }}</template>
        </div>
        <div class="pf-bio">
          <el-input
            v-model="bioDraft"
            maxlength="60"
            show-word-limit
            placeholder="写一句正在做的事，比如：期末周把高数错题清一遍"
            @change="saveBio"
          />
        </div>
        <div class="pf-colors">
          <span class="muted">头像底色</span>
          <button
            v-for="c in AVATAR_COLORS"
            :key="c"
            class="pf-color"
            :class="{ on: profile.avatarColor === c }"
            :style="{ background: c }"
            @click="updateProfile({ avatarColor: c })"
          ></button>
        </div>
      </div>
    </div>

    <!-- ② 学习资料 -->
    <div class="pf-block">
      <div class="pf-title">学习资料</div>
      <div class="pf-form">
        <div class="pf-field">
          <label>学校</label>
          <el-input v-model="form.school" maxlength="30" placeholder="如：××大学" />
        </div>
        <div class="pf-field">
          <label>专业</label>
          <el-input v-model="form.major" maxlength="30" placeholder="如：计算机科学与技术" />
        </div>
        <div class="pf-field">
          <label>年级</label>
          <el-select v-model="form.grade" clearable placeholder="选择年级">
            <el-option v-for="g in GRADES" :key="g" :label="g" :value="g" />
          </el-select>
        </div>
      </div>
      <el-button type="primary" size="small" @click="saveProfileData">保存资料</el-button>
      <span class="muted" style="margin-left: 10px">{{ loggedIn ? '资料会随账号同步' : '登录后可同步到云端' }}</span>
    </div>

    <!-- ③ 学习档案 -->
    <div class="pf-block">
      <div class="pf-title-row">
        <span class="pf-title">学习档案 <span class="muted">只读 · 来自打卡与错题本</span></span>
        <el-button size="small" text type="primary" @click="emit('go-report')">查看完整学情 →</el-button>
      </div>
      <div class="pf-metrics">
        <div v-for="m in metrics" :key="m.label" class="pf-metric">
          <div class="pf-metric-v">{{ m.value }}</div>
          <div class="pf-metric-k">{{ m.label }}</div>
        </div>
      </div>
    </div>

    <!-- ④ 偏好设置 -->
    <div class="pf-block">
      <div class="pf-title">偏好设置</div>
      <div class="pf-row">
        <div class="pf-row-l">
          <div class="pf-row-t">追问默认档位</div>
          <div class="muted">打开追问面板时的默认选择</div>
        </div>
        <el-radio-group :model-value="prefs.defaultMode" size="small" @change="(v) => updatePref('defaultMode', v)">
          <el-radio-button value="fast">快答</el-radio-button>
          <el-radio-button value="deep">深思</el-radio-button>
        </el-radio-group>
      </div>
      <div class="pf-row">
        <div class="pf-row-l">
          <div class="pf-row-t">公式渲染</div>
          <div class="muted">关闭后公式转为可复制的纯文本（不跑 KaTeX，翻页更快）</div>
        </div>
        <el-switch :model-value="prefs.renderMath" @change="(v) => updatePref('renderMath', v)" />
      </div>
      <div class="pf-row">
        <div class="pf-row-l">
          <div class="pf-row-t">正文字号</div>
          <div class="muted">影响讲解与速查正文</div>
        </div>
        <el-radio-group :model-value="prefs.fontScale" size="small" @change="(v) => updatePref('fontScale', v)">
          <el-radio-button v-for="f in FONT_SCALES" :key="f.key" :value="f.key">{{ f.label }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="pf-row">
        <div class="pf-row-l">
          <div class="pf-row-t">每日目标</div>
          <div class="muted">达成后当天打卡格会标记；关闭则只记录不断链</div>
        </div>
        <div class="pf-goal-set">
          <el-switch :model-value="sum.goalEnabled" @change="(v) => updateGoal({ goalEnabled: v })" />
          <el-input-number
            v-if="sum.goalEnabled"
            :model-value="sum.goalTarget"
            size="small"
            :min="1"
            :max="100"
            controls-position="right"
            style="width: 96px"
            @change="(v) => updateGoal({ goalQuestions: v || 5 })"
          />
          <span class="muted">题/天</span>
        </div>
      </div>
    </div>

    <!-- ⑤ 账号与安全 -->
    <div class="pf-block">
      <div class="pf-title">账号与安全</div>
      <div v-if="loggedIn">
        <div class="pf-row pf-row-click" @click="pwdVisible = true">
          <span>修改密码</span><span class="muted">定期换一次更安心</span>
        </div>
        <div class="pf-row pf-row-click" @click="backupVisible = true">
          <span>重置备份码</span><span class="muted">忘记密码时的唯一凭证</span>
        </div>
        <div class="pf-row pf-row-click" @click="emit('logout')">
          <span>退出登录</span><span class="muted">{{ displayName }}</span>
        </div>
        <div class="pf-row pf-row-click" @click="emit('switch-account')">
          <span>切换账号</span><span class="muted">用其他昵称登录</span>
        </div>
        <div class="pf-row pf-row-click" @click="delVisible = true">
          <span class="pf-danger">注销账号</span><span class="muted">清空云端数据，不可恢复</span>
        </div>
      </div>
      <div v-else class="pf-empty">
        当前是本地模式：错题、打卡、资料都只存在这台设备上。
        <el-button size="small" type="primary" plain style="margin-left: 10px" @click="emit('switch-account')">登录 / 注册</el-button>
      </div>
    </div>

    <!-- ⑥ 数据管理 -->
    <div class="pf-block">
      <div class="pf-title-row">
        <span class="pf-title">数据管理 <span class="muted">本机占用约 {{ usage }} KB</span></span>
        <el-button v-if="loggedIn" size="small" text type="primary" :loading="syncing" @click="emit('sync-now')">立即同步</el-button>
      </div>
      <div class="pf-row pf-row-click" @click="doExport">
        <span>导出全部数据</span><span class="muted">错题本 + 学习档案 + 资料（JSON）</span>
      </div>
      <div class="pf-row pf-row-click" @click="importVisible = true">
        <span>导入备份</span><span class="muted">可合并或覆盖当前数据</span>
      </div>
      <div class="pf-row pf-row-click" @click="pullOverwrite">
        <span>以云端覆盖本地</span><span class="muted">换设备后数据乱了时用它</span>
      </div>
      <div class="pf-row pf-row-click" @click="clearLocal">
        <span class="pf-danger">清空本地数据</span><span class="muted">云端保留，下次登录会拉回</span>
      </div>
    </div>

    <!-- ⑦ 意见反馈 -->
    <div class="pf-block">
      <div class="pf-title">意见反馈</div>
      <el-input v-model="feedback" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" maxlength="500"
        show-word-limit placeholder="遇到问题、想要的功能、觉得哪里别扭，都可以写在这里" />
      <el-button type="primary" size="small" style="margin-top: 10px" :loading="fbSending" @click="sendFeedback">提交反馈</el-button>
    </div>

    <!-- 改昵称 -->
    <el-dialog v-model="renameVisible" title="修改昵称" width="420px">
      <el-alert type="warning" :closable="false" show-icon
        title="昵称同时是登录名：修改后需用新昵称登录，云端错题与打卡记录会自动迁移。" style="margin-bottom: 14px" />
      <el-input v-model="renameForm.nickname" maxlength="20" placeholder="新昵称（2-20 位）" />
      <el-input v-model="renameForm.password" type="password" show-password placeholder="当前密码（安全校验）" style="margin-top: 10px" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="doRename">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码 -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
      <el-input v-model="pwdForm.old" type="password" show-password placeholder="当前密码" />
      <el-input v-model="pwdForm.next" type="password" show-password placeholder="新密码（6-64 位）" style="margin-top: 10px" />
      <el-input v-model="pwdForm.confirm" type="password" show-password placeholder="确认新密码" style="margin-top: 10px" />
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="doChangePassword">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置备份码 -->
    <el-dialog v-model="backupVisible" title="重置备份码" width="440px">
      <template v-if="!newBackup">
        <p class="muted" style="margin: 0 0 12px">
          备份码用于「忘记密码」时找回账号。重置后旧备份码立即失效，请把新码抄在安全的地方。
        </p>
        <el-input v-model="backupPassword" type="password" show-password placeholder="当前密码" />
      </template>
      <template v-else>
        <p style="margin: 0 0 8px">这是你的新备份码（只显示这一次）：</p>
        <div class="pf-backup">{{ newBackup }}</div>
      </template>
      <template #footer>
        <el-button @click="closeBackup">{{ newBackup ? '我已抄好' : '取消' }}</el-button>
        <el-button v-if="!newBackup" type="primary" :loading="backupLoading" @click="doResetBackup">生成新备份码</el-button>
        <el-button v-else type="primary" @click="copyBackup">复制</el-button>
      </template>
    </el-dialog>

    <!-- 注销账号 -->
    <el-dialog v-model="delVisible" title="注销账号" width="460px">
      <el-alert type="error" :closable="false" show-icon
        title="这会永久删除云端的错题本、打卡记录与个人资料，无法恢复。" style="margin-bottom: 14px" />
      <el-input v-model="delForm.password" type="password" show-password placeholder="当前密码" />
      <el-input v-model="delForm.confirm" placeholder="输入「注销」两个字确认" style="margin-top: 10px" />
      <template #footer>
        <el-button @click="delVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" :disabled="delForm.confirm !== '注销'" @click="doDelete">永久注销</el-button>
      </template>
    </el-dialog>

    <!-- 导入备份 -->
    <el-dialog v-model="importVisible" title="导入备份" width="480px">
      <input ref="importInput" type="file" accept=".json,application/json" class="pf-file" @change="onImportFile" />
      <el-button size="small" @click="importInput?.click()">选择备份文件</el-button>
      <template v-if="importPreview">
        <div class="pf-import-info">
          <div>文件名：{{ importPreview.fileName }}</div>
          <div>导出时间：{{ fmtTime(importPreview.exportedAt) }}</div>
          <div>来源账号：{{ importPreview.nickname || '（未记录）' }}</div>
          <div>包含：错题 {{ importPreview.counts.items }} 条<template v-if="importPreview.counts.badItems">（其中 {{ importPreview.counts.badItems }} 条格式异常将跳过）</template> · {{ importPreview.counts.hasStats ? '含学习档案' : '无学习档案' }} · {{ importPreview.counts.hasProfile ? '含个人资料' : '无个人资料' }}</div>
        </div>
        <el-radio-group v-model="importMode" style="margin-top: 12px">
          <el-radio value="merge">合并（保留现有数据）</el-radio>
          <el-radio value="overwrite">覆盖（以备份为准）</el-radio>
        </el-radio-group>
      </template>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!importPreview" @click="doImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { summary as statsSummary, achievementList, updateGoal, statsRef } from '../statsStore'
import {
  GRADES, AVATAR_COLORS, FONT_SCALES,
  avatarLetter, avatarColorOf,
  buildExport, validateImport, exportFileName, storageUsageKB,
} from '../profile.js'
import {
  profileRef, updateProfile, updatePref, applyImportedProfile, getProfile,
} from '../profileStore'

const props = defineProps({
  items: { type: Array, default: () => [] },
  settings: { type: Object, default: () => ({}) },
  loggedIn: { type: Boolean, default: false },
  token: { type: String, default: '' },
  userId: { type: [String, Number], default: '' },
  registeredAt: { type: Number, default: 0 },
  syncing: { type: Boolean, default: false },
})
const emit = defineEmits([
  'go-report', 'logout', 'switch-account', 'sync-now', 'pull-overwrite', 'clear-local',
  'import-apply', 'renamed', 'deleted', 'profile-changed',
])

const s = statsRef()
const profile = computed(() => profileRef().value)
const prefs = computed(() => profile.value.prefs)
const sum = computed(() => (s.value, statsSummary()))
const achList = computed(() => (s.value, achievementList()))
const doneAch = computed(() => achList.value.filter((a) => a.done).length)

const displayName = computed(() => props.userId || profile.value.nickname || '本机用户')
const letter = computed(() => avatarLetter(displayName.value))
const avatarBg = computed(() => (profile.value.avatar ? 'transparent' : avatarColorOf(profile.value, displayName.value)))

const joinedText = computed(() => {
  if (!props.registeredAt) return ''
  const d = new Date(props.registeredAt)
  if (isNaN(d)) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月加入`
})

const bioDraft = ref('')
const form = ref({ school: '', major: '', grade: '' })
watch(profile, (p) => {
  bioDraft.value = p.bio
  form.value = { school: p.school, major: p.major, grade: p.grade }
}, { immediate: true })

const masteredCount = computed(() => props.items.filter((i) => i.mastered).length)
const metrics = computed(() => {
  const t = sum.value.totals || {}
  return [
    { label: '当前连续（天）', value: sum.value.current },
    { label: '最长连续（天）', value: sum.value.longest },
    { label: '本月打卡（天）', value: sum.value.monthDays },
    { label: '累计打卡（天）', value: sum.value.checkedDays },
    { label: '错题总数', value: props.items.length },
    { label: '已掌握', value: masteredCount.value },
    { label: '累计讲解', value: t.explain || 0 },
    { label: '自测答对', value: t.correct || 0 },
    { label: '追问次数', value: t.followup || 0 },
    { label: '成就', value: `${doneAch.value}/${achList.value.length}` },
  ]
})

const usage = ref(storageUsageKB())
watch(profile, () => { usage.value = storageUsageKB() })

function saveBio() {
  updateProfile({ bio: bioDraft.value })
}

function saveProfileData() {
  updateProfile({ school: form.value.school, major: form.value.major, grade: form.value.grade })
  emit('profile-changed')
  ElMessage.success('资料已保存')
}

// ---- 头像
const fileInput = ref(null)
function pickAvatar() {
  fileInput.value?.click()
}
function onFile(e) {
  const f = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!f) return
  if (!/^image\//.test(f.type)) {
    ElMessage.warning('请选择图片文件')
    return
  }
  const url = URL.createObjectURL(f)
  const img = new Image()
  img.onload = () => {
    try {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const side = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      updateProfile({ avatar: canvas.toDataURL('image/jpeg', 0.85) })
      emit('profile-changed')
      ElMessage.success('头像已更新')
    } catch {
      ElMessage.error('图片处理失败，换一张试试')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    ElMessage.error('图片读取失败')
  }
  img.src = url
}

// ---- 改昵称
const renameVisible = ref(false)
const renaming = ref(false)
const renameForm = ref({ nickname: '', password: '' })
function openRename() {
  renameForm.value = { nickname: props.userId || '', password: '' }
  renameVisible.value = true
}
async function doRename() {
  const nick = renameForm.value.nickname.trim()
  if (nick.length < 2 || nick.length > 20) {
    ElMessage.warning('昵称长度需 2-20 位')
    return
  }
  if (!renameForm.value.password) {
    ElMessage.warning('请输入当前密码')
    return
  }
  renaming.value = true
  try {
    const r = await api.account.rename(getTokenSafe(), renameForm.value.password, nick)
    if (!r.ok) {
      ElMessage.error(r.error || '修改失败')
      return
    }
    renameVisible.value = false
    updateProfile({ nickname: nick })
    emit('renamed', { token: r.token, nickname: r.nickname })
    ElMessage.success('昵称已修改，云端数据已迁移')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    renaming.value = false
  }
}

// token 由 App 通过 prop 传入（只读使用，不在组件内持久化）
function getTokenSafe() {
  return props.token || ''
}

// ---- 修改密码
const pwdVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = ref({ old: '', next: '', confirm: '' })
async function doChangePassword() {
  const f = pwdForm.value
  if (!f.old || !f.next) {
    ElMessage.warning('请填写完整')
    return
  }
  pwdSaving.value = true
  try {
    const r = await api.account.changePassword(props.token, f.old, f.next, f.confirm)
    if (!r.ok) {
      ElMessage.error(r.error || '修改失败')
      return
    }
    pwdVisible.value = false
    pwdForm.value = { old: '', next: '', confirm: '' }
    ElMessage.success('密码已更新')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    pwdSaving.value = false
  }
}

// ---- 重置备份码
const backupVisible = ref(false)
const backupLoading = ref(false)
const backupPassword = ref('')
const newBackup = ref('')
async function doResetBackup() {
  if (!backupPassword.value) {
    ElMessage.warning('请输入当前密码')
    return
  }
  backupLoading.value = true
  try {
    const r = await api.account.resetBackup(props.token, backupPassword.value)
    if (!r.ok) {
      ElMessage.error(r.error || '重置失败')
      return
    }
    newBackup.value = r.backup || ''
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    backupLoading.value = false
  }
}
function closeBackup() {
  backupVisible.value = false
  backupPassword.value = ''
  newBackup.value = ''
}
function copyBackup() {
  copyText(newBackup.value, '备份码已复制')
}

// ---- 注销账号
const delVisible = ref(false)
const deleting = ref(false)
const delForm = ref({ password: '', confirm: '' })
async function doDelete() {
  if (!delForm.value.password) {
    ElMessage.warning('请输入密码')
    return
  }
  deleting.value = true
  try {
    const r = await api.account.deleteAccount(props.token, delForm.value.password)
    if (!r.ok) {
      ElMessage.error(r.error || '注销失败')
      return
    }
    delVisible.value = false
    emit('deleted')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    deleting.value = false
  }
}

// ---- 导出 / 导入
function doExport() {
  const pack = buildExport({
    profile: profile.value,
    stats: s.value,
    items: props.items,
    settings: props.settings,
    nickname: props.userId || profile.value.nickname,
  })
  download(exportFileName(), JSON.stringify(pack, null, 2))
  ElMessage.success('已导出备份文件')
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

const importVisible = ref(false)
const importInput = ref(null)
const importPreview = ref(null)
const importMode = ref('merge')
function onImportFile(e) {
  const f = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result))
      const v = validateImport(obj)
      if (!v.ok) {
        ElMessage.error(v.error)
        return
      }
      importPreview.value = { ...v, fileName: f.name, obj }
    } catch {
      ElMessage.error('文件不是有效的 JSON')
    }
  }
  reader.readAsText(f)
}
function doImport() {
  const p = importPreview.value
  if (!p) return
  emit('import-apply', { obj: p.obj, mode: importMode.value })
  if (p.profile) applyImportedProfile(p.profile)
  importVisible.value = false
  importPreview.value = null
}

// ---- 云端覆盖 / 清空本地
function pullOverwrite() {
  if (!props.loggedIn) {
    ElMessage.warning('登录后才能用云端数据覆盖本地')
    return
  }
  ElMessageBox.confirm('将用云端的错题本与学习档案覆盖本机数据，本机当前内容会被替换。继续吗？', '以云端覆盖本地', {
    type: 'warning', confirmButtonText: '开始覆盖', cancelButtonText: '取消',
  }).then(() => emit('pull-overwrite')).catch(() => {})
}
function clearLocal() {
  ElMessageBox.confirm('将清空本机的错题本、打卡记录与个人资料（云端不受影响，登录后会拉回）。继续吗？', '清空本地数据', {
    type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消',
  }).then(() => emit('clear-local')).catch(() => {})
}

// ---- 反馈
const feedback = ref('')
const fbSending = ref(false)
async function sendFeedback() {
  const content = feedback.value.trim()
  if (content.length < 5) {
    ElMessage.warning('再多写几个字吧')
    return
  }
  fbSending.value = true
  try {
    const r = await api.feedback(props.token || '', content, '', 'v2.0')
    if (!r.ok) {
      ElMessage.error(r.error || '提交失败')
      return
    }
    feedback.value = ''
    ElMessage.success('感谢反馈，已收到')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    fbSending.value = false
  }
}

// ---- 工具
async function copyText(text, tip) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ElMessage.success(tip)
      return
    }
  } catch { /* 回落 */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success(tip)
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

function fmtTime(iso) {
  if (!iso) return '（未记录）'
  const d = new Date(iso)
  if (isNaN(d)) return '（未记录）'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
.pf-head { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.pf-avatar-wrap { flex-shrink: 0; }
.pf-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid #e5e8ee;
}
.pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pf-avatar-letter { color: #fff; font-size: 32px; font-weight: 700; }
.pf-avatar-ops { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
.pf-file { display: none; }

.pf-id { flex: 1; min-width: 240px; }
.pf-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pf-name { font-size: 20px; font-weight: 700; color: #1f2733; }
.pf-tag {
  font-size: 11.5px;
  color: #96690f;
  background: #fdf8ee;
  border: 1px solid #ecd9b0;
  border-radius: 999px;
  padding: 1px 9px;
}
.pf-meta { font-size: 12.5px; color: #6b7686; margin: 4px 0 10px; }
.pf-bio { max-width: 420px; }
.pf-colors { display: flex; align-items: center; gap: 6px; margin-top: 10px; flex-wrap: wrap; font-size: 12.5px; }
.pf-color { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.pf-color.on { border-color: #35507a; }

.pf-block { margin-top: 22px; border-top: 1px solid #eef0f4; padding-top: 16px; }
.pf-title-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.pf-title { font-size: 14px; font-weight: 700; color: #35507a; }
.pf-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
.pf-field label { display: block; font-size: 12.5px; color: #6b7686; margin-bottom: 6px; }

.pf-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.pf-metric { border: 1px solid #e5e8ee; border-radius: 8px; padding: 9px 11px; background: #fdfdfe; }
.pf-metric-v { font-size: 19px; font-weight: 700; color: #35507a; }
.pf-metric-k { font-size: 11.5px; color: #6b7686; margin-top: 2px; }

.pf-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px dashed #eef0f4; font-size: 13.5px; flex-wrap: wrap; }
.pf-row:last-child { border-bottom: none; }
.pf-row-click { cursor: pointer; }
.pf-row-click:hover { background: #f7f9fc; }
.pf-row-l { min-width: 0; }
.pf-row-t { font-size: 13.5px; color: #1f2733; }
.pf-row .muted { font-size: 12px; }
.pf-danger { color: #b54444; }
.pf-empty { font-size: 13px; color: #6b7686; }
.pf-goal-set { display: flex; align-items: center; gap: 8px; }
.pf-backup {
  font-family: "SF Mono", Consolas, Menlo, monospace;
  font-size: 22px;
  letter-spacing: 3px;
  color: #35507a;
  background: #f2f6fb;
  border: 1px dashed #bcc7dd;
  border-radius: 8px;
  padding: 14px;
  text-align: center;
}
.pf-import-info { margin-top: 12px; font-size: 12.5px; line-height: 1.8; color: #4a5568; }

@media (max-width: 768px) {
  .pf-form { grid-template-columns: 1fr; }
  .pf-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pf-avatar { width: 64px; height: 64px; }
  .pf-avatar-letter { font-size: 26px; }
}
</style>
