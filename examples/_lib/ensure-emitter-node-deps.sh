#!/usr/bin/env bash
# Emitter apps (rust/php/…) use ../apps/node for dogfood-rich-emit.mjs.
if [ "${OWLPANE_SDK_SOURCE:-}" = "published" ] && [ -d ../node/node_modules/@owlpane/node ]; then
  return 0 2>/dev/null || exit 0
fi
(cd ../node && npm install --no-audit --no-fund --silent)
