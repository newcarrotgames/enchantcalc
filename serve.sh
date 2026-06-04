#!/usr/bin/env bash
# Start the RLCraft Enchant Calculator dev server (Vite).
#
# Usage:
#   ./start.sh            # start the dev server
#   ./start.sh --build    # production build, then preview the built site
#
# Installs npm dependencies automatically on first run.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "node_modules not found, installing dependencies..."
  npm install
fi
if [ "${1:-}" = "--build" ]; then
  npm run build
  exec npm run preview
fi
exec npm run dev