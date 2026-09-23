<template>
  <button
    type="button"
    class="ui-switch"
    :class="{ 'is-on': modelValue }"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="ui-switch__dot" />
  </button>
</template>

<script setup>
/** 开关：替代 el-switch（行为一致：点击切换，受控 modelValue） */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<style scoped>
.ui-switch {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-unit);
  cursor: pointer;
  padding: 0;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
  flex: none;
}
.ui-switch.is-on {
  background: var(--primary);
  border-color: var(--primary-line);
}
.ui-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-switch__dot {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-secondary);
  transform: translateY(-50%);
  transition: left var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ui-switch.is-on .ui-switch__dot {
  left: 19px;
  background: var(--text-on-primary);
}
</style>
