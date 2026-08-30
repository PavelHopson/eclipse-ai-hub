const DEFAULT_CIRCUIT_FAILURES = 2;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 100;

export class ProviderRouterError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProviderRouterError';
    this.code = code;
  }
}

function utcMonth(now) {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function integer(value, fallback, minimum, maximum, name) {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return result;
}

function delay(ms, signal) {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new Error('aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * In-memory provider selection for one gateway process.
 * It never reads environment variables, URLs or secrets and never performs network I/O itself.
 */
export function createProviderRouter(routes, options = {}) {
  if (!Array.isArray(routes) || routes.length < 1 || routes.length > 4) {
    throw new Error('Provider router requires between one and four routes');
  }
  const clock = options.clock ?? Date.now;
  const retryAttempts = integer(options.retryAttempts, DEFAULT_RETRY_ATTEMPTS, 1, 3, 'retryAttempts');
  const retryDelayMs = integer(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS, 0, 10_000, 'retryDelayMs');
  const circuitFailures = integer(options.circuitFailures, DEFAULT_CIRCUIT_FAILURES, 1, 10, 'circuitFailures');
  const circuitCooldownMs = integer(options.circuitCooldownMs, DEFAULT_CIRCUIT_COOLDOWN_MS, 1_000, 300_000, 'circuitCooldownMs');
  const ordered = [...routes].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  const state = new Map(ordered.map((route) => [route.id, {
    month: utcMonth(clock()),
    consumedTokens: 0,
    reservedTokens: 0,
    consecutiveFailures: 0,
    circuitOpenUntil: 0,
    lastLatencyMs: null,
    lastOutcome: 'untried',
  }]));

  function refreshMonth(routeState, now) {
    const month = utcMonth(now);
    if (routeState.month !== month) {
      routeState.month = month;
      routeState.consumedTokens = 0;
      routeState.reservedTokens = 0;
    }
  }

  function candidates(model, estimatedTokens, now) {
    return ordered.filter((route) => {
      if (!route.models.includes(model)) return false;
      const current = state.get(route.id);
      refreshMonth(current, now);
      if (current.circuitOpenUntil > now) return false;
      if (route.monthlyTokenBudget !== null
          && current.consumedTokens + current.reservedTokens + estimatedTokens > route.monthlyTokenBudget) return false;
      return true;
    });
  }

  async function execute({ model, estimatedTokens, signal, run, isRetryable }) {
    if (typeof model !== 'string' || !Number.isInteger(estimatedTokens) || estimatedTokens < 1 || estimatedTokens > 1_000_000) {
      throw new ProviderRouterError('invalid_router_request', 'Provider router request is invalid');
    }
    if (typeof run !== 'function' || typeof isRetryable !== 'function') {
      throw new ProviderRouterError('invalid_router_request', 'Provider router callbacks are required');
    }
    const now = clock();
    if (!Number.isFinite(now) || now < 0) throw new ProviderRouterError('invalid_router_clock', 'Provider router clock is invalid');
    const preferredRouteId = ordered.find((route) => route.models.includes(model))?.id;
    const available = candidates(model, estimatedTokens, now);
    if (available.length === 0) {
      const supportsModel = ordered.some((route) => route.models.includes(model));
      throw new ProviderRouterError(
        supportsModel ? 'provider_capacity_exhausted' : 'provider_model_unavailable',
        supportsModel ? 'No provider has available quota or a closed circuit' : 'No provider supports this model',
      );
    }

    let lastError;
    for (const route of available) {
      if (signal?.aborted) throw new ProviderRouterError('request_cancelled', 'Provider request was cancelled', signal.reason);
      const current = state.get(route.id);
      let reservationActive = true;
      current.reservedTokens += estimatedTokens;
      try {
        for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
          const startedAt = clock();
          try {
            const result = await run(route, attempt);
            const endedAt = clock();
            const measuredLatency = Number.isFinite(result?.latencyMs) ? result.latencyMs : Math.max(0, endedAt - startedAt);
            const measuredTokens = Number.isSafeInteger(result?.usageTokens) && result.usageTokens >= 0
              ? result.usageTokens
              : estimatedTokens;
            current.reservedTokens -= estimatedTokens;
            current.consumedTokens += measuredTokens;
            reservationActive = false;
            current.consecutiveFailures = 0;
            current.circuitOpenUntil = 0;
            current.lastLatencyMs = measuredLatency;
            current.lastOutcome = 'ready';
            return { ...result, routeId: route.id, attempts: attempt, fallbackUsed: route.id !== preferredRouteId };
          } catch (error) {
            lastError = error;
            if (!isRetryable(error) || signal?.aborted) throw error;
            current.consecutiveFailures += 1;
            current.lastOutcome = 'degraded';
            if (current.consecutiveFailures >= circuitFailures) {
              current.circuitOpenUntil = clock() + circuitCooldownMs;
            }
            if (attempt < retryAttempts && current.circuitOpenUntil <= clock()) {
              await delay(retryDelayMs * attempt, signal);
              continue;
            }
            break;
          }
        }
      } finally {
        if (reservationActive) current.reservedTokens = Math.max(0, current.reservedTokens - estimatedTokens);
      }
    }
    throw new ProviderRouterError('providers_unavailable', 'All configured providers are unavailable', lastError);
  }

  function summary() {
    const now = clock();
    return {
      schemaVersion: 'eclipse.provider-health.v1',
      routes: ordered.map((route) => {
        const current = state.get(route.id);
        refreshMonth(current, now);
        const remainingTokens = route.monthlyTokenBudget === null
          ? null
          : Math.max(0, route.monthlyTokenBudget - current.consumedTokens - current.reservedTokens);
        return {
          id: route.id,
          status: current.circuitOpenUntil > now ? 'circuit-open' : current.lastOutcome,
          priority: route.priority,
          remainingTokens,
          lastLatencyMs: current.lastLatencyMs,
        };
      }),
    };
  }

  return Object.freeze({ execute, summary });
}
