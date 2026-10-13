<template>
  <div>
    <!-- 角色活动层：不挡页面点击；桌面全站、移动仅首页 -->
    <div v-show="visible" class="comp-layer" aria-hidden="true">
      <div
        ref="elRef"
        class="companion breathing"
        :style="{ width: compWidth, height: compHeight }"
        @click="onClicked"
        @mouseenter="onHover"
        @contextmenu.prevent="onContext"
      >
        <div ref="shadowRef" class="shadow"></div>
        <div class="img-wrap">
          <img v-show="!walkOn" ref="imgRef" :src="curSrc" alt="" draggable="false" />
          <canvas v-show="walkOn" ref="walkCanvasRef" class="walk-canvas" :style="walkCanvasStyle"></canvas>
        </div>
        <div v-if="cfg && cfg.move === 'skate' && !cfg.walkFrames" ref="boardRef" class="skateboard"></div>
        <div ref="bubbleRef" class="bubble" :class="{ show: bubbleShow, clickable: bubbleQuiz }" :style="bubbleStyle" @click="onBubbleClick">{{ bubbleText }}</div>
        <!-- 小老师求教泡的红问号：约头部大小，与求教泡同生共死，点它=点气泡；贴边自动换侧 -->
        <div v-show="qmarkShow" class="comp-qmark" :class="{ 'qmark-left': qmarkLeft }" @click.stop="onBubbleClick">？</div>
        <!-- 试点（知夏）：待命箭头 + 常驻聊天按钮（单击角色已改为移动模式；FAB 已放开全角色——
             可移动角色单击=移动模式不再开聊天，必须有 FAB 兜底入口，否则角色无任何对话入口） -->
        <div v-if="moveMode === 'await'" class="comp-go-arrow">▼</div>
        <div
          v-if="cfg"
          class="comp-chat-fab"
          :title="'和' + activeName + '聊天'"
          @click.stop="openChat()"
        >💬</div>
        <!-- 告别 ✕：悬停角色浮现（移动端常显小号）；点击说告别词后离场，本会话不再出现，下次打开网站自动回归 -->
        <button
          class="comp-close"
          :title="'让' + activeName + '先去忙'"
          @click.stop="dismissCompanion"
        >✕</button>
      </div>
      <!-- 两段式移动的目的地标记（fixed 定位，屏内任意位置） -->
      <div
        v-if="marker.show"
        class="comp-marker"
        :class="{ fade: marker.fade }"
        :style="{ left: marker.x + 'px', top: marker.y + 'px' }"
      ></div>
      <!-- 特效层（星光/冲击波，命令式挂载，与 Vue 渲染区隔离） -->
      <div ref="fxRef" class="comp-fx"></div>
    </div>

    <!-- 待命模式捕获层：第二击只选目的地，不透传页面（z 低于角色层，点角色仍是取消）。
         2026-10-13 修移动端选点穿透：存活由 captureOn 独立管理（与 moveMode 解耦）——
         选完点多罩 450ms 再撤（覆盖移动端 tap 的 click/点按高亮派发窗口），
         并用 click/pointerup 的 stop+prevent 双保险吞掉透传；桌面行为不变 -->
    <div v-if="captureOn && visible" class="comp-capture" @pointerdown.prevent.stop="onCaptureDown" @pointerup.stop.prevent @click.stop.prevent></div>

    <!-- 迷你聊天面板 -->
    <div v-show="chatOpen && visible" class="comp-chat" :style="chatPos">
      <div class="comp-chat__head">
        <span class="comp-chat__title">和 {{ activeName }} 聊天</span>
        <span style="flex: 1"></span>
        <span class="comp-chat__btn" title="给TA改名" @click="startRename">改名</span>
        <span class="comp-chat__btn" title="打开完整互学界面" @click="goPage">伙伴页 →</span>
        <span
          v-if="cfg && cfg.styles"
          class="comp-chat__btn"
          @click="cycleStyle"
        >画风：{{ styleLabel }}</span>
        <span class="comp-chat__btn" @click="chatOpen = false">✕</span>
      </div>
      <div v-if="renaming" class="comp-chat__rename">
        <input
          v-model="renameBuf"
          maxlength="6"
          placeholder="新名字（最多6字）"
          @keyup.enter="confirmRename"
          @blur="confirmRename"
        />
      </div>
      <!-- 换搭子：头像横排 -->
      <div class="comp-chat__picker">
        <div
          v-for="c in allChars"
          :key="c.id"
          class="pick-chip"
          :class="{ active: c.id === activeId }"
          :title="'选择 ' + nameOf(c)"
          @click="selectCharacter(c.id)"
        >
          <!-- loading=lazy: 面板 v-show 隐藏时 lazy 图不发请求，省 7 张立绘 ~625KB 冷启流量(2026-10-08) -->
          <img :src="c.src" alt="" loading="lazy" /><span>{{ nameOf(c) }}</span>
        </div>
      </div>
      <!-- 角色大小（2026-10-10 用户拍板）：与伙伴页滑块同一全局值，实时应用+防抖写云端 -->
      <div class="comp-chat__sizerow">
        <span class="comp-chat__sizelabel">大小</span>
        <input v-model.number="chatSize" type="range" min="0.6" max="2" step="0.1"
               aria-label="调节角色大小" />
        <span class="comp-chat__sizeval">{{ chatSize.toFixed(1) }}x</span>
      </div>
      <div ref="logRef" class="comp-chat__log">
        <div v-for="(m, i) in msgs" :key="i" class="msg" :class="m.who">{{ m.text }}</div>
        <div v-if="thinking" class="msg ai comp-chat__typing">{{ activeName }} 正在想…</div>
      </div>
      <div class="comp-chat__row">
        <input
          v-model="draft"
          placeholder="说点什么…"
          @keyup.enter="sendMsg"
        />
        <button class="comp-chat__send" @click="sendMsg">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * CompanionLayer · 伴学角色层（M2 移植自 study-companion-demo.html）
 * ---------------------------------------------------------------------------
 * 资产层 /companions/ 透明 PNG；行为层状态机 idle → moving → excited；
 * 对话层 M3：接 /api/companion/chat（doubao 闲聊位，登录 20 次/日，游客提示登录）。
 * 显示策略（定案）：桌面端 ≥1024px 全站显示；移动端只在首页显示。
 * 与 demo 的差异：台词频率降为 45–120s；localStorage key 加 zy-comp- 前缀；
 * 换搭子选择器移进聊天面板（不再占用页面右上角）；番茄钟不搬。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROUTES } from '../lib/routes.js'
import { api } from '../api.js'
import { isLoggedIn } from '../auth.js'

/* ---------------- 角色配置（共享：lib/companions.js，与伙伴页同一份） ---------------- */
import { CHARACTERS, IDLE_LINES, SEEK_LINES, MOVE_HINT_LINES, QUOTA_LINES, GREET_LINES, BYE_LINES, GUEST_LINE, COMPANION_ASSETS, compLs as ls, subjectShort, findCharCfg, customLines, setCustomChars, customChars, activeId, setActiveCompId, isCharHidden, filterHiddenChars } from '../lib/companions.js'

/* ---------------- 显示策略：桌面全站 / 移动仅首页；伙伴页隐藏（页内已有舞台角色，避免双角色同屏） ----------------
 * hushed：用户点 ✕ 告别离场 → 本会话（sessionStorage）不再出现，下次打开网站自动回归
 * 隐藏角色：HIDDEN_CHAR_IDS 里的角色（奶龙/奶蛙）任何页面都不出现（见 companions.js 开关） */
const route = useRoute()
const router = useRouter()
const isDesktop = ref(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
const onMq = (e) => { isDesktop.value = e.matches }
const hushed = ref(false)
try { hushed.value = sessionStorage.getItem('zy-comp-hushed') === '1' } catch { /* 隐私模式：仅本次内存态 */ }
const visible = computed(
  () =>
    !hushed.value &&
    route.path !== ROUTES.companion &&
    (isDesktop.value || route.path === ROUTES.home) &&
    !isCharHidden(activeId.value),
)

/* ---------------- 学习场景贴边让位（2026-10-08 与用户定稿） ----------------
 * 进入 /capture（拍题+讲解结果一体页）或 /q/:id（讲解详情页）：角色静默走到最近的屏幕边缘，
 * 挂起求教冒泡与闲聊台词（安静陪读，用户主动点击聊天/移动不受限）；正在展示的求教泡自然播完不吞。
 * 离开时走回进页前的原位；但贴边期间用户手动挪过角色，则尊重用户位置不回位。
 * 2026-10-09：/teacher（AI 课堂）也归入学习场景——教学页有自己的老师立绘，
 * 伴学角色贴边安静陪着即可（否则会飘到讲义卡上盖住内容）。 */
const isStudyRoute = (p) => p === ROUTES.capture || p.startsWith('/q/') || p === ROUTES.teacher
const studyMode = computed(() => isStudyRoute(route.path))
let savedPos = null          // 进学习场景前的位置（回位用）
let userMovedInStudy = false // 学习场景中用户手动移动过 → 不自动回位
function moveToEdgeX() {
  if (!elRef.value) return
  if (S.state === 'walking' || S.state === 'moving') stopWalking()   // 先静默停步，避免双动画循环
  const layer = elRef.value.parentElement
  const w = layer ? layer.clientWidth : window.innerWidth
  const cw = elRef.value.offsetWidth
  const leftX = 10, rightX = Math.max(10, w - cw - 10)
  const target = Math.abs(leftX - S.x) <= Math.abs(rightX - S.x) ? leftX : rightX
  if (Math.abs(target - S.x) < 30) return   // 已贴边
  const tb = S.b == null ? 8 : S.b
  const cx = target + cw / 2
  if (canMove()) startWalk(cx, window.innerHeight - tb, true)
  else if (canTeleport()) startTeleport(cx, window.innerHeight - tb, true)
}
function moveBackTo(p) {
  if (!elRef.value || !p) return
  if (S.state === 'walking' || S.state === 'moving') stopWalking()
  const cw = elRef.value.offsetWidth
  const tb = Math.min(Math.max(p.b, 8), moveBounds().bMax)
  if (canMove()) startWalk(p.x + cw / 2, window.innerHeight - tb, true)
  else if (canTeleport()) startTeleport(p.x + cw / 2, window.innerHeight - tb, true)
}
watch(studyMode, (v) => {
  if (S.destroyed || !visible.value || !elRef.value) return
  if (v) {
    savedPos = { x: S.x, b: S.b == null ? 8 : S.b }
    userMovedInStudy = false
    clearTimeout(S.stateTimer)   // 挂起闲逛/台词（落定后的 scheduleNext 也会被 studyMode 守卫拦住）
    clearTimeout(seekTimer)      // 挂起求教冒泡
    moveToEdgeX()
  } else {
    if (S.state === 'idle' || S.state === 'walking' || S.state === 'moving') {
      const back = userMovedInStudy ? null : savedPos
      if (back) moveBackTo(back)
    }
    savedPos = null
    if (S.state === 'idle') scheduleNext()
    scheduleSeek(seekNextDelay())
  }
})

/* ---------------- 响应式 UI 状态 ---------------- */
/* activeId 为 companions.js 模块级共享 ref（2026-10-09）：与伙伴页同实例，
 * 伙伴页切角色后行走层即时跟随；初始化校验（含 cu_ 自定义角色）在 companions.js lsValid 内 */
const cfg = computed(() => findCharCfg(activeId.value) || CHARACTERS[0])
/* ---------------- 尺寸统一（修 M2 遗留 bug：模板绑 compWidth，脚本却是 cfgW，宽度从未生效 → 原图直出过大） ----------------
 * 各角色原图尺寸差异极大，按宽度缩放体积悬殊。
 * 现改为：统一「显示高度」（桌面 336px / 移动 200px，用户定稿：桌面≈3.5 倍、移动=原 2.5 倍），宽度 = 高度 × 原图宽高比，
 * 视觉体积一致、不挡界面；表情差分帧与立绘同画布尺寸，聊天/眨眼时不会跳宽。
 * v3：ratio 写死进配置（首帧即正确尺寸，修「兜底 0.55 比例导致知夏加载瞬间过宽、只露下半身」）；
 *     heightMul 供个别角色单独缩放——数字=两端同倍数，{d,m}=桌面/手机分别定（知夏用户定稿桌面 1.08、手机 1.44）。 */
/* ---------------- 尺寸架构(M1 重构):容器永远 = 立绘比例的宽×高 ----------------
 * img 以 height:100% 水平居中于容器,行走帧画布超宽部分溢出显示(容器无 overflow:hidden)。
 * 两套画布不再切换容器宽度 → 体型跳变的三个历史补丁(walkWide 开关 / S.x 半宽补偿 /
 * compWidth 行走分支)全部删除,待机↔行走容器尺寸恒定。 */
/* 用户自定义大小倍数（伙伴页「角色大小」滑块）。
 * v8(2026-10-06): 升级为用户级全局偏好——所有角色共用一个倍数，切角色不再重置。
 * 本地单键 size-global；登录取云端 companion_pref 保留行 __global__ 校准（跨设备）；
 * 伙伴页调整时经 zy-comp-size 事件(scope:'global')实时同步。
 * 迁移：无全局键时用旧 per-character 键 size-<activeId> 作种子，之后统一走全局键。 */
const readGlobalScale = () => {
  let s = parseFloat(ls.get('size-global'))
  if (!Number.isFinite(s)) {
    s = parseFloat(ls.get('size-' + activeId.value)) // 一次性迁移种子
    if (Number.isFinite(s)) ls.set('size-global', String(s))
  }
  return Math.max(0.6, Math.min(2, Number.isFinite(s) ? s : 1))
}
const userScale = ref(readGlobalScale())
function displayH() {
  /* 移动端 140（2026-10-13，原 200）：角色常驻右下角陪看，不再压住卡片流 */
  const base = isDesktop.value ? 336 : 140
  const mulRaw = cfg.value?.heightMul || 1
  const mul = typeof mulRaw === 'number' ? mulRaw : (isDesktop.value ? (mulRaw.d || 1) : (mulRaw.m || 1))
  return base * mul * userScale.value
}
const compWidth = computed(() => (displayH() * (cfg.value?.ratio || 0.55)).toFixed(0) + 'px')
const compHeight = computed(() => Math.round(displayH()) + 'px')
const walkOn = ref(false) // 行走中用 canvas 帧播放器渲染,立绘 img 隐藏

/* ---------------- 两段式移动:常量与帧播放器(M1 前置定义,供上方 watch 与下方 startWalk 共用) ---------------- */
/* v4(2026-10-05): 行走引擎按角色开放——拥有 walkFrames 配置的角色都可走（知夏步态 / 阿澈滑板序列帧），
 * 帧路径 = walk/<id>_v<v>_<NN>.png；朝向随角色配置；位置记忆按角色分 key */
const canMove = () => !!cfg.value?.walkFrames
/* v6(2026-10-05): 瞬移移动——没有 walkFrames 的角色一律瞬移(路/跃/龙/蛙 + 二期自定义角色自动命中)。
 * 起点落点判定完全复用两段式移动体系(moveBounds 钳制 / marker 标记 / movePosKey 位置记忆) */
const canTeleport = () => !!cfg.value && !cfg.value.walkFrames
const walkFacing = () => cfg.value?.walkFrames?.facing || 'left'
const movePosKey = computed(() => 'pos-' + (cfg.value?.id || ''))
const ARRIVE_LINES = {
  chibi_girl: ['到啦到啦！这块地儿甜！', '好嘞，就安家这儿了！', '报数——新据点打卡成功！'],
  school_girl: ['好，就到这里。', '这儿视野不错，慢慢来。', '这儿就很好，不急。'],
  che: ['稳稳到站。', '这儿视野不错。', '就停这儿了。', '滑完收脚~'],
  default: ['呼——到啦！', '这里视野不错嘛~', '就呆这儿啦。', '走完啦，舒坦~'],
}
/* v2 素材(2026-10-04 比例重制):图生视频抽 12 相位帧(一个完整单步,并拢→跨步→并拢),
 * 已按引擎约定重排:0 号帧=跨步落地(身体最低),与 contact 相位时钟对齐;
 * 素材自带真实 bob(跨步时身体低、并拢时高),程序 bob 只做微量加重 */
/* v3 素材(2026-10-04 B4 身材定稿):raw 重对齐(鞋尖保护)→ B4 warp → minterpolate 光流插帧 24 帧闭环。
 * 桌面 24 帧(动漫标准,24/28/36fps),移动端减载 12 关键帧(偶数号);画布 412x938 比例与立绘一致 */
/* v5: 帧路径按角色配置 walk/<id>_v<v>_<NN>.png——知夏 v3 步态 / 阿澈 v4 滑板；
 * 帧数不再写死 24:按 wf.n 配置(默认 24 兼容知夏),桌面全量 / 移动减载一半(偶数号);
 * 画布 412x938 两角色统一 */
const WALK_FRAMES = () => {
  const wf = cfg.value?.walkFrames
  if (!wf) return []
  const total = wf.n || 24
  const count = isDesktop.value ? total : Math.floor(total / 2)
  return Array.from(
    { length: count },
    (_, i) => COMPANION_ASSETS + 'walk/' + cfg.value.id + '_v' + wf.v + '_' +
      String(isDesktop.value ? i : i * 2).padStart(2, '0') + '.webp?v=w' + wf.v)
}
/* 画布尺寸/高度补偿按角色:che 512×938 + hComp 1.39(帧内容占画布 71.9%,画布显示放大后人物与立绘等高) */
const walkCanvasW = () => cfg.value?.walkFrames?.cw || 412
const WALK_CANVAS_H = 938
const walkHComp = () => cfg.value?.walkFrames?.hComp || 1
const walkCanvasStyle = computed(() => ({ '--walk-hcomp': String(walkHComp()) }))
/* 运动参数配置(M1 收敛:调手感只改这里;M2 纸娃娃 / Live2D 直接继承) */
const MOTION = {
  easeIn: 320,   // 起步加速时长 ms
  easeOut: 420,  // 终点收步距离对应的减速参考 ms
  blendMs: 70,   // 帧间交叉淡入时长(补间,消硬切;桌面24帧实际用30,见 blendMs())
  tiers: [       // 慢走 / 快走 / 小跑(速度=屏宽/speedDiv 每秒;fps=帧率;amp=bob 幅度;roll=身体摇摆角)
    { speedDiv: 10.4, fps: 12, amp: 0.8, roll: 1.4 },   // v2 素材自带真实 bob,程序 amp 只微量加重
    { speedDiv: 6.9,  fps: 14, amp: 1.2, roll: 2.0 },
    { speedDiv: 4.6,  fps: 18, amp: 2.2, roll: 3.0 },
  ],
}
const W = {
  raf: 0, lastT: 0, t0: 0, tx: 0, tb: 0, v: 0, tier: 0, cycleDist: 30,
  phase: 0, frameI: 0, prevI: -1, blendT0: 0, jit: 0, dip: 0, face: 1, quiet: false,
  frames: [], ready: false, loading: false, fw: 0, fh: 0, framesLen: 12,
}
/* 帧数/帧率/补间按设备分流:桌面 24 帧 24fps 动漫标准 + 30ms 补间;移动 12 帧 12fps + 70ms 补间 */
const walkBlendMs = () => (isDesktop.value ? 30 : 70)
const walkFpsMul = () => (isDesktop.value ? 2 : 1)
/* 滑行档案(2026-10-05):move='skate' 的角色(阿澈)走纯平稳滑行——
 * 无 roll 左右摇摆/无 bob 上下颠/无换向 dip/无步频抖动/影子恒定。
 * 根因:走路动态(roll 1.4~3°、amp 0.8~2.2px、影子脉动)叠加在 3Hz 微动循环上被感知为"晃来晃去很颠簸" */
const isGlide = () => !!cfg.value && cfg.value.move === 'skate'
/* 预解码行走帧 → 离屏位图(缩到 2x 显示尺寸,桌面 24 帧约 11MB,播放期零解码) */
function ensureWalkFrames() {
  if (W.loading || W.ready) return
  W.loading = true
  const FRAMES = WALK_FRAMES()
  W.framesLen = FRAMES.length
  const fh = Math.round(displayH() * 2 * walkHComp())
  const fw = Math.round(fh * walkCanvasW() / WALK_CANVAS_H)
  W.fw = fw; W.fh = fh
  let pending = FRAMES.length
  let loaded = 0
  /* 渐进就绪(walkdep13):不必等全帧落定——前 K 帧到位即 W.ready,
   * 立即可切画布播放;其余帧后台续载,播放期未到位帧由 frameAt() 最近帧兜底。
   * 根因:旧版全帧落定门槛下,进站后 5~15s 内点击行走(线上每角色帧 5~10MB)
   * 必落入 startWalk 的 !W.ready 分支 → 立绘滑行降级,用户体感="没有专属行走动作" */
  const READY_K = Math.min(8, FRAMES.length)
  const tryReady = () => {
    /* 不要求 frames[0]:网络乱序时 0 号帧可能最后到,frameAt() 最近帧兜底已覆盖 */
    if (!W.ready && loaded >= READY_K) W.ready = true
  }
  /* 全帧落定后:失败帧用最近可用帧兜底(动画不冻结),全失败则 ready=false 走滑行降级 */
  const settle = () => {
    if (--pending !== 0) return
    for (let i = 0; i < FRAMES.length; i++) {
      if (!W.frames[i]) {
        for (let d = 1; d < FRAMES.length; d++) {
          const a = W.frames[(i - d + FRAMES.length) % FRAMES.length]
          const b = W.frames[(i + d) % FRAMES.length]
          if (a || b) { W.frames[i] = a || b; break }
        }
      }
    }
    W.ready = W.frames.some(Boolean)
    W.loading = false
  }
  FRAMES.forEach((src, i) => {
    const im = new Image()
    im.onload = () => {
      const off = document.createElement('canvas')
      off.width = fw; off.height = fh
      off.getContext('2d').drawImage(im, 0, 0, fw, fh)
      W.frames[i] = off
      loaded++
      tryReady()
      settle()
    }
    im.onerror = settle
    im.src = src
  })
}
/* 取帧:渐进就绪期指定帧可能尚未解码到位,取最近可用帧(动画不冻结、不空帧) */
function frameAt(i) {
  const n = W.frames.length
  if (!n) return null
  if (W.frames[i]) return W.frames[i]
  for (let d = 1; d < n; d++) {
    const a = W.frames[(i - d + n) % n]
    if (a) return a
    const b = W.frames[(i + d) % n]
    if (b) return b
  }
  return null
}
/* 帧绘制:换帧时 70ms 交叉淡入(补间),硬切贴图感的主修法之一 */
function drawWalkFrame(t) {
  const cv = walkCanvasRef.value
  if (!cv || !W.ready) return
  const cur = frameAt(W.frameI)
  if (!cur) return
  if (cv.width !== W.fw || cv.height !== W.fh) { cv.width = W.fw; cv.height = W.fh }
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, W.fw, W.fh)
  const prev = W.prevI >= 0 ? frameAt(W.prevI) : null
  if (prev && W.prevI >= 0 && t - W.blendT0 < walkBlendMs()) {
    ctx.globalAlpha = 1
    ctx.drawImage(prev, 0, 0)
    ctx.globalAlpha = (t - W.blendT0) / walkBlendMs()
    ctx.drawImage(cur, 0, 0)
    ctx.globalAlpha = 1
  } else {
    W.prevI = -1
    ctx.drawImage(cur, 0, 0)
  }
}
/* 立绘↔行走画布切换:容器尺寸恒定,只切可见元素,无任何宽度/质心补偿 */
function showWalk(on) {
  walkOn.value = on
  if (on) {
    ensureWalkFrames()
    W.frameI = 0; W.prevI = -1
    drawWalkFrame(performance.now())
  } else {
    const cv = walkCanvasRef.value
    if (cv) cv.style.transform = ''
    const sh = shadowRef.value
    if (sh) { sh.style.transform = 'translateX(-50%)'; sh.style.opacity = '' }
  }
}
/* 定位:容器 left:0 bottom:0 恒定,位置全在 translate3d(合成器属性,不触发 reflow) */
function applyPos() {
  if (!elRef.value) return
  const b = S.b == null ? 8 : S.b
  elRef.value.style.transform = 'translate3d(' + S.x.toFixed(1) + 'px,' + (-b).toFixed(1) + 'px,0)'
}

/* 切角色/切端时:预热全部表情帧 + 行走帧位图(canvas 帧播放器用)。
 * v7(2026-10-08 性能):图层不可见时零预热——/companion 的舞台立绘、hushed、移动端非首页
 * 原本也会被拉走 ~2MB 预热流量(24 帧序列图+全差分),与首屏图片抢带宽(实测差分下载 6s+)。
 * 恢复可见时由 visible watcher 补预热。设备切换的帧缓存清理仍在门禁前执行。 */
function preloadCharAssets() {
  const c = cfg.value
  if (!c) return
  const pool = c.styles ? Object.values(c.styles).flatMap((s) => Object.values(s.faces)) : Object.values(c.faces || {})
  pool.forEach((src) => { const im = new Image(); im.src = src })
  if (c.walkFrames) ensureWalkFrames()
}
watch([activeId, isDesktop], () => {
  /* 设备切换(桌面↔移动)帧列表不同,清缓存让下次行走按新设备重载 */
  W.ready = false; W.loading = false; W.frames = []
  if (!visible.value) return
  preloadCharAssets()
}, { immediate: true })
const style = ref(cfg.value.styles ? (ls.get('style-' + cfg.value.id) || 'sharp') : null)
const curSrc = ref(cfg.value.src)
const bubbleText = ref('')
const bubbleShow = ref(false)
const chatOpen = ref(false)
const renaming = ref(false)
const renameBuf = ref('')
const draft = ref('')
const thinking = ref(false)   // 层内聊天"正在想"（2026-10-08 修复：此前未声明，sendMsg 一发消息就 ReferenceError 静默崩，聊天面板完全不可用）
/* 未登录引导台词 GUEST_LINE 来自 lib/companions.js（全站统一文案） */
const msgs = reactive([{ who: 'ai', text: isLoggedIn() ? '嗨！点我可以聊天，右上角可以换搭子哦~' : GUEST_LINE }])

/* 名字：云端 pref 优先（伙伴页改名后广播 zy-comp-name 事件实时同步），localStorage 兜底 */
const cloudNames = reactive({})
const nameOf = (c) => cloudNames[c.id] || ls.get('name-' + c.id) || c.name
const activeName = computed(() => nameOf(cfg.value))
async function fetchPref() {
  if (!isLoggedIn()) return
  try {
    const p = await api.companionPref(cfg.value.id)
    if (p && p.name) cloudNames[cfg.value.id] = p.name
  } catch { /* 静默，兜底走本地名 */ }
}
/* v8: 全局大小云端校准（登录后拉一次 __global__ 保留行，跨设备生效；名字仍按角色拉） */
async function fetchGlobalSize() {
  if (!isLoggedIn()) return
  try {
    const p = await api.companionPref('__global__')
    if (p && p.size_scale) userScale.value = Math.max(0.6, Math.min(2, Math.round(p.size_scale * 10) / 10))
  } catch { /* 静默 */ }
}
/* 造角色二期：登录后拉取用户自定义角色，写入共享 ref（行走层/伙伴页同模块实例自动同步） */
async function loadCustomChars() {
  if (!isLoggedIn()) return
  try {
    const d = await api.companionCustomList()
    if (d && d.ok) setCustomChars(d.chars || [])
  } catch { /* 静默：未登录/网络失败时保持空列表 */ }
}
const onNameEvent = (e) => {
  const d = e.detail || {}
  if (d.characterId && d.name) cloudNames[d.characterId] = d.name
}
const onSizeEvent = (e) => {
  const d = e.detail || {}
  /* v8: 全局大小广播直接应用（scope:'global'），不再比对 characterId */
  if (d.scope === 'global' && d.sizeScale) userScale.value = d.sizeScale
}
/* 聊窗大小滑块（2026-10-10 用户拍板）：与伙伴页滑块同一全局值（size-global / 云端 __global__）。
 * 改动 → userScale 实时应用 + 本地键 + 防抖写云端 + 广播 zy-comp-size（伙伴页滑块反向同步）；
 * 伙伴页改动经 onSizeEvent 应用 userScale，此处 watch 同步滑块显示，双向不打架。 */
const chatSize = ref(Math.round(userScale.value * 10) / 10)
let chatSizeTimer = null
watch(chatSize, (v) => {
  if (!Number.isFinite(v)) return
  const s = Math.max(0.6, Math.min(2, Math.round(v * 10) / 10))
  if (s === Math.round(userScale.value * 10) / 10) return
  userScale.value = s
  ls.set('size-global', String(s))
  clearTimeout(chatSizeTimer)
  chatSizeTimer = setTimeout(() => {
    api.companionPref('__global__', { size_scale: s }).catch(() => {})
  }, 600)
  window.dispatchEvent(new CustomEvent('zy-comp-size', { detail: { scope: 'global', sizeScale: s } }))
})
watch(userScale, (v) => {
  const s = Math.round(v * 10) / 10
  if (s !== Math.round(chatSize.value * 10) / 10) chatSize.value = s
})
const styleLabel = computed(() => (cfg.value.styles && cfg.value.styles[style.value]) ? cfg.value.styles[style.value].label : '')
/* 切角色：v8 起大小是用户级全局偏好，切角色不再重置 userScale；这里只拉该角色名字。
 * 2026-10-09：追加 applyCharacterSwitch——共享 ref 变化（含伙伴页切角色）在此统一重建立绘与引擎 */
watch(activeId, () => {
  fetchPref()
  applyCharacterSwitch()
})
/* 迷你面板角色列表：内置 + 自定义合并（2026-10-09 修复聊窗里切不了自制角色——此前只遍历 CHARACTERS）
   过一层 filterHiddenChars：被隐藏的角色（奶龙/奶蛙）不出现在「换搭子」横排（全站，不限首页） */
const allChars = computed(() => filterHiddenChars([...CHARACTERS, ...customChars.value]))
/* 聊窗锚定（2026-10-09）：桌面端窗口水平锚定角色旁（停下锚定模式），移动端维持右侧全宽 */
const chatAnchorX = ref(null)
const chatPos = computed(() => {
  if (!isDesktop.value) return { right: '12px', width: 'min(320px, calc(100vw - 24px))' }
  if (chatAnchorX.value == null) return {}
  const W = 320, GAP = 14
  const vw = window.innerWidth
  let left = chatAnchorX.value + GAP          // 先试角色右侧
  if (left + W > vw - 8) left = chatAnchorX.value - W - GAP   // 出屏换左侧
  left = Math.max(8, Math.min(left, vw - W - 8))
  return { left: left + 'px', right: 'auto' }
})
watch(chatOpen, (v) => {
  if (!v && visible.value && S.state === 'idle' && !S.talking) scheduleNext()   // 关窗恢复遛达
})

/* ---------------- 引擎状态（命令式，操作模板 refs） ---------------- */
const elRef = ref(null)
const imgRef = ref(null)
const walkCanvasRef = ref(null) // 行走帧播放器画布（修复：此声明曾被环境回滚吞掉，导致 drawWalkFrame ReferenceError → 角色移动时隐形）
const shadowRef = ref(null)
const boardRef = ref(null)
const bubbleRef = ref(null)
const fxRef = ref(null)
const logRef = ref(null)

const S = {
  x: 0, b: null, state: 'idle', destroyed: false,
  stateTimer: null, bubbleTimer: null, blinkT: null, talkT: null, talkStop: null,
  moveT: null, wiggleT: null, surpriseT: null,
  talking: false, wiggling: false,
}

const faceSrc = (name) => {
  const c = cfg.value
  if (c.styles) {
    const st = c.styles[style.value]
    return (st && st.faces && st.faces[name]) ? st.faces[name] : c.src
  }
  return (name === 'idle' || !c.faces || !c.faces[name]) ? c.src : c.faces[name]
}
const setFace = (name) => { curSrc.value = faceSrc(name) }
/* 云端自定义角色列表到达后，cfg 会从「本地缓存播种」换成云端版本：立绘立即跟随，
 * 不等下一次眨眼（无表情帧的角色，眨眼可能好几秒才来一次，期间一直停在缓存那张图） */
watch(() => cfg.value.src, (s) => {
  if (!s || s === curSrc.value) return
  curSrc.value = s
})
const setStyle = (s) => {
  if (!cfg.value.styles || !cfg.value.styles[s] || s === style.value) return
  style.value = s
  ls.set('style-' + cfg.value.id, s)
  if (S.state === 'idle' && !S.talking) setFace('idle')
  else if (S.state === 'excited') setFace('happy')
  else if (S.talking) setFace('talk')
}
const cycleStyle = () => {
  const keys = Object.keys(cfg.value.styles || {})
  if (!keys.length) return
  const next = keys[(keys.indexOf(style.value) + 1) % keys.length]
  setStyle(next)
  say('已切换为「' + cfg.value.styles[next].label + '」画风', 2200)
}

/* 台词气泡 + 说话嘴型交替 */
function say(text, duration = 3800, flapFaces) {
  bubbleText.value = text
  bubbleShow.value = true
  clearTimeout(S.bubbleTimer)
  S.bubbleTimer = setTimeout(() => { bubbleShow.value = false }, duration)
  const c = cfg.value
  if ((c.faces || c.styles) && S.state !== 'excited' && S.state !== 'moving' && S.state !== 'walking') {
    /* 行走中只冒气泡不换表情(用户定稿);excited/moving 维持原判定 */
    S.talking = true
    const fA = flapFaces ? flapFaces[0] : 'talk'
    const fB = flapFaces ? flapFaces[1] : 'idle'
    let open = true
    setFace(fA)
    clearTimeout(S.talkT)
    const flap = () => {
      if (!S.talking) return
      setFace(open ? fB : fA)
      open = !open
      S.talkT = setTimeout(flap, 260)
    }
    S.talkT = setTimeout(flap, 300)
    clearTimeout(S.talkStop)
    S.talkStop = setTimeout(() => {
      S.talking = false
      if (S.state === 'idle') setFace('idle')
    }, duration)
  }
}
const sayRandom = () => {
  const lines = customLines('idle', cfg.value) || IDLE_LINES[cfg.value.id] || ['陪你学习~']
  say(lines[Math.floor(Math.random() * lines.length)])
}

/* 气泡视口钳制：角色贴边时气泡会被视口裁掉——实测矩形后水平钳回屏内（8px 边距），
 * 尾巴箭头同步指向角色中心；红问号贴右缘自动画到头左侧。行走中每帧节流复钳。 */
const bubbleFixX = ref(0)
const bubbleArrowX = ref('50%')
const qmarkLeft = ref(false)
const bubbleStyle = computed(() => ({
  '--bubble-fx': bubbleFixX.value.toFixed(1) + 'px',
  '--bubble-ax': bubbleArrowX.value,
}))
let clampT = 0
function clampBubble(force) {
  if (!bubbleShow.value || !bubbleRef.value || S.destroyed) return
  const now = performance.now()
  if (!force && now - clampT < 150) return
  clampT = now
  const r = bubbleRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const M = 8
  const baseL = r.left - bubbleFixX.value, baseR = r.right - bubbleFixX.value
  let fix = 0
  if (baseL < M) fix = M - baseL
  else if (baseR > vw - M) fix = (vw - M) - baseR
  if (Math.abs(fix - bubbleFixX.value) > 0.5) bubbleFixX.value = fix
  const newL = baseL + fix
  const el = elRef.value
  if (el) {
    const cr = el.getBoundingClientRect()
    const cx = cr.left + cr.width / 2
    // 箭头指回角色头顶（钳在泡内 14px），除非角色中心已在泡外——那就钉在最近端
    const ax = Math.max(14, Math.min(r.width - 14, cx - newL))
    bubbleArrowX.value = ax.toFixed(0) + 'px'
    // 问号换侧：右缘空间不足时翻到左侧（问号已瘦身，预留空间同步减小）
    const need = vw < 1024 ? 40 : 56
    const rightTight = vw - cr.right < need
    qmarkLeft.value = rightTight && (cr.left >= need || cr.left > vw - cr.right)
  }
}
watch(bubbleShow, (v) => { if (v) nextTick(() => clampBubble(true)) })

/* 待机眨眼:拟真模式——随机间隔 + 时长 100~200ms 随机 + 30% 概率双连眨 */
function startBlinkLoop() {
  const c = cfg.value
  if (!c.faces && !c.styles) return
  const blinkOnce = (dur, cb) => {
    setFace('blink')
    setTimeout(() => {
      if (S.state === 'idle' && !S.talking) setFace('idle')
      if (cb) cb()
    }, dur)
  }
  const blink = () => {
    if (S.destroyed) return
    if (S.state === 'idle' && !S.talking && !S.wiggling && visible.value) {
      const dur = 100 + Math.random() * 100
      if (Math.random() < 0.3) {
        blinkOnce(dur, () => {
          setTimeout(() => {
            if (S.state === 'idle' && !S.talking && !S.destroyed) blinkOnce(dur + 40)
          }, 90)
        })
      } else {
        blinkOnce(dur)
      }
    }
    S.blinkT = setTimeout(blink, 2600 + Math.random() * 3400)
  }
  S.blinkT = setTimeout(blink, 1600 + Math.random() * 2400)
}

/* 知夏专属待机小动作(M1 阶段 C):重心换脚摇摆 / 伸懒腰 / 踮脚张望,程序化零新素材。
 * 纯 img transform,呼吸动画暂停,结束恢复;wiggling 标志与奶龙奶蛙彩蛋共用互斥 */
function playFidget() {
  if (!canMove() || S.state !== 'idle' || S.talking || S.wiggling || S.destroyed || !imgRef.value) { scheduleNext(); return }
  S.wiggling = true
  elRef.value.classList.remove('breathing')
  const img = imgRef.value
  const kind = Math.floor(Math.random() * 3)
  const dur = kind === 1 ? 1700 : 2300
  const t0 = performance.now()
  const frame = (now) => {
    const k = (now - t0) / dur
    if (S.destroyed || S.state !== 'idle' || k >= 1) {
      img.style.transform = ''
      if (elRef.value && S.state === 'idle') elRef.value.classList.add('breathing')
      S.wiggling = false
      scheduleNext()
      return
    }
    let tr = ''
    if (kind === 0) {
      // 重心换脚:缓慢左右摆 + 水平平移,像真人站着换脚
      const sw = Math.sin(k * Math.PI * 2) * 1.8
      tr = 'rotate(' + sw.toFixed(2) + 'deg) translateX(' + (Math.sin(k * Math.PI * 2) * 3).toFixed(1) + 'px)'
    } else if (kind === 1) {
      // 伸懒腰:上升 10px + 轻微后仰,前 70% 起势后 30% 收回
      const e = k < 0.7 ? Math.sin(Math.PI * 0.5 * (k / 0.7)) : 1 - (k - 0.7) / 0.3
      tr = 'translateY(' + (-10 * e).toFixed(1) + 'px) rotate(' + (-2.2 * e).toFixed(2) + 'deg)'
    } else {
      // 踮脚张望:微升 + 左右小角度张望
      const up = k < 0.25 ? k / 0.25 : (k > 0.8 ? (1 - k) / 0.2 : 1)
      const look = Math.sin(k * Math.PI * 3) * 1.2
      tr = 'translateY(' + (-6 * up).toFixed(1) + 'px) rotate(' + look.toFixed(2) + 'deg)'
    }
    img.style.transform = tr
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/* 状态机：台词频率降为 45–120s（demo 5–14s 的 1/3）。
 * 「考你一题」冒泡已升级为独立的小老师求教泡调度（scheduleSeek，进站约 10 秒首次），
 * 这里只负责闲聊台词/走动/小动作。 */
function scheduleNext() {
  clearTimeout(S.stateTimer)
  if (studyMode.value) return   // 学习场景贴边：挂起闲逛/台词/小动作（安静陪读）
  const wait = 45000 + Math.random() * 75000
  S.stateTimer = setTimeout(() => {
    if (S.state === 'idle' && visible.value && !S.destroyed) {
      const roll = Math.random()
      if (roll < 0.35) wander()
      else if (roll < 0.65 && canMove()) playFidget()
      else { sayRandom(); scheduleNext() }
    }
  }, wait)
}

/* 小老师求教泡：角色卡壳向用户求助（peek 免费取题），红问号+气泡同显，
 * 点问号/气泡跳伙伴页连问模式。节奏：进站 8~12s 首次 → 之后 90~150s 一次；
 * 链通关后（伙伴页写 chainAt）冷却 3~5 分钟。 */
const bubbleQuiz = ref(false)
const qmarkShow = ref(false)
let pendingQuiz = null
let seekTimer = null
const seekNextDelay = () => 50000 + Math.random() * 30000   // 收紧：50~80s（原 90~150s 观感像"不再出现"）

function chainCooldownRemain() {
  const t = Number(ls.get('chainAt', 0) || 0)
  if (!t) return 0
  const remain = 240000 - (Date.now() - t)   // 冷却中值 4 分钟
  return remain > 0 ? remain : 0
}
function scheduleSeek(delay) {
  clearTimeout(seekTimer)
  if (studyMode.value) return   // 学习场景贴边：不冒求教泡（正在展示的泡由自身 timer 自然收尾）
  seekTimer = setTimeout(() => {
    if (S.destroyed) return
    // 行走/待命/说话中：10s 后再试（原 45s，用户反馈"落点没贴边也不出泡"的观感之一）
    if (!visible.value || S.state !== 'idle' || S.talking) { scheduleSeek(10000); return }
    if (!isLoggedIn()) { scheduleSeek(60000); return }
    trySeekBubble()
  }, Math.max(delay, chainCooldownRemain()))
}
async function trySeekBubble() {
  try {
    const r = await api.companionQuiz({
      action: 'peek', character: cfg.value.id,
      name: activeName.value, persona: cfg.value.persona,
    })
    if (!S.destroyed && r && r.ok !== false && !r.empty && r.question) {
      pendingQuiz = { question_id: r.question_id, source: r.source }
      // p17: 求教泡找回——题目落 localStorage（10 分钟有效），点角色聊天/进伙伴页不带题也能找回
      try {
        ls.set('pending-quiz', JSON.stringify({
          qid: r.question_id, q: r.question.length > 42 ? r.question.slice(0, 42) + '…' : r.question,
          full: r.question,            // 2026-10-08：完整题干（伙伴页常驻题目栏显示全部内容用）
          subject: r.subject || '',    // 2026-10-08：科目（题目栏胶囊）
          source: r.source || '', ts: Date.now(),
        }))
      } catch { /* 存储失败不影响冒泡 */ }
      const lines = customLines('seek', cfg.value) || SEEK_LINES[cfg.value.id] || SEEK_LINES.default
      const intro = lines[Math.floor(Math.random() * lines.length)]
      // 科目点名（如「这道高数题」）+ 题目摘要放宽到 42 字，保证用户看得懂在问什么
      const subj = subjectShort(r.subject)
      const short = r.question.length > 42 ? r.question.slice(0, 42) + '…' : r.question
      const qLead = subj ? '这道' + subj + '题「' + short + '」' : '「' + short + '」'
      bubbleQuiz.value = true
      qmarkShow.value = true
      say(intro + qLead + '你能给我讲讲吗？（点我）', 12000)
      setTimeout(() => {
        bubbleQuiz.value = false
        qmarkShow.value = false
        pendingQuiz = null
        if (!S.destroyed) scheduleSeek(seekNextDelay())
      }, 12200)
      return
    }
  } catch { /* 静默：冒泡是彩蛋，失败不影响别的 */ }
  if (!S.destroyed) scheduleSeek(seekNextDelay())
}
function onBubbleClick() {
  if (!bubbleQuiz.value || !pendingQuiz) return
  const qid = pendingQuiz.question_id
  bubbleQuiz.value = false
  qmarkShow.value = false
  pendingQuiz = null
  bubbleShow.value = false
  ls.set('pending-quiz', '')   // p17: 点击跳页开局，找回卡片使命完成
  stopWalking()   // 求教泡可能在行走中仍挂着，跳页前先落定
  router.push({ path: ROUTES.companion, query: { quiz: qid, mode: 'teacher' } })
}
function goPage() {
  chatOpen.value = false
  router.push(ROUTES.companion)
}

/* 朝向:素材默认朝向 cfg.facing,向反方向移动时镜像。
 * M1:镜像只记在 S.face,由各 mover 在 img/canvas 的 transform 里统一施加——
 * 不再写 elRef.transform(那会连带气泡/按钮翻转,且与 translate3d 定位冲突) */
function faceDir(dir) {
  const s = (cfg.value.facing === 'left') ? (dir === 1 ? -1 : 1) : (dir === 1 ? 1 : -1)
  S.face = s
  return s
}

function wander() {
  const layer = elRef.value?.parentElement
  if (!layer) return
  /* 移动端不闲逛（2026-10-13）：横穿屏幕必然压住卡片流，常驻右下角；
     台词 / 小动作 / 求教泡照常，性格不丢 */
  if (!isDesktop.value) { scheduleNext(); return }
  const w = layer.clientWidth
  const margin = elRef.value.offsetWidth
  const minDist = w * 0.25, maxDist = w * 0.5
  let target, guard = 0
  do {
    const d = Math.random() < 0.5 ? -1 : 1
    target = S.x + d * (minDist + Math.random() * (maxDist - minDist))
    target = Math.max(10, Math.min(w - margin - 10, target))
    guard++
  } while (Math.abs(target - S.x) < 60 && guard < 10)
  S.state = 'moving'
  elRef.value.classList.remove('breathing')
  clearTimeout(S.moveT)
  /* 知夏/阿澈/小樱：闲逛也走步态引擎（静默=无目的地标记/无到点台词），观感与点击行走一致 */
  if (canMove()) {
    const tb = S.b == null ? 8 : S.b
    startWalk(target + elRef.value.offsetWidth / 2, window.innerHeight - tb, true)
    return
  }
  /* 瞬移角色：闲逛 = 静默瞬移（起落两端都有元素特效，无台词） */
  if (canTeleport()) {
    const tb = S.b == null ? 8 : S.b
    startTeleport(target + elRef.value.offsetWidth / 2, window.innerHeight - tb, true)
    return
  }
  MOVERS[cfg.value.move].call(null, target)
}

function arrive() {
  clearTimeout(S.moveT)
  S.state = 'idle'
  if (!elRef.value) return
  elRef.value.style.transition = ''
  applyPos()
  const img = imgRef.value
  if (img) { img.style.animation = ''; img.style.transform = ''; img.style.transition = '' }
  const sh = shadowRef.value
  if (sh) { sh.style.transform = ''; sh.style.opacity = '' }
  if (boardRef.value) boardRef.value.classList.remove('riding')
  elRef.value.classList.add('breathing')
  if (visible.value && Math.random() < 0.5) sayRandom()
  scheduleNext()
}

/* 小樱/小跃：物理小跳（三段式：蹲身→腾空抛物线→落地回弹） */
function hopTo(target, P = {}) {
  const img = imgRef.value, shadow = shadowRef.value
  if (!img || !shadow) return
  elRef.value.style.transition = 'none'
  img.style.transition = 'none'
  img.style.animation = 'none'
  const arcHMin = P.arcH ? P.arcH[0] : 24
  const arcHRange = P.arcH ? P.arcH[1] - P.arcH[0] : 10
  const distMin = P.dist ? P.dist[0] : 68
  const distRange = P.dist ? P.dist[1] - P.dist[0] : 32
  const crouchMin = P.tCrouch ? P.tCrouch[0] : 70
  const crouchRange = P.tCrouch ? P.tCrouch[1] - P.tCrouch[0] : 50
  const flightMin = P.tFlight ? P.tFlight[0] : 330
  const flightRange = P.tFlight ? P.tFlight[1] - P.tFlight[0] : 90
  const tLand = P.tLand || 75
  const gapMin = P.gap ? P.gap[0] : 20
  const gapRange = P.gap ? P.gap[1] - P.gap[0] : 40

  const hopOnce = () => {
    if (S.destroyed) return
    const remain = target - S.x
    if (Math.abs(remain) < 12) { S.x = target; applyPos(); arrive(); return }
    const dir = Math.sign(remain)
    const dist = dir * Math.min(Math.abs(remain), distMin + Math.random() * distRange)
    const arcH = arcHMin + Math.random() * arcHRange
    const tCrouch = crouchMin + Math.random() * crouchRange
    const tFlight = flightMin + Math.random() * flightRange
    const sf = faceDir(dir)
    const startX = S.x
    const t0 = performance.now()
    const frame = (now) => {
      if (S.destroyed) return
      const t = now - t0
      if (t < tCrouch) {
        const k = t / tCrouch
        img.style.transform = 'scaleX(' + sf + ') scale(' + (1 + 0.07 * k) + ',' + (1 - 0.1 * k) + ')'
        requestAnimationFrame(frame)
      } else if (t < tCrouch + tFlight) {
        const k = (t - tCrouch) / tFlight
        S.x = startX + dist * k
        applyPos()
        const lift = 4 * arcH * k * (1 - k)
        const s = Math.sin(Math.PI * k)
        img.style.transform = 'scaleX(' + sf + ') translateY(' + -lift + 'px) scale(' + (1 - 0.04 * s) + ',' + (1 + 0.07 * s) + ')'
        shadow.style.transform = 'translateX(-50%) scale(' + (1 - 0.3 * (lift / arcH)) + ')'
        shadow.style.opacity = 1 - 0.45 * (lift / arcH)
        requestAnimationFrame(frame)
      } else if (t < tCrouch + tFlight + tLand) {
        const k = (t - tCrouch - tFlight) / tLand
        img.style.transform = 'scaleX(' + sf + ') scale(' + (1.05 - 0.05 * k) + ',' + (0.93 + 0.07 * k) + ')'
        shadow.style.transform = 'translateX(-50%)'
        shadow.style.opacity = ''
        requestAnimationFrame(frame)
      } else {
        img.style.transform = ''
        setTimeout(hopOnce, gapMin + Math.random() * gapRange)
      }
    }
    requestAnimationFrame(frame)
  }
  hopOnce()
}

/* 知夏：倾斜漂移(M1:transform 定位 + 镜像上 img) */
function glideTo(target, leanDeg) {
  const dir = target > S.x ? 1 : -1
  const sf = faceDir(dir)
  const dist = Math.abs(target - S.x)
  const dur = Math.max(0.9, Math.min(2.2, dist / 320))
  const visualLean = (dir === 1 ? 1 : -1) * leanDeg
  const img = imgRef.value
  img.style.animation = ''
  img.style.transform = 'scaleX(' + sf + ') rotate(' + visualLean + 'deg)'
  elRef.value.style.transition = 'transform ' + dur + 's cubic-bezier(.35,.1,.25,1)'
  S.x = target
  applyPos()
  S.moveT = setTimeout(() => arrive(), dur * 1000 + 80)
}

/* 阿澈：滑板 */
function skateTo(target) {
  const board = boardRef.value
  const dir = target > S.x ? 1 : -1
  const sf = faceDir(dir)
  const dist = Math.abs(target - S.x)
  const dur = Math.max(0.7, Math.min(1.8, dist / 420))
  const lean = 4
  const visualLean = (dir === 1 ? 1 : -1) * lean
  const img = imgRef.value
  img.style.animation = ''
  img.style.transform = 'scaleX(' + sf + ') rotate(' + visualLean + 'deg)'
  if (board) board.classList.add('riding')
  elRef.value.style.transition = 'transform ' + dur + 's cubic-bezier(.3,.05,.3,1)'
  S.x = target
  applyPos()
  S.moveT = setTimeout(() => { if (board) board.classList.remove('riding'); arrive() }, dur * 1000 + 80)
}

/* 路易：星光飘行 */
function royalTo(target) {
  const dir = target > S.x ? 1 : -1
  const sf = faceDir(dir)
  const dist = Math.abs(target - S.x)
  const dur = Math.max(0.8, Math.min(2.0, dist / 380))
  const lean = 5
  const visualLean = (dir === 1 ? 1 : -1) * lean
  const img = imgRef.value
  img.style.animation = ''
  img.style.transform = 'scaleX(' + sf + ') rotate(' + visualLean + 'deg)'
  spawnStars(S.x + elRef.value.offsetWidth / 2)
  elRef.value.style.transition = 'transform ' + dur + 's cubic-bezier(.35,.1,.25,1)'
  S.x = target
  applyPos()
  S.moveT = setTimeout(() => { spawnStars(S.x + elRef.value.offsetWidth / 2); arrive() }, dur * 1000 + 80)
}
const dribbleTo = (t) => hopTo(t, { arcH: [13, 19], dist: [42, 62], tCrouch: [50, 80], tFlight: [270, 330], tLand: 60, gap: [8, 26] })

/* 奶龙/奶蛙：扭扭摆摆走 */
function waddleTo(target) {
  const img = imgRef.value, shadow = shadowRef.value
  if (!img || !shadow) return
  elRef.value.style.transition = 'none'
  img.style.transition = 'none'
  img.style.animation = 'none'
  const stepOnce = () => {
    if (S.destroyed) return
    const remain = target - S.x
    if (Math.abs(remain) < 10) { S.x = target; applyPos(); arrive(); return }
    const dir = Math.sign(remain)
    const sf = faceDir(dir)
    const dist = dir * Math.min(Math.abs(remain), 34 + Math.random() * 14)
    const tStep = 300 + Math.random() * 90
    const startX = S.x
    const t0 = performance.now()
    const frame = (now) => {
      if (S.destroyed) return
      const k = Math.min(1, (now - t0) / tStep)
      const ease = k * (0.75 + 0.25 * k)
      S.x = startX + dist * ease
      applyPos()
      const swing = Math.sin(k * Math.PI * 2) * 5
      const lift = Math.abs(Math.sin(k * Math.PI)) * 6
      const squash = k > 0.92 ? (1 - (k - 0.92) * 0.8) : 1
      img.style.transform = 'scaleX(' + sf + ') rotate(' + swing + 'deg) translateY(' + -lift + 'px) scale(1,' + squash + ')'
      shadow.style.transform = 'translateX(-50%) scale(' + (1 - 0.18 * (lift / 6)) + ')'
      shadow.style.opacity = 1 - 0.3 * (lift / 6)
      if (k < 1) requestAnimationFrame(frame)
      else {
        img.style.transform = ''
        shadow.style.transform = 'translateX(-50%)'
        shadow.style.opacity = ''
        setTimeout(stepOnce, 10 + Math.random() * 40)
      }
    }
    requestAnimationFrame(frame)
  }
  stepOnce()
}

/* 奶龙/奶蛙待机彩蛋 */
function startWiggleLoop() {
  const id = cfg.value.id
  if (id !== 'nailong' && id !== 'naiwa') return
  const loop = () => {
    S.wiggleT = setTimeout(() => {
      if (S.destroyed) return
      if (S.state === 'idle' && !S.talking && visible.value) {
        if (id === 'nailong') Math.random() < 0.55 ? playWiggle() : playBackTwerk()
        else playBellyLaugh()
      }
      loop()
    }, 15000 + Math.random() * 15000)
  }
  loop()
}
function playWiggle() {
  const img = imgRef.value
  S.wiggling = true
  setFace('smug')
  img.style.animation = 'none'
  const dur = 1600, t0 = performance.now()
  const frame = (now) => {
    const k = (now - t0) / dur
    if (S.destroyed || S.state !== 'idle' || k >= 1) {
      img.style.transform = ''; img.style.animation = ''
      S.wiggling = false
      if (S.state === 'idle' && !S.talking) setFace('idle')
      return
    }
    const sw = Math.sin(k * Math.PI * 6) * 8
    const by = Math.abs(Math.sin(k * Math.PI * 6)) * 3
    img.style.transform = 'rotate(' + sw + 'deg) translateY(' + -by + 'px)'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  if (Math.random() < 0.35) say('学累了？看我扭一段充充电！', 2400, ['smug', 'smug'])
}
function playBackTwerk() {
  if (S.state !== 'idle') return
  const img = imgRef.value
  const layer = elRef.value
  S.wiggling = true
  img.style.animation = 'none'
  img.style.visibility = 'hidden'
  setFace('back')
  const mkLayer = (cls) => {
    const l = document.createElement('img')
    l.src = cfg.value.faces.back
    l.className = 'twerk-layer ' + cls
    layer.insertBefore(l, bubbleRef.value)
    return l
  }
  const top = mkLayer('twerk-top')
  const bot = mkLayer('twerk-bottom')
  const finish = () => {
    top.remove(); bot.remove()
    img.style.visibility = ''; img.style.transform = ''; img.style.animation = ''
    S.wiggling = false
    if (S.state === 'idle' && !S.talking) setFace('idle')
  }
  top.style.transform = 'scaleY(0.94) translateY(3px)'
  bot.style.transform = 'translateY(-4px)'
  setTimeout(() => {
    if (S.destroyed || S.state !== 'idle') { finish(); return }
    top.style.transition = 'none'
    bot.style.transition = 'none'
    const dur = 2200, t0 = performance.now()
    const frame = (now) => {
      const k = (now - t0) / dur
      if (S.destroyed || S.state !== 'idle' || k >= 1) { finish(); return }
      const sw = Math.sin(k * Math.PI * 10)
      bot.style.transform = 'translateY(-4px) rotate(' + sw * 7 + 'deg)'
      top.style.transform = 'scaleY(0.94) translateY(3px) rotate(' + -sw * 1.5 + 'deg)'
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, 350)
  say('看好了！奶龙招牌背身扭扭！扭扭扭~', 3000, ['back', 'back'])
}
function playBellyLaugh() {
  if (S.state !== 'idle') return
  const img = imgRef.value
  S.wiggling = true
  img.style.animation = 'none'
  const dur = 2800, t0 = performance.now()
  const frame = (now) => {
    const k = (now - t0) / dur
    if (S.destroyed || S.state !== 'idle' || k >= 1) {
      img.style.transform = ''; img.style.animation = ''
      S.wiggling = false
      if (S.state === 'idle' && !S.talking) setFace('idle')
      return
    }
    const bounce = Math.abs(Math.sin(k * Math.PI * 9)) * 6
    const sway = Math.sin(k * Math.PI * 4.5) * 2.5
    img.style.transform = 'rotate(' + sway + 'deg) translateY(' + -bounce + 'px)'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  say('哈哈哈哈！！笑死我了！哈哈哈哈！', 2900, ['laugh_back', 'laugh_fwd'])
}

/* 点击 / 悬停 */
function onClicked() {
  if (S.state === 'moving') return
  // 单击 = 进入/取消待命移动模式（行走角色走过去 / 瞬移角色闪过去）；行走中单击 = 打断并重选目的地
  if (canMove() || canTeleport()) {
    if (S.state === 'await') { cancelAwait(); return }
    if (S.state === 'walking') { stopWalking(); enterAwait(); return }
    enterAwait()
    return
  }
  S.state = 'excited'
  elRef.value.classList.remove('breathing')
  elRef.value.classList.add('excited')
  let face = 'happy'
  if (cfg.value.id === 'nailong' && Math.random() < 0.6) face = Math.random() < 0.5 ? 'smug' : 'wink'
  if (cfg.value.id === 'naiwa' && Math.random() < 0.6) face = 'laugh_back'
  setFace(face)
  /* 问候语：角色专属台词池随机取句（自定义角色优先用 LLM 生成的专属池） */
  const greetPool = customLines('greet', cfg.value) || GREET_LINES[cfg.value.id] || GREET_LINES.default
  const greet = activeName.value + '：' + greetPool[Math.floor(Math.random() * greetPool.length)]
  let greetFlap = face === 'happy' ? null : [face, face]
  if (cfg.value.id === 'naiwa' && face === 'laugh_back') greetFlap = ['laugh_back', 'laugh_fwd']
  say(greet, 4200, greetFlap)
  setTimeout(() => {
    if (S.destroyed) return
    elRef.value.classList.remove('excited')
    elRef.value.classList.add('breathing')
    S.state = 'idle'
    setFace('idle')
    scheduleNext()
  }, 1000)
  openChat()
}

/* 2026-10-09 聊窗锚定（用户拍板"停下锚定"）：打开即停走，窗口水平锚定角色旁（自动防出屏），关闭恢复调度。
 * 主入口 = 气泡按钮（模板 openChat()），onClicked 尾部为次要入口，统一走这里。 */
function openChat() {
  if (isDesktop.value) {
    stopWalking()
    cancelAwait()
    clearTimeout(S.stateTimer)
    chatAnchorX.value = S.x + (elRef.value ? elRef.value.offsetWidth / 2 : 120)
  }
  chatOpen.value = true
}
function onHover() {
  if (S.state !== 'idle' || S.talking) return
  setFace('surprised')
  clearTimeout(S.surpriseT)
  S.surpriseT = setTimeout(() => { if (S.state === 'idle' && !S.talking) setFace('idle') }, 700)
}
function onContext() {
  const keys = Object.keys(cfg.value.styles || {})
  if (!keys.length) return
  const next = keys[(keys.indexOf(style.value) + 1) % keys.length]
  setStyle(next)
  say('已切换为「' + cfg.value.styles[next].label + '」画风', 2200)
}

/* ---------------- 两段式移动交互（试点：仅知夏 school_girl） ----------------
 * 单击知夏 → 待命模式 → 再点任意处沿直线走过去；取消=再点她/Esc；行走中点她=重选目的地。
 * M1:常量/运动参数/帧播放器已前置到「尺寸架构」区,本区只保留交互与行走状态机。 */

const moveMode = ref('normal') // normal | await | walking
const marker = reactive({ show: false, fade: false, x: 0, y: 0 })

/* 捕获层存活开关（2026-10-13，与 moveMode 解耦）：
 * 移动端 tap 的 click 按「抬起位置」命中测试——选点瞬间就撤层的话，click 会漏给底下的页面按钮。
 * 选完点多罩 ~450ms（覆盖 click/点按高亮的完整派发窗口）再撤，绝不透传。 */
const captureOn = ref(false)
let captureOffTimer = null
function holdCapture() {
  captureOn.value = true
  clearTimeout(captureOffTimer)
}
function releaseCaptureSoon(ms = 450) {
  clearTimeout(captureOffTimer)
  captureOffTimer = setTimeout(() => { captureOn.value = false }, ms)
}
function releaseCaptureNow() {
  clearTimeout(captureOffTimer)
  captureOn.value = false
}

function moveBounds() {
  const layer = elRef.value?.parentElement
  const w = layer ? layer.clientWidth : window.innerWidth
  const ch = elRef.value ? elRef.value.offsetHeight : 200
  const cw = elRef.value ? elRef.value.offsetWidth : 120
  return {
    xMin: 10,
    xMax: Math.max(10, w - cw - 10),
    bMin: 8,
    bMax: Math.max(8, Math.min(window.innerHeight * 0.65, window.innerHeight - ch - 16)),
  }
}
function curBottom() {
  if (S.b != null) return S.b
  const b = parseFloat(getComputedStyle(elRef.value).bottom)
  return isNaN(b) ? 8 : b
}

/* 待命模式 */
function enterAwait() {
  if ((!canMove() && !canTeleport()) || S.state !== 'idle') return
  clearTimeout(S.stateTimer)
  chatOpen.value = false
  S.state = 'await'
  moveMode.value = 'await'
  holdCapture()   // 捕获层常驻（选完点也多罩 450ms，见 releaseCaptureSoon）
  // 求教泡显示中：不清泡、不覆盖文案——用户可能正要点题答题，手滑点到角色不能吞泡
  if (bubbleQuiz.value) return
  bubbleShow.value = false
  // v7(2026-10-06): 待命提示词按角色台词池随机取句(MOVE_HINT_LINES, 人设混搭三风格)——
  // 取代旧硬编码"点哪里我就走过去/闪过去"(全角色同一句、指引目的性过强)
  const hintPool = customLines('move', cfg.value) || MOVE_HINT_LINES[cfg.value.id] || MOVE_HINT_LINES.default
  say(hintPool[Math.floor(Math.random() * hintPool.length)], 3500)
}
function cancelAwait() {
  if (moveMode.value !== 'await') return
  moveMode.value = 'normal'
  releaseCaptureNow()   // 主动取消：捕获层立即撤（点的是角色本身，z 更高，无穿透问题）
  S.state = 'idle'
  if (!bubbleQuiz.value) bubbleShow.value = false
  scheduleNext()
}
function onCaptureDown(e) {
  if (moveMode.value !== 'await') return
  if (studyMode.value) userMovedInStudy = true   // 学习场景手动挪动 → 离开时不自动回位
  if (canTeleport()) startTeleport(e.clientX, e.clientY)
  else startWalk(e.clientX, e.clientY)
  releaseCaptureSoon()   // 关键：不立即撤层——罩住移动端 tap 的 click 派发窗口再撤
}

/* 行走引擎(M1 重构):恒速直线 + 起步加速/终点收步;步态相位随"路程"推进(步幅恒定,
 * 加减速自然带动帧率与 bob,从"滑行"变"走路");步频 ±8% 随机漂移;换向瞬间 bob 低谷遮掩。 */
function startWalk(cx, cy, quiet = false) {
  moveMode.value = 'normal'
  W.quiet = quiet // 闲逛静默模式:不画目的地标记、不到点台词
  const token = (W.waitToken = (W.waitToken || 0) + 1) // 每次 new 移动都作废等待中的 waitReady
  if (S.b == null) S.b = curBottom()
  const B = moveBounds()
  // 落点语义:脚底(人物质心)走到点击处;上边界 65% 屏高钳制后标记仍画在实际落点
  const tb = Math.min(B.bMax, Math.max(B.bMin, window.innerHeight - cy))
  const tx = Math.min(B.xMax, Math.max(B.xMin, cx - elRef.value.offsetWidth / 2))
  if (!quiet) {
    marker.x = cx
    marker.y = window.innerHeight - tb
    marker.fade = false
    marker.show = true
  }
  const dist = Math.hypot(tx - S.x, tb - S.b)
  // 极近距离:不切行走态,标记展示片刻后淡出(修复旧版此处切画布+标记残留的 bug)
  if (dist < 10) {
    setTimeout(() => {
      marker.fade = true
      setTimeout(() => { marker.show = false; marker.fade = false }, 400)
    }, 700)
    scheduleNext()
    return
  }
  // 帧位图未就绪:预载进行中先等最多 2s(walkdep13——点击时帧通常 1~2s 内到位,
  // 等到即正常行走;这是"线上看不到专属行走动作"的主修复),仍不就绪才降级立绘滑行,
  // 绝不切到空白 canvas 让角色隐形
  if (!W.ready) {
    const glide = () => {
      const dur = Math.max(0.9, Math.min(2.2, dist / 320))
      const dir = tx >= S.x ? 1 : -1
      const sf = faceDir(dir)
      elRef.value.style.transition = 'transform ' + dur.toFixed(2) + 's cubic-bezier(.35,.1,.25,1)'
      S.x = tx
      S.b = tb
      applyPos()
      const img0 = imgRef.value
      if (img0) { img0.style.animation = 'none'; img0.style.transform = 'scaleX(' + sf + ')' }
      S.moveT = setTimeout(() => finishWalk(), dur * 1000 + 80)
    }
    if (W.loading) {
      const t0 = Date.now()
      const waitReady = () => {
        if (S.destroyed || token !== W.waitToken) return // 已被新的移动/停止打断
        if (W.ready) { startWalk(cx, cy, quiet); return }
        if (Date.now() - t0 < 2000) { setTimeout(waitReady, 120); return }
        glide()
      }
      waitReady()
      return
    }
    glide()
    return
  }
  const vw = window.innerWidth
  const tier = dist < vw * 0.25 ? 0 : dist < vw * 0.55 ? 1 : 2
  const M = MOTION.tiers[tier]
  W.tier = tier
  W.v = vw / M.speedDiv
  // 一个相位循环(桌面24帧/移动12帧=单步=1个bob)走过的路程:帧率按设备分流,步幅同步防滑步
  W.cycleDist = Math.max(20, W.v * W.framesLen / (M.fps * walkFpsMul()))
  W.tx = tx
  W.tb = tb
  W.phase = 0
  W.frameI = 0
  W.prevI = -1
  W.jit = 0
  W.dip = 0
  W.t0 = 0
  W.lastT = 0
  elRef.value.style.transition = 'none'
  elRef.value.classList.remove('breathing')
  const img = imgRef.value
  if (img) { img.style.animation = 'none'; img.style.transform = '' }
  showWalk(true) // 切 canvas 帧播放器(容器尺寸恒定,无宽度/质心补偿)
  S.state = 'walking'
  moveMode.value = 'walking'
  W.raf = requestAnimationFrame(walkFrame)
}

function walkFrame(t) {
  if (S.state !== 'walking' || S.destroyed || !elRef.value) return
  if (!W.t0) { W.t0 = t; W.lastT = t }
  const dt = Math.min(50, t - W.lastT)
  W.lastT = t
  const M = MOTION.tiers[W.tier]
  const dx = W.tx - S.x
  const db = W.tb - S.b
  const dist = Math.hypot(dx, db)
  if (dist <= 1.5) {
    S.x = W.tx
    S.b = W.tb
    applyPos()
    finishWalk()
    return
  }
  // 步频抖动:±4% 随机游走(原 ±8% 在滑板序列帧上被感知为速度忽快忽慢,收窄一半);滑行档案关闭
  W.jit = isGlide() ? 0 : Math.max(-0.04, Math.min(0.04, W.jit + (Math.random() - 0.5) * 0.016))
  const spd = W.v * (1 + W.jit)
  // 加减速包络:起步 easeIn 平滑升速;终点按剩余距离收步(减速距离=全速下 easeOut ms 的路程)
  const tIn = Math.min(1, (t - W.t0) / MOTION.easeIn)
  const dOut = Math.max(40, spd * MOTION.easeOut / 1000)
  const tOut = Math.min(1, dist / dOut)
  const f = Math.min(tIn, tOut)
  const ease = f * f * (3 - 2 * f) // smoothstep
  let step = spd * (dt / 1000) * (0.3 + 0.7 * ease)
  if (step > dist) step = dist
  const k = step / dist
  S.x += dx * k
  S.b += db * k
  applyPos()
  // 朝向:水平分量决定镜像;接近纯竖直时保持原朝向。换向瞬间 bob 低谷遮掩(动漫式瞬翻)
  if (Math.abs(dx) > Math.abs(db) * 0.4) {
    const dir = dx > 0 ? 1 : -1
    const nf = walkFacing() === 'left' ? (dir === 1 ? -1 : 1) : (dir === 1 ? 1 : -1)
    if (nf !== W.face) { W.face = nf; if (!isGlide()) W.dip = 1 }
  }
  // 步态相位随路程推进;12 帧循环 = 单步 = 1 个 bob 周期,0 号帧=跨步落地(最低),与素材自带 bob 同相
  W.phase += step / W.cycleDist
  W.dip = Math.max(0, W.dip - dt / 130)
  const cycle = W.phase % 1
  const fi = Math.floor(W.phase * W.framesLen) % W.framesLen
  if (fi !== W.frameI) { W.prevI = W.frameI; W.frameI = fi; W.blendT0 = t }
  drawWalkFrame(t)
  clampBubble(false)   // 带泡行走：气泡跟着角色移动时保持钳在屏内（内部 150ms 节流）
  // 身体 roll(与步伐同频的左右摇摆)+ bob;contact=1 落地(最低)、0 腾空(最高)。
  // v2:素材帧已含真实 bob,程序 amp 仅微量加重(见 MOTION),另承担换向 dip 遮掩
  // 滑行档案:零 bob 零 roll——滑板匀速平移,站姿只留素材自带微动
  const glide = isGlide()
  const contact = 0.5 + 0.5 * Math.cos(cycle * Math.PI * 2)
  const bob = glide ? 0 : (-M.amp * contact - W.dip * 5)
  const roll = glide ? 0 : Math.sin(cycle * Math.PI * 2) * M.roll
  const cv = walkCanvasRef.value
  if (cv) cv.style.transform = 'scaleX(' + W.face + ') translateY(' + bob.toFixed(1) + 'px) rotate(' + roll.toFixed(2) + 'deg)'
  // 影子同步:落地放大变深、腾空缩小变浅,重量感来源;滑行档案恒定影子(不脉动)
  const sh = shadowRef.value
  if (sh) {
    if (glide) {
      sh.style.transform = 'translateX(-50%)'
      sh.style.opacity = ''
    } else {
      const air = 1 - contact
      sh.style.transform = 'translateX(-50%) scale(' + (1 - 0.22 * air).toFixed(3) + ')'
      sh.style.opacity = (1 - 0.4 * air).toFixed(2)
    }
  }
  W.raf = requestAnimationFrame(walkFrame)
}

function finishWalk() {
  cancelAnimationFrame(W.raf)
  moveMode.value = 'normal'
  S.state = 'idle'
  showWalk(false) // 恢复立绘(容器尺寸恒定,无补偿)
  elRef.value.style.transition = ''
  applyPos()
  const img = imgRef.value
  if (img) {
    img.style.animation = ''
    // 落定小动作:蹲一下回弹(用户定稿保留;不在移动过程中,不影响体型恒定)
    img.style.transition = 'transform 0.18s ease'
    img.style.transform = 'scale(1.05, 0.93)'
    setTimeout(() => {
      img.style.transform = ''
      setTimeout(() => { if (S.state !== 'walking') img.style.transition = '' }, 220)
    }, 180)
  }
  elRef.value.classList.add('breathing')
  marker.fade = true
  setTimeout(() => { marker.show = false; marker.fade = false }, 450)
  if (!studyMode.value) ls.set(movePosKey.value, JSON.stringify({ x: Math.round(S.x), b: Math.round(S.b) }))   // 学习场景自动让位不污染用户的长期位置记忆
  scheduleNext()
  if (!W.quiet && Math.random() < 0.5) {
    const AL = ARRIVE_LINES[cfg.value?.id] || ARRIVE_LINES.default
    say(AL[Math.floor(Math.random() * AL.length)], 3000)
  }
}

/* 行走/瞬移被打断（行走中点她重选/换角色/离开页面）：静默复位 */
function stopWalking() {
  if (S.state === 'walking') {
    cancelAnimationFrame(W.raf)
    S.state = 'idle'
    moveMode.value = 'normal'
    showWalk(false)
    elRef.value.style.transition = ''
    applyPos()
    elRef.value.classList.add('breathing')
    const img = imgRef.value
    if (img) { img.style.animation = ''; img.style.transform = ''; img.style.transition = '' }
    if (marker.show) {
      marker.fade = true
      setTimeout(() => { marker.show = false; marker.fade = false }, 300)
    }
    return
  }
  /* 瞬移途中被打断：清掉挂起的落点定时器,恢复透明度与状态(否则角色会永远隐形) */
  if (S.state === 'moving') {
    clearTimeout(S.moveT)
    S.state = 'idle'
    moveMode.value = 'normal'
    const el = elRef.value
    if (el) { el.style.transition = ''; el.style.opacity = '' }
    applyPos()
    elRef.value.classList.add('breathing')
    const img = imgRef.value
    if (img) { img.style.animation = ''; img.style.transform = ''; img.style.transition = '' }
    if (marker.show) {
      marker.fade = true
      setTimeout(() => { marker.show = false; marker.fade = false }, 300)
    }
  }
}

/* 星光特效 */
function spawnStars(px) {
  const fx = fxRef.value
  if (!fx) return
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div')
    s.className = 'comp-star'
    s.textContent = '✦'
    s.style.left = (px + (Math.random() * 60 - 30)) + 'px'
    s.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px')
    s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's'
    fx.appendChild(s)
    setTimeout(() => s.remove(), 950)
  }
}

/* ---------------- 瞬移移动（v6, 2026-10-05）----------------
 * 无 walkFrames 的角色一律瞬移（路/跃/龙/蛙 + 二期自定义角色自动命中）。
 * 起点/落点判定完全复用两段式移动体系：moveBounds 钳制、marker 标记、movePosKey 位置记忆。
 * 三阶段：起点元素特效+淡出 → 瞬移落点 → 落点爆开特效+淡入。 */
const TP_ELEMENTS = {
  gold:     { glyph: '✦', color: '#f5c542', glow: 'rgba(245,197,66,.85)',  ring: 'rgba(245,197,66,.75)' },
  electric: { glyph: '⚡', color: '#ffd83d', glow: 'rgba(120,220,255,.85)', ring: 'rgba(120,220,255,.75)' },
  fire:     { glyph: '🔥', color: '#ff7a3c', glow: 'rgba(255,122,60,.85)',  ring: 'rgba(255,150,70,.75)' },
  water:    { glyph: '💧', color: '#58b7ff', glow: 'rgba(88,183,255,.85)',  ring: 'rgba(88,183,255,.75)' },
  magic:    { glyph: '✨', color: '#b388ff', glow: 'rgba(179,136,255,.85)', ring: 'rgba(179,136,255,.75)' },
}
const tpElement = () => TP_ELEMENTS[cfg.value?.element] || TP_ELEMENTS.magic
const TP_LINES = {
  luyi: ['星光引路，转瞬即至。', '王室的魔法，不过如此。', '瞬息而至，失礼了。'],
  yue: ['闪现！这波不亏！', '咻——速度就是激情！', '落点完美，下一题！'],
  nailong: ['嘿嘿，龙族秘技·咻咻咻！', '瞬移！有没有很厉害！', '咻~ 本龙闪现啦！'],
  naiwa: ['呱咻！到啦到啦！', '嘿嘿，一眨眼就到咯~', '呱~瞬移真舒服。'],
  default: ['咻——到啦！', '瞬移成功~', '这边视野不错！'],
}
/* 元素特效:phase 'out'=起点收拢 'in'=落点爆开;粒子=元素字符飞散,环=发光冲击圈 */
function spawnTpFx(px, py, phase) {
  const fx = fxRef.value
  if (!fx) return
  const el = tpElement()
  const ring = document.createElement('div')
  ring.className = 'comp-tp-ring ' + (phase === 'in' ? 'in' : 'out')
  ring.style.left = px + 'px'
  ring.style.top = py + 'px'
  ring.style.borderColor = el.ring
  ring.style.boxShadow = '0 0 18px ' + el.glow + ', inset 0 0 12px ' + el.glow
  fx.appendChild(ring)
  setTimeout(() => ring.remove(), 620)
  const n = 10
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div')
    p.className = 'comp-tp-p ' + (phase === 'in' ? 'in' : 'out')
    p.textContent = el.glyph
    p.style.left = px + 'px'
    p.style.top = py + 'px'
    p.style.color = el.color
    p.style.textShadow = '0 0 8px ' + el.glow
    // 粒子飞行终点(极坐标均匀散开;'out' 反向:从外圈收拢到中心)
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5
    const r = 26 + Math.random() * 30
    const dx = Math.cos(ang) * r
    const dy = Math.sin(ang) * r * 0.8 - 8
    p.style.setProperty('--dx', dx.toFixed(0) + 'px')
    p.style.setProperty('--dy', dy.toFixed(0) + 'px')
    p.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's'
    fx.appendChild(p)
    setTimeout(() => p.remove(), 850)
  }
}
function startTeleport(cx, cy, quiet = false) {
  moveMode.value = 'normal'
  W.waitToken = (W.waitToken || 0) + 1 // 作废可能挂着的 waitReady(瞬移打断等帧)
  W.quiet = quiet
  if (S.b == null) S.b = curBottom()
  const B = moveBounds()
  // 与 startWalk 完全相同的落点语义:脚底钳制 + 标记画在实际落点
  const tb = Math.min(B.bMax, Math.max(B.bMin, window.innerHeight - cy))
  const tx = Math.min(B.xMax, Math.max(B.xMin, cx - elRef.value.offsetWidth / 2))
  if (!quiet) {
    marker.x = cx
    marker.y = window.innerHeight - tb
    marker.fade = false
    marker.show = true
  }
  const dist = Math.hypot(tx - S.x, tb - S.b)
  if (dist < 10) {
    setTimeout(() => {
      marker.fade = true
      setTimeout(() => { marker.show = false; marker.fade = false }, 400)
    }, 700)
    scheduleNext()
    return
  }
  S.state = 'moving'
  elRef.value.classList.remove('breathing')
  const el = elRef.value
  const cxc = S.x + el.offsetWidth / 2
  const cyc = window.innerHeight - (S.b == null ? 8 : S.b) - el.offsetHeight / 2
  spawnTpFx(cxc, cyc, 'out')
  // 阶段1:淡出并轻微收缩(240ms)
  el.style.transition = 'opacity 0.22s ease, filter 0.22s ease'
  el.style.opacity = '0'
  el.style.filter = 'brightness(1.6)'
  S.moveT = setTimeout(() => {
    if (S.destroyed) return
    // 阶段2:瞬移落点
    S.x = tx
    S.b = tb
    el.style.transition = 'none'
    applyPos()
    void el.offsetWidth // 强制 reflow,防落点位移被过渡动画拖影
    spawnTpFx(tx + el.offsetWidth / 2, window.innerHeight - tb - el.offsetHeight / 2, 'in')
    // 阶段3:淡入(260ms)
    el.style.transition = 'opacity 0.26s ease, filter 0.26s ease'
    el.style.opacity = ''
    el.style.filter = ''
    S.moveT = setTimeout(() => {
      el.style.transition = ''
      finishTeleport()
    }, 280)
  }, 240)
}
function finishTeleport() {
  S.state = 'idle'
  moveMode.value = 'normal'
  applyPos()
  elRef.value.classList.add('breathing')
  marker.fade = true
  setTimeout(() => { marker.show = false; marker.fade = false }, 450)
  if (!studyMode.value) ls.set(movePosKey.value, JSON.stringify({ x: Math.round(S.x), b: Math.round(S.b) }))   // 同 finishWalk：学习场景不记位置
  scheduleNext()
  if (!W.quiet && Math.random() < 0.6) {
    const TL = TP_LINES[cfg.value?.id] || TP_LINES.default
    say(TL[Math.floor(Math.random() * TL.length)], 3000)
  }
}

/* ---------------- 聊天（M3：接 /api/companion/chat，doubao 闲聊位，20 次/日） ---------------- */
/* p17: 读取求教泡找回缓存（10 分钟有效） */
function readPendingQuiz() {
  try {
    const o = JSON.parse(ls.get('pending-quiz', '') || 'null')
    if (o && o.qid && Date.now() - o.ts < 600000) return o
  } catch { /* 坏数据忽略 */ }
  return null
}
let chatFailStreak = 0
async function chatWithAI(text, c) {
  // 游客：不发请求，直接给登录引导台词（用户定稿文案）
  if (!isLoggedIn()) return GUEST_LINE
  const pq = readPendingQuiz()
  try {
    const r = await api.companion({
      character: c.id,
      name: activeName.value,
      persona: c.persona,
      message: text,
      // p17: 待请教题目摘要注入后端上下文——用户问「题目是啥」AI 能如实复述
      pending_question: pq ? pq.q : '',
      // 带上最近 8 条做上下文；token 由 api.js 自动注入
      history: msgs.slice(-8).map((m) => ({ who: m.who, text: m.text })),
    })
    chatFailStreak = 0
    return r.reply
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    /* v8: 额度超额切角色人设化话术（"累了明天再聊"），不再展示系统报错文案 */
    if (e && e.quota_exhausted) {
      chatFailStreak = 0
      const pool = customLines('quota', c) || QUOTA_LINES[c.id] || QUOTA_LINES.default
      return pool[Math.floor(Math.random() * pool.length)]
    }
    // 后端把游客登录引导等都写成中文 error，这里直接展示
    const base = (e && e.message) || '我这边信号不太好，再发一次好不好？'
    // p17: 连续失败 2 次起附真实原因提示，不再让"走神"话术背锅
    return chatFailStreak++ >= 1 ? base + '\n（AI 服务好像暂时不可用，可能是模型额度或网络问题，稍后再试试~）' : base
  }
}
async function sendMsg() {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  msgs.push({ who: 'me', text })
  thinking.value = true
  let reply
  try {
    reply = await chatWithAI(text, cfg.value)
  } finally {
    thinking.value = false
  }
  msgs.push({ who: 'ai', text: reply })
  nextTick(() => { if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight })
  let flap = null
  let dance = false
  let laugh = false
  const id = cfg.value.id
  if (id === 'nailong') {
    if (/厉害|真棒|好棒|你好强|好强|666|牛|优秀|满分/.test(text)) flap = ['smug', 'smug']
    else if (/你好|嗨|hi|hello|早|晚|午安/i.test(text)) flap = ['wink', 'wink']
    else if (/扭|跳舞|舞一段|屁股|背身/.test(text)) dance = true
  }
  if (id === 'naiwa') {
    if (/哈哈|笑|好笑|搞笑/.test(text)) laugh = true
    else if (/你好|嗨|hi|hello|早|晚|午安/i.test(text)) flap = ['laugh_back', 'laugh_fwd']
  }
  if (dance) playBackTwerk()
  else if (laugh) playBellyLaugh()
  else say(reply, 5000, flap)
}

/* ---------------- 告别离场（2026-10-08 与用户定稿） ----------------
 * 点 ✕ → 随机说一条人设告别词（~3.2s）→ 缓缓上浮淡出 → sessionStorage 记住本会话隐藏；
 * 下次打开网站（新会话）自动回归。正在展示的求教泡一并收起。 */
const dismissing = ref(false)
function dismissCompanion() {
  if (S.destroyed || dismissing.value) return
  dismissing.value = true
  chatOpen.value = false
  bubbleQuiz.value = false
  qmarkShow.value = false
  pendingQuiz = null
  const pool = customLines('bye', cfg.value) || BYE_LINES[cfg.value.id] || BYE_LINES.default
  say(pool[Math.floor(Math.random() * pool.length)], 3200)
  clearTimeout(S.stateTimer)
  clearTimeout(seekTimer)
  setTimeout(() => {
    if (S.destroyed || !elRef.value) { dismissing.value = false; return }
    elRef.value.classList.remove('breathing')   // 停呼吸动画，让离场 transform 不被 keyframes 覆盖
    elRef.value.classList.add('leaving')
    setTimeout(() => {
      try { sessionStorage.setItem('zy-comp-hushed', '1') } catch { /* 隐私模式：仅内存态 */ }
      hushed.value = true                        // visible→false，现有 watcher 会做行走/泡清理
      dismissing.value = false
      elRef.value.classList.remove('leaving')    // v-show 已收起容器，复位 class 供下次会话
    }, 650)
  }, 3300)
}

/* ---------------- 改名 / 换角色 ---------------- */
function startRename() {
  renameBuf.value = activeName.value
  renaming.value = true
}
function confirmRename() {
  if (!renaming.value) return
  renaming.value = false
  const name = renameBuf.value.trim().slice(0, 6)
  if (!name || name === activeName.value) return
  ls.set('name-' + cfg.value.id, name)
  say('以后就叫我「' + name + '」吧，这名字我喜欢！', 3600)
}
function clearTimers() {
  clearTimeout(S.stateTimer); clearTimeout(S.bubbleTimer); clearTimeout(S.blinkT)
  clearTimeout(S.talkT); clearTimeout(S.talkStop); clearTimeout(S.moveT)
  clearTimeout(S.wiggleT); clearTimeout(S.surpriseT)
}
/* 切角色统一入口（2026-10-09）：任何来源（行走层面板 / 伙伴页 / 造角色成功自动切换）
 * 都经 setActiveCompId 改共享 ref → watch(activeId) 触发 applyCharacterSwitch 重建。
 * 此前重建逻辑只在 selectCharacter 内联，伙伴页切的 activeId 只改了 fetchPref 不换立绘（bug 根因二）。 */
function applyCharacterSwitch() {
  stopWalking()
  cancelAwait()
  clearTimers()
  S.destroyed = true
  S.state = 'idle'
  S.talking = false
  S.wiggling = false
  bubbleQuiz.value = false
  qmarkShow.value = false
  pendingQuiz = null
  bubbleShow.value = false
  chatOpen.value = false
  style.value = cfg.value.styles ? (ls.get('style-' + activeId.value) || 'sharp') : null
  curSrc.value = cfg.value.src
  msgs.length = 0
  msgs.push({ who: 'ai', text: isLoggedIn() ? '我是' + activeName.value + '，以后一起学习啦~' : GUEST_LINE })
  // 下一帧重建引擎（onWatcher 重新定位并启动循环）
  requestAnimationFrame(() => boot(true))
}
function selectCharacter(id) {
  if (id === activeId.value) return
  setActiveCompId(id)   // watch(activeId) 接管重建
}

/* ---------------- 位置初始化与挂载 ---------------- */
function boot(isSwitch) {
  if (!elRef.value) return
  S.destroyed = false
  const layer = elRef.value.parentElement
  const w = layer.clientWidth
  /* 移动端默认落位右下角（2026-10-13，原居中）：屏幕窄 + 卡片流满屏，居中站立必然压住内容；
     桌面保持居中不变。用户手动挪过的位置仍由下方 movePosKey 记忆还原（优先级更高） */
  S.x = isDesktop.value
    ? Math.max(10, w / 2 - elRef.value.offsetWidth / 2)
    : Math.max(10, w - elRef.value.offsetWidth - 10)
  S.b = null
  elRef.value.style.opacity = ''
  elRef.value.style.transition = ''
  elRef.value.style.filter = ''
  if (canMove() || canTeleport()) {
    // 可移动角色（行走/瞬移）：还原上次被安顿的位置（越界拉回）
    try {
      const p = JSON.parse(ls.get(movePosKey.value, '') || 'null')
      if (p && typeof p.x === 'number') {
        const B = moveBounds()
        S.x = Math.min(B.xMax, Math.max(B.xMin, p.x))
        S.b = Math.min(B.bMax, Math.max(B.bMin, typeof p.b === 'number' ? p.b : 8))
      }
    } catch { /* 坏数据忽略，走默认位 */ }
  }
  applyPos()
  elRef.value.classList.add('breathing')
  setFace('idle')
  scheduleNext()
  scheduleSeek(8000 + Math.random() * 4000)   // 进站约 10 秒首次求教泡
  if (studyMode.value) { savedPos = { x: S.x, b: S.b == null ? 8 : S.b }; userMovedInStudy = false; moveToEdgeX() }   // 切角色/挂载时已在学习页：重贴边
  startBlinkLoop()
  startWiggleLoop()
  if (isSwitch) say('我是' + activeName.value + '，叫我吧！', 3200)
}

const onResize = () => {
  if (!elRef.value) return
  const w = elRef.value.parentElement.clientWidth
  if (S.x > w - elRef.value.offsetWidth) {
    S.x = Math.max(10, w - elRef.value.offsetWidth - 10)
  }
  if (S.b != null) {
    const B = moveBounds()
    S.b = Math.min(B.bMax, Math.max(B.bMin, S.b))
  }
  applyPos()
}

let mq = null
const onKey = (e) => { if (e.key === 'Escape') cancelAwait() }
onMounted(() => {
  mq = window.matchMedia('(min-width: 1024px)')
  mq.addEventListener('change', onMq)
  window.addEventListener('resize', onResize)
  window.addEventListener('zy-comp-name', onNameEvent)
  window.addEventListener('zy-comp-size', onSizeEvent)
  window.addEventListener('keydown', onKey)
  fetchPref()
  fetchGlobalSize()
  loadCustomChars()
  requestAnimationFrame(() => boot(false))
  if (!ls.get('welcomed')) {
    ls.set('welcomed', '1')
    setTimeout(() => say(isLoggedIn() ? '点我可以聊天，面板里还能换搭子、给我改名哦~' : GUEST_LINE, 5200), 2000)
  }
})
onBeforeUnmount(() => {
  S.destroyed = true
  clearTimers()
  clearTimeout(seekTimer)
  clearTimeout(captureOffTimer)
  releaseCaptureNow()
  stopWalking()
  if (mq) mq.removeEventListener('change', onMq)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('zy-comp-name', onNameEvent)
  window.removeEventListener('zy-comp-size', onSizeEvent)
  window.removeEventListener('keydown', onKey)
})

/* 显隐切换：隐藏时挂起台词调度，恢复时重新定位并续上 */
watch(visible, (v) => {
  if (v) {
    preloadCharAssets()   // 门禁放行后补预热（进页时被跳过的差分/序列图在这里回来）
    onResize()
    if (S.state === 'idle') scheduleNext()
    // 可见性恢复（窗口从移动宽拉回桌面等）：学习页继续贴边安静，普通页恢复求教调度
    if (studyMode.value) moveToEdgeX()
    else scheduleSeek(seekNextDelay())
  } else {
    stopWalking()
    cancelAwait()
    clearTimeout(S.stateTimer)
    // 图层隐藏时求教泡干净收尾，避免残留可点的僵尸问号
    if (bubbleQuiz.value) {
      bubbleQuiz.value = false
      qmarkShow.value = false
      pendingQuiz = null
      scheduleSeek(seekNextDelay())
    }
    bubbleShow.value = false
    chatOpen.value = false
  }
})

/* 迷你面板与伙伴页共用一份云端历史：登录态打开面板时拉最近 8 条 */
watch(chatOpen, (v) => {
  if (v && isLoggedIn()) loadMiniHistory()
})
async function loadMiniHistory() {
  try {
    const d = await api.companionHistory(cfg.value.id)
    const recent = (d.msgs || []).slice(-8)
    if (!recent.length) return
    msgs.length = 0
    for (const m of recent) msgs.push({ who: m.role === 'user' ? 'me' : 'ai', text: m.content })
    nextTick(() => { if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight })
  } catch { /* 拉取失败保留本地消息 */ }
}

const MOVERS = {
  hop: (t) => hopTo(t),
  skate: (t) => skateTo(t),
  royal: (t) => royalTo(t),
  dribble: (t) => dribbleTo(t),
  waddle: (t) => waddleTo(t),
  float: (t) => glideTo(t, 3.5),
}
</script>

<style scoped>
.comp-layer {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: 180px;
  pointer-events: none;
  z-index: 900;
}
.comp-fx { position: absolute; inset: 0; pointer-events: none; }
.companion {
  position: absolute;
  left: 0; bottom: 0;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  will-change: transform; /* 位置全在 translate3d(合成器属性),不再写 left/bottom */
}
/* img 居中包装层:恒定 CSS,永不参与 JS 动画(镜像/bob/变形都打在 img 或 canvas 上)
 * align-items:flex-end → 底部锚定:walk-canvas 高于容器时向上生长,脚底/板轮贴地线不变 */
.img-wrap {
  position: absolute;
  left: 0; bottom: 0;
  width: 100%; height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
}
/* 行走帧播放器:hcomp 为每角色显示高度补偿(che 1.39:帧内容占画布 71.9% → 放大后与立绘等高) */
.walk-canvas {
  height: calc(100% * var(--walk-hcomp, 1));
  width: auto;
  max-width: none; /* 豁免全局 img 不适用,但防御未来全局规则;canvas 需保持素材固有比例 */
  display: block;
  transform-origin: bottom center;
  pointer-events: none;
}

/* 两段式移动（知夏试点） */
.comp-capture {
  position: fixed;
  inset: 0;
  z-index: 890; /* 低于角色层(900)与聊天面板(950)：点角色仍是取消，点聊天按钮仍可开面板 */
  cursor: crosshair;
  background: rgba(47, 158, 100, 0.04);
}
.comp-marker {
  position: fixed;
  z-index: 895;
  width: 46px;
  height: 18px;
  margin: -9px 0 0 -23px;
  border-radius: 50%;
  border: 2.5px solid rgba(47, 158, 100, 0.6);
  background: radial-gradient(ellipse at center, rgba(47, 158, 100, 0.18), transparent 70%);
  pointer-events: none;
  animation: comp-marker-pulse 1s ease-out infinite;
}
@keyframes comp-marker-pulse {
  0% { transform: scale(0.7); opacity: 0.95; }
  70% { transform: scale(1.15); opacity: 0.35; }
  100% { transform: scale(1.2); opacity: 0; }
}
.comp-marker.fade { animation: none; transition: opacity 0.4s ease; opacity: 0; }
.comp-go-arrow {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  color: #2f9e64;
  font-size: 20px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  animation: comp-arrow-bounce 0.9s ease-in-out infinite;
  pointer-events: none;
  z-index: 3;
}
@keyframes comp-arrow-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-8px); }
}
.comp-chat-fab {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 4px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface, #fff);
  border: 1.5px solid var(--primary, #34618e);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(30, 60, 100, 0.18);
  z-index: 3;
}
.comp-chat-fab:hover { transform: scale(1.12); }
.companion img {
  height: 100%;
  width: auto;
  max-width: none; /* 豁免全局 img{max-width:100%}: 否则体型被横向压扁 50% */
  display: block;
  pointer-events: none;
  transition: transform 0.35s ease;
  transform-origin: bottom center;
}
.companion .shadow {
  position: absolute;
  left: 50%; bottom: -7px;
  width: 72%; height: 14px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(30, 60, 100, 0.26) 0%, rgba(30, 60, 100, 0) 68%);
  pointer-events: none;
}
.companion.breathing img { animation: comp-breathe 2.8s ease-in-out infinite; }
@keyframes comp-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.015); }
}
.companion.excited img { animation: comp-jump 0.45s ease-in-out 2; }
@keyframes comp-jump {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-18px); }
}
.skateboard {
  display: none; position: absolute; bottom: 3%; left: 50%;
  width: 78%; height: 7px; transform: translateX(-50%);
  border-radius: 4px; background: #22304a;
}
.skateboard::before, .skateboard::after {
  content: ''; position: absolute; top: 6px; width: 10px; height: 10px;
  border-radius: 50%; background: #d8dee8; border: 2px solid #9aa7ba;
}
.skateboard::before { left: 12%; }
.skateboard::after { right: 12%; }
.skateboard.riding { display: block; animation: comp-bump 0.45s ease-in-out infinite alternate; }
@keyframes comp-bump { from { margin-top: 0; } to { margin-top: -3px; } }
.comp-star {
  position: absolute; bottom: 34px; color: #f5c542; font-size: 14px;
  pointer-events: none; text-shadow: 0 0 6px rgba(245, 197, 66, 0.8);
  animation: comp-star-up 0.8s ease-out forwards;
}
@keyframes comp-star-up {
  from { opacity: 0; transform: translateY(6px) scale(0.6); }
  30% { opacity: 1; }
  to { opacity: 0; transform: translate(var(--dx, 0px), -46px) scale(1.1); }
}
/* 瞬移元素特效:冲击环 + 元素粒子(fixed 定位,坐标即视口坐标) */
.comp-tp-ring {
  position: fixed;
  width: 64px; height: 64px;
  margin: -32px 0 0 -32px;
  border-radius: 50%;
  border: 2.5px solid;
  pointer-events: none;
  z-index: 896;
}
.comp-tp-ring.in { animation: comp-tp-ring-in 0.55s ease-out forwards; }
.comp-tp-ring.out { animation: comp-tp-ring-out 0.55s ease-in forwards; }
@keyframes comp-tp-ring-in {
  0% { transform: scale(0.15); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes comp-tp-ring-out {
  0% { transform: scale(1.4); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: scale(0.15); opacity: 0; }
}
.comp-tp-p {
  position: fixed;
  font-size: 15px;
  line-height: 1;
  pointer-events: none;
  z-index: 896;
  opacity: 0;
}
.comp-tp-p.in { animation: comp-tp-p-in 0.62s ease-out forwards; }
.comp-tp-p.out { animation: comp-tp-p-out 0.62s ease-in forwards; }
@keyframes comp-tp-p-in {
  0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
  25% { opacity: 1; transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.15); }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.85); }
}
@keyframes comp-tp-p-out {
  0% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.85); }
  25% { opacity: 1; transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.15); }
  100% { opacity: 0; transform: translate(0, 0) scale(0.5); }
}
.twerk-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; transition: transform 0.3s ease; }
.twerk-top { clip-path: inset(0 0 44% 0); transform-origin: 50% 100%; }
.twerk-bottom { clip-path: inset(52% 0 0 0); transform-origin: 50% 0; }
.bubble {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%; transform: translateX(calc(-50% + var(--bubble-fx, 0px)));
  background: var(--surface, #fff);
  border: 1.5px solid var(--primary, #34618e);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary, #2c3e50);
  max-width: 260px;
  width: max-content;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
  line-height: 1.5;
  z-index: 2;
}
.bubble.show { opacity: 1; }

/* 小老师求教问号（2026-10-08 定稿）：纯文本「？」——无红圆底/白描边/阴影/强弹跳，
 * 主题蓝小号 + 轻浮动，点击=点求教泡；贴边换侧逻辑不变 */
.comp-qmark {
  position: absolute;
  top: 0;
  right: -5%;
  width: auto;
  height: auto;
  padding: 2px 6px;   /* 纯文本热区小，用 padding 撑到可点击 */
  background: none;
  border: none;
  box-shadow: none;
  color: var(--primary, #34618e);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  animation: comp-qmark-float 2.4s ease-in-out infinite;
  user-select: none;
}
@keyframes comp-qmark-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
/* 贴屏幕右缘时问号换到头部左侧，避免出屏 */
.comp-qmark.qmark-left { right: auto; left: -5%; }
@media (max-width: 1023px) {
  .comp-qmark {
    font-size: 20px;
    padding: 2px 5px;
    right: -4%;
  }
  .comp-qmark.qmark-left { right: auto; left: -4%; }
}
@media (prefers-reduced-motion: reduce) {
  .comp-qmark { animation: none; }
}
/* 告别 ✕：悬停角色浮现（桌面）；移动端无 hover，常显小号 */
.comp-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  background: var(--surface, #fff);
  border: 1.5px solid var(--border-secondary, #c9d6e6);
  color: var(--text-secondary, #6b7a8d);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, background 0.15s ease;
}
.companion:hover .comp-close { opacity: 1; pointer-events: auto; }
.comp-close:hover { background: var(--surface-secondary, #eef3fa); color: var(--text-primary, #2c3e50); }
@media (max-width: 1023px) {
  .comp-close { opacity: 1; pointer-events: auto; width: 22px; height: 22px; font-size: 11px; }
}
/* 告别离场：缓缓上浮淡出 */
.companion.leaving { opacity: 0; transition: opacity 0.6s ease; }
.companion.leaving .img-wrap img { transform: translateY(-14px); }
.companion.leaving .walk-canvas { transform: translateY(-14px); transition: transform 0.6s ease; }
.bubble.clickable {
  pointer-events: auto;
  cursor: pointer;
  border-color: #2f7a52;
}
.bubble.clickable::after { border-top-color: #2f7a52; }
.bubble::after {
  content: '';
  position: absolute;
  top: 100%; left: var(--bubble-ax, 50%);
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--primary, #34618e);
}

/* 迷你聊天面板 */
.comp-chat {
  position: fixed;
  right: 24px; bottom: 200px;
  width: 320px;
  background: var(--surface, #fff);
  border-radius: 16px;
  border: 1px solid var(--border-secondary, #e3ecf5);
  box-shadow: 0 8px 30px rgba(30, 60, 100, 0.18);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 950;
}
.comp-chat__head {
  background: var(--primary, #34618e);
  color: #fff;
  padding: 10px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.comp-chat__title { font-weight: 500; }
.comp-chat__btn {
  cursor: pointer;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 10px;
  padding: 2px 10px;
  font-size: 12px;
  white-space: nowrap;
}
.comp-chat__btn:hover { background: rgba(255, 255, 255, 0.35); }
/* 角色大小滑块行（2026-10-10）：与伙伴页同一全局值，聊天面板内直调 */
.comp-chat__sizerow {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px 0;
}
.comp-chat__sizelabel { font-size: 12px; color: var(--text-secondary, #5b6b7b); flex: none; }
.comp-chat__sizerow input[type='range'] { flex: 1; min-width: 0; accent-color: var(--brand, #4a7a63); }
.comp-chat__sizeval {
  flex: none; font-size: 12px; font-weight: 600; color: var(--brand, #4a7a63);
  font-variant-numeric: tabular-nums; min-width: 34px; text-align: right;
}
.comp-chat__rename { padding: 8px 12px 0; }
.comp-chat__rename input {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--border-secondary, #e3ecf5);
  border-radius: 8px; padding: 6px 10px; font-size: 13px; outline: none;
}
.comp-chat__picker {
  display: flex; gap: 4px; align-items: center;
  padding: 8px 10px 4px;
  overflow-x: auto;
}
.pick-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 8px 2px 3px; border-radius: 999px; cursor: pointer;
  border: 2px solid transparent; transition: 0.15s; background: transparent;
  flex-shrink: 0;
}
.pick-chip:hover { background: var(--surface-secondary, #eef3fa); }
.pick-chip.active { border-color: var(--primary, #34618e); background: var(--surface-secondary, #eaf1fb); }
.pick-chip img {
  width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
  object-position: top center; background: var(--surface-tertiary, #f2f6fb);
}
.pick-chip span { font-size: 12px; white-space: nowrap; }
.comp-chat__log {
  padding: 10px 14px;
  height: 200px;
  overflow-y: auto;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; line-height: 1.5; }
.msg.ai { background: var(--surface-secondary, #eef4fa); color: var(--text-primary, #2c3e50); align-self: flex-start; border-bottom-left-radius: 4px; }
.msg.me { background: var(--primary, #34618e); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
.comp-chat__row { display: flex; border-top: 1px solid var(--border-tertiary, #e3ecf5); }
.comp-chat__typing { opacity: 0.65; font-style: italic; }
.comp-chat__row input { flex: 1; border: none; padding: 12px 14px; font-size: 14px; outline: none; background: transparent; color: var(--text-primary, #2c3e50); }
.comp-chat__send { border: none; background: none; color: var(--primary, #34618e); font-size: 14px; padding: 0 16px; cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .companion.breathing img, .companion.excited img, .skateboard.riding, .comp-star,
  .comp-tp-ring, .comp-tp-p { animation: none; }
  .comp-tp-ring { opacity: 0; }
}
</style>
