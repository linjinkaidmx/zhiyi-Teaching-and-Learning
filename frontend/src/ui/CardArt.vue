<template>
  <svg class="card-art" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
    <!-- 拍照搜题：照相机（样图定稿，占 x3~37 / y3.5~33） -->
    <g v-if="kind === 'camera'">
      <path d="M 13 10 v -4 a 2.5 2.5 0 0 1 2.5 -2.5 h 9 a 2.5 2.5 0 0 1 2.5 2.5 v 4 z" :style="{ fill: art('camera') }" />
      <rect x="3" y="10" width="34" height="23" rx="6" :style="{ fill: art('camera') }" />
      <circle cx="20" cy="21" r="8.5" fill="#ffffff" />
      <circle cx="20" cy="21" r="4.5" :style="{ fill: art('camera') }" />
      <rect x="30" y="14" width="4.5" height="3" rx="1" fill="#ffffff" opacity="0.85" />
    </g>
    <!-- 错题学习：笔记本（放大居中，占 x6~34 / y1.5~36） -->
    <g v-else-if="kind === 'book'">
      <rect x="15" y="1.5" width="10" height="6" rx="2.5" fill="#ffffff" opacity="0.9" />
      <rect x="6" y="4" width="28" height="32" rx="5" :style="{ fill: art('book') }" />
      <rect x="10.5" y="9" width="19" height="23" rx="2.5" fill="#ffffff" />
      <path d="M 17 18 l 4 4 l 7 -8" fill="none" :style="{ stroke: art('book') }" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
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
    <!-- 学习工具：铅笔 × 尺子（刻度线补 fill=none，消除默认黑色填充遮挡） -->
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
 * 首页四大卡双色图案（样图定稿：相机 / 笔记本 / 气泡星芒 / 铅笔尺子）。
 * 统一网格：40×40 画布内居中，各图案占约 28~34 视觉宽度，避免大小/位置不一致。
 * 颜色走主题 token --art-*：浅色=样图原色，深色=提亮版（见 themes.css）。
 * 注意：SVG 里所有开放 path（刻度线等）必须显式 fill="none"，否则默认黑色填充会盖住图案。
 */
const props = defineProps({
  name: { type: String, required: true },
})

const MAP = { camera: 'camera', book: 'book', chat: 'chat', sparkle: 'tool' }
const art = (key) => `var(--art-${key})`
const kind = MAP[props.name] || 'tool'
</script>
