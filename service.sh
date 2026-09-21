#!/bin/bash
# 服务管理：./service.sh start|stop|restart|status|logs|install|uninstall
set -u

LABEL="com.han.xhs-note"
DIR="/Users/han/Documents/Mr_Han/other/workbuddy/2026-09-10小红书笔记生成（根据提示词生成）"
PLIST_SRC="$DIR/$LABEL.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_OUT="$HOME/Library/Logs/xhs-note.out.log"
LOG_ERR="$HOME/Library/Logs/xhs-note.err.log"
UID_NOW="$(id -u)"

usage() {
  echo "用法: ./service.sh install|start|stop|restart|status|logs|uninstall|enable-old"
}

install() {
  # 先清掉可能占着端口的临时进程，避免 launchd 起来后 EADDRINUSE 反复重启
  OLD_PID="$(lsof -ti tcp:3000 2>/dev/null)"
  if [ -n "$OLD_PID" ]; then
    echo "发现 3000 端口被进程 $OLD_PID 占用，先停止它…"
    kill $OLD_PID 2>/dev/null
    sleep 2
  fi

  cp "$PLIST_SRC" "$PLIST_DST"
  launchctl bootout "gui/$UID_NOW/$LABEL" 2>/dev/null

  if launchctl bootstrap "gui/$UID_NOW" "$PLIST_DST"; then
    launchctl enable "gui/$UID_NOW/$LABEL"
    echo "已注册到 launchd"
  else
    echo ""
    echo "注册失败：当前终端不在图形会话里（常见于被其它程序调起的 shell）。"
    echo "请在你自己打开的「终端 App」里重新执行："
    echo "    cd \"$DIR\" && ./service.sh install"
    echo ""
    echo "plist 已放在 ${PLIST_DST} ，下次登录时也会自动加载。"
    exit 1
  fi

  sleep 2
  status
}

start()   { launchctl kickstart -k "gui/$UID_NOW/$LABEL" && sleep 2 && status; }
stop()    { launchctl bootout "gui/$UID_NOW/$LABEL" && echo "已停止（并取消开机自启）"; }
restart() { launchctl kickstart -k "gui/$UID_NOW/$LABEL" && sleep 2 && status; }

status() {
  if launchctl print "gui/$UID_NOW/$LABEL" >/dev/null 2>&1; then
    echo "● 已托管并运行中"
    launchctl print "gui/$UID_NOW/$LABEL" 2>/dev/null | grep -E "^\s+(state|pid|last exit)" | head -5
  else
    echo "○ 未托管（运行 ./service.sh install 安装）"
  fi
  code=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:3000/api/config)
  if [ "$code" = "200" ]; then
    echo "● http://localhost:3000 响应正常 (200)"
  else
    echo "○ http://localhost:3000 无响应 ($code)"
  fi
}

logs() {
  echo "=== 标准输出 (最近 30 行) ==="
  tail -n 30 "$LOG_OUT" 2>/dev/null || echo "无日志"
  echo "=== 错误输出 (最近 30 行) ==="
  tail -n 30 "$LOG_ERR" 2>/dev/null || echo "无日志"
}

case "${1:-}" in
  install)   install ;;
  start)     start ;;
  stop)      stop ;;
  restart)   restart ;;
  status)    status ;;
  logs)      logs ;;
  uninstall) launchctl bootout "gui/$UID_NOW/$LABEL" 2>/dev/null; rm -f "$PLIST_DST"; echo "已卸载自启" ;;
  enable-old)  launchctl enable "gui/$UID_NOW/com.user.xhsgenerator" && echo "已恢复旧服务 com.user.xhsgenerator（需重新 install 才会加载）" ;;
  *)         usage; exit 1 ;;
esac
