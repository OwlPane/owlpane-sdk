#!/usr/bin/env bash
# Forward Hetzner owlpane-ingest to localhost for SaaS dogfood (see .env.production-saas.bak).
set -euo pipefail
CTX="${KUBE_CTX:-crikiq-hetzner}"
NS="${OWLPANE_NAMESPACE:-owlpane-platform}"
LOCAL_PORT="${OWLPANE_SAAS_INGEST_LOCAL_PORT:-14318}"
PIDFILE="${OWLPANE_SAAS_PF_PIDFILE:-/tmp/owlpane-saas-ingest-pf.pid}"

case "${1:-start}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "port-forward already running (pid $(cat "$PIDFILE") → 127.0.0.1:${LOCAL_PORT})"
      exit 0
    fi
    kubectl --context "$CTX" -n "$NS" port-forward "svc/owlpane-ingest" "${LOCAL_PORT}:4318" &
    echo $! > "$PIDFILE"
    for _ in $(seq 1 15); do
      curl -fsS -m 2 "http://127.0.0.1:${LOCAL_PORT}/healthz" >/dev/null && break
      sleep 1
    done
    curl -fsS "http://127.0.0.1:${LOCAL_PORT}/healthz" >/dev/null
    echo "SaaS ingest → http://127.0.0.1:${LOCAL_PORT} (pid $(cat "$PIDFILE"))"
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
    fi
    pkill -f "port-forward svc/owlpane-ingest ${LOCAL_PORT}:4318" 2>/dev/null || true
    echo "stopped"
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "running pid $(cat "$PIDFILE")"
      curl -fsS "http://127.0.0.1:${LOCAL_PORT}/healthz" && echo
    else
      echo "not running"
      exit 1
    fi
    ;;
  *) echo "Usage: $0 start|stop|status" >&2; exit 1 ;;
esac
