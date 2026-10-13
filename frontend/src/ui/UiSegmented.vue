<template>
  <div class="ui-seg" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="ui-seg__btn"
      :class="{ 'is-active': modelValue === opt.value }"
      :aria-checked="modelValue === opt.value ? 'true' : 'false'"
      role="radio"
      :disabled="disabled"
      @click="pick(opt.value)"
    >
      <UiIcon v-if="opt.icon" :name="opt.icon" :size="14" />
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
/** 分段选择器：替代 el-radio-group + el-radio-button（也用于替代 el-radio）
 *  options 支持 { label, value, icon? }（icon 传 UiIcon 名，可省略） */
import UiIcon from './UiIcon.vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value, icon? }]
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])

function pick(value) {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.ui-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-1);
  box-shadow: var(--shadow-subtle);
  gap: 2px;
}
.ui-seg__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.ui-seg__btn:hover {
  color: var(--text-secondary);
  background: var(--surface-hover);
}
.ui-seg__btn.is-active {
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  color: var(--text-on-primary);
  box-shadow: 0 1px 4px rgba(124, 92, 255, 0.32);
}
.ui-seg__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
