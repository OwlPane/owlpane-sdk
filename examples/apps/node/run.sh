#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=../../_lib/dogfood-env.sh
source ../../_lib/dogfood-env.sh node

if [ "${OWLPANE_SDK_SOURCE:-}" != "published" ] || [ ! -d node_modules/@owlpane/node ]; then
  npm install --include=dev --no-audit --no-fund
fi
npm run start
