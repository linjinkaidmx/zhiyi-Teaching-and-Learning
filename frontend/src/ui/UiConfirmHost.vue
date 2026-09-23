<template>
  <UiModal
    :model-value="confirmState.open"
    :title="confirmState.title || '确认操作'"
    size="sm"
    z-index="var(--z-confirm)"
    @update:model-value="onClose"
  >
    <p class="ui-confirm__msg">{{ confirmState.message }}</p>
    <template #footer>
      <UiButton variant="ghost" @click="onClose">{{ confirmState.cancelText }}</UiButton>
      <UiButton :variant="confirmState.danger ? 'primary' : 'primary'" @click="onOk">
        {{ confirmState.okText }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import UiModal from './UiModal.vue'
import UiButton from './UiButton.vue'
import { confirmState, resolveConfirm } from './confirm.js'

/** 全局确认框宿主：挂一次即可（App 外壳内已包含） */
function onClose() {
  resolveConfirm(false)
}
function onOk() {
  resolveConfirm(true)
}
</script>

<style scoped>
.ui-confirm__msg {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text-secondary);
}
</style>
