#!/usr/bin/env bash
# Phase 2 (restaurant, services, quotes) flows only. Same env as run-all.sh (BASE, CLOUD). Output → qa/results-p2.txt
cd "$(dirname "$0")/../.." || exit 1
OUT=qa/results-p2.txt
: > "$OUT"
for s in flows-restaurant flows-services flows-quotes flows-kds-sync; do
  echo "===== $s" | tee -a "$OUT"
  node "qa/scripts/$s.mjs" 2>&1 | grep -vE "^\s*$" | tee -a "$OUT"
done
echo "passed steps: $(grep -c '✔' "$OUT")   failed steps: $(grep -c '✘' "$OUT")" | tee -a "$OUT"
