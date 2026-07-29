# Local Model Runtime R&D

Reference: [Colibri](https://github.com/JustVugg/colibri).

This document turns the Colibri finding into an Eclipse AI Hub product backlog item. It is not a runtime integration yet.

## Product goal

Eclipse AI Hub should not just ask the user to paste a provider URL. It should help them understand whether a model/provider is actually usable on their machine.

The core UX principle:

> The user should see one safe next action without reading a setup manual.

## What Colibri teaches us

Colibri is useful because it makes local inference measurable before the model starts:

- model disk size
- resident RAM
- peak RAM
- disk-read cost
- optional GPU tier
- expected speed tier
- doctor output that can be consumed by CLI, UI or automation

That pattern can become a Hub feature even if Hub never runs Colibri directly.

## Future AI Hub feature: Provider Readiness

### UI states

| State | User-facing meaning | Primary action |
|---|---|---|
| Ready | Provider works and model is usable | Use this provider |
| Slow | Provider works, but latency will be high | Use for experiments |
| Unsafe | RAM/disk/path setup is risky | Fix setup |
| Missing | Endpoint or model path is absent | Connect provider |
| Unknown | Hub cannot verify it yet | Run check |

### Minimal provider check contract

```ts
type ProviderReadiness = {
  provider: string
  model: string
  status: 'ready' | 'slow' | 'unsafe' | 'missing' | 'unknown'
  endpointReachable?: boolean
  modelPathExists?: boolean
  residentRamGb?: number
  peakRamGb?: number
  diskRequiredGb?: number
  expectedLatency: 'fast' | 'normal' | 'slow' | 'very_slow' | 'unknown'
  risks: string[]
  nextAction: string
}
```

## Backlog

1. Add a "Check provider" button in Settings.
2. Show clear readiness state instead of raw connection errors.
3. Add a local model profile section: Ollama now, experimental local runtimes later.
4. Add warnings for huge local models before users download them.
5. Keep Colibri under R&D until hardware benchmarks exist.

## Guardrails

- Do not auto-download huge models from the browser UI.
- Do not call a disk-streamed 744B model "fast".
- Do not hide storage/RAM requirements behind advanced settings.
- Do not make experimental local runtimes compete visually with the safe default.

## MCP developer baseline - implemented 2026-07-29

- Context7 and workspace-scoped Filesystem are available through `npm run mcp:baseline`.
- GitHub is explicit opt-in and generated with read-only, lockdown, and limited toolsets.
- The SPA does not execute MCP servers and does not receive MCP credentials.
- Future in-product MCP support still requires an authenticated backend gateway and per-tool authorization.
