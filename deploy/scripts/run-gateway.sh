#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_AI_HUB_GATEWAY_PATH:-/var/www/eclipse-ai-hub-gateway}"
ENV_FILE="${AI_GATEWAY_ENV_FILE:-/etc/eclipse-ai-gateway.env}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Gateway environment is not readable: $ENV_FILE" >&2
  exit 1
fi

set -a
# The file is root-managed and checked by sync-gateway-supervisor.sh.
source "$ENV_FILE"
set +a

cd "$DEPLOY_PATH"
exec /usr/bin/node gateway/src/server.mjs
