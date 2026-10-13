/**
 * 新手教程数据（图片为主 + 一句标题 + 一句说明）
 * ---------------------------------------------------------------------------
 * · 配图来自 public/tours/*.webp —— 由 scripts/_shots_tour.mjs 用 CDP 批量截真实界面生成，
 *   界面改版后重跑脚本即可更新，不需要手绘。
 * · key 同时是 localStorage 标记名：zy_tour_<key>，看过即不再自动弹。
 * · auto=true 表示首次自动弹；所有教程都能从页面右上角「?」重新打开。
 */
export const TOURS = {
  /* ---------- L1：新用户首次进入（全站） ---------- */
  welcome: {
    key: 'welcome',
    title: '欢迎使用知一',
    auto: true,
    cards: [
      { img: '/tours/welcome-1.webp', title: '拍下不会的题', desc: '拍照、相册、拖拽粘贴，或直接把题目文字打进来' },
      { img: '/tours/welcome-2.webp', title: '讲到你会为止', desc: '思路 → 步骤 → 答案 → 知识点 → 易错点，看不懂还能追问' },
      { img: '/tours/welcome-3.webp', title: '错题不再白错', desc: '自动归集进错题本，按遗忘曲线安排复习' },
      { img: '/tours/welcome-4.webp', title: '看清自己的进度', desc: '薄弱知识点、掌握度、打卡趋势，都在学情报告里' },
    ],
  },

  /* ---------- L2：页面级 ---------- */
  teacher: {
    key: 'teacher',
    title: 'AI 课堂怎么用',
    cards: [
      { img: '/tours/teacher-1.webp', title: '开一门自己的课', desc: '填科目、难度和范围，老师会生成一份章节大纲' },
      { img: '/tours/teacher-2.webp', title: '挑老师，定进度', desc: '选一位老师（讲法不同），也可以从上次的章节继续' },
    ],
  },
  companion: {
    key: 'companion',
    title: 'AI 伴学怎么用',
    cards: [
      { img: '/tours/companion-1.webp', title: '先挑一个伙伴', desc: '每个伙伴性格不同，选一个聊得来的' },
      { img: '/tours/companion-2.webp', title: '聊天，也可以求教', desc: '闲聊放松，或者把不会的题拿来一起琢磨' },
      { img: '/tours/companion-3.webp', title: '聊得多，关系越好', desc: '聊天涨亲密度、解锁成就，还能给 TA 换个形象' },
    ],
  },
  classroom: {
    key: 'classroom',
    title: '班级怎么用',
    cards: [
      { img: '/tours/classroom-1.webp', title: '老师：建班发码', desc: '认证老师后建班，把 6 位班级码发给学生' },
      { img: '/tours/classroom-2.webp', title: '学生：输码进班', desc: '输入班级码即可加入，作业和通知都在这里' },
      { img: '/tours/classroom-3.webp', title: '布置作业与交作业', desc: '老师布置，学生拍照提交，可附文字说明' },
      { img: '/tours/classroom-4.webp', title: 'AI 一键批改全班', desc: '批改结果发回给学生，班级共性错误自动汇总' },
    ],
  },
  community: {
    key: 'community',
    title: '知一社区怎么用',
    cards: [
      { img: '/tours/community-1.webp', title: '发帖求教或分享', desc: '贴一道题求助，或写下你的学习心得' },
      { img: '/tours/community-2.webp', title: '和同学组个小组', desc: '建小组或用邀请码加入，一起刷题互相讲' },
      { img: '/tours/community-3.webp', title: '把错题分享到小组', desc: '一键把错题发进讨论区，附上答案和知识点' },
    ],
  },
  wrongbook: {
    key: 'wrongbook',
    title: '错题学习怎么用',
    cards: [
      { img: '/tours/wrongbook-1.webp', title: '错题自动归位', desc: '按课程与知识点分类，一眼看到哪块最薄弱' },
      { img: '/tours/wrongbook-2.webp', title: '三种复习方式', desc: '重做原题、变式题、AI 出新题，换着练' },
      { img: '/tours/wrongbook-3.webp', title: '连对两次才算会', desc: '答错就回到队列重新累积，不会蒙混过关' },
    ],
  },
  practice: {
    key: 'practice',
    title: '自测练习怎么用',
    cards: [
      { img: '/tours/practice-1.webp', title: '照着薄弱点练', desc: '系统按掌握度挑题，也可以自己指定知识点' },
      { img: '/tours/practice-2.webp', title: '答错自动回复习', desc: '答错的题会回到待巩固队列，过几天再考你' },
    ],
  },
  exam: {
    key: 'exam',
    title: '模拟考试怎么用',
    cards: [
      { img: '/tours/exam-1.webp', title: '选一种卷型', desc: '完整卷、只考选择/填空，或自己配题量' },
      { img: '/tours/exam-2.webp', title: '限时作答，自动判分', desc: '选择填空即时判，主观题由 AI 按采分点估分' },
    ],
  },
}

/** 一个教程的总张数（进度点用） */
export function tourCount(key) {
  const t = TOURS[key]
  return t ? t.cards.length : 0
}
