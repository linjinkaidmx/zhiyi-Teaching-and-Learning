"""生成 QA 用「手写作答」图片：白底大字，内容与注入的错题答案对应（1+1=2）。"""
from PIL import Image, ImageDraw, ImageFont
import base64

img = Image.new('RGB', (760, 360), '#fdfdfb')
d = ImageDraw.Draw(img)
font = ImageFont.truetype('C:\\Windows\\Fonts\\simhei.ttf', 56)
small = ImageFont.truetype('C:\\Windows\\Fonts\\simhei.ttf', 40)
d.text((60, 60), '解：1+1 = 2', font=font, fill='#1a1a1a')
d.text((60, 170), '答：等于 2。', font=small, fill='#1a1a1a')
out = r'E:\知一2.0\frontend\.learnbuddy\_qa_imgs'
import os
os.makedirs(out, exist_ok=True)
p = os.path.join(out, 'qa_answer.png')
img.save(p, 'PNG')
b64 = base64.b64encode(open(p, 'rb').read()).decode()
open(os.path.join(out, 'qa_answer.b64'), 'w').write(b64)
print('png bytes:', len(b64) * 3 // 4)
