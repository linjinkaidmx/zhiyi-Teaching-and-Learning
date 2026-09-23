<template>
  <UiModal :model-value="modelValue" title="提醒中心" size="sm" @update:model-value="$emit('update:modelValue', $event)">
    <div class="rem__list">
      <button
        v-for="r in reminders"
        :key="r.key"
        type="button"
        class="rem__card surface-standard"
        @click="pick(r)"
      >
        <span class="rem__emoji" :style="{ background: r.tint }">{{ r.emoji }}</span>
        <span class="rem__main">
          <span class="rem__title">{{ r.title }}</span>
          <span class="rem__sub">{{ r.sub }}</span>
        </span>
        <span v-if="r.action" class="rem__action">{{ r.action }}</span>
      </button>
      <p v-if="!reminders.length" class="t-label rem__note">暂无提醒，拍一道题开始学习吧</p>
      <p v-else class="t-label rem__note">没有更多提醒了</p>
    </div>
  </UiModal>
</template>

<script setup>
import UiModal from './UiModal.vue'

/**
 * 提醒中心（原型 B1）：首页右上 🔔 进入。
 * 与首页信息位的关系：信息位只显示最优先一条，这里展示全部——「一条 vs 全部」，互补不重复。
 * 数据全部来自本地真实状态（错题本 / 课程考试 / 打卡统计），无后端改动。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reminders: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'go'])

function pick(r) {
  emit('update:modelValue', false)
  if (r.path) emit('go', r.path)
}
</script>

<style scoped>
.rem__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.rem__card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--grad-surface);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur) var(--ease);
}
.rem__card:hover {
  background: var(--surface-hover);
}
.rem__emoji {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.rem__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rem__title {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.rem__sub {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.rem__action {
  flex: none;
  font-size: var(--fs-body-2);
  color: var(--primary-text);
}
.rem__note {
  text-align: center;
  color: var(--text-muted);
  padding: var(--sp-2) 0;
}
</style>
