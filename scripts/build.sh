#!/usr/bin/env bash
# Build all production artifacts
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building micro-app bundles..."
cd "$ROOT/rn_demo"
pnpm build:web

echo "==> Building h5-pages (static)..."
cd "$ROOT/h5-pages"
pnpm generate

echo ""
echo "Build complete."
echo "  micro-apps/ → nginx /task-list/ /banners/"
echo "  h5-pages/.output/public/ → nginx /"
