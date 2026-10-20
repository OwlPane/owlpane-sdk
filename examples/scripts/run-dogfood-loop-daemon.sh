#!/usr/bin/env bash
# Detached continuous demo-server (traces/metrics/logs every ~3s → local ingest).
#   ./scripts/run-dogfood-loop-daemon.sh start|stop|status|restart
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/demo-server"
PIDFILE="${OWLPANE_DEMO_PIDFILE:-/tmp/owlpane-demo-server.pid}"
LOG="${OWLPANE_DEMO_LOG:-/tmp/owlpane-demo-server.log}"

read_pid() {
  if [ -f "$PIDFILE" ]; then
    tr -d ' \n' < "$PIDFILE"
  fi
}

running_pid() {
  local pid="${1:-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

find_listener_pid() {
  lsof -t -iTCP:4399 -sTCP:LISTEN 2>/dev/null | head -1 || true
}

ensure_env() {
  export OWLPANE_API_URL="${OWLPANE_API_URL:-http://127.0.0.1:4100}"
  export OWLPANE_INGEST_URL="${OWLPANE_INGEST_URL:-http://127.0.0.1:4318}"
  export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
  if [ ! -f "$ROOT/.env" ] || ! grep -q '^OWLPANE_INGEST_KEY_DEMO=owl_ing_' "$ROOT/.env" 2>/dev/null; then
    node "$ROOT/scripts/onboard-dogfood.mjs" --write-env
  fi
}

start() {
  local pid
  pid="$(read_pid)"
  if running_pid "$pid"; then
    echo "demo-server already running (pid $pid, log $LOG)"
    return 0
  fi
  pid="$(find_listener_pid)"
  if [ -n "$pid" ]; then
    echo "$pid" > "$PIDFILE"
    echo "demo-server already listening on :4399 (pid $pid, log $LOG)"
    return 0
  fi

  ensure_env
  echo "Starting continuous dogfood → ${OWLPANE_INGEST_URL} (log $LOG)"
  {
    echo "--- $(date -u +%Y-%m-%dT%H:%M:%SZ) demo-server start ---"
    cd "$APP"
    # shellcheck source=../../_lib/dogfood-env.sh
    source "$ROOT/_lib/dogfood-env.sh" demo-server
    npm install --no-audit --no-fund
    exec npm run start
  } >> "$LOG" 2>&1 &
  disown 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    pid="$(find_listener_pid)"
    if [ -n "$pid" ]; then
      echo "$pid" > "$PIDFILE"
      echo "demo-server started (pid $pid, http://127.0.0.1:4399, log $LOG)"
      return 0
    fi
  done
  echo "demo-server failed to start; see $LOG" >&2
  tail -25 "$LOG" >&2 || true
  rm -f "$PIDFILE"
  return 1
}

stop() {
  local pid
  pid="$(read_pid)"
  if running_pid "$pid"; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    running_pid "$pid" && kill -9 "$pid" 2>/dev/null || true
  fi
  pid="$(find_listener_pid)"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
  echo "demo-server stopped"
}

status() {
  local pid
  pid="$(read_pid)"
  if running_pid "$pid"; then
    echo "running pid=$pid log=$LOG"
    curl -sf "http://127.0.0.1:4399/demo" 2>/dev/null | head -c 120 || true
    echo
    return 0
  fi
  pid="$(find_listener_pid)"
  if [ -n "$pid" ]; then
    echo "$pid" > "$PIDFILE"
    echo "running pid=$pid (adopted) log=$LOG"
    return 0
  fi
  echo "not running"
  return 1
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac
