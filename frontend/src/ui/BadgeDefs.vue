<template>
  <!-- 奖章渐变与滤镜：全站定义一次（id 前缀 bm-），避免每枚奖章重复 defs -->
  <svg class="bm-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="bm-g-common" x1=".2" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="#ecc59a" /><stop offset=".48" stop-color="#d29a64" /><stop offset="1" stop-color="#a96730" />
      </linearGradient>
      <linearGradient id="bm-g-rare" x1=".2" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="#f4f7fc" /><stop offset=".45" stop-color="#ccd5e4" /><stop offset="1" stop-color="#8b98b0" />
      </linearGradient>
      <linearGradient id="bm-g-epic" x1=".2" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="#ffe9a8" /><stop offset=".45" stop-color="#f2bf4e" /><stop offset="1" stop-color="#be8218" />
      </linearGradient>
      <linearGradient id="bm-g-legend" x1=".15" y1="0" x2=".85" y2="1">
        <stop offset="0" stop-color="#d9ccff" /><stop offset=".45" stop-color="#9b83fb" /><stop offset="1" stop-color="#5b47d6" />
      </linearGradient>
      <linearGradient id="bm-g-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".9" />
        <stop offset=".5" stop-color="#ffffff" stop-opacity=".15" />
        <stop offset="1" stop-color="#ffffff" stop-opacity=".65" />
      </linearGradient>
      <radialGradient id="bm-g-halo" cx=".5" cy=".5" r=".5">
        <stop offset=".62" stop-color="#9b83fb" stop-opacity="0" />
        <stop offset=".82" stop-color="#9b83fb" stop-opacity=".38" />
        <stop offset="1" stop-color="#6f57f0" stop-opacity="0" />
      </radialGradient>
      <filter id="bm-soft" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#1b2340" flood-opacity=".28" />
      </filter>
    </defs>
  </svg>
</template>

<script setup>
/**
 * 奖章全局定义（BadgeDefs）
 * ---------------------------------------------------------------------------
 * 挂载一次即可（AppShell 内）。奖章组件 BadgeMedal 通过 url(#bm-...) 引用这里的渐变。
 */
</script>

<style scoped>
.bm-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
