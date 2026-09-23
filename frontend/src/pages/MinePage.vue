<template>
  <div class="zy-container zy-page mine">
    <!-- ① 身份区 -->
    <section class="mine__head surface-standard">
      <div class="mine__avatar-wrap">
        <button class="mine__avatar" :style="{ background: avatarBg }" type="button" title="点击上传头像" @click="pickAvatar">
          <img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
          <span v-else class="mine__avatar-letter">{{ letter }}</span>
        </button>
        <div class="mine__avatar-ops">
          <UiButton variant="ghost" size="sm" @click="pickAvatar">上传头像</UiButton>
          <UiButton v-if="profile.avatar" variant="text" size="sm" @click="updateProfile({ avatar: '' })">移除</UiButton>
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="mine__file" @change="onFile" />
      </div>

      <div class="mine__id">
        <div class="mine__name-row">
          <span class="t-h1 mine__name">{{ displayName }}</span>
          <UiButton v-if="loggedIn" variant="text" size="sm" @click="openRename">改昵称</UiButton>
          <UiTag v-else variant="warning">未登录 · 资料只存本机</UiTag>
        </div>
        <p class="t-body-2 mine__meta">
          知一 ID {{ userId || '—' }}<template v-if="joinedText"> · {{ joinedText }}</template>
        </p>
        <div class="mine__bio">
          <UiInput
            v-model="bioDraft"
            :maxlength="60"
            show-count
            placeholder="写一句正在做的事，比如：期末周把高数错题清一遍"
            @blur="saveBio"
          />
        </div>
        <div class="mine__colors">
          <span class="t-label">头像底色</span>
          <button
            v-for="c in AVATAR_COLORS"
            :key="c"
            type="button"
            class="mine__color"
            :class="{ 'is-on': profile.avatarColor === c }"
            :style="{ background: c }"
            @click="updateProfile({ avatarColor: c })"
          />
        </div>
      </div>
    </section>

    <!-- ② 学习资料 -->
    <section class="mine__block">
      <h2 class="t-h3 mine__title">学习资料</h2>
      <div class="mine__form">
        <UiInput v-model="form.school" label="学校" :maxlength="30" placeholder="如：××大学" />
        <UiInput v-model="form.major" label="专业" :maxlength="30" placeholder="如：计算机科学与技术" />
        <label class="mine__field">
          <span class="t-label">年级</span>
          <UiSelect v-model="form.grade" :options="gradeOptions" placeholder="选择年级" />
        </label>
      </div>
      <div class="mine__form-ops">
        <UiButton variant="primary" size="sm" @click="saveProfileData">保存资料</UiButton>
        <span class="t-label">{{ loggedIn ? '资料会随账号同步' : '登录后可同步到云端' }}</span>
      </div>
    </section>

    <!-- ③ 学习档案 -->
    <section class="mine__block">
      <div class="mine__title-row">
        <h2 class="t-h3 mine__title">学习档案 <span class="t-label">只读 · 来自打卡与错题本</span></h2>
        <UiButton variant="text" size="sm" @click="goReport">查看完整学情 →</UiButton>
      </div>
      <div class="mine__metrics">
        <div
          v-for="m in metrics"
          :key="m.label"
          class="mine__metric"
          :class="{ 'is-link': !!m.path }"
          @click="m.path && router.push(m.path)"
        >
          <div class="t-metric">{{ m.value }}<span v-if="m.path" class="mine__metric-go">→</span></div>
          <div class="t-caption mine__metric-k">{{ m.label }}</div>
        </div>
      </div>
    </section>

    <!-- ④ 偏好设置 -->
    <section class="mine__block">
      <h2 class="t-h3 mine__title">偏好设置</h2>
      <div class="mine__row">
        <div class="mine__row-l">
          <div class="mine__row-t">界面主题</div>
          <div class="t-label">深色适合夜间；浅色适合白天与投屏</div>
        </div>
        <UiSegmented
          :model-value="theme"
          :options="[{ label: '深色', value: 'dark' }, { label: '浅色', value: 'light' }]"
          aria-label="界面主题"
          @change="setTheme"
        />
      </div>
      <div class="mine__row">
        <div class="mine__row-l">
          <div class="mine__row-t">追问默认档位</div>
          <div class="t-label">打开追问面板时的默认选择</div>
        </div>
        <UiSegmented
          :model-value="prefs.defaultMode"
          :options="[{ label: '快答', value: 'fast' }, { label: '深思', value: 'deep' }]"
          aria-label="追问默认档位"
          @change="(v) => updatePref('defaultMode', v)"
        />
      </div>
      <div class="mine__row">
        <div class="mine__row-l">
          <div class="mine__row-t">公式渲染</div>
          <div class="t-label">关闭后公式转为可复制的纯文本（不跑 KaTeX，翻页更快）</div>
        </div>
        <UiSwitch :model-value="prefs.renderMath" @change="(v) => updatePref('renderMath', v)" />
      </div>
      <div class="mine__row">
        <div class="mine__row-l">
          <div class="mine__row-t">正文字号</div>
          <div class="t-label">影响讲解与速查正文</div>
        </div>
        <UiSegmented
          :model-value="prefs.fontScale"
          :options="FONT_SCALES.map((f) => ({ label: f.label, value: f.key }))"
          aria-label="正文字号"
          @change="(v) => updatePref('fontScale', v)"
        />
      </div>
      <div class="mine__row">
        <div class="mine__row-l">
          <div class="mine__row-t">每日目标</div>
          <div class="t-label">达成后当天打卡格会标记；关闭则只记录不断链</div>
        </div>
        <div class="mine__goal">
          <UiSwitch :model-value="sum.goalEnabled" @change="(v) => updateGoal({ goalEnabled: v })" />
          <template v-if="sum.goalEnabled">
            <input
              class="mine__num"
              type="number"
              min="1"
              max="100"
              :value="sum.goalTarget"
              @change="(e) => updateGoal({ goalQuestions: Number(e.target.value) || 5 })"
            />
            <span class="t-label">题/天</span>
          </template>
        </div>
      </div>
    </section>

    <!-- ⑤ 账号与安全 -->
    <section class="mine__block">
      <h2 class="t-h3 mine__title">账号与安全</h2>
      <template v-if="loggedIn">
        <button class="mine__row mine__row-click" type="button" @click="openTeacherCert">
          <span>教师认证</span>
          <span class="t-label">{{ teacherLabel }}</span>
        </button>
        <button class="mine__row mine__row-click" type="button" @click="openPwd">
          <span>修改密码</span><span class="t-label">定期换一次更安心</span>
        </button>
        <button class="mine__row mine__row-click" type="button" @click="openBackup">
          <span>重置备份码</span><span class="t-label">忘记密码时的唯一凭证</span>
        </button>
        <button class="mine__row mine__row-click" type="button" @click="doLogout">
          <span>退出登录</span><span class="t-label">{{ displayName }}</span>
        </button>
        <button class="mine__row mine__row-click" type="button" @click="doSwitchAccount">
          <span>切换账号</span><span class="t-label">用其他昵称登录</span>
        </button>
        <button class="mine__row mine__row-click" type="button" @click="openDelete">
          <span class="mine__danger">注销账号</span><span class="t-label">清空云端数据，不可恢复</span>
        </button>
      </template>
      <div v-else class="mine__row">
        <span class="t-body-2">当前是本地模式：错题、打卡、资料都只存在这台设备上。</span>
        <UiButton variant="ghost" size="sm" @click="doSwitchAccount">登录 / 注册</UiButton>
      </div>
    </section>

    <!-- ⑥ 数据管理 -->
    <section class="mine__block">
      <div class="mine__title-row">
        <h2 class="t-h3 mine__title">数据管理 <span class="t-label">本机占用约 {{ usage }} KB</span></h2>
        <UiButton v-if="loggedIn" variant="text" size="sm" :loading="syncing" @click="doSyncNow">立即同步</UiButton>
      </div>
      <button class="mine__row mine__row-click" type="button" @click="doExport">
        <span>导出全部数据</span><span class="t-label">错题本 + 学习档案 + 资料（JSON）</span>
      </button>
      <button class="mine__row mine__row-click" type="button" @click="importVisible = true">
        <span>导入备份</span><span class="t-label">可合并或覆盖当前数据</span>
      </button>
      <button class="mine__row mine__row-click" type="button" @click="pullOverwrite">
        <span>以云端覆盖本地</span><span class="t-label">换设备后数据乱了时用它</span>
      </button>
      <button class="mine__row mine__row-click" type="button" @click="clearLocal">
        <span class="mine__danger">清空本地数据</span><span class="t-label">云端保留，下次登录会拉回</span>
      </button>
    </section>

    <!-- ⑦ 意见反馈 -->
    <section class="mine__block">
      <h2 class="t-h3 mine__title">意见反馈</h2>
      <UiInput
        v-model="feedback"
        type="textarea"
        :maxlength="500"
        show-count
        :rows="4"
        placeholder="遇到问题、想要的功能、觉得哪里别扭，都可以写在这里"
      />
      <div class="mine__form-ops">
        <UiButton variant="primary" size="sm" :loading="fbSending" @click="sendFeedback">提交反馈</UiButton>
      </div>
    </section>

    <!-- 教师认证 -->
    <UiModal v-model="teacherVisible" title="教师认证" size="sm">
      <p class="t-body-2 mine__modal-tip">
        声明式认证：填写的信息会在班级内公示。认证后可创建班级、布置作业、用 AI 批改。
      </p>
      <div class="mine__modal-form">
        <UiInput v-model="teacherForm.name" :maxlength="20" placeholder="姓名（公示用，可填常用称呼）" />
        <UiInput v-model="teacherForm.school" :maxlength="40" placeholder="学校，例如：某某大学" />
        <UiInput v-model="teacherForm.subject" :maxlength="30" placeholder="任教科目（选填），例如：高等数学" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="teacherVisible = false">取消</UiButton>
        <UiButton
          variant="primary"
          :loading="teacherSaving"
          :disabled="!teacherForm.name.trim() || !teacherForm.school.trim()"
          @click="doTeacherApply"
        >{{ teacherInfo?.is_teacher ? '更新信息' : '完成认证' }}</UiButton>
      </template>
    </UiModal>

    <!-- 改昵称 -->
    <UiModal v-model="renameVisible" title="修改昵称">
      <UiAlert variant="warning" title="昵称同时是登录名：修改后需用新昵称登录，云端错题与打卡记录会自动迁移。" />
      <div class="mine__modal-form">
        <UiInput v-model="renameForm.nickname" :maxlength="20" placeholder="新昵称（2-20 位）" :error="dlgErr.nickname" />
        <UiInput v-model="renameForm.password" type="password" placeholder="当前密码（安全校验）" :error="dlgErr.password" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="renameVisible = false">取消</UiButton>
        <UiButton variant="primary" :loading="renaming" @click="doRename">确认修改</UiButton>
      </template>
    </UiModal>

    <!-- 修改密码 -->
    <UiModal v-model="pwdVisible" title="修改密码">
      <div class="mine__modal-form">
        <UiInput v-model="pwdForm.old" type="password" placeholder="当前密码" :error="dlgErr.old" />
        <UiInput v-model="pwdForm.next" type="password" placeholder="新密码（6-64 位）" :error="dlgErr.next" />
        <UiInput v-model="pwdForm.confirm" type="password" placeholder="确认新密码" :error="dlgErr.confirm" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="pwdVisible = false">取消</UiButton>
        <UiButton variant="primary" :loading="pwdSaving" @click="doChangePassword">保存</UiButton>
      </template>
    </UiModal>

    <!-- 重置备份码 -->
    <UiModal v-model="backupVisible" title="重置备份码">
      <template v-if="!newBackup">
        <p class="t-body-2 mine__modal-tip">
          备份码用于「忘记密码」时找回账号。重置后旧备份码立即失效，请把新码抄在安全的地方。
        </p>
        <UiInput v-model="backupPassword" type="password" placeholder="当前密码" :error="dlgErr.old" />
      </template>
      <template v-else>
        <p class="t-body-2">这是你的新备份码（只显示这一次）：</p>
        <div class="mine__backup">{{ newBackup }}</div>
      </template>
      <template #footer>
        <UiButton variant="ghost" @click="closeBackup">{{ newBackup ? '我已抄好' : '取消' }}</UiButton>
        <UiButton v-if="!newBackup" variant="primary" :loading="backupLoading" @click="doResetBackup">生成新备份码</UiButton>
        <UiButton v-else variant="primary" @click="copyBackup">复制</UiButton>
      </template>
    </UiModal>

    <!-- 注销账号 -->
    <UiModal v-model="delVisible" title="注销账号">
      <UiAlert variant="error" title="这会永久删除云端的错题本、打卡记录与个人资料，无法恢复。" />
      <div class="mine__modal-form">
        <UiInput v-model="delForm.password" type="password" placeholder="当前密码" :error="dlgErr.old" />
        <UiInput v-model="delForm.confirm" placeholder="输入「注销」两个字确认" />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="delVisible = false">取消</UiButton>
        <UiButton variant="primary" :disabled="delForm.confirm !== '注销'" :loading="deleting" @click="doDelete">永久注销</UiButton>
      </template>
    </UiModal>

    <!-- 导入备份 -->
    <UiModal v-model="importVisible" title="导入备份">
      <input ref="importInput" type="file" accept=".json,application/json" class="mine__file" @change="onImportFile" />
      <UiButton variant="ghost" size="sm" @click="importInput && importInput.click()">选择备份文件</UiButton>
      <template v-if="importPreview">
        <div class="mine__import-info t-body-2">
          <div>文件名：{{ importPreview.fileName }}</div>
          <div>导出时间：{{ fmtTime(importPreview.exportedAt) }}</div>
          <div>来源账号：{{ importPreview.nickname || '（未记录）' }}</div>
          <div>
            包含：错题 {{ importPreview.counts.items }} 条<template v-if="importPreview.counts.badItems">（其中 {{ importPreview.counts.badItems }} 条格式异常将跳过）</template> · {{ importPreview.counts.hasStats ? '含学习档案' : '无学习档案' }} · {{ importPreview.counts.hasProfile ? '含个人资料' : '无个人资料' }}
          </div>
        </div>
        <div class="mine__import-mode">
          <UiSegmented
            v-model="importMode"
            :options="[{ label: '合并（保留现有数据）', value: 'merge' }, { label: '覆盖（以备份为准）', value: 'overwrite' }]"
            aria-label="导入方式"
          />
        </div>
      </template>
      <template #footer>
        <UiButton variant="ghost" @click="importVisible = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!importPreview" @click="doImport">开始导入</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * 我的（个人主页）· v1
 * ---------------------------------------------------------------------------
 * 从 components/ProfilePage.vue 迁移：**脚本逻辑逐字保留**，只做了三件事：
 *   1. 模板里的 el-* 换成自研 ui/ 组件（行为逐条对齐）
 *   2. ElMessage / ElMessageBox 改从 ui/notify.js 引入（兼容层，调用点一行未改）
 *   3. 数据来源由 props/emits 改为直接读 stores（P2.5 起的目标架构：页面不再逐层透传）
 * 数据契约、接口调用、localStorage key 一律未改。
 */
import { reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from '../ui/notify.js'
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
import { bookRef, settingsRef } from '../stores/bookStore'
import {
  session, logout, syncNow, pullOverwrite as pullStoreOverwrite, clearLocalData, applyImport,
  renameSession, resetAfterDelete, scheduleProfilePush,
} from '../stores/sessionStore'
import { openAuth } from '../stores/uiStore'
import { ROUTES } from '../lib/routes.js'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiTag from '../ui/UiTag.vue'
import UiModal from '../ui/UiModal.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiAlert from '../ui/UiAlert.vue'

const router = useRouter()

/* 数据来源：store（不再是 props） */
const items = computed(() => bookRef().value)
const settings = computed(() => settingsRef().value)
const loggedIn = computed(() => session.space === 'account')
const token = computed(() => session.token)
const userId = computed(() => session.userId)
const registeredAt = computed(() => session.registeredAt)
const syncing = computed(() => session.syncing)

const gradeOptions = GRADES.map((g) => ({ label: g, value: g }))

/* 教师认证（班级模块）：声明式，认证后可建班布置作业 */
const teacherVisible = ref(false)
const teacherSaving = ref(false)
const teacherInfo = ref(null)
const teacherForm = reactive({ name: '', school: '', subject: '' })
const teacherLabel = computed(() => {
  if (!teacherInfo.value) return '认证后可建班布置作业'
  if (!teacherInfo.value.is_teacher) return '未认证'
  const m = teacherInfo.value.meta || {}
  return `已认证 · ${m.name || ''}${m.school ? ` · ${m.school}` : ''}`
})

async function loadTeacherStatus() {
  if (!loggedIn.value || !token.value) return
  try {
    teacherInfo.value = await api.cls.teacherMe(token.value)
    if (teacherInfo.value?.is_teacher) {
      const m = teacherInfo.value.meta || {}
      teacherForm.name = m.name || ''
      teacherForm.school = m.school || ''
      teacherForm.subject = m.subject || ''
    }
  } catch {
    /* 静默：认证状态拉不到不阻断「我的」页 */
  }
}
loadTeacherStatus()

function openTeacherCert() {
  if (!loggedIn.value) {
    openAuth('login')
    return
  }
  teacherVisible.value = true
}

async function doTeacherApply() {
  if (teacherSaving.value) return
  teacherSaving.value = true
  try {
    const r = await api.cls.teacherApply(token.value, teacherForm.name, teacherForm.school, teacherForm.subject)
    if (r.ok) {
      teacherInfo.value = r.teacher
      teacherVisible.value = false
      ElMessage.success('教师认证完成')
    } else {
      ElMessage.error(r.error || '认证失败')
    }
  } catch {
    ElMessage.error('网络异常，请重试')
  }
  teacherSaving.value = false
}


const s = statsRef()
const profile = computed(() => profileRef().value)
const prefs = computed(() => profile.value.prefs)
const sum = computed(() => (s.value, statsSummary()))
const achList = computed(() => (s.value, achievementList()))
const doneAch = computed(() => achList.value.filter((a) => a.done).length)

const displayName = computed(() => userId.value || profile.value.nickname || '本机用户')
const letter = computed(() => avatarLetter(displayName.value))
const avatarBg = computed(() => (profile.value.avatar ? 'transparent' : avatarColorOf(profile.value, displayName.value)))

const joinedText = computed(() => {
  if (!registeredAt.value) return ''
  const d = new Date(registeredAt.value)
  if (isNaN(d)) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月加入`
})

const bioDraft = ref('')
const form = ref({ school: '', major: '', grade: '' })
watch(profile, (p) => {
  bioDraft.value = p.bio
  form.value = { school: p.school, major: p.major, grade: p.grade }
}, { immediate: true })

const masteredCount = computed(() => items.value.filter((i) => i.mastered).length)
const metrics = computed(() => {
  const t = sum.value.totals || {}
  return [
    { label: '当前连续（天）', value: sum.value.current },
    { label: '最长连续（天）', value: sum.value.longest },
    { label: '本月打卡（天）', value: sum.value.monthDays },
    { label: '累计打卡（天）', value: sum.value.checkedDays },
    { label: '错题总数', value: items.value.length },
    { label: '已掌握', value: masteredCount.value },
    { label: '累计讲解', value: t.explain || 0 },
    { label: '自测答对', value: t.correct || 0 },
    { label: '追问次数', value: t.followup || 0 },
    { label: '成就', value: `${doneAch.value}/${achList.value.length}`, path: ROUTES.achievements },
  ]
})

const usage = ref(storageUsageKB())
watch(profile, () => { usage.value = storageUsageKB() })

/* 页面动作：直接调 store（原来靠 emit 回 App） */
const goReport = () => router.push(ROUTES.data)
const doLogout = () => logout(false)
const doSwitchAccount = () => openAuth('login')
const doSyncNow = () => syncNow()
const doPullOverwrite = () => pullStoreOverwrite()
const doClearLocal = () => clearLocalData()
const doImportApply = (payload) => applyImport(payload)
const onRenamed = (payload) => renameSession(payload)
const onDeleted = () => {
  resetAfterDelete()
  router.push(ROUTES.home)
}
const onProfileChanged = () => scheduleProfilePush()

/** 弹窗内字段级错误（就近显示，不依赖全局提示） */
const dlgErr = reactive({ nickname: '', password: '', old: '', next: '', confirm: '' })
const clearDlgErr = () => Object.keys(dlgErr).forEach((k) => { dlgErr[k] = '' })

/* 界面主题：按设备记（localStorage zy_theme），与 main.js 启动时读取的键保持一致 */
const theme = ref(readTheme())
function readTheme() {
  try {
    return localStorage.getItem('zy_theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}
function setTheme(v) {
  theme.value = v === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem('zy_theme', theme.value)
  } catch {
    /* 忽略 */
  }
}

function saveBio() {
  updateProfile({ bio: bioDraft.value })
}

function saveProfileData() {
  updateProfile({ school: form.value.school, major: form.value.major, grade: form.value.grade })
  onProfileChanged()
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
      onProfileChanged()
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
  clearDlgErr()
  renameForm.value = { nickname: userId.value || '', password: '' }
  renameVisible.value = true
}

async function doRename() {
  const nick = renameForm.value.nickname.trim()
  if (nick.length < 2 || nick.length > 20) {
    dlgErr.nickname = '昵称长度需 2-20 位'
    return
  }
  if (!renameForm.value.password) {
    dlgErr.password = '请输入当前密码'
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
    onRenamed({ token: r.token, nickname: r.nickname })
    ElMessage.success('昵称已修改，云端数据已迁移')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    renaming.value = false
  }
}

// token 由 App 通过 prop 传入（只读使用，不在组件内持久化）
function getTokenSafe() {
  return token.value || ''
}

// ---- 修改密码
const pwdVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = ref({ old: '', next: '', confirm: '' })
function openPwd() {
  clearDlgErr()
  pwdVisible.value = true
}

async function doChangePassword() {
  clearDlgErr()
  const f = pwdForm.value
  if (!f.old) {
    dlgErr.old = '请输入当前密码'
    return
  }
  if (!f.next) {
    dlgErr.next = '请输入新密码'
    return
  }
  if (f.next !== f.confirm) {
    dlgErr.confirm = '两次密码不一致'
    return
  }
  pwdSaving.value = true
  try {
    const r = await api.account.changePassword(token.value, f.old, f.next, f.confirm)
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
function openBackup() {
  clearDlgErr()
  backupVisible.value = true
}

async function doResetBackup() {
  clearDlgErr()
  if (!backupPassword.value) {
    dlgErr.old = '请输入当前密码'
    return
  }
  backupLoading.value = true
  try {
    const r = await api.account.resetBackup(token.value, backupPassword.value)
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
function openDelete() {
  clearDlgErr()
  delVisible.value = true
}

async function doDelete() {
  clearDlgErr()
  if (!delForm.value.password) {
    dlgErr.old = '请输入密码'
    return
  }
  deleting.value = true
  try {
    const r = await api.account.deleteAccount(token.value, delForm.value.password)
    if (!r.ok) {
      ElMessage.error(r.error || '注销失败')
      return
    }
    delVisible.value = false
    onDeleted()
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
    items: items.value,
    settings: settings.value,
    nickname: userId.value || profile.value.nickname,
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
  doImportApply({ obj: p.obj, mode: importMode.value })
  if (p.profile) applyImportedProfile(p.profile)
  importVisible.value = false
  importPreview.value = null
}

// ---- 云端覆盖 / 清空本地
function pullOverwrite() {
  if (!loggedIn.value) {
    ElMessage.warning('登录后才能用云端数据覆盖本地')
    return
  }
  ElMessageBox.confirm('将用云端的错题本与学习档案覆盖本机数据，本机当前内容会被替换。继续吗？', '以云端覆盖本地', {
    type: 'warning', confirmButtonText: '开始覆盖', cancelButtonText: '取消',
  }).then(() => doPullOverwrite()).catch(() => {})
}
function clearLocal() {
  ElMessageBox.confirm('将清空本机的错题本、打卡记录与个人资料（云端不受影响，登录后会拉回）。继续吗？', '清空本地数据', {
    type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消',
  }).then(() => doClearLocal()).catch(() => {})
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
    const r = await api.feedback(token.value || '', content, '', 'v2.0')
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
.mine {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.mine__head {
  display: flex;
  gap: var(--sp-5);
  align-items: flex-start;
  flex-wrap: wrap;
  padding: var(--sp-6);
}
.mine__avatar-wrap {
  flex: none;
}
.mine__avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: var(--border-default);
  padding: 0;
}
.mine__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mine__avatar-letter {
  color: #fff;
  font-size: 32px;
  font-weight: var(--fw-medium);
}
.mine__avatar-ops {
  display: flex;
  gap: var(--sp-1);
  margin-top: var(--sp-2);
  align-items: center;
}
.mine__file {
  display: none;
}
.mine__id {
  flex: 1;
  min-width: 260px;
}
.mine__name-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.mine__name {
  font-size: 20px;
}
.mine__meta {
  color: var(--text-tertiary);
  margin: var(--sp-1) 0 var(--sp-3);
}
.mine__bio {
  max-width: 460px;
}
.mine__colors {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  flex-wrap: wrap;
}
.mine__color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.mine__color.is-on {
  border-color: var(--primary-line);
  box-shadow: 0 0 0 2px var(--primary-soft-3);
}

.mine__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-5);
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--grad-surface);
  box-shadow: var(--highlight-1), var(--shadow-subtle);
}
.mine__title {
  color: var(--text-primary);
}
.mine__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.mine__title-row .t-label {
  margin-left: var(--sp-2);
}
.mine__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}
.mine__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.mine__form-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
.mine__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--sp-4);
  margin-top: var(--sp-2);
}
.mine__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mine__metric-k {
  color: var(--text-tertiary);
}
.mine__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  font-size: var(--fs-body);
  color: var(--text-secondary);
  border-top: 0;
  border-left: 0;
  border-right: 0;
  border-bottom: var(--border-divider-soft);
  background: none;
  width: 100%;
  text-align: left;
}
.mine__row:last-child {
  border-bottom: 0;
}
.mine__row-click {
  cursor: pointer;
  transition: color var(--dur) var(--ease);
}
.mine__row-click:hover {
  color: var(--text-primary);
}
.mine__row-l {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.mine__row-t {
  font-size: var(--fs-body);
  color: var(--text-secondary);
}
.mine__goal {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.mine__num {
  width: 76px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
}
.mine__danger {
  color: var(--error);
}
.mine__modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
.mine__modal-tip {
  margin-bottom: var(--sp-3);
}
.mine__backup {
  margin-top: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--primary-text-strong);
  font-family: var(--font-mono);
  font-size: var(--fs-h3);
  letter-spacing: 1px;
  word-break: break-all;
}
.mine__import-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--text-secondary);
}
.mine__import-mode {
  margin-top: var(--sp-3);
}

/* 可点击的指标（如「成就 x/51」→ 成就殿堂） */
.mine__metric.is-link {
  cursor: pointer;
}
.mine__metric.is-link:hover .t-metric {
  color: var(--primary-text);
}
.mine__metric-go {
  font-size: 0.66em;
  margin-left: 3px;
  color: var(--primary-text);
}
</style>
