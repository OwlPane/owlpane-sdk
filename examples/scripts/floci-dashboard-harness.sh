#!/usr/bin/env bash
# Local AWS-shaped metrics path for library dashboards (Floci + agent cloudScrapes).
# Requires: floci CLI, docker, Owlpane agent with integrations.cloudScrapes pointed at exporter.
#
#   ./scripts/floci-dashboard-harness.sh start   # Floci + placeholder exporter notes
#   ./scripts/floci-dashboard-harness.sh stop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${TMPDIR:-/tmp}/owlpane-floci.pid"

case "${1:-}" in
  start)
    if ! command -v floci >/dev/null 2>&1; then
      echo "Install Floci: https://floci.io/" >&2
      exit 1
    fi
    floci start
    # shellcheck disable=SC1090
    eval "$(floci env)"
    export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"
    echo "Floci AWS at $AWS_ENDPOINT_URL"
    echo "Next: run a CloudWatch/YACE-style exporter against Floci, then add agent integrations.cloudScrapes."
    echo "Validate one metrics dashboard (e.g. AWS SQS) and one logs dashboard after log pipeline exists."
    echo "$$" >"$PIDFILE"
    ;;
  stop)
    floci stop 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "stopped"
    ;;
  *)
    echo "Usage: $0 start|stop" >&2
    exit 1
    ;;
esac
