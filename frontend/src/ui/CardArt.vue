<template>
  <svg class="card-art" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
    <!-- 拍照搜题：照相机 + 四角取景框（2026-10-11 定稿，占 x2.6~37.4 / y2.8~37.2） -->
    <g v-if="kind === 'camera'">
      <path d="M 13 9.5 v -3.5 a 2.4 2.4 0 0 1 2.4 -2.4 h 9.2 a 2.4 2.4 0 0 1 2.4 2.4 v 3.5 z" :style="{ fill: art('camera') }" />
      <rect x="4" y="9.5" width="32" height="22" rx="6" :style="{ fill: art('camera') }" />
      <circle cx="20" cy="20.5" r="8" fill="#ffffff" />
      <circle cx="20" cy="20.5" r="4" :style="{ fill: art('camera') }" />
      <rect x="29.6" y="13.2" width="4.2" height="2.8" rx="1" fill="#ffffff" opacity="0.85" />
      <path
        d="M 2.6 6.4 v -2 a 1.6 1.6 0 0 1 1.6 -1.6 h 2 M 33.8 2.8 h 2 a 1.6 1.6 0 0 1 1.6 1.6 v 2 M 37.4 33.6 v 2 a 1.6 1.6 0 0 1 -1.6 1.6 h -2 M 6.2 37.2 h -2 a 1.6 1.6 0 0 1 -1.6 -1.6 v -2"
        fill="none"
        :style="{ stroke: art('camera') }"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </g>
    <!-- 错题学习：笔记本 + ✕（2026-10-11 定稿，占 x6~34 / y1.5~36） -->
    <g v-else-if="kind === 'book'">
      <rect x="15" y="1.5" width="10" height="6" rx="2.5" fill="#ffffff" opacity="0.9" />
      <rect x="6" y="4" width="28" height="32" rx="5" :style="{ fill: art('book') }" />
      <rect x="10.5" y="9" width="19" height="23" rx="2.5" fill="#ffffff" />
      <path d="M 15.6 15.2 l 8.8 8.8 M 24.4 15.2 l -8.8 8.8" fill="none" :style="{ stroke: art('book') }" stroke-width="3" stroke-linecap="round" />
      <rect x="15" y="27.4" width="10" height="2.2" rx="1.1" :style="{ fill: art('book') }" opacity="0.5" />
    </g>
    <!-- AI 对话：气泡 + 星芒（整体居中，占 x3~37 / y6~31，不再越界） -->
    <g v-else-if="kind === 'chat'">
      <path
        d="M -16 -12 h 24 a 5 5 0 0 1 5 5 v 9 a 5 5 0 0 1 -5 5 h -14 l -7 6 v -6 h -3 a 5 5 0 0 1 -5 -5 v -9 a 5 5 0 0 1 5 -5 z"
        :style="{ fill: art('chat') }"
        transform="translate(24 18)"
      />
      <circle cx="15" cy="15.5" r="2" fill="#ffffff" />
      <circle cx="23" cy="15.5" r="2" fill="#ffffff" />
      <circle cx="31" cy="15.5" r="2" fill="#ffffff" />
      <path d="M 0 -4.5 l 1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" :style="{ fill: art('chat-star') }" transform="translate(33 7)" />
    </g>
    <!-- AI 学习中心：星芒主星 + 环绕轨道 + 小星（2026-10-11 样图定稿，占 x4~36 / y4~32） -->
    <g v-else-if="kind === 'aiStar'">
      <ellipse
        cx="20"
        cy="21.4"
        rx="15.4"
        ry="6"
        fill="none"
        :style="{ stroke: art('ai-star') }"
        stroke-width="1.8"
        opacity="0.4"
        transform="rotate(-22 20 21.4)"
      />
      <path d="M 20 5.5 l 3.6 9.4 9.4 3.6 -9.4 3.6 -3.6 9.4 -3.6 -9.4 -9.4 -3.6 9.4 -3.6 z" :style="{ fill: art('ai-star') }" />
      <path d="M 31 3.6 l 1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" :style="{ fill: art('ai-star') }" opacity="0.75" />
      <circle cx="6.6" cy="30.6" r="2" :style="{ fill: art('ai-star') }" opacity="0.55" />
    </g>
    <!-- 学习工具：魔棒 + 三颗星芒（2026-10-11 样图定稿，占 x6~36 / y4~34） -->
    <g v-else-if="kind === 'wand'">
      <g transform="rotate(38 20 20)">
        <rect x="17.5" y="12" width="5" height="24" rx="2.5" :style="{ fill: art('wand') }" />
        <rect x="15.6" y="9" width="8.8" height="5" rx="2" fill="#ffffff" opacity="0.95" />
      </g>
      <path d="M 28 6 l 1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" :style="{ fill: art('wand') }" />
      <path d="M 33.6 17 l 1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" :style="{ fill: art('wand') }" opacity="0.7" />
      <path d="M 9 25 l 1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2 z" :style="{ fill: art('wand') }" opacity="0.55" />
    </g>
    <!-- 学习工具（旧）：铅笔 × 尺子（刻度线补 fill=none，消除默认黑色填充遮挡） -->
    <g v-else>
      <g transform="rotate(40 20 20)">
        <rect x="16.5" y="2" width="7" height="22" rx="1.5" :style="{ fill: art('pencil') }" />
        <path d="M 16.5 24 h 7 l -3.5 7 z" fill="#ffffff" />
        <rect x="16.5" y="-1" width="7" height="4.5" rx="1.5" fill="#ffffff" opacity="0.9" />
      </g>
      <g transform="rotate(-40 20 20)">
        <rect x="4" y="15.5" width="30" height="9" rx="2" :style="{ fill: art('ruler') }" />
        <path d="M 10 15.5 v 4.5 M 16 15.5 v 4.5 M 22 15.5 v 4.5 M 28 15.5 v 4.5" fill="none" stroke="#ffffff" stroke-width="1.5" />
      </g>
    </g>
  </svg>
</template>

<script setup>
/**
 * 首页四大卡双色图案（相机 / 笔记本 / 气泡星芒 / 学习工具）。
 * 2026-10-11 更新：AI 学习中心=星芒主星（aiStar）、学习工具=魔棒星芒（wand，替代原铅笔尺子）。
 * 统一网格：40×40 画布内居中，各图案占约 28~34 视觉宽度，避免大小/位置不一致。
 * 颜色走主题 token --art-*：浅色=样图原色，深色=提亮版（见 themes.css）。
 * 注意：SVG 里所有开放 path（刻度线等）必须显式 fill="none"，否则默认黑色填充会盖住图案。
 */
const props = defineProps({
  name: { type: String, required: true },
})

const MAP = { camera: 'camera', book: 'book', chat: 'chat', sparkle: 'tool', aiStar: 'aiStar', wand: 'wand' }
const art = (key) => `var(--art-${key})`
const kind = MAP[props.name] || 'tool'
</script>
