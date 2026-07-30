# Eclipse AI Hub roadmap

## Current release slice

- [x] Keep the existing browser BYOK modules independent from server credentials.
- [x] Publish the server-to-server `contracts/ai.v1.openapi.yaml` contract.
- [x] Add a dependency-free gateway runtime with service auth, model allowlist, request limits, safe telemetry and sanitized failures.
- [x] Add contract and security regression tests to the default test command.
- [x] Pin GitHub checkout and Node setup actions by commit SHA.
- [x] Add a root-owned environment, Supervisor and authenticated smoke deployment path.
- [x] Deploy the gateway as a loopback-only Supervisor service on the Chat production host.
- [x] Run the Eclipse Chat 10% canary against production OmniRoute with authenticated health, models and completion smoke checks.
- [x] Run and record the production `10% -> 0% -> 10%` fallback drill: run `30537812900` verified direct `omniroute`, run `30538064539` restored and verified `eclipse-ai-hub`; external Chat health stayed green.
- [x] Persist hourly aggregate cost, token, latency and error telemetry without prompt content or identifiers; expose authenticated `1h/24h/7d` SLO windows.
- [x] Document the Chat gateway SLO and support a bounded dual-token grace window for zero-downtime credential rotation.

## Next

- [ ] Observe a healthy persisted 24-hour SLO window at the 10% Chat canary.
- [ ] Add per-client scopes and independent request budgets.
- [ ] Add embeddings under an additive `ai.v1` endpoint.
- [ ] Add an evaluated model-routing policy instead of exposing provider-specific model names.
- [ ] Move browser cloud-provider keys to an optional local companion or server session; keep Ollama browser-local.

## Promotion gate

The `chat-ai-gateway` integration moves from `experimental` to `available` only after production health checks, fallback drills, token rotation and a documented SLO have passed.
