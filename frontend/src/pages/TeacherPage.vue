<template>
  <div class="zy-container zy-page teacher">
    <header class="tch__head">
      <div class="tch__head-main">
        <!-- 返回键（2026-10-10 用户拍板）：教学区一键回 AI 教学首页（选课/继续上次） -->
        <button v-if="syllabus" type="button" class="tch__back" @click="backToStart">
          <UiIcon name="left" :size="16" /> 返回
        </button>
        <div>
          <h1 class="t-h1">AI 课堂</h1>
          <p class="t-body-2">跟着老师，一个知识点一个知识点地过</p>
        </div>
      </div>
      <div class="tch__head-ops">
        <button v-if="syllabus" type="button" class="tch-op is-pri" @click="openList">
          <span class="tch-op__ic"><UiIcon name="schedule" :size="14" /></span>
          <span class="tch-op__t">我的课</span>
          <span class="tch-op__cnt">{{ activeSyllabi.length }}</span>
          <span v-if="kpTotal" class="tch-op__meta">{{ kpDoneCount }}/{{ kpTotal }} 节</span>
        </button>
        <button v-if="syllabus" type="button" class="tch-op" @click="editOpen = true">
          <span class="tch-op__ic"><UiIcon name="settings" :size="14" /></span>
          <span class="tch-op__t">大纲</span>
        </button>
      </div>
    </header>

    <!-- ① 开课面板：还没选课 -->
    <section v-if="!syllabus" class="tch__start">
      <!-- 大纲确认（2026-10-10 两级）：先看 章→节 整树、挑起始节 -->
      <div v-if="pendingSyl" class="tch__start-card surface-standard">
        <h2 class="t-h3">{{ pendingSyl.title || pendingSyl.subject }}</h2>
        <p class="t-body-2">老师拆好了 {{ (pendingSyl.chapters || []).length }} 章 · {{ pendingSyl.total }} 节。按顺序学效果最好，也可以直接挑你最想补的那节</p>
        <div class="tch__pick-tree">
          <section v-for="(ch, ci) in pendingSyl.chapters || []" :key="ci" class="tch__pick-ch">
            <button type="button" class="tch__pick-chhead" @click="startPick(chapterStart(pendingSyl, ci))">
              <span class="tch__pick-chname">{{ ch.name }}</span>
              <span class="tch__pick-chgo">从这章开始 →</span>
            </button>
            <p v-if="ch.brief" class="tch__pick-chbrief">{{ ch.brief }}</p>
            <ul class="tch__pick">
              <li v-for="(it, i) in chapterItems(pendingSyl, ci)" :key="i">
                <button type="button" class="tch__pick-row" @click="startPick(it.i)">
                  <span class="tch__pick-idx">{{ it.i + 1 }}</span>
                  <span class="tch__pick-main">
                    <b>{{ it.name }}</b>
                    <i v-if="it.brief">{{ it.brief }}</i>
                  </span>
                  <span class="tch__pick-go">从这节开始 →</span>
                </button>
              </li>
            </ul>
          </section>
        </div>
        <div class="tch__pick-ops">
          <UiButton variant="primary" @click="startPick(0)">按顺序，从第一节开始</UiButton>
          <UiButton variant="ghost" @click="pendingSyl = null">换个课</UiButton>
        </div>
      </div>

      <div v-else class="tch__start-grid">
        <!-- 左：开课表单 -->
        <div class="tch__start-card surface-standard">
          <h2 class="t-h3">今天想跟谁学什么？</h2>
          <p class="t-body-2">老师会把课程拆成「章 → 小节」，每节讲透一个知识点；章末还有总结和单元测试</p>

          <div class="tch__field">
            <span class="t-label">选老师</span>
            <div class="tch__teachers">
              <button v-for="t in TEACHERS" :key="t.id" type="button"
                      class="tch__tchip" :class="{ 'is-on': draftTeacher === t.id }"
                      @click="draftTeacher = t.id">
                <span class="tch__tchip-avatar" :style="{ background: t.color }">
                  <img :src="teacherArt(t.id)" :alt="t.name" loading="lazy" />
                </span>
                <span class="tch__tchip-main">
                  <b>{{ t.name }}</b>
                  <i>{{ t.style }}</i>
                  <span v-if="(t.tags || []).length" class="tch__tchip-tags">
                    <em v-for="tg in t.tags" :key="tg">{{ tg }}</em>
                  </span>
                </span>
              </button>
            </div>
            <!-- 选中即预览大画像（2026-10-09 用户反馈：选老师时看不到老师长什么样） -->
            <Transition name="tch-pv" mode="out-in">
              <div :key="pvTeacher.id" class="tch__pv" :style="{ '--tch-c': pvTeacher.color }">
                <div class="tch__pv-fig">
                  <img :src="teacherArt(pvTeacher.id)" :alt="pvTeacher.name" />
                </div>
                <div class="tch__pv-txt">
                  <b>{{ pvTeacher.name }}<i>{{ pvTeacher.style }}</i></b>
                  <p>“{{ pvTeacher.line }}”</p>
                </div>
              </div>
            </Transition>
          </div>

          <div class="tch__field">
            <span class="t-label">学哪门课</span>
            <div class="tch__courses">
              <button v-for="c in suggestCourses" :key="c.id" type="button"
                      class="tch__cchip" :class="{ 'is-on': draftSubject === c.name }"
                      @click="pickCourse(c)">{{ c.name }}</button>
            </div>
            <UiInput v-model="draftSubject" placeholder="也可以手输学科名，如：高等数学 / 数据结构 / 大学物理"
                     :maxlength="40" @submit="createCourse" />
          </div>

          <div class="tch__field">
            <span class="t-label">难度</span>
            <UiSegmented v-model="draftLevel" :options="LEVELS" aria-label="讲义难度" />
          </div>

          <UiButton variant="primary" :disabled="busy" @click="createCourse">
            {{ busy ? prepSteps[prepIdx] || '老师正在备课…' : '开始上课' }}
          </UiButton>
        </div>

        <!-- 右：我的课程（有课）/ 怎么上（空态） -->
        <aside class="tch__mine-col">
          <section v-if="activeSyllabi.length" class="tch__start-card surface-standard tch__mine">
            <div class="tch__mine-head">
              <h3 class="t-h4">我的课程</h3>
              <span class="t-label">{{ doingList.length }} 门进行中</span>
              <button type="button" class="tch__mine-all" @click="openList">全部 →</button>
            </div>

            <button v-for="s in doingList" :key="s.id" type="button" class="tch__ccard"
                    :disabled="busy" @click="openCourse(s)">
              <span class="tch__ccard-top">
                <b class="tch__ccard-name">{{ s.title || s.subject }}</b>
                <span class="tch__pill">{{ levelLabel(s.level) }}</span>
                <span class="tch__pill is-gray">{{ s.teacher.name }}</span>
              </span>
              <span class="tch__ccard-prog">
                <span class="tch__ccard-bar"><i :style="{ width: sylProgress(s).pct + '%' }" /></span>
                <span class="tch__ccard-pct">{{ sylProgress(s).cur }} / {{ sylProgress(s).total }} 节</span>
              </span>
              <span class="tch__ccard-meta">
                <span>已掌握 {{ sylProgress(s).kp }} 个知识点</span>
                <i class="tch__ccard-dot" />
                <span>{{ sylTimeAgo(s.updated_at) }}学过</span>
              </span>
              <span v-if="sylChapters(s).length" class="tch__ccard-chaps">
                <span class="tch__ccard-chlab">章节掌握（悬停看明细）</span>
                <span v-for="(ch, ci) in sylChapters(s)" :key="ci" class="tch__ccard-chrow">
                  <span class="tch__ccard-chname" :title="ch.name">{{ ch.name }}</span>
                  <span class="tch__cells">
                    <i v-for="(cell, k) in ch.cells" :key="k" class="tch__cell" :class="`is-${cell.status}`"
                       :title="`${ch.name} · ${cell.name}：${cellLabel(cell.status)}`" />
                  </span>
                </span>
                <span class="tch__ccard-legend">
                  <span><i class="tch__cell is-done" />已掌握</span>
                  <span><i class="tch__cell is-started" />学了一半</span>
                  <span><i class="tch__cell is-todo" />还没学</span>
                </span>
              </span>
              <span class="tch__ccard-go">{{ s.done ? '复习这门课' : '继续上课' }} →</span>
            </button>

            <div v-if="doneList.length" class="tch__mine-group">
              <button type="button" class="tch__mine-grouprow" @click="doneOpen = !doneOpen">
                已学完 {{ doneList.length }} 门
                <span class="tch__mine-more">{{ doneOpen ? '收起 −' : '展开 +' }}</span>
              </button>
              <div v-show="doneOpen" class="tch__mine-dones">
                <button v-for="s in doneList" :key="s.id" type="button" class="tch__mine-donerow"
                        :disabled="busy" @click="openCourse(s)">
                  <span class="tch__mine-donename">{{ s.title || s.subject }}</span>
                  <span class="t-label">{{ s.total }} / {{ s.total }} 节 · {{ s.teacher.name }}</span>
                  <span class="tch__mine-donego">复习 →</span>
                </button>
              </div>
            </div>
          </section>

          <!-- 空态：一门课都没有 → 换成「怎么上」三步说明（不留空白） -->
          <section v-else class="tch__start-card surface-standard tch__howto">
            <div class="tch__mine-head">
              <h3 class="t-h4">AI 课堂怎么上</h3>
              <span class="t-label">三步搞定一门课</span>
            </div>
            <div class="tch__howto-steps">
              <div v-for="(st, i) in howtoSteps" :key="i" class="tch__howto-step" :style="{ '--sc': st.color }">
                <span class="tch__howto-no">{{ i + 1 }}</span>
                <span class="tch__howto-txt">
                  <b>{{ st.title }}</b>
                  <span>{{ st.desc }}</span>
                </span>
              </div>
            </div>
            <p class="tch__howto-tip">开课以后，这栏会变成「我的课程」：显示每门课的进度、已掌握知识点和上次学到哪，一键继续。</p>
          </section>
        </aside>
      </div>
    </section>

    <!-- ② 教学区：左立绘 + 右卡片流 -->
    <div v-else class="tch__body">
      <aside class="tch__stage">
        <div class="tch__figure" :class="`is-${face}`" :style="{ '--tch-c': teacher.color }">
          <img class="tch__figure-img" :src="figureSrc" :alt="teacher.name" loading="eager" />
        </div>
        <div class="tch__who">
          <b>{{ teacher.name }}</b>
          <i>{{ teacher.style }}</i>
        </div>
        <p class="tch__bubble">{{ bubble }}</p>
        <!-- 章节目录（桌面常驻，2026-10-10 两级树）：章可折叠，节点跳转，章末有总结+单元测试入口
             2026-10-11 打磨：加全课进度条 / 本章进度点 / 状态图例；「切换课程」收进目录头部 -->
        <div v-if="syllabus.total" class="tch__toc">
          <div class="tch__toc-top">
            <span>课程目录</span>
            <button type="button" class="tch__toc-switch" @click="openList">切换课程</button>
          </div>
          <div class="tch__toc-bar"><i :style="{ width: (kpTotal ? (kpDoneCount / kpTotal) * 100 : 0) + '%' }" /></div>
          <div class="tch__toc-stat" title="已确认=这节过完并确认了；答错的题已进错题本，是否真掌握以自测为准">{{ kpDoneCount }} / {{ kpTotal }} 节已确认</div>
          <button type="button" class="tch__toc-head" @click="tocOpen = !tocOpen">
            <span>{{ tocOpen ? '收起目录' : '展开目录' }}</span>
            <b>{{ tocOpen ? '−' : '+' }}</b>
          </button>
          <div v-show="tocOpen" class="tch__toc-tree">
            <section v-for="(ch, ci) in syllabus.chapters || []" :key="ci" class="tch__toc-ch">
              <button type="button" class="tch__toc-chhead" @click="toggleCh(ci)">
                <span class="tch__toc-chname" :title="ch.name">{{ ch.name }}</span>
                <span class="tch__toc-chdots">
                  <i v-for="k in chapterStats(ci).total" :key="k"
                     :class="{ 'is-done': k <= chapterStats(ci).done }" />
                </span>
                <span class="tch__toc-chcm">{{ chapterStats(ci).done }}/{{ chapterStats(ci).total }}</span>
                <b>{{ chOpen[ci] === false ? '+' : '−' }}</b>
              </button>
              <ul v-show="chOpen[ci] !== false" class="tch__toc-list">
                <li v-for="(it, i) in chapterItems(syllabus, ci)" :key="i">
                  <button type="button" class="tch__toc-row" :class="`is-${kpStatusOf(syllabus, it.i)}`"
                          :disabled="busy" @click="jumpKp(it.i)">
                    <span class="tch__toc-idx">{{ it.i + 1 }}</span>
                    <span class="tch__toc-name">{{ it.name }}</span>
                    <span class="tch__toc-mark">{{ kpMark(it.i) }}</span>
                  </button>
                </li>
                <li v-if="syllabus.version >= 2">
                  <button type="button" class="tch__toc-row tch__toc-row--chend"
                          :class="{ 'is-done': (syllabus.unit_tests || {})[String(ci)]?.state === 'graded' }"
                          :disabled="busy" @click="openChapterEnd(ci)">
                    <span class="tch__toc-idx">◈</span>
                    <span class="tch__toc-name">章末 · 总结与测试</span>
                    <span class="tch__toc-mark">{{ (syllabus.unit_tests || {})[String(ci)]?.state === 'graded' ? '✓' : '○' }}</span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
          <div class="tch__toc-legend">
            <span>✓ 已掌握</span><span>▶ 正在讲</span><span>● 学过</span><span>○ 未学</span>
          </div>
        </div>
      </aside>

      <main class="tch__stream">
        <div class="tch__course">
          <span class="tch__course-name">{{ syllabus.title || syllabus.subject }}</span>
          <span class="t-label">{{ progressText }}</span>
          <span class="tch__course-spacer" />
          <!-- 移动端目录入口（桌面走左栏常驻目录） -->
          <UiButton v-if="syllabus.total" class="tch__toc-btn" variant="ghost" size="sm"
                    :disabled="busy" @click="tocMOpen = true">
            <UiIcon name="schedule" :size="14" /> 目录
          </UiButton>
          <UiButton v-if="syllabus.total > 1 && state !== 'done'" variant="ghost" size="sm" :disabled="busy || !canKpNav"
                     @click="switchTeacher">
            换 {{ teacher.id === 'chenli' ? '沈老师' : '陈老师' }}
          </UiButton>
        </div>

        <!-- 讲义骨架 / 流式实时文本（有内容就不让用户干等） -->
        <div v-if="busy && !lecture" class="tch-card tch-card--skeleton">
          <template v-if="streamingText">
            <p class="t-label tch__stream-hint">{{ prepSteps[prepIdx] }}</p>
            <p class="tch__stream-text">{{ streamingText }}<span class="ai-caret" /></p>
          </template>
          <template v-else>
            <UiSkeleton variant="card" :lines="4" />
            <p class="t-label">{{ prepSteps[prepIdx] }}</p>
          </template>
        </div>

        <template v-if="lecture">
          <!-- ① 知识点：四边细描边 + 卡头常驻 + 正文最高一屏（内容超了才卡内滚动） -->
          <section class="tch-card tch-card--scroll tch-card--kp">
            <div class="tch-card__head">
              <span class="tch-card__badge">{{ kpNo }} · 知识点</span>
              <h2 class="t-h3">{{ kp.name }}</h2>
            </div>
            <div ref="kpBodyEl" class="tch-card__body">
            <div v-if="kp.definition" class="tch-field" style="--fc:#7c5cff">
              <span class="tch-field__label">定义</span>
              <MathText :content="kp.definition" />
            </div>
            <div v-if="kp.principle" class="tch-field" style="--fc:#5b6ee8">
              <span class="tch-field__label">核心原理</span>
              <MathText :content="kp.principle" />
            </div>
            <div v-if="(kp.pitfalls || []).length" class="tch-field" style="--fc:#c9743a">
              <span class="tch-field__label">⚑ 易错提醒</span>
              <ul class="tch-list">
                <li v-for="(p, i) in kp.pitfalls" :key="i"><MathText :content="p" /></li>
              </ul>
            </div>
            <div v-if="(kp.symbols || []).length" class="tch-field" style="--fc:#5d6880">
              <span class="tch-field__label">符号含义</span>
              <ul class="tch-list tch-list--sym">
                <li v-for="(s, i) in kp.symbols" :key="i">
                  <b v-if="s.sym"><MathText :content="s.sym" /></b><span><MathText :content="s.meaning" /></span>
                </li>
              </ul>
            </div>
            <div v-if="(kp.confused_with || []).length" class="tch-field" style="--fc:#4a8f9e">
              <span class="tch-field__label">容易混淆</span>
              <ul class="tch-list">
                <li v-for="(c, i) in kp.confused_with" :key="i">
                  <b>{{ c.a }}</b> ↔ <b>{{ c.b }}</b>：<MathText :content="c.diff" />
                </li>
              </ul>
            </div>
            </div>
            <div v-if="kpOverflow" class="tch-card__more"><span>↓ 卡内滚动查看完整讲义</span></div>
          </section>

          <!-- ② 例题（详解随题折叠呈现——先自己想，再展开看） -->
          <section v-if="example.question" class="tch-card tch-card--ex">
            <div class="tch-card__tag">例题</div>
            <MathText :content="example.question" />
            <button type="button" class="tch-ex__toggle" @click="exOpen = !exOpen">
              {{ exOpen ? '收起详解' : '先自己想，想好了看详解' }}<i :class="{ up: exOpen }">▾</i>
            </button>
            <div v-if="exOpen" class="tch-ex__body">
              <ol class="tch-steps">
                <li v-for="(s, i) in example.steps || []" :key="i">
                  <div class="tch-steps__title"><MathText :content="s.title || `第 ${i + 1} 步`" /></div>
                  <div class="tch-steps__detail"><MathText :content="s.detail" /></div>
                  <div v-if="s.basis" class="tch-steps__basis">
                    依据：<MathText :content="s.basis" />
                  </div>
                </li>
              </ol>
              <div v-if="example.answer" class="tch-ex__answer">
                <span class="tch-field__label">答案</span><MathText :content="example.answer" />
              </div>
              <div v-if="example.analysis" class="tch-field tch-field--analysis">
                <span class="tch-field__label">这道题在考什么 · 思路分析</span>
                <MathText :content="example.analysis" />
              </div>
            </div>
          </section>

          <!-- ② 考试题 + 批改（2026-10-11 合并为一张卡：作答完原地变批改结果，省一层卡片） -->
          <section class="tch-card tch-card--q" :class="grade ? `is-${gradeUi.tone}` : ''">
            <div class="tch-card__head">
              <span class="tch-card__tag-inline">考试题 · {{ exam.type === 'choice' ? '选择' : '作答' }}</span>
              <template v-if="grade">
                <span class="tch-card__tag-inline">已批改</span>
                <span class="tch-qhead__sp" />
                <span class="tch-qhead__score" :class="`is-${gradeUi.tone}`">
                  {{ gradeUi.label }}<template v-if="grade.score !== undefined"> · {{ grade.score }} 分</template>
                </span>
              </template>
            </div>
            <MathText :content="exam.question || ''" />

            <div v-if="exam.type === 'choice'" class="tch-options">
              <button v-for="o in exam.options" :key="o.key" type="button"
                      class="tch-opt" :class="`is-${optionState(o.key, chosenKey, answerKey, !!grade)}`"
                      :disabled="busy || !!grade" @click="submitChoice(o.key)">
                <span class="tch-opt__key">{{ o.key }}</span>
                <span class="tch-opt__text"><MathText :content="o.text" /></span>
                <span v-if="grade && chosenKey === o.key" class="tch-opt__mine">你选的</span>
                <span v-else-if="grade && o.key === answerKey" class="tch-opt__mine is-ok">正解</span>
              </button>
            </div>

            <div v-else class="tch-answer">
              <UiInput v-model="textAnswer" type="textarea" :rows="4" :maxlength="2000"
                       placeholder="写清你的思路与步骤；公式可用 LaTeX，如 \frac{1}{2}"
                       :disabled="busy || !!grade" @submit="submitText" />
              <!-- 拍照作答（#9）：手写拍照/传图 → mode=answer 逐字转录 → 填入作答框供校对（与自测同管线） -->
              <div class="tch-shot">
                <input ref="cameraInput" type="file" accept="image/*" capture="environment"
                       class="sr-only" @change="onShotFile" />
                <input ref="albumInput" type="file" accept="image/*"
                       class="sr-only" @change="onShotFile" />
                <UiButton variant="ghost" size="sm" :disabled="busy || !!grade || transcribing"
                          @click="cameraInput && cameraInput.click()">
                  <UiIcon name="camera" :size="14" /> {{ transcribing ? '识别手写中…' : '拍照作答' }}
                </UiButton>
                <UiButton variant="ghost" size="sm" :disabled="busy || !!grade || transcribing"
                          @click="albumInput && albumInput.click()">传图</UiButton>
                <img v-if="shotImg" class="tch-shot__thumb" :src="shotImg" alt="作答照片" />
                <UiButton v-if="shotImg" variant="ghost" size="sm" @click="removeShot">移除</UiButton>
              </div>
              <UiButton variant="primary" :disabled="busy || !!grade || !textAnswer.trim()"
                        @click="submitText">
                {{ busy ? '老师正在批改…' : '提交作答' }}
              </UiButton>
            </div>

            <p v-if="exam.type === 'choice' && !grade" class="t-label">点选项即提交</p>

            <!-- 批改内容（同卡内呈现，2026-10-11 分三层：结论 → 错因/逐选项 → 评分点） -->
            <template v-if="grade">
              <div class="tch-qdivide" />

              <!-- 结论先行 -->
              <div class="tch-verdict" :class="`is-${gradeUi.tone}`">
                <span class="tch-verdict__mark">{{ gradeUi.tone === 'ok' ? '✓' : gradeUi.tone === 'warn' ? '◐' : '✗' }}</span>
                <span class="tch-verdict__txt">
                  <b>{{ gradeUi.label }}</b>
                  <p v-if="grade.comment"><MathText :content="grade.comment" /></p>
                </span>
                <span v-if="grade.score !== undefined" class="tch-verdict__score">
                  <b>{{ grade.score }}</b><i>本题得分 / 100</i>
                </span>
              </div>

              <!-- L1 错因诊断（默认展开） -->
              <div class="tch-sec">
                <button type="button" class="tch-sec__head" @click="diagOpen = !diagOpen">
                  <span class="tch-sec__t">错因诊断</span>
                  <span v-if="grade.error_point || grade.root_cause" class="tch-sec__chip is-warn">需重点看</span>
                  <span class="tch-sec__tg">{{ diagOpen ? '收起 −' : '展开 +' }}</span>
                </button>
                <div v-show="diagOpen" class="tch-sec__body">
                  <div v-if="grade.error_point" class="tch-diag">
                    <span class="tch-diag__k">错在哪</span><span><MathText :content="grade.error_point" /></span>
                  </div>
                  <div v-if="grade.root_cause" class="tch-diag is-rc">
                    <span class="tch-diag__k">根源</span><span><MathText :content="grade.root_cause" /></span>
                  </div>
                  <div v-if="grade.counterexample" class="tch-diag is-ce">
                    <span class="tch-diag__k">反例</span><span><MathText :content="grade.counterexample" /></span>
                  </div>
                  <div v-if="grade.distractor_reason" class="tch-diag is-dr">
                    <span class="tch-diag__k">为什么 {{ grade.chosen }} 看着对</span>
                    <span><MathText :content="grade.distractor_reason" /></span>
                  </div>
                </div>
              </div>

              <!-- L2 逐选项解析（默认展开；后端缓存同题不二次花钱） -->
              <div v-if="exam.type === 'choice'" class="tch-sec">
                <button type="button" class="tch-sec__head" @click="optsOpen = !optsOpen">
                  <span class="tch-sec__t">逐选项解析</span>
                  <span v-if="examAnalysis" class="tch-sec__n">{{ (examAnalysis.per_option || []).length }} 项<template v-if="(examAnalysis.kps || []).length"> · {{ examAnalysis.kps.join(' · ') }}</template></span>
                  <span class="tch-sec__tg">{{ optsOpen ? '收起 −' : '展开 +' }}</span>
                </button>
                <div v-show="optsOpen" class="tch-sec__body">
                  <p v-if="analysisLoading && !examAnalysis" class="t-label">正在生成逐选项解析…</p>
                  <div v-for="p in (examAnalysis || {}).per_option || []" :key="p.key"
                       class="tch-check__row" :class="p.verdict === 'right' ? 'is-hit' : 'is-miss'">
                    <span class="tch-check__mark">{{ p.key }}</span>
                    <div class="tch-check__main">
                      <p class="tch-check__ev">
                        <b :class="p.verdict === 'right' ? 'is-right' : 'is-wrong'">{{ p.verdict === 'right' ? '√ 正确' : '× 错误' }}</b>
                        <MathText :content="p.why" />
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- L3 评分点核查 + 步骤反馈（默认收起） -->
              <div v-if="(grade.point_results || []).length || (grade.step_feedback || []).length" class="tch-sec">
                <button type="button" class="tch-sec__head" @click="pointsOpen = !pointsOpen">
                  <span class="tch-sec__t">评分点逐项核查</span>
                  <span v-if="(grade.point_results || []).length" class="tch-sec__chip"
                        :class="grade.score >= 60 ? 'is-ok' : 'is-bad'">合计 {{ grade.score }} / 100</span>
                  <span class="tch-sec__tg">{{ pointsOpen ? '收起 −' : '展开 +' }}</span>
                </button>
                <div v-show="pointsOpen" class="tch-sec__body">
                  <div v-for="(p, i) in grade.point_results || []" :key="i"
                       class="tch-check__row" :class="p.hit ? 'is-hit' : 'is-miss'">
                    <span class="tch-check__mark">{{ p.hit ? '✓' : '✗' }}</span>
                    <div class="tch-check__main">
                      <div class="tch-check__line">
                        <MathText class="tch-check__pt" :content="p.point" />
                        <span class="tch-check__sc">{{ p.got }} / {{ p.max }}</span>
                      </div>
                      <p v-if="p.evidence" class="tch-check__ev">
                        <span class="tch-field__label">依据</span><MathText :content="p.evidence" />
                      </p>
                    </div>
                  </div>
                  <ul v-if="(grade.step_feedback || []).length" class="tch-list">
                    <li v-for="(s, i) in grade.step_feedback" :key="i"><MathText :content="s" /></li>
                  </ul>
                </div>
              </div>

              <p v-if="wrongSaved" class="tch-grade__saved">已加入错题本，之后会在自测与复习里再遇到它</p>
            </template>
          </section>

        </template>

        <!-- 底部：推进（桌面提问走右侧常驻栏；移动端保留输入）
             2026-10-11 打磨：左侧补「本节位置 + 全课进度条 + 剩余节数」，主 CTA 加大 -->
        <div v-if="lecture" class="tch__composer">
          <span class="tch__composer-pos">
            第 <b>{{ kpNo }}</b> / {{ kpTotal }} 讲<template v-if="syllabus.chapters?.[currentChapterIndex]"> · {{ syllabus.chapters[currentChapterIndex].name }}</template>
          </span>
          <span class="tch__composer-bar"><i :style="{ width: (kpTotal ? (kpNo / kpTotal) * 100 : 0) + '%' }" /></span>
          <span v-if="kpLeft" class="tch__composer-left">还剩 {{ kpLeft }} 节</span>
          <UiInput class="tch__composer-input" v-model="askInput" placeholder="有疑问就在这里问（比如：这一步为什么能直接代入？）"
                   :maxlength="600" :disabled="busy" @submit="send" />
          <UiButton class="tch__composer-ask" variant="ghost" :disabled="busy || !askInput.trim()" @click="send">提问</UiButton>
          <UiButton class="tch__composer-cta" variant="primary" :disabled="busy || !canGoNext" @click="goNext">
            会了，下一个知识点
          </UiButton>
        </div>
        <p v-if="lecture && !grade" class="t-label tch__hint">
          做完这道题会给你批改；如果这道题你已经会了，也可以直接进入下一节
        </p>

        <!-- 章末面板（2026-10-10 #4）：总结 + 单元测试 + 薄弱定位 -->
        <section v-if="chEnd" class="tch-card tch-card--chend">
          <div class="tch-card__tag">章末 · {{ chEnd.chapter?.name }}</div>

          <!-- ① 总结 -->
          <div v-if="chEnd.overview" class="tch-field">
            <span class="tch-field__label">本章脉络</span>
            <MathText :content="chEnd.overview" />
          </div>
          <div v-if="(chEnd.sections || []).length" class="tch-field">
            <span class="tch-field__label">小节速查</span>
            <ul class="tch-list tch-list--chend">
              <li v-for="(s, i) in chEnd.sections" :key="i">
                <b>{{ s.name }}</b>
                <span v-if="(s.pitfalls || []).length" class="tch-chend__pit">易错：{{ s.pitfalls.join('；') }}</span>
              </li>
            </ul>
          </div>

          <!-- ② 单元测试 -->
          <template v-if="chEnd.state !== 'graded'">
            <div class="tch-field">
              <span class="tch-field__label">单元测试 · {{ (chEnd.paper || []).length }} 题（选择题点选项即答，文字题写思路）</span>
            </div>
            <div v-for="(q, qi) in chEnd.paper || []" :key="qi" class="tch-chq">
              <div class="tch-chq__head">
                <span class="tch-chq__idx">{{ qi + 1 }}</span>
                <span class="tch-chq__from">{{ q.origin === 'replay' ? `来自小节「${q.section}」` : (q.kp || '新综合题') }}</span>
              </div>
              <MathText :content="q.question || ''" />
              <div v-if="q.type === 'choice'" class="tch-options">
                <button v-for="o in q.options || []" :key="o.key" type="button"
                        class="tch-opt" :class="{ 'is-chosen': unitAnswers[qi]?.choice === o.key }"
                        :disabled="busy" @click="pickUnit(qi, o.key)">
                  <span class="tch-opt__key">{{ o.key }}</span>
                  <span class="tch-opt__text"><MathText :content="o.text" /></span>
                </button>
              </div>
              <div v-else class="tch-answer">
                <UiInput v-model="unitAnswers[qi].text" type="textarea" :rows="3" :maxlength="2000"
                         placeholder="写清思路与步骤；公式可用 LaTeX" />
              </div>
            </div>
            <div class="tch-chend__ops">
              <UiButton variant="primary" :disabled="busy || !unitAnswered" @click="submitUnit">
                {{ busy ? '老师正在批改…' : '交卷' }}
              </UiButton>
              <UiButton variant="ghost" :disabled="busy" @click="skipChapterEnd">跳过测试，直接进下一章</UiButton>
            </div>
          </template>

          <!-- ③ 结果 -->
          <template v-if="chEnd.state === 'graded' && chEnd.result">
            <div class="tch-chend__score" :class="`is-${unitTone}`">
              <b>{{ chEnd.result.score }}</b><span>分</span>
            </div>
            <div v-for="(r, ri) in chEnd.result.results || []" :key="ri" class="tch-chq">
              <div class="tch-chq__head">
                <span class="tch-chq__idx">{{ ri + 1 }}</span>
                <span class="tch-chq__from">{{ r.section || r.kp || '综合题' }} · {{ r.grade?.verdict === 'correct' ? '✓ 对' : (r.grade?.verdict === 'partial' ? '◐ 部分' : '✗ 错') }} {{ r.grade?.score }}分</span>
              </div>
              <p v-if="r.grade?.comment" class="tch-grade__comment"><MathText :content="r.grade.comment" /></p>
            </div>
            <div v-if="(chEnd.result.weak || []).length" class="tch-field tch-field--distract">
              <span class="tch-field__label">薄弱小节 · 建议回去补一补（不拦你进下一章）</span>
              <div class="tch-chend__weak">
                <button v-for="w in chEnd.result.weak" :key="w.section" type="button"
                        class="tch-chend__wbtn" :disabled="busy" @click="revisitWeak(w.index)">
                  {{ w.section }}（失分 {{ w.miss }} 题）→ 回这节
                </button>
              </div>
            </div>
            <p v-if="chEnd.result.advice" class="t-chend__advice"><MathText :content="chEnd.result.advice" /></p>
            <div class="tch-chend__ops">
              <UiButton variant="primary" :disabled="busy" @click="goNextChapter">进入下一章</UiButton>
            </div>
          </template>
        </section>
      </main>

      <!-- 常驻对话栏（2026-10-10 #3）：桌面右侧栏 / 移动端底部抽屉；全程可问，历史不丢
           注意：悬浮 tab 必须是 .tch__chat 的兄弟节点——display:none 的抽屉会连同 fixed 子元素一起抑制渲染 -->
      <button v-if="lecture || chEnd" type="button" class="tch__chat-tab" @click="chatOpen = !chatOpen">
        <UiIcon name="chat" :size="14" /> 问{{ teacher.name }}{{ askLog.length ? ` · ${askLog.length}` : '' }}
      </button>
      <aside v-if="lecture || chEnd" class="tch__chat" :class="{ 'is-open': chatOpen }">
        <div class="tch__chat-head">
          <b>向 {{ teacher.name }} 提问</b>
          <span class="tch__chat-sub">本知识点的问答都会留在这里</span>
          <button type="button" class="tch__chat-close" @click="chatOpen = false">×</button>
        </div>
        <div class="tch__chat-log" ref="chatLogEl">
          <p v-if="!askLog.length" class="t-label">讲解、考试、批改全程都能问——问过和答过的都留在这里</p>
          <div v-for="(a, i) in askLog" :key="i" class="tch-qa">
            <p class="tch-qa__q">{{ a.q }}</p>
            <p class="tch-qa__a"><MathText :content="a.a" /></p>
            <span class="tch-qa__meta">{{ kpNo }} · 本知识点</span>
          </div>
        </div>
        <div class="tch__chat-input">
          <UiInput v-model="askInput" :maxlength="600" :disabled="busy"
                   placeholder="比如：这一步为什么能直接代入？" @submit="send" />
          <UiButton variant="ghost" size="sm" :disabled="busy || !askInput.trim()" @click="send">发送</UiButton>
        </div>
      </aside>
    </div>

    <!-- 我的课程（2026-10-11 升维：与开课面板同一套课程卡 + 进行中/已学完分组） -->
    <UiModal v-model="listOpen" title="我的课程" size="lg">
      <div class="tch-mm">
        <p class="tch-mm__sub">
          {{ activeSyllabi.length ? `${doingList.length} 门进行中 · 点任意一门继续上次那节` : '开过的课都会留在这里' }}
        </p>

        <template v-if="activeSyllabi.length">
          <template v-if="doingList.length">
            <div class="tch-mm__grp">进行中 <span>{{ doingList.length }} 门</span></div>
            <button v-for="s in doingList" :key="s.id" type="button" class="tch__ccard is-wide"
                    :disabled="busy" @click="openFromList(s)">
              <span class="tch__ccard-top">
                <b class="tch__ccard-name">{{ s.title || s.subject }}</b>
                <span class="tch__pill">{{ levelLabel(s.level) }}</span>
                <span class="tch__pill is-gray">{{ s.teacher.name }}</span>
              </span>
              <span class="tch__ccard-prog">
                <span class="tch__ccard-bar"><i :style="{ width: sylProgress(s).pct + '%' }" /></span>
                <span class="tch__ccard-pct">{{ sylProgress(s).cur }} / {{ sylProgress(s).total }} 节</span>
              </span>
              <span class="tch__ccard-meta">
                <span>已掌握 {{ sylProgress(s).kp }} 个知识点</span>
                <i class="tch__ccard-dot" />
                <span>{{ sylTimeAgo(s.updated_at) }}学过</span>
              </span>
              <span class="tch__ccard-go">继续上课 →</span>
            </button>
          </template>

          <template v-if="doneList.length">
            <div class="tch-mm__grp">已学完 <span>{{ doneList.length }} 门</span></div>
            <button v-for="s in doneList" :key="s.id" type="button" class="tch-mm__done"
                    :disabled="busy" @click="openFromList(s)">
              <b>{{ s.title || s.subject }}</b>
              <span class="t-label">{{ s.total }} / {{ s.total }} 节 · {{ s.teacher.name }}</span>
              <span class="tch-mm__donego">复习 →</span>
            </button>
          </template>
        </template>

        <div v-else class="tch-mm__empty">
          <span class="tch-mm__ico"><UiIcon name="teacher" :size="22" /></span>
          <p>还没有开始过 AI 课堂<br />开一门课，老师会把它拆成「章 → 小节」带你一节一节过</p>
          <UiButton variant="primary" @click="goCreateCourse">去开一门课 →</UiButton>
        </div>
      </div>
    </UiModal>

    <!-- 大纲编辑（2026-10-11 分区化：课程信息 / 授课老师 / 章节结构 / 危险操作；
         节行操作收进「⋯」菜单，删除类操作走二次确认） -->
    <UiModal v-model="editOpen" title="大纲" size="lg">
      <div v-if="syllabus" class="tch-edit">
        <p class="tch-edit__sub">课程名、老师、章节都能改；改完立即生效</p>

        <!-- ① 课程信息 -->
        <section class="tch-edit__sec">
          <div class="tch-edit__sech"><b>课程信息</b><span>改完点保存</span></div>
          <div class="tch-edit__secb">
            <div class="tch-edit__row">
              <UiInput v-model="editTitle" label="课程名" :maxlength="40" />
              <UiButton variant="primary" size="sm" @click="doEdit('rename', { title: editTitle })">保存名称</UiButton>
            </div>
          </div>
        </section>

        <!-- ② 授课老师：点选即生效 -->
        <section class="tch-edit__sec">
          <div class="tch-edit__sech">
            <b>授课老师</b><span>换老师会从当前节重新讲一遍</span>
            <span class="tch-edit__tg">点选即生效</span>
          </div>
          <div class="tch-edit__secb">
            <div class="tch-teacher-pick">
              <button v-for="t in TEACHERS" :key="t.id" type="button" class="tch-tpick"
                      :class="{ 'is-on': editTeacher === t.id }" :disabled="busy"
                      @click="switchTeacherTo(t.id)">
                <img :src="teacherArt(t.id)" :alt="t.name" />
                <span><b>{{ t.name }}</b><i>{{ t.style }}</i></span>
                <span v-if="editTeacher === t.id" class="tch-tpick__tick">✓</span>
              </button>
            </div>
          </div>
        </section>

        <!-- ③ 章节结构 -->
        <section class="tch-edit__sec">
          <div class="tch-edit__sech">
            <b>章节结构</b><span>{{ syllabus.total }} 节 · {{ (syllabus.chapters || []).length }} 章</span>
            <span class="tch-edit__tg">节行右侧「⋯」可改名 / 从这节开始 / 删除</span>
          </div>
          <div class="tch-edit__secb">
            <div class="tch-edit__tree">
              <section v-for="(ch, ci) in syllabus.chapters || []" :key="ci" class="tch-edit__ch">
                <div class="tch-edit__chrow">
                  <span class="tch-edit__chname">{{ ch.name }}</span>
                  <span class="tch__toc-chdots">
                    <i v-for="k in chapterStats(ci).total" :key="k" :class="{ 'is-done': k <= chapterStats(ci).done }" />
                  </span>
                  <span class="tch-edit__chcm">{{ chapterStats(ci).done }}/{{ chapterStats(ci).total }}</span>
                  <button type="button" class="tch-kebab" :class="{ 'is-on': menuKey === `ch:${ci}` }"
                          @click.stop="toggleMenu(`ch:${ci}`)">⋯</button>
                  <div v-if="menuKey === `ch:${ci}`" class="tch-menu" @click.stop>
                    <button type="button" @click="closeMenu(); askRenameChapter(ci)">重命名本章</button>
                  </div>
                </div>
                <ul class="tch-edit__list">
                  <li v-for="(it, i) in chapterItems(syllabus, ci)" :key="it.i"
                      :class="{ 'is-cur': it.i === syllabus.cursor }">
                    <span class="tch-edit__mark" :class="`is-${kpStatusOf(syllabus, it.i)}`">{{ kpMark(it.i) }}</span>
                    <span class="tch-edit__idx">{{ it.i + 1 }}</span>
                    <span class="tch-edit__name">{{ it.name }}</span>
                    <button type="button" class="tch-kebab" :class="{ 'is-on': menuKey === `kp:${it.i}` }"
                            @click.stop="toggleMenu(`kp:${it.i}`)">⋯</button>
                    <div v-if="menuKey === `kp:${it.i}`" class="tch-menu" @click.stop>
                      <button type="button" @click="closeMenu(); jumpTo(it.i)">从这节开始</button>
                      <button type="button" class="is-danger" @click="closeMenu(); askDeleteKp(it)">删除这节</button>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
            <div class="tch-edit__row">
              <UiInput v-model="editNewKp" placeholder="新增知识点名，例：洛必达法则的适用条件" :maxlength="60" />
              <UiButton variant="ghost" size="sm" @click="doEdit('add', { name: editNewKp })">添加</UiButton>
            </div>
          </div>
        </section>

        <!-- ④ 危险操作 -->
        <section class="tch-edit__sec is-danger">
          <div class="tch-edit__sech"><b>危险操作</b><span>不可恢复，操作前会再次确认</span></div>
          <div class="tch-edit__secb">
            <div class="tch-edit__row">
              <button type="button" class="tch-dgr" :disabled="busy" @click="askReset">重置学习进度</button>
              <button type="button" class="tch-dgr" :disabled="busy" @click="askDeleteCourse">删除这门课</button>
              <span class="tch-edit__dgrhint">删除课程会连同课堂记录一起清掉</span>
            </div>
          </div>
        </section>
      </div>
    </UiModal>

    <!-- 编辑相关：二次确认 / 改名（复用同一个弹层，2026-10-11） -->
    <UiModal :model-value="!!dlg" :title="dlg ? dlg.title : ''" size="sm" z-index="var(--z-confirm)"
             @update:model-value="(v) => { if (!v) dlg = null }">
      <div v-if="dlg" class="tch-dlg">
        <p v-if="dlg.desc" class="tch-dlg__desc">{{ dlg.desc }}</p>
        <p v-if="dlg.warn" class="tch-dlg__warn">{{ dlg.warn }}</p>
        <UiInput v-if="dlg.kind === 'rename'" v-model="dlg.value" label="章名" :maxlength="30" />
        <div class="tch-dlg__ops">
          <UiButton variant="ghost" @click="dlg = null">取消</UiButton>
          <button v-if="dlg.kind === 'rename'" type="button" class="tch-btn-pri" :disabled="busy" @click="runDlg">保存</button>
          <button v-else type="button" class="tch-btn-dgr" :disabled="busy" @click="runDlg">{{ dlg.okText }}</button>
        </div>
      </div>
    </UiModal>

    <!-- 章节目录（移动端弹层，2026-10-10 两级）：桌面用左栏常驻目录 -->
    <UiModal v-model="tocMOpen" title="课程目录" size="md">
      <div v-if="syllabus" class="tch-toc-m">
        <p class="t-label tch-toc-m__hint">
          {{ (syllabus.kp_done || []).length }} / {{ syllabus.total }} 节已确认 · 点任意一节跳转，讲义和作答都保留
        </p>
        <div class="tch__toc-tree tch-toc-m__tree">
          <section v-for="(ch, ci) in syllabus.chapters || []" :key="ci" class="tch__toc-ch">
            <button type="button" class="tch__toc-chhead" @click="toggleCh(ci)">
              <span class="tch__toc-chname">{{ ch.name }}</span>
              <b>{{ chOpen[ci] === false ? '+' : '−' }}</b>
            </button>
            <ul v-show="chOpen[ci] !== false" class="tch__toc-list">
              <li v-for="(it, i) in chapterItems(syllabus, ci)" :key="i">
                <button type="button" class="tch__toc-row" :class="`is-${kpStatusOf(syllabus, it.i)}`"
                        :disabled="busy" @click="jumpKp(it.i)">
                  <span class="tch__toc-idx">{{ it.i + 1 }}</span>
                  <span class="tch__toc-name">{{ it.name }}</span>
                  <span class="tch__toc-mark">{{ kpMark(it.i) }}</span>
                </button>
              </li>
              <li v-if="syllabus.version >= 2">
                <button type="button" class="tch__toc-row tch__toc-row--chend"
                        :disabled="busy" @click="tocMOpen = false; openChapterEnd(ci)">
                  <span class="tch__toc-idx">◈</span>
                  <span class="tch__toc-name">章末 · 总结与测试</span>
                  <span class="tch__toc-mark">{{ (syllabus.unit_tests || {})[String(ci)]?.state === 'graded' ? '✓' : '○' }}</span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </UiModal>
  </div>
  <!-- 新手教程 -->
  <UiTour v-model="tourOpen" tour-key="teacher" />
</template>

<script setup>
/**
 * AI 教学老师页（2026-10-09，B1 骨架 + B2 联动）
 * 规则由服务端状态机保证；本页只做展示、收集作答、按 teachFlow 判定确认语。
 * 立绘占位（B3 换真立绘）：用图形 + 表情色环表达状态。
 */
import { computed, nextTick, onMounted, ref, onUnmounted, watch } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiTour from '../ui/UiTour.vue'
import { useTour } from '../lib/useTour.js'
import UiIcon from '../ui/UiIcon.vue'
import UiInput from '../ui/UiInput.vue'
import UiModal from '../ui/UiModal.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiSkeleton from '../ui/UiSkeleton.vue'
import MathText from '../components/MathText.vue'
import { api } from '../api.js'
import { toast } from '../ui/toast.js'
import { readImageDataUrl } from '../lib/imageFile.js'
import { coursesRef, normNameKey } from '../stores/courseStore'
import { logLearning } from '../stores/recordsStore'
import { recordAction } from '../statsStore'
import { getToken } from '../auth.js'
import {
  TEACHERS, teacherOf, isConfirm, optionState, gradeMeta,
  progressLabel, kpContextOf, answerPayload, PREP_STEPS, teacherArt, artFace, TEACHER_FACES,
  kpStatusOf,
} from '../lib/teachFlow.js'

const LEVELS = [
  { label: '自动', value: 'auto' },
  { label: '基础', value: 'basic' },
  { label: '期末', value: 'final' },
  { label: '考研', value: 'kaoyan' },
]
const prepSteps = PREP_STEPS

const myCourses = coursesRef()
/** 开课入口同名去重（2026-10-10 用户拍板：允许课程表建同名卡，但入口只出现一个） */
const dedupCourses = computed(() => {
  const seen = new Set()
  return myCourses.value.filter((c) => {
    const k = normNameKey(c.name)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
})
const syllabi = ref([])
/** 预设学科：课程表里没有课时的推荐（点击只填入输入框，不提交 course_id） */
const PRESET_SUBJECTS = ['高等数学', '数据结构', '线性代数', '大学物理']
const suggestCourses = computed(() => dedupCourses.value.length
  ? dedupCourses.value
  : PRESET_SUBJECTS.map((n) => ({ id: `preset:${n}`, name: n, preset: true })))
/** 旧版（archived / version<2）课程：后端已拒绝继续，前端一律不再展示 */
const activeSyllabi = computed(() => (syllabi.value || []).filter((s) => !s.archived))
/** 进行中 / 已学完 分组（「已学完」行内展开，不弹窗） */
const doingList = computed(() => activeSyllabi.value.filter((s) => !s.done))
const doneList = computed(() => activeSyllabi.value.filter((s) => s.done))
const doneOpen = ref(false)

/* ---------------- 开课面板右栏：我的课程（2026-10-11） ---------------- */
const LEVEL_LABELS = { auto: '自动', basic: '基础', final: '期末', kaoyan: '考研' }
const levelLabel = (lv) => LEVEL_LABELS[lv] || '自动'
const CELL_LABELS = { done: '已掌握', started: '学过一半', cur: '正在学', todo: '还没学' }
const cellLabel = (st) => CELL_LABELS[st] || '还没学'
/** 课程进度：已学到第几节 / 共几节 / 已掌握知识点数 */
function sylProgress(s) {
  const total = Number(s?.total) || (s?.items || []).length || 0
  const cur = Math.min(Number(s?.cursor) || 0, total)
  return { total, cur, pct: total ? Math.round((cur / total) * 100) : 0, kp: (s?.kp_done || []).length }
}
/** 章节掌握小格：每章一节一格，状态复用目录同一套 kpStatusOf（避免两处判定不一致） */
function sylChapters(s) {
  if (!s || !(s.items || []).length) return []
  return (s.chapters || []).map((ch, ci) => ({
    name: ch.name,
    cells: chapterItems(s, ci).map((it) => ({ name: it.name, status: kpStatusOf(s, it.i) })),
  }))
}
/** 相对时间（本地实现，与首页/拍照页同款；updated_at 为毫秒时间戳） */
function sylTimeAgo(ts) {
  const t = Number(ts) || 0
  if (!t) return '还没学过'
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d === 1) return '昨天'
  if (d < 30) return `${d} 天前`
  return `${Math.floor(d / 30)} 个月前`
}
/** 空态右栏：AI 课堂怎么上（三步） */
const howtoSteps = [
  { color: '#7c5cff', title: '选老师 + 定课程', desc: '挑一位讲课风格合你口味的老师，输入学科或选已有课程，再选难度——老师会把整门课拆成「章 → 小节」交给你确认，也可以直接挑最想补的那节开始。' },
  { color: '#8b74f3', title: '逐知识点讲练结合', desc: '每个知识点先讲概念、原理、易错点，再配一道例题；讲完立刻出一道题检验，答错会指出错在哪、根源是什么、给反例。' },
  { color: '#5b47d6', title: '章末总结 + 单元测试', desc: '一章学完出总结与单元测试；答错的题自动进错题本，之后在自测和复习里再遇到它。' },
]
const syllabus = ref(null)
const sessionId = ref('')
const state = ref('')
const lecture = ref(null)
const grade = ref(null)
const reveal = ref(null)
const chosen = ref('')
const textAnswer = ref('')
const askInput = ref('')
const askLog = ref([])
const wrongSaved = ref(false)
const busy = ref(false)
const prepIdx = ref(0)
/** 讲义流式：正在实时写出的文本（有内容时用它替换骨架屏，别让用户干等） */
const streamingText = ref('')
const face = ref('idle')
const bubble = ref('')
const listOpen = ref(false)
const editOpen = ref(false)
const editTitle = ref('')
const editTeacher = ref('chenli')
const editNewKp = ref('')
const draftTeacher = ref('chenli')
const draftSubject = ref('')
const draftCourse = ref(null)
const draftLevel = ref('auto')
const pendingSyl = ref(null)      // 开课确认：大纲已生成，等学生挑起始节（2026-10-10 两级）
const tocOpen = ref(true)         // 桌面左栏目录展开态
const tocMOpen = ref(false)       // 移动端目录弹层
const chOpen = ref({})            // 两级目录：各章展开态（默认全开）
const exOpen = ref(false)         // 例题详解折叠（默认收着，先自己想）
const examAnalysis = ref(null)    // 批改后的逐选项解析（后端缓存）
const analysisLoading = ref(false)
const chEnd = ref(null)           // 章末面板数据 {ch_index, chapter, overview, sections, paper, state, result}
const unitAnswers = ref([])       // 单元测试作答 [{choice, text}]
const chatOpen = ref(false)       // 移动端对话抽屉
const chatLogEl = ref(null)       // 对话栏滚动容器
let prepTimer = null
let startedAt = 0

const teacher = computed(() => teacherOf(syllabus.value?.teacher_id))
/** 开课面板：当前选中的老师预览 */
const pvTeacher = computed(() => teacherOf(draftTeacher.value))
/** 立绘：跟随表情状态切图（idle → 默认表情） */
const figureSrc = computed(() => teacherArt(teacher.value.id, artFace(face.value)))
const kp = computed(() => lecture.value?.kp || {})
const example = computed(() => lecture.value?.example || {})
const exam = computed(() => lecture.value?.exam || {})
const answerKey = computed(() => {
  const a = (reveal.value?.exam || {}).answer_key
  if (a) return a
  return (grade.value?.answer_key) || ''
})
const revealed = computed(() => !!grade.value)
const gradeUi = computed(() => gradeMeta(grade.value?.verdict))
const progressText = computed(() => progressLabel(syllabus.value?.cursor || 0, syllabus.value?.total || 0))
const canGoNext = computed(() => state.value === 'graded' || state.value === 'exam')
const canKpNav = computed(() => !busy.value)
/** 学生所选选项：点击时存本地；重新进入已批改的知识点用后端 grade.chosen 兜底（否则「你选的」会丢） */
const chosenKey = computed(() => String(chosen.value || grade.value?.chosen || '').toUpperCase())

/* ---------------- 教学区打磨（2026-10-11 v3/v4 定稿） ---------------- */
/** 当前节序号（1 起）与全课进度（底部推进区 / 徽标用） */
const kpTotal = computed(() => Number(syllabus.value?.total) || 0)
const kpNo = computed(() => Math.min((Number(syllabus.value?.cursor) || 0) + 1, kpTotal.value || 1))
const kpDoneCount = computed(() => (syllabus.value?.kp_done || []).length)
const kpLeft = computed(() => Math.max(kpTotal.value - kpNo.value, 0))
/** 当前节所属章序号（底部推进区显示章名用；-1 = 未定位到） */
const currentChapterIndex = computed(() => {
  const syl = syllabus.value
  const chapters = syl?.chapters || []
  if (!syl || !chapters.length) return -1
  const idx = Number(syl.cursor) || 0
  let acc = 0
  for (let i = 0; i < chapters.length; i++) {
    acc += chapters[i].count || 0
    if (idx < acc) return i
  }
  return chapters.length - 1
})
/** 本章进度：已掌握节数 / 本章节数（章头显示） */
function chapterStats(ci) {
  const items = chapterItems(syllabus.value, ci)
  const done = items.filter((it) => kpStatusOf(syllabus.value, it.i) === 'done').length
  return { done, total: items.length }
}
/** 批改卡分层折叠：错因 + 逐选项默认展开，评分点/步骤默认收起 */
const diagOpen = ref(true)
const optsOpen = ref(true)
const pointsOpen = ref(false)
/** 讲义正文：只有真的溢出才显示「卡内滚动」提示（纯 CSS 判断不了） */
const kpBodyEl = ref(null)
const kpOverflow = ref(false)
async function measureKpOverflow() {
  await nextTick()
  const el = kpBodyEl.value
  kpOverflow.value = !!el && el.scrollHeight > el.clientHeight + 4
}
watch([lecture, kp], () => { measureKpOverflow() })
onMounted(() => { window.addEventListener('resize', measureKpOverflow) })
onUnmounted(() => { window.removeEventListener('resize', measureKpOverflow) })

/* ---------------- 两级大纲工具（2026-10-10 章节化） ---------------- */
/** 章内小节列表（带全局索引）：[{i, name, brief}] */
function chapterItems(syl, ci) {
  const items = syl?.items || []
  const chapters = syl?.chapters || []
  const start = (chapters.slice(0, ci) || []).reduce((a, c) => a + (c.count || 0), 0)
  const n = chapters[ci]?.count || 0
  return items.slice(start, start + n).map((it, k) => ({ i: start + k, ...it }))
}
/** 章起始小节全局索引 */
function chapterStart(syl, ci) {
  return (syl?.chapters || []).slice(0, ci).reduce((a, c) => a + (c.count || 0), 0)
}
function toggleCh(ci) {
  chOpen.value = { ...chOpen.value, [ci]: chOpen.value[ci] === false }
}
/** 单元测试是否答完至少一题 */
const unitAnswered = computed(() =>
  (unitAnswers.value || []).some((a) => (a && (a.choice || (a.text || '').trim()))))
const unitTone = computed(() => {
  const s = chEnd.value?.result?.score ?? 0
  return s >= 80 ? 'ok' : (s >= 50 ? 'warn' : 'bad')
})

/* ---------------- 数据加载 ---------------- */
async function loadList() {
  if (!getToken()) return
  try {
    const r = await api.teachSyllabi()
    syllabi.value = r.list || []
  } catch (e) {
    /* 静默：列表拉不到不影响开课 */
  }
}

onMounted(async () => {
  await loadList()
  // 进页自动恢复教学态（2026-10-10 用户拍板）：有「学过至少一节」的进行中课程
  // 直接回到最近学的那节，免点「继续上次」；纯新课（没学过任何节）留在开课面板
  const resume = syllabi.value.find(
    (s) => !s.archived && !s.done && s.total && (s.kp_started || []).length > 0)
  if (resume) {
    await openCourse(resume)
  } else {
    speak('选一门课，我们一节一节来。')
  }
  // 开课面板的老师小头像先加载（选人时就要看到）
  if (typeof Image !== 'undefined') {
    TEACHERS.forEach((t) => { const im = new Image(); im.src = teacherArt(t.id, 'default') })
  }
})

function speak(text) {
  bubble.value = text
}

/** 切换立绘表情；autoBack 毫秒后自动回待机（默认 7s），避免一直绷着表情 */
let faceTimer = null
function setFace(f, autoBack = 7000) {
  face.value = f
  if (faceTimer) clearTimeout(faceTimer)
  if (autoBack) faceTimer = setTimeout(() => { face.value = 'idle' }, autoBack)
}

/** 预加载当前老师的 4 档立绘，避免切表情时闪一下 */
function preloadArt(id) {
  if (typeof Image === 'undefined') return
  TEACHER_FACES.forEach((f) => { const im = new Image(); im.src = teacherArt(id, f) })
}

function pickCourse(c) {
  // 预设学科（无课程表数据时的推荐）：只填入输入框，不当作 course_id 提交
  if (c && c.preset) {
    draftCourse.value = null
    draftSubject.value = c.name
    return
  }
  draftCourse.value = c
  draftSubject.value = c.name
}

/* ---------------- 开课 ---------------- */
async function createCourse() {
  const subject = (draftSubject.value || '').trim()
  if (!subject) {
    toast('先选或输入一门课')
    return
  }
  busy.value = true
  startPrep()
  try {
    const r = await api.teachSyllabus({
      subject, teacher_id: draftTeacher.value, level: draftLevel.value,
      course_id: String(draftCourse.value?.id ?? ''),  // 课程 id 是数字（nextId），后端 str 字段必须转字符串
    })
    // 2026-10-10 同名查重：后端返回已有课 → 直接回到原进度，不走新大纲确认卡
    if (r.merged) {
      pendingSyl.value = null
      toast('这门课已经有 AI 课堂了，带你回到原进度')
      await openCourse(r.syllabus)
      return
    }
    pendingSyl.value = r.syllabus
    editTitle.value = r.syllabus.title || ''
    editTeacher.value = r.syllabus.teacher_id
    toast(`已拆成 ${r.syllabus.chapters?.length || 0} 章 ${r.syllabus.total} 节，挑一节开始吧`)
  } catch (e) {
    toast(e.message || '备课失败，再试一次')
  } finally {
    stopPrep()
    busy.value = false
  }
}

/** 大纲确认视图：从选中的讲开始（0 = 按顺序从第一讲） */
async function startPick(i) {
  const s = pendingSyl.value
  if (!s || busy.value) return
  pendingSyl.value = null
  await openCourse(s, i)
}

/** 章节目录跳讲：复用原讲义（幂等不花额度），后端同步游标 */
async function jumpKp(i) {
  if (!syllabus.value || busy.value) return
  if (i === syllabus.value.cursor && lecture.value) {
    tocMOpen.value = false
    return   // 已经在这讲
  }
  tocMOpen.value = false
  await openCourse(syllabus.value, i)
}

/** 目录行状态（✓ 已掌握 / ▶ 当前 / ● 学过 / ○ 未学） */
function kpMark(i) {
  const st = kpStatusOf(syllabus.value, i)
  return { done: '✓', cur: '▶', started: '●', todo: '○' }[st] || '○'
}

function startPrep() {
  prepIdx.value = 0
  prepTimer = setInterval(() => {
    prepIdx.value = Math.min(prepIdx.value + 1, prepSteps.length - 1)
  }, 6000)
}

function stopPrep() {
  if (prepTimer) clearInterval(prepTimer)
  prepTimer = null
}

/* ---------------- 开讲 / 继续 ---------------- */
async function openCourse(s, kpIndex = -1) {
  if (!s) return
  busy.value = true
  startPrep()
  rescueStop()
  streamingText.value = ''
  try {
    /* 讲义走字段级流式：逐字段冒字，结束后再切结构化渲染 */
    let result = null
    let streamErr = ''
    await api.teachStream({
      syllabus_id: s.id, kp_index: kpIndex, minutes: 0,
    }, {
      onEvent: (ev) => {
        if (ev.delta) {
          streamingText.value += ev.delta
        } else if (ev.done) {
          result = ev
        } else if (ev.error) {
          streamErr = ev.error
        }
      },
    })
    if (streamErr) throw new Error(streamErr)
    if (!result) throw new Error('讲义生成失败，再试一次吧')
    const r = result
    syllabus.value = r.syllabus || syllabus.value
    editTitle.value = syllabus.value.title || ''
    editTeacher.value = syllabus.value.teacher_id
    preloadArt(teacher.value.id)     // 预加载当前老师的 4 档立绘，切表情不闪
    sessionId.value = r.session_id
    state.value = r.state
    lecture.value = r.lecture
    grade.value = r.grade && r.grade.verdict ? r.grade : null
    reveal.value = null
    chosen.value = ''
    textAnswer.value = ''
    removeShot()                   // 换节清掉上一题的作答照片
    askLog.value = r.ask_log || [] // 常驻对话栏：恢复这节的历史问答
    wrongSaved.value = false
    exOpen.value = false           // 新节例题详解先收着
    examAnalysis.value = null
    chEnd.value = null
    setFace('talk', 9000)
    speak(kp.value.name ? `这一节我们讲「${kp.value.name}」。` : '这一节开始。')
    startedAt = Date.now()
  } catch (e) {
    if (e && e.archived) {
      toast('这是旧版课程（已升级章节模式），重新开一门吧')
      await loadList()
      syllabus.value = null
      return
    }
    toast(e.message || '这一节没开起来，再试一次')
  } finally {
    stopPrep()
    streamingText.value = ''
    busy.value = false
  }
}

function rescueStop() {
  grade.value = null
  lecture.value = null
}

/* ---------------- 拍照作答（#9）：转录填入作答框，判分管路复用文字题 ---------------- */
const shotImg = ref('')          // 作答照片缩略图（压缩 dataURL）
const transcribing = ref(false)
const cameraInput = ref(null)
const albumInput = ref(null)
let transcribeSeq = 0            // 防竞态：连拍/换图时作废旧请求返回

function onShotFile(event) {
  const file = event.target.files && event.target.files[0]
  event.target.value = ''        // 允许重复选择同一文件
  if (file) transcribeShot(file)
}

async function transcribeShot(file) {
  const r = await readImageDataUrl(file, { onError: (m) => toast.error(m) })
  if (!r) return
  const seq = ++transcribeSeq
  shotImg.value = r.dataUrl
  transcribing.value = true
  try {
    // mode=answer：按「手写作答转录」逐字转写，保留原始错误（与自测/练习同一管线）
    const data = await api.extract(r.dataUrl, r.mime, null, 'answer')
    if (seq !== transcribeSeq) return
    const text = (data && data.question) || ''
    if (!String(text).trim()) {
      toast.error('没识别到手写作答，请重拍一张，或直接输入')
      return
    }
    textAnswer.value = text      // 转录可能有误，判分前可修改
    toast.success('已识别手写作答，检查无误后点「提交作答」')
  } catch (e) {
    if (seq === transcribeSeq) toast.error((e && e.message) || '识别失败，可重试或直接输入')
  } finally {
    if (seq === transcribeSeq) transcribing.value = false
  }
}

function removeShot() {
  transcribeSeq += 1
  transcribing.value = false
  shotImg.value = ''
}

/* ---------------- 作答 ---------------- */
async function submitChoice(key) {
  if (busy.value || grade.value) return
  const payload = answerPayload(exam.value, { choice: key })
  if (!payload) return
  chosen.value = key
  await doAnswer(payload)
}

async function submitText() {
  if (busy.value || grade.value) return
  const payload = answerPayload(exam.value, { text: textAnswer.value })
  if (!payload) {
    toast('先写下你的思路或答案')
    return
  }
  await doAnswer(payload)
}

async function doAnswer(payload) {
  busy.value = true
  try {
    const r = await api.teachAnswer({ session_id: sessionId.value, ...payload })
    grade.value = r.grade || {}
    // 成就埋点：课堂测验满分（score 出满分才算）
    try {
      if (r.grade && Number(r.grade.score) >= 100) recordAction('teachQuiz')
    } catch { /* 埋点失败不影响批改展示 */ }
    state.value = r.state
    reveal.value = r.reveal || null
    wrongSaved.value = !!r.wrong_saved
    askLog.value = r.ask_log || askLog.value
    setFace(grade.value.verdict === 'correct' ? 'happy' : 'surprised', 9000)
    speak(grade.value.verdict === 'correct' ? '答对了，思路是对的。'
      : '这里有个坑，我们看看错在哪。')
    // 批改后自动拉逐选项解析（选择题）；后端缓存命中零成本，未命中生成一次
    if (exam.value.type === 'choice') {
      const cached = r.exam_analysis && r.exam_analysis.per_option ? r.exam_analysis : null
      if (cached) examAnalysis.value = cached
      else loadExamAnalysis()
    }
    // 判分结果就在这张卡上——它常渲染在视口下方，不滚过来等于没反馈（2026-10-09 评测）
    await nextTick()
    document.querySelector('.tch-card--grade')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (e) {
    toast(e.message || '批改失败，再发一次')
  } finally {
    busy.value = false
  }
}

async function loadExamAnalysis() {
  if (!sessionId.value || analysisLoading.value) return
  analysisLoading.value = true
  try {
    const r = await api.teachExamAnalysis({ session_id: sessionId.value })
    if (r.ok && r.analysis) examAnalysis.value = r.analysis
  } catch { /* 解析拉不到不拦批改结果展示 */ }
  finally { analysisLoading.value = false }
}

/* ---------------- 提问 / 推进 ---------------- */
async function send() {
  const text = (askInput.value || '').trim()
  if (!text || busy.value) return
  askInput.value = ''
  if (isConfirm(text)) {
    await goNext()
    return
  }
  busy.value = true
  try {
    const r = await api.teachAsk({ session_id: sessionId.value, question: text })
    if (r.advanced) {
      await afterNext(r)
      return
    }
    askLog.value = [...askLog.value, { q: text, a: r.reply }]
    state.value = r.state || state.value
    setFace('talk', 6000)
    speak('这点说清楚了，回头看那道题。')
    // 常驻对话栏：新问答滚到底部（移动端抽屉打开时立刻看到）
    await nextTick()
    if (chatLogEl.value) chatLogEl.value.scrollTop = chatLogEl.value.scrollHeight
    if (chatOpen.value) chatOpen.value = true
  } catch (e) {
    toast(e.message || '老师没答上来，再问一次')
  } finally {
    busy.value = false
  }
}

/** 一键推进：语义等价于发送「会了，下一个知识点」 */
let beforeNextKp = null   // 推进前 kp_done 长度（成就埋点用：增加了才算完成一节）
async function goNext() {
  if (busy.value || !canGoNext.value) return
  busy.value = true
  try {
    beforeNextKp = (syllabus.value?.kp_done || []).length
    const minutes = startedAt ? Math.min(90, Math.round((Date.now() - startedAt) / 60000)) : 0
    const r = await api.teachNext({ session_id: sessionId.value, minutes })
    await afterNext(r, minutes)
  } catch (e) {
    toast(e.message || '推进失败，再试一次')
  } finally {
    busy.value = false
  }
}

async function afterNext(r, minutes = 0) {
  // 学习记录 + 打卡（分钟数进学习时长统计）
  try {
    logLearning('teach', {
      title: kp.value.name || syllabus.value?.subject || 'AI 课堂',
      brief: (syllabus.value?.subject || '') + ' · 跟老师上课',
      questionId: `${syllabus.value?.id || ''}:${syllabus.value?.cursor ?? 0}`,
      minutes,
      correct: grade.value?.verdict === 'correct',
    })
  } catch (e) { /* 记录失败不影响上课 */ }

  // 成就埋点：确认推进一节（kp_done 相比推进前增加了才计一次）
  try {
    const before = (r.prev_kp_done != null) ? r.prev_kp_done : (beforeNextKp ?? null)
    const after = (r.kp_done || syllabus.value?.kp_done || [])
    if (Array.isArray(after) && (before == null || after.length > before.length)) {
      recordAction('teach')
    }
  } catch { /* 埋点失败不影响上课 */ }

  if (r.finished) {
    syllabus.value = r.syllabus || syllabus.value
    lecture.value = null
    grade.value = null
    state.value = 'done'
    setFace('happy', 0)
    // 结课文案分档（#7）：全学完才说「都过完了」，只学了部分就明说还剩几节
    const doneN = (syllabus.value?.kp_done || []).length
    const totalN = syllabus.value?.total || 0
    if (totalN && doneN >= totalN) {
      speak('这门课的小节都过完了，去错题本和自测里再巩固一遍吧。')
      toast('这门课学完啦')
      // 最后一章还没测的话，收尾前给一次章末测试机会（不强制）
      const chapters = syllabus.value.chapters || []
      const lastCi = chapters.length - 1
      if (syllabus.value.version >= 2 && lastCi >= 0
          && (syllabus.value.unit_tests || {})[String(lastCi)]?.state !== 'graded') {
        await openChapterEnd(lastCi)
      }
    } else {
      speak(`这一节学完了，这门课还有 ${Math.max(totalN - doneN, 0)} 节——可以从目录挑下一节继续。`)
      toast(`已确认 ${doneN} / ${totalN} 节`)
    }
    loadList()
    return
  }
  syllabus.value = r.syllabus || {
    ...syllabus.value,
    cursor: r.cursor ?? syllabus.value.cursor,
    kp_done: r.kp_done || syllabus.value.kp_done,   // 推进后目录 ✓ 同步
  }
  // #7 语义口径：答错的小节也允许确认推进，但要说清「确认≠掌握」
  const wrongMarked = !!grade.value && grade.value.verdict && grade.value.verdict !== 'correct'
  // 章末闸门（2026-10-10）：刚确认的小节是章内最后一节 → 先进章末（总结+单元测试），测完/跳过再开下一章
  const confirmed = (r.cursor ?? 0) - 1
  const chapters = syllabus.value.chapters || []
  if (syllabus.value.version >= 2 && chapters.length && confirmed >= 0 && isChapterEndIdx(confirmed)) {
    const ci = chapterOfIdx(confirmed)
    if (ci < chapters.length - 1) {
      speak(`「${chapters[ci].name}」这一章过完了，来做章末总结和单元测试吧。`)
      await openChapterEnd(ci)
      if (wrongMarked) speak('刚才答错的题已经进错题本，测试里可能还会遇到它。')
      return
    }
  }
  await openCourse(syllabus.value)
  if (wrongMarked) speak('这一节先确认过了；答错的题已经进错题本，回头记得再做一遍。')
}

/* ---------------- 章末：总结 + 单元测试（2026-10-10） ---------------- */
/** 小节全局索引 → 章号 */
function chapterOfIdx(idx) {
  const chapters = syllabus.value?.chapters || []
  let acc = 0
  for (let ci = 0; ci < chapters.length; ci++) {
    acc += chapters[ci].count || 0
    if (idx < acc) return ci
  }
  return Math.max(0, chapters.length - 1)
}
/** 全局索引是否章内最后一节 */
function isChapterEndIdx(idx) {
  const chapters = syllabus.value?.chapters || []
  let acc = 0
  for (const ch of chapters) {
    acc += ch.count || 0
    if (idx === acc - 1) return true
  }
  return false
}

async function openChapterEnd(ci) {
  if (!syllabus.value || busy.value) return
  busy.value = true
  try {
    const r = await api.teachChapter({ syllabus_id: syllabus.value.id, ch_index: ci })
    if (!r.ok) {
      toast(r.error || '章末内容没生成出来，再试一次')
      return
    }
    chEnd.value = r
    unitAnswers.value = (r.paper || []).map(() => ({ choice: '', text: '' }))
    lecture.value = null           // 章末视图替换讲义流（chat 栏保留）
    grade.value = null
    tocMOpen.value = false
    setFace('talk', 6000)
    await nextTick()
    document.querySelector('.tch-card--chend')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e) {
    toast(e.message || '章末内容没生成出来，再试一次')
  } finally {
    busy.value = false
  }
}

function pickUnit(qi, key) {
  if (busy.value) return
  unitAnswers.value[qi] = { ...(unitAnswers.value[qi] || {}), choice: key }
}

async function submitUnit() {
  if (!chEnd.value || busy.value || !unitAnswered.value) return
  busy.value = true
  try {
    const answers = (chEnd.value.paper || []).map((q, qi) => ({
      q_index: qi,
      choice: (unitAnswers.value[qi] || {}).choice || '',
      text: (unitAnswers.value[qi] || {}).text || '',
    }))
    const r = await api.teachChapterAnswer({
      syllabus_id: syllabus.value.id, ch_index: chEnd.value.ch_index, answers,
    })
    if (!r.ok) {
      toast(r.error || '批改失败，再交一次')
      return
    }
    chEnd.value = { ...chEnd.value, state: 'graded', result: r.result }
    // 同步大纲里的单元测试状态（目录 ✓）
    syllabus.value = {
      ...syllabus.value,
      unit_tests: { ...(syllabus.value.unit_tests || {}),
                     [String(chEnd.value.ch_index)]: { state: 'graded' } },
    }
    const s = r.result?.score ?? 0
    setFace(s >= 80 ? 'happy' : (s >= 50 ? 'talk' : 'surprised'), 9000)
    speak(s >= 80 ? '这一章掌握得不错。' : '有几个小节还薄弱，测试后可以回去补一补。')
    loadList()
    await nextTick()
    document.querySelector('.tch-card--chend')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e) {
    toast(e.message || '批改失败，再交一次')
  } finally {
    busy.value = false
  }
}

/** 跳过测试直接进下一章 */
function skipChapterEnd() {
  if (!chEnd.value) return
  goNextChapter()
}

function goNextChapter() {
  if (!chEnd.value || !syllabus.value) return
  const chapters = syllabus.value.chapters || []
  const nextCi = (chEnd.value.ch_index ?? 0) + 1
  chEnd.value = null
  if (nextCi >= chapters.length) {
    state.value = 'done'
    speak('最后一章也过完了，去错题本和自测里再巩固一遍吧。')
    loadList()
    return
  }
  openCourse(syllabus.value, chapterStart(syllabus.value, nextCi))
}

/** 薄弱小节回跳 */
function revisitWeak(idx) {
  if (idx == null || idx < 0 || busy.value) return
  chEnd.value = null
  openCourse(syllabus.value, idx)
}

/* ---------------- 大纲编辑 ---------------- */
function openList() {
  loadList()
  listOpen.value = true
}

/** 返回 AI 教学首页（选课/继续上次）：现场都在服务端，重进 openCourse 幂等复用不丢 */
function backToStart() {
  lecture.value = null
  chEnd.value = null
  grade.value = null
  sessionId.value = ''
  state.value = ''
  syllabus.value = null
  loadList()
  speak('选一门课，我们一节一节来。')
}

function jumpTo(i) {
  if (!syllabus.value) return
  editOpen.value = false
  openCourse(syllabus.value, i)
}

async function doEdit(action, extra = {}) {
  if (!syllabus.value || busy.value) return
  busy.value = true
  try {
    const r = await api.teachEdit({ syllabus_id: syllabus.value.id, action, ...extra })
    if (r.deleted) {
      syllabus.value = null
      lecture.value = null
      grade.value = null
      sessionId.value = ''
      editOpen.value = false
      toast('已删除这门课')
      await loadList()
      return
    }
    syllabus.value = r.syllabus
    editTitle.value = syllabus.value.title || ''
    editTeacher.value = syllabus.value.teacher_id
    editNewKp.value = ''
    // 重置 / 删点后索引可能错位 → 清掉当前讲义，让学生重新开讲
    if (action === 'reset' || action === 'del') {
      lecture.value = null
      grade.value = null
      sessionId.value = ''
      state.value = ''
    }
    toast('已更新大纲')
    await loadList()
  } catch (e) {
    toast(e.message || '操作失败')
  } finally {
    busy.value = false
  }
}

async function switchTeacher() {
  if (!syllabus.value) return
  const next = teacher.value.id === 'chenli' ? 'shentong' : 'chenli'
  await doEdit('switch_teacher', { teacher_id: next })
  toast(`换成 ${teacherOf(next).name} 了，进度保留`)
}

function removeCourse() {
  doEdit('delete')
}

/* ---------------- 弹层交互打磨（2026-10-11） ---------------- */
/** 从「我的课程」弹层进课：关弹层再进教学区 */
async function openFromList(s) {
  listOpen.value = false
  await openCourse(s)
}
/** 空态「去开一门课」：关弹层并回开课面板 */
function goCreateCourse() {
  listOpen.value = false
  backToStart()
}
/** 换老师：点选即生效（去掉容易漏点的「应用」） */
async function switchTeacherTo(id) {
  if (!syllabus.value || busy.value || id === syllabus.value.teacher_id) return
  editTeacher.value = id
  await doEdit('switch_teacher', { teacher_id: id })
}
/** 节/章行尾「⋯」菜单：同一时间只开一个，点别处收起 */
const menuKey = ref('')
function toggleMenu(key) { menuKey.value = menuKey.value === key ? '' : key }
function closeMenu() { menuKey.value = '' }
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))
/** 通用小弹层：danger 确认 or 章改名（避免再用 window.prompt / 无确认直删） */
const dlg = ref(null)
function askDlg(cfg) { dlg.value = cfg }
function askReset() {
  askDlg({
    kind: 'confirm', title: '重置学习进度？', okText: '确认重置',
    desc: `「${syllabus.value?.title || syllabus.value?.subject || '这门课'}」会回到第 1 节，已确认的小节与课堂记录会清空。`,
    warn: '此操作不可恢复；错题本里由课堂产生的错题仍会保留。',
    onOk: () => doEdit('reset'),
  })
}
function askDeleteCourse() {
  askDlg({
    kind: 'confirm', title: '删除这门课？', okText: '确认删除',
    desc: `「${syllabus.value?.title || syllabus.value?.subject || '这门课'}」的课程大纲、已学进度与课堂记录会一起删除。`,
    warn: '删除后无法恢复；错题本里由课堂产生的错题仍会保留。',
    onOk: () => removeCourse(),
  })
}
function askDeleteKp(it) {
  askDlg({
    kind: 'confirm', title: '删除这一节？', okText: '确认删除',
    desc: `「${it.name}」会从大纲里移除，后面的节序号会前移。`,
    warn: '删除后当前讲义需要重新开讲，且无法恢复。',
    onOk: () => doEdit('del', { index: it.i }),
  })
}
function askRenameChapter(ci) {
  const chapters = syllabus.value?.chapters || []
  if (!chapters[ci]) return
  askDlg({
    kind: 'rename', title: '重命名本章', okText: '保存', value: chapters[ci].name,
    onOk: (name) => doEdit('rename_ch', { ch_index: ci, name }),
  })
}
async function runDlg() {
  const d = dlg.value
  if (!d || busy.value) return
  if (d.kind === 'rename') {
    const name = String(d.value || '').trim()
    if (!name) return
    dlg.value = null
    await d.onOk(name)
    return
  }
  dlg.value = null
  await d.onOk()
}

onUnmounted(() => {
  stopPrep()
  if (faceTimer) clearTimeout(faceTimer)
})

/* 新手教程：首次进入本页自动弹（看过不再弹） */
const { tourOpen } = useTour('teacher')

</script>

<style scoped>
.teacher { padding-bottom: 48px; }

.tch__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.tch__head-ops { display: flex; gap: 8px; }
/* 顶部工具按钮（2026-10-11）：统一 32px / 圆角 10 / 图标底块；主工具（我的课）淡紫底 + 计数 */
.tch-op {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
  border-radius: 10px; border: 1px solid var(--line); background: var(--surface);
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--text-2); cursor: pointer;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.tch-op:hover { border-color: var(--primary-line, var(--brand)); transform: translateY(-1px); }
.tch-op.is-pri { background: var(--primary-soft-2, var(--brand-soft)); border-color: var(--primary-line, var(--brand)); color: var(--primary-text, var(--brand)); }
.tch-op__ic {
  width: 20px; height: 20px; border-radius: 6px; flex: none; display: grid; place-items: center;
  background: var(--primary-soft-2, var(--brand-soft)); color: var(--primary-text, var(--brand)); font-size: 11px;
}
.tch-op.is-pri .tch-op__ic { background: rgba(124, 92, 255, .18); }
.tch-op__cnt {
  font-size: 11px; font-weight: 700; color: #fff; flex: none;
  background: linear-gradient(135deg, #7c5cff, #5b47d6); border-radius: 999px; padding: 1px 7px;
}
.tch-op__meta { font-size: 11px; font-weight: 400; color: var(--text-3); }
.tch__head-main { display: flex; align-items: center; gap: 14px; }
.tch__back {
  display: inline-flex; align-items: center; gap: 5px; flex: none;
  padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; cursor: pointer;
  background: var(--surface); color: var(--text-2); font-size: 13px; font-weight: 600;
  transition: border-color .2s, color .2s, transform .2s;
}
.tch__back:hover { border-color: var(--brand); color: var(--brand); transform: translateX(-2px); }

/* ---------------- 开课面板 ---------------- */
.tch__start { display: grid; gap: 16px; }
/* 开课面板：桌面两栏（左表单 / 右我的课程），1024 以下单列（2026-10-11） */
.tch__start-grid { display: grid; gap: 16px; }
@media (min-width: 1024px) {
  .tch__start-grid { grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
}
.tch__start-card { padding: 24px; display: grid; gap: 18px; }
.tch__field { display: grid; gap: 8px; }
.tch__teachers { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
/* 选老师预览卡：小画像 + 口头禅（与教学区立绘卡同款配方） */
.tch__pv {
  display: flex; align-items: center; gap: 14px; margin-top: 10px;
  padding: 12px; border-radius: 14px; border: 1px solid var(--line);
  background:
    radial-gradient(120% 90% at 18% 20%, color-mix(in srgb, var(--tch-c) 12%, transparent), transparent 70%),
    var(--surface-2, var(--surface));
}
.tch__pv-fig {
  flex: none; width: 112px; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden;
  background: color-mix(in srgb, var(--tch-c) 16%, var(--surface));
  border: 1px solid var(--line);
}
.tch__pv-fig img { width: 100%; height: 100%; object-fit: contain; object-position: bottom center; display: block; }
.tch__pv-txt { min-width: 0; }
.tch__pv-txt b { display: flex; align-items: baseline; gap: 8px; font-size: 16px; }
.tch__pv-txt b i { font-style: normal; font-weight: 400; font-size: 12px; color: var(--text-3); }
.tch__pv-txt p { margin: 6px 0 0; font-size: 13px; line-height: 1.6; color: var(--text-2); }
.tch-pv-enter-active, .tch-pv-leave-active { transition: opacity .18s ease, transform .18s ease; }
.tch-pv-enter-from, .tch-pv-leave-to { opacity: 0; transform: translateY(4px); }
@media (max-width: 720px) { .tch__pv-fig { width: 88px; } }
.tch__tchip {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer;
  border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  transition: transform .2s cubic-bezier(.16,1,.3,1), border-color .2s, box-shadow .2s;
}
.tch__tchip:hover { transform: translateY(-2px); }
.tch__tchip.is-on { border-color: var(--brand); box-shadow: 0 6px 18px rgba(0,0,0,.08); }
.tch__tchip-avatar {
  width: 34px; height: 34px; border-radius: 10px; overflow: hidden; flex: none;
  display: grid; place-items: center;
}
.tch__tchip-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.tch__tchip-main { display: grid; gap: 2px; text-align: left; line-height: 1.3; flex: 1; min-width: 0; }
.tch__tchip-main i { font-style: normal; font-size: 12px; color: var(--text-3); }
/* 老师风格标签（2026-10-11：让两位老师的差别一眼可见） */
.tch__tchip-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.tch__tchip-tags em {
  font-style: normal; font-size: 10.5px; padding: 1px 7px; border-radius: 999px;
  color: var(--primary-text, var(--brand)); background: var(--primary-soft-2, var(--brand-soft));
  border: 0.5px solid var(--primary-line, var(--brand));
}
/* 我的课程：右栏卡片（进度 / 章节掌握小格 / 继续上课） */
.tch__mine-col { display: grid; gap: 14px; }
.tch__mine { gap: 12px; }
.tch__mine-head { display: flex; align-items: baseline; gap: 8px; }
.tch__mine-head .t-h4 { margin: 0; }
.tch__mine-all { margin-left: auto; border: 0; background: none; padding: 0; font-family: inherit;
  font-size: 12.5px; color: var(--primary-text, var(--brand)); cursor: pointer; }
.tch__ccard {
  display: grid; gap: 8px; width: 100%; text-align: left; font-family: inherit; cursor: pointer;
  padding: 14px 15px; border-radius: 14px;
  border: 0.5px solid var(--primary-line, var(--brand));
  background: linear-gradient(180deg, rgba(124, 92, 255, 0.05), rgba(124, 92, 255, 0.02)), var(--surface);
  transition: transform .2s cubic-bezier(.16,1,.3,1), border-color .2s, box-shadow .2s;
}
.tch__ccard:hover { transform: translateY(-1px); border-color: var(--brand); box-shadow: 0 6px 18px rgba(111, 87, 240, 0.12); }
.tch__ccard:disabled { opacity: .6; cursor: default; }
.tch__ccard-top { display: flex; align-items: center; gap: 7px; }
.tch__ccard-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tch__pill { flex: none; font-size: 10.5px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  color: var(--primary-text, var(--brand)); background: var(--primary-soft-2, var(--brand-soft));
  border: 0.5px solid var(--primary-line, var(--brand)); }
.tch__pill.is-gray { color: var(--text-3); background: var(--surface-unit); border-color: var(--line); }
.tch__ccard-prog { display: flex; align-items: center; gap: 9px; }
.tch__ccard-bar { flex: 1; height: 6px; border-radius: 999px; background: var(--primary-soft-2, var(--brand-soft)); overflow: hidden; }
.tch__ccard-bar i { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #9d8bf5, #5b47d6); }
.tch__ccard-pct { flex: none; font-size: 11px; font-weight: 600; color: var(--primary-text, var(--brand)); }
.tch__ccard-meta { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-3); }
.tch__ccard-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); opacity: .6; }
.tch__ccard-chaps { display: grid; gap: 6px; margin-top: 3px; padding-top: 10px;
  border-top: 0.5px dashed var(--primary-line, var(--brand)); }
.tch__ccard-chlab { font-size: 10.5px; color: var(--text-3); }
.tch__ccard-chrow { display: flex; align-items: center; gap: 8px; }
.tch__ccard-chname { flex: none; width: 96px; font-size: 11px; color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tch__cells { display: flex; gap: 3px; flex-wrap: wrap; }
.tch__cell { width: 11px; height: 11px; border-radius: 3px; display: block; background: var(--surface-unit); }
.tch__cell.is-done { background: var(--brand); }
.tch__cell.is-started { background: rgba(124, 92, 255, .42); }
.tch__cell.is-cur { background: var(--brand); box-shadow: 0 0 0 2px rgba(124, 92, 255, .22); }
.tch__ccard-legend { display: flex; gap: 12px; margin-top: 3px; font-size: 10.5px; color: var(--text-3); }
.tch__ccard-legend span { display: flex; align-items: center; gap: 4px; }
.tch__ccard-legend .tch__cell { width: 9px; height: 9px; border-radius: 2.5px; }
.tch__ccard-go { margin-top: 3px; font-size: 12.5px; font-weight: 600; color: var(--primary-text, var(--brand)); }
.tch__mine-group { margin-top: 4px; }
.tch__mine-grouprow { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 12px;
  border: 0; border-radius: 11px; background: var(--surface-recess); cursor: pointer;
  font-family: inherit; font-size: 12px; color: var(--text-3); text-align: left; }
.tch__mine-more { margin-left: auto; color: var(--primary-text, var(--brand)); }
.tch__mine-dones { display: grid; gap: 6px; margin-top: 8px; }
.tch__mine-donerow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px;
  border: 0.5px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer;
  font-family: inherit; text-align: left; }
.tch__mine-donerow:hover { border-color: var(--brand); }
.tch__mine-donerow:disabled { opacity: .6; cursor: default; }
.tch__mine-donename { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--text-1, var(--text-primary));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tch__mine-donego { flex: none; font-size: 12px; color: var(--primary-text, var(--brand)); }
/* 空态：AI 课堂怎么上（三步） */
.tch__howto-steps { display: grid; gap: 12px; }
.tch__howto-step { display: flex; gap: 11px; }
.tch__howto-no { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  font-size: 12px; font-weight: 700; color: #fff; background: var(--sc, var(--brand)); }
.tch__howto-txt b { display: block; font-size: 13px; font-weight: 600; }
.tch__howto-txt span { display: block; margin-top: 3px; font-size: 11.5px; color: var(--text-3); line-height: 1.6; }
.tch__howto-tip { margin-top: 2px; padding: 11px 13px; border-radius: 11px; font-size: 11.5px; line-height: 1.6;
  color: var(--text-2); background: var(--primary-soft-3, var(--brand-soft));
  border: 0.5px solid var(--primary-line, var(--brand)); }
.tch__courses { display: flex; gap: 8px; flex-wrap: wrap; }
.tch__cchip {
  padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface);
  cursor: pointer; font-size: 13px; color: var(--text-2);
}
.tch__cchip.is-on { border-color: var(--brand); color: var(--brand); }

/* ---------------- 教学区（≥1200px 三栏：立绘 + 讲义流 + 常驻对话栏） ---------------- */
.tch__body { display: grid; grid-template-columns: 196px minmax(0, 1fr); gap: 16px; align-items: start; }
@media (min-width: 1200px) {
  .tch__body { grid-template-columns: 196px minmax(0, 1fr) 264px; }
  .tch__composer-input, .tch__composer-ask { display: none; }   /* 桌面提问走右侧栏 */
}

.tch__stage {
  position: sticky; top: 74px; display: flex; flex-direction: column; gap: 9px; align-items: center;
  padding: 14px 12px; border-radius: 16px; border: 1px solid var(--line);
  background: var(--glass, var(--surface));
  min-width: 0; overflow: hidden;   /* 2026-10-11：目录内容不得顶出左栏 */
}
/* ---------------- 立绘区（3:4 竖版卡，四档表情） ---------------- */
.tch__figure {
  position: relative; width: 146px; aspect-ratio: 3 / 4; border-radius: 14px;
  display: grid; place-items: end center; overflow: hidden; flex: none;
  background:
    radial-gradient(120% 80% at 50% 12%, color-mix(in srgb, var(--tch-c) 14%, transparent), transparent 70%),
    var(--surface-2, var(--surface));
  border: 1px solid var(--line);
  box-shadow: inset 0 0 0 0 transparent;
  transition: box-shadow .3s ease;
}
.tch__figure-img {
  width: 100%; height: 100%; object-fit: contain; object-position: bottom center;
  animation: tch-breathe 5s ease-in-out infinite;
  transition: transform .35s cubic-bezier(.16, 1, .3, 1);
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .10));
}
.tch__figure.is-talk .tch__figure-img { transform: translateY(-3px); }
.tch__figure.is-happy .tch__figure-img { transform: translateY(-6px) scale(1.02); }
.tch__figure.is-surprised .tch__figure-img { transform: scale(1.04); }
.tch__figure.is-talk { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tch-c) 55%, transparent); }
.tch__figure.is-happy { box-shadow: inset 0 0 0 2px color-mix(in srgb, #3f9c62 70%, transparent); }
.tch__figure.is-surprised { box-shadow: inset 0 0 0 2px color-mix(in srgb, #c9743a 70%, transparent); }
@keyframes tch-breathe { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@media (prefers-reduced-motion: reduce) { .tch__figure-img { animation: none } }

.tch__who { display: grid; justify-items: center; line-height: 1.35; }
.tch__who i { font-style: normal; font-size: 12px; color: var(--text-3); }
.tch__bubble {
  margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-2);
  background: var(--surface-2, var(--surface)); border: 1px solid var(--line);
  border-radius: 12px; padding: 10px 12px;
}

.tch__stream { display: grid; gap: 14px; min-width: 0; padding-bottom: 96px; }  /* #7: 底部留出 composer 高度，滚到底不吃字 */
.tch__course { display: flex; align-items: center; gap: 10px; }
.tch__course-name { font-weight: 700; }
.tch__course-spacer { flex: 1; }

/* 卡内滚动：卡头常驻 + 正文最高一屏（2026-10-11 定稿；只有真的溢出才显示提示）
   注意：必须写成 .tch-card.tch-card--scroll —— 基础 .tch-card 规则在本文件靠后，同特异性会覆盖它 */
.tch-card.tch-card--scroll {
  padding: 0; display: flex; flex-direction: column; overflow: hidden;
  max-height: calc(100vh - 208px);
}
.tch-card__head {
  flex: none; padding: 15px 20px 11px; display: grid; gap: 7px;
  border-bottom: 1px solid var(--line); background: var(--surface);
}
.tch-card__badge {
  justify-self: start; font-size: 11px; font-weight: 600; color: var(--primary-text, var(--brand));
  background: var(--primary-soft-2, var(--brand-soft)); border: 1px solid var(--primary-line, var(--brand));
  border-radius: 999px; padding: 3px 10px;
}
.tch-card__body {
  flex: 1; min-height: 0; overflow: auto; padding: 16px 20px 18px;
  display: grid; gap: 14px; align-content: start;
}
.tch-card__more {
  flex: none; height: 24px; margin-top: -24px; pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--surface) 78%);
  display: flex; align-items: flex-end; justify-content: center;
}
.tch-card__more span { font-size: 10.5px; color: var(--text-3); padding-bottom: 2px; }
html[data-theme='dark'] .tch-card__more {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), var(--surface) 78%);
}
/* 讲义卡字段块化（仅知识点卡内生效）：左侧色条 + 同色极浅底 + 加粗彩色标签 */
.tch-card--kp .tch-field {
  border-left: 3px solid var(--fc, var(--brand));
  background: color-mix(in srgb, var(--fc, var(--brand)) 5%, transparent);
  border-radius: 0 11px 11px 0; padding: 12px 14px; gap: 7px;
}
.tch-card--kp .tch-field__label { font-size: 12.5px; font-weight: 700; color: var(--fc, var(--brand)); }
.tch-card--kp .tch-field :deep(.md), .tch-card--kp .tch-field p, .tch-card--kp .tch-field li {
  font-size: 14px; line-height: 1.72;
}

/* 考试题 + 批改 合并卡：卡头一行（标签 + 判定分） */
.tch-card--q .tch-card__head {
  padding: 0 0 4px; border-bottom: 0; display: flex; align-items: center; gap: 8px;
}
.tch-card__tag-inline { font-size: 11px; font-weight: 600; color: var(--text-3); }
.tch-qhead__sp { flex: 1; }
.tch-qhead__score { font-size: 12px; font-weight: 700; }
.tch-qhead__score.is-ok { color: #3f9c62; }
.tch-qhead__score.is-warn { color: #b98b1f; }
.tch-qhead__score.is-bad { color: #c9503a; }
.tch-qdivide { height: 0; border-top: 0.5px dashed var(--primary-line, var(--brand)); margin: 2px 0; }
.tch-opt__mine {
  margin-left: auto; flex: none; font-size: 10.5px; color: #c9503a;
  border: 0.5px solid rgba(201, 80, 58, 0.4); border-radius: 999px; padding: 1px 7px;
}
.tch-opt__mine.is-ok { color: #2f7a4d; border-color: rgba(63, 156, 98, 0.45); }

/* 批改：结论先行 + 三层折叠 */
.tch-verdict {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 13px;
  border: 1px solid var(--line); background: var(--surface-recess);
}
.tch-verdict.is-ok { background: linear-gradient(135deg, rgba(63, 156, 98, .1), rgba(63, 156, 98, .03)); border-color: rgba(63, 156, 98, .3); }
.tch-verdict.is-warn { background: linear-gradient(135deg, rgba(201, 161, 58, .12), rgba(201, 161, 58, .03)); border-color: rgba(201, 161, 58, .32); }
.tch-verdict.is-bad { background: linear-gradient(135deg, rgba(201, 80, 58, .1), rgba(201, 80, 58, .03)); border-color: rgba(201, 80, 58, .3); }
.tch-verdict__mark {
  width: 44px; height: 44px; flex: none; border-radius: 14px; display: grid; place-items: center;
  font-size: 21px; font-weight: 700; color: #fff; background: var(--brand);
}
.tch-verdict.is-ok .tch-verdict__mark { background: linear-gradient(135deg, #56ad7c, #3f9c62); }
.tch-verdict.is-warn .tch-verdict__mark { background: linear-gradient(135deg, #d5b25c, #c9a13a); }
.tch-verdict.is-bad .tch-verdict__mark { background: linear-gradient(135deg, #d76b56, #c9503a); }
.tch-verdict__txt { flex: 1; min-width: 0; }
.tch-verdict__txt b { font-size: 16px; display: block; }
.tch-verdict.is-ok .tch-verdict__txt b { color: #2f7a4d; }
.tch-verdict.is-warn .tch-verdict__txt b { color: #9a7a17; }
.tch-verdict.is-bad .tch-verdict__txt b { color: #b4402c; }
.tch-verdict__txt p { margin-top: 3px; font-size: 13px; color: var(--text-2); line-height: 1.6; }
.tch-verdict__score { flex: none; text-align: right; }
.tch-verdict__score b { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.tch-verdict.is-ok .tch-verdict__score b { color: #2f7a4d; }
.tch-verdict.is-warn .tch-verdict__score b { color: #9a7a17; }
.tch-verdict.is-bad .tch-verdict__score b { color: #b4402c; }
.tch-verdict__score i { font-style: normal; display: block; font-size: 10.5px; color: var(--text-3); }
.tch-sec { border: 1px solid var(--line); border-radius: 13px; overflow: hidden; }
.tch-sec__head {
  display: flex; align-items: center; gap: 9px; width: 100%; padding: 11px 15px;
  border: 0; background: var(--surface-recess); cursor: pointer; font-family: inherit; text-align: left;
}
.tch-sec__t { font-size: 13.5px; font-weight: 600; color: var(--text-1); }
.tch-sec__n { font-size: 11.5px; color: var(--text-3); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tch-sec__chip { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 9px; flex: none; }
.tch-sec__chip.is-warn { color: #b4402c; background: rgba(201, 80, 58, .1); border: 0.5px solid rgba(201, 80, 58, .28); }
.tch-sec__chip.is-ok { color: #2f7a4d; background: rgba(63, 156, 98, .1); border: 0.5px solid rgba(63, 156, 98, .3); }
.tch-sec__chip.is-bad { color: #b4402c; background: rgba(201, 80, 58, .1); border: 0.5px solid rgba(201, 80, 58, .28); }
.tch-sec__tg { margin-left: auto; flex: none; font-size: 12px; color: var(--primary-text, var(--brand)); }
.tch-sec__body { padding: 13px 15px; display: grid; gap: 10px; }
.tch-diag { display: flex; gap: 9px; font-size: 13.5px; line-height: 1.7; color: var(--text-2); }
.tch-diag__k { flex: none; width: 60px; font-size: 11.5px; font-weight: 700; color: #b4402c; padding-top: 2px; }
.tch-diag.is-rc .tch-diag__k { color: #c9743a; }
.tch-diag.is-ce .tch-diag__k { color: #5b6ee8; }
.tch-diag.is-dr .tch-diag__k { color: #9a7a17; width: 76px; }

/* 底部推进区：左侧进度 + 右侧主 CTA */
.tch__composer {
  display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-radius: 14px;
  background: var(--glass, var(--surface)); border: 1px solid var(--primary-line, var(--brand));
  box-shadow: 0 12px 30px -18px rgba(20, 30, 60, 0.3);
}
.tch__composer-pos { font-size: 12.5px; color: var(--text-2); white-space: nowrap; }
.tch__composer-pos b { color: var(--primary-text, var(--brand)); }
.tch__composer-bar { flex: 1; max-width: 200px; height: 5px; border-radius: 999px; background: var(--primary-soft-3, var(--brand-soft)); overflow: hidden; }
.tch__composer-bar i { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #9d8bf5, #5b47d6); transition: width .3s ease; }
.tch__composer-left { font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
.tch__composer-cta { margin-left: auto; }

/* 提问栏消息气泡（2026-10-11） */
.tch__chat-sub { font-size: 11px; color: var(--text-3); }
.tch-qa { display: grid; gap: 5px; }
.tch-qa__q {
  justify-self: end; max-width: 90%; margin: 0; font-size: 12px; color: #fff;
  background: linear-gradient(135deg, #7c5cff, #5b47d6); border-radius: 11px 11px 3px 11px; padding: 7px 10px; line-height: 1.5;
}
.tch-qa__a {
  margin: 0; font-size: 12px; color: var(--text-2); background: var(--primary-soft-3, var(--brand-soft));
  border: 1px solid var(--primary-line, var(--brand)); border-radius: 11px 11px 11px 3px; padding: 8px 10px; line-height: 1.6;
}
.tch-qa__meta { font-size: 10px; color: var(--text-3); }

.tch-card {
  position: relative; padding: 20px; border-radius: 16px; border: 1px solid var(--line);
  background: var(--surface); display: grid; gap: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,.03);
}
/* 2026-10-11：去掉各卡的左侧色条，统一四边细描边（类型靠徽标/标签区分） */
.tch-card--kp { border-color: var(--primary-line, var(--brand)); }
.tch-card--q { border-color: var(--primary-line, var(--brand)); }
.tch-card--ex, .tch-card--grade, .tch-card--chend { border-color: var(--primary-line, var(--brand)); }
.tch-card__tag {
  font-size: 12px; letter-spacing: .06em; color: var(--text-3); text-transform: uppercase;
}
.tch-card--grade.is-ok .tch-card__tag { color: #3f9c62; }
.tch-card--grade.is-warn .tch-card__tag { color: #b98b1f; }
.tch-card--grade.is-bad .tch-card__tag { color: #c9503a; }

/* 评分点逐项核查表 */
.tch-check {
  display: grid; gap: 6px; padding: 12px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--surface-2);
}
.tch-check__head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 12px; letter-spacing: .04em; color: var(--text-3);
}
.tch-check__sum { font-weight: 600; color: var(--text-2); }
.tch-check__row { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; }
.tch-check__row + .tch-check__row { border-top: 1px dashed var(--line); }
.tch-check__mark { font-size: 13px; line-height: 1.5; flex: 0 0 auto; }
.tch-check__row.is-hit .tch-check__mark { color: #3f9c62; }
.tch-check__row.is-miss .tch-check__mark { color: #c9503a; }
.tch-check__main { display: grid; gap: 4px; min-width: 0; flex: 1 1 auto; }
.tch-check__line { display: flex; gap: 10px; align-items: baseline; justify-content: space-between; }
.tch-check__pt { min-width: 0; }
.tch-check__sc { flex: 0 0 auto; font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.tch-check__row.is-miss .tch-check__pt { color: var(--text-2); }
.tch-check__ev { display: flex; gap: 6px; font-size: 12px; color: var(--text-3); }

.tch-field { display: grid; gap: 6px; }
.tch-field__label { font-size: 12px; color: var(--text-3); }
.tch-field--distract { padding: 10px 12px; border-left: 3px solid #c9a13a; background: color-mix(in srgb, #c9a13a 8%, transparent); border-radius: 0 10px 10px 0; }
.tch-field--distract .tch-field__label { color: #b98b1f; font-weight: 600; }
.tch-list { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.tch-list--sym li { display: flex; gap: 8px; }
.tch-list--sym b { min-width: 44px; color: var(--brand); }

.tch-ex__body { display: grid; gap: 12px; animation: tch-in .35s ease both; }
@keyframes tch-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
.tch-steps { margin: 0; padding-left: 20px; display: grid; gap: 12px; }
.tch-steps__title { font-weight: 600; }
.tch-steps__detail { color: var(--text-2); }
.tch-steps__basis {
  display: inline-block; margin-top: 4px; font-size: 12px; color: var(--brand);
  background: color-mix(in srgb, var(--brand) 10%, transparent); border-radius: 6px; padding: 2px 8px;
}
.tch-ex__answer { display: flex; gap: 8px; align-items: baseline; }

.tch-options { display: grid; gap: 8px; }
.tch-opt {
  display: flex; gap: 10px; align-items: flex-start; text-align: left; cursor: pointer;
  padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
  transition: transform .18s cubic-bezier(.16,1,.3,1), border-color .2s, background .2s;
}
.tch-opt:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--brand); }
.tch-opt:disabled { cursor: default; }
.tch-opt__key {
  width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; flex: none;
  background: var(--surface-2, #f2f3f5); font-size: 12px; font-weight: 700;
}
.tch-opt.is-chosen { border-color: var(--brand); }
.tch-opt.is-right { border-color: #3f9c62; background: color-mix(in srgb, #3f9c62 8%, transparent); }
.tch-opt.is-right .tch-opt__key { background: #3f9c62; color: #fff; }
.tch-opt.is-wrong { border-color: #c9503a; background: color-mix(in srgb, #c9503a 8%, transparent); }
.tch-opt.is-wrong .tch-opt__key { background: #c9503a; color: #fff; }

.tch-answer { display: grid; gap: 10px; justify-items: start; }
.tch-grade__comment { margin: 0; }
.tch-grade__saved { margin: 0; font-size: 12px; color: var(--brand); }

.tch-qa { display: grid; gap: 6px; }
.tch-qa__q { margin: 0; color: var(--text-3); font-size: 13px; }
.tch-qa__a { margin: 0; color: var(--text-2); }

.tch__composer {
  display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;
  padding: 14px; border-radius: 16px; border: 1px solid var(--line); background: var(--glass, var(--surface));
  position: sticky; bottom: 12px; backdrop-filter: blur(10px);
}
.tch__hint { margin: 0; }
.tch-shot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tch-shot__thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); }
.tch-card--skeleton { place-items: center; }
/* 讲义流式：正在写出的正文（左对齐、可滚动，替换骨架） */
.tch-card--skeleton:has(.tch__stream-text) { place-items: stretch; }
.tch__stream-hint {
  margin: 0 0 var(--sp-2);
  color: var(--primary-text);
}
.tch__stream-text {
  margin: 0;
  max-height: 46vh;
  overflow-y: auto;
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

/* ---------------- 移动端 ---------------- */
@media (max-width: 860px) {
  .tch__body { grid-template-columns: 1fr; }
  .tch__stage {
    position: static; flex-direction: row; display: flex; align-items: center; gap: 12px;
    padding: 12px; justify-items: start;
  }
  .tch__figure { width: 96px; border-radius: 12px; }
  .tch__who { justify-items: start; }
  .tch__bubble { display: none; }
  .tch__toc { display: none; }          /* 移动端左栏不放目录，走弹层 */
  .tch__composer { grid-template-columns: 1fr; }
  .tch__stream { padding-bottom: 150px; }   /* 移动端 composer 竖排更高 */
}
@media (min-width: 861px) {
  .tch__toc-btn { display: none; }
}

/* ---------------- 大纲确认（开课后先挑起始节，2026-10-10 两级树） ---------------- */
.tch__pick-tree { display: grid; gap: 14px; }
.tch__pick-ch { border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; background: var(--surface-2, var(--surface)); }
.tch__pick-chhead {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 4px 2px;
  border: 0; background: transparent; cursor: pointer; text-align: left;
  font-size: 15px; font-weight: 700; color: var(--text-1);
}
.tch__pick-chhead:hover .tch__pick-chgo { opacity: 1; }
.tch__pick-chname { min-width: 0; }
.tch__pick-chgo { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--brand); opacity: 0; transition: opacity .2s; }
.tch__pick-chbrief { margin: 2px 0 0; font-size: 12px; color: var(--text-3); }
.tch__pick { list-style: none; margin: 10px 0 4px; padding: 0; display: grid; gap: 8px; }
.tch__pick-row {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
  cursor: pointer; text-align: left; transition: border-color .2s, transform .2s, box-shadow .2s;
}
.tch__pick-row:hover { border-color: var(--brand); transform: translateX(3px); box-shadow: 0 4px 14px rgba(0,0,0,.06); }
.tch__pick-idx {
  flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
  background: color-mix(in srgb, var(--brand) 12%, transparent); color: var(--brand);
  font-size: 13px; font-weight: 700;
}
.tch__pick-main { min-width: 0; display: grid; gap: 2px; }
.tch__pick-main b { font-size: 14px; }
.tch__pick-main i { font-style: normal; font-size: 12px; color: var(--text-3); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.tch__pick-go { margin-left: auto; flex: none; font-size: 12px; color: var(--brand); opacity: 0; transition: opacity .2s; }
.tch__pick-row:hover .tch__pick-go { opacity: 1; }
.tch__pick-ops { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }

/* ---------------- 章节目录（左栏常驻 + 移动端弹层，2026-10-10 两级树） ---------------- */
/* 课程目录（2026-10-11 打磨：全课进度条 + 章进度点 + 换行防溢出 + 状态图例） */
.tch__toc {
  width: 100%; min-width: 0; margin-top: 2px; padding-top: 9px;
  border-top: 1px solid var(--line);
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px;
}
.tch__toc-top {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--text-3);
}
.tch__toc-switch {
  margin-left: auto; border: 0; background: none; padding: 0; font-family: inherit;
  font-size: 11.5px; color: var(--primary-text, var(--brand)); cursor: pointer;
}
.tch__toc-bar { height: 4px; border-radius: 999px; background: var(--primary-soft-3, var(--brand-soft)); overflow: hidden; }
.tch__toc-bar i { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #9d8bf5, #5b47d6); transition: width .3s ease; }
.tch__toc-stat { font-size: 10.5px; color: var(--text-3); }
.tch__toc-head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 2px 0 0;
  background: transparent; border: 0; cursor: pointer; font-size: 11.5px; color: var(--text-3);
}
.tch__toc-head b { margin-left: auto; font-weight: 400; }
.tch__toc-tree {
  min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px;
  max-height: calc(100vh - 620px); min-height: 132px; overflow: auto;
}
.tch__toc-ch { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; }
.tch__toc-chhead {
  display: flex; align-items: flex-start; gap: 6px; width: 100%; margin-top: 5px;
  padding: 6px 8px; border: 0; border-radius: 8px; background: var(--surface-recess);
  cursor: pointer; text-align: left; font-size: 11.5px; font-weight: 700; color: var(--text-1);
  min-width: 0;
}
.tch__toc-chname {
  flex: 1; min-width: 0; overflow: hidden; overflow-wrap: anywhere; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.tch__toc-chdots { display: flex; flex-wrap: wrap; gap: 2px; flex: none; padding-top: 4px; max-width: 60px; justify-content: flex-end; }
.tch__toc-chdots i { width: 5px; height: 5px; border-radius: 999px; background: var(--surface-unit); display: block; }
.tch__toc-chdots i.is-done { background: var(--brand); }
.tch__toc-chcm { flex: none; font-size: 10px; font-weight: 400; color: var(--text-3); padding-top: 2px; }
.tch__toc-chhead b { flex: none; font-weight: 400; color: var(--text-3); font-size: 11px; padding-top: 2px; }
.tch__toc-legend {
  display: flex; flex-wrap: wrap; gap: 6px; padding-top: 7px;
  border-top: 0.5px dashed var(--line); font-size: 10px; color: var(--text-3);
}
.tch__toc-row--chend { color: var(--text-3); font-style: normal; }
.tch__toc-row--chend .tch__toc-mark { color: #7a6bd0; }
.tch__toc-row--chend.is-done .tch__toc-mark { color: #3f9c62; }
.tch__toc-list {
  list-style: none; margin: 0; padding: 0 4px 6px; display: grid;
  grid-template-columns: minmax(0, 1fr); gap: 2px;
}
.tch__toc-row {
  display: flex; align-items: flex-start; gap: 6px; width: 100%; padding: 6px 8px;
  border: 0; border-radius: 9px; background: transparent; cursor: pointer;
  font-size: 12px; color: var(--text-2); text-align: left; transition: background .15s, color .15s;
  min-width: 0;
}
.tch__toc-row:hover:not(:disabled) { background: color-mix(in srgb, var(--brand) 8%, transparent); color: var(--text-1); }
.tch__toc-row:disabled { opacity: .55; cursor: wait; }
.tch__toc-idx { flex: none; width: 22px; font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; padding-top: 1px; }
/* 长名字换行最多 2 行（不再单行省略号），并允许在任意位置断行避免溢出 */
.tch__toc-name {
  flex: 1; min-width: 0; overflow: hidden; overflow-wrap: anywhere; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.tch__toc-mark { margin-left: auto; flex: none; font-size: 12px; padding-top: 1px; }
.tch__toc-row.is-done .tch__toc-mark { color: #3f9c62; }
.tch__toc-row.is-done .tch__toc-name { color: var(--text-3); }
.tch__toc-row.is-cur { background: color-mix(in srgb, var(--brand) 10%, transparent); color: var(--text-1); font-weight: 600; }
.tch__toc-row.is-cur .tch__toc-mark { color: var(--brand); }
.tch__toc-row.is-started .tch__toc-mark { color: #c99a3a; }

/* 移动端弹层目录 */
.tch-toc-m { display: grid; gap: 10px; }
.tch-toc-m__hint { margin: 0; color: var(--text-3); }
.tch-toc-m__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-height: 52vh; overflow: auto; }
.tch-toc-m__list .tch__toc-row { padding: 10px 10px; border: 1px solid var(--line); border-radius: 11px; }
.tch-edit__mark { flex: none; width: 16px; text-align: center; font-size: 12px; }
.tch-edit__mark.is-done { color: #3f9c62; }
.tch-edit__mark.is-cur { color: var(--brand); }

/* ---------------- 弹层打磨（2026-10-11）：我的课程 / 大纲 / 小确认框 ---------------- */
/* 我的课程弹层 */
.tch-mm { display: grid; gap: 10px; }
.tch-mm__sub { font-size: 12px; color: var(--text-3); }
.tch-mm__grp {
  display: flex; align-items: center; gap: 8px; margin-top: 4px;
  font-size: 12.5px; font-weight: 600; color: var(--text-3);
}
.tch-mm__grp span { font-weight: 400; color: var(--text-3); opacity: .8; }
.tch__ccard.is-wide { width: 100%; }
.tch-mm__done {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
  font-family: inherit; cursor: pointer; text-align: left;
}
.tch-mm__done:hover { border-color: var(--primary-line, var(--brand)); }
.tch-mm__done b { font-size: 12.5px; font-weight: 600; }
.tch-mm__donego { margin-left: auto; font-size: 12px; color: var(--primary-text, var(--brand)); }
.tch-mm__empty { display: grid; justify-items: center; gap: 10px; padding: 22px 10px 10px; text-align: center; }
.tch-mm__ico {
  width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center;
  background: var(--primary-soft-3, var(--brand-soft)); border: 0.5px dashed var(--primary-line, var(--brand));
  color: var(--primary-text, var(--brand));
}
.tch-mm__empty p { font-size: 12.5px; color: var(--text-3); line-height: 1.7; }

/* 大纲弹层：分区 + ⋯ 菜单 + 危险区 */
.tch-edit { display: grid; gap: 14px; }
.tch-edit__sub { font-size: 12px; color: var(--text-3); }
.tch-edit__sec { border: 1px solid var(--line); border-radius: 14px; overflow: visible; }
.tch-edit__sech {
  display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap;
  padding: 11px 16px; background: var(--surface-recess); border-radius: 14px 14px 0 0;
}
.tch-edit__sech b { font-size: 13.5px; font-weight: 600; }
.tch-edit__sech span { font-size: 11.5px; color: var(--text-3); }
.tch-edit__tg { margin-left: auto; color: var(--primary-text, var(--brand)); }
.tch-edit__secb { padding: 14px 16px; display: grid; gap: 12px; }
.tch-edit__row { display: flex; align-items: flex-end; gap: 10px; }
.tch-edit__row > :first-child { flex: 1; min-width: 0; }
.tch-edit__dgrhint { font-size: 11.5px; color: var(--text-3); margin-left: auto; }
.tch-edit__sec.is-danger { border-color: rgba(201, 80, 58, .3); }
.tch-edit__sec.is-danger .tch-edit__sech { background: rgba(201, 80, 58, .05); }
.tch-edit__sec.is-danger .tch-edit__sech b { color: #c9503a; }
.tch-dgr {
  padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(201, 80, 58, .35);
  background: rgba(201, 80, 58, .05); color: #c9503a; font-family: inherit; font-size: 12.5px;
  font-weight: 600; cursor: pointer; flex: none;
}
.tch-dgr:hover:not(:disabled) { background: rgba(201, 80, 58, .1); }
.tch-dgr:disabled { opacity: .5; cursor: default; }
/* 老师选择卡（点选即生效） */
.tch-teacher-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.tch-tpick {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 13px;
  border: 1px solid var(--line); background: var(--surface); cursor: pointer; font-family: inherit; text-align: left;
}
.tch-tpick:hover:not(:disabled) { border-color: var(--primary-line, var(--brand)); }
.tch-tpick.is-on { border-color: var(--primary-line, var(--brand)); background: var(--primary-soft-3, var(--brand-soft)); }
.tch-tpick:disabled { opacity: .6; cursor: default; }
.tch-tpick img { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; object-position: top center; flex: none; }
.tch-tpick b { display: block; font-size: 13px; }
.tch-tpick i { font-style: normal; font-size: 11px; color: var(--text-3); }
.tch-tpick__tick { margin-left: auto; color: var(--primary-text, var(--brand)); font-weight: 700; }
/* 行尾「⋯」菜单 */
.tch-kebab {
  flex: none; width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center;
  border: 1px solid transparent; background: none; color: var(--text-3); cursor: pointer;
  font-size: 14px; line-height: 1; letter-spacing: 1px;
}
.tch-kebab:hover, .tch-kebab.is-on { border-color: var(--line); background: var(--surface); color: var(--text-2); }
.tch-menu {
  position: absolute; right: 8px; top: 30px; z-index: 5; min-width: 132px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 12px 30px -12px rgba(20, 30, 60, .32); overflow: hidden;
}
.tch-menu button {
  display: block; width: 100%; padding: 9px 12px; border: 0; background: none; cursor: pointer;
  font-family: inherit; font-size: 12.5px; color: var(--text-2); text-align: left;
}
.tch-menu button:hover { background: var(--primary-soft-3, var(--brand-soft)); }
.tch-menu button.is-danger { color: #c9503a; }
.tch-menu button.is-danger:hover { background: rgba(201, 80, 58, .07); }
.tch-edit__chcm { flex: none; font-size: 10px; color: var(--text-3); }
/* 小确认 / 改名弹层 */
.tch-dlg { display: grid; gap: 10px; }
.tch-dlg__desc { font-size: 13px; color: var(--text-2); line-height: 1.7; }
.tch-dlg__warn {
  font-size: 12px; color: #8f3a2b; line-height: 1.7;
  background: rgba(201, 80, 58, .07); border: 1px solid rgba(201, 80, 58, .22);
  border-radius: 10px; padding: 9px 11px;
}
.tch-dlg__ops { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.tch-btn-dgr {
  padding: 9px 18px; border-radius: 10px; border: 0; color: #fff; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  background: linear-gradient(135deg, #d76b56, #c9503a);
}
.tch-btn-dgr:disabled { opacity: .6; cursor: default; }
.tch-btn-pri {
  padding: 9px 18px; border-radius: 10px; border: 0; color: #fff; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
}
.tch-btn-pri:disabled { opacity: .6; cursor: default; }
.tch-edit__ch, .tch-edit__list li { position: relative; }

/* ---------------- 2026-10-10 章节化：例题折叠 / 逐项解析 / 章末 / 对话栏 ---------------- */
/* 例题折叠开关 */
.tch-ex__toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
  padding: 10px 12px; border: 1px dashed var(--line); border-radius: 10px; cursor: pointer;
  background: var(--surface-2, var(--surface)); color: var(--brand); font-size: 13px; font-weight: 600;
  transition: border-color .2s, background .2s;
}
.tch-ex__toggle:hover { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 6%, transparent); }
.tch-ex__toggle i { font-style: normal; transition: transform .2s; }
.tch-ex__toggle i.up { transform: rotate(180deg); }
.tch-field--analysis {
  padding: 10px 12px; border-left: 3px solid #7a6bd0; border-radius: 0 10px 10px 0;
  background: color-mix(in srgb, #7a6bd0 7%, transparent);
}
.tch-field--analysis .tch-field__label { color: #7a6bd0; font-weight: 600; }

/* 逐选项解析 */
.tch-check--opts .tch-check__mark {
  width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center;
  background: var(--surface-2, #f2f3f5); font-size: 12px; font-weight: 700; flex: none;
}
.tch-check__ev b.is-right { color: #3f9c62; margin-right: 6px; font-size: 12px; }
.tch-check__ev b.is-wrong { color: #c9503a; margin-right: 6px; font-size: 12px; }

/* 章末面板 */
.tch-card--chend { border-left: 3px solid #7a6bd0; }
.tch-list--chend li { display: grid; gap: 2px; }
.tch-list--chend b { font-size: 13px; }
.tch-chend__pit { font-size: 12px; color: var(--text-3); }
.tch-chq { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2, var(--surface)); }
.tch-chq__head { display: flex; align-items: center; gap: 8px; }
.tch-chq__idx {
  flex: none; width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center;
  background: color-mix(in srgb, #7a6bd0 12%, transparent); color: #7a6bd0; font-size: 12px; font-weight: 700;
}
.tch-chq__from { font-size: 12px; color: var(--text-3); }
.tch-chend__ops { display: flex; gap: 10px; flex-wrap: wrap; }
.tch-chend__score { display: flex; align-items: baseline; gap: 4px; font-size: 14px; }
.tch-chend__score b { font-size: 34px; font-variant-numeric: tabular-nums; }
.tch-chend__score.is-ok b { color: #3f9c62; }
.tch-chend__score.is-warn b { color: #b98b1f; }
.tch-chend__score.is-bad b { color: #c9503a; }
.tch-chend__weak { display: flex; gap: 8px; flex-wrap: wrap; }
.tch-chend__wbtn {
  padding: 7px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface);
  cursor: pointer; font-size: 12px; color: var(--text-2); transition: border-color .2s, color .2s;
}
.tch-chend__wbtn:hover { border-color: var(--brand); color: var(--brand); }
.t-chend__advice { margin: 0; font-size: 13px; color: var(--text-2); }

/* 常驻对话栏：桌面右栏 / 移动底部抽屉。
 * 桌面端固定视口高度（2026-10-10 用户拍板：顶到底撑满）——无 height 时 grid 1fr 行
 * 只剩内容高，消息区缩成小口子；固定高后消息区吃满中间，发送栏恒在底部。 */
.tch__chat {
  display: none; position: sticky; top: 76px; height: calc(100vh - 100px);
  border: 1px solid var(--line); border-radius: 16px; background: var(--glass, var(--surface));
  grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden;
}
.tch__chat-tab { display: none; }
.tch__chat-head {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center;
  gap: 2px 8px; padding: 10px 14px; border-bottom: 1px solid var(--line); font-size: 13px;
}
.tch__chat-head b { min-width: 0; }
.tch__chat-sub { grid-column: 1 / -1; font-size: 11px; color: var(--text-3); }
.tch__chat-close { display: none; }
.tch__chat-log { overflow: auto; padding: 12px; display: grid; gap: 12px; align-content: start; }
.tch__chat-input { display: flex; gap: 8px; align-items: center; padding: 10px; border-top: 1px solid var(--line); }
@media (min-width: 1200px) {
  .tch__chat { display: grid; }
}
@media (max-width: 1199px) {
  /* 移动端：抽屉收起时只剩悬浮按钮 */
  .tch__chat {
    position: fixed; left: 12px; right: 12px; bottom: 0; top: auto; z-index: 60;
    display: none; grid-template-rows: auto minmax(0, 1fr) auto;
    max-height: 62vh; border-radius: 16px 16px 0 0; background: var(--surface);
    box-shadow: 0 -8px 32px rgba(0,0,0,.16);
  }
  .tch__chat.is-open { display: grid; }
  .tch__chat-tab {
    display: inline-flex; align-items: center; gap: 6px; position: fixed; right: 14px; bottom: 84px; z-index: 61;
    padding: 9px 14px; border: 1px solid var(--line); border-radius: 999px; cursor: pointer;
    background: var(--surface); color: var(--brand); font-size: 13px; font-weight: 600;
    box-shadow: 0 6px 18px rgba(0,0,0,.12);
  }
  .tch__chat-close { display: inline-block; border: 0; background: transparent; font-size: 18px; cursor: pointer; color: var(--text-3); padding: 0 4px; }
}

/* 归档课程行 */

/* 编辑页两级树 */
.tch-edit__tree { display: grid; gap: 10px; }
.tch-edit__ch { border: 1px solid var(--line); border-radius: 12px; padding: 0; overflow: visible; }
.tch-edit__chrow {
  display: flex; align-items: center; gap: 8px; padding: 9px 10px 8px;
  background: var(--surface-recess); border-radius: 12px 12px 0 0;
}
.tch-edit__chname { flex: 1; min-width: 0; font-weight: 600; font-size: 12.5px; }
.tch-edit__list { list-style: none; margin: 0; padding: 0 4px 6px; display: grid; }
.tch-edit__list li {
  display: flex; align-items: center; gap: 8px; padding: 7px 6px;
  font-size: 12.5px; color: var(--text-2); border-top: 0.5px solid var(--border-divider-soft);
}
.tch-edit__list li.is-cur { background: var(--primary-soft-3, var(--brand-soft)); border-radius: 9px; }
.tch-edit__list li.is-cur .tch-edit__name, .tch-edit__list li.is-cur .tch-edit__idx { color: var(--primary-text, var(--brand)); font-weight: 600; }
.tch-edit__idx { flex: none; width: 20px; text-align: right; font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.tch-edit__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tch-toc-m__tree .tch__toc-list { padding: 0 0 6px; }
.tch-toc-m__tree .tch__toc-row { padding: 9px 10px; border-radius: 10px; }
</style>
