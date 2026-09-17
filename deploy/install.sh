#!/usr/bin/env bash
# ============================================================
#   知一 · 错题诊断与自适应辅导系统  —— 服务器一键部署脚本
#   适用：Ubuntu / Debian / CentOS / Rocky / AlmaLinux
#   用法：sudo bash install.sh [端口]
#         sudo bash install.sh        # 默认 3300
#         sudo bash install.sh 8080   # 自定义端口
# ============================================================
set -e

PORT="${1:-3300}"
APP_DIR="/opt/zhiyi"

echo "=============================================="
echo "  知一 · 错题诊断系统  一键部署"
echo "  端口: $PORT   安装目录: $APP_DIR"
echo "=============================================="
echo ""

# ---------- 前置检查 ----------
if [ ! -d "$APP_DIR/backend" ]; then
  echo "[✗] 未找到 $APP_DIR/backend"
  echo "    请先把项目解压到 /opt 下，确保路径为 /opt/zhiyi/backend"
  exit 1
fi

if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "[✗] 缺少 API 配置文件：$APP_DIR/backend/.env"
  exit 1
fi

if [ ! -d "$APP_DIR/backend/static" ]; then
  echo "[!] 警告：未找到前端页面目录 static/，将以纯 API 模式运行"
fi

# ---------- 1. 系统依赖 ----------
echo "[1/5] 安装系统依赖..."

# 按优先级探测包管理器（TencentOS Server 4 只有 dnf，必须放在前面）
PM=""
if command -v dnf        >/dev/null 2>&1; then PM="dnf";
elif command -v apt-get  >/dev/null 2>&1; then PM="apt-get";
elif command -v yum      >/dev/null 2>&1; then PM="yum";
fi

case "$PM" in
  apt-get)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq python3 python3-venv python3-pip curl unzip >/dev/null 2>&1 || true
    ;;
  dnf|yum)
    $PM install -y python3 python3-pip curl unzip >/dev/null 2>&1 || true
    ;;
  *)
    echo "      [!] 未识别的包管理器，跳过系统依赖安装"
    ;;
esac

# pip 兜底：部分发行版（含 TencentOS）不预装 pip，但 ensurepip 可用
if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "      pip 缺失，尝试 ensurepip 引导..."
  python3 -m ensurepip --upgrade >/dev/null 2>&1 || true
fi
if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "[✗] 未能获得 pip，请手动安装 python3-pip 后重试"
  exit 1
fi
echo "      ✓ 完成（pip 就绪）"

# ---------- 2. 虚拟环境 ----------
echo "[2/5] 创建 Python 虚拟环境..."
cd "$APP_DIR/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
echo "      ✓ 完成"

# ---------- 3. Python 依赖 ----------
echo "[3/5] 安装 Python 依赖（约 1-2 分钟，请耐心等待）..."
./venv/bin/pip install -q --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
./venv/bin/pip install -q -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
echo "      ✓ 完成"

# ---------- 4. systemd 守护 ----------
echo "[4/5] 配置 systemd 开机自启..."
cat > /etc/systemd/system/zhiyi.service <<EOF
[Unit]
Description=ZhiYi - AI Error Diagnosis System
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backend
Environment=PYTHONUNBUFFERED=1
ExecStart=$APP_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable zhiyi >/dev/null 2>&1
systemctl restart zhiyi
echo "      ✓ 完成"

# ---------- 5. 健康检查 ----------
echo "[5/5] 等待服务就绪..."
OK=0
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done

PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "你的服务器公网IP")

echo ""
echo "=============================================="
if [ "$OK" -eq 1 ]; then
  echo "  ✓ 部署成功！"
  echo ""
  echo "  访问地址：  http://$PUBLIC_IP:$PORT"
  echo "  健康检查：  http://$PUBLIC_IP:$PORT/api/health"
  echo ""
  echo "  常用命令："
  echo "    查看状态  systemctl status zhiyi"
  echo "    查看日志  journalctl -u zhiyi -f"
  echo "    重启服务  systemctl restart zhiyi"
  echo ""
  echo "  ⚠ 若浏览器打不开，请去云厂商控制台"
  echo "    「安全组 / 防火墙」放行 TCP $PORT 端口"
else
  echo "  ✗ 服务未能在 30 秒内就绪"
  echo ""
  echo "  排查命令：journalctl -u zhiyi -n 50 --no-pager"
  echo "  常见原因：上游 AI 接口不通 / .env 中 API Key 有误"
fi
echo "=============================================="
