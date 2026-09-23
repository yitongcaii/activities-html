#!/usr/bin/env bash
# 裸 VM 部署：装依赖 + pm2 守护启动
# 用法：bash deploy/start.sh
set -e
cd "$(dirname "$0")/.."

# 1. 安装生产依赖（若 node_modules 缺失）
if [ ! -d node_modules ]; then
  npm install --omit=dev
fi

# 2. 确保 uploads 子目录存在（运行态写目录）
mkdir -p uploads/banners uploads/avatars uploads/avatars-cache

# 3. 用 pm2 启动（无 pm2 则全局安装）
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 start deploy/ecosystem.config.js

# 4. 设置开机自启（需 root 执行一次）
# pm2 save && pm2 startup

echo "已启动。访问 http://localhost:${PORT:-8080}"
