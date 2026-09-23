<template>
  <Teleport to="body">
    <TransitionGroup name="ui-toast" tag="div" class="ui-toast-layer">
      <div
        v-for="item in toastState.items"
        :key="item.id"
        class="ui-toast"
        :data-type="item.type"
        role="status"
        aria-live="polite"
      >
        <span class="ui-toast__text">{{ item.message }}</span>
        <button v-if="item.actionText" class="ui-toast__action" type="button" @click="item.onAction">
          {{ item.actionText }}
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { toastState } from './toast.js'

/**
 * Toast 渲染层：全局挂一次即可（App 外壳内已包含）
 * ---------------------------------------------------------------------------
 * 位置：页面**中上方**（桌面在顶部导航下方，移动端贴顶）——表单校验提示就在视线内。
 * 层级：--z-toast 高于 --z-modal，**弹窗打开时提示不被遮罩糊掉**（这是之前的实际缺陷）。
 * 外观：不透明实底 + 主文字色 + 正文号，避免半透明叠加后发灰看不清。
 */
</script>

<style scoped>
.ui-toast-layer {
  position: fixed;
  z-index: var(--z-toast);
  left: 50%;
  top: calc(var(--sp-3) + env(safe-area-inset-top));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  width: max-content;
  max-width: min(560px, calc(100vw - 32px));
  pointer-events: none;
}
@media (min-width: 768px) {
  /* 桌面：让开顶部导航（否则会盖住导航） */
  .ui-toast-layer {
    top: 76px;
  }
}
.ui-toast {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 12px var(--sp-4);
  border-radius: var(--radius-md);
  /* 实底：不再半透明，避免与背景/遮罩叠加后发灰 */
  background: var(--surface-2);
  border: var(--border-default);
  border-left: 3px solid var(--primary);
  box-shadow: var(--shadow-elevated);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  line-height: var(--lh-body);
  color: var(--text-primary);
  pointer-events: auto;
  max-width: 100%;
}
.ui-toast[data-type='success'] {
  border-left-color: var(--success);
}
.ui-toast[data-type='error'] {
  border-left-color: var(--error);
}
.ui-toast[data-type='warning'] {
  border-left-color: var(--warning);
}
.ui-toast[data-type='info'] {
  border-left-color: var(--info);
}
.ui-toast__text {
  max-width: min(520px, 74vw);
  word-break: break-word;
}
.ui-toast__action {
  margin-left: var(--sp-1);
  background: none;
  border: 0;
  padding: 0;
  color: var(--primary-text);
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  cursor: pointer;
  white-space: nowrap;
}

.ui-toast-enter-active,
.ui-toast-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur-slow) var(--ease-out);
}
.ui-toast-enter-from,
.ui-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
