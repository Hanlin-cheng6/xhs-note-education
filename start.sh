#!/bin/bash
# 由 launchd 调用，不要手动执行。手动管理请用 ./service.sh
set -u

DIR="/Users/han/Documents/Mr_Han/other/workbuddy/2026-09-10小红书笔记生成（根据提示词生成）"
cd "$DIR" || { echo "目录不存在: $DIR"; exit 1; }

# 依次探测可用的 node：托管版（自动取最新）→ 系统版 → PATH
NODE=""
MANAGED="$(ls -d /Users/han/.workbuddy/binaries/node/versions/*/bin/node 2>/dev/null | sort -V | tail -1)"
for cand in \
  "$MANAGED" \
  "/usr/local/bin/node" \
  "/opt/homebrew/bin/node" \
  "$(command -v node 2>/dev/null)"
do
  if [ -n "$cand" ] && [ -x "$cand" ]; then NODE="$cand"; break; fi
done

if [ -z "$NODE" ]; then
  echo "找不到可用的 node"
  exit 1
fi

export PORT="${PORT:-3000}"
echo "[start.sh] $(date '+%F %T') 使用 $NODE 启动于端口 $PORT"
exec "$NODE" server.js
