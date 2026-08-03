# Eclipse DnD Forge → AI Gateway contract

## Decision

Eclipse DnD Forge reuses the existing private `ai.v1` runtime from this repository.
It must not call the gateway directly from its GitHub Pages frontend and must never
receive an AI Hub service token.

The ecosystem ownership model remains:

- Eclipse Chat owns people and sign-in;
- a DnD BFF owns DnD sessions, campaign authorization and per-user usage policy;
- Eclipse AI Hub owns provider credentials, model routing and service-level limits;
- Eclipse DnD Forge owns campaign data and the user experience.

## Target topology

```text
dnd.eclipse-forge.ru
  -> api.dnd.eclipse-forge.ru (DnD BFF)
       -> validates a short-lived Chat-issued identity for audience eclipse-dnd-forge
       -> applies per-user rate, token and cost budgets
       -> calls private AI Hub /v1/chat/completions as service client eclipse-dnd-forge
            -> configured OpenAI-compatible upstream
```

The BFF and browser may exchange a same-site session cookie. The AI Hub service
credential exists only in the BFF environment. The public frontend never receives
the upstream key or the service credential, including in source maps, response
payloads, URLs, local storage or logs.

## Browser-facing BFF surface

The first consumer slice needs only two endpoints:

```http
GET /api/v1/ai/models
POST /api/v1/ai/chat/completions
```

Requirements:

- require an authenticated DnD session on both endpoints;
- accept requests only from the exact DnD production origin;
- for cookie authentication, verify `Origin` and a CSRF token on mutations;
- use `application/json`, a bounded body and a strict allowlist of fields;
- cap message count, content length and output tokens before calling `ai.v1`;
- use a server-generated request ID; never accept an arbitrary upstream URL;
- return normalized error codes, never upstream response bodies;
- do not expose the AI Hub telemetry endpoint to the browser.

The existing `ai.v1` response shape can pass through after validation. Streaming
is not part of `ai.v1`; the DnD UI must show a bounded loading state until a later
additive contract introduces streaming.

## User budget boundary

Per-user policy belongs in the DnD BFF because AI Hub intentionally stores no user
identifiers. The first production policy should be configuration-driven and include:

- requests per user per 15 minutes;
- input plus output tokens per user per UTC day;
- optional cost ceiling per user per UTC day when the upstream reports cost;
- maximum output tokens per request;
- a product-wide emergency budget and kill switch.

Budget state may store the DnD user subject, counters and window timestamps inside
the DnD service only. It must not store prompts or responses. Concurrent requests
must reserve budget atomically so parallel tabs cannot bypass the limit. A rejected
request returns `429` with a safe retry time and does not call AI Hub.

AI Hub keeps the independent service-level client budget. After the BFF exists, add
an `eclipse-dnd-forge` entry with only `models:read` and `chat:write`; it does not
receive `telemetry:read`.

## Audit and privacy

The DnD BFF audit record may contain:

- timestamp, DnD user subject and request ID;
- selected public model alias;
- status, latency, prompt/completion token counts and reported cost;
- normalized failure code and consumed/reserved budget.

It must not contain message content, generated content, tool arguments, provider
credentials, service tokens, cookies or raw authorization headers. AI Hub continues
to persist only hourly aggregate telemetry without client or user identifiers.

## Identity dependency

Chat currently has application authentication but is not yet an ecosystem identity
issuer. Before the DnD BFF can ship, Chat needs one reviewed identity contract:

1. issue a short-lived, audience-bound token or one-time code for
   `eclipse-dnd-forge`;
2. let the DnD BFF validate it without sharing Chat's primary signing secret;
3. include issuer, audience, subject, issued-at, expiry and unique token ID;
4. support key rotation and explicit revocation/disable behavior;
5. prevent open redirects, token replay and cross-product audience reuse.

An asymmetric signing key with a published verification key is preferred. Copying
Chat's main JWT secret into the DnD service is rejected because it expands the blast
radius of both products.

## Rollout gates

1. Approve the Chat-issued identity contract and threat model.
2. Implement the DnD BFF with auth, CSRF/origin checks and atomic budget tests.
3. Add the scoped `eclipse-dnd-forge` AI Hub service client and rotate it through a
   root-owned environment file.
4. Run synthetic prompts only at `0% -> 10% -> 0% -> 10%` canary and verify fallback.
5. Observe a healthy 24-hour window with no Critical/High finding.
6. Only then remove browser-direct OpenAI/Anthropic from the production UI. Local
   Ollama and explicitly labelled demo BYOK can remain separate modes.

## Explicit non-goals

- no service token or provider key in Vite variables;
- no direct browser access to private `ai.v1`;
- no shared database between Chat, DnD and AI Hub;
- no prompt/response logging for analytics;
- no silent fallback from an authenticated paid mode to browser BYOK.
