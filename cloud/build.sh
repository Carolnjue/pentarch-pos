#!/usr/bin/env bash
# Builds the agent portal, copies both PWA builds into the plugin and zips it.
#   ./build.sh            build agents, copy app/dist if present, zip
#   SKIP_AGENTS=1 ./build.sh   reuse existing agents/dist
#   SKIP_POS=1 ./build.sh      leave public/pos/ as it is (don't copy app/dist)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLOUD="$ROOT/cloud"
PLUGIN="$CLOUD/pentarch-pos-cloud"
OUT="$CLOUD/pentarch-pos-cloud.zip"

say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }

# 1. Agent portal PWA
if [ -z "${SKIP_AGENTS:-}" ]; then
  say "Building agent portal (agents/)"
  cd "$ROOT/agents"
  [ -d node_modules ] || npm ci --no-audit --no-fund
  [ -f public/icons/icon-192.png ] || npm run icons
  npx vite build
fi
[ -f "$ROOT/agents/dist/index.html" ] || { echo "agents/dist missing" >&2; exit 1; }

say "Copying agents/dist → public/agents/"
rm -rf "$PLUGIN/public/agents"
mkdir -p "$PLUGIN/public/agents"
cp -R "$ROOT/agents/dist/." "$PLUGIN/public/agents/"

# 2. POS app (built by the POS engineer)
if [ -n "${SKIP_POS:-}" ]; then
  say "SKIP_POS set — leaving public/pos/ unchanged"
elif [ -f "$ROOT/app/dist/index.html" ]; then
  say "Copying app/dist → public/pos/ (keeping public/agents)"
  find "$PLUGIN/public/pos" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -R "$ROOT/app/dist/." "$PLUGIN/public/pos/"
else
  say "app/dist not found — keeping the placeholder in public/pos/"
fi

# 3. Precompressed .gz siblings for text assets (served when the browser accepts gzip)
say "Precompressing text assets"
find "$PLUGIN/public" -name '*.gz' -delete
find "$PLUGIN/public" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.webmanifest' -o -name '*.json' -o -name '*.mjs' \) -size +1k \
  -exec gzip -9 -k -n {} \;

# 4. Lint PHP
say "PHP lint"
find "$PLUGIN" -name '*.php' -print0 | xargs -0 -n1 php -l | grep -v '^No syntax errors' || true

# 5. Zip (root folder = pentarch-pos-cloud/)
say "Zipping → $OUT"
rm -f "$OUT"
cd "$CLOUD"
zip -qr -X "$OUT" pentarch-pos-cloud -x '*.DS_Store' -x '*/node_modules/*' -x '*/.git/*'
ls -lh "$OUT"
unzip -l "$OUT" | tail -1
say "Done"
