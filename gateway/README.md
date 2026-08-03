# Eclipse AI Gateway (`ai.v1`)

Server-to-server gateway for Eclipse Forge products. It keeps upstream credentials out of browser bundles and gives consumers one allowlisted OpenAI-compatible endpoint.

## Security defaults

- bearer service token is required for every protected endpoint;
- each product can have its own identity, scopes and independent minute budget;
- upstream URL comes only from server environment, never from a request;
- remote upstreams require HTTPS; HTTP is loopback-only;
- model allowlist, body limit, request budget and timeout are enforced;
- prompts and upstream response bodies are not logged;
- upstream error bodies are not returned to clients;
- only hourly aggregate telemetry is persisted; prompts, responses and identifiers are not stored;
- streaming is deliberately unavailable in the first `ai.v1` slice.

## Run locally

```bash
cp gateway/.env.example gateway/.env
# Load the values into your environment without committing gateway/.env.
npm run gateway:start
```

Health is available at `GET /health`. Protected endpoints are `GET /v1/models`, `GET /v1/telemetry` and `POST /v1/chat/completions`.

Production can persist telemetry with:

```dotenv
AI_GATEWAY_TELEMETRY_FILE=/var/lib/eclipse-ai-gateway/telemetry.json
AI_GATEWAY_TELEMETRY_RETENTION_HOURS=168
AI_GATEWAY_SLO_AVAILABILITY_PERCENT=99
AI_GATEWAY_SLO_P95_LATENCY_MS=15000
```

The telemetry file contains counters, a latency histogram, token totals and upstream-reported cost only. See `docs/chat-gateway-slo.md` for the promotion policy.

`AI_GATEWAY_SERVICE_TOKENS` accepts up to four comma-separated tokens during a controlled rotation. Normal operation should return to the singular `AI_GATEWAY_SERVICE_TOKEN` after the new client token is verified.

For multiple products, replace the legacy token variables with `AI_GATEWAY_SERVICE_CLIENTS`.
The JSON array accepts no more than 32 clients. Tokens must be unique across clients,
and every client gets an independent fixed-window request budget:

```dotenv
AI_GATEWAY_SERVICE_CLIENTS='[{"id":"eclipse-chat","tokens":["replace-with-a-random-32-plus-character-token"],"scopes":["models:read","telemetry:read","chat:write"],"requestsPerMinute":90},{"id":"hopson-sentinel","tokens":["replace-with-another-random-32-plus-character-token"],"scopes":["models:read","chat:write"],"requestsPerMinute":30}]'
```

Available scopes are `models:read`, `telemetry:read` and `chat:write`. A controlled
rotation can temporarily place up to four tokens in one client's `tokens` array.
Do not configure legacy token variables at the same time as service clients.

Deployment scripts must update one client without reconstructing the registry by
hand. The dependency-free helper validates the complete registry, preserves other
products and emits compact JSON suitable for a root-owned environment file:

```bash
SERVICE_CLIENTS_JSON="$AI_GATEWAY_SERVICE_CLIENTS" \
CLIENT_ID=eclipse-dnd-forge \
CLIENT_TOKENS="$DND_GATEWAY_TOKEN" \
CLIENT_SCOPES=models:read,chat:write \
CLIENT_REQUESTS_PER_MINUTE=30 \
node gateway/scripts/service-clients.mjs upsert
```

Capture the output directly into a shell variable; do not print it, enable shell
tracing or store it in CI artifacts. The DnD client intentionally does not receive
`telemetry:read`.

The intended first upstream is the existing local OmniRoute instance. Eclipse Chat connects with its own service token and falls back to the current direct provider chain when this gateway is unavailable.

## Deployment boundary

The static AI Hub frontend deploy does not start this process. Run the gateway as a separate container or supervised service, bind it to loopback by default, and expose it to other hosts only through authenticated private networking or a TLS reverse proxy.

The production Supervisor assets live in `deploy/`. They expect the checkout at
`/var/www/eclipse-ai-hub-gateway` and a root-owned environment file at
`/etc/eclipse-ai-gateway.env`. The environment file must not be world-readable.

```bash
sudo ECLIPSE_AI_HUB_GATEWAY_PATH=/var/www/eclipse-ai-hub-gateway \
  AI_GATEWAY_ENV_FILE=/etc/eclipse-ai-gateway.env \
  bash deploy/scripts/sync-gateway-supervisor.sh
```

The sync script validates configuration before restarting the process and runs
authenticated health/model checks afterwards. A completion smoke is opt-in:

```bash
set -a
. /etc/eclipse-ai-gateway.env
set +a
AI_GATEWAY_SMOKE_COMPLETION=1 npm run gateway:smoke
```
