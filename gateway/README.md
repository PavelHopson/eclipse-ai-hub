# Eclipse AI Gateway (`ai.v1`)

Server-to-server gateway for Eclipse Forge products. It keeps upstream credentials out of browser bundles and gives consumers one allowlisted OpenAI-compatible endpoint.

## Security defaults

- bearer service token is required for models and completions;
- upstream URL comes only from server environment, never from a request;
- remote upstreams require HTTPS; HTTP is loopback-only;
- model allowlist, body limit, request budget and timeout are enforced;
- prompts and upstream response bodies are not logged;
- upstream error bodies are not returned to clients;
- streaming is deliberately unavailable in the first `ai.v1` slice.

## Run locally

```bash
cp gateway/.env.example gateway/.env
# Load the values into your environment without committing gateway/.env.
npm run gateway:start
```

Health is available at `GET /health`. Protected endpoints are `GET /v1/models` and `POST /v1/chat/completions`.

The intended first upstream is the existing local OmniRoute instance. Eclipse Chat connects with its own service token and falls back to the current direct provider chain when this gateway is unavailable.

## Deployment boundary

The static AI Hub frontend deploy does not start this process. Run the gateway as a separate container or supervised service, bind it to loopback by default, and expose it to other hosts only through authenticated private networking or a TLS reverse proxy.
