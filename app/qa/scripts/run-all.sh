#!/usr/bin/env bash
# Runs every test: unit tests, i18n check, all Playwright flows against the mock cloud, sync + onboarding against the real
# WordPress cloud (if it answers on :8080), performance and the visual passes. Output → qa/results.txt
# Needs: `npm run build`, `npm run preview` (:4173) and `npm run mock-cloud` (:8787); for the real cloud also
#        `POS_CLOUD=http://127.0.0.1:8080 npx vite preview --port 4174 --strictPort`.
# Optional: OLD_DIST=<dist of the Phase 1 build (git c775899)> runs the v1 → v2 database upgrade test.
# Run it SERIALLY on an otherwise idle machine — the wedge-scanner and sync steps are timing-sensitive under CPU load.
cd "$(dirname "$0")/../.." || exit 1
OUT=qa/results.txt
: > "$OUT"
run() { echo "===== $*" | tee -a "$OUT"; "$@" 2>&1 | grep -vE "^\s*$" | tee -a "$OUT"; }
run npm test --silent
run node scripts/i18n-check.mjs
for s in smoke flows-sell flows-products flows-shell flows-sync flows-onboarding first-time-cashier empty-states flows-types flows-reports flows-inventory flows-restaurant flows-services flows-quotes flows-kds-sync flows-demo-embed first-time-cashier-p2 perf; do
  run node qa/scripts/$s.mjs
done
LANG_UI=sw run node qa/scripts/first-time-cashier.mjs
LANG_UI=sw run node qa/scripts/first-time-cashier-p2.mjs
if [ -n "$OLD_DIST" ]; then run node qa/scripts/upgrade-v1.mjs; else echo "===== upgrade-v1 skipped (set OLD_DIST)" | tee -a "$OUT"; fi
if curl -s -m 3 http://127.0.0.1:8080/wp-json/pentarch-pos/v1/public/ping | grep -q '"ok":true'; then
  CLOUD=http://127.0.0.1:8080 BASE=http://localhost:4174/pos/ run node qa/scripts/flows-sync.mjs
  CLOUD=http://127.0.0.1:8080 BASE=http://localhost:4174/pos/ run node qa/scripts/flows-onboarding.mjs
else
  echo "===== real cloud not running on :8080 — skipped" | tee -a "$OUT"
fi
run node qa/scripts/visual.mjs desk touch phone
LANG_UI=sw run node qa/scripts/visual.mjs desk phone
run node qa/scripts/visual-reports.mjs desk touch phone
LANG_UI=sw run node qa/scripts/visual-reports.mjs desk phone
run node qa/scripts/visual-inventory.mjs desk touch phone
LANG_UI=sw run node qa/scripts/visual-inventory.mjs desk phone
run node qa/scripts/visual-p2.mjs desk touch phone
LANG_UI=sw run node qa/scripts/visual-p2.mjs desk phone
echo "===== summary" | tee -a "$OUT"
echo "passed steps: $(grep -c '✔' "$OUT")   failed steps: $(grep -c '✘' "$OUT")" | tee -a "$OUT"
