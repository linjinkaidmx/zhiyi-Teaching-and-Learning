<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div
        v-if="modelValue"
        class="ui-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :style="zIndex ? { zIndex } : null"
      >
        <div class="ui-modal__mask" @click="closeOnMask && close()" />
        <div class="ui-modal__panel" :class="[`ui-modal__panel--${size}`, 'surface-elevated']">
          <header class="ui-modal__head">
            <h3 class="t-h3">{{ title }}</h3>
            <button class="ui-modal__close" type="button" aria-label="关闭" @click="close()">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" />
              </svg>
            </button>
          </header>

          <div class="ui-modal__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="ui-modal__foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'

/**
 * 模态框：遮罩点击 / Esc 关闭，打开时锁定滚动并管理焦点
 * 注意：P2 迁移完成前与 Element Plus 弹窗共存，不引入全局样式冲突。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  closeOnMask: { type: Boolean, default: true },
  /** 需要盖住 Toast 时可传 'var(--z-confirm)'（确认框用） */
  zIndex: { type: [String, Number], default: '' },
})
const emit = defineEmits(['update:modelValue', 'close'])

let lastActive = null

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

function lock() {
  lastActive = document.activeElement
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
}

function unlock() {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
  if (lastActive && typeof lastActive.focus === 'function') lastActive.focus()
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

watch(
  () => props.modelValue,
  (open) => (open ? lock() : unlock()),
)

onBeforeUnmount(unlock)
</script>

<style scoped>
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--sp-4);
}
.ui-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 10, 0.62);
  backdrop-filter: blur(2px);
}
.ui-modal__panel {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: calc(100vh - var(--sp-12));
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
}
.ui-modal__panel--sm {
  max-width: 380px;
}
.ui-modal__panel--lg {
  max-width: 680px;
}
.ui-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: var(--border-divider-soft);
}
.ui-modal__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-tertiary);
  cursor: pointer;
}
.ui-modal__close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.ui-modal__body {
  padding: var(--sp-5);
  overflow-y: auto;
  color: var(--text-secondary);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
}
.ui-modal__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-top: var(--border-divider-soft);
}

.ui-modal-enter-active,
.ui-modal-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.ui-modal-enter-active .ui-modal__panel,
.ui-modal-leave-active .ui-modal__panel {
  transition: transform var(--dur-slow) var(--ease-out), opacity var(--dur) var(--ease);
}
.ui-modal-enter-from,
.ui-modal-leave-to {
  opacity: 0;
}
.ui-modal-enter-from .ui-modal__panel,
.ui-modal-leave-to .ui-modal__panel {
  transform: translateY(8px) scale(0.99);
  opacity: 0;
}
</style>
