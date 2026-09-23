const BASE = import.meta.env.VITE_API_BASE || ''

async function post(path, body, timeoutMs = 180000, outerSignal = null) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onOuterAbort = () => ctrl.abort()
  if (outerSignal) {
    if (outerSignal.aborted) ctrl.abort()
    else outerSignal.addEventListener('abort', onOuterAbort)
  }
  try {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '请求失败')
    return data
  } catch (e) {
    // 把浏览器/网络层的英文错误换成用户能看懂的中文：
    // 各页面直接展示 e.message，集中在这里转换避免每处重复判断。
    if (e && e.name === 'AbortError') {
      if (outerSignal && outerSignal.aborted) throw e // 用户主动取消，交给调用方处理
      throw new Error('请求超时：服务响应较慢，请重试')
    }
    if (e instanceof TypeError) throw new Error('网络连接失败：请检查网络后重试')
    if (e instanceof SyntaxError) throw new Error('服务返回异常：请稍后重试')
    throw e
  } finally {
    clearTimeout(timer)
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * 流式 POST（SSE）：EventSource 不支持 POST，用 fetch + ReadableStream 手解 `data: {json}\n\n` 帧。
 * handlers: { onDelta(text), onDone(), signal, timeoutMs }
 */
async function streamPost(path, body, { onDelta, onDone, onEvent, signal, timeoutMs = 300000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onOuterAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onOuterAbort)
  }
  try {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok || !res.body) throw new Error(`请求失败（HTTP ${res.status}）`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buf = ''
    let finished = false
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const frames = buf.split('\n\n')
      buf = frames.pop() || ''
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        let evt
        try {
          evt = JSON.parse(line.slice(5).trim())
        } catch {
          continue
        }
        onEvent && onEvent(evt)
        if (evt.error) throw new Error(evt.error)
        if (evt.delta) onDelta && onDelta(evt.delta)
        if (evt.done) {
          finished = true
          onDone && onDone()
        }
      }
    }
    if (!finished) onDone && onDone() // 服务端没发 done（连接提前结束）也视为结束
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onOuterAbort)
  }
}

export const api = {
  // 识别：长图分段识别可能耗时较久，给 300s；extract 支持传入外部 AbortSignal 中断。
  // mode: 'question' 提取题目（默认）；'answer' 逐字转录学生手写作答（自测批改用）
  extract: (image_base64, mime, signal, mode = 'question') =>
    post('/api/extract', { image_base64, mime, mode }, 300000, signal).then((d) => d.data),
  explain: (question, attempt, depth = 'standard') =>
    post('/api/explain', { question, attempt, depth }, 180000).then((d) => d.data),
  // 批次3：结构化讲解的流式版本（服务端做增量 JSON 字段解析）
  explainStream: (payload, handlers) => streamPost('/api/explain/stream', payload, handlers),
  // 批次4：错题本聚合摘要 → 学情建议（服务端 24h 缓存）
  analyze: (payload) => post('/api/analyze/errorbook', payload, 180000),
  judge: (question, reference, user_answer, steps = [], key_breakthrough = '', knowledge_points = []) =>
    post('/api/judge', { question, reference, user_answer, steps, key_breakthrough, knowledge_points }, 180000).then((d) => d.data),

  // 账号
  account: {
    register: (nickname, password, passwordConfirm, clientId) =>
      post('/api/account/register', { nickname, password, password_confirm: passwordConfirm, client_id: clientId }, 15000),
    login: (nickname, password) => post('/api/account/login', { nickname, password }, 15000),
    verify: (token) => post('/api/account/verify', { token }, 15000),
    changePassword: (token, oldPassword, newPassword, passwordConfirm) =>
      post('/api/account/change-password', { token, old_password: oldPassword, new_password: newPassword, password_confirm: passwordConfirm }, 15000),
    recover: (nickname, backupCode, newPassword, passwordConfirm) =>
      post('/api/account/recover', { nickname, backup_code: backupCode, new_password: newPassword, password_confirm: passwordConfirm }, 15000),
    // 个人主页
    profile: (token) => post('/api/account/profile', { token }, 15000),
    saveProfile: (token, profile) => post('/api/account/profile/save', { token, profile }, 20000),
    rename: (token, password, newNickname) =>
      post('/api/account/rename', { token, password, new_nickname: newNickname }, 15000),
    deleteAccount: (token, password) => post('/api/account/delete', { token, password }, 15000),
    resetBackup: (token, password) => post('/api/account/reset-backup', { token, password }, 15000),
  },

  // 意见反馈
  feedback: (token, content, contact = '', version = '') =>
    post('/api/feedback', { token, content, contact, version }, 15000),

  // 错题本云同步（顺带同步打卡/成就统计）
  sync: {
    push: (token, items, stats, courses, sessions, exams) =>
      post('/api/sync/push', {
        token, items, stats: stats || {},
        courses: courses || {},       // 批次1：课程/知识点/课表（含删除墓碑）
        sessions: sessions || [],     // 批次1：学习记录
        exams: exams || [],           // 模拟考试试卷（含作答与成绩）
      }, 30000),
    pull: (token) => post('/api/sync/pull', { token }, 30000),
  },

  // 代码在线运行（python / c）
  run: (language, code, stdin = '') => post('/api/run', { language, code, stdin }, 60000),
  // 批次2：变式题生成（后端带缓存，同题同策略不重复计费）
  variant: (payload) => post('/api/variant', payload, 120000),
  // 批次2：AI 对话流式
  chatStream: (payload, handlers) => streamPost('/api/chat/stream', payload, handlers),

  // 代码诊断（贴代码 + 报错，AI 定位错误给建议）
  debug: (code, error = '', language = '', description = '') =>
    post('/api/debug', { code, error, language, description }, 120000).then((d) => d.data),

  // AI 生成同类练习题
  generateQuiz: (knowledgePoints, referenceQuestion = '', subject = '') =>
    post('/api/generate-quiz', {
      knowledge_points: knowledgePoints,
      reference_question: referenceQuestion,
      subject,
    }, 120000).then((d) => d.data),

  // 模拟考试：一次生成整张 100 分试卷（题量与分值由 plan 决定）
  generatePaper: (payload) => post('/api/generate-paper', payload, 240000).then((d) => d.data),
  // 模拟考试：一次批改整卷主观题（选择题在前端本地判，不消耗额度）
  judgePaper: (questions) => post('/api/judge-paper', { questions }, 280000).then((d) => d.data),

  // 讲解追问（流式）：mode = deep 深思 | fast 快答
  followUp: (payload, handlers) => streamPost('/api/follow-up/stream', payload, handlers),

  // 换个讲法（流式）：angle = basic 更基础 | another 换个方法 | visual 直观图像化 | exam 考点视角
  reteach: (payload, handlers) => streamPost('/api/reteach/stream', payload, handlers),

  // 社区：论坛（读游客可看，写需 token）
  forum: {
    list: (sort = 'latest', limit = 20, offset = 0) =>
      post('/api/forum/list', { sort, limit, offset }, 15000).then((d) => ({ items: d.items || [], total: d.total || 0 })),
    detail: (post_id) => post('/api/forum/detail', { post_id }, 15000).then((d) => d.post),
    comments: (post_id) => post('/api/forum/comments/list', { post_id }, 15000).then((d) => d.comments || []),
    post: (token, type, title, content, card) =>
      post('/api/forum/post', { token, type, title, content, card }, 20000).then((d) => d.post),
    comment: (token, post_id, content) =>
      post('/api/forum/comment', { token, post_id, content }, 15000).then((d) => d.comment),
    like: (token, post_id) => post('/api/forum/like', { token, post_id }, 15000),
    deletePost: (token, post_id) => post('/api/forum/post/delete', { token, post_id }, 15000),
  },

  // 社区：学习小组（均需 token）
  group: {
    create: (token, name, description) =>
      post('/api/group/create', { token, name, description }, 15000).then((d) => d.group),
    join: (token, invite_code) => post('/api/group/join', { token, invite_code }, 15000),
    my: (token) => post('/api/group/my', { token }, 15000).then((d) => d.groups || []),
    detail: (token, group_id) => post('/api/group/detail', { token, group_id }, 15000),
    /**
     * 群聊实时增量流（SSE）。
     * 只解析 data 帧（服务端会用 ": ping" 注释行保活），断流后由调用方决定重连。
     */
    messagesStream: async (body, { signal, onItems, onEnd } = {}) => {
      const res = await fetch(BASE + '/api/group/messages/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      if (!res.body) throw new Error('当前浏览器不支持实时消息')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const frames = buf.split('\n\n')
        buf = frames.pop() || ''
        for (const f of frames) {
          const line = f.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '{}') continue
          try {
            const d = JSON.parse(payload)
            if (Array.isArray(d.items) && d.items.length) onItems && onItems(d.items)
          } catch {
            /* 半帧/坏帧忽略，下一轮会补齐 */
          }
        }
      }
      onEnd && onEnd()
    },
    messages: (token, group_id, limit = 100, offset = 0) =>
      post('/api/group/messages', { token, group_id, limit, offset }, 15000).then((d) => ({ items: d.items || [], total: d.total || 0 })),
    send: (token, group_id, type, content) =>
      post('/api/group/send', { token, group_id, type, content }, 20000).then((d) => d.message),
    invite: (token, group_id, nickname) => post('/api/group/invite', { token, group_id, nickname }, 15000),
  },

  // 班级模块（均需 token；批改/报告走 AI，超时放宽）
  cls: {
    teacherApply: (token, name, school, subject) =>
      post('/api/teacher/apply', { token, name, school, subject }, 15000),
    teacherMe: (token) => post('/api/teacher/me', { token }, 15000).then((d) => d.teacher),
    createClass: (token, name, subject, grade) =>
      post('/api/class/create', { token, name, subject, grade }, 15000).then((d) => d.class),
    joinClass: (token, code) => post('/api/class/join', { token, code }, 15000),
    myClasses: (token) => post('/api/class/my', { token }, 15000).then((d) => d.classes || []),
    createHomework: (token, class_id, title, content, reference, due_at, images = []) =>
      post('/api/homework/create', { token, class_id, title, content, reference, due_at, images }, 60000).then((d) => d.homework),
    homeworkList: (token, class_id) =>
      post('/api/homework/list', { token, class_id }, 15000)
        .then((d) => ({ items: d.items || [], is_teacher: d.is_teacher })),
    homeworkDetail: (token, homework_id) =>
      post('/api/homework/detail', { token, homework_id }, 20000),
    assignImages: (token, homework_id) =>
      post('/api/homework/assign_images', { token, homework_id }, 30000).then((d) => d.images || []),
    submit: (token, homework_id, image_base64, note = '', images = []) =>
      post('/api/homework/submit', { token, homework_id, image_base64, note, images }, 120000).then((d) => d.submission),
    submissionImages: (token, homework_id, user_id) =>
      post('/api/homework/image', { token, homework_id, user_id }, 30000).then((d) => d.images || (d.image ? [d.image] : [])),
    gradeStart: (token, homework_id) =>
      post('/api/homework/grade-start', { token, homework_id }, 30000),
    gradeStatus: (token, homework_id) =>
      post('/api/homework/grade-status', { token, homework_id }, 30000),
    grade: (token, homework_id, user_id) =>
      post('/api/homework/grade', { token, homework_id, user_id }, 240000).then((d) => d.submission),
    exportScores: (token, homework_id) =>
      post('/api/class/export-scores', { token, homework_id }, 60000),
    report: (token, homework_id) =>
      post('/api/homework/report', { token, homework_id }, 240000).then((d) => d.report),
    push: (token, homework_id, kind, user_id = '') =>
      post('/api/homework/push', { token, homework_id, kind, user_id }, 20000),
    image: (token, homework_id, user_id) =>
      post('/api/homework/image', { token, homework_id, user_id }, 30000).then((d) => d.image),
    noteCreate: (token, class_id, title, content, images = []) =>
      post('/api/class/note/create', { token, class_id, title, content, images }, 60000).then((d) => d.note),
    noteList: (token, class_id) =>
      post('/api/class/note/list', { token, class_id }, 20000).then((d) => d.notes || []),
    noteImages: (token, note_id) =>
      post('/api/class/note/images', { token, note_id }, 30000).then((d) => d.images || []),
    noteDelete: (token, note_id) =>
      post('/api/class/note/delete', { token, note_id }, 15000),
    testCreate: (token, class_id, title, duration_sec, items) =>
      post('/api/class/test/create', { token, class_id, title, duration_sec, items }, 30000).then((d) => d.test),
    testGenerate: (token, class_id, payload) =>
      post('/api/class/test/generate', { token, class_id, ...payload }, 240000).then((d) => d.items || []),
    testList: (token, class_id) =>
      post('/api/class/test/list', { token, class_id }, 20000).then((d) => ({ tests: d.tests || [], is_teacher: d.is_teacher })),
    testStart: (token, test_id, preview = 0) =>
      post('/api/class/test/start', { token, test_id, preview }, 30000),
    testSubmit: (token, test_id, answers, elapsed_sec = 0) =>
      post('/api/class/test/submit', { token, test_id, answers, elapsed_sec }, 30000),
    testRank: (token, test_id) =>
      post('/api/class/test/rank', { token, test_id }, 20000),
  },
}
