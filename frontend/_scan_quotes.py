# -*- coding: utf-8 -*-
"""扫描 ref 数据文件里在普通字符串中未转义的撇号（会造成 JS 语法错误）。"""
import io
import re

HERE = r'E:\知一2.0\frontend\src\ref'
PAT = re.compile(r"(?<!\\)[A-Za-z)]'")

for fn in ['formulas.js', 'code.js']:
    for i, line in enumerate(io.open(HERE + '\\' + fn, encoding='utf-8'), 1):
        if 'String.raw' in line:
            continue
        if PAT.search(line):
            print(fn, i, line.strip()[:150])
print('扫描完成')
