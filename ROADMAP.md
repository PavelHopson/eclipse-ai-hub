# Eclipse AI Hub roadmap

## Current release slice

- [x] Keep the existing browser BYOK modules independent from server credentials.
- [x] Publish the server-to-server `contracts/ai.v1.openapi.yaml` contract.
- [x] Add a dependency-free gateway runtime with service auth, model allowlist, request limits, safe telemetry and sanitized failures.
- [x] Add contract and security regression tests to the default test command.
- [x] Pin GitHub checkout and Node setup actions by commit SHA.
- [ ] Deploy the gateway as a separate supervised service or container.
- [ ] Run the Eclipse Chat canary against the production OmniRoute instance.

## Next

- [ ] Persist cost, latency and error telemetry without prompt content.
- [ ] Add per-client scopes and independent request budgets.
- [ ] Add embeddings under an additive `ai.v1` endpoint.
- [ ] Add an evaluated model-routing policy instead of exposing provider-specific model names.
- [ ] Move browser cloud-provider keys to an optional local companion or server session; keep Ollama browser-local.

## Promotion gate

The `chat-ai-gateway` integration moves from `experimental` to `available` only after production health checks, fallback drills, token rotation and a documented SLO have passed.
