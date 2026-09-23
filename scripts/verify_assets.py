"""线上前端资源完整性校验：抓取 index.html，解析引用的 JS/CSS/字体，逐个 HEAD 检查可达性。"""
import re
import sys
import urllib.request
from urllib.parse import urljoin

BASE = "http://193.112.28.51:3300"
UA = {"User-Agent": "Mozilla/5.0 (zhiyi-smoke)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read()


def head(url):
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:
        return "ERR:" + str(getattr(e, "code", e.__class__.__name__))


status, html = get(BASE + "/")
root = html.decode("utf-8", "ignore")
print(f"index.html: HTTP {status}, {len(root)} bytes")

# 收集引用的资源
srcs = set(re.findall(r'(?:src|href)="(/[^"]+)"', root))
# 收集内联 JS 里可能出现的 chunk / 字体相对引用
srcs |= set(re.findall(r'"(/assets/[^"]+)"', root))

missing = []
checked = 0
for s in sorted(srcs):
    if s.startswith("//"):
        continue
    url = urljoin(BASE + "/", s.lstrip("/"))
    st = head(url)
    checked += 1
    if st != 200:
        missing.append((s, st))

print(f"引用资源 {len(srcs)} 个，已检查 {checked} 个")

# 关键入口
js_main = re.search(r'src="(/assets/index-[^"]+\.js)"', root)
css_main = re.search(r'href="(/assets/index-[^"]+\.css)"', root)
print("主 JS :", js_main.group(1) if js_main else "未找到")
print("主 CSS:", css_main.group(1) if css_main else "未找到")

# CSS 内的字体（KaTeX）
fonts = []
if css_main:
    _, css = get(urljoin(BASE + "/", css_main.group(1).lstrip("/")))
    css_text = css.decode("utf-8", "ignore")
    fonts = sorted(set(re.findall(r'url\(([^)]*?\.(?:woff2|woff|ttf))\)', css_text)))
    fbad = []
    for f in fonts:
        f = f.strip('"\'')
        u = urljoin(BASE + "/assets/", f)
        if head(u) != 200:
            fbad.append(f)
    print(f"CSS 引用字体 {len(fonts)} 个，异常 {len(fbad)} 个")
    if fbad:
        for f in fbad[:10]:
            print("  字体缺失:", f)

if missing:
    print("\n!!! 缺失资源:")
    for s, st in missing:
        print(f"  {s} -> {st}")
    sys.exit(1)
else:
    print("\n>>> ASSETS_OK: 全部资源可达")
