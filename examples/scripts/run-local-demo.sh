#!/usr/bin/env bash
# End-to-end local stack runner for Owlpane SDK examples.
# Usage:
#   ./scripts/run-local-demo.sh --once   # emit rich traces, metrics, logs, and RUM across all SDKs
#   ./scripts/run-local-demo.sh --loop   # run continuous demo-server traffic against local cell (:4318)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---once}"

export OWLPANE_API_URL="${OWLPANE_API_URL:-http://127.0.0.1:4100}"
export OWLPANE_INGEST_URL="${OWLPANE_INGEST_URL:-http://127.0.0.1:4318}"
export OWLPANE_ENVIRONMENT="${OWLPANE_ENVIRONMENT:-development}"
export OWLPANE_DOGFOOD_MODE="${OWLPANE_DOGFOOD_MODE:-rich}"

if [ ! -f "$ROOT/.env" ] || ! grep -q '^OWLPANE_INGEST_KEY_NODE=owl_ing_' "$ROOT/.env" 2>/dev/null; then
  echo "Onboarding SDK example projects against ${OWLPANE_API_URL}…"
  node "$ROOT/scripts/onboard-dogfood.mjs" --write-env
fi

if [ "$MODE" = "--loop" ]; then
  echo "Starting continuous demo-server against ${OWLPANE_INGEST_URL}…"
  chmod +x "$ROOT/apps/demo-server/run.sh"
  exec "$ROOT/apps/demo-server/run.sh"
else
  echo "Running one-shot rich telemetry pass across all example apps…"
  chmod +x "$ROOT/run-dogfood.sh"
  "$ROOT/run-dogfood.sh"
  echo ""
  echo "Local Console Verification Checklist (http://127.0.0.1:5173):"
  echo "  1. Applications -> Node.js / Python / Go / Java / Ruby (env: ${OWLPANE_ENVIRONMENT})"
  echo "  2. Traces       -> Filter service.name = owlpane-sdk-* (inspect GET /demo -> SELECT orders & POST /checkout)"
  echo "  3. Logs         -> Filter service.name = owlpane-sdk-node (verify correlated trace_id / span_id)"
  echo "  4. Metrics      -> Query owlpane.dogfood.requests or http.server.request.duration"
  echo "  5. Frontend/RUM -> Verify owlpane-sdk-browser page load, feature flag, and exception spans"
  echo "  6. Dashboards   -> Open /observability/dashboards/library or /templates and install a starter pack"
fi
