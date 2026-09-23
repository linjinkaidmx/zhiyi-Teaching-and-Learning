# -*- coding: utf-8 -*-
"""迁移 Reference.vue 到 v1（EP → ui/，样式改 tokens）"""
import io
import os

os.chdir(r'E:\知一2.0\frontend\src\components')
p = 'Reference.vue'
s = io.open(p, encoding='utf-8').read()

# 1) 根容器
s = s.replace('<div class="card">\n    <div class="zr-head">', '<div class="zr-root surface-standard">\n    <div class="zr-head">')

# 2) 工具条 EP 组件
old_tools = (
    '        <el-input\n'
    '          v-model="keyword"\n'
    '          size="small"\n'
    '          placeholder="搜关键词：泰勒、换元、二分、背包…"\n'
    '          clearable\n'
    '          style="width: 230px"\n'
    '        />\n'
    "        <el-button size=\"small\" @click=\"openPrint('current')\">打印本类</el-button>\n"
    "        <el-button size=\"small\" type=\"primary\" plain @click=\"openPrint('all')\">打印全部</el-button>"
)
new_tools = (
    '        <div class="zr-search">\n'
    '          <UiInput v-model="keyword" placeholder="搜关键词：泰勒、换元、二分、背包…" />\n'
    '        </div>\n'
    "        <UiButton variant=\"ghost\" size=\"sm\" @click=\"openPrint('current')\">打印本类</UiButton>\n"
    "        <UiButton variant=\"primary\" size=\"sm\" @click=\"openPrint('all')\">打印全部</UiButton>"
)
assert old_tools in s, '工具条未匹配'
s = s.replace(old_tools, new_tools)

# 3) 导入
s = s.replace(
    "import { ElMessage } from 'element-plus'",
    "import { ElMessage } from '../ui/notify.js'\nimport UiButton from '../ui/UiButton.vue'\nimport UiInput from '../ui/UiInput.vue'",
)

# 4) 追加 v1 样式
style = """
<style scoped>
/* v1 样式：只覆盖屏幕显示用的类；.zpr-* / .pe-* 属打印预览（白纸），保持全局浅色不变 */
.zr-root { padding: var(--sp-6); }
.zr-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.zr-tools { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.zr-search { width: 230px; }
.zr-chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin: var(--sp-4) 0 var(--sp-1); }
.zr-chip {
  border: var(--border-subtle);
  background: var(--surface-unit);
  color: var(--primary-text);
  border-radius: var(--radius-pill);
  padding: 5px 14px;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.zr-chip.active { border-color: var(--primary-line); background: var(--primary-soft-2); color: var(--primary-text-strong); }
.zr-chip-n { margin-left: 6px; font-size: var(--fs-label); opacity: 0.75; }
.zr-group { margin-top: var(--sp-4); }
.zr-group-t {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  padding-left: 9px;
  border-left: 3px solid var(--primary);
  margin-bottom: var(--sp-2);
}
.zr-fx {
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-2);
  background: var(--surface-1);
}
.zr-name { font-size: var(--fs-body); font-weight: var(--fw-medium); color: var(--text-primary); }
.zr-formula { margin: 6px 0 2px; overflow-x: auto; }
.zr-note { font-size: var(--fs-body-2); line-height: var(--lh-body); color: var(--text-tertiary); margin-top: 4px; }
.zr-code-card {
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  margin-top: var(--sp-3);
  background: var(--surface-1);
}
.zr-code { margin-top: var(--sp-2); }
.muted { color: var(--text-muted); font-size: var(--fs-body-2); }
.section-title { font-size: var(--fs-h2); font-weight: var(--fw-medium); margin: 0 0 var(--sp-3); color: var(--text-primary); }
</style>
"""
s = s.rstrip() + '\n' + style
io.open(p, 'w', encoding='utf-8').write(s)
left = [t for t in ['<el-input', '<el-button', '<el-tag', '<el-select', 'element-plus'] if t in s]
print('Reference 迁移完成；残留 EP 标记:', left if left else '无')
