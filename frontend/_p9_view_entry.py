# -*- coding: utf-8 -*-
"""拍题页：让「查看大图」入口显眼（缩略图加大 + 明确文字按钮）"""
import io

p = r'E:\知一2.0\frontend\src\pages\CapturePage.vue'
s = io.open(p, encoding='utf-8').read()
before = s

# 1) 文件名区加明确的「查看大图」按钮
old = '''          <div class="capture__file">
            <div class="capture__filename">{{ upload.file.name }}</div>
            <div class="capture__state">已就绪，点击「开始识别」 · 点缩略图可放大核对</div>
          </div>'''
new = '''          <div class="capture__file">
            <div class="capture__filename">{{ upload.file.name }}</div>
            <div class="capture__state">已就绪，点击「开始识别」</div>
            <button type="button" class="capture__view" @click.stop="viewerOpen = true">
              <UiIcon name="search" :size="14" />查看大图
            </button>
          </div>'''
assert old in s, '文件名区未匹配'
s = s.replace(old, new)

# 2) 缩略图加大 + 加边框（深色照片在黑底上也能看见边界）
s = s.replace(
    '''.capture__thumb {
  width: 64px;
  height: 64px;''',
    '''.capture__thumb {
  width: 88px;
  height: 88px;''',
)
s = s.replace(
    '''.capture__thumb-btn {
  position: relative;''',
    '''.capture__thumb-btn {
  position: relative;
  border: var(--border-default);''',
)
s = s.replace(
    '''.capture__thumb-zoom {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 18px;
  height: 18px;''',
    '''.capture__thumb-zoom {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 22px;
  height: 22px;''',
)
s = s.replace(
    '  background: rgba(4, 6, 10, 0.62);\n  color: #fff;\n  font-size: 11px;',
    '  background: rgba(4, 6, 10, 0.72);\n  color: #fff;\n  font-size: 13px;',
)

# 3) 「查看大图」按钮样式
s = s.replace(
    '''.capture__file {
  flex: 1;
  min-width: 0;''',
    '''.capture__view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: var(--sp-2);
  padding: 5px 12px;
  border: var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-unit);
  color: var(--primary-text);
  font-size: var(--fs-body-2);
  cursor: zoom-in;
}
.capture__view:hover {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.capture__file {
  flex: 1;
  min-width: 0;''',
)

assert s != before
io.open(p, 'w', encoding='utf-8').write(s)
print('拍题页入口已加强')
