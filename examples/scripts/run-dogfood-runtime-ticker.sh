#!/usr/bin/env bash
# Re-emit one rich burst per runtime on an interval (Java/Python/Ruby/Go/Rust/PHP/.NET/RN/Serverless).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${DOGFOOD_RUNTIME_TICK_SEC:-45}"
APPS=(go java python ruby rust php dotnet react-native serverless)

while true; do
  for id in "${APPS[@]}"; do
    if [[ -x "$ROOT/apps/$id/run.sh" ]]; then
      echo "[dogfood-ticker] $id"
      "$ROOT/apps/$id/run.sh" || echo "[dogfood-ticker] $id failed (continuing)" >&2
    fi
  done
  sleep "$INTERVAL"
done
