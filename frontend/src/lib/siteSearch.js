/**
 * 首页站内功能搜索索引（2026-10-10 用户拍板）
 * ---------------------------------------------------------------------------
 * 纯前端静态索引 + 归一化模糊匹配：用户口语化描述也能推出对应界面，零模型成本、毫秒级。
 * 每个功能一条：{ title, desc, path, icon, aliases[] }。aliases 覆盖口语说法与功能别称。
 * path 支持 query 直达（如 /tools?tool=ref 直接进「考前速查」）。
 */
import { ROUTES } from './routes.js'

const T = ROUTES

export const SITE_INDEX = [
  {
    title: '拍照搜题', desc: '拍一道题，AI 识别并讲解', path: T.capture, icon: 'camera',
    aliases: ['拍照', '拍题', '搜题', '扫题', '识别题目', '拍题讲解', '题库秒答', '秒答', '题库', '找答案'],
  },
  {
    title: '错题本', desc: '答错的题都收在这里，随时回顾', path: T.wrongbook, icon: 'book',
    aliases: ['错题', '错题学习', '错题集', '复习', '背题', '重做', '踩过的坑', '易错', '错题回顾'],
  },
  {
    title: '错题自测', desc: '按遗忘曲线间隔复习，巩固记忆', path: '/practice/original', icon: 'refresh',
    aliases: ['自测', '自测复习', '间隔复习', '遗忘曲线', 'SRS', '巩固', '复习计划', '记不牢', '再练一遍'],
  },
  {
    title: 'AI 课堂', desc: '跟老师一节一节学，章末还有单元测试', path: T.teacher, icon: 'teacher',
    aliases: ['课堂', '上课', '老师', '听讲', '教学', '知识点', '章节', '课程学习', '跟老师学'],
  },
  {
    title: 'AI 伴学', desc: '陪你学习的小伙伴，能问能聊', path: T.companion, icon: 'chat',
    aliases: ['伴学', '角色', '搭子', '陪我学', '小伙伴', 'AI角色', '陪读', '学习伙伴', '角色大小'],
  },
  {
    title: 'AI 对话', desc: '和 AI 自由问答', path: T.chat, icon: 'chat',
    aliases: ['对话', '聊天', '问答', '问AI', 'AI聊天', '问问题'],
  },
  {
    title: '模拟考试', desc: '组卷、限时作答、AI 判分', path: T.simExam, icon: 'clipboard',
    aliases: ['考试', '模考', '组卷', '模拟', '测验', '自测考试', '全真模拟'],
  },
  {
    title: '考前速查', desc: '公式 97 条 · 算法模板 21 个', path: '/tools?tool=ref', icon: 'book',
    aliases: ['速查', '公式', '考前突击', '模板', '复杂度', '考前复习', '小抄', '记公式'],
  },
  {
    title: '算法演示', desc: '21 个算法分步动画', path: '/tools?tool=algo', icon: 'play',
    aliases: ['算法', '演示', '动画', '排序', '数据结构动画', '算法动画'],
  },
  {
    title: '代码诊断', desc: '贴代码 + 报错，AI 定位问题', path: '/tools?tool=debug', icon: 'settings',
    aliases: ['代码诊断', '报错', 'debug', '查bug', '代码错', '排错', '调试'],
  },
  {
    title: '学习工具', desc: '模拟考试、算法演示、代码诊断、速查', path: T.tools, icon: 'sparkle',
    aliases: ['工具', '更多', '工具箱'],
  },
  {
    title: '课程表', desc: '排课、教室、学期设置', path: T.timetable, icon: 'schedule',
    aliases: ['课程表', '课表', '课', '排课', '上课时间', '教室', '学期'],
  },
  {
    title: '考试安排', desc: '近期考试日历', path: T.exams, icon: 'clipboard',
    aliases: ['考试安排', '考试日历', '考试日期', '期中', '期末', '考试倒计时'],
  },
  {
    title: '班级', desc: '班级空间、作业、随堂测', path: T.classPage, icon: 'users',
    aliases: ['班级', '班级群', '同学', '小组', '班级作业'],
  },
  {
    title: '学习数据', desc: '学情看板、薄弱知识点', path: T.data, icon: 'data',
    aliases: ['数据', '学情', '统计', '看板', '薄弱', '掌握情况', '学习报告'],
  },
  {
    title: 'AI 学情报告', desc: '学会了什么、接下来学什么', path: T.report, icon: 'data',
    aliases: ['学情报告', '报告', '学会了什么', '接下来学什么', '学习总结', '往哪学', '学情总结'],
  },
  {
    title: '学习记录', desc: '学习时长、打卡记录', path: T.records, icon: 'history',
    aliases: ['记录', '打卡', '学习时长', '历史', '学过什么'],
  },
  {
    title: '成就殿堂', desc: '打卡、连续学习、成就', path: T.achievements, icon: 'sparkle',
    aliases: ['成就', '勋章', '连续学习', '打卡成就', '里程碑'],
  },
  {
    title: '知一社区', desc: '学习交流广场', path: T.community, icon: 'chat',
    aliases: ['社区', '帖子', '广场', '交流', '分享'],
  },
  {
    title: '帮助反馈', desc: '使用帮助与问题反馈', path: T.help, icon: 'help',
    aliases: ['帮助', '反馈', '客服', '问题', '怎么用', '教程'],
  },
  {
    title: '账号与同步', desc: '登录、多端同步、个人设置', path: T.mine, icon: 'user',
    aliases: ['我的', '账号', '同步', '设置', '个人', '登录', '注册'],
  },
]

/** 首页「猜你想搜」常用入口（用户确认的 8 件套） */
export const QUICK_ENTRIES = [
  { title: 'AI 课堂', path: T.teacher, icon: 'teacher' },
  { title: 'AI 伴学', path: T.companion, icon: 'chat' },
  { title: '错题本', path: T.wrongbook, icon: 'book' },
  { title: '自测复习', path: '/practice/original', icon: 'refresh' },
  { title: '题库秒答', path: T.capture, icon: 'camera' },
  { title: '考前速查', path: '/tools?tool=ref', icon: 'book' },
  { title: '课程表', path: T.timetable, icon: 'schedule' },
  { title: '学习工具', path: T.tools, icon: 'sparkle' },
]

/** 归一化：去空白与常见标点、转小写 */
const norm = (s) => String(s || '')
  .replace(/[\s，,。．.、；;：:！!？?~～"'“”‘’`（）()[\]【】/\\-]+/g, '')
  .toLowerCase()

/** 单字命中价值低，避免「的/学/题」这类单字把无关功能全捞出来 */
const isWeakToken = (t) => t.length === 1

/**
 * 模糊搜索：输入归一化后与每个功能的 title + aliases 做包含/被包含匹配并计分。
 * 命中别名越多、命中关键词越长，得分越高；无结果返回空数组。
 */
export function searchSite(q, limit = 7) {
  const nq = norm(q)
  if (!nq) return []
  const weak = isWeakToken(nq)
  const scored = []
  for (const item of SITE_INDEX) {
    const hay = [item.title, ...(item.aliases || [])].map(norm)
    let score = 0
    let hits = []
    for (const h of hay) {
      if (!h) continue
      if (h === nq) { score += 12; hits.push(h) }
      else if (h.includes(nq)) { score += 6 + nq.length; hits.push(h) }   // 「错题」⊆「错题本」
      else if (nq.includes(h) && !weak) { score += 4 + h.length; hits.push(h) }  // 「我想复习错题」⊇「复习」
    }
    // 命中关键词至少 2 个字才给额外权重，压过单字噪声
    if (hits.some((h) => h.length >= 2)) score += 2
    if (score > 0) scored.push({ ...item, _score: score })
  }
  scored.sort((a, b) => b._score - a._score)
  return scored.slice(0, limit)
}
