#!/bin/bash
# Night Shift 强制执行脚本
# 每小时检查 night shift 是否在运行，如未运行则自动启动

CLAUDE_DIR="/Users/magnus/code/ai-ppt-generator"
NIGHT_SHIFT_DIR="$CLAUDE_DIR/.night-shift/runs"

# 检查最近是否有活跃 shift（1小时内）
recent_run=false
if [ -d "$NIGHT_SHIFT_DIR" ]; then
  latest_run=$(find "$NIGHT_SHIFT_DIR" -maxdepth 1 -type d -name "2*" | sort -r | head -1)
  if [ -n "$latest_run" ]; then
    run_time=$(stat -f "%m" "$latest_run" 2>/dev/null || stat -c "%Y" "$latest_run" 2>/dev/null)
    now=$(date +%s)
    diff=$((now - run_time))
    if [ $diff -lt 3600 ]; then
      recent_run=true
    fi
  fi
fi

# 检查是否有 running 状态的 shift
has_running=false
for f in "$NIGHT_SHIFT_DIR"/*/state.json; do
  [ -e "$f" ] || continue
  status=$(jq -r .status "$f" 2>/dev/null)
  if [ "$status" = "running" ]; then
    has_running=true
    break
  fi
done

if [ "$has_running" = true ]; then
  echo "[$(date)] Night shift is running, no action needed"
  exit 0
fi

if [ "$recent_run" = true ]; then
  echo "[$(date)] Recent night shift found (within 1 hour), waiting..."
  exit 0
fi

# 强制启动 night shift
echo "[$(date)] No recent night shift, starting forced execution..."
cd "$CLAUDE_DIR" || exit 1

# 使用 nohup 后台运行，捕获 PID
nohup claude --dangerously-skip-permissions -e "启动 night shift: Phase H 验收补全 + Phase I API集成 + Phase J 生产化" --headless 2>&1 &
echo "[$(date)] Night shift forced start initiated with PID $!"