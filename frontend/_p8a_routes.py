# -*- coding: utf-8 -*-
"""P8-A 路由接线：5 个外围页占位 → 实体页"""
import io
import os

p = r'E:\知一2.0\frontend\src\router\index.js'
s = io.open(p, encoding='utf-8').read()

REPL = [
    ("""  v1(ROUTES.data, 'data', () => import('../pages/PlaceholderPage.vue'), {
    title: '学习数据',
    phase: 'P8',
    description: '学习时长、做题量、错题趋势、知识点掌握度的完整统计（首页只展示 3 个核心指标）。',
    extra: '现有「学情看板」仍保留在错题学习页内，迁移到这里时功能不减少。',
  }),""", "  v1(ROUTES.data, 'data', () => import('../pages/DataPage.vue')),"),
    ("""  v1(ROUTES.records, 'records', () => import('../pages/PlaceholderPage.vue'), {
    title: '学习记录',
    phase: 'P8',
    description: '每次讲解、追问与练习的学习记录（LearningSession）。',
  }),""", "  v1(ROUTES.records, 'records', () => import('../pages/RecordsPage.vue')),"),
    ("""  v1(ROUTES.community, 'community', () => import('../pages/PlaceholderPage.vue'), {
    title: '社区',
    phase: '即将上线',
    description: '知一社区正在建设中。上线前不开放信息流、点赞、评论与排行榜。',
  }),""", "  v1(ROUTES.community, 'community', () => import('../pages/CommunityPage.vue')),"),
    ("""  v1(ROUTES.about, 'about', () => import('../pages/PlaceholderPage.vue'), {
    title: '产品介绍',
    phase: 'P8',
    description: '知一是什么、适合谁、怎么用。',
  }),""", "  v1(ROUTES.about, 'about', () => import('../pages/AboutPage.vue')),"),
    ("""  v1(ROUTES.help, 'help', () => import('../pages/PlaceholderPage.vue'), {
    title: '帮助与反馈',
    phase: 'P8',
    description: '常见问题与意见反馈入口；识别或讲解结果有误时可直接跳到这里并自动带上功能类型。',
  }),""", "  v1(ROUTES.help, 'help', () => import('../pages/HelpPage.vue')),"),
]

missing = []
for a, b in REPL:
    if a in s:
        s = s.replace(a, b)
    else:
        missing.append(a.split("'")[1])

try:
    io.open(p, 'w', encoding='utf-8').write(s)
    print('路由已接线；未命中:', missing if missing else '无')
except PermissionError:
    print('router/index.js 被锁，未写入；未命中:', missing)
