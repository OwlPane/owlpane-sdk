#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh node
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-owlpane-demo-server}"

npm install --no-audit --no-fund
npm run start
