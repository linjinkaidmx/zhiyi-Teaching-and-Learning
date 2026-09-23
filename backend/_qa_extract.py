# -*- coding: utf-8 -*-
"""真实模型 · 异常图片识图验证
对每张异常图调用 /api/extract（真实视觉模型），记录 ok/error/耗时/识别字段。
用法：python _qa_extract.py
"""
import base64
import json
import os
import time
import urllib.request

BASE = 'http://193.112.28.51:3300'
D = r'E:\知一2.0\.learnbuddy\_qa_imgs'

CASES = ['normal.png', 'blur.png', 'rotated.png', 'cropped.png', 'glare.png', 'blank.png']


def extract(path):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    body = json.dumps({'image_base64': b64, 'mime': 'image/png'}).encode()
    req = urllib.request.Request(BASE + '/api/extract', data=body,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            d = json.loads(r.read().decode())
        dt = time.time() - t
        return dt, d
    except urllib.error.HTTPError as e:
        dt = time.time() - t
        return dt, {'http': e.code, 'body': e.read().decode()[:120]}
    except Exception as e:
        dt = time.time() - t
        return dt, {'exc': type(e).__name__ + ': ' + str(e)[:120]}


print('真实模型 · 异常图片识图验证\n')
for name in CASES:
    p = os.path.join(D, name)
    dt, d = extract(p)
    if d.get('ok'):
        data = d.get('data') or {}
        q = (data.get('question') or '').replace('\n', ' ')[:60]
        print('%-10s  %.1fs  ok=TRUE   识别: "%s"' % (name, dt, q))
    else:
        err = d.get('error') or d.get('exc') or d.get('body') or ('HTTP ' + str(d.get('http')))
        print('%-10s  %.1fs  ok=FALSE  %s' % (name, dt, err[:90]))
