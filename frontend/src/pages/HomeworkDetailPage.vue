<template>
  <div class="zy-page">
    <div class="zy-container hwd">
      <header class="hwd__head">
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBack">← 返回班级</UiButton>
        <h1 class="t-h1">{{ hw?.title || '作业' }}</h1>
        <p v-if="hw" class="t-label">
          {{ isTeacher ? '老师视角' : '学生视角' }}
          <template v-if="hw.due_at"> · 截止 {{ fmtDate(hw.due_at) }}</template>
          <template v-if="overdue && !isTeacher"> · 已过截止</template>
        </p>
      </header>

      <UiErrorState v-if="loadError" :description="loadError" @retry="load" />

      <template v-else-if="hw">
        <!-- 作业内容 -->
        <section class="hwd__card surface-standard">
          <h2 class="t-h3">作业内容</h2>
          <p v-if="hw.content" class="hwd__content hwd__pre"><MathText :content="hw.content" /></p>
          <p v-if="!hw.content && hwImages.length" class="t-body-2 hwd__img-hint">本次作业以图片题目为准，点击可放大查看。</p>
          <div v-if="hwImages.length" class="hwd__imgs">
            <img
              v-for="(im, i) in hwImages"
              :key="i"
              :src="im"
              class="hwd__img-thumb"
              alt="作业题目图片"
              @click="openHwImg(i)"
            />
          </div>
          <template v-if="isTeacher && hw.reference">
            <h3 class="t-h3 hwd__ref-title">参考答案 / 评分要点</h3>
            <p class="hwd__content hwd__content--ref hwd__pre"><MathText :content="hw.reference" /></p>
          </template>
        </section>

        <!-- ============ 学生：提交 + 查看批改 ============ -->
        <template v-if="!isTeacher">
          <section class="hwd__card surface-standard">
            <h2 class="t-h3">我的作业</h2>

            <template v-if="!hw.my_submission">
              <p v-if="overdue" class="t-body-2 hwd__warn">已过截止时间，无法提交；联系老师说明情况。</p>
              <template v-else>
                <p class="t-body-2">把写好的作业拍照提交（可多张，最多 9 张），也可以直接在下方输入文字作答。</p>
                <div class="hwd__imgs hwd__imgs--edit">
                  <div v-for="(im, i) in myImages" :key="i" class="hwd__imgwrap">
                    <img :src="im" class="hwd__img-thumb" alt="作业图预览" @click="previewMine(i)" />
                    <button type="button" class="hwd__img-del" aria-label="移除这张图" @click="myImages.splice(i, 1)">×</button>
                  </div>
                  <label v-if="myImages.length < 9" class="hwd__img-add">
                    <input type="file" accept="image/*" capture="environment" multiple class="hwd__file" @change="onPick" />
                    ＋ 拍照 / 选图
                  </label>
                </div>
                <textarea
                  v-model="note"
                  class="hwd__input hwd__textarea"
                  rows="2"
                  maxlength="500"
                  placeholder="文字说明（选填），例如：第 3 题没写完"
                />
                <UiButton variant="primary" block :loading="submitting" :disabled="!myImages.length && !note.trim()" @click="submit">
                  提交作业
                </UiButton>
              </template>
            </template>

            <template v-else>
              <div class="hwd__mine">
                <span class="t-label">已提交 {{ fmtDate(hw.my_submission.updated_at) }}</span>
                <span v-if="hw.my_submission.graded_at" class="hwd__score">{{ hw.my_submission.score }}<i>/100</i></span>
                <span v-else class="clsd__badge hwd__pending">待批改</span>
              </div>
              <p v-if="hw.my_submission.note" class="t-body-2">附言：{{ hw.my_submission.note }}</p>

              <div v-if="hw.my_submission.feedback" class="hwd__feedback">
                <p class="hwd__overall"><MathText :content="hw.my_submission.feedback.overall || ''" /></p>
                <div
                  v-for="(it, i) in hw.my_submission.feedback.items || []"
                  :key="i"
                  class="hwd__fb-item"
                >
                  <span class="hwd__fb-q"><MathText :content="it.question || ''" /></span>
                  <span class="hwd__fb-verdict" :class="`hwd__fb-verdict--${it.verdict}`">{{ it.verdict }}</span>
                  <span class="hwd__fb-comment">{{ it.comment }}</span>
                </div>
              </div>

              <template v-if="!overdue">
                <p class="t-body-2 hwd__img-hint">重新提交会覆盖上一版（含全部图片），批改结果也会重置。</p>
                <div class="hwd__imgs hwd__imgs--edit">
                  <div v-for="(im, i) in myImages" :key="i" class="hwd__imgwrap">
                    <img :src="im" class="hwd__img-thumb" alt="新作业图片预览" @click="previewMine(i)" />
                    <button type="button" class="hwd__img-del" aria-label="移除这张图" @click="myImages.splice(i, 1)">×</button>
                  </div>
                  <label v-if="myImages.length < 9" class="hwd__img-add">
                    <input type="file" accept="image/*" capture="environment" multiple class="hwd__file" @change="onPick" />
                    ＋ 拍照 / 选图
                  </label>
                </div>
                <textarea
                  v-model="note"
                  class="hwd__input hwd__textarea"
                  rows="2"
                  maxlength="500"
                  placeholder="文字说明（选填）"
                />
                <UiButton v-if="myImages.length || note.trim()" variant="primary" block :loading="submitting" @click="submit">
                  重新提交
                </UiButton>
              </template>
            </template>
          </section>
        </template>

        <!-- ============ 老师：批改 + 报告 ============ -->
        <template v-else>
          <section class="hwd__card surface-standard">
            <div class="hwd__toolbar">
              <h2 class="t-h3">提交情况 · 已交 {{ submissions.length }}/{{ students.length }}</h2>
              <div class="hwd__toolbar-ops">
                <UiButton
                  variant="primary"
                  size="sm"
                  :loading="gradingAll"
                  :disabled="!pendingCount || grading"
                  @click="gradeAll"
                >AI 一键批改{{ pendingCount ? `（${pendingCount} 份待批）` : '' }}</UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  :loading="reportBusy"
                  :disabled="!gradedCount || grading"
                  @click="makeReport"
                >生成班级报告</UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  :loading="exporting"
                  :disabled="!students.length || grading"
                  @click="exportScores"
                >导出成绩表</UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  :disabled="!gradedCount || grading"
                  @click="printReport"
                >打印报告</UiButton>
              </div>
            </div>
            <p v-if="grading" class="t-label hwd__progress">{{ gradingTip }}</p>

            <div v-if="students.length" class="hwd__stu-list">
              <div v-for="st in studentRows" :key="st.user_id" class="hwd__stu surface-standard">
                <div class="hwd__stu-main">
                  <span class="hwd__stu-name">{{ st.user_id }}</span>
                  <span class="t-label">
                    {{ st.sub ? (st.sub.graded_at ? `已批 · ${st.sub.score} 分` : '已交，待批改') : '未提交' }}
                  </span>
                </div>
                <div class="hwd__stu-ops">
                  <template v-if="st.sub">
                    <UiButton variant="ghost" size="sm" @click="viewImage(st)">看图</UiButton>
                    <UiButton
                      variant="primary"
                      size="sm"
                      :loading="gradingId === st.user_id"
                      :disabled="grading"
                      @click="gradeOne(st)"
                    >{{ st.sub.graded_at ? '重新批改' : 'AI 批改' }}</UiButton>
                    <UiButton
                      v-if="st.sub.graded_at"
                      variant="ghost"
                      size="sm"
                      @click="pushStudent(st)"
                    >发反馈到群</UiButton>
                  </template>
                </div>
                <div v-if="st.sub && st.sub.feedback" class="hwd__stu-fb">
                  <span class="hwd__fb-verdict" :class="verdictClass(st.sub.score)">{{ brief(st.sub) }}</span>
                  <span class="t-label">{{ latexToPlain(st.sub.feedback.overall || '').replace(/\s+/g, ' ').trim().slice(0, 80) }}</span>
                </div>
              </div>
            </div>
            <UiEmptyState v-else title="还没有学生加入班级" description="把班级码发给学生，等他们加入后再收作业。" />
          </section>

          <section v-if="report" class="hwd__card surface-standard">
            <div class="hwd__toolbar">
              <h2 class="t-h3">班级报告</h2>
              <UiButton variant="ghost" size="sm" @click="pushReport">发到班级群</UiButton>
            </div>
            <div class="hwd__stats">
              <div class="hwd__stat"><b>{{ report.stats.submitted }}</b><span>/{{ report.stats.total }} 实交</span></div>
              <div class="hwd__stat"><b>{{ report.stats.avg }}</b><span>平均分</span></div>
              <div class="hwd__stat"><b>{{ report.stats.max }}</b><span>最高</span></div>
              <div class="hwd__stat"><b>{{ report.stats.min }}</b><span>最低</span></div>
            </div>
            <div v-for="(b, i) in report.stats.buckets || []" :key="i" class="hwd__bucket">
              <span class="t-label hwd__bucket-range">{{ b.range }}</span>
              <div class="hwd__bucket-bar"><i :style="{ width: bucketWidth(b.count) }" /></div>
              <span class="t-label">{{ b.count }} 人</span>
            </div>
            <div v-if="report.common_issues?.length" class="hwd__section">
              <h3 class="t-h3">共性错误</h3>
              <div v-for="(it, i) in report.common_issues" :key="i" class="hwd__issue">
                <b>{{ it.point }}</b><span class="t-label"> ×{{ it.count }}</span>
                <p class="t-body-2">{{ it.detail }}</p>
              </div>
            </div>
            <div v-if="report.teaching_advice?.length" class="hwd__section">
              <h3 class="t-h3">教学建议</h3>
              <p v-for="(a, i) in report.teaching_advice" :key="i" class="t-body-2">· {{ a }}</p>
            </div>
            <p v-if="report.excellent?.length" class="t-body-2">表现优秀：{{ report.excellent.join('、') }}</p>
          </section>
        </template>
      </template>

      <!-- 看图弹窗（学生多张答卷纵向列出） -->
      <UiModal v-model="imgOpen" :title="imgUser ? `${imgUser} 的作业${imgList.length > 1 ? `（${imgList.length} 张）` : ''}` : '作业图片'" size="lg">
        <template v-if="imgList.length">
          <img v-for="(im, i) in imgList" :key="i" :src="im" class="hwd__full-img hwd__full-img--stack" alt="学生作业原图" />
        </template>
        <p v-else class="t-body-2">加载中…</p>
      </UiModal>

      <!-- 作业题目大图 -->
      <UiModal v-model="hwImgOpen" :title="`作业题目图片 ${hwImgIdx + 1}/${hwImages.length}`" size="lg">
        <img v-if="hwImages.length" :src="hwImages[hwImgIdx]" class="hwd__full-img" alt="作业题目大图" />
      </UiModal>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiErrorState from '../ui/UiErrorState.vue'
import UiModal from '../ui/UiModal.vue'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'
import { ROUTES, path } from '../lib/routes.js'
import MathText from '../components/MathText.vue'
import { recordAction } from '../statsStore'
import { printHtml } from '../lib/print.js'
import { latexToPlain } from '../mathtext'
import { api } from '../api.js'
import { getToken } from '../auth.js'
import { readImageDataUrl, shrinkIfNeeded } from '../lib/imageFile.js'

const route = useRoute()
const router = useRouter()

const hw = ref(null)
const isTeacher = ref(false)
const students = ref([])
const submissions = ref([])
const report = ref(null)
const loadError = ref('')

const hwImages = ref([])
const hwImgOpen = ref(false)
const hwImgIdx = ref(0)

function openHwImg(i) {
  hwImgIdx.value = i
  hwImgOpen.value = true
}

const myImages = ref([])
const note = ref('')
const submitting = ref(false)

const grading = ref(false)
const gradingAll = ref(false)
const gradingId = ref('')
const gradingTip = ref('')

const reportBusy = ref(false)
const imgOpen = ref(false)
const imgList = ref([])
const imgUser = ref('')

const overdue = computed(() => !!hw.value?.due_at && Date.now() > Number(hw.value.due_at))
const gradedCount = computed(() => submissions.value.filter((s) => s.graded_at > 0).length)
const pendingCount = computed(() => submissions.value.filter((s) => s.graded_at <= 0).length)

const studentRows = computed(() => {
  const byUser = new Map(submissions.value.map((s) => [s.user_id, s]))
  return students.value.map((st) => ({ ...st, sub: byUser.get(st.user_id) || null }))
})

onMounted(async () => {
  await load()
  // 若上次离开页面时批改还没跑完，回来继续显示进度
  await resumeGradeTask()
})
onBeforeUnmount(() => stopGradePolling())

async function load() {
  loadError.value = ''
  try {
    const r = await api.cls.homeworkDetail(getToken(), String(route.params.hid || ''))
    if (!r.ok) {
      loadError.value = r.error || '作业不存在'
      return
    }
    hw.value = r.homework
    isTeacher.value = r.is_teacher
    students.value = r.homework.students || []
    submissions.value = r.homework.submissions || []
    report.value = r.homework.report || null
    if ((r.homework.images_count || 0) > 0) {
      api.cls.assignImages(getToken(), String(route.params.hid || ''))
        .then((imgs) => { hwImages.value = imgs })
        .catch(() => { hwImages.value = [] })
    }
  } catch (e) {
    loadError.value = e.message || '加载失败'
  }
}

function goBack() {
  router.push(path(ROUTES.classDetail, { id: String(route.params.id || '') }))
}

async function onPick(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length) return
  const room = 9 - myImages.value.length
  if (room <= 0) {
    toast.error('作业图片最多 9 张')
    return
  }
  if (files.length > room) toast.error(`最多再选 ${room} 张，已自动截取`)
  for (const file of files.slice(0, room)) {
    const r = await readImageDataUrl(file, { onError: (m) => toast.error(m) })
    if (r) myImages.value.push(await shrinkIfNeeded(r.dataUrl))
  }
}

function previewMine(i) {
  imgUser.value = ''
  imgList.value = myImages.value.slice()
  imgOpen.value = true
  void i
}

async function submit() {
  if (submitting.value || (!myImages.value.length && !note.value.trim())) return
  submitting.value = true
  try {
    await api.cls.submit(getToken(), String(route.params.hid || ''), myImages.value[0] || '', note.value, [...myImages.value])
    toast.success('已提交，等老师批改')
    try {
      recordAction('hw', { title: String(hw.value?.title || '提交作业').slice(0, 40), brief: `提交 ${myImages.value.length} 张` })
    } catch {
      /* 埋点失败不影响提交 */
    }
    myImages.value = []
    note.value = ''
    await load()
  } catch (e) {
    toastError(e, '提交失败，请重试')
  }
  submitting.value = false
}

async function gradeOne(st) {
  if (grading.value) return
  grading.value = true
  gradingId.value = st.user_id
  gradingTip.value = `正在批改 ${st.user_id} 的作业…`
  try {
    const sub = await api.cls.grade(getToken(), String(route.params.hid || ''), st.user_id)
    const idx = submissions.value.findIndex((s) => s.user_id === st.user_id)
    if (idx >= 0) submissions.value.splice(idx, 1, sub)
    else submissions.value.push(sub)
    toast.success(`${st.user_id} 批改完成：${sub.score} 分`)
  } catch (e) {
    toastError(e, '批改失败，可重试这一份')
  }
  grading.value = false
  gradingId.value = ''
}

/**
 * 批改并发度。
 * 单份实测约 10s（多图或长作答更久），串行时 10 份要等 ~100s；
 * 并发 3 可压到 ~35s。再往上会撞模型侧限流（429），所以固定 3，不做成可调项。
 */
/** 批改任务轮询句柄（离开页面时清掉，回来再接上） */
let gradeTimer = null
const gradeTask = ref(null)

const hid = () => String(route.params.hid || '')

function fmtDur(secs) {
  const s = Math.max(0, Math.round(secs))
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`
}

/** 进度文案：已完成 x/N · 已用 xs · 预计还需（按已完成份数的平均耗时推算） */
function renderGradeTip() {
  const t = gradeTask.value
  if (!t) return
  const elapsed = Math.max(1, Math.round((Date.now() - t.started_at) / 1000))
  const handled = t.done + t.failed.length
  const remain = Math.max(0, t.total - handled)
  let eta = ''
  if (handled > 0 && remain > 0) {
    // 平均每份耗时 × 剩余份数，向上取到 5 秒，避免数字跳动太频繁
    const per = elapsed / handled
    eta = ` · 预计还需约 ${fmtDur(Math.max(5, Math.ceil((per * remain) / 5) * 5))}`
  }
  gradingTip.value = `批改中 ${handled}/${t.total} · 已用 ${fmtDur(elapsed)}${eta}` +
    (t.failed.length ? ` · ${t.failed.length} 份失败` : '')
}

function stopGradePolling() {
  if (gradeTimer) {
    clearInterval(gradeTimer)
    gradeTimer = null
  }
}

/** 轮询任务状态：完成后刷新列表并提示（失败名单可单独重试） */
function startGradePolling() {
  stopGradePolling()
  gradeTimer = setInterval(async () => {
    try {
      const r = await api.cls.gradeStatus(getToken(), hid())
      gradeTask.value = r.task
      if (!r.task) {
        stopGradePolling()
        return
      }
      renderGradeTip()
      if (r.task.finished) {
        stopGradePolling()
        grading.value = false
        gradingAll.value = false
        gradingTip.value = ''
        await load()
        const f = r.task.failed.length
        if (f) toast.info(`批改完成：${r.task.done} 份成功，${f} 份失败（可对失败的学生单独点「AI 批改」重试）`)
        else toast.success(`全部批改完成（${r.task.done} 份），可以生成班级报告了`)
      }
    } catch {
      /* 轮询期间网络抖动忽略，下一轮继续 */
    }
  }, 2000)
}

/** 一键批改：提交服务端任务后即可离开页面，进度由轮询更新 */
async function gradeAll() {
  if (gradingAll.value) return
  gradingAll.value = true
  grading.value = true
  try {
    const r = await api.cls.gradeStart(getToken(), hid())
    gradeTask.value = r.task
    renderGradeTip()
    startGradePolling()
  } catch (e) {
    grading.value = false
    gradingAll.value = false
    toastError(e, '启动批改失败')
  }
}

/** 进入页面时接上还没跑完的任务（关过页面也能继续看进度） */
async function resumeGradeTask() {
  try {
    const r = await api.cls.gradeStatus(getToken(), hid())
    if (r.task && !r.task.finished) {
      gradeTask.value = r.task
      grading.value = true
      gradingAll.value = true
      renderGradeTip()
      startGradePolling()
    }
  } catch {
    /* 首次进入失败不打扰用户 */
  }
}

async function makeReport() {
  if (reportBusy.value) return
  reportBusy.value = true
  try {
    report.value = await api.cls.report(getToken(), String(route.params.hid || ''))
    toast.success('班级报告已生成')
  } catch (e) {
    toastError(e, '报告生成失败')
  }
  reportBusy.value = false
}

async function pushReport() {
  try {
    const r = await api.cls.push(getToken(), String(route.params.hid || ''), 'report')
    if (r.ok) toast.success('报告已发到班级群')
    else toast.error(r.error || '发送失败')
  } catch (e) {
    toastError(e, '发送失败')
  }
}

async function pushStudent(st) {
  try {
    const r = await api.cls.push(getToken(), String(route.params.hid || ''), 'student', st.user_id)
    if (r.ok) toast.success(`${st.user_id} 的反馈已发到班级群`)
    else toast.error(r.error || '发送失败')
  } catch (e) {
    toastError(e, '发送失败')
  }
}

async function viewImage(st) {
  imgUser.value = st.user_id
  imgList.value = []
  imgOpen.value = true
  try {
    imgList.value = await api.cls.submissionImages(getToken(), String(route.params.hid || ''), st.user_id)
  } catch {
    toast.error('图片加载失败')
  }
}

function brief(sub) {
  const s = Number(sub.score)
  if (s >= 85) return '优秀'
  if (s >= 70) return '良好'
  if (s >= 60) return '及格'
  return '需加强'
}

function verdictClass(score) {
  const s = Number(score)
  if (s >= 85) return 'hwd__fb-verdict--正确'
  if (s >= 60) return 'hwd__fb-verdict--部分正确'
  return 'hwd__fb-verdict--错误'
}

function bucketWidth(count) {
  const total = report.value?.stats?.submitted || 1
  return `${Math.round((count / total) * 100)}%`
}

function fmtDate(ts) {
  const d = new Date(Number(ts))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.hwd {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.hwd__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.hwd__card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}
.hwd__content {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.hwd__content--ref {
  color: var(--text-muted);
}
.hwd__ref-title {
  margin-top: var(--sp-2);
}
.hwd__warn {
  color: var(--danger-text, #c0392b);
}
.hwd__upload {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.hwd__upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease);
}
.hwd__upload-btn:hover {
  border-color: var(--primary-line);
}
.hwd__file {
  display: none;
}
.hwd__preview {
  max-width: 280px;
  max-height: 280px;
  object-fit: contain;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: #fff;
}
.hwd__textarea {
  resize: vertical;
}
.hwd__input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  background: var(--surface-unit);
}
.hwd__mine {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.hwd__score {
  font-size: var(--fs-h1);
  color: var(--primary-text);
}
.hwd__score i {
  font-size: var(--fs-label);
  font-style: normal;
  color: var(--text-muted);
}
.hwd__pending {
  align-self: center;
}
.hwd__feedback {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.hwd__overall {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-primary);
  margin: 0;
}
.hwd__fb-item {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.hwd__fb-q {
  font-size: var(--fs-body);
  color: var(--text-primary);
  font-weight: 600;
}
.hwd__fb-verdict {
  font-size: var(--fs-label);
  border-radius: var(--radius-pill);
  padding: 1px 8px;
}
.hwd__fb-verdict--正确 {
  color: #2e7a4f;
  background: rgba(46, 122, 79, 0.12);
}
.hwd__fb-verdict--部分正确 {
  color: #b5722a;
  background: rgba(181, 114, 42, 0.12);
}
.hwd__fb-verdict--错误,
.hwd__fb-verdict--未作答 {
  color: #c0392b;
  background: rgba(192, 57, 43, 0.12);
}
.hwd__fb-comment {
  font-size: var(--fs-body-2);
  color: var(--text-muted);
  flex: 1;
  min-width: 160px;
}
.hwd__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.hwd__toolbar-ops {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.hwd__progress {
  color: var(--primary-text);
}
.hwd__stu-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.hwd__stu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px var(--sp-3);
}
.hwd__stu-main {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}
.hwd__stu-name {
  font-size: var(--fs-body);
  color: var(--text-primary);
  font-weight: 600;
}
.hwd__stu-ops {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.hwd__stu-fb {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.hwd__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-2);
  text-align: center;
}
.hwd__stat b {
  display: block;
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.hwd__stat span {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.hwd__bucket {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.hwd__bucket-range {
  flex: 0 0 52px;
}
.hwd__bucket-bar {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.hwd__bucket-bar i {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-pill);
}
.hwd__section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.hwd__issue b {
  font-size: var(--fs-body);
  color: var(--text-primary);
}
.hwd__issue p {
  margin: 2px 0 0;
}
.hwd__full-img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  background: #fff;
  border-radius: var(--radius-md);
}
.hwd__img-hint {
  color: var(--text-tertiary);
}
.hwd__full-img--stack {
  display: block;
  margin-bottom: var(--sp-3);
}
.hwd__imgs--edit {
  margin: var(--sp-2) 0 var(--sp-3);
}
.hwd__imgwrap {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: var(--border-subtle);
}
.hwd__imgwrap .hwd__img-thumb {
  aspect-ratio: auto;
  height: 100%;
  border: 0;
}
.hwd__img-del {
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
.hwd__img-add {
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
.hwd__file {
  display: none;
}
.hwd__imgs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.hwd__img-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  cursor: zoom-in;
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .hwd {
    max-width: none;
  }
}
</style>
