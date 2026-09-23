# -*- coding: utf-8 -*-
"""P7 收尾：chatStore 跟随会话空间初始化 + 路由切换 + 清理 ChatPage 多余导入"""
import io
import os

SRC = r'E:\知一2.0\frontend\src'

# 1) sessionStore：双空间切换时同步初始化对话存储
p = os.path.join(SRC, 'stores', 'sessionStore.js')
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    "import { validateImport } from '../profile.js'",
    "import { validateImport } from '../profile.js'\nimport { initChat } from './chatStore'",
)
s = s.replace("    initBook('account')", "    initBook('account')\n    initChat('account')")
s = s.replace("    initBook('guest')", "    initBook('guest')\n    initChat('guest')")
s = s.replace("  initBook('guest')\n  initStats('guest', getItems())", "  initBook('guest')\n  initChat('guest')\n  initStats('guest', getItems())")
io.open(p, 'w', encoding='utf-8').write(s)
print('sessionStore 中 initChat 次数:', s.count('initChat('))

# 2) ChatPage：去掉多余的本地 initChat 与未用导入
p = os.path.join(SRC, 'pages', 'ChatPage.vue')
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    "import {\n  conversations, chatRef, createChat, getChat, removeChat, appendMessage, updateMessage,\n  truncateAfter, initChat, setActive,\n} from '../stores/chatStore'",
    "import {\n  conversations, createChat, getChat, removeChat, appendMessage, updateMessage,\n  truncateAfter, setActive,\n} from '../stores/chatStore'",
)
s = s.replace("const list = chatRef()\nconst convList = conversations\n", "")
s = s.replace("initChat('guest')\nupdateIsMobile()", "updateIsMobile()")
s = s.replace("\ndefineExpose({ list })\n", "\n")
io.open(p, 'w', encoding='utf-8').write(s)
print('ChatPage 清理完成；残留 initChat:', 'initChat' in s, '; 残留 chatRef:', 'chatRef' in s)

# 3) 路由：/chat 与 /chat/:id → ChatPage
p = os.path.join(SRC, 'router', 'index.js')
s = io.open(p, encoding='utf-8').read()
old_chat = """  v1(ROUTES.chat, 'chat', () => import('../pages/PlaceholderPage.vue'), {
    title: 'AI 对话',
    phase: 'P7',
    description: '与题目无关的开放式问答，可主动引用历史题目、错题与学习记录。',
    bullets: ['对话列表 / 新建对话 / 对话详情', '引用学习内容（由你选择要引用的内容）', '流式回答、停止生成、重新生成'],
  }),
  v1(ROUTES.chatDetail, 'chat-detail', () => import('../pages/PlaceholderPage.vue'), {
    title: '对话详情',
    phase: 'P7',
    description: '具体某一次对话的详情页。',
  }),"""
new_chat = """  v1(ROUTES.chat, 'chat', () => import('../pages/ChatPage.vue')),
  v1(ROUTES.chatDetail, 'chat-detail', () => import('../pages/ChatPage.vue')),"""
assert old_chat in s, '路由替换未匹配'
s = s.replace(old_chat, new_chat)
io.open(p, 'w', encoding='utf-8').write(s)
print('路由 /chat 已切到 ChatPage')
