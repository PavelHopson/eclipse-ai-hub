# Direct Kimi K3 Benchmark

Status: **roadmap harness implemented; live provider result pending an approved test key and budget**.

This benchmark answers one narrow question: whether the official Kimi K3 platform API is useful for Eclipse AI Hub, Eclipse Hopson Sentinel, and oh-my-claudecode workloads. It does not add Kimi to production routing.

## What is tested

The harness contains six small synthetic tasks:

| Suite | Product question |
| --- | --- |
| `ai-hub` | Can the model produce structured answers and avoid inventing a missing source? |
| `sentinel` | Can the model choose a safe next action and stop before a destructive operation? |
| `omc` | Can the model preserve dependencies and parallelization boundaries in an agent plan? |

No repository content, user prompt, customer document, secret, or production telemetry is sent.

## Safe default: dry run

```bash
npm run benchmark:kimi-k3 -- --suite all
```

This prints the fixed endpoint, model, and task manifest. It makes **no network request** and does not require a key.

## Approved live run

Use a dedicated test key with a hard provider-side budget. Supply it only through the process environment:

```powershell
$env:KIMI_BENCHMARK_ALLOW_NETWORK="1"
$env:KIMI_API_KEY="<dedicated-test-key>"
npm run benchmark:kimi-k3 -- --suite ai-hub --execute
Remove-Item Env:KIMI_API_KEY
Remove-Item Env:KIMI_BENCHMARK_ALLOW_NETWORK
```

Run `sentinel` and `omc` separately so their cost and outcome are visible:

```powershell
npm run benchmark:kimi-k3 -- --suite sentinel --execute
npm run benchmark:kimi-k3 -- --suite omc --execute
```

The live runner is intentionally locked behind both `--execute` and `KIMI_BENCHMARK_ALLOW_NETWORK=1`. It accepts no custom endpoint, prompt file, repository path, or raw user input.

## Report contract

The report contains:

- task id and suite;
- pass/fail;
- latency;
- token counts when the provider returns them;
- SHA-256 of the model output for reproducibility;
- sanitized error code.

The report does **not** contain the API key, prompt text, raw model output, response body, repository content, or personal data.

## Decision gate

Do not add Kimi K3 to a production allowlist until:

1. all six synthetic tasks pass in two repeat runs;
2. p95 latency and token cost are compared with the current approved provider;
3. Moonshot/Kimi Terms, privacy terms, retention, region, subprocessors, and DPA needs are reviewed for the intended data class;
4. a dedicated service identity, rate limit, budget, timeout, and rollback path exist;
5. production prompts and responses remain excluded from logs.

An acceptable result moves the provider to a scoped AI Hub canary. Sentinel and OMC must consume that governed provider path or use a separately approved direct developer key; they must not copy a shared production key.

## Official references

- [Kimi API overview](https://www.kimi.com/help/kimi-api/api-overview)
- [Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models.html)
- [Kimi environment variables and direct platform base URL](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars)

TokenRouter is explicitly outside this harness. It remains blocked until its owner, Terms, DPA, routing providers, retention, subprocessors, and promotion conditions are verified.
