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
- [x] Complete the protected production token rotation: Chat run `30541948329` verified the dual-token grace window, switched Chat, revoked the previous credential with an explicit `401` check, and passed gateway plus external health smoke.
- [x] Add a network-locked direct Kimi K3 benchmark harness with synthetic AI Hub, Sentinel, and OMC suites; reports retain metrics and output hashes, never raw model output.
- [x] Add a bounded read-only Ads Audit with evidence and budget diff, without ad-platform credentials or mutation endpoints.
- [x] Add a four-role Research Room and an explicit no-financial-advice boundary.
- [x] Add the first Model Registry with capability filters, license/privacy/cost fields and a fail-closed Hardware Doctor.

## Next

- [ ] Observe a healthy persisted 24-hour SLO window at the 10% Chat canary.
- [x] Add per-client identities, endpoint scopes and independent request budgets while retaining a bounded legacy-token migration path.
- [ ] Add embeddings under an additive `ai.v1` endpoint.
- [ ] Add an evaluated model-routing policy instead of exposing provider-specific model names.
- [ ] Move browser cloud-provider keys to an optional local companion or server session; keep Ollama browser-local.
- [ ] Run the direct Kimi K3 suites twice with a dedicated capped test key, compare quality/latency/cost with the approved baseline, and complete the Moonshot/Kimi data-processing review before any canary.
- [ ] Keep TokenRouter blocked until owner, Terms, DPA, routing providers, retention, subprocessors, and promotion conditions are verified.

## Promotion gate

The `chat-ai-gateway` integration moves from `experimental` to `available` only after production health checks, fallback drills, token rotation and a documented SLO have passed.
