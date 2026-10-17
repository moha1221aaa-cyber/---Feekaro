#!/bin/sh
# يركّب Graphify لو مو موجود، ويبني خريطة الكود (graphify-out/). يشتغل بالخلفية أول كل جلسة Claude.
# الكود يتحلل محلياً بدون ذكاء اصطناعي ولا يطلع لأي مكان (GRAPHIFY_BACKEND=none).
cd "$(dirname "$0")/.." || exit 0
if ! command -v graphify >/dev/null 2>&1; then
  NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 pip install -q --break-system-packages graphifyy >/dev/null 2>&1 || exit 0
fi
GRAPHIFY_BACKEND=none graphify update . >/dev/null 2>&1 || true
