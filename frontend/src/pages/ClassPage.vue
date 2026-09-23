<template>
  <div class="zy-page">
    <div class="zy-container clsp">
      <header class="clsp__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">班级</h1>
        <p class="t-body-2">老师建班布置作业，学生拍照提交，AI 帮老师一键批改并生成班级报告。</p>
      </header>

      <!-- 未登录 -->
      <UiEmptyState
        v-if="ready && !loggedIn"
        title="先登录再用班级功能"
        description="班级、作业与批改记录都跟账号走。"
      >
        <UiButton variant="primary" @click="openAuth('login')">去登录</UiButton>
      </UiEmptyState>

      <template v-else-if="ready">
        <!-- 未认证的老师入口提示 / 认证卡 -->
        <section v-if="!teacher || !teacher.is_teacher" class="clsp__cert surface-standard">
          <div class="clsp__cert-main">
            <span class="clsp__cert-title">教师认证</span>
            <span class="t-body-2">认证后可以创建班级、布置作业、用 AI 批改全班作业。</span>
          </div>
          <UiButton variant="primary" size="sm" @click="applyOpen = true">去认证</UiButton>
        </section>

        <section class="clsp__section">
          <div class="clsp__section-head">
            <h2 class="t-h3">我的班级</h2>
            <div class="clsp__section-ops">
              <UiButton variant="ghost" size="sm" @click="openJoin">加入班级</UiButton>
              <UiButton
                v-if="teacher && teacher.is_teacher"
                variant="primary"
                size="sm"
                @click="openCreate"
              >创建班级</UiButton>
            </div>
          </div>

          <div v-if="classes.length" class="clsp__list">
            <button
              v-for="c in classes"
              :key="c.id"
              type="button"
              class="clsp__item surface-standard"
              @click="openClass(c)"
            >
              <span class="clsp__item-main">
                <span class="clsp__item-title">{{ c.name }}</span>
                <span class="t-label">
                  {{ c.meta.subject || '未设科目' }}<template v-if="c.meta.grade"> · {{ c.meta.grade }}</template>
                  · {{ c.member_count }} 人
                </span>
              </span>
              <span class="clsp__item-side">
                <span v-if="c.is_teacher" class="clsp__badge">老师</span>
                <span class="clsp__arrow" aria-hidden="true">→</span>
              </span>
            </button>
          </div>

          <UiEmptyState
            v-else
            title="还没有加入任何班级"
            :description="teacher && teacher.is_teacher
              ? '创建一个班级，把班级码告诉学生即可加入。'
              : '向老师要 6 位班级码，输入即可加入。'"
          />
        </section>
      </template>

      <!-- 教师认证弹窗 -->
      <UiModal v-model="applyOpen" title="教师认证" size="sm">
        <p class="t-body-2 clsp__cert-tip">
          目前采用声明式认证：填写的信息会在班级内公示。请如实填写。
        </p>
        <label class="clsp__label" for="t-name">姓名</label>
        <input id="t-name" v-model="applyForm.name" class="clsp__input" type="text" placeholder="公示用，可填常用称呼" />
        <label class="clsp__label" for="t-school">学校</label>
        <input id="t-school" v-model="applyForm.school" class="clsp__input" type="text" placeholder="例如：某某大学" />
        <label class="clsp__label" for="t-subject">任教科目（选填）</label>
        <input id="t-subject" v-model="applyForm.subject" class="clsp__input" type="text" placeholder="例如：高等数学" />
        <UiButton variant="primary" block :loading="applyBusy" :disabled="!applyForm.name.trim() || !applyForm.school.trim()" @click="submitApply">
          完成认证
        </UiButton>
      </UiModal>

      <!-- 创建班级弹窗 -->
      <UiModal v-model="createOpen" title="创建班级" size="sm">
        <template v-if="!created">
          <label class="clsp__label" for="c-name">班级名称</label>
          <input id="c-name" v-model="createForm.name" class="clsp__input" type="text" placeholder="例如：高数（2）班" />
          <label class="clsp__label" for="c-subject">科目</label>
          <input id="c-subject" v-model="createForm.subject" class="clsp__input" type="text" placeholder="例如：高等数学" />
          <label class="clsp__label" for="c-grade">年级（选填）</label>
          <input id="c-grade" v-model="createForm.grade" class="clsp__input" type="text" placeholder="例如：大一" />
          <UiButton variant="primary" block :loading="createBusy" :disabled="!createForm.name.trim()" @click="submitCreate">
            创建班级
          </UiButton>
        </template>
        <template v-else>
          <p class="t-body-2">班级已创建。把下面的班级码告诉学生，他们输入即可加入：</p>
          <p class="clsp__code">{{ created.invite_code }}</p>
          <p class="t-label">也可以在班级详情页随时查看班级码。</p>
          <UiButton variant="primary" block @click="finishCreate">进入班级</UiButton>
        </template>
      </UiModal>

      <!-- 加入班级弹窗 -->
      <UiModal v-model="joinOpen" title="加入班级" size="sm">
        <label class="clsp__label" for="j-code">班级码</label>
        <input id="j-code" v-model="joinCode" class="clsp__input clsp__input--code" type="text" maxlength="6" placeholder="6 位班级码" />
        <UiButton variant="primary" block :loading="joinBusy" :disabled="joinCode.trim().length < 4" @click="submitJoin">
          加入
        </UiButton>
      </UiModal>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { recordAction } from '../statsStore'
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiModal from '../ui/UiModal.vue'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { goBackSmart } from '../lib/nav.js'
import { ROUTES, path } from '../lib/routes.js'
import { api } from '../api.js'
import { getToken } from '../auth.js'
import { session } from '../stores/sessionStore.js'
import { openAuth } from '../stores/uiStore.js'

const router = useRouter()
const loggedIn = computed(() => session.space === 'account' && !!session.token)

const ready = ref(false)
const teacher = ref(null)
const classes = ref([])

const applyOpen = ref(false)
const applyBusy = ref(false)
const applyForm = reactive({ name: '', school: '', subject: '' })

const createOpen = ref(false)
const createBusy = ref(false)
const createForm = reactive({ name: '', subject: '', grade: '' })
const created = ref(null)

const joinOpen = ref(false)
const joinBusy = ref(false)
const joinCode = ref('')

onMounted(load)

async function load() {
  if (!loggedIn.value) {
    ready.value = true
    return
  }
  const token = getToken()
  try {
    const [t, list] = await Promise.all([api.cls.teacherMe(token), api.cls.myClasses(token)])
    teacher.value = t
    classes.value = list
  } catch (e) {
    toast.error('班级数据加载失败，请下拉重试')
  }
  ready.value = true
}

function requireLogin() {
  if (!loggedIn.value) {
    openAuth('login')
    toast.info('登录后才能操作')
    return false
  }
  return true
}

async function submitApply() {
  if (applyBusy.value) return
  applyBusy.value = true
  try {
    const r = await api.cls.teacherApply(getToken(), applyForm.name, applyForm.school, applyForm.subject)
    if (r.ok) {
      teacher.value = r.teacher
      applyOpen.value = false
      toast.success('认证完成，可以创建班级了')
    } else {
      toast.error(r.error || '认证失败')
    }
  } catch {
    toast.error('网络异常，请重试')
  }
  applyBusy.value = false
}

function openCreate() {
  if (!requireLogin()) return
  created.value = null
  createForm.name = ''
  createForm.subject = ''
  createForm.grade = ''
  createOpen.value = true
}

async function submitCreate() {
  if (createBusy.value) return
  createBusy.value = true
  try {
    const g = await api.cls.createClass(getToken(), createForm.name, createForm.subject, createForm.grade)
    created.value = g
  } catch (e) {
    toastError(e, '创建失败，请重试')
  }
  createBusy.value = false
}

function finishCreate() {
  createOpen.value = false
  openClass(created.value)
  load()
}

function openJoin() {
  if (!requireLogin()) return
  joinCode.value = ''
  joinOpen.value = true
}

async function submitJoin() {
  if (joinBusy.value) return
  joinBusy.value = true
  try {
    const r = await api.cls.joinClass(getToken(), joinCode.value.trim().toUpperCase())
    if (r.ok) {
      joinOpen.value = false
      toast.success('已加入班级')
      try {
        recordAction('cls', { title: String(r.class?.name || '加入班级').slice(0, 40), brief: '加入班级' })
      } catch {
        /* 埋点失败不影响加入 */
      }
      openClass(r.class)
      load()
    } else {
      toast.error(r.error || '加入失败')
    }
  } catch (e) {
    toastError(e, '加入失败，请重试')
  }
  joinBusy.value = false
}

function openClass(c) {
  router.push(path(ROUTES.classDetail, { id: c.id }))
}
</script>

<style scoped>
.clsp {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: var(--col-main);
}
.clsp__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.clsp__cert {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4);
}
.clsp__cert-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.clsp__cert-title {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.clsp__section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.clsp__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.clsp__section-ops {
  display: flex;
  gap: var(--sp-2);
}
.clsp__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.clsp__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.clsp__item:hover {
  border-color: var(--primary-line);
}
.clsp__item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.clsp__item-title {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
.clsp__item-side {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 0 0 auto;
}
.clsp__badge {
  font-size: var(--fs-label);
  color: var(--primary-text);
  background: var(--primary-soft);
  border-radius: var(--radius-pill);
  padding: 2px 10px;
}
.clsp__arrow {
  color: var(--text-disabled);
}
.clsp__cert-tip {
  margin-bottom: var(--sp-2);
}
.clsp__label {
  display: block;
  font-size: var(--fs-label);
  color: var(--text-muted);
  margin: var(--sp-2) 0 4px;
}
.clsp__input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  background: var(--surface-unit);
}
.clsp__input--code {
  text-transform: uppercase;
  letter-spacing: 4px;
  font-size: var(--fs-h3);
  text-align: center;
}
.clsp__code {
  text-align: center;
  font-size: 28px;
  letter-spacing: 8px;
  color: var(--primary-text);
  margin: var(--sp-3) 0;
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .clsp {
    max-width: none;
  }
}
</style>
