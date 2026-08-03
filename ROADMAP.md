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
- [x] Add the first owned Growth OS vertical slice: five sequential roles, bounded one-request steps,
      untrusted-source isolation, manual approval and `growth.run.v1` export without tools or publishing.

## Next

- [ ] Observe a healthy persisted 24-hour SLO window at the 10% Chat canary.
- [x] Add per-client identities, endpoint scopes and independent request budgets while retaining a bounded legacy-token migration path.
- [x] Define the DnD Forge consumer boundary: Chat-owned identity, DnD-owned BFF/user budgets and a scoped private `ai.v1` service client; browser service tokens are explicitly forbidden.
- [x] Add a fail-closed service-client registry helper so deployments can upsert or rotate one product without deleting other scoped clients or leaking their tokens.
- [x] Dark-launch the DnD BFF through the existing Chat production trust path: run `30816478509` preserved Chat access, enforced DnD least-privilege scopes and kept AI, DNS, TLS and public exposure disabled. The first AI Hub workflow attempt (`30816267048`) failed before mutation because its deploy user correctly lacked passwordless sudo; that duplicate workflow was removed.
- [ ] Add embeddings under an additive `ai.v1` endpoint.
- [ ] Add the Eclipse Chat Growth Command Room control plane with owner/member authorization,
      server-side versioning, idempotency, per-user budget and a scoped AI Hub service client.
- [ ] Run the first 30-day Eclipse Forge brand pilot only after the Chat control plane and aggregate
      measurement exist; keep publication, outreach, Ads API and payments behind separate approvals.
- [ ] Add an evaluated model-routing policy instead of exposing provider-specific model names.
- [ ] Move browser cloud-provider keys to an optional local companion or server session; keep Ollama browser-local.
- [ ] Run the direct Kimi K3 suites twice with a dedicated capped test key, compare quality/latency/cost with the approved baseline, and complete the Moonshot/Kimi data-processing review before any canary.
- [ ] Keep TokenRouter blocked until owner, Terms, DPA, routing providers, retention, subprocessors, and promotion conditions are verified.
- [x] Approve and implement the short-lived Chat-issued Auth Code + PKCE identity contract and the DnD BFF security boundary. Keep the production signing key, DnD service credential and public endpoint disabled until the dark-launch runtime, DNS and TLS gates pass. See `docs/dnd-forge-gateway-contract.md`.

## Promotion gate

The `chat-ai-gateway` integration moves from `experimental` to `available` only after production health checks, fallback drills, token rotation and a documented SLO have passed.
