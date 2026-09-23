<template>
  <Teleport to="body">
    <div class="ach-toasts" aria-live="polite">
      <TransitionGroup name="ach-toast">
        <div v-for="t in achToasts" :key="t.id" class="ach-toast surface-elevated">
          <BadgeMedal :rarity="t.first.rarity" :totem="t.first.totem" size="md" :name="t.first.name" />
          <div class="ach-toast__body">
            <div class="ach-toast__head">
              <span class="ach-toast__kicker">解锁成就</span>
              <span class="ach-toast__rarity" :class="`is-${t.first.rarity}`">{{ t.rarityName }}</span>
            </div>
            <div class="ach-toast__name">{{ t.count > 1 ? `${t.first.name} 等 ${t.count} 个` : t.first.name }}</div>
            <div class="ach-toast__desc">{{ t.count > 1 ? '在成就殿堂查看全部' : t.first.desc }}</div>
          </div>
          <button type="button" class="ach-toast__close" aria-label="关闭" @click="dismissToast(t.id)">
            <UiIcon name="close" :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 成就轻提示（普通 / 稀有）：从顶部滑入的奖章卡，不打断当前操作。
 */
import BadgeMedal from './BadgeMedal.vue'
import UiIcon from './UiIcon.vue'
import { achToasts, dismissToast } from '../stores/achievementStore.js'
</script>

<style scoped>
.ach-toasts {
  position: fixed;
  top: var(--sp-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: center;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}
.ach-toast {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  padding-right: 34px;
  border-radius: var(--radius-lg);
  pointer-events: auto;
  box-shadow: var(--shadow-elevated);
  min-width: 268px;
}
.ach-toast__body {
  min-width: 0;
}
.ach-toast__head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.ach-toast__kicker {
  font-size: var(--fs-label);
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.ach-toast__rarity {
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  border-radius: var(--radius-pill);
  padding: 1px 7px;
  color: var(--text-secondary);
  background: var(--surface-unit);
}
.ach-toast__rarity.is-rare {
  color: #55627a;
  background: rgba(152, 163, 184, 0.22);
}
.ach-toast__rarity.is-epic {
  color: #96650f;
  background: rgba(242, 191, 78, 0.2);
}
.ach-toast__name {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  margin-top: 2px;
  white-space: nowrap;
}
.ach-toast__desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.ach-toast__close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  background: none;
  color: var(--text-disabled);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.ach-toast__close:hover {
  color: var(--text-secondary);
  background: var(--surface-hover);
}

/* 滑入 / 收起 */
.ach-toast-enter-active,
.ach-toast-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur-slow) var(--ease-out);
}
.ach-toast-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
}
.ach-toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
</style>
