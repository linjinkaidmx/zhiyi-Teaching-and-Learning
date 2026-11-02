# -*- coding: utf-8 -*-
"""AI 造角色 离线回归（2026-10-09，不连网、不花钱）
覆盖：白底抠图 / 终身配额落盘 / 生成图暂存往返 / gen_companion_art MOCK 全链路。
用法：cd backend && python _test_aichar.py   （zhiyi 环境：PIL 可用，无 numpy 依赖）
"""

import test_support  # isolated database, no credentials or network
import base64
import io
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import aichar  # noqa: E402

# 持久化路径重定向到临时目录，绝不碰真实 data/
_TMP = tempfile.mkdtemp(prefix="aichar_test_")
aichar._QUOTA_PATH = os.path.join(_TMP, "quota.json")
aichar._STASH_PATH = os.path.join(_TMP, "stash.json")
aichar._stash = {}

# MOCK：改共享模块属性（gen_companion_art 运行时读取 service.MOCK）
_real_mock = aichar.service.MOCK
aichar.service.MOCK = True

pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


from PIL import Image  # noqa: E402

print("== 1. cutout_white_bg ==")
raw = aichar._mock_char_art()
png_b, subject = aichar.cutout_white_bg(raw)
ok(0.10 < subject < 0.55, "主体占比合理", round(subject, 3))
im = Image.open(io.BytesIO(png_b))
ok(im.mode == "RGBA", "输出 RGBA", im.mode)
ok(im.size != (864, 1152), "已按主体 bbox 裁边", im.size)
px = im.load()
corners = [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]
ok(all(px[c][3] == 0 for c in corners), "四角全透明", [px[c][3] for c in corners])
center = px[im.width // 2, im.height // 2]
ok(center[3] > 200, "中心主体不透明", center)

white = Image.new("RGB", (300, 300), (255, 255, 255))
buf = io.BytesIO()
white.save(buf, format="PNG")
wb, wsubj = aichar.cutout_white_bg(buf.getvalue())
ok(wsubj == 0.0, "纯白图占比 0", wsubj)
ok(wb == buf.getvalue(), "纯白图返回原图（兜底）")

print("== 2. 终身配额（JSON 落盘，重启不丢） ==")
ok(aichar.ai_char_left("qa_quota") == aichar.AI_CHAR_LIMIT, "初始剩余=上限", aichar.ai_char_left("qa_quota"))
aichar.ai_char_consume("qa_quota")
aichar.ai_char_consume("qa_quota")
ok(aichar.ai_char_left("qa_quota") == aichar.AI_CHAR_LIMIT - 2, "两次扣减后剩余正确",
   aichar.ai_char_left("qa_quota"))
disk = json.load(open(aichar._QUOTA_PATH, encoding="utf-8"))
ok(disk["qa_quota"]["used"] == 2, "已扣次数落盘", disk.get("qa_quota"))
aichar.ai_char_consume("qa_quota")
ok(aichar.ai_char_left("qa_quota") == 0, "三次用尽剩余 0", aichar.ai_char_left("qa_quota"))

print("== 3. 生成图暂存（幂等：peek 可重复，落库成功才 discard） ==")
gid = aichar.stash_put("qa_stash", b"PNGDATA_1", 0.75)
ok(gid.startswith("ag_"), "gen_id 前缀", gid)
ok(aichar.stash_peek("qa_stash", gid) == b"PNGDATA_1", "peek 读到")
ok(aichar.stash_peek("qa_stash", gid) == b"PNGDATA_1", "幂等：重复 peek 不销毁")
ok(aichar.stash_peek("别人", gid) is None, "uid 不匹配取不到")
aichar.stash_discard("qa_stash", gid)
ok(aichar.stash_peek("qa_stash", gid) is None, "discard 后销毁")
gid2 = aichar.stash_put("qa_stash", b"PNGDATA_2", 0.75)
ok(aichar.stash_take("别人", gid2) is None, "take 兼容：uid 不匹配取不到")

print("== 4. gen_companion_art MOCK 全链路 ==")
photo = base64.b64encode(raw).decode()
r = aichar.gen_companion_art("data:image/png;base64," + photo, "image/png", "戴红领巾")
ok(r.get("ok") is True, "生成成功", {k: r.get(k) for k in ("ok", "mock")})
ok(r.get("mock") is True, "MOCK 路径", r.get("mock"))
art = base64.b64decode(r["image_b64"])
aim = Image.open(io.BytesIO(art))
ok(aim.mode == "RGBA", "成品透明底 RGBA", aim.mode)
apx = aim.load()
ok(all(apx[c][3] == 0 for c in [(0, 0), (aim.width - 1, aim.height - 1)]), "成品四角透明")
ok(0.1 < r["ratio"] < 3.0, "ratio 在角色合法区间", r["ratio"])
ok(r.get("subject", 1) < 0.9, "抠图生效", r.get("subject"))

gid3 = aichar.stash_put("qa_gen", art, r["ratio"])
ok(aichar.stash_take("qa_gen", gid3) == art, "成品图入暂存可取")

bad = aichar.gen_companion_art("data:image/png;base64,AAAA")
ok(bad.get("ok") is False and "照片" in (bad.get("error") or ""), "坏照片拒绝", bad.get("error"))

aichar.service.MOCK = _real_mock
print("\nAI造角色离线回归: %d 通过 / %d 失败" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
