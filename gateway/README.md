# Eclipse AI Gateway (`ai.v1`)

Server-to-server gateway for Eclipse Forge products. It keeps upstream credentials out of browser bundles and gives consumers one allowlisted OpenAI-compatible endpoint.

## Security defaults

- bearer service token is required for models and completions;
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
