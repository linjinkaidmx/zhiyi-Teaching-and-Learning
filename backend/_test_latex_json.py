# -*- coding: utf-8 -*-
"""回归测试：JSON 解析不得吃掉 LaTeX 反斜杠
用法：python _test_latex_json.py

覆盖：
1) 模型输出「裸 LaTeX」→ 解析后必须是完整的 \\frac \\theta \\beta \\rho \\nu \\forall \\underbrace
2) 正常转义（\\\\frac）与正常换行（\\n）不受影响
3) 已经损坏的内容（换页符等控制字符）能被无损还原
"""
import service

pass_n = 0
fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print('  ✓ ' + label)
    else:
        fail_n += 1
        print('  ✗ ' + label + (f'  → {extra}' if extra is not None else ''))


print('1. 裸 LaTeX（模型输出单个反斜杠）应被完整保留')
BARE = [
    (r'$\frac{1}{2}$', r'$\frac{1}{2}$'),
    (r'$\theta + \tan x$', r'$\theta + \tan x$'),
    (r'$\beta$', r'$\beta$'),
    (r'$\rho \rightarrow \infty$', r'$\rho \rightarrow \infty$'),
    (r'$\nu + \nabla f$', r'$\nu + \nabla f$'),
    (r'$\forall x$', r'$\forall x$'),
    (r'$\underbrace{a+b}_{n}$', r'$\underbrace{a+b}_{n}$'),
    (r'$\times$ 与 $\text{面积}$', r'$\times$ 与 $\text{面积}$'),
]
for raw_tex, want in BARE:
    payload = '{"answer": "' + raw_tex + '"}'
    try:
        got = service.extract_json(payload)['answer']
    except Exception as e:
        ok(False, f'解析 {raw_tex}', str(e)[:60])
        continue
    ctrl = [hex(ord(c)) for c in got if ord(c) < 32]
    ok(got == want and not ctrl, f'保留 {raw_tex}', {'got': got, 'ctrl': ctrl})

print()
print('2. 正确转义与正常换行不受影响')
ok(service.extract_json('{"answer": "$\\\\frac{1}{2}$"}')['answer'] == r'$\frac{1}{2}$',
   '已转义的 \\\\frac 不被二次转义')
nl = service.extract_json(r'{"answer": "第一行\n第二行"}')['answer']
ok(nl == '第一行\n第二行', '正常换行符仍然是换行', {'got': repr(nl)})
ok(service.extract_json(r'{"answer": "\u00a0空格"}')['answer'] == '\u00a0空格',
   '合法的 \\uXXXX 转义不受影响')

print()
print('3. 已被吃掉的内容可无损还原（存量数据兜底）')
mangled = '{"answer": "$\\u000crac{1}{2}$", "steps": [{"detail": "\\u0008eta \\u000dho"}]}'
try:
    data = service.extract_json(mangled)
    ok(data['answer'] == r'$\frac{1}{2}$', '换页符还原为 \\frac', data['answer'])
    ok(data['steps'][0]['detail'] == r'\beta \rho', '退格/回车还原为 \\beta \\rho', data['steps'][0]['detail'])
except Exception as e:
    ok(False, '还原损坏内容', str(e)[:80])

print()
print('4. 多字段与嵌套结构')
deep = '{"answer":"$\\frac{a}{b}$","steps":[{"title":"x","detail":"$\\tan\\theta$"}],"extensions":["$\\beta$"]}'
d = service.extract_json(deep)
ok(d['steps'][0]['detail'] == r'$\tan\theta$', '嵌套字段同样保留')
ok(d['extensions'][0] == r'$\beta$', '数组字段同样保留')

print()
print('=' * 46)
print(f'全部通过（{pass_n} 项）' if fail_n == 0 else f'有 {fail_n} 项未通过（通过 {pass_n} 项）')
raise SystemExit(0 if fail_n == 0 else 1)
