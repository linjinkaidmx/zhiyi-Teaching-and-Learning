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
          <div class="capture__channels">
            <button type="button" class="capture__channel capture__channel--camera" @click.stop="pick('camera')">
              <UiIcon name="camera" :size="20" /><span>拍照解题</span>
            </button>
            <button type="button" class="capture__channel capture__channel--album" @click.stop="pick('album')">
              <UiIcon name="image" :size="20" /><span>从相册选图</span>
            </button>
            <button type="button" class="capture__channel capture__channel--drag" @click.stop="pick('album')">
              <UiIcon name="drag" :size="20" /><span>拖拽</span>
            </button>
            <button type="button" class="capture__channel capture__channel--text" @click.stop="focusText">
              <UiIcon name="clipboard" :size="20" /><span>粘贴 / 文字</span>
            </button>
          </div>
          <p class="capture__hint">把题目图片拖到这里，或点击任意位置选择</p>
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

      <div class="capture__text" :class="{ 'is-open': textOpen }">
        <button type="button" class="capture__text-toggle" @click="toggleText">
          <UiIcon name="clipboard" :size="15" />
          <span>{{ textOpen ? '收起文字输入' : '手动输入题目文字' }}</span>
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

      <input ref="albumInput" type="file" accept="image/*" class="sr-only" @change="onFile($event)" />
      <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="sr-only" @change="onFile($event)" />

      </div>

      <!-- 桌面端右栏：历史 + 使用提示（移动端由 CSS 隐藏，保持单列原样） -->
      <aside class="capture__aside">
      <!-- 最近拍过的题（原型 A2）：来自学习记录，「历史」入口的页内呈现 -->
      <section v-if="recentQuestions.length" class="surface-standard capture__recent">
        <div class="capture__recent-head">
          <span class="capture__recent-title">最近拍过的题</span>
          <button type="button" class="capture__recent-all" @click="$router.push(ROUTES.records)">全部 →</button>
        </div>
        <div v-for="r in recentQuestions" :key="r.id" class="capture__recent-row">
          <span class="capture__recent-q">{{ r.title || r.brief || '题目讲解' }}</span>
          <span class="t-label">{{ timeAgo(r.createdAt) }}</span>
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
  const ta = document.querySelector('.capture__textarea')
  if (ta) ta.focus()
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
.capture__channels {
  display: flex;
  justify-content: center;
  gap: var(--sp-8);
  margin-bottom: var(--sp-4);
  flex-wrap: wrap;
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
}
.capture__channel:hover {
  color: var(--text-primary);
}
.capture__hint {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
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
/* 文字输入折叠开关：仅在移动端出现，桌面常驻展开 */
.capture__text-toggle {
  display: none;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 var(--sp-4);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--text-tertiary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.capture__textarea {
  width: 100%;
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
  .capture__text-toggle {
    display: inline-flex;
  }
  .capture__textarea {
    display: none;
  }
  .capture__text.is-open .capture__textarea {
    display: block;
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
    padding: var(--sp-10) var(--sp-8);
  }
  .capture__recent {
    position: sticky;
    top: 82px;
  }
}
</style>
