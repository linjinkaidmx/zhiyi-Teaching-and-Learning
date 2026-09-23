<template>
  <div class="hbg" aria-hidden="true">
    <!-- 浅色：流动的河流 + 白色纸船（样图定稿版） -->
    <div class="hbg__river">
      <div class="hbg__water">
        <svg class="hbg__scene hbg__scene--m" viewBox="0 0 390 540" preserveAspectRatio="xMidYMax slice">
          <defs>
            <path id="hbgPathBM" d="M 481 30 C 379 92, 223 252, -67 512" fill="none" />
            <g id="hbgBoatM">
              <ellipse cx="0" cy="14" rx="30" ry="5" fill="#5FA8CC" opacity="0.28" />
              <path d="M -30 12 Q 0 19 30 12" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.72" />
              <path d="M -24 16 Q 0 22 24 16" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.45" />
              <path d="M -28 1 L 28 1 L 19 13 L -19 13 Z" fill="#E8A06A" stroke="#C9814A" stroke-width="2" stroke-linejoin="round" />
              <path d="M 0 1 L 0 -22" stroke="#B4763F" stroke-width="2.2" stroke-linecap="round" />
              <path d="M 1 -20 L 19 -6 L 1 -2 Z" fill="#F2C98A" stroke="#D9A459" stroke-width="1.6" stroke-linejoin="round" />
            </g>
          </defs>
          <g fill="none" stroke="#FFFFFF" stroke-linecap="round">
            <path class="hbg-f3" d="M 169 164 Q 111 180, 56 196" stroke-width="5" stroke-dasharray="52 54" opacity="0.6" />
            <path class="hbg-f4" d="M 218 318 Q 165 334, 111 350" stroke-width="4.5" stroke-dasharray="46 60" opacity="0.55" />
            <path class="hbg-f5" d="M 245 412 Q 167 436, 100 456" stroke-width="5.5" stroke-dasharray="46 60" opacity="0.65" />
          </g>
          <!-- 船只：固定在水面中段（参考图位置），靠起伏 + 水平轻漂产生动感；
               原来沿 88s 长路径漂移，水面区被 slice 裁掉后大部分时间在可视区外 -->
          <g transform="translate(122 292) scale(0.86)">
            <g class="hbg-bob1">
              <g class="hbg-drift">
                <use href="#hbgBoatM" />
              </g>
            </g>
          </g>
        </svg>
        <svg class="hbg__scene hbg__scene--d" viewBox="0 0 1200 540" preserveAspectRatio="xMidYMax slice">
          <defs>
            <path id="hbgPathBD" d="M 1290 300 C 1010 370, 590 450, -90 545" fill="none" />
            <g id="hbgBoatD">
              <ellipse cx="0" cy="14" rx="30" ry="5" fill="#5FA8CC" opacity="0.28" />
              <path d="M -30 12 Q 0 19 30 12" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.72" />
              <path d="M -24 16 Q 0 22 24 16" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.45" />
              <path d="M -28 1 L 28 1 L 19 13 L -19 13 Z" fill="#E8A06A" stroke="#C9814A" stroke-width="2" stroke-linejoin="round" />
              <path d="M 0 1 L 0 -22" stroke="#B4763F" stroke-width="2.2" stroke-linecap="round" />
              <path d="M 1 -20 L 19 -6 L 1 -2 Z" fill="#F2C98A" stroke="#D9A459" stroke-width="1.6" stroke-linejoin="round" />
            </g>
          </defs>
          <g fill="none" stroke="#FFFFFF" stroke-linecap="round">
            <path class="hbg-f3" d="M 710 240 Q 530 285, 350 330" stroke-width="5.5" stroke-dasharray="58 48" opacity="0.55" />
            <path class="hbg-f4" d="M 570 380 Q 390 420, 210 460" stroke-width="5" stroke-dasharray="52 54" opacity="0.55" />
            <path class="hbg-f5" d="M 1250 470 Q 1050 500, 870 530" stroke-width="6" stroke-dasharray="52 54" opacity="0.6" />
          </g>
          <!-- 桌面版船只：固定在水面中段偏左，同样靠起伏 + 轻漂 -->
          <g transform="translate(548 424) scale(1.05)">
            <g class="hbg-bob1">
              <g class="hbg-drift">
                <use href="#hbgBoatD" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>

    <!-- 深色：流动的星河 + 紫星球金环（v5 定稿版） -->
    <div class="hbg__star">
      <svg class="hbg__nightsky" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="hbgGw1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#FFFFFF" stop-opacity="0" />
            <stop offset="0.5" stop-color="#E6EEFF" stop-opacity="0.18" />
            <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="hbgGw2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#FFFFFF" stop-opacity="0" />
            <stop offset="0.5" stop-color="#DDE6FF" stop-opacity="0.13" />
            <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
          </linearGradient>
          <filter id="hbgBlur"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <g class="hbg-tw1">
          <circle cx="64" cy="80" r="1.1" fill="#FFFFFF" opacity="0.7" /><circle cx="210" cy="150" r="1.1" fill="#CFD6FF" opacity="0.55" /><circle cx="356" cy="60" r="1.1" fill="#FFE9C4" opacity="0.8" /><circle cx="520" cy="200" r="1.1" fill="#FFFFFF" opacity="0.4" /><circle cx="680" cy="90" r="1.1" fill="#CFD6FF" opacity="0.75" /><circle cx="830" cy="170" r="1.1" fill="#FFFFFF" opacity="0.5" /><circle cx="990" cy="70" r="1.1" fill="#FFE9C4" opacity="0.65" /><circle cx="1120" cy="210" r="1.1" fill="#FFFFFF" opacity="0.45" /><circle cx="140" cy="320" r="1.1" fill="#CFD6FF" opacity="0.6" /><circle cx="430" cy="380" r="1.1" fill="#FFFFFF" opacity="0.5" /><circle cx="760" cy="330" r="1.1" fill="#FFE9C4" opacity="0.55" /><circle cx="1050" cy="400" r="1.1" fill="#FFFFFF" opacity="0.4" /><circle cx="90" cy="520" r="1.1" fill="#CFD6FF" opacity="0.6" /><circle cx="330" cy="560" r="1.1" fill="#FFFFFF" opacity="0.45" /><circle cx="600" cy="610" r="1.1" fill="#FFE9C4" opacity="0.5" /><circle cx="880" cy="540" r="1.1" fill="#FFFFFF" opacity="0.6" /><circle cx="1150" cy="600" r="1.1" fill="#CFD6FF" opacity="0.5" /><circle cx="250" cy="440" r="1.1" fill="#FFFFFF" opacity="0.4" /><circle cx="700" cy="480" r="1.1" fill="#FFFFFF" opacity="0.55" /><circle cx="960" cy="300" r="1.1" fill="#CFD6FF" opacity="0.5" />
        </g>
        <g class="hbg-tw2">
          <circle cx="130" cy="110" r="1.6" fill="#FFFFFF" opacity="0.85" /><circle cx="300" cy="240" r="1.6" fill="#FFE9C4" opacity="0.7" /><circle cx="470" cy="120" r="1.6" fill="#CFD6FF" opacity="0.8" /><circle cx="620" cy="260" r="1.6" fill="#FFFFFF" opacity="0.6" /><circle cx="800" cy="60" r="1.6" fill="#FFE9C4" opacity="0.9" /><circle cx="920" cy="220" r="1.6" fill="#FFFFFF" opacity="0.65" /><circle cx="1080" cy="120" r="1.6" fill="#CFD6FF" opacity="0.75" /><circle cx="60" cy="420" r="1.6" fill="#FFFFFF" opacity="0.7" /><circle cx="380" cy="470" r="1.6" fill="#FFE9C4" opacity="0.6" /><circle cx="540" cy="520" r="1.6" fill="#FFFFFF" opacity="0.65" /><circle cx="820" cy="430" r="1.6" fill="#CFD6FF" opacity="0.7" /><circle cx="1010" cy="520" r="1.6" fill="#FFFFFF" opacity="0.6" /><circle cx="1180" cy="330" r="1.6" fill="#FFE9C4" opacity="0.7" /><circle cx="220" cy="600" r="1.6" fill="#FFFFFF" opacity="0.6" /><circle cx="680" cy="560" r="1.6" fill="#CFD6FF" opacity="0.65" /><circle cx="900" cy="620" r="1.6" fill="#FFFFFF" opacity="0.55" /><circle cx="480" cy="330" r="1.6" fill="#FFFFFF" opacity="0.7" /><circle cx="740" cy="170" r="1.6" fill="#FFE9C4" opacity="0.6" /><circle cx="180" cy="230" r="1.6" fill="#FFFFFF" opacity="0.65" /><circle cx="400" cy="40" r="1.6" fill="#CFD6FF" opacity="0.7" />
        </g>
        <g class="hbg-tw3">
          <circle cx="90" cy="180" r="2.3" fill="#FFFFFF" opacity="0.95" /><circle cx="260" cy="90" r="2.3" fill="#FFE9C4" opacity="0.85" /><circle cx="520" cy="70" r="2.3" fill="#CFD6FF" opacity="0.8" /><circle cx="720" cy="140" r="2.3" fill="#FFFFFF" opacity="0.9" /><circle cx="1010" cy="90" r="2.3" fill="#FFE9C4" opacity="0.8" /><circle cx="1150" cy="260" r="2.3" fill="#FFFFFF" opacity="0.75" /><circle cx="340" cy="330" r="2.3" fill="#CFD6FF" opacity="0.8" /><circle cx="620" cy="420" r="2.3" fill="#FFFFFF" opacity="0.7" /><circle cx="880" cy="360" r="2.3" fill="#FFE9C4" opacity="0.85" /><circle cx="1100" cy="480" r="2.3" fill="#FFFFFF" opacity="0.7" /><circle cx="150" cy="640" r="2.3" fill="#CFD6FF" opacity="0.75" /><circle cx="450" cy="620" r="2.3" fill="#FFFFFF" opacity="0.65" /><circle cx="790" cy="650" r="2.3" fill="#FFE9C4" opacity="0.7" /><circle cx="1060" cy="640" r="2.3" fill="#FFFFFF" opacity="0.6" /><circle cx="40" cy="300" r="2.3" fill="#FFE9C4" opacity="0.8" /><circle cx="560" cy="180" r="2.3" fill="#FFFFFF" opacity="0.85" /><circle cx="960" cy="150" r="2.3" fill="#CFD6FF" opacity="0.8" /><circle cx="840" cy="240" r="2.3" fill="#FFFFFF" opacity="0.7" /><circle cx="300" cy="500" r="2.3" fill="#FFE9C4" opacity="0.7" /><circle cx="700" cy="540" r="2.3" fill="#FFFFFF" opacity="0.75" />
        </g>
        <g transform="rotate(-18 600 350)">
          <rect x="-320" y="295" width="1840" height="110" rx="55" fill="url(#hbgGw1)" filter="url(#hbgBlur)" opacity="0.55">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-180 0" dur="48s" repeatCount="indefinite" />
          </rect>
          <rect x="-280" y="322" width="1760" height="54" rx="27" fill="url(#hbgGw2)" filter="url(#hbgBlur)" opacity="0.45">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-130 0" dur="34s" repeatCount="indefinite" />
          </rect>
        </g>
      </svg>
      <!-- 紫星球金环：独立定位层（不参与银河 SVG 的 slice 裁剪，任何视口都稳定可见） -->
      <div class="hbg__planet">
        <svg viewBox="0 0 300 200" width="100%" height="100%" aria-hidden="true">
          <defs>
            <radialGradient id="hbgHaloP">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.3" />
              <stop offset="0.55" stop-color="#E8EDFF" stop-opacity="0.12" />
              <stop offset="1" stop-color="#E8EDFF" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="hbgBallP" cx="0.36" cy="0.3" r="0.95">
              <stop offset="0" stop-color="#C6B8FD" />
              <stop offset="0.28" stop-color="#8E7FE0" />
              <stop offset="0.52" stop-color="#4A3D8F" />
              <stop offset="0.72" stop-color="#241B56" />
              <stop offset="0.88" stop-color="#160E38" />
              <stop offset="1" stop-color="#0C0824" />
            </radialGradient>
            <radialGradient id="hbgAtmP">
              <stop offset="0.8" stop-color="#C6B8FD" stop-opacity="0" />
              <stop offset="1" stop-color="#C6B8FD" stop-opacity="0.4" />
            </radialGradient>
            <linearGradient id="hbgRingP" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#F0BE5A" />
              <stop offset="0.5" stop-color="#FFD98A" />
              <stop offset="1" stop-color="#FFF0C4" />
            </linearGradient>
            <clipPath id="hbgBallClipP"><circle cx="0" cy="0" r="62" /></clipPath>
            <clipPath id="hbgRingClipP"><rect x="-160" y="2" width="320" height="120" /></clipPath>
            <g id="hbgPlanetSurfaceP">
              <ellipse cx="-20" cy="-12" rx="30" ry="13" fill="#D2C8FF" opacity="0.16" transform="rotate(-14 -20 -12)" />
              <ellipse cx="34" cy="22" rx="22" ry="9" fill="#D2C8FF" opacity="0.13" transform="rotate(10 34 22)" />
              <ellipse cx="-14" cy="34" rx="16" ry="7" fill="#D2C8FF" opacity="0.1" />
              <rect x="-70" y="-26" width="140" height="7" fill="#FFFFFF" opacity="0.09" />
              <rect x="-70" y="6" width="140" height="5" fill="#FFFFFF" opacity="0.07" />
            </g>
          </defs>
          <ellipse cx="150" cy="100" rx="150" ry="105" fill="url(#hbgHaloP)" />
          <g transform="translate(150 100)">
            <g transform="rotate(-14)">
              <ellipse cx="0" cy="0" rx="132" ry="34" fill="none" stroke="url(#hbgRingP)" stroke-width="3" opacity="0.6" />
              <ellipse class="hbg-spark2" cx="0" cy="0" rx="132" ry="34" fill="none" stroke="#FFF3CF" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="22 607" />
              <ellipse cx="0" cy="0" rx="116" ry="29" fill="none" stroke="url(#hbgRingP)" stroke-width="7" opacity="0.9" />
              <ellipse class="hbg-spark1" cx="0" cy="0" rx="116" ry="29" fill="none" stroke="#FFF7DA" stroke-width="4" stroke-linecap="round" stroke-dasharray="26 703" />
            </g>
            <circle cx="0" cy="0" r="74" fill="url(#hbgAtmP)" />
            <circle cx="0" cy="0" r="62" fill="url(#hbgBallP)" />
            <g clip-path="url(#hbgBallClipP)">
              <g>
                <use href="#hbgPlanetSurfaceP" />
                <use href="#hbgPlanetSurfaceP" transform="translate(124 0)" />
                <animateTransform attributeName="transform" type="translate" from="0 0" to="-124 0" dur="64s" repeatCount="indefinite" />
              </g>
              <path d="M 14 -60.4 A 62 62 0 0 1 14 60.4 A 84 84 0 0 0 14 -60.4 Z" fill="#04061A" opacity="0.55" />
            </g>
            <g transform="rotate(-14)" clip-path="url(#hbgRingClipP)">
              <ellipse cx="0" cy="0" rx="116" ry="29" fill="none" stroke="url(#hbgRingP)" stroke-width="7" opacity="0.95" />
              <ellipse cx="0" cy="0" rx="132" ry="34" fill="none" stroke="url(#hbgRingP)" stroke-width="3" opacity="0.65" />
            </g>
          </g>
        </svg>
      </div>
      <span class="hbg__meteor hbg__meteor--1"></span>
      <span class="hbg__meteor hbg__meteor--2"></span>
    </div>
  </div>
</template>

<script>
/**
 * 首页动态背景（纯 CSS + SVG，零 JS；prefers-reduced-motion 全部静止）。
 * 浅色 = 流动的河流 + 白色纸船（样图定稿）：淡蓝天空渐变 + 3 朵白云横漂 +
 *   大面积水面 + 米黄斜切岸 + 流线水光 + 两只立体描边纸船（大船 72s / 小船 88s 一趟，起止在画面外）。
 * 深色 = 流动的星河（v5 定稿）：60 星点三档明灭 + 银河两层流动 + 流星两颗 +
 *   紫色星球（自转 64s）+ 金色星环（与银河带平行、柔化）+ 环上流光。
 * 主题切换：html[data-theme] 由 main.js 写入，两个场景用 CSS display 切换。
 */
export default { name: 'HomeBackground' }
</script>

<style>
/* 注意：本组件样式必须全局（非 scoped），html[data-theme] 祖先选择器才能生效 */
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
}
.hbg__river,
.hbg__star {
  display: none;
  position: absolute;
  inset: 0;
}
html[data-theme='light'] .hbg__river {
  display: block;
  background: linear-gradient(180deg, #e3f2fb 0%, #f4fafe 100%);
}
html[data-theme='dark'] .hbg__star {
  display: block;
  background: radial-gradient(120% 90% at 70% 8%, #1a2140 0%, #0c1024 55%, #070a18 100%);
}

/* ---------------- 浅色：云 ---------------- */
.hbg__cloud {
  position: absolute;
  width: 120px;
  height: 44px;
}
.hbg__cloud i {
  position: absolute;
  background: #ffffff;
  border-radius: 50%;
}
.hbg__cloud i:nth-child(1) {
  left: 0;
  top: 14px;
  width: 64px;
  height: 30px;
}
.hbg__cloud i:nth-child(2) {
  left: 44px;
  top: 0;
  width: 54px;
  height: 40px;
}
.hbg__cloud i:nth-child(3) {
  left: 80px;
  top: 16px;
  width: 40px;
  height: 26px;
}
.hbg__cloud--1 {
  top: 4%;
  opacity: 0.95;
  animation: hbgCloud 95s linear infinite;
}
.hbg__cloud--2 {
  top: 12%;
  opacity: 0.8;
  transform: scale(0.8);
  animation: hbgCloud 72s linear infinite;
  animation-delay: -30s;
}
.hbg__cloud--3 {
  top: 7%;
  opacity: 0.65;
  transform: scale(0.62);
  animation: hbgCloud 58s linear infinite;
  animation-delay: -46s;
}
@keyframes hbgCloud {
  from {
    transform: translateX(110vw);
  }
  to {
    transform: translateX(-160px);
  }
}
.hbg__cloud--2,
.hbg__cloud--3 {
  animation-name: hbgCloudScale;
}

/* ---------------- 浅色：水面带 + 场景 ---------------- */
.hbg__water {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(300px, 54vh, 560px);
  background: linear-gradient(180deg, #d6eaf7 0%, #c7e0f1 100%);
}
@media (min-width: 768px) {
  .hbg__water {
    height: clamp(320px, 50vh, 560px);
  }
}
.hbg__scene {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: block;
}
svg.hbg__scene--d {
  display: none;
}
@media (min-width: 768px) {
  svg.hbg__scene--m {
    display: none;
  }
  svg.hbg__scene--d {
    display: block;
  }
}
@keyframes hbgCloudScale {
  from {
    transform: translateX(110vw) scale(0.8);
  }
  to {
    transform: translateX(-160px) scale(0.8);
  }
}
.hbg__cloud--3 {
  animation-name: hbgCloudScale3;
}
@keyframes hbgCloudScale3 {
  from {
    transform: translateX(110vw) scale(0.62);
  }
  to {
    transform: translateX(-160px) scale(0.62);
  }
}
@keyframes hbgFlow {
  to {
    stroke-dashoffset: -212;
  }
}
.hbg-f1 {
  animation: hbgFlow 15s linear infinite;
}
.hbg-f2 {
  animation: hbgFlow 18s linear infinite;
}
.hbg-f3 {
  animation: hbgFlow 11s linear infinite;
}
.hbg-f4 {
  animation: hbgFlow 14s linear infinite;
}
.hbg-f5 {
  animation: hbgFlow 16s linear infinite;
}
@keyframes hbgBob1 {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2.5px);
  }
}
@keyframes hbgBob2 {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
.hbg-bob1 {
  animation: hbgBob1 6s ease-in-out infinite;
}
/* 水平轻漂：作用于内层 g（起伏动画已占用 .hbg-bob1 的 transform，不能同层） */
.hbg-drift {
  animation: hbgDrift 26s ease-in-out infinite alternate;
}
@keyframes hbgDrift {
  from { transform: translateX(-16px); }
  to { transform: translateX(16px); }
}
@media (prefers-reduced-motion: reduce) {
  .hbg-drift { animation: none; }
}
.hbg-bob2 {
  animation: hbgBob2 5.2s ease-in-out infinite;
}

/* ---------------- 深色：星河 ---------------- */
.hbg__nightsky {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
@keyframes hbgTw {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
.hbg-tw1 {
  animation: hbgTw 6.5s ease-in-out infinite;
}
.hbg-tw2 {
  animation: hbgTw 7s ease-in-out infinite;
  animation-delay: -2.4s;
}
.hbg-tw3 {
  animation: hbgTw 8.5s ease-in-out infinite;
  animation-delay: -4.6s;
}
@keyframes hbgSpark {
  to {
    stroke-dashoffset: -729;
  }
}
.hbg-spark1 {
  animation: hbgSpark 8s linear infinite;
}
@keyframes hbgSpark2 {
  to {
    stroke-dashoffset: -629;
  }
}
.hbg-spark2 {
  animation: hbgSpark2 13s linear infinite;
}
.hbg__planet {
  position: absolute;
  left: 6%;
  top: 56%;
  transform: translateY(-50%);
  width: 208px;
  height: 139px;
}
@media (min-width: 768px) {
  .hbg__planet {
    left: 12%;
    width: 268px;
    height: 179px;
  }
}
.hbg__meteor {
  position: absolute;
  width: 140px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, #ffffff 90%);
  opacity: 0;
}
.hbg__meteor--1 {
  top: 16%;
  right: 12%;
  animation: hbgMeteor 9s linear infinite;
  animation-delay: 2s;
}
.hbg__meteor--2 {
  top: 34%;
  right: 38%;
  width: 100px;
  animation: hbgMeteor 13s linear infinite;
  animation-delay: 6.5s;
}
@keyframes hbgMeteor {
  0% {
    transform: translate(0, 0) rotate(-24deg);
    opacity: 0;
  }
  4% {
    opacity: 0.9;
  }
  14% {
    transform: translate(-34vw, 15vw) rotate(-24deg);
    opacity: 0;
  }
  100% {
    transform: translate(-34vw, 15vw) rotate(-24deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hbg__cloud--1,
  .hbg__cloud--2,
  .hbg__cloud--3,
  .hbg-f1,
  .hbg-f2,
  .hbg-f3,
  .hbg-f4,
  .hbg-f5,
  .hbg-bob1,
  .hbg-bob2,
  .hbg-tw1,
  .hbg-tw2,
  .hbg-tw3,
  .hbg-spark1,
  .hbg-spark2,
  .hbg__meteor--1,
  .hbg__meteor--2 {
    animation: none;
  }
}

/* ==========================================================================
   开场：场景展开（仅当 <html> 带 is-enter 时跑一次）
   ---------------------------------------------------------------------------
   只作用于「容器层」：云层整体、水面整体、星河/星球整体。
   叶子元素（每朵云、水光线、小船、星点）各自有常驻动画，
   在这里给它们加 animation 会覆盖掉漂移/流动，所以一律不碰。
   ========================================================================== */
html.is-enter .hbg__water {
  animation: hbgEnterUp 0.95s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}
html.is-enter .hbg__star {
  animation: hbgEnterFade 0.8s ease both;
}
html.is-enter .hbg__nightsky {
  animation: hbgEnterFade 1s ease 0.1s both;
}
html.is-enter .hbg__planet {
  animation: hbgEnterFade 1.1s ease 0.16s both;
}
html.is-enter .hbg__meteor {
  animation: hbgEnterFade 1s ease 0.3s both;
}

@keyframes hbgEnterDown {
  from { opacity: 0; transform: translateY(-18px); }
  to { opacity: 1; transform: none; }
}
@keyframes hbgEnterUp {
  from { opacity: 0; transform: translateY(26px); }
  to { opacity: 1; transform: none; }
}
@keyframes hbgEnterFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  html.is-enter .hbg__clouds,
  html.is-enter .hbg__water,
  html.is-enter .hbg__star,
  html.is-enter .hbg__nightsky,
  html.is-enter .hbg__planet,
  html.is-enter .hbg__meteor { animation: none; }
}
</style>
