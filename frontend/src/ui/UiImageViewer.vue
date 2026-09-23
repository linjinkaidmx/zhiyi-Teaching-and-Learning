<template>
  <Teleport to="body">
    <Transition name="ui-iv">
      <div
        v-if="modelValue"
        class="ui-iv"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @keydown="onKeydown"
      >
        <div class="ui-iv__mask" @click="close" />

        <!-- 顶部：名称 + 关闭 -->
        <header class="ui-iv__bar">
          <span class="ui-iv__title">{{ currentImage?.name || title }}</span>
          <span class="ui-iv__count" v-if="images.length > 1">{{ index + 1 }} / {{ images.length }}</span>
          <button class="ui-iv__icon ui-iv__icon--close" type="button" aria-label="关闭" @click="close">
            <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
            </svg>
          </button>
        </header>

        <!-- 图片区 -->
        <div
          ref="stage"
          class="ui-iv__stage"
          :class="{ 'is-zoomed': scale > 1 }"
          @wheel.prevent="onWheel"
          @dblclick="toggleZoom"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @touchstart.passive="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <img
            v-if="currentImage"
            ref="img"
            :src="currentImage.src"
            :alt="currentImage.name || '题目图片'"
            class="ui-iv__img"
            draggable="false"
            :style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"
          />
        </div>

        <!-- 左右切换（多图） -->
        <button
          v-if="images.length > 1"
          class="ui-iv__nav ui-iv__nav--prev"
          type="button"
          aria-label="上一张"
          @click.stop="go(-1)"
        >
          ‹
        </button>
        <button
          v-if="images.length > 1"
          class="ui-iv__nav ui-iv__nav--next"
          type="button"
          aria-label="下一张"
          @click.stop="go(1)"
        >
          ›
        </button>

        <!-- 底部工具条：缩放 -->
        <footer class="ui-iv__tools" @click.stop>
          <button class="ui-iv__icon" type="button" aria-label="缩小" :disabled="scale <= MIN" @click="zoomBy(-0.5)">－</button>
          <span class="ui-iv__zoom">{{ Math.round(scale * 100) }}%</span>
          <button class="ui-iv__icon" type="button" aria-label="放大" :disabled="scale >= MAX" @click="zoomBy(0.5)">＋</button>
          <button class="ui-iv__reset" type="button" :disabled="scale === 1 && !tx && !ty" @click="reset">重置</button>
          <span class="ui-iv__hint">滚轮 / 双指缩放 · 拖动查看 · 双击放大</span>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 图片查看器（全屏看详情）
 * ---------------------------------------------------------------------------
 * 用途：拍题页缩略图点开看大图，确认题目是否拍全、是否清晰。
 * 交互：滚轮 / 双指捏合 / 双击 / ＋－ 按钮缩放（1x~5x），放大后可拖动，Esc 或点遮罩关闭。
 * 接口按数组设计（本次单图，将来多图可左右切换）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** [{ src, name? }] */
  images: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
  title: { type: String, default: '查看图片' },
})
const emit = defineEmits(['update:modelValue', 'close'])

const MIN = 1
const MAX = 5

const index = ref(0)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const stage = ref(null)

const currentImage = computed(() => props.images[index.value] || null)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      index.value = clamp(props.startIndex || 0, 0, Math.max(0, props.images.length - 1))
      reset()
      document.addEventListener('keydown', onKeydown, true)
    } else {
      document.removeEventListener('keydown', onKeydown, true)
    }
  },
)
onMounted(() => {
  if (props.modelValue) document.addEventListener('keydown', onKeydown, true)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function zoomBy(delta) {
  const next = clamp(Number((scale.value + delta).toFixed(2)), MIN, MAX)
  scale.value = next
  if (next === 1) {
    tx.value = 0
    ty.value = 0
  }
}

/** 以指针位置为中心缩放（滚轮） */
function onWheel(e) {
  const dir = e.deltaY > 0 ? -1 : 1
  const next = clamp(Number((scale.value + dir * 0.25).toFixed(2)), MIN, MAX)
  scale.value = next
  if (next === 1) {
    tx.value = 0
    ty.value = 0
  }
}

function toggleZoom() {
  if (scale.value > 1) reset()
  else scale.value = 2.5
}

/** 拖动平移（仅在放大后） */
let dragging = false
let last = { x: 0, y: 0 }
function onPointerDown(e) {
  if (scale.value <= 1) return
  dragging = true
  last = { x: e.clientX, y: e.clientY }
  e.currentTarget?.setPointerCapture?.(e.pointerId)
}
function onPointerMove(e) {
  if (!dragging) return
  tx.value += e.clientX - last.x
  ty.value += e.clientY - last.y
  last = { x: e.clientX, y: e.clientY }
}
function onPointerUp() {
  dragging = false
}

/** 双指捏合 */
let pinchStart = 0
let pinchBase = 1
function onTouchStart(e) {
  if (e.touches.length === 2) {
    pinchStart = dist(e.touches)
    pinchBase = scale.value
  }
}
function onTouchMove(e) {
  if (e.touches.length === 2 && pinchStart) {
    const ratio = dist(e.touches) / pinchStart
    scale.value = clamp(Number((pinchBase * ratio).toFixed(2)), MIN, MAX)
    if (scale.value === 1) {
      tx.value = 0
      ty.value = 0
    }
  }
}
function onTouchEnd() {
  pinchStart = 0
}
function dist(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function go(step) {
  if (props.images.length < 2) return
  index.value = (index.value + step + props.images.length) % props.images.length
  reset()
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  } else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === '+' || e.key === '=') zoomBy(0.5)
  else if (e.key === '-') zoomBy(-0.5)
}
</script>

<style scoped>
.ui-iv {
  position: fixed;
  inset: 0;
  /* 最上层：可盖住弹窗与提示 */
  z-index: var(--z-confirm);
  display: flex;
  flex-direction: column;
}
.ui-iv__mask {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 10, 0.92);
}
.ui-iv__bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  padding-top: calc(var(--sp-3) + env(safe-area-inset-top));
  color: #eef2f8;
}
.ui-iv__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-body-2);
}
.ui-iv__count {
  font-size: var(--fs-body-2);
  color: rgba(238, 242, 248, 0.72);
}
.ui-iv__icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.08);
  color: #eef2f8;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}
.ui-iv__icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
}
.ui-iv__icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ui-iv__stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: var(--sp-2);
  touch-action: none;
}
.ui-iv__stage.is-zoomed {
  cursor: grab;
}
.ui-iv__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: center center;
  transition: transform var(--dur-fast) var(--ease-out);
  will-change: transform;
}
.ui-iv__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #eef2f8;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.ui-iv__nav:hover {
  background: rgba(255, 255, 255, 0.2);
}
.ui-iv__nav--prev {
  left: var(--sp-4);
}
.ui-iv__nav--next {
  right: var(--sp-4);
}
.ui-iv__tools {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom));
  color: #eef2f8;
}
.ui-iv__zoom {
  min-width: 52px;
  text-align: center;
  font-size: var(--fs-body-2);
  font-variant-numeric: tabular-nums;
}
.ui-iv__reset {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.08);
  color: #eef2f8;
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.ui-iv__reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ui-iv__hint {
  margin-left: var(--sp-3);
  font-size: var(--fs-label);
  color: rgba(238, 242, 248, 0.6);
}

.ui-iv-enter-active,
.ui-iv-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.ui-iv-enter-from,
.ui-iv-leave-to {
  opacity: 0;
}

@media (max-width: 767px) {
  .ui-iv__hint {
    display: none;
  }
  .ui-iv__nav {
    width: 38px;
    height: 38px;
  }
}
</style>
