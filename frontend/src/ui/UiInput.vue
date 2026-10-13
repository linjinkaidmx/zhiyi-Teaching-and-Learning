<template>
  <label class="ui-field" :class="{ 'ui-field--invalid': !!error, 'ui-field--disabled': disabled }">
    <span v-if="label" class="ui-field__label">
      {{ label }}
      <span v-if="optional" class="ui-field__optional">选填</span>
    </span>

    <span class="ui-field__control">
      <slot name="prefix" />
      <textarea
        v-if="type === 'textarea'"
        :class="['ui-field__input', 'ui-field__input--area', { 'is-error': !!error }]"
        :value="modelValue"
        :placeholder="placeholder"
        :maxlength="maxlength || undefined"
        :rows="rows"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur', $event)"
        @keydown.enter.meta.prevent="$emit('submit')"
      />
      <input
        v-else
        :class="['ui-field__input', { 'is-error': !!error }]"
        :type="effectiveType"
        :value="modelValue"
        :placeholder="placeholder"
        :maxlength="maxlength || undefined"
        :disabled="disabled"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur', $event)"
        @keydown.enter.prevent="$emit('submit')"
      />
      <button
        v-if="type === 'password'"
        class="ui-field__eye"
        type="button"
        :aria-label="revealed ? '隐藏密码' : '显示密码'"
        @click="revealed = !revealed"
      >
        {{ revealed ? '隐藏' : '显示' }}
      </button>
      <slot name="suffix" />
    </span>

    <span v-if="error || hint || (maxlength && showCount)" class="ui-field__foot">
      <span v-if="error" class="ui-field__error">{{ error }}</span>
      <span v-else-if="hint" class="ui-field__hint">{{ hint }}</span>
      <span v-if="maxlength && showCount" class="ui-field__count">
        {{ (modelValue || '').length }}/{{ maxlength }}
      </span>
    </span>
  </label>
</template>

<script setup>
import { computed, ref } from 'vue'

/** 输入框：文本 / 多行 / 密码（带显示切换），含标签、说明、错误、字数统计 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  maxlength: { type: Number, default: 0 },
  showCount: { type: Boolean, default: false },
  rows: { type: Number, default: 4 },
  optional: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:modelValue', 'blur', 'submit'])

const revealed = ref(false)
const effectiveType = computed(() => (props.type === 'password' && revealed.value ? 'text' : props.type))
</script>

<style scoped>
.ui-field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.ui-field__label {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.ui-field__optional {
  margin-left: var(--sp-1);
  color: var(--text-muted);
  font-size: var(--fs-label);
}
.ui-field__control {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3);
  min-height: 38px;
  border-radius: var(--radius-sm);
  border: var(--border-default);
  border-top: var(--border-top-default);
  background: var(--surface-recess);
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ui-field__control:focus-within {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.ui-field__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  padding: var(--sp-3) 0;
  font-size: var(--fs-body);
  color: var(--text-primary);
}
.ui-field__input::placeholder {
  color: var(--text-muted);
}
.ui-field__input--area {
  resize: vertical;
  line-height: var(--lh-relaxed);
  min-height: 72px;
}
.ui-field__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-size: var(--fs-label);
}
.ui-field__hint {
  color: var(--text-muted);
}
.ui-field__error {
  color: var(--error);
  font-weight: var(--fw-medium);
}
/* 有错误时输入框本身也变红：提示与字段绑定，不依赖全局 Toast */
.ui-field__input.is-error {
  border-color: var(--error);
  background: var(--error-soft);
}
.ui-field__input.is-error:focus {
  border-color: var(--error);
}
.ui-field__count {
  margin-left: auto;
  color: var(--text-muted);
}
.ui-field--invalid .ui-field__control {
  border-color: var(--error);
}
.ui-field--disabled {
  opacity: 0.6;
}
.ui-field__eye {
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: var(--fs-label);
  cursor: pointer;
  flex: none;
}
.ui-field__eye:hover {
  color: var(--text-secondary);
}
</style>
