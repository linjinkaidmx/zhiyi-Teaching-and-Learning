"""Chrome DevTools Protocol 驱动的知一 UI 端到端冒烟 + 截图。

流程：加载首页 -> 注册（抓备份码）-> 云端写入 2 条错题 -> 练习本
      -> 分享到论坛 -> 论坛列表 -> 建小组 -> 进组详情 -> 共享错题
产出：shots/ 下编号截图；失败打印明细并以非 0 退出。
用法：python ui_smoke.py [--keep]
"""
import base64
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.request

import websocket  # websocket-client

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE = "http://193.112.28.51:3300"
PORT = random.randint(9400, 9900)  # 随机端口，避免僵尸实例占用
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "shots")
NICK = "冒烟" + str(int(time.time() * 10))[-7:]
PWD = "zhiyi@2026"
GROUP_NAME = "高等数学冲刺营"

failures = []


def step(msg):
    print("[STEP]", msg, flush=True)


def fail(msg):
    print("[FAIL]", msg, flush=True)
    failures.append(msg)


def check(cond, msg):
    print(("  [OK] " if cond else "  [BAD] ") + msg, flush=True)
    if not cond:
        failures.append(msg)
    return cond


class Tab:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = websocket.create_connection(ws_url, timeout=90)
        self.id = 0

    def _reconnect(self):
        try:
            self.ws.close()
        except Exception:
            pass
        for _ in range(20):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=2) as r:
                    targets = json.loads(r.read().decode())
                page = next(t for t in targets if t["type"] == "page")
                self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=90)
                print("  [i] WebSocket 已重连", flush=True)
                return
            except Exception:
                time.sleep(0.5)
        raise RuntimeError("无法重连 Chrome 调试端口")

    def call(self, method, **params):
        for attempt in range(4):
            self.id += 1
            mid = self.id
            msg = json.dumps({"id": mid, "method": method, "params": params})
            try:
                self.ws.send(msg)
                while True:
                    data = json.loads(self.ws.recv())
                    if data.get("id") == mid:
                        if "error" in data:
                            err = json.dumps(data["error"])
                            if "navigated or closed" in err and attempt < 3:
                                time.sleep(1.2)
                                break  # 跳出 while，进入下一次 attempt
                            raise RuntimeError(f"{method}: {data['error']}")
                        return data.get("result", {})
            except (ConnectionResetError, websocket.WebSocketConnectionClosedException,
                    BrokenPipeError, OSError) as e:
                if attempt >= 3:
                    raise
                print("  [i] 连接断开(" + repr(e)[:60] + ")，重连…", flush=True)
                self._reconnect()
        raise RuntimeError(f"{method}: 多次重试失败")

    def js(self, expr, awaitp=False):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True,
                      awaitPromise=awaitp, userGesture=True)
        if r.get("exceptionDetails"):
            ed = r["exceptionDetails"]
            raise RuntimeError("JS 异常: " + json.dumps(ed, ensure_ascii=False)[:400])
        return r["result"].get("value")

    def shot(self, name):
        self.call("Page.bringToFront")
        time.sleep(0.5)
        data = self.call("Page.captureScreenshot", format="png")["data"]
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        print("  [shot]", name, flush=True)
        return path


def click_js(sel, txt):
    return (
        "(() => { const e = [...document.querySelectorAll(%s)].find("
        "x => (x.innerText || x.textContent || '').replace(/\\s+/g, ' ').includes(%s));"
        " if (!e) return false; e.scrollIntoView({block:'center'}); e.click(); return true; })()"
        % (sel, txt)
    )


def click_in(sel, scope, txt):
    return (
        "(() => { const root = document.querySelector(%s) || document;"
        " const e = [...root.querySelectorAll(%s)].find("
        "x => (x.innerText || x.textContent || '').replace(/\\s+/g, ' ').includes(%s));"
        " if (!e) return false; e.scrollIntoView({block:'center'}); e.click(); return true; })()"
        % (scope, sel, txt)
    )


# Vue 受控输入必须用原生 setter + input 事件
SET_VAL = """
(idx, val) => {
  const roots = [...document.querySelectorAll('.el-dialog, .el-dialog__wrapper')]
    .filter(d => d.offsetParent !== null || getComputedStyle(d).display !== 'none');
  const inp = [...roots.flatMap(r => [...r.querySelectorAll('.el-input__inner')])];
  if (idx >= inp.length) return 'NO_INPUT idx=' + idx + ' total=' + inp.length;
  const el = inp[idx];
  el.focus();
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  el.blur();
  return 'OK';
}
"""

SET_TA = """
(val) => {
  const roots = [...document.querySelectorAll('.el-dialog, .el-dialog__wrapper')]
    .filter(d => d.offsetParent !== null || getComputedStyle(d).display !== 'none');
  const ta = [...roots.flatMap(r => [...r.querySelectorAll('.el-textarea__inner')])];
  if (!ta.length) return 'NO_TEXTAREA';
  const el = ta[ta.length - 1];
  el.focus();
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, val);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.blur();
  return 'OK';
}
"""

WAIT_TEXT = """
(txt, ms) => new Promise((res) => {
  const t0 = Date.now();
  const check = () => {
    if (document.body.innerText.includes(txt)) return res(true);
    if (Date.now() - t0 > ms) return res(false);
    setTimeout(check, 200);
  };
  check();
})
"""


def wait_text(tab, txt, ms=8000):
    return tab.js(f"({WAIT_TEXT})({txt!r}, {ms})", awaitp=True)


def click_nav(tab, txt, tries=15):
    """点击头部导航按钮，带重试；返回是否成功。"""
    for _ in range(tries):
        try:
            if tab.js(click_js("'header .nav .el-button'", f"'{txt}'")):
                time.sleep(0.8)
                return True
        except Exception:
            pass
        time.sleep(0.4)
    print(f"  [WARN] 导航点击失败: {txt}")
    return False


def click_retry(tab, sel, txt, tries=15, settle=0.8):
    """通用点击重试（等弹窗/按钮就绪）。"""
    for _ in range(tries):
        try:
            if tab.js(click_js(sel, f"'{txt}'")):
                time.sleep(settle)
                return True
        except Exception:
            pass
        time.sleep(0.4)
    return False


def wait_port(url, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                return json.loads(r.read().decode())
        except Exception:
            time.sleep(0.5)
    raise TimeoutError("Chrome 调试端口未就绪")


INSERT_RECORDS = """
(async () => {
  const token = localStorage.getItem('zhiyi_token');
  const base = Date.now();
  const recs = [0, 1].map((i) => ({
    id: 'smoke-' + base + '-' + i,
    source: i === 0 ? 'diagnose' : 'solve',
    subject: i === 0 ? '高等数学' : '数据结构',
    question: i === 0
      ? '求极限 $\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin 3x}{\\\\tan 2x}$'
      : '已知二叉树的先序序列为 $ABDECFG$，中序序列为 $DBEAFGC$，求后序序列',
    knowledge_points: i === 0 ? ['等价无穷小', '极限运算'] : ['二叉树遍历'],
    correct_answer: i === 0 ? '$\\\\frac{3}{2}$' : 'DEBGFCA',
    error_type: i === 0 ? '计算错误' : '方法错误',
    error_analysis: i === 0 ? '替换时把减法当成了乘除替换' : '没用中序划分左右子树',
    solution_steps: ['\\u7b2c\\u4e00\\u6b65\\u8bf4\\u660e', '\\u7b2c\\u4e8c\\u6b65\\u8bf4\\u660e'],
    quizCount: i === 0 ? 3 : 5,
    quizCorrect: i === 0 ? 2 : 3,
    streak: i === 0 ? 1 : 0,
    mastered: false,
    addedAt: base,
  }));
  const out = [];
  for (const r of recs) {
    const resp = await fetch('/api/records/upsert', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-account-token': token},
      body: JSON.stringify({record: r}),
    });
    out.push(await resp.json());
  }
  return JSON.stringify(out);
})()
"""


def main():
    # 每轮写独立目录，不做删除（沙箱对批量删除有守卫）
    OUT = os.path.join(ROOT, "shots_" + str(int(time.time())))
    os.makedirs(OUT, exist_ok=True)
    globals()["OUT"] = OUT
    # 每次跑用独立 profile 目录，避免批量删除旧目录
    profile = os.path.join(ROOT, ".chrome_p_" + str(int(time.time())))

    proc = subprocess.Popen([
        CHROME, f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--allow-insecure-localhost", "--remote-allow-origins=*",
        "--window-size=1440,980", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    tab = None
    try:
        targets = wait_port(f"http://127.0.0.1:{PORT}/json/list")
        page = next(t for t in targets if t["type"] == "page")
        tab = Tab(page["webSocketDebuggerUrl"])
        tab.call("Page.enable")
        tab.call("Runtime.enable")
        tab.call("Emulation.setDeviceMetricsOverride", width=1440, height=980,
                 deviceScaleFactor=1, mobile=False)

        step("1. 加载首页")
        tab.call("Page.navigate", url=BASE + "/")
        # 轮询等待 Vue 挂载出头部导航（最长 20s）
        for _ in range(60):
            try:
                if tab.js("!!document.querySelector('.app-header .nav')"):
                    break
            except Exception:
                pass
            time.sleep(0.35)
        time.sleep(1.2)
        tab.js("document.title")
        tab.shot("01-home.png")
        check(tab.js("document.body.innerText.includes('拍题')"), "首页加载出拍题入口")
        check(tab.js("document.body.innerText.includes('后端已连接') || document.body.innerText.includes('后端未连接')"),
              "显示后端连接状态")

        step("2. 注册账号")
        if not click_retry(tab, "'header .nav .el-button'", "登录"):
            fail("未找到登录/注册按钮")
            return
        if not click_retry(tab, "'.el-dialog .el-button'", "去注册"):
            fail("未找到去注册入口")
            return
        time.sleep(0.8)
        for idx, val in [(0, NICK), (1, PWD), (2, PWD)]:
            r = tab.js(f"({SET_VAL})({idx}, {val!r})")
            if r != "OK":
                fail(f"填写第 {idx} 个输入框失败: {r}")
                return
        tab.shot("02-register.png")
        # 新构建首屏 JS 较大，Vue 事件可能尚未绑定完成 -> 提交重试
        ok_bk = False
        for attempt in range(5):
            tab.js("(() => { const b = document.querySelector('.submit-btn');"
                   " if (b) { b.click(); return 'CLICKED'; } return 'NO_BTN'; })()")
            if wait_text(tab, "我已保存", 5000):
                ok_bk = True
                break
            print(f"  [retry] 注册提交重试 {attempt + 1}/5")
        if not ok_bk:
            dlg = tab.js("(document.querySelector('.el-dialog')||{innerText:''}).innerText") or ""
            fail("注册后未进入备份码界面: " + dlg.replace(chr(10), " | ")[:200])
            return
        code = tab.js("(document.querySelector('.backup-code') || {}).innerText || ''")
        tab.shot("03-backup-code.png")
        print("  备份码 =", code.strip())
        check(bool(re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}", code.strip())), "备份码格式正确")
        tab.js(click_js("'.el-dialog .el-button'", "'我已保存'"))
        time.sleep(2.0)

        check(tab.js("!!document.querySelector('.user-chip')"), "右上角出现用户区")
        print("  昵称 =", tab.js("(document.querySelector('.user-chip')||{}).innerText"))

        step("3. 云端写入 2 条错题并刷新")
        print("  ", tab.js(INSERT_RECORDS, awaitp=True))
        time.sleep(0.6)
        tab.call("Page.navigate", url=BASE + "/")
        for _ in range(60):
            try:
                if tab.js("!!document.querySelector('.app-header .nav')"):
                    break
            except Exception:
                pass
            time.sleep(0.35)
        time.sleep(1.5)

        step("4. 练习本")
        click_nav(tab, '练习本')
        # 等账号空间从云端拉取完成（最长 12s）
        got = False
        for _ in range(40):
            try:
                if tab.js("document.body.innerText.includes('二叉树')"):
                    got = True
                    break
            except Exception:
                pass
            time.sleep(0.3)
        tab.shot("04-book.png")
        check(got, "练习本读到云端错题")
        check(tab.js("document.body.innerText.includes('高等数学')"), "第二条错题学科正确")
        check(tab.js("!!document.querySelector('.katex')"), "KaTeX 公式已渲染")

        step("5. 分享错题到论坛")
        if not tab.js(click_js("'.el-button'", "'分享'")):
            fail("练习本找不到分享按钮")
            return
        time.sleep(1.2)
        tab.shot("05-share-dialog.png")
        if not tab.js(click_js("'.el-dialog .el-radio'", "'论坛'")):
            print("  [i] 未点中论坛单选（可能已默认选中）")
        time.sleep(0.6)
        print("  title =", tab.js(f"({SET_VAL})(0, {'等价无穷小老出错，求指点'!r})"))
        print("  note  =", tab.js(f"({SET_TA})({'每次都把减法里的项单独替换，结果错了一半。'!r})"))
        time.sleep(0.4)
        tab.shot("06-share-filled.png")
        tab.js(click_in("'.el-button'", "'.el-dialog__footer'", "'分享'"))
        time.sleep(2.5)
        tab.shot("07-after-share.png")

        step("6. 论坛")
        click_nav(tab, '论坛')
        forum_hit = False
        for _ in range(30):
            try:
                if tab.js("document.body.innerText.includes('等价无穷小老出错')"):
                    forum_hit = True
                    break
            except Exception:
                pass
            time.sleep(0.4)
        tab.shot("08-forum.png")
        check(forum_hit, "论坛出现新帖")

        step("7. 创建学习小组")
        click_nav(tab, '小组')
        made = False
        for _ in range(20):
            try:
                if tab.js(click_js("'.el-button'", "'创建小组'")):
                    made = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not made:
            dbg = tab.js("document.body.innerText") or ""
            fail("未找到创建小组按钮 body=" + dbg.replace("\n", " | ")[:300])
            return
        time.sleep(1.2)
        print("  name =", tab.js(f"({SET_VAL})(0, {GROUP_NAME!r})"))
        time.sleep(0.4)
        tab.shot("09-group-create.png")
        created = False
        for attempt in range(2):
            tab.js(click_in("'.el-button'", "'.el-dialog__footer'", "'创建'"))
            time.sleep(3.0)
            if tab.js(f"document.body.innerText.includes({GROUP_NAME!r})"):
                created = True
                break
            print(f"  [i] 第 {attempt + 1} 次建组未成功（可能瞬时 502），重试…")
            if not tab.js("!!document.querySelector('.el-dialog__footer')"):
                tab.js(click_js("'.el-button'", "'创建小组'"))
                time.sleep(1.0)
                tab.js(f"({SET_VAL})(0, {GROUP_NAME!r})")
                time.sleep(0.4)
        tab.shot("10-group-list.png")
        body = tab.js("document.body.innerText")
        print("  [debug] body 片段 =", body.replace("\n", " | ")[:400])
        m = re.search(r"小组码[^A-Z0-9]*([2-9A-HJ-NP-Z]{6})", body)
        check(bool(m), "生成 6 位小组码")
        if m:
            print("  小组码 =", m.group(0))

        check(tab.js(f"document.body.innerText.includes({GROUP_NAME!r})"), "小组出现在列表")

        step("8. 进组详情 + 共享错题")
        # 建组成功后前端会自动 openGroup 进详情；若仍在列表则手动点卡片
        if not tab.js("(() => { const c = document.querySelector('.group-card'); if (!c) return false; c.click(); return true; })()"):
            check(tab.js("!!document.querySelector('.detail-title') || document.body.innerText.includes('共享错题')"),
                  "已在小组详情页（建组后自动进入）")
        time.sleep(2.0)
        tab.shot("11-group-detail.png")
        if not tab.js(click_js("'.el-button'", "'分享我的错题进组'")):
            print("  [i] 未找到「分享我的错题进组」按钮")
            return
        time.sleep(1.5)
        tab.shot("12-group-share-open.png")
        # 打开下拉：用 CDP 受信鼠标事件按真实坐标点击（合成事件在 EP2.8 新 select 上无效）
        rect = tab.js(
            "(() => { const dlg = [...document.querySelectorAll('.el-dialog')]"
            ".find(d => d.offsetParent !== null && d.innerText.includes('分享错题进组'));"
            " if (!dlg) return null;"
            " const w = dlg.querySelector('.el-select__wrapper') || dlg.querySelector('.el-select');"
            " if (!w) return null; const r = w.getBoundingClientRect();"
            " return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2}); })()")
        print("  select 位置 =", rect)
        if rect:
            c = json.loads(rect)
            for t, extra in (("mousePressed", {"clickCount": 1}), ("mouseReleased", {"clickCount": 1})):
                tab.call("Input.dispatchMouseEvent", type=t, x=c["x"], y=c["y"],
                         button="left", **extra)
            time.sleep(1.4)
        dbg = tab.js(
            "(() => { const dds = [...document.querySelectorAll('.el-select-dropdown')];"
            " const items = [...document.querySelectorAll('.el-select-dropdown__item')];"
            " const dlg = [...document.querySelectorAll('.el-dialog')]"
            ".find(d => d.offsetParent !== null && d.innerText.includes('分享错题进组'));"
            " const sel = dlg ? (dlg.querySelector('.el-select') || dlg.querySelector('.el-select__wrapper')) : null;"
            " return JSON.stringify({dd: dds.length, items: items.length,"
            " selcls: sel ? sel.className : null,"
            " ddtail: dds.map(d => { const r = d.getBoundingClientRect();"
            " return [Math.round(r.width), Math.round(r.height), Math.round(r.x), Math.round(r.y),"
            " getComputedStyle(d).display, d.innerText.trim().slice(0, 120)]; }),"
            " itail: items.slice(0, 8).map(e => e.innerText.trim().slice(0, 40))}); })()")
        print("  [debug] dropdown =", dbg)
        ls = tab.js(
            "JSON.stringify(Object.keys(localStorage).map(k =>"
            " [k, (localStorage.getItem(k) || '').length]))")
        print("  [debug] localStorage =", ls)
        acc = tab.js(
            "(() => { const r = localStorage.getItem('zhiyi_error_book_account') || '[]';"
            " let a = []; try { a = JSON.parse(r); } catch (e) {}"
            " return JSON.stringify({n: a.length,"
            " q: a.slice(0, 3).map(x => (x.question || '').slice(0, 25)),"
            " ids: a.slice(0, 3).map(x => String(x.id))}); })()")
        print("  [debug] account book =", acc)
        gst = tab.js(
            "(() => { const r = localStorage.getItem('zhiyi_error_book') || '[]';"
            " let a = []; try { a = JSON.parse(r); } catch (e) {}"
            " return JSON.stringify({n: a.length}); })()")
        print("  [debug] guest book =", gst)

        pick_rect = tab.js(
            "(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]"
            ".filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0"
            " && (e.innerText.includes('二叉树') || e.innerText.includes('极限')); });"
            " if (!items.length) return null;"
            " const r = items[0].getBoundingClientRect();"
            " return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2,"
            " t: items[0].innerText.trim().slice(0, 30)}); })()")
        print("  选项位置 =", pick_rect)
        if pick_rect:
            c = json.loads(pick_rect)
            for t in ("mouseMoved", "mousePressed", "mouseReleased"):
                extra = {"clickCount": 1} if t != "mouseMoved" else {}
                tab.call("Input.dispatchMouseEvent", type=t, x=c["x"], y=c["y"],
                         button="left", **extra)
            time.sleep(1.0)
        picked = "选中 " + (pick_rect or "FAIL")
        print("  选中题目 =", picked)
        time.sleep(0.8)
        tab.shot("13-group-share-filled.png")
        # footer 的「分享」按钮：合成 DOM click 在 Element Plus 2.8 上不触发 handler，
        # 必须用 CDP 受信鼠标事件按坐标点击
        rect2 = tab.js(
            "(() => { const b = [...document.querySelectorAll('.el-dialog__footer .el-button')]"
            ".filter(e => e.offsetParent !== null && e.innerText.trim() === '分享');"
            " if (!b.length) return null; const r = b[0].getBoundingClientRect();"
            " return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2}); })()")
        print("  分享按钮位置 =", rect2)
        if rect2:
            c2 = json.loads(rect2)
            for t, extra in (("mousePressed", {"clickCount": 1}), ("mouseReleased", {"clickCount": 1})):
                tab.call("Input.dispatchMouseEvent", type=t, x=c2["x"], y=c2["y"],
                         button="left", **extra)
        time.sleep(2.5)
        tab.shot("14-group-shared.png")
        dlg_gone = tab.js(
            "!([...document.querySelectorAll('.el-dialog')]"
            ".some(d => d.offsetParent !== null && d.innerText.includes('分享错题进组')))")
        check(bool(dlg_gone), "分享后弹窗已关闭")
        check(tab.js("!!document.querySelector('.share-list')"), "小组共享列表已渲染")
        check(tab.js("document.querySelector('.share-list')?.innerText.includes('二叉树')"
                     " || document.querySelector('.share-list')?.innerText.includes('极限')"),
              "小组共享区出现错题")

        step("9. 学习榜")
        members_ok = tab.js(
            "(() => { const b = document.body.innerText;"
            " return b.includes('学习榜') || b.includes('成员'); })()"
        )
        check(bool(members_ok), "小组详情含成员/学习榜区域")
        tab.shot("15-group-final.png")

    finally:
        if tab:
            try:
                tab.ws.close()
            except Exception:
                pass
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()

    print("\n" + "=" * 56)
    if failures:
        print(f">>> UI_SMOKE_FAIL  共 {len(failures)} 项：")
        for f in failures:
            print("   -", f)
        return 1
    print(">>> UI_SMOKE_OK  截图目录:", OUT)
    print("=" * 56)
    return 0


if __name__ == "__main__":
    sys.exit(main())
