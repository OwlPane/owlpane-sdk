#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh demo-server

if [ "${OWLPANE_SDK_SOURCE:-}" != "published" ] || [ ! -f node_modules/@owlpane/node/package.json ]; then
  npm install --include=dev --no-audit --no-fund
fi
npm run start
