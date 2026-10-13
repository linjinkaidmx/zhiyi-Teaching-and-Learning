<template>
  <el-dialog v-model="visible" title="账号" width="400px" :close-on-click-modal="false">
    <!-- 登录 -->
    <template v-if="mode === 'login'">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="2-20 个字符" maxlength="20" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="6-64 位" />
        </el-form-item>
      </el-form>
      <div class="form-links">
        <el-button text size="small" @click="mode = 'recover'">忘记密码？</el-button>
        <el-button text size="small" @click="mode = 'register'">没有账号？去注册</el-button>
      </div>
    </template>

    <!-- 注册 -->
    <template v-else-if="mode === 'register'">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="昵称（即登录账号，注册后不可改）">
          <el-input v-model="form.nickname" placeholder="2-20 个字符" maxlength="20" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="6-64 位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.passwordConfirm" type="password" show-password />
        </el-form-item>
      </el-form>
      <div class="form-links">
        <el-button text size="small" @click="mode = 'login'">已有账号？去登录</el-button>
      </div>
    </template>

    <!-- 找回密码 -->
    <template v-else-if="mode === 'recover'">
      <el-alert type="info" :closable="false" show-icon
        title="使用注册时保存的 8 位备份码重置密码" class="gap-bottom" />
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" maxlength="20" />
        </el-form-item>
        <el-form-item label="备份码">
          <el-input v-model="form.backupCode" placeholder="形如 A3F9-C2D1" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <div class="form-links">
        <el-button text size="small" @click="mode = 'login'">返回登录</el-button>
      </div>
    </template>

    <!-- 注册成功：展示一次性备份码 -->
    <template v-else>
      <el-alert type="warning" :closable="false" show-icon class="gap-bottom"
        title="请立即保存备份码（仅显示这一次）"
        description="这是找回密码的唯一凭证，退出本页后将无法再查看。" />
      <div class="backup-code">{{ backupCode }}</div>
      <div class="backup-actions">
        <el-button type="primary" @click="copyBackup">复制备份码</el-button>
        <el-button @click="finishRegister">我已保存，开始使用</el-button>
      </div>
    </template>

    <template v-if="mode !== 'done'">
      <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
        {{ mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { accountApi } from '../api/auth'
import { loginAs } from '../store/user'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible', 'logged-in'])

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const mode = ref('login') // login | register | recover | done
const loading = ref(false)
const backupCode = ref('')
const form = reactive({
  nickname: '',
  password: '',
  passwordConfirm: '',
  backupCode: '',
  newPassword: '',
})

watch(visible, (v) => {
  if (v && mode.value === 'done') mode.value = 'login'
})

async function submit() {
  loading.value = true
  try {
    if (mode.value === 'login') {
      if (!form.nickname.trim() || !form.password) return void ElMessage.warning('请填写昵称和密码')
      const res = await accountApi.login({ nickname: form.nickname.trim(), password: form.password })
      await loginAs(res.token, res.nickname, res.userId)
      visible.value = false
      emit('logged-in')
      ElMessage.success(`欢迎回来，${res.nickname}`)
    } else if (mode.value === 'register') {
      if (!form.nickname.trim() || !form.password) return void ElMessage.warning('请填写昵称和密码')
      const res = await accountApi.register({
        nickname: form.nickname.trim(),
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      })
      backupCode.value = res.backupCode
      mode.value = 'done'
      // 注册即登录
      await loginAs(res.token, res.nickname, res.userId)
      emit('logged-in')
    } else if (mode.value === 'recover') {
      if (!form.nickname.trim() || !form.backupCode.trim()) {
        return void ElMessage.warning('请填写昵称和备份码')
      }
      const res = await accountApi.recover({
        nickname: form.nickname.trim(),
        backupCode: form.backupCode.trim(),
        newPassword: form.newPassword,
      })
      await loginAs(res.token, res.nickname, res.userId)
      visible.value = false
      emit('logged-in')
      ElMessage.success('密码已重置并自动登录')
    }
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    loading.value = false
  }
}

async function copyBackup() {
  try {
    await navigator.clipboard.writeText(backupCode.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.info('复制失败，请手动记录')
  }
}

function finishRegister() {
  visible.value = false
  mode.value = 'login'
  ElMessage.success(`欢迎加入，${form.nickname}`)
}
</script>

<style scoped>
.form-links {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
}
.submit-btn {
  width: 100%;
  margin-top: 10px;
}
.backup-code {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 4px;
  text-align: center;
  padding: 18px 0;
  font-family: var(--el-font-family, monospace);
  color: var(--el-color-primary);
}
.backup-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.gap-bottom {
  margin-bottom: 14px;
}
</style>
