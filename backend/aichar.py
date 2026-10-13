# -*- coding: utf-8 -*-
"""AI 造角色（2026-10-09）：照片 → 方舟视觉识别人物特征 → seedream 图生图(Q版立绘) → 白底抠图。

设计要点：
- 终身配额（每账号 3 次生图）用 JSON 文件落盘：单进程 + 线程锁，重启不丢；
  不动 SQLite（省三处同步），不存内存（防重启清零白嫖）。
- 生成图暂存（gen_id → 透明底 PNG）内存 dict + 落盘镜像，TTL 10 分钟；
  ai-save 凭 gen_id 取图，最终图不经客户端的手，防绕过 AI 直接传图。
- MOCK=1 或无 ARK key 时：特征走占位、生图返回内置白底测试人形——全链路（含抠图）离线可测。
- Prompt 一律纯字符串拼接（项目铁律：禁 .format()，防花括号被吃）。
"""
import base64
import io
import json
import os
import threading
import time
import uuid

from PIL import Image, ImageDraw, ImageFilter

import service

AI_CHAR_LIMIT = int(os.getenv("AI_CHAR_LIMIT", "3"))          # 每账号终身生图次数
AI_IMAGE_MODEL = os.getenv("AI_IMAGE_MODEL", "doubao-seedream-4-0-250828").strip()
AI_IMAGE_SIZE = os.getenv("AI_IMAGE_SIZE", "864x1152").strip()  # 3:4 竖版立绘
_STASH_TTL = 1800                                              # 生成图暂存 30 分钟（2026-10-09：10 分钟误伤"生成完立刻保存"场景）

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
_QUOTA_PATH = os.path.join(_DATA_DIR, "aichar_quota.json")
_STASH_PATH = os.path.join(_DATA_DIR, "aichar_stash.json")

_lock = threading.Lock()
_stash: dict = {}


def _load_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


# ---------------- 终身配额 ----------------

def ai_char_left(uid: str) -> int:
    with _lock:
        used = int(_load_json(_QUOTA_PATH, {}).get(uid, {}).get("used", 0))
    return max(0, AI_CHAR_LIMIT - used)


def ai_char_consume(uid: str) -> int:
    """扣 1 次生图机会，返回扣完后的剩余次数。"""
    with _lock:
        all_q = _load_json(_QUOTA_PATH, {})
        rec = all_q.get(uid) or {"used": 0, "ts": ""}
        rec["used"] = int(rec.get("used", 0)) + 1
        rec["ts"] = time.strftime("%Y-%m-%d %H:%M:%S")
        all_q[uid] = rec
        _save_json(_QUOTA_PATH, all_q)
    return max(0, AI_CHAR_LIMIT - rec["used"])


# ---------------- 生成图暂存 ----------------

def stash_put(uid: str, png_b: bytes, ratio: float) -> str:
    gen_id = "ag_" + uuid.uuid4().hex[:12]
    now = time.time()
    with _lock:
        for k in [k for k, v in _stash.items() if now - v["ts"] > _STASH_TTL]:
            _stash.pop(k, None)
        _stash[gen_id] = {"uid": uid, "png_b64": base64.b64encode(png_b).decode(), "ratio": ratio, "ts": now}
        try:
            _save_json(_STASH_PATH, {k: v for k, v in _stash.items()})
        except Exception:
            pass  # 镜像失败不阻断（内存仍是权威）
    return gen_id


def stash_peek(uid: str, gen_id: str) -> bytes | None:
    """非破坏性读取（2026-10-09 修复"生成完立刻保存却报过期"）：不删除，同一 gen_id 可重复保存（幂等）。
    uid 不匹配或过期返回 None。销毁时机移到调用方落库成功后（stash_discard）。"""
    with _lock:
        rec = _stash.get(gen_id)
        if not rec or rec["uid"] != uid or time.time() - rec["ts"] > _STASH_TTL:
            return None
        return base64.b64decode(rec["png_b64"])


def stash_discard(uid: str, gen_id: str) -> None:
    """落库成功后销毁暂存（uid 校验防误删他人）。"""
    with _lock:
        rec = _stash.get(gen_id)
        if rec and rec["uid"] == uid:
            _stash.pop(gen_id, None)
            try:
                _save_json(_STASH_PATH, dict(_stash))
            except Exception:
                pass


def stash_take(uid: str, gen_id: str) -> bytes | None:
    """兼容旧签名：peek + discard。保留给可能的旧调用方；新代码用 peek/discard 组合。"""
    b = stash_peek(uid, gen_id)
    if b is not None:
        stash_discard(uid, gen_id)
    return b


def _stash_restore() -> None:
    global _stash
    try:
        raw = _load_json(_STASH_PATH, {})
        now = time.time()
        _stash = {k: v for k, v in raw.items() if now - v.get("ts", 0) <= _STASH_TTL}
    except Exception:
        _stash = {}


_stash_restore()


# ---------------- 白底抠图（透明底立绘） ----------------

def cutout_white_bg(img_b: bytes) -> tuple[bytes, float]:
    """纯白底图 → 透明底 PNG。返回 (png_bytes, 主体占比)。
    占比 <0.12（几乎全透）或 >0.9（没抠动）视为异常，返回原图与占比，由调用方兜底。
    纯 PIL 实现（zhiyi 环境无 numpy）：split 取 RGB 带 → point 阈值出白色掩膜 →
    MinFilter/MaxFilter 开闭运算 → 高斯羽化（只收缩防白边）→ getbbox 裁边。"""
    im = Image.open(io.BytesIO(img_b)).convert("RGBA")
    w, h = im.size
    r, g, b, _a = im.split()
    from PIL import ImageChops
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    rng = ImageChops.subtract(mx, mn)
    # 近白 = 三通道最小值 >225 且极差 <18（低饱和高亮）
    white = ImageChops.multiply(
        mn.point(lambda v: 255 if v > 225 else 0),
        rng.point(lambda v: 255 if v < 18 else 0))
    alpha = white.point(lambda v: 0 if v > 127 else 255)

    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))   # 开运算：去孤立白点
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # 闭运算：补小孔
    soft = alpha.filter(ImageFilter.GaussianBlur(1))
    alpha = ImageChops.darker(alpha, soft)   # 只收缩不扩张，防白边

    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return img_b, 0.0
    hist = alpha.histogram()
    ratio_sub = sum(hist[9:256]) / float(w * h)
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - 6), max(0, y0 - 6)
    x1, y1 = min(w, x1 + 6), min(h, y1 + 6)
    out = im.copy()
    out.putalpha(alpha)
    buf = io.BytesIO()
    out.crop((x0, y0, x1, y1)).save(buf, format="PNG")
    return buf.getvalue(), ratio_sub


# ---------------- 方舟调用 ----------------

_FEATURE_PROMPT = (
    "你是角色设定师。观察图片中的主角人物，只输出一个 JSON 对象（不要 markdown、不要解释）："
    '{"gender":"男/女/不明","age":"儿童/少年/青年/中年","hair":"发型简述(10字内)",'
    '"hair_color":"发色(6字内)","outfit":"服装描述(20字内)","accessory":"显眼配饰,没有则空字符串",'
    '"vibe":"气质关键词(6字内)"}'
)


def _mock_char_art() -> bytes:
    """MOCK 生图：现场画白底 Q 版人形（圆头+身体+腿），供离线全链路测试（含抠图）。"""
    im = Image.new("RGB", (864, 1152), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((300, 140, 564, 404), fill=(255, 214, 190))                      # 脸
    d.ellipse((316, 96, 548, 260), fill=(102, 68, 52))                         # 头发
    d.rounded_rectangle((352, 420, 512, 760), 40, fill=(96, 165, 250))         # 身体
    d.rounded_rectangle((376, 760, 432, 1020), 24, fill=(70, 80, 110))         # 左腿
    d.rounded_rectangle((436, 760, 492, 1020), 24, fill=(70, 80, 110))         # 右腿
    d.ellipse((322, 300, 358, 336), fill=(255, 214, 190))                      # 左手
    d.ellipse((506, 300, 542, 336), fill=(255, 214, 190))                      # 右手
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


_SEEDREAM_CANDIDATES = [
    os.getenv("AI_IMAGE_MODEL", "").strip(),       # 用户显式指定，最高优先
    "doubao-seedream-4-0-250828",                  # 4.0 图生图（最佳：保人物长相）
    "doubao-seedream-4-5-251128",
    "doubao-seedream-5-0-260128",
    "doubao-seedream-4-0-20260415",
    "doubao-seedream-5-0-pro-260628",
    "doubao-seedream-5-0-flash-260915",
    "doubao-seedream-3-0-t2i-250415",              # 3.0 文生图（无参考图，靠特征描述兜底）
    "doubao-seededit-3-0-i2i-250628",              # 3.0 图生图编辑
]
_working_model = {"id": None}                      # 命中后缓存，后续直用


def _seedream_generate(prompt: str, ref_b64: str, ref_mime: str, timeout: int = 120) -> bytes:
    """方舟 images API 生图（urllib 零依赖）。模型自适应：404/400 自动试下一候选，命中即缓存。
    seedream 3.0 t2i 是纯文生图，不传 image 参考图（特征已编入 prompt）。"""
    import urllib.error
    import urllib.request
    ids = []
    if _working_model["id"]:
        ids.append(_working_model["id"])
    ids += [m for m in _SEEDREAM_CANDIDATES if m and m != _working_model["id"]]
    last_err: Exception | None = None
    for mid in ids:
        body = {
            "model": mid,
            "prompt": prompt,
            "size": AI_IMAGE_SIZE,
            "response_format": "b64_json",
            "watermark": False,
        }
        if "t2i" not in mid:                       # 图生图模型才带参考图
            body["image"] = ["data:" + ref_mime + ";base64," + ref_b64]
        req = urllib.request.Request(
            service.ARK_BASE_URL.rstrip("/") + "/images/generations",
            data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"Authorization": "Bearer " + service.ARK_API_KEY,
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            item = (data.get("data") or [{}])[0]
            b64 = item.get("b64_json") or ""
            if not b64 and item.get("url"):
                with urllib.request.urlopen(item["url"], timeout=timeout) as r2:
                    png = r2.read()
            elif b64:
                png = base64.b64decode(b64)
            else:
                raise RuntimeError("返回无图: " + json.dumps(data)[:160])
            _working_model["id"] = mid
            return png
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode()[:140]
            except Exception:
                pass
            if e.code in (400, 404):               # 模型不存在/参数不兼容 → 换下一候选
                last_err = RuntimeError(mid + " → HTTP " + str(e.code) + " " + detail)
                continue
            raise                                   # 401/429/5xx：凭据或服务问题，原样抛
    raise last_err or RuntimeError("无可用生图模型")


def gen_companion_art(photo_b64: str, mime: str = "image/jpeg", hint: str = "") -> dict:
    """AI 造角色主链路。photo_b64 兼容 dataURL。
    返回 {"ok": True, "image_b64": 透明底PNG b64, "ratio": 宽/高, "mock": bool}
    或 {"ok": False, "error": ...}。生图成功才由调用方扣次数。"""
    mock = service.MOCK or not service.ARK_API_KEY
    b64 = photo_b64.split(",")[-1].strip()
    if len(b64) < 200:
        return {"ok": False, "error": "照片内容异常，请重新上传"}

    # 1) 特征识别（视觉模型；失败给中性兜底特征，生图照走）
    feat = {"gender": "不明", "age": "青年", "hair": "短发", "hair_color": "黑色",
            "outfit": "休闲装", "accessory": "", "vibe": "元气"}
    if not mock:
        try:
            raw = service.chat_text(
                [{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": "data:" + mime + ";base64," + b64}},
                    {"type": "text", "text": _FEATURE_PROMPT},
                ]}],
                temperature=0.2, slot=service.EXTRACT_SLOT, timeout=90)
            got = service.extract_json(raw or "")
            if isinstance(got, dict):
                for k in feat:
                    v = str(got.get(k) or "").strip()
                    if v:
                        feat[k] = v[:30]
        except Exception:
            pass  # 识别失败不阻断：兜底特征 + 图生图仍保留人物长相

    # 2) 生图 prompt（纯 + 拼接）
    p = ("参考这张照片里人物的发型、发色、服装与配饰特征，画一张Q版二头身全身立绘："
         "发型" + feat["hair"] + "，发色" + feat["hair_color"] + "，穿" + feat["outfit"])
    if feat.get("accessory"):
        p += "，佩戴" + feat["accessory"]
    p += ("，整体气质" + feat["vibe"] + "。"
          "要求：人物完整全身入画、正面自然站姿、大头小身Q版比例、明快平涂上色、线条干净；"
          "背景必须是纯净的白色（无渐变无阴影无道具无文字无边框），人物轮廓边缘清晰锐利，"
          "方便后续抠图；画风与可爱卡通学习伙伴系列统一。")
    if hint:
        p += "补充要求：" + hint[:60] + "。"

    # 3) 生图（MOCK 走内置测试人形）
    try:
        if mock:
            raw_png = _mock_char_art()
        else:
            raw_png = _seedream_generate(p, b64, mime)
    except Exception as e:
        return {"ok": False, "error": "生图服务暂时不可用，请稍后再试（本次不扣次数）"}

    # 4) 抠图 + 尺寸约束
    try:
        png_b, subject = cutout_white_bg(raw_png)
    except Exception:
        png_b, subject = raw_png, 1.0
    im = Image.open(io.BytesIO(png_b))
    if im.width > 720:
        nh = round(im.height * 720 / im.width)
        im = im.resize((720, nh), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        png_b = buf.getvalue()
    ratio = round(im.width / max(1, im.height), 4)
    return {"ok": True, "image_b64": base64.b64encode(png_b).decode(),
            "ratio": ratio, "subject": round(subject, 3), "mock": mock}
