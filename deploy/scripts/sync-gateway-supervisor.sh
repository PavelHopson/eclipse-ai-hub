#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_AI_HUB_GATEWAY_PATH:-/var/www/eclipse-ai-hub-gateway}"
ENV_FILE="${AI_GATEWAY_ENV_FILE:-/etc/eclipse-ai-gateway.env}"
SOURCE="$DEPLOY_PATH/deploy/supervisor/eclipse-ai-gateway.conf"
TARGET="/etc/supervisor/conf.d/eclipse-ai-gateway.conf"

if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ || ! "$ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "Gateway paths contain unsupported characters" >&2
  exit 1
fi
if [[ ! -f "$SOURCE" || ! -r "$ENV_FILE" ]]; then
  echo "Gateway checkout or environment file is missing" >&2
  exit 1
fi
if [[ "$(stat -c '%U' "$ENV_FILE")" != "root" ]]; then
  echo "Gateway environment must be owned by root" >&2
  exit 1
fi
MODE="$(stat -c '%a' "$ENV_FILE")"
if [[ "${MODE: -1}" != "0" ]]; then
  echo "Gateway environment must not be readable by other users" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a
cd "$DEPLOY_PATH"
node --input-type=module -e "import('./gateway/src/config.mjs').then(({ loadGatewayConfig }) => loadGatewayConfig())"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT
sed \
  -e "s|@@DEPLOY_PATH@@|$DEPLOY_PATH|g" \
  -e "s|@@ENV_FILE@@|$ENV_FILE|g" \
  "$SOURCE" > "$TMP_FILE"

if [[ ! -f "$TARGET" ]] || ! cmp -s "$TMP_FILE" "$TARGET"; then
  install -o root -g root -m 0644 "$TMP_FILE" "$TARGET"
  supervisorctl reread
  supervisorctl update
fi

supervisorctl restart eclipse-ai-gateway
sleep 2
AI_GATEWAY_SMOKE_BASE_URL="http://127.0.0.1:${AI_GATEWAY_PORT:-8810}" \
  node gateway/scripts/smoke.mjs
supervisorctl status eclipse-ai-gateway
