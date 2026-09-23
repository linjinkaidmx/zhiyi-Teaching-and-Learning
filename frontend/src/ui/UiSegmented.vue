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
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
/** 分段选择器：替代 el-radio-group + el-radio-button（也用于替代 el-radio） */
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value }]
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
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  gap: 2px;
}
.ui-seg__btn {
  padding: 6px 14px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-tertiary);
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ui-seg__btn:hover {
  color: var(--text-secondary);
}
.ui-seg__btn.is-active {
  background: var(--primary);
  color: var(--text-on-primary);
}
.ui-seg__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
