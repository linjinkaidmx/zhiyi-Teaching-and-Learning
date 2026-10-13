<template>
  <div class="zy-container zy-page capture">
    <!-- 上传态 -->
    <template v-if="stage === 'upload'">
      <div class="capture__layout">
      <div class="capture__col">
      <header class="capture__head">
        <h1 class="t-h1">AI 拍题</h1>
        <p class="t-body-2">拍照、传图、粘贴截图，或直接输入题目文字</p>
      </header>

      <div
        class="capture__drop surface-hero"
        :class="{ 'is-over': dragging }"
        role="button"
        tabindex="0"
        @click="pick('album')"
        @keydown.enter.prevent="pick('album')"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <template v-if="!upload.file">
          <div class="capture__drop-inner">
            <div class="capture__channels">
              <button type="button" class="capture__channel capture__channel--camera" style="--c: #3D6FA8" @click.stop="pick('camera')">
                <span class="capture__channel-ico"><UiIcon name="camera" :size="20" /></span>
                <b>拍照解题</b><i>手机拍最方便</i>
              </button>
              <button type="button" class="capture__channel capture__channel--album" style="--c: #7C5CFF" @click.stop="pick('album')">
                <span class="capture__channel-ico"><UiIcon name="image" :size="20" /></span>
                <b>从相册选图</b><i>截图 / 试卷照片</i>
              </button>
              <button type="button" class="capture__channel capture__channel--drag" style="--c: #4A7A63" @click.stop="pick('album')">
                <span class="capture__channel-ico"><UiIcon name="drag" :size="20" /></span>
                <b>拖拽上传</b><i>拖到框里即可</i>
              </button>
              <button type="button" class="capture__channel capture__channel--text" style="--c: #B5722A" @click.stop="focusText">
                <span class="capture__channel-ico"><UiIcon name="clipboard" :size="20" /></span>
                <b>粘贴 / 文字</b><i>公式可直接输入</i>
              </button>
            </div>
            <p class="capture__hint">把题目图片拖到这里，或点击任意位置选择　·　<kbd>Ctrl</kbd> + <kbd>V</kbd> 直接粘贴截图</p>
          </div>
        </template>
        <div v-else class="capture__preview">
          <div
            ref="cropWrapRef"
            class="capture__crop"
            :class="{ 'is-selecting': !!cropSel }"
            @pointerdown="onCropDown"
            @pointermove="onCropMove"
            @pointerup="onCropUp"
            @pointercancel="onCropUp"
            @pointerleave="onCropLeave"
          >
            <img ref="cropImgRef" :src="upload.dataUrl" alt="题目图片" class="capture__crop-img" draggable="false" />
            <div v-if="cropSel" class="capture__crop-box" :style="cropBoxStyle" />
            <span v-if="!cropSel" class="capture__crop-hint">按住拖拽框选题目区域</span>
          </div>
          <div class="capture__file">
            <div class="capture__filename">{{ upload.file.name }}</div>
            <div class="capture__state">{{ cropSel ? '已框选，确认或取消' : '拖拽框选题区，确认后识别；或点「识别整图」' }}</div>
            <div class="capture__file-ops">
              <button type="button" class="capture__view" @click.stop="viewerOpen = true">
                <UiIcon name="image" :size="14" />查看大图
              </button>
              <button type="button" class="capture__remove" @click.stop="clearUpload">移除</button>
            </div>
          </div>
        </div>
      </div>

      <div class="capture__text capture__card-line surface-standard" :class="{ 'is-open': textOpen }">
        <button type="button" class="capture__text-toggle" @click="toggleText">
          <span class="capture__text-ico"><UiIcon name="clipboard" :size="15" /></span>
          <span class="capture__text-label">手动输入题目文字</span>
          <span class="capture__text-hint">支持 LaTeX 公式，识别后自动切题</span>
          <span class="capture__text-go">{{ textOpen ? '收起 ↑' : '展开 →' }}</span>
        </button>
        <textarea
          ref="textareaEl"
          v-model="upload.text"
          class="capture__textarea"
          rows="4"
          placeholder="也可以直接粘贴或输入题目文字（支持数学公式，识别后自动切题）"
        />
        <!-- 输入框里是 LaTeX 源码（可改），这里给出教材式排版的预览，避免「看到一堆 $ 和\frac」 -->
        <div v-if="hasTex" class="capture__preview-row">
          <span class="capture__preview-label">预览</span>
          <p class="capture__preview-tex"><MathText :content="upload.text" /></p>
        </div>
      </div>

      <div class="capture__actions">
        <template v-if="cropSel">
          <UiButton variant="primary" size="lg" @click="confirmCrop">确认识别此区域</UiButton>
          <UiButton variant="secondary" size="lg" @click="cancelCrop">取消</UiButton>
        </template>
        <template v-else>
          <UiButton variant="primary" size="lg" :disabled="!canSubmit" @click="submit">
            {{ upload.file ? '识别整图' : '开始识别' }}
          </UiButton>
        </template>
      </div>

      <!-- 新增：拍完之后会发生什么（四步流程，新手最关心的事） -->
      <section class="capture__tint-card capture__flow">
        <div class="capture__block-head">
          <b>拍完之后会发生什么</b><span>四步到掌握</span>
        </div>
        <div class="capture__flow-steps">
          <div
            v-for="(st, i) in flowSteps"
            :key="st.title"
            class="capture__flow-step"
            :style="{ '--nc': st.color }"
          >
            <span class="capture__flow-no">{{ i + 1 }}</span>
            <span class="capture__flow-ico"><UiIcon :name="st.icon" :size="15" /></span>
            <b>{{ st.title }}</b>
            <span class="capture__flow-desc">{{ st.desc }}</span>
            <span v-if="i < flowSteps.length - 1" class="capture__flow-arrow">›</span>
          </div>
        </div>
      </section>

      <!-- 新增：示例题（内置题目，点一下填入输入框，不调模型） -->
      <section class="capture__tint-card capture__sample">
        <div class="capture__block-head">
          <b>没有题目在手？</b><span>点一道示例试试流程</span>
        </div>
        <div class="capture__sample-list">
          <button
            v-for="s in sampleQuestions"
            :key="s.label"
            type="button"
            class="capture__sample-chip"
            @click="useSample(s)"
          >
            <span class="capture__sample-ico">{{ s.glyph }}</span>
            <b>{{ s.label }}</b><i>{{ s.brief }}</i>
          </button>
        </div>
      </section>

      <input ref="albumInput" type="file" accept="image/*" class="sr-only" @change="onFile($event)" />
      <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="sr-only" @change="onFile($event)" />

      </div>

      <!-- 桌面端右栏：历史 + 使用提示（移动端由 CSS 隐藏，保持单列原样） -->
      <aside class="capture__aside">
      <!-- 最近拍过的题（原型 A2）：来自学习记录，「历史」入口的页内呈现 -->
      <!-- 最近拍过的题（原型 A2）：来自学习记录，「历史」入口的页内呈现 -->
      <section class="surface-standard capture__recent">
        <div class="capture__recent-head">
          <span class="capture__recent-title">最近拍过的题</span>
          <button v-if="recentQuestions.length" type="button" class="capture__recent-all" @click="$router.push(ROUTES.records)">全部 →</button>
        </div>
        <template v-if="recentQuestions.length">
          <div v-for="r in recentQuestions" :key="r.id" class="capture__recent-row">
            <span class="capture__recent-q">{{ r.title || r.brief || '题目讲解' }}</span>
            <span class="t-label">{{ timeAgo(r.createdAt) }}</span>
          </div>
        </template>
        <div v-else class="capture__recent-empty">
          <span class="capture__recent-empty-ico"><UiIcon name="schedule" :size="18" /></span>
          <p>还没有拍过题<br />拍完的题会按时间排在这里，一键重讲</p>
        </div>
      </section>

      <section class="capture__tips surface-standard">
        <div class="capture__recent-head">
          <span class="capture__recent-title">拍题小贴士</span>
        </div>
        <ul class="capture__tip-list">
          <li>一次一题最准；整页试卷可以先框选单题再识别。</li>
          <li>手写体、公式、代码都能识别，字迹压平、光线均匀会明显更准。</li>
          <li>识别结果可直接编辑，改完再讲解，省一次调用。</li>
          <li>Ctrl + V 直接粘贴截图；多张图会拆成多题逐一讲解。</li>
        </ul>
      </section>
      </aside>
      </div>
    </template>

    <!-- 识别态 -->
    <section v-else-if="stage === 'recognizing'" class="capture__recognizing">
      <UiAiLogo :state="recognizeState.status === 'running' ? 'working' : 'streaming'" size="lg" />
      <h2 class="t-h2">正在识别题目</h2>
      <ul class="capture__steps">
        <li
          v-for="(s, i) in recognizeState.steps"
          :key="s"
          class="capture__step"
          :data-state="i < recognizeState.step ? 'done' : i === recognizeState.step ? 'active' : 'idle'"
        >
          <span class="capture__step-dot" aria-hidden="true" />
          {{ s }}
        </li>
      </ul>
      <p v-if="recognizeState.found" class="capture__found">发现 {{ recognizeState.found }} 道题</p>
      <UiButton variant="ghost" @click="stopRecognize">停止识别</UiButton>
    </section>

    <!-- 多题选择 -->
    <section v-else class="capture__select">
      <header class="capture__select-head">
        <div>
          <h2 class="t-h2">识别到 {{ questions.length }} 道题</h2>
          <p class="t-body-2">点击任意一道题开始讲解；讲解会在后台逐题进行</p>
        </div>
        <div class="capture__select-ops">
          <UiButton variant="ghost" size="sm" @click="restart">重新上传</UiButton>
        </div>
      </header>
      <div class="capture__cards">
        <button
          v-for="(q, i) in questions"
          :key="q.id"
          type="button"
          class="capture__card surface-standard"
          @click="select(q)"
        >
          <span class="capture__card-no">{{ i + 1 }}</span>
          <div class="capture__card-body">
            <div class="capture__card-status">
              <UiTag v-if="q.status === 'done'" variant="success">已讲解</UiTag>
              <UiTag v-else-if="q.status === 'loading'" variant="info">讲解中</UiTag>
              <UiTag v-else-if="q.status === 'error'" variant="error">讲解失败</UiTag>
              <UiTag v-else variant="neutral">待讲解</UiTag>
            </div>
            <!-- 题面直接按 LaTeX 渲染（教材式排版：真分数线、规范符号），不降级成平铺文本；
                 超长用 CSS 行数截断，不切割公式 -->
            <p class="capture__card-text"><MathText :content="q.text" /></p>
          </div>
        </button>
      </div>
    </section>
    <UiImageViewer v-model="viewerOpen" :images="viewerImages" title="题目图片" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiImageViewer from '../ui/UiImageViewer.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import MathText from '../components/MathText.vue'
import { ROUTES } from '../lib/routes.js'
import { recordAction } from '../statsStore'
import { splitQuestions } from '../book.js'
import { latexToPlain } from '../mathtext'
import { flowRef, recognize, abortRecognize, recognizeState, startFromTexts } from '../stores/flowStore'
import { takePendingImage } from '../stores/captureStore'
import { readImageDataUrl } from '../lib/imageFile.js'
import { useCrop } from '../lib/useCrop.js'
import { recordsRef } from '../stores/recordsStore'
import { toast } from '../ui/toast.js'

const router = useRouter()
const questions = flowRef()
const stage = ref('upload') // upload | recognizing | select

/** 图片查看器：点缩略图看大图，确认是否拍全/拍清 */
const viewerOpen = ref(false)
const viewerImages = computed(() =>
  upload.dataUrl ? [{ src: upload.dataUrl, name: (upload.file && upload.file.name) || '题目图片' }] : [],
)

const upload = reactive({ file: null, dataUrl: '', mime: '', text: '' })
const dragging = ref(false)
const albumInput = ref(null)
const cameraInput = ref(null)

const canSubmit = computed(() => !!upload.file || !!upload.text.trim())

/* 框选裁剪：拖拽选区，松手保留待确认（pointer 事件统一鼠标+触屏）；确认后才识别 */
const {
  cropWrapRef,
  cropImgRef,
  cropSel,
  cropBoxStyle,
  onCropDown,
  onCropMove,
  onCropUp,
  onCropLeave,
  resetCrop,
  cropToDataUrl,
} = useCrop()

function confirmCrop() {
  const dataUrl = cropToDataUrl()
  if (!dataUrl) return
  resetCrop()
  runRecognize(dataUrl, 'image/jpeg')
}
function cancelCrop() {
  resetCrop()
}

/* 最近拍过的题（原型 A2）：取学习记录里最近的讲解记录 */
const records = recordsRef()
const recentQuestions = computed(() =>
  records.value.filter((r) => r.type === 'explain' && (r.title || r.brief)).slice(0, 3),
)
function timeAgo(ts) {
  const t = Number(ts)
  if (!t) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return d === 1 ? '昨天' : `${d} 天前`
}

/* 文字输入：桌面常驻，移动端默认折叠（拍照是主路径，不让它占半屏） */
const textOpen = ref(false)
const textareaEl = ref(null)

async function toggleText() {
  textOpen.value = !textOpen.value
  if (textOpen.value) {
    await nextTick()
    if (textareaEl.value) textareaEl.value.focus()
  }
}

function clip(text, n = 120) {
  // 摘要先转纯数学文本再截断：避免把 $…$ 公式截一半，也避免 LaTeX 源码直出
  const t = latexToPlain(String(text || '')).replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

function pick(kind) {
  if (kind === 'camera' && cameraInput.value) cameraInput.value.click()
  else if (albumInput.value) albumInput.value.click()
}

function focusText() {
  textOpen.value = true
  nextTick(() => {
    const ta = document.querySelector('.capture__textarea')
    if (ta) ta.focus()
  })
}

/** 拍题四步流程（2026-10-11 新增：把「拍完会发生什么」讲清楚，新手最关心） */
const flowSteps = [
  { icon: 'camera', color: '#9d8bf5', title: '上传 / 拍照', desc: '一题一图最准，整页试卷可框选' },
  { icon: 'search', color: '#8b74f3', title: 'AI 识别切题', desc: '自动识别文字、公式、代码，可编辑修正' },
  { icon: 'sparkle', color: '#7c5cff', title: '逐句讲解', desc: '一步步讲思路，能追问、能换个讲法' },
  { icon: 'refresh', color: '#5b47d6', title: '错题自动进本', desc: '做错的按遗忘曲线排期，到期提醒复习' },
]
/** 示例题（内置文本，不调模型；点一下填入输入框，用户自己点「开始识别」） */
const sampleQuestions = [
  { glyph: '∫', label: '定积分', brief: '求 ∫₀¹ x²dx', text: '求定积分 $\\int_0^1 x^2 \\, dx$ 的值。' },
  { glyph: 'λ', label: '线性代数', brief: '求矩阵特征值', text: '已知矩阵 $A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}$，求 $A$ 的特征值与特征向量。' },
  { glyph: 'ƒ', label: '高数泰勒', brief: '展开到二阶', text: '求 $f(x) = x^3 - 3x^2 + 2$ 在 $x = 1$ 处的二阶泰勒展开式。' },
  { glyph: '</>', label: '算法题', brief: '两数之和', text: '给定数组 $[2, 7, 11, 15]$ 与目标值 $9$，找出和为 $9$ 的两个元素的下标，并说明时间复杂度。' },
]
async function useSample(s) {
  upload.text = s.text
  textOpen.value = true
  await nextTick()
  const ta = textareaEl.value
  if (ta) {
    ta.focus()
    ta.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

/** 输入框里含 LaTeX 定界符时才显示渲染预览 */
const hasTex = computed(() => /\$[^$\n]{2,}\$|\\frac|\\oint|\\int|\\sqrt|\\lim/.test(String(upload.text || '')))

/** 读图（EXIF 转正 + 压缩）走共享模块 lib/imageFile.js，压缩失败自动用原图兜底 */
async function readFile(file) {
  const r = await readImageDataUrl(file, { onError: toast.error })
  if (!r) return
  upload.file = file
  upload.dataUrl = r.dataUrl
  upload.mime = r.mime
  resetCrop()
}

function onFile(event) {
  const file = event.target.files && event.target.files[0]
  if (file) readFile(file)
  event.target.value = ''
}

function onDrop(event) {
  dragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  const file = files.find((f) => /^image\//.test(f.type))
  if (file) {
    readFile(file)
  } else if (files.length) {
    toast.error('请拖入图片文件')
  }
}

function onPaste(event) {
  const items = event.clipboardData?.items || []
  for (const item of items) {
    if (item.kind === 'file' && /^image\//.test(item.type)) {
      readFile(item.getAsFile())
      return
    }
  }
  // 粘贴了文字/非图片：交给文字输入（如果有内容），否则静默即可 —— 避免误报
  const text = event.clipboardData?.getData('text') || ''
  if (!text.trim()) {
    // 只有"确实粘贴了东西但又不是图片"才提示
    const hasFile = Array.from(items || []).some((i) => i.kind === 'file')
    if (hasFile) toast.error('请粘贴图片文件')
  }
}

function clearUpload() {
  upload.file = null
  upload.dataUrl = ''
  resetCrop()
}

async function runRecognize(dataUrl, mime) {
  stage.value = 'recognizing'
  const res = await recognize(dataUrl, mime || 'image/png')
  if (res && res.texts) {
    finishRecognize(res.texts)
  } else if (recognizeState.status === 'error') {
    stage.value = 'upload'
    toast.error(recognizeState.error)
  } else if (recognizeState.status === 'aborted') {
    stage.value = 'upload'
  }
}

async function submit() {
  if (!canSubmit.value) return
  if (upload.text.trim()) {
    // 文字模式：直接切题讲解，不调识别
    finishRecognize(splitQuestions(upload.text))
    return
  }
  runRecognize(upload.dataUrl, upload.mime || 'image/png')
}

function finishRecognize(texts) {
  startFromTexts(texts)
  // 打卡/成就埋点：识别成功（多题连发按一次题数 >=5 计）
  try {
    recordAction('search', {
      title: String(texts[0] || '拍照识别').slice(0, 60),
      brief: `识别 ${texts.length} 题`,
      images: texts.length,
    })
  } catch {
    /* 埋点失败不影响识别 */
  }
  if (texts.length <= 1) {
    // 只有一道题：直接进讲解页
    router.push('/q/' + questions.value[0].id)
  } else {
    stage.value = 'select'
  }
}

function stopRecognize() {
  abortRecognize()
  stage.value = 'upload'
}

function restart() {
  abortRecognize()
  stage.value = 'upload'
  clearUpload()
}

function select(q) {
  router.push('/q/' + q.id)
}

/* 首页透传的图片：已确认（整图或框选后），直接自动识别 */
onMounted(async () => {
  const pending = takePendingImage()
  if (pending && pending.dataUrl) {
    runRecognize(pending.dataUrl, pending.mime || 'image/png')
  }
  window.addEventListener('paste', onPaste)
  // 桌面端：顶部工具条 / 首页「输入题目文字」带 ?focus=text 进来 → 自动展开并聚焦文本域
  if (String(router.currentRoute.value.query.focus || '') === 'text') {
    textOpen.value = true
    await nextTick()
    focusText()
  }
})
onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
</script>

<style scoped>
.capture {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: var(--col-main);
}
.capture__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.capture__drop {
  padding: var(--sp-8) var(--sp-6);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease);
}
.capture__drop.is-over {
  border-color: var(--primary);
}
/* 取景框（2026-10-11：桌面改卡片式通道后的紫色虚线内框） */
.capture__drop-inner {
  border: 1px dashed rgba(124, 92, 255, 0.35);
  border-radius: 13px;
  padding: 20px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
}
.capture__channels {
  display: flex;
  justify-content: center;
  gap: var(--sp-8);
  margin-bottom: var(--sp-4);
  flex-wrap: wrap;
  width: 100%;
}
.capture__channel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: var(--fs-body-2);
  font-family: inherit;
}
.capture__channel-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.capture__channel:hover {
  color: var(--text-primary);
}
.capture__hint {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.capture__hint kbd {
  background: rgba(124, 92, 255, 0.1);
  border: 0.5px solid rgba(124, 92, 255, 0.22);
  border-radius: 5px;
  padding: 1px 5px;
  font-family: inherit;
  font-size: var(--fs-label);
  color: var(--primary-text);
}
.capture__preview {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  text-align: left;
}
.capture__view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-unit);
  color: var(--primary-text);
  font-size: var(--fs-body-2);
  cursor: zoom-in;
}
.capture__view:hover {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.capture__file {
  flex: 1;
  min-width: 0;
}
.capture__filename {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.capture__state {
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.capture__file-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}
.capture__remove {
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.capture__remove:hover {
  color: var(--error);
}
/* 文字输入行（2026-10-11 改卡片式：默认收起，点开才出现输入框） */
.capture__card-line {
  padding: 0;
  overflow: hidden;
}
.capture__text-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: 0;
  background: none;
  cursor: pointer;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  text-align: left;
}
.capture__text-ico {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-text);
  background: var(--primary-soft-2);
  border: 0.5px solid var(--primary-line);
}
.capture__text-hint {
  font-size: var(--fs-label);
  color: var(--text-disabled);
}
.capture__text-go {
  margin-left: auto;
  flex: none;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  white-space: nowrap;
}
.capture__textarea {
  display: none;
  width: calc(100% - 32px);
  margin: 0 16px var(--sp-3);
  resize: vertical;
  min-height: 96px;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
}
.capture__card-line.is-open .capture__textarea {
  display: block;
}
.capture__textarea:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.capture__actions {
  display: flex;
  gap: var(--sp-3);
}

.capture__recognizing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-10) 0;
  text-align: center;
}
.capture__steps {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  text-align: left;
}
.capture__step {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-body-2);
  color: var(--text-muted);
}
.capture__step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-disabled);
}
.capture__step[data-state='active'] {
  color: var(--text-primary);
}
.capture__step[data-state='active'] .capture__step-dot {
  background: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft-3);
  animation: zy-pulse 1.6s var(--ease) infinite;
}
.capture__step[data-state='done'] {
  color: var(--text-tertiary);
}
.capture__step[data-state='done'] .capture__step-dot {
  background: var(--success);
}
.capture__found {
  font-size: var(--fs-body);
  color: var(--primary-text);
}

.capture__select-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.capture__select-ops {
  display: flex;
  gap: var(--sp-2);
}
.capture__cards {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}
.capture__card {
  display: flex;
  gap: var(--sp-4);
  align-items: flex-start;
  padding: var(--sp-4) var(--sp-5);
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.capture__card:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}
.capture__card-no {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--primary-soft-2);
  color: var(--primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-body-2);
  flex: none;
}
.capture__card-body {
  flex: 1;
  min-width: 0;
}
.capture__card-status {
  margin-bottom: var(--sp-1);
}
.capture__preview-row {
  display: flex;
  gap: var(--sp-2);
  align-items: baseline;
  padding: var(--sp-3);
  margin-top: var(--sp-2);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.capture__preview-label {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.capture__preview-tex {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body);
  color: var(--text-primary);
  line-height: var(--lh-relaxed);
  overflow-x: auto;
}
.capture__card-text {
  font-size: var(--fs-body);
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
  /* 题面按公式渲染后可能很长：最多 3 行截断（不切割公式，只裁外层容器） */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---- 移动端：拍照为主路径 ----
   去掉拖拽（手机上无效）与常驻文本框，入口从「4 个等权图标」改为
   「主按钮 + 次级按钮 + 一行文字入口」。桌面保持原样。 */
@media (max-width: 767px) {
  .capture__head {
    gap: 4px;
  }
  .capture__head .t-body-2 {
    display: none;
  }
  .capture__drop {
    padding: 22px 16px;
  }
  /* 移动端维持原纵向按钮设计：取景框不描边、通道不显示副文案 */
  .capture__drop-inner {
    border: 0;
    padding: 0;
    gap: 0;
  }
  .capture__channels {
    flex-direction: column;
    gap: 10px;
    margin-bottom: 0;
  }
  .capture__channel {
    flex-direction: row;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 0 var(--sp-4);
    border-radius: var(--radius-sm);
    font-size: var(--fs-body);
    color: var(--text-secondary);
  }
  .capture__channel b {
    font-weight: 400;
  }
  .capture__channel i {
    display: none;
  }
  .capture__channel--camera {
    background: var(--primary);
    color: var(--text-on-primary);
    box-shadow: var(--shadow-primary);
  }
  .capture__channel--album {
    border: 0.5px solid var(--primary-line);
    background: var(--primary-soft-3);
    color: var(--primary-text);
  }
  .capture__channel--drag {
    display: none;
  }
  .capture__channel--text {
    min-height: 40px;
    font-size: var(--fs-body-2);
    color: var(--text-muted);
  }
  .capture__hint {
    display: none;
  }
  .capture__actions .ui-btn {
    width: 100%;
  }
  .capture__preview {
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-3);
  }
  .capture__crop {
    align-self: center;
  }
}/* 最近拍过的题样式（原型 A2） */
.capture__recent {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
}
.capture__recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.capture__recent-title {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.capture__recent-all {
  border: 0;
  background: none;
  padding: 0;
  font-size: var(--fs-label);
  color: var(--primary-text);
  cursor: pointer;
}
.capture__recent-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.capture__recent-row + .capture__recent-row {
  border-top: var(--border-divider-soft);
  padding-top: var(--sp-2);
}
.capture__recent-q {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------------- 桌面端（≥1024px）：左输入 / 右历史+贴士 ---------------- */
.capture__layout {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
.capture__aside {
  display: none;
  flex-direction: column;
  gap: var(--sp-4);
}
.capture__tips {
  padding: var(--sp-4) var(--sp-5);
}
.capture__tip-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
.capture__tip-list li {
  position: relative;
  padding-left: var(--sp-4);
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  line-height: 1.7;
}
.capture__tip-list li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.6;
}
/* 最近拍过的题空态（无记录时占位，避免右栏顶部空一块） */
.capture__recent-empty {
  text-align: center;
  padding: var(--sp-3) var(--sp-2) 2px;
}
.capture__recent-empty-ico {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  margin: 0 auto 9px;
  display: grid;
  place-items: center;
  background: var(--primary-soft-3);
  border: 0.5px dashed var(--primary-line);
  color: var(--text-disabled);
}
.capture__recent-empty p {
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: 1.7;
}

/* 拍题小贴士：序号圆点 */
.capture__tip-list {
  counter-reset: tip;
}
.capture__tip-list li::before {
  counter-increment: tip;
  content: counter(tip);
  position: absolute;
  left: 0;
  top: 3px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-size: 10.5px;
  font-weight: var(--fw-semibold);
  opacity: 1;
}
.capture__tip-list li {
  padding-left: 26px;
}

/* ---------------- 新增区块：流程卡 + 示例题（2026-10-11，淡紫柔底） ---------------- */
.capture__tint-card {
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border-radius: var(--radius-lg);
  border: 0.5px solid rgba(124, 92, 255, 0.16);
  background: linear-gradient(180deg, #fcfbff 0%, #f7f5ff 100%);
  box-shadow: 0 1px 2px rgba(20, 30, 60, 0.05), 0 8px 22px -12px rgba(124, 92, 255, 0.24);
}
html[data-theme='dark'] .capture__tint-card {
  border-color: rgba(124, 92, 255, 0.24);
  background: linear-gradient(180deg, rgba(124, 92, 255, 0.1) 0%, rgba(124, 92, 255, 0.05) 100%);
}
.capture__block-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.capture__block-head b {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.capture__block-head span {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.capture__flow-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: var(--sp-4);
}
.capture__flow-step {
  position: relative;
  padding: 14px 14px 13px;
  border-radius: 13px;
  background: var(--surface-1);
  border: 0.5px solid rgba(124, 92, 255, 0.14);
}
.capture__flow-no {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  color: #fff;
  background: var(--nc, var(--primary));
}
.capture__flow-ico {
  position: absolute;
  top: 13px;
  right: 13px;
  color: color-mix(in srgb, var(--nc, var(--primary)) 55%, #fff);
}
.capture__flow-step b {
  display: block;
  margin-top: 9px;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.capture__flow-desc {
  display: block;
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: 1.55;
}
.capture__flow-arrow {
  position: absolute;
  top: 50%;
  right: -9px;
  transform: translateY(-50%);
  color: rgba(124, 92, 255, 0.35);
  font-size: var(--fs-body);
}
.capture__sample-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: var(--sp-4);
}
.capture__sample-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 11px;
  border: 0.5px solid rgba(124, 92, 255, 0.18);
  background: var(--surface-1);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.capture__sample-chip:hover {
  border-color: rgba(124, 92, 255, 0.45);
  transform: translateY(-1px);
}
.capture__sample-ico {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  flex: none;
  display: grid;
  place-items: center;
  font-style: normal;
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  color: var(--primary-text);
  background: var(--primary-soft-2);
  border: 0.5px solid var(--primary-line);
}
.capture__sample-chip b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.capture__sample-chip i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-disabled);
}
@media (max-width: 767px) {
  .capture__flow-steps {
    grid-template-columns: 1fr 1fr;
  }
  .capture__flow-arrow {
    display: none;
  }
}

@media (min-width: 768px) {
  /* 上传区：桌面改卡片式通道（淡色圆角底图标 + 标题 + 副文案） */
  .capture__drop {
    padding: var(--sp-4);
    text-align: left;
  }
  .capture__channels {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 0;
  }
  .capture__channel {
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 14px 8px;
    border: var(--border-subtle);
    border-radius: 13px;
    background: var(--surface-1);
    box-shadow: 0 1px 2px rgba(20, 30, 60, 0.04);
    color: var(--text-primary);
    transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
  }
  .capture__channel:hover {
    border-color: rgba(124, 92, 255, 0.35);
    transform: translateY(-1px);
    color: var(--text-primary);
  }
  .capture__channel b {
    font-size: var(--fs-body-2);
    font-weight: var(--fw-medium);
  }
  .capture__channel i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-disabled);
  }
  .capture__channel-ico {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    color: var(--c, var(--primary-text));
    background: color-mix(in srgb, var(--c, var(--primary)) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--c, var(--primary)) 38%, transparent);
  }
  html[data-theme='dark'] .capture__channel-ico {
    color: color-mix(in srgb, var(--c, var(--primary)) 55%, #fff);
  }
}

@media (min-width: 1024px) {
  .capture {
    max-width: none;
  }
  .capture__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 344px;
    gap: var(--sp-6);
    align-items: start;
  }
  .capture__col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    min-width: 0;
  }
  .capture__aside {
    display: flex;
  }
  .capture__drop {
    padding: var(--sp-4);
  }
  .capture__recent {
    position: sticky;
    top: 82px;
  }
}
</style>
