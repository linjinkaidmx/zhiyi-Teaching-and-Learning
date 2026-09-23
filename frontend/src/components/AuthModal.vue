<template>
  <UiModal
    v-model="visible"
    :title="title"
    :close-on-mask="false"
    @close="onClosed"
  >
    <!-- 登录 -->
    <template v-if="mode === 'login'">
      <p class="tip">用注册时的「昵称 + 密码」登录，登录后本设备会自动拉取云端错题本。</p>
      <div class="am-form">
        <UiInput v-model="f.nickname" label="昵称" :maxlength="20" placeholder="2-20 位昵称" :error="err.nickname" />
        <UiInput v-model="f.password" label="密码" type="password" placeholder="密码" :error="err.password" @submit="doLogin" />
      </div>
      <div class="actions">
        <UiButton variant="primary" block :loading="loading" @click="doLogin">登 录</UiButton>
      </div>
      <div class="links">
        <UiButton variant="text" size="sm" @click="mode = 'register'">去注册</UiButton>
        <UiButton variant="text" size="sm" class="muted-link" @click="mode = 'recover'">忘记密码</UiButton>
      </div>
    </template>

    <!-- 注册 -->
    <template v-else-if="mode === 'register'">
      <p class="tip">昵称是全站唯一身份。注册后换设备用昵称登录即可找回错题本。</p>
      <div class="am-form">
        <UiInput v-model="f.nickname" label="昵称" :maxlength="20" placeholder="2-20 位，全站唯一" :error="err.nickname" />
        <UiInput v-model="f.password" label="密码" type="password" placeholder="至少 6 位" :error="err.password" />
        <UiInput v-model="f.passwordConfirm" label="确认密码" type="password" placeholder="再输一次" :error="err.passwordConfirm" />
      </div>
      <div class="actions">
        <UiButton variant="primary" block :loading="loading" @click="doRegister">注 册</UiButton>
      </div>
      <div class="links">
        <UiButton variant="text" size="sm" @click="mode = 'login'">已有账号？去登录</UiButton>
      </div>
    </template>

    <!-- 备份码（注册成功后，仅显示一次） -->
    <template v-else-if="mode === 'backup'">
      <div class="backup-box">
        <p class="tip">昵称 <b>{{ pending.userId }}</b> 注册成功！以下是你的 <b>备份码（仅本次显示一次）</b>：</p>
        <div class="backup-code">{{ pending.backup }}</div>
        <p class="warn">请截图或抄写保存。忘记密码时用「昵称 + 备份码」即可重置；备份码丢失只能联系管理员重置。</p>
      </div>
      <div class="actions">
        <UiButton variant="primary" block @click="confirmBackup">我已保存，进入</UiButton>
      </div>
    </template>

    <!-- 找回密码 -->
    <template v-else-if="mode === 'recover'">
      <p class="tip">用注册时保存的 <b>备份码</b> 重设密码。若备份码也丢失，请联系管理员重置。</p>
      <div class="am-form">
        <UiInput v-model="f.nickname" label="昵称" :maxlength="20" placeholder="注册时的昵称" :error="err.nickname" />
        <UiInput v-model="f.backupCode" label="备份码" :maxlength="12" placeholder="如 ABCD-EFGH" :error="err.backupCode" />
        <UiInput v-model="f.newPassword" label="新密码" type="password" placeholder="至少 6 位" :error="err.newPassword" />
        <UiInput v-model="f.passwordConfirm" label="确认新密码" type="password" placeholder="再输一次" :error="err.passwordConfirm" />
      </div>
      <div class="actions">
        <UiButton variant="primary" block :loading="loading" @click="doRecover">重设密码并登录</UiButton>
      </div>
      <div class="links">
        <UiButton variant="text" size="sm" @click="mode = 'login'">返回登录</UiButton>
      </div>
    </template>

    <!-- 修改密码 -->
    <template v-else>
      <div class="am-form">
        <UiInput v-model="f.oldPassword" label="原密码" type="password" placeholder="当前密码" :error="err.oldPassword" />
        <UiInput v-model="f.newPassword" label="新密码" type="password" placeholder="至少 6 位" :error="err.newPassword" />
        <UiInput v-model="f.passwordConfirm" label="确认新密码" type="password" placeholder="再输一次" :error="err.passwordConfirm" />
      </div>
      <div class="actions">
        <UiButton variant="primary" block :loading="loading" @click="doChangePassword">保存新密码</UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 账号弹窗（登录 / 注册 / 备份码 / 找回密码 / 修改密码）· v1
 * ---------------------------------------------------------------------------
 * 从 EP 版迁移：接口调用与校验逻辑逐字保留。
 * 顺带修掉一处既有隐患：`doChangePassword` 里用了 `getUserId()` 但原来没有 import
 * （从旧顶栏「修改密码」进入会 ReferenceError），这里补上。
 */
import { reactive, ref, computed, watch } from 'vue'
import { ElMessage } from '../ui/notify.js'
import { api } from '../api'
import { getClientId, getToken, getUserId, adoptSession } from '../auth'
import UiModal from '../ui/UiModal.vue'
import UiInput from '../ui/UiInput.vue'
import UiButton from '../ui/UiButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialMode: { type: String, default: 'login' },
})
const emit = defineEmits(['update:modelValue', 'auth'])

const mode = ref('login')
const loading = ref(false)
const pending = ref({ userId: '', backup: '', token: '' })
const f = ref({ nickname: '', password: '', passwordConfirm: '', oldPassword: '', newPassword: '', backupCode: '' })
/** 字段级错误：就近显示在输入框下方，不依赖全局提示（弹窗内不会被遮罩影响） */
const err = reactive({ nickname: '', password: '', passwordConfirm: '', oldPassword: '', newPassword: '', backupCode: '' })
const clearErr = () => Object.keys(err).forEach((k) => { err[k] = '' })
// 用户一改动就清掉该字段的旧错误，避免红字粘着不放
watch(f, (nv, ov) => {
  Object.keys(err).forEach((k) => { if (nv[k] !== ov[k]) err[k] = '' })
}, { deep: true })

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const title = computed(() => ({
  login: '登录账号',
  register: '注册账号',
  backup: '注册成功 · 请保存备份码',
  recover: '找回账号（备份码重设密码）',
  changePassword: '修改密码',
}[mode.value] || '登录账号'))

watch(() => props.modelValue, (v) => {
  if (v) {
    mode.value = props.initialMode || 'login'
    f.value = { nickname: '', password: '', passwordConfirm: '', oldPassword: '', newPassword: '', backupCode: '' }
    loading.value = false
    pending.value = { userId: '', backup: '', token: '' }
    clearErr()
  }
})

function onClosed() {
  mode.value = 'login'
  loading.value = false
}

function validateNickname() {
  const n = f.value.nickname.trim()
  if (n.length < 2 || n.length > 20) { err.nickname = '昵称长度需 2-20 位'; return null }
  return n
}

async function doLogin() {
  clearErr()
  const n = validateNickname()
  if (!n) return
  if (!f.value.password) { err.password = '请输入密码'; return }
  loading.value = true
  try {
    const r = await api.account.login(n, f.value.password)
    adoptSession(r.userId, r.token)
    emit('auth', { userId: r.userId, token: r.token })
    visible.value = false
    ElMessage.success(`登录成功，欢迎回来，${r.userId}！`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function doRegister() {
  clearErr()
  const n = validateNickname()
  if (!n) return
  if (!f.value.password || f.value.password.length < 6) { err.password = '密码至少 6 位'; return }
  if (f.value.password !== f.value.passwordConfirm) { err.passwordConfirm = '两次密码不一致'; return }
  loading.value = true
  try {
    const r = await api.account.register(n, f.value.password, f.value.passwordConfirm, getClientId())
    pending.value = { userId: r.userId, backup: r.backup, token: r.token }
    mode.value = 'backup'
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function confirmBackup() {
  adoptSession(pending.value.userId, pending.value.token)
  emit('auth', { userId: pending.value.userId, token: pending.value.token })
  visible.value = false
  ElMessage.success('注册成功，欢迎加入！')
}

async function doRecover() {
  clearErr()
  const n = f.value.nickname.trim()
  if (!n) { err.nickname = '请输入昵称'; return }
  if (!f.value.backupCode.trim()) { err.backupCode = '请输入备份码'; return }
  if (!f.value.newPassword || f.value.newPassword.length < 6) { err.newPassword = '新密码至少 6 位'; return }
  if (f.value.newPassword !== f.value.passwordConfirm) { err.passwordConfirm = '两次密码不一致'; return }
  loading.value = true
  try {
    const r = await api.account.recover(n, f.value.backupCode, f.value.newPassword, f.value.passwordConfirm)
    adoptSession(r.userId, r.token)
    emit('auth', { userId: r.userId, token: r.token })
    visible.value = false
    ElMessage.success('密码已重设，已自动登录')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function doChangePassword() {
  clearErr()
  const token = getToken()
  if (!token) { err.oldPassword = '请先登录后再修改密码'; return }
  if (!f.value.oldPassword) { err.oldPassword = '请输入原密码'; return }
  if (!f.value.newPassword || f.value.newPassword.length < 6) { err.newPassword = '新密码至少 6 位'; return }
  if (f.value.newPassword !== f.value.passwordConfirm) { err.passwordConfirm = '两次密码不一致'; return }
  loading.value = true
  try {
    const r = await api.account.changePassword(token, f.value.oldPassword, f.value.newPassword, f.value.passwordConfirm)
    adoptSession(getUserId(), r.token)
    visible.value = false
    ElMessage.success('密码已修改')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.tip {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  line-height: var(--lh-body);
  margin-bottom: var(--sp-3);
}
.am-form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.actions {
  margin-top: var(--sp-4);
}
.links {
  margin-top: var(--sp-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.muted-link {
  color: var(--text-muted);
}
.backup-box {
  text-align: center;
}
.backup-code {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: var(--fw-medium);
  letter-spacing: 3px;
  color: var(--primary-text-strong);
  background: var(--primary-soft-2);
  border-radius: var(--radius-md);
  padding: var(--sp-3);
  margin: var(--sp-4) 0;
  word-break: break-all;
}
.warn {
  font-size: var(--fs-body-2);
  color: var(--warning);
  line-height: var(--lh-body);
  text-align: left;
}
</style>
