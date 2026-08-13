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
- [x] Add Editor Stylist v1: source text is isolated as data, locked facts fail closed,
      provider disclosure is visible and copying requires explicit human confirmation.
- [x] Add the dedicated `growth:execute` gateway scope and fixed server-side Growth endpoint for the Eclipse Chat control plane.
- [x] Enforce role-specific Growth JSON outputs, allowlisted evidence references and fail-closed handoff validation.
- [x] Add optional typed Evidence Cards and claim-ID binding for Researcher and Claim Auditor without breaking legacy exports.
- [x] Add Deck Studio: deterministic local outline, editable slides and notes, fail-closed review, deck.job.v1 schema/export and an explicit no-PPTX-yet boundary.
- [x] Add the first clean-room Eclipse AI Builder slice: bounded brief, deterministic blueprint,
      responsive preview, gated build queue, human approval and `builder.project.v1` export without
      code execution, GitHub, payments or deploy.

## Next

- [ ] Add a tenant-scoped Builder Room in Eclipse Chat with schema validation, ownership,
      optimistic versioning and approval reset on import.
- [x] Add an isolated deterministic template renderer that emits eight allowlisted React/Vite files
      as `builder.files.v1` without writing, installing, executing, networking or deploying.
- [x] Add a local dry-run-first workspace materializer with an exact path allowlist, explicit
      `--write`, create-only files, rollback and fail-closed handling for non-empty paths and symlinks.
- [x] Add an in-memory offline verifier for exact dependencies, SPDX licenses, dated advisory
      evidence and static source preview without writing, installing, executing, networking or deploying.
- [ ] Capture and review the first npm audit snapshot after registry access is stable; an unavailable,
      mismatched or expired snapshot must stay visible and cannot become an automated approval.
- [ ] Add a real disposable no-network build sandbox with CPU, memory and time limits; keep package
      installation, generated code execution, GitHub and deploy behind separate approvals.

- [ ] Add a schema-validating DeckJob import adapter to Educator-AI for lesson decks.
- [ ] Add a tenant-scoped Deck review/import room to Eclipse Chat; reset upstream approval on import.
- [ ] Implement an isolated deterministic renderer from approved deck.job.v1 to editable PPTX; preserve citations and speaker notes.

- [ ] Observe a healthy persisted 24-hour SLO window at the 10% Chat canary.
- [x] Add per-client identities, endpoint scopes and independent request budgets while retaining a bounded legacy-token migration path.
- [x] Define the DnD Forge consumer boundary: Chat-owned identity, DnD-owned BFF/user budgets and a scoped private `ai.v1` service client; browser service tokens are explicitly forbidden.
- [x] Add a fail-closed service-client registry helper so deployments can upsert or rotate one product without deleting other scoped clients or leaking their tokens.
- [x] Dark-launch the DnD BFF through the existing Chat production trust path: run `30816478509` preserved Chat access, enforced DnD least-privilege scopes and kept AI, DNS, TLS and public exposure disabled. The first AI Hub workflow attempt (`30816267048`) failed before mutation because its deploy user correctly lacked passwordless sudo; that duplicate workflow was removed.
- [ ] Add embeddings under an additive `ai.v1` endpoint.
- [x] Add the Eclipse Chat Growth Command Room control plane with owner/member authorization,
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

## Changelog
### 2026-08-12 — evidence-aware brand editor

- Added a dedicated Editor Stylist instead of expanding the legacy Copywriter page.
- The workflow captures audience, channel, purpose, brand voice and immutable facts; model output
  must satisfy `editor.stylist.v1`, while missing or changed claims block the safe path.
- Source text is isolated as untrusted data. No publication, connector permission or additional
  dependency was introduced; copying is gated by the owner's manual review.


### 2026-08-10 — typed Growth role boundary

- Replaced prose-only Growth gateway results with five distinct server-owned JSON output
  contracts while preserving the `growth.execute.result.v1` envelope. The gateway now
  rejects malformed, cross-role or incomplete model output and requires every verified
  research fact or claim to cite an HTTPS source from the request allowlist. Strategy and
  final propositions must remain explicit experiments until outcome evidence exists. No
  tools, connectors, credentials, publication capability or production configuration changed.

### 2026-08-10 — additive Growth Evidence Cards

- Added optional claim-level Evidence Cards with unique IDs, explicit states, allowlisted
  HTTPS sources and evidence boundaries. Card-enabled Researcher and Claim Auditor use v2
  role schemas and must copy verified claim/ID bindings exactly; legacy runs remain on v1.
  No model run, connector, publication or production action was authorized by this change.
## Visual contract pilot — 2026-08-12

- [x] Adopt the local `product` profile with self-hosted Outfit/Inter, canonical tokens and a restrained gold/blue ambient anchor.
- [x] Preserve task-focused module layouts, keyboard focus and reduced-motion behavior.
- [x] Pass TypeScript, 125 tests and production build; compatible lockfile remediation clears critical/high production advisories, with three moderate PrismJS findings retained because the available fix is breaking.


### Dependency cleanup — 2026-08-13

- Removed the unused react-syntax-highlighter dependency and its vulnerable nested PrismJS/Refractor chain.
- Production dependency audit now reports zero advisories; no rendering behavior changed because the package had no source imports.
