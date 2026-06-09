#!/usr/bin/env bash
# Start API server + nginx. Run scripts/build.sh first.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${MICRO_FE_API_PORT:-3001}"

# Stop any previous nginx instance
pkill -f "nginx.*micro-fe" 2>/dev/null || true
sleep 0.3

# Start API server only if port is not already in use
if lsof -ti :"$API_PORT" >/dev/null 2>&1; then
  echo "==> API server already running on :${API_PORT}, reusing."
  API_PID=$(lsof -ti :"$API_PORT" | head -1)
else
  echo "==> Starting API server on :${API_PORT}..."
  cd "$ROOT/server"
  PORT="$API_PORT" node src/index.js &
  API_PID=$!
  echo "    PID $API_PID"
fi

echo "==> Starting nginx on :8080..."
MICRO_FE_API_PORT="$API_PORT" bash "$ROOT/nginx/start.sh"

echo ""
echo "All services running. Press Ctrl+C to stop nginx (API server unaffected if pre-existing)."
echo "  http://localhost:8080          → h5-pages"
echo "  http://localhost:8080/api/     → API (:${API_PORT})"
echo "  http://localhost:8080/task-list/ → TaskList micro-app"
echo "  http://localhost:8080/banners/   → Banners micro-app"
