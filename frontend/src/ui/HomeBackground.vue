<template>
  <div class="hbg" aria-hidden="true">
    <div class="hbg__glow hbg__glow--a"></div>
    <div class="hbg__glow hbg__glow--b"></div>
    <div class="hbg__glow hbg__glow--c"></div>
    <svg class="hbg__mark" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M89.5 35.6 A42 42 0 1 1 57.3 8.6" fill="none" stroke="#5b47d6" stroke-width="8.5" stroke-linecap="round" />
      <path d="M30 36 L70 36 L70 45 L44 55 L70 55 L70 64 L30 64 L30 55 L56 45 L30 45 Z" fill="#5b47d6" />
    </svg>
  </div>
</template>

<script>
/**
 * 首页动态背景（2026-10-13 品牌化重做）：品牌紫 + 暖色柔焦光斑 + 循环环水印。
 * ---------------------------------------------------------------------------
 * 替代早期「蓝天白云 + 河流 + 立体纸船」写实插画（与品牌紫玻璃拟态卡片流不符）。
 * 现在与开屏动画那层品牌紫径向柔光、页脚标语、今日横幅串成一条线。
 * 三个大半径 radial-gradient 光斑各自缓慢漂浮（18~26s 错开相位，几乎察觉不到但有呼吸感）。
 * 纯 CSS，零 JS；prefers-reduced-motion 全部静止。桌面端背景收进 Hero 卡后，
 * 光斑只在顶部与留白处透出极淡柔光，与移动端共用同一套、观感更统一。
 */
export default { name: 'HomeBackground' }
</script>

<style>
/* 注意：本组件样式必须全局（非 scoped），供 html.is-enter 祖先选择器触发入场 */
.hbg {
  position: absolute;
  top: 0;
  bottom: 0;
  /* 全宽出血：越过 zy-container 的 max-width，铺满视口 */
  left: calc(50% - 50vw);
  width: 100vw;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, #f7f6fd 0%, #fbfaff 100%);
}
.hbg__glow {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
}
.hbg__glow--a {
  width: 340px;
  height: 340px;
  left: -70px;
  top: -60px;
  background: radial-gradient(circle, rgba(124, 92, 255, 0.28), rgba(124, 92, 255, 0) 64%);
  animation: hbgDriftA 22s ease-in-out infinite alternate;
}
.hbg__glow--b {
  width: 300px;
  height: 300px;
  right: -70px;
  top: 170px;
  background: radial-gradient(circle, rgba(138, 107, 255, 0.2), rgba(138, 107, 255, 0) 64%);
  animation: hbgDriftB 26s ease-in-out infinite alternate;
  animation-delay: -6s;
}
.hbg__glow--c {
  width: 320px;
  height: 320px;
  left: -50px;
  bottom: 40px;
  background: radial-gradient(circle, rgba(250, 199, 117, 0.2), rgba(250, 199, 117, 0) 64%);
  animation: hbgDriftC 18s ease-in-out infinite alternate;
  animation-delay: -12s;
}
.hbg__mark {
  position: absolute;
  right: -34px;
  bottom: -34px;
  width: 150px;
  height: 150px;
  opacity: 0.05;
}
@keyframes hbgDriftA {
  from { transform: translate(0, 0); }
  to { transform: translate(26px, 20px); }
}
@keyframes hbgDriftB {
  from { transform: translate(0, 0); }
  to { transform: translate(-30px, 26px); }
}
@keyframes hbgDriftC {
  from { transform: translate(0, 0); }
  to { transform: translate(24px, -20px); }
}

/* 入场：整个背景层淡入（配合首页 is-enter 级联；不动光斑的 transform，避免覆盖漂移动画） */
html.is-enter .hbg {
  animation: hbgEnterFade 1s ease both;
}
@keyframes hbgEnterFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 桌面端加强（2026-10-13 方案 A）：桌面内容盖满，默认光斑太淡几乎看不见——
   加大尺寸 + 提高透明度，让 Hero 卡四周与右侧留白透出明显品牌紫氛围；移动端不受影响 */
@media (min-width: 1024px) {
  .hbg__glow--a {
    width: 520px;
    height: 520px;
    left: 6%;
    top: -90px;
    background: radial-gradient(circle, rgba(124, 92, 255, 0.42), rgba(124, 92, 255, 0) 66%);
  }
  .hbg__glow--b {
    width: 460px;
    height: 460px;
    right: -60px;
    top: 10%;
    background: radial-gradient(circle, rgba(138, 107, 255, 0.32), rgba(138, 107, 255, 0) 66%);
  }
  .hbg__glow--c {
    width: 500px;
    height: 500px;
    left: 28%;
    bottom: -90px;
    background: radial-gradient(circle, rgba(250, 199, 117, 0.28), rgba(250, 199, 117, 0) 66%);
  }
  .hbg__mark {
    width: 230px;
    height: 230px;
    opacity: 0.07;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hbg__glow { animation: none; }
  html.is-enter .hbg { animation: none; }
}
</style>
