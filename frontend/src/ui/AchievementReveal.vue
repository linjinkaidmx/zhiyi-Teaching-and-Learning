<template>
  <Teleport to="body">
    <Transition name="ach-reveal">
      <div v-if="ach" class="ach-reveal" role="dialog" aria-modal="true" :aria-label="`解锁成就：${ach.name}`">
        <div class="ach-reveal__mask" @click="close" />
        <div class="ach-reveal__box" :class="[`is-${ach.rarity}`]">
          <!-- 揭晓：光晕扩散 -->
          <span class="ach-reveal__wave" aria-hidden="true" />
          <span class="ach-reveal__wave ach-reveal__wave--2" aria-hidden="true" />

          <!-- 传说级粒子 -->
          <template v-if="ach.rarity === 'legend'">
            <span v-for="i in 8" :key="i" class="ach-reveal__spark" :style="sparkStyle(i)" aria-hidden="true" />
          </template>

          <div class="ach-reveal__medal">
            <BadgeMedal :rarity="ach.rarity" :totem="ach.totem" size="xl" :name="ach.name" />
          </div>

          <div class="ach-reveal__kicker">
            <span class="ach-reveal__rarity">{{ rarityName }}</span>
            <span>成就解锁</span>
          </div>
          <h2 class="ach-reveal__name">{{ ach.name }}</h2>
          <p class="ach-reveal__desc">{{ ach.desc }}</p>

          <div class="ach-reveal__ops">
            <UiButton variant="primary" size="lg" @click="close">知道了</UiButton>
            <button type="button" class="ach-reveal__link" @click="goHall">去成就殿堂看看</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 成就全屏揭晓（史诗 / 传说）
 * ---------------------------------------------------------------------------
 * 奖章从暗到亮弹性揭晓 + 光晕扩散；传说级额外粒子。
 * 7 秒无操作自动收起，收起后自动展示队列里的下一个。
 */
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import BadgeMedal from './BadgeMedal.vue'
import UiButton from './UiButton.vue'
import { ACHIEVEMENT_MAP, RARITY_NAME } from '../achievements.js'
import { achRevealKey, dismissReveal } from '../stores/achievementStore.js'
import { ROUTES } from '../lib/routes.js'

const router = useRouter()
const ach = computed(() => ACHIEVEMENT_MAP[achRevealKey.value] || null)
const rarityName = computed(() => (ach.value ? RARITY_NAME[ach.value.rarity] : ''))

let timer = null
watch(achRevealKey, (k) => {
  if (timer) { clearTimeout(timer); timer = null }
  if (!k) return
  timer = setTimeout(() => dismissReveal(), 7000)
})
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

function close() {
  if (timer) { clearTimeout(timer); timer = null }
  dismissReveal()
}
function goHall() {
  close()
  router.push(ROUTES.achievements)
}
function sparkStyle(i) {
  const angle = (360 / 8) * i
  const delay = 0.15 + i * 0.06
  return {
    transform: `rotate(${angle}deg) translateY(-96px)`,
    animationDelay: `${delay}s`,
  }
}
</script>

<style scoped>
.ach-reveal {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  display: grid;
  place-items: center;
  padding: var(--sp-6);
}
.ach-reveal__mask {
  position: absolute;
  inset: 0;
  background: rgba(6, 8, 14, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.ach-reveal__box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--sp-10) var(--sp-8) var(--sp-8);
  min-width: 300px;
  max-width: 380px;
  border-radius: var(--radius-xl);
  background: var(--grad-elevated);
  border: var(--border-strong);
  box-shadow: var(--shadow-modal);
}
.ach-reveal__box.is-legend {
  border-color: rgba(124, 92, 255, 0.42);
  box-shadow: var(--shadow-modal), 0 0 0 1px rgba(124, 92, 255, 0.18), 0 24px 60px -22px rgba(111, 87, 240, 0.55);
}

/* 光晕扩散 */
.ach-reveal__wave {
  position: absolute;
  top: 56px;
  left: 50%;
  width: 96px;
  height: 96px;
  margin-left: -48px;
  border-radius: 50%;
  border: 1.5px solid rgba(124, 92, 255, 0.5);
  animation: ach-wave 1.5s var(--ease-out) both;
  pointer-events: none;
}
.ach-reveal__wave--2 {
  animation-delay: 0.22s;
  border-color: rgba(124, 92, 255, 0.28);
}
.is-common .ach-reveal__wave { border-color: rgba(210, 154, 100, 0.55); }
.is-rare .ach-reveal__wave { border-color: rgba(152, 163, 184, 0.6); }
.is-epic .ach-reveal__wave { border-color: rgba(242, 191, 78, 0.6); }
@keyframes ach-wave {
  0% { transform: scale(0.7); opacity: 0.9; }
  100% { transform: scale(2.6); opacity: 0; }
}

/* 传说级粒子 */
.ach-reveal__spark {
  position: absolute;
  top: 56px;
  left: 50%;
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 50%;
  background: #d9ccff;
  box-shadow: 0 0 6px 1px rgba(155, 131, 251, 0.8);
  transform-origin: 2.5px 2.5px;
  animation: ach-spark 1.6s var(--ease-out) both;
  pointer-events: none;
}
@keyframes ach-spark {
  0% { opacity: 0; }
  30% { opacity: 1; }
  100% { opacity: 0; translate: 0 -18px; }
}

.ach-reveal__medal {
  animation: ach-pop 1.05s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  z-index: 1;
}
@keyframes ach-pop {
  0% { transform: scale(0.55); opacity: 0; }
  62% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.ach-reveal__kicker {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
  font-size: var(--fs-label);
  color: var(--text-muted);
  letter-spacing: 0.04em;
  animation: ach-fade 0.5s var(--ease-out) 0.45s both;
}
.ach-reveal__rarity {
  font-weight: var(--fw-medium);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
  color: var(--text-secondary);
  background: var(--surface-unit);
}
.is-epic .ach-reveal__rarity { color: #96650f; background: rgba(242, 191, 78, 0.2); }
.is-legend .ach-reveal__rarity { color: var(--primary-text); background: var(--primary-soft-1); }
.ach-reveal__name {
  font-size: var(--fs-h1);
  font-weight: var(--fw-medium);
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-top: var(--sp-2);
  animation: ach-fade 0.5s var(--ease-out) 0.55s both;
}
.ach-reveal__desc {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin-top: var(--sp-2);
  line-height: 1.7;
  animation: ach-fade 0.5s var(--ease-out) 0.65s both;
}
@keyframes ach-fade {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
.ach-reveal__ops {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-6);
  width: 100%;
  animation: ach-fade 0.5s var(--ease-out) 0.8s both;
}
.ach-reveal__link {
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
  cursor: pointer;
}
.ach-reveal__link:hover {
  color: var(--primary-text);
}

/* 浮层进出 */
.ach-reveal-enter-active { transition: opacity var(--dur) var(--ease); }
.ach-reveal-leave-active { transition: opacity var(--dur) var(--ease); }
.ach-reveal-enter-from, .ach-reveal-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .ach-reveal__wave, .ach-reveal__spark, .ach-reveal__medal, .ach-reveal__kicker,
  .ach-reveal__name, .ach-reveal__desc, .ach-reveal__ops { animation: none; }
}
</style>
