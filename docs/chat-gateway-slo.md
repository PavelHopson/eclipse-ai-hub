# Eclipse Chat gateway SLO

## Scope

This SLO covers authenticated Eclipse Chat completion requests that reach the private `ai.v1` gateway. Browser BYOK modules and direct fallback providers are outside this gateway SLO.

## Targets

- Availability: at least `99%` over the rolling 24-hour window.
- Latency: p95 no more than `15,000 ms` over the rolling 24-hour window.
- Recovery: set the Chat canary to `0%` within 10 minutes of a confirmed breach that persists for 15 minutes.

Client errors (`4xx`, except gateway `429`) are reported but excluded from availability and latency calculations. Gateway `429`, timeout, network and upstream `5xx` failures count as service errors.

## Data policy

Telemetry stores hourly aggregates only:

- request, success and error counters;
- latency histogram and maximum;
- prompt/completion token totals;
- upstream-reported aggregate cost;
- sanitized error-code counters.

Prompts, responses, tool arguments, user IDs, IP addresses, service tokens and request IDs are not persisted in the telemetry store. The telemetry endpoint requires the same service authentication as completions.

## Promotion gate

The integration can move from `experimental` to `available` after:

1. production health and the `10% -> 0% -> 10%` fallback drill pass;
2. the service token is rotated successfully with rollback protection;
3. persisted telemetry remains healthy for at least 24 hours at the 10% canary;
4. no Critical or High security finding remains open.

Promotion does not mean immediate 100% traffic. Increase the canary through the guarded workflow and observe one full SLO window at each material step.
