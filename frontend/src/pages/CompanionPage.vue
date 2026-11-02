<template>
  <div class="zy-container zy-page cpage">
    <header class="cpage__head">
      <div>
        <h1 class="t-h1">我的伙伴</h1>
        <p class="t-body-2">正在和 <b>{{ activeName }}</b> 一起学习</p>
      </div>
      <div v-if="loggedIn" class="cpage__head-actions">
        <button class="cpage__toolbtn" @click="switchOpen = true">
          <span class="cpage__toolbtn-ic">⇄</span>切换伙伴
        </button>
      </div>
    </header>

    <!-- 游客态：立绘照常展示 + 登录引导 -->
    <section v-if="!loggedIn" class="surface-standard cpage__guest">
      <div class="cpage__stage-box cpage__stage-box--guest">
        <img :src="cfg.src" class="cpage__char cpage__char--breath" :style="{ height: stageH + 'px' }" alt="" fetchpriority="high" @load="onCharImgLoad" />
      </div>
      <div class="cpage__guide">
        <p class="cpage__guide-t">{{ activeName }}：你好，我们来认识一下吧！</p>
        <p class="t-body-2">（请登录账号或注册）登录后可以和 TA 聊天、让 TA 用你的错题本考你、还能语音对话。</p>
        <UiButton variant="primary" @click="goLogin">去登录 / 注册</UiButton>
      </div>
    </section>

    <template v-else>
      <div class="cpage__main" :class="{ 'cpage__main--mobile': !isDesktop }">
        <!-- ① 角色舞台：唯一角色（表情差分联动）+ 语音气泡 + 思考态 -->
        <section class="surface-standard cpage__stage">
          <div ref="stageBoxRef" class="cpage__stage-box" :style="{ height: stageBoxH + 'px' }">
            <img
              :src="faceSrc"
              class="cpage__char cpage__char--breath"
              :style="{ height: stageH + 'px' }"
              alt=""
              fetchpriority="high"
              @click="pokeChar"
              @load="onCharImgLoad"
            />
            <img ref="ghostRef" class="cpage__char-ghost" :style="{ height: stageH + 'px' }" src="" alt="" />
            <div v-if="bubble.visible" class="cpage__bubble" title="点击显示全文" @click="finishTypewriter">
              <span class="cpage__bubble-text">{{ bubble.shown }}</span>
              <span v-if="bubble.shown.length < bubble.full.length" class="cpage__bubble-cursor">▍</span>
            </div>
            <!-- p18 dock（2026-10-12）：只保留思考态——题目卡 2026-10-08 迁至对话区顶部（常驻题目栏） -->
            <div class="cpage__dock">
              <!-- 亲密度徽章（2026-10-12 从舞台顶部移入停靠坞）：避免与顶部语音气泡相撞 -->
              <div class="cpage__intim" :title="'亲密度经验 ' + intim.exp + '，每 ' + intim.per_level + ' 点升一级'">
                <span class="cpage__intim-lv">Lv{{ intim.level || 1 }}</span>
                <span class="cpage__intim-bar"><i :style="{ width: intimPct + '%' }"></i></span>
              </div>
              <div v-if="thinking" class="cpage__thinking">{{ activeName }} 正在想···</div>
            </div>
            <!-- walkdep16: 讲解涨好感飘字（1.6s 上浮淡出，不刷屏） -->
            <span v-if="favFloat.key" :key="favFloat.key" class="cpage__fav">+{{ favFloat.n }} 好感</span>
          </div>

          <!-- 角色信息区（2026-10-11）：名字 / 等级 / 称号 / 性格标签 / 讲题风格 / 亲密度 / 状态 -->
          <div class="cpage__who-box">
            <div class="cpage__who-top">
              <b>{{ activeName }}</b>
              <span class="cpage__lv-pill">Lv{{ intim.level || 1 }}</span>
              <span class="cpage__title-pill">{{ titleOf(intim.level) }}</span>
            </div>
            <div v-if="meta.tags.length" class="cpage__tags">
              <span v-for="t in meta.tags" :key="t" class="cpage__tag">{{ t }}</span>
            </div>
            <p v-if="meta.style" class="cpage__style">讲题风格 · {{ meta.style }}</p>
            <div class="cpage__intim2">
              <div class="cpage__intim2-row">
                <span>亲密度</span>
                <span class="cpage__intim2-bar"><i :style="{ width: intimPct + '%' }"></i></span>
                <span>{{ intim.exp_in_level || 0 }}/{{ intim.per_level || 50 }}</span>
              </div>
              <p class="cpage__intim2-note">{{ intimNote }}</p>
            </div>
            <p class="cpage__state"><i class="cpage__state-dot" :class="{ busy: thinking || !!currentQuiz || !!teacher }"></i>{{ stateText }}</p>
          </div>

          <!-- 卡底操作（2026-10-12 主次分离）：我们的成就 = 主操作，直接带等级与成就进度；给 TA 改名 = 次操作文字按钮 -->
          <div class="cpage__stage-ops">
            <button type="button" class="cpage__op-main" @click="openOurAchievements">
              <span class="cpage__op-main-ic"><UiIcon name="sparkle" :size="14" /></span>
              <span class="cpage__op-main-t">我们的成就</span>
              <span class="cpage__op-main-meta">Lv{{ intim.level || 1 }} {{ titleOf(intim.level) }} · {{ ourDoneCount }}/{{ ourAch.length }}</span>
              <span class="cpage__op-main-go">›</span>
            </button>
            <button v-if="!renamingInline" type="button" class="cpage__op-text" @click="startRenameInline">
              <UiIcon name="settings" :size="13" /> 给 TA 改名
            </button>
            <template v-else>
              <input v-model="nameBuf" class="cpage__op-input" maxlength="6" placeholder="最多 6 字" @keyup.enter="saveRenameInline" />
              <button type="button" class="cpage__op is-pri" :disabled="savingName" @click="saveRenameInline">保存</button>
              <button type="button" class="cpage__op" @click="renamingInline = false">取消</button>
            </template>
          </div>
        </section>

        <!-- ② 对话工作台：云端历史 -->
        <section class="surface-standard cpage__bench">
          <div class="cpage__bench-head">
            <div class="cpage__bench-tl">
              <span class="cpage__bench-t">对话记录</span>
              <span class="cpage__bench-sub">云端同步 · 换设备不丢</span>
            </div>
            <div class="cpage__bench-actions">
              <button class="cpage__newbtn" :disabled="busy || thinking" title="开始一段新对话" @click="newSession">＋ 新对话</button>
              <button class="cpage__histbtn" title="历史对话" @click="openSessions">
                <svg width="13" height="13" viewBox="0 0 14 14" style="flex:none">
                  <circle cx="7" cy="7" r="5.6" stroke="currentColor" stroke-width="1.3" fill="none" />
                  <path d="M7 4v3.2l2.1 1.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" />
                </svg>
                历史
              </button>
            </div>
          </div>
          <!-- 常驻题目栏（2026-10-08）：钉在对话区头部，log 内部滚动时始终可见 -->
          <div v-if="stageCard" class="cpage__qbar" :class="{ 'is-pending': stageCard.mode === 'pending' }">
            <div class="cpage__qbar-head">
              <span class="cpage__qbar-subject">{{ subjectShort(stageCard.subject) || '当前题目' }}</span>
              <span class="cpage__qbar-hint">当前题目</span>
              <button v-if="stageCard.mode === 'quiz'" class="cpage__qbar-toggle" title="这题先聊到这，回到闲聊" @click="currentQuiz = null">聊完啦</button>
              <button v-if="stageCard.mode === 'pending'" class="cpage__qbar-go" @click="startTeachFromPending">开始教 TA</button>
              <button v-else-if="qFoldable" class="cpage__qbar-toggle" @click="qExpand = !qExpand">
                {{ qExpand ? '收起' : '展开全文' }}<i class="cpage__qbar-caret" :class="{ up: qExpand }"></i>
              </button>
            </div>
            <p class="cpage__qbar-text" :class="{ open: qExpand || !qFoldable }">{{ stageCard.text }}</p>
            <!-- 移动端紧凑摘要行（点击开浮层看全文） -->
            <div class="cpage__qbar-sumrow" @click="qLayerOpen = true">
              <span class="cpage__qbar-sumtext">{{ stageCard.text }}</span>
              <i class="cpage__qbar-caret"></i>
            </div>
          </div>
          <!-- 移动端题目浮层 -->
          <div v-if="qLayerOpen" class="cpage__qbar-mask" @click.self="qLayerOpen = false">
            <div class="cpage__qbar-layer">
              <div class="cpage__qbar-head">
                <span class="cpage__qbar-subject">{{ stageCard ? (subjectShort(stageCard.subject) || '当前题目') : '' }}</span>
                <button class="cpage__qbar-toggle" @click="qLayerOpen = false">收起</button>
              </div>
              <p class="cpage__qbar-text open">{{ stageCard ? stageCard.text : '' }}</p>
              <button v-if="stageCard && stageCard.mode === 'pending'" class="cpage__qbar-go is-layer-go" @click="qLayerOpen = false; startTeachFromPending()">开始教 TA</button>
            </div>
          </div>
          <div ref="logRef" class="cpage__log">
            <div v-for="m in msgs" :key="m.key" class="cpage__msg" :class="'is-' + m.who">
              <div class="cpage__msg-body"><MarkdownText :content="m.content" /><span v-if="m.streaming" class="ai-caret" /></div>
              <button v-if="m.failed" class="cpage__msg-retry" @click="retryChat(m)">发送失败 · 点我重试</button>
              <!-- p17: 求教泡找回卡片——主页冒泡后没点气泡直接进来的，一键开局 -->
              <button v-if="m.meta && m.meta.pending" class="cpage__msg-retry" @click="startTeachFromCard(m)">开始教 TA</button>
              <span class="cpage__msg-time">{{ fmtTime(m.created_at) }}</span>
            </div>
            <div v-if="!msgs.length && !loading" class="cpage__empty">
              <p class="cpage__empty-t">还在这页发呆？先挑一件事做<span>点下面任一项就能开始</span></p>
              <div class="cpage__ability">
                <button type="button" class="cpage__ab" @click="focusDraft()">
                  <span class="cpage__ab-ic">☺</span><b>随便聊聊</b>
                  <i>今天的题、烦心的事、随便什么都能说</i>
                </button>
                <button type="button" class="cpage__ab" @click="toolQuiz()">
                  <span class="cpage__ab-ic">✎</span><b>让 TA 考你</b>
                  <i>从你的错题里挑几道，答完当场点评</i>
                </button>
                <button type="button" class="cpage__ab" @click="toolTeach()">
                  <span class="cpage__ab-ic">🎓</span><b>你来讲，TA 听</b>
                  <i>讲一遍最记得住，TA 会追问、帮你补漏</i>
                </button>
              </div>
              <div class="cpage__starters">
                <button v-for="q in STARTERS" :key="q" type="button" class="cpage__starter"
                        :disabled="busy || thinking || chatExhausted" @click="sendChat(q)">{{ q }}</button>
              </div>
            </div>
          </div>

          <!-- ③ 输入栏（2026-10-12：从"横跨整页的底部条"移入对话卡内部，钉在卡底）：
               工具条（考我一道 / 我来教 TA / 语音）+ 文字输入，与上方消息区有独立底栏的层级区分 -->
          <div class="cpage__inputbar">
            <div class="cpage__tools">
              <button type="button" class="cpage__tool" :disabled="busy || thinking" @click="toolQuiz()">
                <span class="cpage__tool-k">✎</span> 考我一道
              </button>
              <button type="button" class="cpage__tool" :disabled="busy || thinking" @click="toolTeach()">
                <span class="cpage__tool-k">🎓</span> 我来教 TA
              </button>
              <button type="button" class="cpage__tool" :disabled="asrUnsupported || busy"
                      :title="asrUnsupported ? '语音需要麦克风权限' : '按住说话，松手转文字'"
                      @pointerdown.prevent="startRec" @pointerup="stopRec(true)"
                      @pointerleave="recActive && stopRec(true)" @pointercancel="stopRec(true)">
                <span class="cpage__tool-k">🎙</span> {{ asrBusy ? '转写中…' : recActive ? '松手发送' : '语音输入' }}
              </button>
            </div>
            <div class="cpage__inputrow">
              <input
                ref="draftInput"
                v-model="draft"
                class="cpage__input"
                :placeholder="thinking ? activeName + ' 正在想…稍等一下' : (currentQuiz || teacher ? '讲解，或随时向 TA 提问…' : (chatExhausted ? 'TA 今天累了，明天再来聊吧' : '输入消息，或按住按钮语音转文字…'))"
                maxlength="2000"
                @keyup.enter="sendText"
              />
              <button class="cpage__send" :disabled="busy || thinking || !draft.trim()" @click="sendText">{{ thinking ? '…' : '发送' }}</button>
            </div>
          </div>
        </section>
      </div>

      <!-- p20: 历史对话抽屉——列表（标题/预览/时间）+ 重命名 + 删除，点条目切回该会话 -->
      <div v-if="sessionsOpen" class="cpage__mask" @click.self="sessionsOpen = false">
        <div class="cpage__sess">
          <div class="cpage__sess-head">
            <span class="cpage__sess-title">历史对话</span>
            <button class="cpage__x" type="button" title="关闭（也可以点空白处或按 Esc）" aria-label="关闭"
                    @click="sessionsOpen = false"><UiIcon name="close" :size="15" /></button>
          </div>
          <div class="cpage__sess-list">
            <div
              v-for="s in sessions" :key="s.id"
              class="cpage__sess-item" :class="{ active: s.id === currentSessionId }"
              @click="switchSession(s)"
            >
              <template v-if="renamingId === s.id">
                <input
                  v-model="renameBuf" class="cpage__sess-ren" maxlength="18"
                  placeholder="输入新名字（最多 18 字）"
                  @click.stop @keyup.enter="confirmRename(s)"
                />
                <button class="cpage__sess-save" @click.stop="confirmRename(s)">保存</button>
              </template>
              <template v-else>
                <div class="cpage__sess-t">
                  <span class="cpage__sess-name">{{ s.title || '新对话' }}</span>
                  <i v-if="s.has_chain" class="cpage__sess-dot" title="这道题还没聊完"></i>
                </div>
                <div class="cpage__sess-last">{{ s.last || '（还没有消息）' }}</div>
                <div class="cpage__sess-meta">
                  <span>{{ fmtTime(s.updated_at) }}</span>
                  <span class="cpage__sess-ops">
                    <button @click.stop="startRename(s)">改名</button>
                    <button class="danger" @click.stop="askDeleteSession(s)">删除</button>
                  </span>
                </div>
              </template>
            </div>
            <div v-if="!sessions.length && !sessionsLoading" class="cpage__sess-empty">还没有历史对话</div>
          </div>
        </div>
      </div>

      <!-- ② 切换伙伴弹窗：唯一入口（角色网格 + 当前角色的名字/大小设置） -->
      <div v-if="switchOpen" class="cpage__mask" @click.self="switchOpen = false">
        <div class="cpage__modal">
          <h2 class="cpage__modal-t">切换伙伴</h2>
          <p class="cpage__modal-hint">选一位伙伴，TA 会记住和你的聊天与进度</p>
          <div class="cpage__grid">
            <button
              v-for="c in allChars"
              :key="c.id"
              class="cpage__ccard"
              :class="{ active: c.id === activeId }"
              @click="switchCharacter(c.id)"
            >
              <span class="cpage__ccard-ph"><img :src="c.src" alt="" :onerror="c.custom ? '' : undefined" /></span>
              <span class="cpage__ccard-nm">{{ displayName(c) }}</span>
              <span class="cpage__ccard-intro">{{ CHAR_INTRO[c.id] || (c.custom ? (c.persona || '').slice(0, 20) : '') }}</span>
              <span v-if="c.id === activeId" class="cpage__ccard-tag">当前</span>
              <span v-if="c.custom" class="cpage__ccard-acts">
                <span class="cpage__ccard-edit" title="编辑这个伙伴" @click.stop="openWizard(c)">✎</span>
                <span class="cpage__ccard-del" title="删除这个伙伴" @click.stop="askDeleteChar(c)">×</span>
              </span>
            </button>
            <button class="cpage__ccard cpage__ccard--ghost" @click="openWizard">
              <span class="cpage__ccard-plus">＋</span>
              <span class="cpage__ccard-nm">造角色</span>
              <span class="cpage__ccard-intro">上传形象，AI 塑造性格</span>
            </button>
          </div>
          <div class="cpage__modal-foot">
            <div class="cpage__set-row">
              <span class="cpage__set-label">角色大小</span>
              <input v-model.number="sizeScale" type="range" min="0.6" max="2" step="0.1" class="cpage__slider" />
              <span class="cpage__set-val">{{ sizeScale.toFixed(1) }}x{{ sizeClamped ? '(上限)' : '' }}</span>
            </div>
            <p class="cpage__set-hint">大小对所有伙伴通用，切换后保持不变；名字则每位伙伴独立</p>
            <div class="cpage__set-row">
              <span class="cpage__set-label">名字</span>
              <input v-model="nameBuf" class="cpage__rename" maxlength="6" placeholder="给TA改名（最多6字）" />
              <UiButton size="small" :loading="savingName" @click="saveName">保存</UiButton>
            </div>
          </div>
          <div class="cpage__modal-actions">
            <UiButton variant="primary" @click="switchOpen = false">确定</UiButton>
          </div>
        </div>
      </div>

      <!-- ②b 造角色向导弹窗：形象 → 性格 → 命名，三步完成 -->
      <div v-if="wizardOpen" class="cpage__mask" @click.self="wizardOpen = false">
        <div class="cpage__modal cpage__modal--wiz">
          <h2 class="cpage__modal-t">{{ wizEditId ? '编辑伙伴' : '造角色' }}</h2>
          <p class="cpage__modal-hint">{{ wizEditId ? '改完保存，和 TA 的聊天记录都会保留' : ('第 ' + wizStep + ' / 3 步 · ' + ['上传形象', '塑造性格', '命名登场'][wizStep - 1]) }}</p>

          <!-- 步骤 1：上传照片 → AI 画成 Q 版立绘（每账号终身 3 次） -->
          <div v-if="wizStep === 1" class="wiz__body">
            <div class="wiz__drop" :class="{ 'has-img': wizPhoto || wizImg }" @click="pickImage">
              <img v-if="wizImg" :src="wizImg" alt="" />
              <img v-else-if="wizPhoto" :src="wizPhoto" class="wiz__photo" alt="" />
              <template v-else>
                <span class="wiz__drop-plus">＋</span>
                <span>上传一张人物照片</span>
                <span class="wiz__drop-sub">AI 照着 TA 画出 Q 版学习伙伴（PNG / JPG / WebP，≤8MB）</span>
              </template>
            </div>
            <input ref="fileRef" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" @change="onFileChosen" />
            <p class="wiz__tip">照片只用来给 AI 参考画 TA，不会公开；请上传你有权使用的图片</p>
            <div class="wiz__gen-row">
              <UiButton variant="primary" :loading="wizBusy" :disabled="!wizPhoto || wizLeft === 0" @click="genArt">
                {{ wizImg ? (wizEditId ? '重新画一张' : '再画一张') : 'AI 帮我画' }}
              </UiButton>
              <span v-if="wizLeft >= 0" class="wiz__left">还能画 {{ wizLeft }} 次</span>
              <UiButton v-if="wizImg" :disabled="wizBusy" @click="wizStep = 2">就这张，下一步</UiButton>
            </div>
          </div>

          <!-- 步骤 2：性格模板 + 一句话补充 -->
          <div v-else-if="wizStep === 2" class="wiz__body">
            <div class="wiz__tpls">
              <button
                v-for="t in WIZ_TEMPLATES" :key="t.k"
                class="wiz__tpl" :class="{ active: wizTemplate === t.k }"
                @click="wizTemplate = t.k"
              >
                <span class="wiz__tpl-nm">{{ t.label }}</span>
                <span class="wiz__tpl-desc">{{ t.desc }}</span>
              </button>
            </div>
            <textarea
              v-model="wizExtra" class="wiz__extra" rows="2" maxlength="120"
              placeholder="（可选）一句话补充 TA 的特点，如：爱打瞌睡的转学生， carry 全场却总说随便学学"
            ></textarea>
            <p class="wiz__tip">AI 会把模板性格和你的补充融合成 TA 独一无二的人设，还会为 TA 写专属台词</p>
          </div>

          <!-- 步骤 3：命名 + 预览 -->
          <div v-else class="wiz__body wiz__body--final">
            <div class="wiz__preview">
              <img :src="wizImg" alt="" />
            </div>
            <div class="wiz__final-form">
              <input v-model="wizName" class="wiz__name" maxlength="6" placeholder="给 TA 起个名字（最多 6 字）" />
              <p class="wiz__final-meta">
                性格：<b>{{ (WIZ_TEMPLATES.find(t => t.k === wizTemplate) || {}).label || '未选择' }}</b>
                <template v-if="wizExtra.trim()"> · {{ wizExtra.trim().slice(0, 24) }}</template>
              </p>
            </div>
          </div>

          <p v-if="wizErr" class="wiz__err">{{ wizErr }}</p>
          <div class="cpage__modal-actions">
            <UiButton v-if="wizStep > 1" :disabled="wizBusy" @click="wizStep--">上一步</UiButton>
            <UiButton v-if="wizStep === 1" :disabled="!wizPhoto" @click="wizStep = 2">先跳过，直接选性格</UiButton>
            <UiButton v-else-if="wizStep === 2" variant="primary" :disabled="!wizTemplate" @click="wizStep = 3">下一步</UiButton>
            <UiButton v-else variant="primary" :loading="wizBusy" @click="saveArt">创造 TA！</UiButton>
          </div>
        </div>
      </div>

      <!-- 我们的成就（2026-10-11）：亲密度 + 共同经历 + 该伙伴的伴学成就 -->
      <div v-if="ourAchOpen" class="cpage__mask" @click.self="ourAchOpen = false">
        <div class="cpage__our">
          <div class="cpage__our-head">
            <span class="cpage__our-title">我们的成就</span>
            <span class="cpage__our-sub">和 {{ activeName }} 一起</span>
            <button class="cpage__x" type="button" title="关闭（也可以点空白处或按 Esc）" aria-label="关闭"
                    @click="ourAchOpen = false"><UiIcon name="close" :size="15" /></button>
          </div>
          <div class="cpage__our-body">
            <div class="cpage__our-intim">
              <div class="cpage__our-lv">
                <b>Lv{{ intim.level || 1 }}</b>
                <span>{{ titleOf(intim.level) }}</span>
              </div>
              <div class="cpage__our-bar"><i :style="{ width: intimPct + '%' }"></i></div>
              <p class="cpage__our-note">{{ intimNote }}</p>
              <div class="cpage__our-nums">
                <span><b>{{ ourStats.msgs || 0 }}</b><i>聊过几句</i></span>
                <span><b>{{ ourStats.sessions || 0 }}</b><i>几段对话</i></span>
                <span><b>{{ ourDays }}</b><i>认识几天</i></span>
                <span><b>{{ ourStats.deeds || 0 }}</b><i>一起过题</i></span>
              </div>
            </div>
            <div class="cpage__our-list">
              <div class="cpage__our-listtop">
                <span>伴学成就</span>
                <span>{{ ourDoneCount }} / {{ ourAch.length }}</span>
              </div>
              <div class="cpage__our-grid">
                <div v-for="a in ourAch" :key="a.key" class="cpage__ach" :class="{ done: a.done }">
                  <div class="cpage__ach-top">
                    <b>{{ a.name }}</b>
                    <span class="cpage__ach-r">{{ a.rarityName }}</span>
                  </div>
                  <p>{{ a.desc }}</p>
                  <div class="cpage__ach-bar"><i :style="{ width: a.pct + '%' }"></i></div>
                  <span class="cpage__ach-p">{{ a.done ? '已达成' : `${a.cur} / ${a.target}` }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
  <!-- 新手教程 -->
  <UiTour v-model="tourOpen" tour-key="companion" />
</template>

<script setup>
/**
 * CompanionPage · 伙伴页（/companion）
 * ---------------------------------------------------------------------------
 * 互学界面三件套：① 角色舞台（立绘待机 + 语音气泡逐字打出 + 思考态）
 *                 ② 对话工作台（companion_msgs 云端历史，与迷你面板共用一份）
 *                 ③ 输入栏（按住说话语音转文字 + 文字，双通道）
 * 决策沿用定案：大小滑块 0.6~2.0x 只管页面立绘、防抖存云端（companion_pref）；
 * 改名上云并广播给行走层；问答 10 轮/日独立额度、不沉淀错题本；
 * 冒泡问题气泡点击 → /companion?quiz=<question_id> 自动开局。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '../ui/toast.js'
import { ElMessage, ElMessageBox } from '../ui/notify.js'
import UiButton from '../ui/UiButton.vue'
import UiTour from '../ui/UiTour.vue'
import { useTour } from '../lib/useTour.js'
import UiIcon from '../ui/UiIcon.vue'
import MarkdownText from '../components/MarkdownText.vue'
import { api } from '../api.js'
import { isLoggedIn, getToken, getUserId } from '../auth.js'
import { ROUTES } from '../lib/routes.js'
import { CHARACTERS, QUOTA_LINES, compLs as ls, customChars, setCustomChars, findCharCfg, isCustomId, customLines, subjectShort, activeId, setActiveCompId, companionMetaOf, companionTitleOf, filterHiddenChars } from '../lib/companions.js'
import { setCompanionStats } from '../stores/companionStatsStore'
import { evaluateNow, recordAction } from '../statsStore'
import { ACHIEVEMENTS, RARITY_NAME } from '../achievements.js'

const route = useRoute()
const router = useRouter()

const isDesktop = ref(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
let mq = null
const onMq = (e) => { isDesktop.value = e.matches; measureStage() }

const loggedIn = computed(() => isLoggedIn())
/* activeId 为 companions.js 模块级共享 ref（2026-10-09）：与行走层同实例，切换走 setActiveCompId */
const cfg = computed(() => findCharCfg(activeId.value) || CHARACTERS[0])
/* 切换弹窗网格：内置角色 + 用户自定义角色合并渲染；被隐藏的角色（奶龙/奶蛙）不出现在切换列表里 */
const allChars = computed(() => filterHiddenChars([...CHARACTERS, ...customChars.value]))

/* 切换弹窗用的一句话介绍（人设浓缩版） */
const CHAR_INTRO = {
  chibi_girl: '初二元气少女，「水果讲题法」创始人',
  school_girl: '高二温柔学姐，「慢慢来是最快的路」',
  che: '高一滑板少年，行动派，情绪极稳',
  luyi: '西餐厅长大的细节控，最懂措辞',
  yue: '初三篮球队长，用比赛术语讲学习',
  nailong: '奶系次元转学生，气氛组委员',
  naiwa: '奶龙的发小，负责让你笑出声',
}

/* ---------------- 表情差分联动：打字中 talk、夸赞 happy、答错 surprised、待机 blink ---------------- */
const faceState = ref('normal')
let faceT = null
let blinkTimer = null
const faceSrc = computed(() => {
  const f = cfg.value.faces || {}
  return f[faceState.value] || cfg.value.src
})
const ghostRef = ref(null)
/* 换脸交叉淡出：说话嘴型/眨眼 260ms 硬切整图在镜头下是频闪 → 旧脸叠层 150ms 淡出（根因修复 2026-10-13） */
watch(faceSrc, (nv, ov) => {
  const g = ghostRef.value
  if (!g || !ov || ov === nv) return
  g.src = ov
  g.style.transition = 'none'
  g.style.opacity = '1'
  void g.offsetWidth
  g.style.transition = 'opacity .15s ease'
  g.style.opacity = '0'
})
function setFace(state, ms = 1600) {
  faceState.value = state
  clearTimeout(faceT)
  if (state !== 'normal' && state !== 'blink') {
    faceT = setTimeout(() => { faceState.value = 'normal' }, ms)
  }
}
function startBlinkLoop() {
  stopBlinkLoop()
  blinkTimer = setInterval(() => {
    if (faceState.value !== 'normal') return
    faceState.value = 'blink'
    setTimeout(() => { if (faceState.value === 'blink') faceState.value = 'normal' }, 260)
  }, 4200)
}
function stopBlinkLoop() { clearInterval(blinkTimer); blinkTimer = null }

/* ---------------- 名字：云端优先，localStorage 兜底，跨组件广播同步 ---------------- */
const cloudNames = reactive({})
const displayName = (c) => cloudNames[c.id] || ls.get('name-' + c.id) || c.name
const activeName = computed(() => displayName(cfg.value))

/* ---------------- 状态 ---------------- */
const loading = ref(false)
const thinking = ref(false)
const busy = ref(false)
let chatFailStreak = 0   // p17: 聊天连续失败计数（>=2 提示真实原因）
const savingName = ref(false)
const switchOpen = ref(false)   // 切换伙伴弹窗（唯一入口）
const draft = ref('')
const msgs = reactive([])
const chatLeft = ref(20)
const quizLeft = ref(10)
/* v8 额度人设化:超额后不弹系统报错，角色说"累了明天再聊"；聊天/问答额度独立（小老师模式不受影响） */
const chatExhausted = ref(false)
const quizExhausted = ref(false)
const quotaLineOf = () => {
  const pool = customLines('quota', cfg.value) || QUOTA_LINES[activeId.value] || QUOTA_LINES.default
  return pool[Math.floor(Math.random() * pool.length)]
}
const nameBuf = ref('')
const currentQuiz = ref(null)   // { question_id, question, source }：出题后未点评前，输入即作答
const teacher = ref(null)       // { chain_id, total, step_idx }：小老师模式进行中（角色求教、用户讲解）
/* p18: 舞台常驻题目卡——小老师进行中的题 / 考你模式的题 / 主页求教泡还没讲的题，统一挂在舞台底部一直看得见。
 * p19: 去 AI 感——卡上只有题目原文（+待讲时的「开始教 TA」按钮），不放任何标签/进度/来源字眼 */
const teacherQ = ref(null)      // { text, step, total }：当前正在讲的题目（step/total 仅内部用，不显示）
const pendingQ = ref(null)      // { qid, q, source }：主页冒泡后还没讲的求教题（pending-quiz 的响应式镜像）
const qExpand = ref(false)      // 长题展开/收起
const qLayerOpen = ref(false)   // 移动端题目浮层（2026-10-08 常驻题目栏）
const stageCard = computed(() => {
  if (teacherQ.value) return { mode: 'teacher', text: teacherQ.value.question || teacherQ.value.text, subject: teacherQ.value.subject || '' }
  if (currentQuiz.value) return { mode: 'quiz', text: currentQuiz.value.question, subject: currentQuiz.value.subject || '' }
  if (pendingQ.value) return { mode: 'pending', text: pendingQ.value.q, subject: pendingQ.value.subject || '' }
  return null
})
const qFoldable = computed(() => !!(stageCard.value && stageCard.value.text.length > 100))   // 2026-10-08：阈值 66→100，常见题不折叠
watch(() => stageCard.value && stageCard.value.text, () => { qExpand.value = false; qLayerOpen.value = false })   // 换题时收起，避免旧展开态套新题

/* ---------------- M4: 亲密度（每角色独立，讲题/聊天涨经验）+ 三维判分展示 ---------------- */
const intim = ref({ level: 0, exp: 0, exp_in_level: 0, per_level: 50, max_level: 7 })
const intimPct = computed(() => {
  if (!intim.value.level) return 0
  if (intim.value.level >= intim.value.max_level) return 100
  return Math.min(100, Math.round(((intim.value.exp_in_level || 0) / (intim.value.per_level || 50)) * 100))
})
// walkdep16: 三维测评（概念/逻辑/表达）已移除，改为好感制——讲解质量越高好感涨越多
const favFloat = ref({ n: 0, key: 0 })
function showFav(n) {
  if (!(n > 0)) return
  favFloat.value = { n, key: Date.now() }   // key 变化即重触发 CSS 上浮动画
}
/* ---------------- 2026-10-11：角色卡信息 / 我们的成就 / 输入工具条 ---------------- */
const STARTERS = ['今天有点学不进去…', '考我一道题吧', '我有道题想讲给你听']
/** 角色元信息（性格标签 / 讲题风格，见 lib/companions.js COMPANION_META） */
const meta = computed(() => companionMetaOf(activeId.value))
function titleOf(lv) { return companionTitleOf(lv) }
/** 亲密度说明：还差多少升级 / 已满级 */
const intimNote = computed(() => {
  const lv = Number(intim.value.level) || 1
  const max = Number(intim.value.max_level) || 7
  const per = Number(intim.value.per_level) || 50
  const inLv = Number(intim.value.exp_in_level) || 0
  if (lv >= max) return `已经是最高等级 · 累计经验 ${intim.value.exp || 0}`
  return `再攒 ${Math.max(0, per - inLv)} 点升到 Lv${lv + 1}「${companionTitleOf(lv + 1)}」· 讲题与聊天都会涨`
})
/** 当前状态一句话 */
const stateText = computed(() => {
  if (thinking.value) return '正在想…'
  if (teacher.value) return '正在听你讲题'
  if (currentQuiz.value) return '刚出了一道题，等你答'
  if (chatExhausted.value) return '今天聊够啦，明天再来'
  return '现在有空，随时可以聊'
})

const draftInput = ref(null)
function focusDraft() { nextTick(() => { if (draftInput.value) draftInput.value.focus() }) }
/** 工具条 / 能力卡：考我一道（已在答题就聚焦输入框） */
function toolQuiz() {
  if (busy.value || thinking.value) return
  if (currentQuiz.value) { focusDraft(); return }
  startQuiz('')
}
/** 工具条 / 能力卡：我来教 TA（后端会挑一道想请教的题；没有则给提示） */
function toolTeach() {
  if (busy.value || thinking.value) return
  if (teacher.value) { focusDraft(); return }
  startTeacher('')
}

/** 卡底：给 TA 改名（内联编辑，复用现有 saveName） */
const renamingInline = ref(false)
function startRenameInline() {
  nameBuf.value = displayName(cfg.value) || cfg.value.name || ''
  renamingInline.value = true
}
async function saveRenameInline() {
  await saveName()
  renamingInline.value = false
}

/* 我们的成就（弹层）：亲密度 + 共同经历 + 该伙伴的伴学成就 */
const ourAchOpen = ref(false)
const ourStats = ref({})
const OUR_KEYS = ACHIEVEMENTS.filter((a) => a.group === '伴学伙伴').map((a) => a.key)
const ourAch = computed(() => ACHIEVEMENTS.filter((a) => a.group === '伴学伙伴').map((a) => {
  let cur = 0
  try { cur = Number(a.value({ companion: ourStats.value })) || 0 } catch (e) { cur = 0 }
  return {
    key: a.key, name: a.name, desc: a.desc, rarity: a.rarity, rarityName: RARITY_NAME[a.rarity] || '',
    target: a.target, cur, done: cur >= a.target,
    pct: a.target ? Math.min(100, Math.round((cur / a.target) * 100)) : 0,
  }
}))
const ourDoneCount = computed(() => ourAch.value.filter((a) => a.done).length)
const ourDays = computed(() => {
  const first = Number(ourStats.value.first_at) || 0
  return first ? Math.max(0, Math.floor((Date.now() - first) / 86400000)) : 0
})
function openOurAchievements() {
  ourAchOpen.value = true
  loadCompanionStats()
}

/** 拉取「与当前伙伴」的累计统计 → 写缓存（成就判定同步读）→ 触发一次成就判定 */
async function loadCompanionStats() {
  if (!loggedIn.value) return
  try {
    const r = await api.companionStats(activeId.value)
    if (r && r.ok && r.stats) {
      ourStats.value = r.stats
      setCompanionStats(activeId.value, r.stats)
      evaluateNow()
    }
  } catch (e) {
    /* 统计失败不影响主流程 */
  }
}
onMounted(() => { loadCompanionStats() })
watch(activeId, () => { loadCompanionStats() })
/** 一轮对话/讲解结束后刷新一次（节流 6s，避免刷屏式请求） */
let statsAt = 0
watch(() => msgs.length, (n) => {
  if (!n) return
  const now = Date.now()
  if (now - statsAt < 6000) return
  statsAt = now
  loadCompanionStats()
})

function applyIntimacy(x) {
  if (x && typeof x.level === 'number' && x.level > 0) intim.value = x
}
const logRef = ref(null)
let msgSeq = 0

/* 气泡打字机（约 30 字/秒，点击直接显示全文）；打字中角色配 talk 表情 */
const bubble = reactive({ visible: false, full: '', shown: '', timer: null, hideT: null })
function speakBubble(text) {
  bubble.full = String(text || '')
  bubble.shown = ''
  bubble.visible = true
  setFace('talk')
  clearInterval(bubble.timer)
  clearTimeout(bubble.hideT)
  let i = 0
  bubble.timer = setInterval(() => {
    i = Math.min(bubble.full.length, i + 1 + Math.floor(Math.random() * 2))
    bubble.shown = bubble.full.slice(0, i)
    if (i >= bubble.full.length) {
      clearInterval(bubble.timer)
      setFace('normal')
      bubble.hideT = setTimeout(() => { bubble.visible = false }, 8000)
    }
  }, 40)
}
function finishTypewriter() {
  clearInterval(bubble.timer)
  bubble.shown = bubble.full
  clearTimeout(bubble.hideT)
  bubble.hideT = setTimeout(() => { bubble.visible = false }, 8000)
}

/* ---------------- 角色大小滑块（0.6~2.0x，实时预览，防抖写云端；同步全站行走角色） ----------------
 * v8(2026-10-06): 大小升级为用户级全局偏好——所有角色共用，切角色不重置。
 * 本地单键 size-global；云端写 companion_pref 保留行 __global__（跨设备）；
 * 迁移：无全局键时用旧 per-character 键 size-<activeId> 作种子。
 * 立绘双重限幅（用户定稿：不许超过舞台）：
 *   ① 高度上限 = 舞台盒高 - 气泡预留区（舞台盒高固定随视口，不随滑块生长 → 页面布局稳定）；
 *   ② 宽度上限 = 舞台容器可用宽 ÷ 立绘天然宽高比（豁免全局 img max-width 后防溢出/压扁）。
 * 达到上限时滑块旁标「上限」，并把最终倍数广播给行走层（zy-comp-size, scope:'global'）。 */
const readGlobalScale = () => {
  let s = parseFloat(ls.get('size-global'))
  if (!Number.isFinite(s)) {
    s = parseFloat(ls.get('size-' + activeId.value)) // 一次性迁移种子
    if (Number.isFinite(s)) ls.set('size-global', String(s))
  }
  return Math.max(0.6, Math.min(2, Number.isFinite(s) ? s : 1))
}
const sizeScale = ref(readGlobalScale())
let sizeTimer = null
watch(sizeScale, () => {
  clearTimeout(sizeTimer)
  sizeTimer = setTimeout(() => {
    api.companionPref('__global__', { size_scale: Math.round(sizeScale.value * 10) / 10 }).catch(() => {})
  }, 600)
  syncSizeEvent()
})
const stageBoxRef = ref(null)
const availW = ref(0)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
const charAspect = ref(null) // 立绘天然 宽/高（img load 时实测）
function onCharImgLoad(e) {
  const img = e.target
  if (img.naturalWidth && img.naturalHeight) charAspect.value = img.naturalWidth / img.naturalHeight
}
function measureStage() {
  vh.value = window.innerHeight
  nextTick(() => { if (stageBoxRef.value) availW.value = stageBoxRef.value.clientWidth - 16 })
}
const stageBoxH = computed(() => {
  // 2026-10-11：立绘下方新增角色信息区（约 200px），故把舞台高度系数下调，
  // 让「立绘 + 信息区」在常见视口里刚好一屏放得下
  const h = Math.round(vh.value * (isDesktop.value ? 0.54 : 0.48))
  return Math.max(isDesktop.value ? 380 : 300, Math.min(h, isDesktop.value ? 560 : 420))
})
const stageH = computed(() => {
  let h = Math.round((isDesktop.value ? 360 : 240) * sizeScale.value)
  const maxH = stageBoxH.value - 96 // 气泡预留区
  if (h > maxH) h = maxH
  if (charAspect.value && availW.value > 0) {
    const maxByW = Math.floor(availW.value / charAspect.value)
    if (h > maxByW) h = maxByW
  }
  return Math.max(h, 200)
})
const sizeClamped = computed(() => {
  const base = isDesktop.value ? 360 : 240
  return stageH.value / base < sizeScale.value - 0.05
})
function syncSizeEvent() {
  const s = Math.round(sizeScale.value * 10) / 10
  ls.set('size-global', s)
  /* v8: scope:'global'——行走层不再比对 characterId，所有角色直接应用 */
  window.dispatchEvent(new CustomEvent('zy-comp-size', { detail: { scope: 'global', sizeScale: s } }))
}

/* ---------------- 历史加载与渲染 ---------------- */
function pushMsg(who, kind, content, meta, created_at) {
  const m = { key: 'm' + Date.now() + '_' + msgSeq++, who, kind, content, meta: meta || {}, created_at: created_at || Date.now() }
  msgs.push(m)
  nextTick(scrollLog)
  return m
}
function scrollLog() {
  if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
}
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  return sameDay ? '今天 ' + hm : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm
}

/* ---------------- p20 多会话聊天记录：每次进入伙伴页新开一条，记忆按会话隔离 ----------------
 * 刷新（F5）不算新开：当前会话 id 存 sessionStorage，组件卸载（离开页面）时清除 →
 * 从其他页面再进来就自动开新记录。历史列表可切换/重命名/删除，链只在本会话内可见可续。 */
const currentSessionId = ref('')
const sessionsOpen = ref(false)
const sessions = ref([])
const sessionsLoading = ref(false)
const renamingId = ref('')
const renameBuf = ref('')
function sessKey() { return 'comp-sess-' + (getUserId() || 'anon') + '-' + activeId.value }
function saveSess(sid) {
  currentSessionId.value = sid || ''
  try { sid ? sessionStorage.setItem(sessKey(), sid) : sessionStorage.removeItem(sessKey()) } catch { /* ignore */ }
}
async function ensureSession() {
  let sid = ''
  try { sid = sessionStorage.getItem(sessKey()) || '' } catch { /* ignore */ }
  if (sid) { currentSessionId.value = sid; return }
  try {
    const s = await api.companionSessionCreate(activeId.value)
    saveSess(s && s.id)
  } catch {
    currentSessionId.value = ''   // 建会话失败兜底：按旧逻辑展示全量历史
  }
}
async function refreshSessions() {
  sessionsLoading.value = true
  try { sessions.value = await api.companionSessions(activeId.value) }
  catch (e) { ElMessage.error((e && e.message) || '历史记录加载失败') }
  finally { sessionsLoading.value = false }
}
async function openSessions() { sessionsOpen.value = true; await refreshSessions() }
async function newSession() {
  if (busy.value || thinking.value) return
  if (!msgs.length) { ElMessage.info('现在就是一条新对话，直接说吧~'); return }
  try {
    const s = await api.companionSessionCreate(activeId.value)
    saveSess(s && s.id)
    await loadAll()
    ElMessage.success('新对话开始啦')
  } catch (e) { ElMessage.error((e && e.message) || '没能开新对话，再试一次吧') }
}
function switchSession(s) {
  if (!s || s.id === currentSessionId.value) { sessionsOpen.value = false; return }
  saveSess(s.id)
  sessionsOpen.value = false
  loadAll()
}
function startRename(s) { renamingId.value = s.id; renameBuf.value = s.title || '' }
async function confirmRename(s) {
  const t = (renameBuf.value || '').trim()
  renamingId.value = ''
  if (!t) return
  try {
    await api.companionSessionRename(s.id, t)
    s.title = t
    toast.success('已改名')
  } catch (e) { ElMessage.error((e && e.message) || '改名失败') }
}
async function askDeleteSession(s) {
  try {
    await ElMessageBox.confirm(
      s.has_chain
        ? '这条对话里还有没聊完的题，删除后讲解进度会一并清掉（已讲过的部分仍会记进错题本）。确定删除吗？'
        : '删除后这条对话和里面的内容都无法找回，确定吗？',
      '删除对话',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '先不删' },
    )
  } catch { return }
  try {
    await api.companionSessionDelete(s.id)
    sessions.value = sessions.value.filter((x) => x.id !== s.id)
    toast.success('已删除')
    if (s.id === currentSessionId.value) { saveSess(''); await loadAll() }
  } catch (e) { ElMessage.error((e && e.message) || '删除失败') }
}

async function loadAll() {
  loading.value = true
  msgs.length = 0
  currentQuiz.value = null
  teacher.value = null
  teacherQ.value = null
  pendingQ.value = null
  try {
    await ensureSession()   // p20：刷新恢复当前会话 / 首次进入开新记录
    const d = await api.companionHistory(activeId.value, currentSessionId.value)
    chatLeft.value = d.chat_left
    quizLeft.value = d.quiz_left
    applyIntimacy(d.intimacy)
    chatExhausted.value = chatLeft.value <= 0
    quizExhausted.value = quizLeft.value <= 0
    for (const p of d.prefs) {
      cloudNames[p.character_id] = p.name || ''
      /* v8: 全局大小从 __global__ 保留行校准（本地滑块已即时生效，云端有值才覆盖 → 跨设备同步） */
      if (p.character_id === '__global__' && p.size_scale) {
        sizeScale.value = Math.round(p.size_scale * 10) / 10
      }
    }
    for (const m of d.msgs) {
      pushMsg(m.role === 'user' ? 'me' : 'ai', m.kind, m.content, m.meta, m.created_at)
    }
    // p20：切回旧会话时恢复该会话进行中的讲解态（题目卡重新挂上，可接着答）
    if (d.active_chain && d.active_chain.chain_id) {
      const ac = d.active_chain
      teacher.value = { chain_id: ac.chain_id, total: ac.total, step_idx: ac.step_idx }
      teacherQ.value = { question: ac.question || ac.ask, text: ac.ask, step: (ac.step_idx || 0) + 1, total: ac.total, subject: ac.subject || teacherQ.value?.subject || '' }   // question=总题目（2026-10-08 题目栏显示总题）
    }
    // 冒泡气泡/红问号点击跳转：/companion?quiz=<question_id>&mode=teacher 自动开局
    const qid = String(route.query.quiz || '')
    if (qid) {
      const teacherMode = String(route.query.mode || '') === 'teacher'
      router.replace({ query: { ...route.query, quiz: undefined, mode: undefined } })
      if (teacherMode) startTeacher(qid)
      else startQuiz(qid)
    } else if (!d.msgs.length) {
      /* p17: 求教泡找回——主页冒泡后没点气泡（点了角色聊天/直接进页）就弹找回卡片。
       * 泡泡本体 12 秒即焚且不落库，这里从 localStorage（10 分钟有效）恢复。
       * p20: 只在全新会话（还没消息）时弹，切回旧会话不打扰。 */
      const pq = readPendingQuiz()
      if (pq) {
        pendingQ.value = { ...pq, q: pq.full || pq.q, subject: pq.subject || '' }   // full=完整题干（2026-10-08 缓存新增）；旧缓存回退 42 字摘要
        pushMsg('ai', 'quiz', '刚才在主页有道题想请教你：「' + pq.q + '」，点下面的「开始教 TA」就行！',
                { pending: true, question_id: pq.qid, source: pq.source || '求教泡' })
        speakBubble('刚才那道题你想好了吗？点「开始教 TA」告诉我吧！')
      }
    }
  } catch (e) {
    ElMessage.error((e && e.message) || '加载聊天记录失败')
  } finally {
    loading.value = false
  }
}
function switchCharacter(id) {
  if (id === activeId.value) return
  setActiveCompId(id)   // 共享 ref：行走层同步跟随（2026-10-09）
  nameBuf.value = ''
  teacher.value = null   // 链在服务端保持 active，下次求教泡可断点续教
  loadAll()
  setFace('happy', 1400)
  speakBubble('换我上场啦！' + displayName(cfg.value) + '正式接管这局～')
}

/* ---------------- 造角色二期：自定义伴学角色（上传形象 + 性格模板 + LLM 融合人设/台词） ---------------- */
const WIZ_TEMPLATES = [
  { k: 'cheerful', label: '元气', desc: '嘴快心软，把知识点讲出趣味' },
  { k: 'gentle', label: '温柔', desc: '从不催促，把大问题拆成小步骤' },
  { k: 'cool', label: '高冷', desc: '寡言精准，安静陪伴加一句短评' },
  { k: 'passionate', label: '热血', desc: '比赛术语讲学习，卡住就是攒劲儿' },
  { k: 'funny', label: '搞怪', desc: '嘴上嫌弃手上偷练，无厘头比喻' },
  { k: 'healing', label: '治愈', desc: '笑出声之后，事情就没那么大了' },
]
const wizardOpen = ref(false)
const wizStep = ref(1)
const wizName = ref('')
const wizTemplate = ref('')
const wizExtra = ref('')
const wizImg = ref('')     // AI 生成的立绘 dataURL（预览用）
const wizRatio = ref(0.5)
const wizBusy = ref(false)
const wizErr = ref('')
/* AI 造角色（2026-10-09）：照片 → AI 画 → 预览 → 保存，每账号终身 3 次 */
const wizPhoto = ref('')   // 用户上传的照片 dataURL（canvas 压缩后）
const wizMime = ref('image/jpeg')
const wizGenId = ref('')
const wizLeft = ref(-1)    // 剩余生图次数（-1 = 未拉取）
const wizEditId = ref('')  // 非空 = 编辑模式（原地更新，聊天保留）
const fileRef = ref(null)

function openWizard(editChar) {
  if (!loggedIn.value) { ElMessage.info('登录后就可以造属于自己的伙伴啦！'); return }
  const editing = editChar && editChar.custom && editChar.id   // 防御：造角色按钮 @click="openWizard" 会误传 event
  wizEditId.value = editing ? editChar.id : ''
  wizStep.value = 1; wizName.value = editing ? editChar.name : ''; wizTemplate.value = ''; wizExtra.value = ''
  wizImg.value = editing ? editChar.src : ''; wizRatio.value = 0.5; wizErr.value = ''
  wizPhoto.value = ''; wizGenId.value = ''; wizLeft.value = -1
  wizardOpen.value = true
}
function pickImage() { if (fileRef.value) fileRef.value.click() }
function onFileChosen(ev) {
  const f = ev.target.files && ev.target.files[0]
  ev.target.value = ''
  if (!f) return
  if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { wizErr.value = '只支持 PNG / JPG / WebP 图片'; return }
  if (f.size > 8 * 1024 * 1024) { wizErr.value = '原图超过 8MB，请换一张小一点的'; return }
  const mime = f.type === 'image/png' ? 'image/png' : (f.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      // 压缩到 ≤720px 宽（AI 生图参考图），保留原始格式 mime
      const scale = Math.min(1, 720 / img.naturalWidth, 1080 / img.naturalHeight)
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      cv.getContext('2d').drawImage(img, 0, 0, w, h)
      wizPhoto.value = cv.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', 0.92)
      wizMime.value = mime
      wizImg.value = ''      // 换照片后旧立绘作废
      wizGenId.value = ''
      wizErr.value = ''
    }
    img.onerror = () => { wizErr.value = '图片解析失败，请换一张试试' }
    img.src = reader.result
  }
  reader.readAsDataURL(f)
}
/* AI 造角色：生图（扣终身次数）→ 预览 → 满意保存 / 不满意重画 */
async function genArt() {
  if (wizBusy.value) return
  if (!wizPhoto.value) { wizErr.value = '先上传一张人物照片'; return }
  if (wizLeft.value === 0) { wizErr.value = 'AI 画角色的 3 次机会已经用完啦'; return }
  wizBusy.value = true; wizErr.value = ''
  try {
    const d = await api.companionAiGen(wizPhoto.value, wizMime.value, wizExtra.value.trim().slice(0, 60))
    if (!d.ok) { wizErr.value = d.error || '生成失败，请稍后再试'; wizLeft.value = d.left ?? wizLeft.value; return }
    wizImg.value = d.preview
    wizGenId.value = d.gen_id
    wizLeft.value = d.left
    wizStep.value = 2
    setFace('happy', 1600)
    speakBubble('画好啦！快看看像不像你～')
  } catch (e) {
    wizErr.value = (e && e.message) || '生成失败，请稍后再试'
  } finally {
    wizBusy.value = false
  }
}
async function saveArt() {
  if (wizBusy.value) return
  const n = wizName.value.trim().slice(0, 6)
  if (!n) { wizErr.value = '先给 TA 起个名字吧'; return }
  if (!wizTemplate.value) { wizErr.value = '选一个性格模板'; return }
  if (!wizEditId.value && !wizGenId.value) { wizErr.value = '还没有生成角色形象'; return }
  // 编辑=原地更新（聊天保留）不弹替换确认；新建且已有角色才确认替换
  if (!wizEditId.value && customChars.value.length && !window.confirm('已经有一位专属伙伴「' + displayName(customChars.value[0]) + '」了，替换后 TA 的聊天记录会清空，确定吗？')) return
  wizBusy.value = true; wizErr.value = ''
  try {
    let d
    if (wizEditId.value) {
      d = await api.companionAiUpdate(wizEditId.value, wizGenId.value, n, wizTemplate.value, wizExtra.value.trim().slice(0, 120))
      if (d.ok) setCustomChars(customChars.value.map((c) => (c.id === d.char.id ? d.char : c)))
    } else {
      d = await api.companionAiSave(wizGenId.value, n, wizTemplate.value, wizExtra.value.trim().slice(0, 120))
      if (d.ok) setCustomChars([d.char])   // 每账号至多 1 个：替换语义（2026-10-09）
    }
    if (!d.ok) {
      wizErr.value = d.error || '保存失败，请重试'
      if ((d.error || '').includes('过期')) { wizGenId.value = ''; wizImg.value = ''; wizStep.value = 1 }   // 陈旧凭据：清掉引导重画
      return
    }
    wizGenId.value = ''   // 已落库，清陈旧凭据（2026-10-09 幂等修复）
    wizardOpen.value = false
    if (activeId.value !== d.char.id) switchCharacter(d.char.id)
    toast.success(wizEditId.value ? '「' + d.char.name + '」更新好啦，还是那个熟悉的 TA' : '「' + d.char.name + '」已经就位，去大厅看看 TA 吧！')
  } catch (e) {
    wizErr.value = (e && e.message) || '保存失败，请重试'
  } finally {
    wizBusy.value = false
  }
}
async function createChar() {
  const n = wizName.value.trim().slice(0, 6)
  if (!n) { wizErr.value = '先给 TA 起个名字吧'; return }
  if (!wizTemplate.value) { wizErr.value = '选一个性格模板'; return }
  if (!wizImg.value) { wizErr.value = '还差一张角色形象'; return }
  wizBusy.value = true; wizErr.value = ''
  try {
    const d = await api.companionCustomCreate({
      name: n, template: wizTemplate.value, extra: wizExtra.value.trim().slice(0, 120),
      image: wizImg.value, ratio: wizRatio.value,
    })
    setCustomChars([d.char, ...customChars.value])
    try { recordAction('cmCustom') } catch { /* 埋点失败不影响创建 */ }
    wizardOpen.value = false
    if (activeId.value !== d.char.id) switchCharacter(d.char.id)
    toast.success('「' + d.char.name + '」已经就位，去大厅看看 TA 吧！')
  } catch (e) {
    wizErr.value = (e && e.message) || '创建失败，请重试'
  } finally {
    wizBusy.value = false
  }
}
async function loadCustomList() {
  try {
    const d = await api.companionCustomList()
    if (d && d.ok) {
      setCustomChars(d.chars || [])
      // 本地持久化的 cu_ id 若已在云端删除，回退到内置角色
      if (isCustomId(activeId.value) && !customChars.value.some((c) => c.id === activeId.value)) {
        setActiveCompId(CHARACTERS[0].id)
      }
    }
  } catch { /* 静默 */ }
}
function askDeleteChar(c) {
  if (c.id === activeId.value) { ElMessage.warning('先切换到其他伙伴，再来和 TA 告别'); return }
  if (window.confirm('确定要删除「' + displayName(c) + '」吗？聊天记录和 TA 的一切都会清空，无法恢复。')) {
    api.companionCustomDelete(c.id).then(() => {
      setCustomChars(customChars.value.filter((x) => x.id !== c.id))
      toast.success('和「' + displayName(c) + '」说再见啦')
    }).catch((e) => ElMessage.error((e && e.message) || '删除失败'))
  }
}
/* ---------------- 改名（上云 + 广播给行走层） ---------------- */
async function saveName() {
  const n = nameBuf.value.trim().slice(0, 6)
  if (!n) { ElMessage.warning('先给 TA 起个名字吧'); return }
  savingName.value = true
  try {
    const p = await api.companionPref(activeId.value, { name: n })
    cloudNames[activeId.value] = p.name
    ls.set('name-' + activeId.value, p.name)
    window.dispatchEvent(new CustomEvent('zy-comp-name', { detail: { characterId: activeId.value, name: p.name } }))
    toast.success('以后就叫 TA「' + p.name + '」啦')
  } catch (e) {
    ElMessage.error((e && e.message) || '改名失败')
  } finally {
    savingName.value = false
  }
}

/* ---------------- 闲聊 ---------------- */
/* p17: 求教泡找回缓存（10 分钟有效；与 CompanionLayer 共用 localStorage 键） */
function readPendingQuiz() {
  try {
    const o = JSON.parse(ls.get('pending-quiz', '') || 'null')
    if (o && o.qid && Date.now() - o.ts < 600000) return o
  } catch { /* 坏数据忽略 */ }
  return null
}
function startTeachFromCard(m) {
  if (busy.value || thinking.value) return
  m.meta.pending = false
  ls.set('pending-quiz', '')   // 已开局，找回使命完成
  pendingQ.value = null        // p18: 题目卡同步撤下
  startTeacher(m.meta.question_id || '')
}
/* p18: 题目卡上的「开始教 TA」——与找回卡同流程，只是入口在舞台 */
function startTeachFromPending() {
  if (busy.value || thinking.value) return
  const qid = (pendingQ.value && pendingQ.value.qid) || ''
  pendingQ.value = null
  ls.set('pending-quiz', '')
  startTeacher(qid)
}

async function sendChat(text, isRetry = false) {
  if (!isRetry) pushMsg('me', 'chat', text)
  thinking.value = true
  const pq = readPendingQuiz()
  /* 先挂一条空 AI 气泡，逐字往里写（流式） */
  const aiMsg = pushMsg('ai', 'chat', '')
  aiMsg.streaming = true
  let acc = ''
  let finalReply = ''
  let streamErr = ''
  try {
    await api.companionStream({
      character: activeId.value,
      name: activeName.value,
      persona: cfg.value.persona,
      message: text,
      pending_question: pq ? pq.q : '',   // p17: 注入待请教题目，AI 被问「题目是啥」能如实复述
      session_id: currentSessionId.value, // p20: 记忆按会话隔离
    }, {
      onEvent: (ev) => {
        if (ev.delta) {
          acc += ev.delta
          aiMsg.content = acc
          scrollLog()
        } else if (ev.done) {
          finalReply = ev.reply || acc
          aiMsg.content = finalReply
          if (typeof ev.left === 'number') chatLeft.value = ev.left
          if (ev.intimacy) applyIntimacy(ev.intimacy)
        } else if (ev.error) {
          streamErr = ev.error
        }
      },
    })
    aiMsg.streaming = false
    if (streamErr) throw new Error(streamErr)
    chatFailStreak = 0
    speakBubble(finalReply || acc)
  } catch (e) {
    aiMsg.streaming = false
    if (!acc) msgs.splice(msgs.indexOf(aiMsg), 1)   // 一个字都没冒出来 → 别留空气泡
    /* v8: 超额切人设话术并禁用聊天输入，其余错误照旧 toast */
    if (e && e.quota_exhausted) {
      chatFailStreak = 0
      chatExhausted.value = true
      const line = quotaLineOf()
      pushMsg('ai', 'chat', line)
      speakBubble(line)
      return
    }
    chatFailStreak++
    if (chatFailStreak >= 2) {
      /* p17: 连续失败 2 次起给真实原因，不再只有角色话术让用户干等 */
      pushMsg('ai', 'chat', '⚠️ AI 服务好像暂时不可用（可能是模型服务额度或网络问题），你可以稍后再试。', { source: '服务提示' })
      ElMessage.warning('AI 服务暂时不可用，请稍后再试')
    }
    ElMessage.error((e && e.message) || '发送失败')
    /* v9: 失败消息不丢——最后一条我方消息打 failed 标记，气泡旁出重试按钮 */
    const last = [...msgs].reverse().find((m) => m.who === 'me' && m.kind === 'chat')
    if (last) last.failed = true
  } finally {
    thinking.value = false
  }
}
function retryChat(m) {
  if (busy.value || thinking.value) return
  m.failed = false
  sendChat(m.content, true)
}

/* ---------------- 轻量问答（10 轮/日，不沉淀错题本） ---------------- */
async function startQuiz(questionId = '') {
  if (busy.value || thinking.value) return
  thinking.value = true
  try {
    const r = await api.companionQuiz({
      action: 'start', character: activeId.value, name: activeName.value,
      persona: cfg.value.persona, question_id: String(questionId || ''),
      session_id: currentSessionId.value,   // p20: 考题绑定会话
    })
    if (typeof r.left === 'number') quizLeft.value = r.left
    if (r.empty) {
      pushMsg('ai', 'quiz', r.reply || '暂时没有能考你的题~', {})
      speakBubble(r.reply || '暂时没有能考你的题~')
      return
    }
    currentQuiz.value = { question_id: r.question_id, question: r.question, source: r.source, subject: r.subject || '' }
    pushMsg('ai', 'quiz', r.question, { source: r.source, question_id: r.question_id })
    speakBubble(r.question, r.source)
  } catch (e) {
    /* v8: 问答超额切人设话术（小老师模式不限额不受影响） */
    if (e && e.quota_exhausted) {
      quizExhausted.value = true
      const line = quotaLineOf()
      pushMsg('ai', 'quiz', line)
      speakBubble(line)
      return
    }
    ElMessage.error((e && e.message) || '出题失败')
  } finally {
    thinking.value = false
  }
}
async function answerQuiz(text) {
  const q = currentQuiz.value
  /* P2-5：点评期间不再撤题目卡（保留到成功后，作为追问通道） */
  pushMsg('me', 'quiz', text, { source: q.source })
  busy.value = true
  try {
    const r = await api.companionQuiz({
      action: 'answer', character: activeId.value, name: activeName.value,
      persona: cfg.value.persona, question: q.question, question_id: q.question_id,
      source: q.source, answer: text,
      session_id: currentSessionId.value,   // p20: 落库进当前会话
    })
    if (typeof r.left === 'number') quizLeft.value = r.left
    pushMsg('ai', 'quiz', r.reply, { source: q.source, question_id: q.question_id })
    speakBubble(r.reply)
    /* P1-1：按后端判定的 verdict 切脸；无 verdict（降级纯文本）不切 */
    setFace(r.verdict === 'pass' ? 'happy' : (r.verdict === 'wrong' ? 'surprised' : 'default'), 1800)
  } catch (e) {
    ElMessage.error((e && e.message) || '点评失败')
  } finally {
    busy.value = false
  }
}
function sendText() {
  const text = draft.value.trim()
  if (!text || busy.value || thinking.value) return
  draft.value = ''
  if (teacher.value) answerTeacher(text)
  else if (currentQuiz.value) answerQuiz(text)
  else if (chatExhausted.value) {
    /* v8: 聊天超额后不再发请求，重播一次人设话术（不重复扣额度/上屏） */
    const line = quotaLineOf()
    pushMsg('ai', 'chat', line)
    speakBubble(line)
  }
  else sendChat(text)
}

/* ---------------- 小老师模式：角色求教，用户当老师（链式问答，不占 10 轮额度） ---------------- */
async function startTeacher(questionId = '') {
  if (busy.value || thinking.value) return
  thinking.value = true
  try {
    const r = await api.companionQuiz({
      action: 'chain_start', character: activeId.value, name: activeName.value,
      persona: cfg.value.persona, question_id: String(questionId || ''),
      session_id: currentSessionId.value,   // p20: 链绑定会话（进度隔离）
    })
    if (r.empty) {
      pushMsg('ai', 'quiz', r.reply || '暂时没有想请教的题~', {})
      speakBubble(r.reply || '暂时没有想请教的题~')
      return
    }
    teacher.value = { chain_id: r.chain_id, total: r.total, step_idx: r.step_idx || 0 }
    ls.set('pending-quiz', '')   // p17: 求教泡找回缓存清空
    pendingQ.value = null        // p18: 题目卡从"待讲"切到进行中
    /* p19: 头消息单一事实源在后端（落库/返回同一段文本），前端只管显示；去进度/去称呼 */
    pushMsg('ai', 'quiz', r.head || (r.resume ? '这道题上次还是没讲完……我们接着聊好不好？' : '这道题我卡了好久，怎么都想不通，你能给我讲讲吗？'), {})
    pushMsg('ai', 'quiz', r.ask, { question_id: r.question_id })
    teacherQ.value = { question: r.question || r.ask, text: r.ask, step: (r.step_idx || 0) + 1, total: r.total, subject: r.subject || teacherQ.value?.subject || '' }   // p18: 题目上卡（question=总题目，2026-10-08 题目栏显示总题）
    speakBubble(r.ask)
  } catch (e) {
    ElMessage.error((e && e.message) || '没能开始，再试一次吧')
  } finally {
    thinking.value = false
  }
}
async function answerTeacher(text) {
  const t = teacher.value
  pushMsg('me', 'quiz', text, {})
  busy.value = true
  try {
    const r = await api.companionQuiz({
      action: 'chain_answer', character: activeId.value, name: activeName.value,
      persona: cfg.value.persona, chain_id: t.chain_id, answer: text,
      session_id: currentSessionId.value,   // p20: 落库进当前会话
    })
    applyIntimacy(r.intimacy)
    // walkdep16: intent=question → 角色以人设回答疑问（不判分不推进）；explain → 隐性判定推进关卡
    const isQ = r.intent === 'question'
    pushMsg('ai', 'quiz', r.reply, {})
    speakBubble(r.reply)
    if (r.favor > 0) showFav(r.favor)
    if (isQ) return
    if (r.verdict === 'pass') setFace('happy', 1800)
    else if (r.verdict === 'wrong') setFace('surprised', 1800)
    if (r.finished) {
      if (r.summary) {
        pushMsg('ai', 'quiz', r.summary, {})
        speakBubble(r.summary)
      }
      teacher.value = null
      teacherQ.value = null   // p18: 讲完撤卡
      ls.set('chainAt', String(Date.now()))   // 行走层据此冷却 3~5 分钟
      return
    }
    teacher.value = { ...t, step_idx: r.step_idx }
    if (r.verdict === 'pass' || (r.verdict === 'wrong' && r.step_idx !== t.step_idx)) {
      pushMsg('ai', 'quiz', r.ask, { question_id: '' })
      teacherQ.value = { question: teacherQ.value?.question || r.ask, text: r.ask, step: r.step_idx + 1, total: t.total, subject: teacherQ.value?.subject || '' }   // p18: 过关换层——总题目不变，仅层间提问更新
      speakBubble(r.ask)
    }
  } catch (e) {
    ElMessage.error((e && e.message) || '发送失败')
  } finally {
    busy.value = false
  }
}

/* ---------------- 语音转文字（按住说话，松手转文字填入输入框可改可发） ---------------- */
const recActive = ref(false)
const asrBusy = ref(false)
const asrUnsupported = ref(false)
const rec = { ctx: null, stream: null, proc: null, chunks: [], rate: 16000, timer: null }

async function startRec() {
  if (recActive.value || asrBusy.value || busy.value || thinking.value) return
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    asrUnsupported.value = true
    ElMessage.warning('当前浏览器不支持录音，直接打字吧')
    return
  }
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
  } catch {
    ElMessage.warning('麦克风不可用，请检查浏览器权限')
    return
  }
  try {
    rec.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
  } catch {
    rec.ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  rec.rate = rec.ctx.sampleRate
  rec.chunks = []
  const src = rec.ctx.createMediaStreamSource(rec.stream)
  rec.proc = rec.ctx.createScriptProcessor(4096, 1, 1)
  rec.proc.onaudioprocess = (e) => { rec.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))) }
  src.connect(rec.proc)
  rec.proc.connect(rec.ctx.destination)
  recActive.value = true
  rec.timer = setTimeout(() => stopRec(true), 60000)   // 上限 60 秒
}
function stopRec(send) {
  if (!recActive.value) return
  recActive.value = false
  clearTimeout(rec.timer)
  try { if (rec.proc) rec.proc.disconnect() } catch { /* ignore */ }
  try { if (rec.ctx) rec.ctx.close() } catch { /* ignore */ }
  try { if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
  if (!send || !rec.chunks.length) return
  const total = rec.chunks.reduce((n, c) => n + c.length, 0)
  if (total < rec.rate * 0.5) { ElMessage.warning('说话时间太短啦'); return }
  const pcm = new Float32Array(total)
  let off = 0
  for (const c of rec.chunks) { pcm.set(c, off); off += c.length }
  const b64 = encodeWavBase64(pcm, rec.rate)
  asrBusy.value = true
  api.companionAsr(b64)
    .then((text) => {
      draft.value = draft.value ? draft.value + ' ' + text : text
      toast.success('语音已转成文字，确认后点发送')
    })
    .catch((e) => ElMessage.error((e && e.message) || '语音识别失败'))
    .finally(() => { asrBusy.value = false })
}
function encodeWavBase64(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  return btoa(bin)
}

/* ---------------- 其他 ---------------- */
function pokeChar() {
  speakBubble(currentQuiz.value || teacher.value ? '想好就打字告诉我嘛~' : '和我聊聊吧，学习上有什么卡壳的尽管说！')
}
function goLogin() { router.push(ROUTES.mine) }

onMounted(() => {
  mq = window.matchMedia('(min-width: 1024px)')
  mq.addEventListener('change', onMq)
  startBlinkLoop()
  window.addEventListener('resize', measureStage)
  measureStage()
  if (isLoggedIn()) {
    nameBuf.value = ''
    loadAll()
    loadCustomList()
  }
})
onBeforeUnmount(() => {
  if (mq) mq.removeEventListener('change', onMq)
  window.removeEventListener('resize', measureStage)
  clearInterval(bubble.timer)
  clearTimeout(bubble.hideT)
  clearTimeout(sizeTimer)
  clearTimeout(faceT)
  stopBlinkLoop()
  if (recActive.value) stopRec(false)
  try { sessionStorage.removeItem(sessKey()) } catch { /* ignore */ }   // p20: 离开页面即结束本次会话，下次进入开新记录
})
watch(loggedIn, (v) => { if (v) { measureStage(); loadAll() } })

/* 新手教程：首次进入本页自动弹（看过不再弹） */
const { tourOpen } = useTour('companion')

</script>

<style scoped>
.cpage { display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; }
.cpage__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cpage__who { color: var(--brand, #2f6f5e); font-weight: 600; }
.cpage__head-actions { display: flex; gap: 10px; }
.cpage__ghostbtn {
  border: 1px solid var(--border-strong, #d9d4c9); background: var(--card, #fff); color: var(--text, #1f2937);
  border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.cpage__ghostbtn:hover { border-color: var(--brand, #2f6f5e); color: var(--brand, #2f6f5e); }

.cpage__main { display: grid; grid-template-columns: clamp(340px, 30vw, 400px) minmax(0, 1fr); gap: 14px; align-items: stretch; }
.cpage__main--mobile { grid-template-columns: minmax(0, 1fr); }

/* 舞台 */
.cpage__stage { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.cpage__stage-box { position: relative; display: flex; align-items: flex-end; justify-content: center; padding: 0 8px; }
.cpage__stage-box--guest { min-height: 300px; }
/* max-width:none 豁免 base.css 全局 img{max-width:100%}——否则角色放大时宽度被容器钳住、横向压扁（同行走角色历史坑） */
.cpage__char { width: auto; max-width: none; display: block; user-select: none; cursor: pointer; }
/* 换脸淡出叠层：与主立绘同锚点居中，盖上层，opacity 由 JS 交叉淡出驱动 */
.cpage__char-ghost {
  position: absolute; left: 50%; bottom: 0;
  transform: translateX(-50%);
  width: auto; max-width: none; display: block;
  pointer-events: none; opacity: 0;
}
.cpage__char--breath { animation: cpage-breathe 2.8s ease-in-out infinite; }
@keyframes cpage-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) scale(1.012); }
}
.cpage__bubble {
  position: absolute; top: 8px; left: 12px; right: 12px;
  background: #fff; border: 1px solid var(--primary-line); border-radius: 12px;
  padding: 8px 11px; font-size: 13px; line-height: 1.55; color: var(--text-primary);
  cursor: pointer;
  /* 2026-10-12：气泡是"说话内容"，层级永远最高；限高避免长文本撑破气泡预留区 */
  z-index: 5; max-height: 92px; overflow: auto;
  box-shadow: 0 6px 18px -10px rgba(111, 87, 240, 0.45);
}
.cpage__bubble-text { vertical-align: middle; }
.cpage__bubble-cursor { opacity: 0.55; }
.cpage__thinking {
  text-align: center; font-size: 12px; color: var(--text-tertiary, #8aa0b8);
  background: var(--surface-primary, #fff); border: 0.5px solid var(--border-tertiary, #e3ecf5);
  border-radius: 10px; padding: 6px 8px;
}
/* p18: 舞台底部常驻坞——思考态 + 题目卡统一停靠，天然互不遮挡；容器不拦截点击（戳角色不受影响） */
.cpage__dock {
  position: absolute; bottom: 8px; left: 12px; right: 12px; z-index: 3;
  display: flex; flex-direction: column; gap: 6px; pointer-events: none;
}
.cpage__thinking, .cpage__qcard { pointer-events: auto; }
/* 常驻题目栏（2026-10-08 定稿）：钉在对话区头部，log 内部滚动时始终可见；
 * 桌面=科目胶囊+折叠题干+展开全文键；移动端(<1024)=紧凑摘要行+点击浮层看全文 */
.cpage__qbar {
  padding: 9px 14px 10px;
  background: var(--card, #fff);
  border-bottom: 1px solid var(--border-light, #e8e4da);
}
.cpage__qbar.is-pending { background: var(--surface-primary, #fbfaf7); }
.cpage__qbar-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cpage__qbar-subject {
  font-size: 11px; padding: 2px 9px; border-radius: 999px; flex: none;
  background: var(--brand-light, #e3f0ec); color: var(--brand, #2f6f5e); font-weight: 500;
}
.cpage__qbar-hint { font-size: 11px; color: var(--text-sub, #9ca3af); }
.cpage__qbar-go {
  margin-left: auto; border: none; border-radius: 8px; padding: 5px 14px; flex: none;
  background: var(--brand, #2f6f5e); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
}
.cpage__qbar-go:hover { filter: brightness(1.08); }
.cpage__qbar-toggle {
  margin-left: auto; border: none; background: transparent; padding: 2px 0; flex: none;
  color: var(--brand, #2f6f5e); font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
}
.cpage__qbar-caret {
  display: inline-block; width: 0; height: 0; flex: none;
  border-left: 4px solid transparent; border-right: 4px solid transparent;
  border-top: 5px solid currentColor; transition: transform 0.18s ease;
}
.cpage__qbar-caret.up { transform: rotate(180deg); }
.cpage__qbar-text {
  font-size: 13px; line-height: 1.6; margin: 0; color: var(--text-primary, #2c3e50);
  word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.cpage__qbar-text.open { -webkit-line-clamp: unset; display: block; }
.cpage__qbar-sumrow { display: none; }
/* 移动端浮层 */
.cpage__qbar-mask {
  position: fixed; inset: 0; z-index: 120; background: rgba(20, 24, 32, 0.42);
  display: flex; align-items: flex-start; justify-content: center; padding: 18vh 18px 0;
}
.cpage__qbar-layer {
  width: 100%; max-width: 460px; background: var(--card, #fff);
  border-radius: 14px; padding: 12px 14px 14px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}
.cpage__qbar-layer .cpage__qbar-text { margin-top: 2px; }
.is-layer-go { width: 100%; margin-top: 12px; }
@media (max-width: 1023px) {
  .cpage__qbar { padding: 7px 12px; }
  .cpage__qbar-head { margin-bottom: 0; }
  .cpage__qbar-text, .cpage__qbar-text.open, .cpage__qbar-hint, .cpage__qbar-toggle { display: none; }
  .cpage__qbar.is-pending .cpage__qbar-go { display: none; }
  .cpage__qbar-sumrow {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
  }
  .cpage__qbar-sumtext {
    flex: 1; min-width: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-primary, #2c3e50);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
}

/* 切换伙伴弹窗 */
.cpage__mask {
  position: fixed; inset: 0; z-index: 200; background: rgba(31, 41, 55, 0.42);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.cpage__modal {
  width: 660px; max-width: 94vw; max-height: 88vh; overflow-y: auto;
  background: var(--card, #fff); border-radius: 14px; padding: 22px 24px 16px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
}
.cpage__modal-t { font-family: var(--font-display, serif); font-size: 18px; margin: 0 0 2px; }
.cpage__modal-hint { color: var(--text-sub, #9ca3af); font-size: 12px; margin: 0 0 14px; }
.cpage__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.cpage__ccard {
  position: relative; border: 1.5px solid var(--border, #e8e5df); border-radius: 10px;
  padding: 10px 6px 8px; cursor: pointer; text-align: center; background: #fff;
  display: flex; flex-direction: column; align-items: center; gap: 2px; transition: all 0.15s;
  font-family: inherit;
}
.cpage__ccard:hover { border-color: var(--brand, #2f6f5e); transform: translateY(-2px); }
.cpage__ccard.active { border-color: var(--brand, #2f6f5e); background: var(--brand-soft, rgba(47, 111, 94, 0.08)); }
.cpage__ccard-ph { height: 84px; display: flex; align-items: flex-end; justify-content: center; }
.cpage__ccard-ph img { max-height: 82px; max-width: 58px; object-fit: contain; }
.cpage__ccard-nm { font-size: 13px; font-weight: 600; color: var(--text, #1f2937); }
.cpage__ccard-intro { font-size: 10.5px; color: var(--text-sub, #9ca3af); line-height: 1.45; height: 30px; overflow: hidden; }
.cpage__ccard-tag {
  font-size: 10px; color: var(--brand, #2f6f5e); border: 1px solid var(--brand, #2f6f5e);
  border-radius: 3px; padding: 0 5px; margin-top: 3px;
}
.cpage__ccard--ghost {
  border: 1.5px dashed var(--border-strong, #d9d4c9); color: var(--text-faint, #b0aba0);
  justify-content: center; background: transparent; min-height: 158px;
}
.cpage__ccard--ghost:hover { color: var(--brand, #2f6f5e); border-color: var(--brand, #2f6f5e); transform: none; }
.cpage__ccard-plus { font-size: 22px; line-height: 1; }
/* 自定义角色删除角标 */
.cpage__ccard-del {
  position: absolute; top: 4px; right: 6px; width: 18px; height: 18px; line-height: 16px;
  border-radius: 50%; border: 1px solid var(--border, #e8e5df); background: #fff;
  color: var(--text-faint, #b0aba0); font-size: 12px; text-align: center; cursor: pointer;
}
.cpage__ccard-del:hover { color: #d84b3f; border-color: #d84b3f; }
/* 编辑+删除并排角标（2026-10-09）：铅笔在 × 左侧，hover 变主题色 */
.cpage__ccard-edit {
  position: absolute; top: 4px; right: 28px; width: 18px; height: 18px; line-height: 15px;
  border-radius: 50%; border: 1px solid var(--border, #e8e5df); background: #fff;
  color: var(--text-faint, #b0aba0); font-size: 11px; text-align: center; cursor: pointer;
}
.cpage__ccard-edit:hover { color: var(--brand, #2f6f5e); border-color: var(--brand, #2f6f5e); }

/* ---------------- 造角色向导 ---------------- */
.cpage__modal--wiz { width: 560px; }
.wiz__body { display: flex; flex-direction: column; gap: 10px; }
.wiz__drop {
  min-height: 210px; border: 1.5px dashed var(--border-strong, #d9d4c9); border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  color: var(--text-faint, #b0aba0); font-size: 13px; cursor: pointer; transition: all 0.15s;
  padding: 14px;
}
.wiz__drop:hover { border-color: var(--brand, #2f6f5e); color: var(--brand, #2f6f5e); }
.wiz__drop.has-img { border-style: solid; padding: 0; background: repeating-conic-gradient(#f6f4ef 0 25%, #fff 0 50%) 0 0/18px 18px; }
.wiz__drop.has-img img { max-height: 300px; max-width: 160px; object-fit: contain; }
.wiz__drop-plus { font-size: 30px; line-height: 1; }
.wiz__drop-sub { font-size: 11px; color: var(--text-faint, #b0aba0); }
.wiz__tip { font-size: 11.5px; color: var(--text-sub, #9ca3af); margin: 0; }
.wiz__tpls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.wiz__tpl {
  border: 1.5px solid var(--border, #e8e5df); border-radius: 10px; padding: 9px 8px;
  background: #fff; cursor: pointer; text-align: left; font-family: inherit; transition: all 0.15s;
  display: flex; flex-direction: column; gap: 3px;
}
.wiz__tpl:hover { border-color: var(--brand, #2f6f5e); }
.wiz__tpl.active { border-color: var(--brand, #2f6f5e); background: var(--brand-soft, rgba(47, 111, 94, 0.08)); }
.wiz__tpl-nm { font-size: 13px; font-weight: 700; color: var(--text, #1f2937); }
.wiz__tpl-desc { font-size: 10.5px; color: var(--text-sub, #9ca3af); line-height: 1.4; }
.wiz__extra {
  width: 100%; box-sizing: border-box; border: 1.5px solid var(--border, #e8e5df); border-radius: 10px;
  padding: 9px 11px; font-size: 12.5px; font-family: inherit; resize: none; color: var(--text, #1f2937);
}
.wiz__extra:focus { outline: none; border-color: var(--brand, #2f6f5e); }
.wiz__body--final { flex-direction: row; align-items: center; gap: 16px; }
.wiz__preview {
  flex: none; width: 130px; height: 190px; border-radius: 12px; overflow: hidden;
  background: repeating-conic-gradient(#f6f4ef 0 25%, #fff 0 50%) 0 0/18px 18px;
  display: flex; align-items: center; justify-content: center;
}
.wiz__preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.wiz__final-form { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.wiz__name {
  border: 1.5px solid var(--border, #e8e5df); border-radius: 10px; padding: 10px 12px;
  font-size: 14px; font-family: inherit; color: var(--text, #1f2937);
}
.wiz__name:focus { outline: none; border-color: var(--brand, #2f6f5e); }
.wiz__final-meta { font-size: 12px; color: var(--text-sub, #9ca3af); margin: 0; line-height: 1.6; }
.wiz__err { color: #d84b3f; font-size: 12px; margin: 8px 0 0; }
.cpage__modal-foot {
  display: flex; gap: 18px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px;
  border-top: 1px solid var(--border, #e8e5df);
}
.cpage__modal-foot .cpage__set-row { flex: 1; min-width: 240px; }
.cpage__modal-actions { display: flex; justify-content: flex-end; margin-top: 12px; }

/* 弹窗内设置行（沿用原样式精简版） */
.cpage__set-row { display: flex; align-items: center; gap: 8px; }
.cpage__set-label { font-size: 12px; color: var(--text-tertiary, #8aa0b8); width: 42px; flex: none; }
.cpage__set-hint { margin: 2px 0 0; font-size: 11px; color: var(--text-tertiary, #8aa0b8); padding-left: 42px; }
.cpage__set-val { font-size: 12px; color: var(--text-secondary, #5a6c85); width: 38px; text-align: right; }
.cpage__slider { flex: 1; min-width: 0; }
.cpage__rename {
  flex: 1; min-width: 0; border: 1px solid var(--border-secondary, #e3ecf5);
  border-radius: 8px; padding: 6px 10px; font-size: 13px; outline: none;
  color: var(--text-primary, #2c3e50); background: var(--surface-primary, #fff);
}

/* 工作台 */
.cpage__bench { display: flex; flex-direction: column; min-height: 420px; padding: 0; overflow: hidden; }
.cpage__bench-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 14px; border-bottom: 0.5px solid var(--border-tertiary, #e3ecf5);
}
.cpage__bench-tl { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.cpage__bench-t { font-size: 14px; font-weight: 500; }
.cpage__bench-sub { font-size: 11px; color: var(--text-tertiary, #8aa0b8); }
.cpage__bench-actions { display: flex; align-items: center; gap: 6px; flex: none; }
.cpage__newbtn {
  font-size: 12px; padding: 4px 10px; border-radius: 8px; cursor: pointer;
  color: var(--brand-contrast, #fff); background: var(--brand, #2f6f5e); border: none;
}
.cpage__newbtn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpage__histbtn {
  display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 10px;
  border-radius: 8px; cursor: pointer; color: var(--text-secondary, #4a6076);
  background: transparent; border: 0.5px solid var(--border-tertiary, #e3ecf5);
}
.cpage__histbtn:hover { background: var(--surface-secondary, #f2f7fb); }

/* p20: 历史对话抽屉 */
.cpage__sess {
  width: min(420px, 92vw); max-height: 78vh; display: flex; flex-direction: column;
  background: var(--surface-primary, #fff); border-radius: 14px; overflow: hidden;
  box-shadow: 0 12px 40px rgba(15, 40, 60, 0.18);
}
.cpage__sess-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 0.5px solid var(--border-tertiary, #e3ecf5);
}
.cpage__sess-title { font-size: 14px; font-weight: 600; }
.cpage__x {
  margin-left: auto; flex: none;
  width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center;
  border: 0.5px solid var(--border-tertiary, #e3ecf5); background: var(--surface-1);
  color: var(--text-tertiary, #8aa0b8); cursor: pointer;
  transition: border-color var(--dur, .2s) ease, color var(--dur, .2s) ease, background var(--dur, .2s) ease;
}
.cpage__x:hover { border-color: var(--primary-line); color: var(--primary-text); background: var(--primary-soft-3); }
.cpage__sess-list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.cpage__sess-item {
  padding: 10px 12px; border-radius: 10px; cursor: pointer;
  border: 0.5px solid transparent; background: transparent;
}
.cpage__sess-item:hover { background: var(--surface-secondary, #f2f7fb); }
.cpage__sess-item.active { background: var(--surface-secondary, #eef6f2); border-color: var(--border-secondary, #cfe3da); }
.cpage__sess-t { display: flex; align-items: center; gap: 6px; }
.cpage__sess-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary, #2c3e50);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cpage__sess-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--brand, #2f6f5e); flex: none; }
.cpage__sess-last {
  margin-top: 3px; font-size: 12px; color: var(--text-tertiary, #8aa0b8);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cpage__sess-meta { margin-top: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-tertiary, #8aa0b8); }
.cpage__sess-ops { display: inline-flex; gap: 10px; }
.cpage__sess-ops button { border: none; background: none; padding: 0; font-size: 11px; cursor: pointer; color: var(--text-secondary, #4a6076); }
.cpage__sess-ops button:hover { text-decoration: underline; }
.cpage__sess-ops button.danger { color: #c25656; }
.cpage__sess-ren {
  width: 100%; font-size: 13px; padding: 6px 8px; border-radius: 8px;
  border: 0.5px solid var(--border-secondary, #cfe3da); background: var(--surface-primary, #fff);
  color: var(--text-primary, #2c3e50); outline: none;
}
.cpage__sess-save {
  margin-top: 6px; font-size: 12px; padding: 4px 12px; border-radius: 8px; cursor: pointer;
  color: var(--brand-contrast, #fff); background: var(--brand, #2f6f5e); border: none;
}
.cpage__sess-empty { text-align: center; font-size: 12px; color: var(--text-tertiary, #8aa0b8); padding: 28px 0; }
/* 消息区撑满卡内剩余高度（对话卡与左卡等高），输入栏恒钉卡底（2026-10-12） */
.cpage__log { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; min-height: 240px; }
.cpage__msg { max-width: 82%; display: flex; flex-direction: column; gap: 3px; }
.cpage__msg.is-ai { align-self: flex-start; }
.cpage__msg.is-me { align-self: flex-end; align-items: flex-end; }
.cpage__msg-body {
  padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
}
.is-ai .cpage__msg-body { background: var(--surface-secondary, #eef4fa); color: var(--text-primary, #2c3e50); border-bottom-left-radius: 4px; }
.is-me .cpage__msg-body { background: #34618e; color: #fff; border-bottom-right-radius: 4px; }
/* 修复（2026-10-13）：MarkdownText 根元素强制 color: var(--text-secondary)（深灰）、strong 强制
   var(--text-primary)（深黑），直接覆盖了深蓝气泡的白字继承 → 深字配深底看不清。
   用户消息（is-me）气泡内的 md 正文与粗体回白；code/zy-code 自带浅底深字，在深蓝底上反而清晰，不动 */
.is-me .cpage__msg-body :deep(.md-text) { color: #fff; }
.is-me .cpage__msg-body :deep(.md-text strong) { color: #fff; }
.cpage__msg-time { font-size: 11px; color: var(--text-tertiary, #8aa0b8); }
.cpage__msg-retry { font-size: 11px; color: #e65100; background: none; border: 1px dashed #e65100; border-radius: 10px; padding: 1px 8px; cursor: pointer; }
.cpage__msg-retry:hover { background: rgba(230, 81, 0, 0.08); }
/* M4: 亲密度徽章（舞台右上角） */
/* 亲密度徽章（2026-10-12）：移入底部停靠坞、右对齐（原来是 absolute 贴顶部右侧，与气泡相撞） */
.cpage__intim {
  align-self: flex-end; flex: none; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.92); border: 0.5px solid var(--primary-line);
  border-radius: 999px; padding: 3px 10px; backdrop-filter: blur(4px);
}
.cpage__intim-lv { font-size: 12px; font-weight: 700; color: var(--primary-text); }
.cpage__intim-bar { width: 56px; height: 5px; border-radius: 3px; background: var(--primary-soft-2); overflow: hidden; display: inline-block; }
.cpage__intim-bar i { display: block; height: 100%; background: linear-gradient(90deg, #9d8bf5, #5b47d6); border-radius: 3px; transition: width 0.4s; }
/* walkdep16: 好感飘字（替代三维测评条） */
.cpage__fav {
  position: absolute; top: 38%; right: 22%; z-index: 5; pointer-events: none;
  font-size: 15px; font-weight: 700; color: #e65100; white-space: nowrap;
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9), 0 0 8px rgba(255, 157, 92, 0.5);
  animation: cpageFavUp 1.6s ease forwards;
}
@keyframes cpageFavUp {
  0% { opacity: 0; transform: translateY(10px) scale(0.8); }
  18% { opacity: 1; transform: translateY(0) scale(1.08); }
  70% { opacity: 1; transform: translateY(-16px) scale(1); }
  100% { opacity: 0; transform: translateY(-36px) scale(1); }
}
.cpage__empty { margin: auto; padding: 18px; display: grid; gap: 12px; width: 100%; max-width: 620px; }
.cpage__empty-t { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.cpage__empty-t span { font-weight: 400; font-size: 11.5px; color: var(--text-muted); margin-left: 6px; }
.cpage__ability { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 767px) { .cpage__ability { grid-template-columns: minmax(0, 1fr); } }
.cpage__ab {
  display: grid; gap: 6px; padding: 12px; text-align: left; cursor: pointer;
  border-radius: 12px; border: 0.5px solid var(--border-tertiary, #e3ecf5);
  background: var(--surface-1); font-family: inherit;
}
.cpage__ab:hover { border-color: var(--primary-line); }
.cpage__ab-ic {
  width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; font-size: 13px;
  background: var(--primary-soft-3); color: var(--primary-text);
}
.cpage__ab b { font-size: 12.5px; color: var(--text-primary); }
.cpage__ab i { font-style: normal; font-size: 11px; line-height: 1.5; color: var(--text-muted); }
.cpage__starters { display: flex; flex-wrap: wrap; gap: 8px; }
.cpage__starter {
  padding: 7px 12px; border-radius: 999px; cursor: pointer; font-family: inherit; font-size: 12px;
  border: 0.5px solid var(--primary-line); background: var(--primary-soft-3); color: var(--primary-text);
}
.cpage__starter:hover:not(:disabled) { background: var(--primary-soft-2); }
.cpage__starter:disabled { opacity: 0.5; cursor: not-allowed; }

/* 输入栏 */
/* 2026-10-12：输入栏从"横跨整页的底部条"搬进对话卡内部，成为卡片底栏：
   ① flex:none 钉在卡底（消息区 flex:1 内部滚动，两卡等高）
   ② 与消息区有明显层级区分：浅色底 + 主色系顶部分隔线 + 轻微内阴影 */
.cpage__inputbar {
  flex: none;
  display: grid; gap: 9px;
  padding: 11px 13px 12px;
  background: var(--surface-recess);
  border: 0;
  border-top: 1px solid rgba(124, 92, 255, 0.16);
  border-radius: 0;
  box-shadow: inset 0 6px 14px -12px rgba(20, 30, 60, 0.28);
}
.cpage__tools { display: flex; flex-wrap: wrap; gap: 8px; }
.cpage__tool {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 9px; cursor: pointer;
  border: 0.5px solid var(--border-tertiary, #e3ecf5);
  background: var(--surface-1); color: var(--text-secondary);
  font-family: inherit; font-size: 11.5px;
}
.cpage__tool:hover:not(:disabled) { border-color: var(--primary-line); color: var(--primary-text); }
.cpage__tool:disabled { opacity: 0.5; cursor: not-allowed; }
.cpage__tool-k { color: var(--primary-text); font-weight: 600; }
.cpage__inputrow { display: flex; align-items: center; gap: 9px; }
.cpage__mic {
  display: flex; align-items: center; gap: 6px; flex: none;
  padding: 9px 12px; border-radius: 10px; cursor: pointer;
  background: #faf0ea; border: 1px solid #d8a58c; color: #993c1d; font-size: 12px; font-weight: 500;
}
.cpage__mic.rec { background: #f7c1c1; border-color: #a32d2d; color: #791f1f; animation: cpage-pulse 1s ease-in-out infinite; }
.cpage__mic.busy { opacity: 0.7; }
.cpage__mic.off { opacity: 0.45; cursor: not-allowed; }
@keyframes cpage-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.cpage__input {
  flex: 1; min-width: 0; border: 1px solid var(--border-secondary, #e3ecf5);
  border-radius: 10px; padding: 9px 12px; font-size: 13px; outline: none;
  color: var(--text-primary, #2c3e50); background: var(--surface-primary, #fff);
}
.cpage__send {
  flex: none; padding: 9px 18px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600;
  background: linear-gradient(135deg, #7c5cff, #5b47d6); color: #fff; border: none;
  box-shadow: 0 6px 16px -8px rgba(111, 87, 240, 0.5);
}
.cpage__send:disabled { opacity: 0.45; cursor: not-allowed; }

/* 游客态 */
.cpage__guest { display: flex; gap: 20px; align-items: center; padding: 20px; flex-wrap: wrap; }
.cpage__guide { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.cpage__guide-t { font-size: 16px; font-weight: 500; margin: 0; }

@media (max-width: 1023px) {
  /* 移动端（2026-10-12）：对话卡自占一个视口高度 → 输入栏因此始终在卡底可见；
     不用 position:fixed，避免被伴学角色层（z-index 900）盖住 */
  .cpage__bench { height: min(74vh, 660px); }
  .cpage__log { min-height: 160px; }
}
@media (prefers-reduced-motion: reduce) {
  .cpage__char--breath, .cpage__mic.rec { animation: none; }
}

/* ---------------- 2026-10-11：角色卡信息区 / 卡底操作 / 我们的成就弹层 ---------------- */
.cpage__toolbtn {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
  border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 12.5px; font-weight: 600;
  border: 0.5px solid var(--primary-line); background: var(--primary-soft-3); color: var(--primary-text);
}
.cpage__toolbtn:hover { background: var(--primary-soft-2); }
.cpage__toolbtn-ic {
  width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-size: 11px;
  background: rgba(124, 92, 255, 0.16);
}

.cpage__who-box { display: grid; gap: 9px; padding: 13px 16px 10px; border-top: 0.5px solid var(--border-tertiary, #e3ecf5); }
.cpage__who-top { display: flex; align-items: center; gap: 8px; }
.cpage__who-top b { font-size: 16px; font-weight: 600; }
.cpage__lv-pill {
  font-size: 10.5px; font-weight: 700; color: #fff; padding: 2px 9px; border-radius: 999px;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
}
.cpage__title-pill {
  font-size: 10.5px; padding: 2px 9px; border-radius: 999px; color: var(--primary-text);
  background: var(--primary-soft-3); border: 0.5px solid var(--primary-line);
}
.cpage__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.cpage__tag { font-size: 10.5px; padding: 2px 8px; border-radius: 7px; background: var(--surface-unit); color: var(--text-tertiary); }
.cpage__style { margin: 0; font-size: 12px; color: var(--text-secondary); }
.cpage__intim2 { display: grid; gap: 6px; padding: 10px 11px; border-radius: 11px; background: var(--primary-soft-3); border: 0.5px solid var(--primary-line); }
.cpage__intim2-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-secondary); }
.cpage__intim2-bar { flex: 1; height: 5px; border-radius: 99px; background: var(--primary-soft-2); overflow: hidden; }
.cpage__intim2-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #9d8bf5, #5b47d6); }
.cpage__intim2-note { margin: 0; font-size: 10.5px; color: var(--text-muted); }
.cpage__state { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 11.5px; color: var(--text-secondary); }
.cpage__state-dot { width: 7px; height: 7px; border-radius: 50%; background: #3f9c62; flex: none; }
.cpage__state-dot.busy { background: #d0762a; }

.cpage__stage-ops { display: flex; align-items: center; gap: 10px; padding: 10px 16px 14px; }
/* 主操作：我们的成就（带等级 / 称号 / 成就进度） */
.cpage__op-main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
  height: 38px; padding: 0 12px; border-radius: 11px; cursor: pointer; font-family: inherit;
  border: 0.5px solid var(--primary-line); background: var(--primary-soft-3); color: var(--primary-text);
  transition: background var(--dur, .2s) ease, border-color var(--dur, .2s) ease;
}
.cpage__op-main:hover { background: var(--primary-soft-2); }
.cpage__op-main-ic {
  width: 22px; height: 22px; border-radius: 7px; flex: none; display: grid; place-items: center;
  background: rgba(124, 92, 255, 0.18); color: var(--primary-text);
}
.cpage__op-main-t { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.cpage__op-main-meta {
  margin-left: auto; font-size: 11px; color: var(--text-muted); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.cpage__op-main-go { flex: none; font-size: 15px; line-height: 1; color: var(--primary-text); }
/* 次操作：给 TA 改名（无框文字按钮，不抢主操作权重） */
.cpage__op-text {
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  border: 0; background: none; padding: 6px 4px; cursor: pointer; font-family: inherit;
  font-size: 12px; color: var(--text-muted);
}
.cpage__op-text:hover { color: var(--primary-text); }
.cpage__op {
  padding: 7px 12px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 12px;
  border: 0.5px solid var(--border-tertiary, #e3ecf5); background: var(--surface-1); color: var(--text-secondary);
}
.cpage__op:hover { border-color: var(--primary-line); color: var(--primary-text); }
.cpage__op.is-pri { border: 0; color: #fff; background: linear-gradient(135deg, #7c5cff, #5b47d6); font-weight: 600; }
.cpage__op-input {
  flex: 1; min-width: 0; height: 32px; padding: 0 10px; border-radius: 9px;
  border: 0.5px solid var(--primary-line); background: var(--surface-1);
  font-family: inherit; font-size: 12px; color: var(--text-primary); outline: none;
}
.cpage__op.is-pri:disabled { opacity: 0.55; }

.cpage__our {
  width: min(680px, calc(100vw - 32px)); max-height: 84vh; overflow: auto;
  background: var(--surface-1); border-radius: 16px; border: 0.5px solid var(--border-tertiary, #e3ecf5);
  box-shadow: 0 24px 60px -18px rgba(20, 30, 60, 0.3);
}
.cpage__our-head { display: flex; align-items: baseline; gap: 8px; padding: 15px 18px 12px; border-bottom: 0.5px solid var(--border-tertiary, #e3ecf5); }
.cpage__our-title { font-size: 15px; font-weight: 600; }
.cpage__our-sub { font-size: 11.5px; color: var(--text-muted); }
.cpage__our-body { padding: 14px 18px 18px; display: grid; gap: 14px; }
.cpage__our-intim { display: grid; gap: 9px; padding: 13px 14px; border-radius: 13px; background: var(--primary-soft-3); border: 0.5px solid var(--primary-line); }
.cpage__our-lv { display: flex; align-items: baseline; gap: 8px; }
.cpage__our-lv b { font-size: 20px; font-weight: 700; color: var(--primary-text); }
.cpage__our-lv span { font-size: 12px; color: var(--text-secondary); }
.cpage__our-bar { height: 6px; border-radius: 99px; background: var(--primary-soft-2); overflow: hidden; }
.cpage__our-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #9d8bf5, #5b47d6); }
.cpage__our-note { margin: 0; font-size: 11px; color: var(--text-muted); }
.cpage__our-nums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.cpage__our-nums span { display: grid; justify-items: center; gap: 2px; padding: 8px 4px; border-radius: 10px; background: var(--surface-1); border: 0.5px solid var(--border-tertiary, #e3ecf5); }
.cpage__our-nums b { font-size: 16px; font-weight: 700; }
.cpage__our-nums i { font-style: normal; font-size: 10.5px; color: var(--text-muted); }
.cpage__our-list { display: grid; gap: 9px; }
.cpage__our-listtop { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-tertiary); }
.cpage__our-listtop span:last-child { margin-left: auto; font-weight: 400; color: var(--text-muted); }
.cpage__our-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 639px) { .cpage__our-grid { grid-template-columns: minmax(0, 1fr); } }
.cpage__ach { display: grid; gap: 6px; padding: 11px 12px; border-radius: 12px; border: 0.5px solid var(--border-tertiary, #e3ecf5); background: var(--surface-1); }
.cpage__ach.done { border-color: var(--primary-line); background: var(--primary-soft-3); }
.cpage__ach-top { display: flex; align-items: center; gap: 8px; }
.cpage__ach-top b { font-size: 12.5px; }
.cpage__ach-r { margin-left: auto; font-size: 10px; padding: 1px 7px; border-radius: 999px; color: var(--text-tertiary); background: var(--surface-unit); }
.cpage__ach.done .cpage__ach-r { color: var(--primary-text); background: var(--primary-soft-2); }
.cpage__ach p { margin: 0; font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.cpage__ach-bar { height: 4px; border-radius: 99px; background: var(--surface-unit); overflow: hidden; }
.cpage__ach-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #9d8bf5, #5b47d6); }
.cpage__ach-p { font-size: 10.5px; color: var(--text-muted); }
</style>
