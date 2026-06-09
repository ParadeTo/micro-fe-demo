#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF=/tmp/micro-fe-nginx.conf

# Detect mime.types path (openresty on macOS vs standard nginx on Linux)
if [ -f /usr/local/etc/openresty/mime.types ]; then
  MIME_TYPES=/usr/local/etc/openresty/mime.types
elif [ -f /etc/nginx/mime.types ]; then
  MIME_TYPES=/etc/nginx/mime.types
else
  MIME_TYPES=/usr/local/etc/nginx/mime.types
fi

sed -e "s|MICRO_FE_ROOT|${ROOT}|g" \
    -e "s|NGINX_MIME_TYPES|${MIME_TYPES}|g" \
    "${ROOT}/nginx/nginx.conf.template" > "$CONF"

nginx -c "$CONF"
echo "nginx started on http://localhost:8080 (root: ${ROOT}/micro-apps)"
