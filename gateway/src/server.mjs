import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadGatewayConfig } from './config.mjs';
import { createGatewayTelemetry } from './telemetry.mjs';
import { buildGrowthCompletion, GrowthRequestError, growthResultContent } from './growth.mjs';

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class FixedWindowLimiter {
  constructor(limit) {
    this.limit = limit;
    this.startedAt = Date.now();
    this.count = 0;
  }

  consume(now = Date.now()) {
    if (now - this.startedAt >= 60_000) {
      this.startedAt = now;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= this.limit;
  }
}

function safeRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : randomUUID();
}

function authenticateClient(header, clients) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const supplied = Buffer.from(header.slice(7), 'utf8');
  for (const client of clients) {
    for (const expectedToken of client.tokens) {
      const expected = Buffer.from(expectedToken, 'utf8');
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return client;
    }
  }
  return null;
}

function requiredScope(method, pathname) {
  if (method === 'GET' && pathname === '/v1/models') return 'models:read';
  if (method === 'GET' && pathname === '/v1/telemetry') return 'telemetry:read';
  if (method === 'POST' && pathname === '/v1/chat/completions') return 'chat:write';
  if (method === 'POST' && pathname === '/v1/growth/execute') return 'growth:execute';
  return null;
}

function sendJson(response, status, payload, requestId, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
    ...extraHeaders,
  });
  response.end(body);
}

function sendError(response, error, requestId, extraHeaders = {}) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'internal_error';
  const message = error instanceof HttpError ? error.message : 'Gateway request failed';
  sendJson(response, status, { error: { code, message, requestId } }, requestId, extraHeaders);
}

function optionalNonNegativeNumber(headers, name, { integer = false } = {}) {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  if (integer && !Number.isSafeInteger(parsed)) return undefined;
  return parsed;
}

async function readJson(request, maxBytes) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large');
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON');
  }
}

async function readResponseJson(response, maxBytes = 4_194_304) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw new HttpError(502, 'upstream_response_too_large', 'Configured AI provider returned too much data');
  }
  if (!response.body) {
    throw new HttpError(502, 'invalid_upstream_response', 'Configured AI provider returned an empty body');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(502, 'upstream_response_too_large', 'Configured AI provider returned too much data');
    }
    chunks.push(value);
  }

  try {
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new HttpError(502, 'invalid_upstream_response', 'Configured AI provider returned invalid JSON');
  }
}

function validateCompletion(body, allowedModels) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_request', 'Request body must be an object');
  }
  const allowedFields = new Set([
    'model',
    'messages',
    'temperature',
    'max_tokens',
    'stream',
    'tools',
    'tool_choice',
  ]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new HttpError(400, 'unsupported_field', 'Request contains a field outside the ai.v1 contract');
  }
  if (typeof body.model !== 'string' || !allowedModels.has(body.model)) {
    throw new HttpError(400, 'model_not_allowed', 'Choose a model exposed by /v1/models');
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 128) {
    throw new HttpError(400, 'invalid_messages', 'Messages must contain between 1 and 128 items');
  }
  const roles = new Set(['system', 'user', 'assistant', 'tool']);
  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || !roles.has(message.role)) {
      throw new HttpError(400, 'invalid_message', 'Every message must have a supported role');
    }
    if (typeof message.content !== 'string' || message.content.length > 100_000) {
      throw new HttpError(400, 'invalid_message', 'Message content must be text up to 100000 characters');
    }
  }
  if (body.stream === true) throw new HttpError(400, 'stream_not_supported', 'Streaming is not available in ai.v1');
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length > 64)) {
    throw new HttpError(400, 'invalid_tools', 'Tools must contain no more than 64 items');
  }
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 8192)) {
    throw new HttpError(400, 'invalid_max_tokens', 'max_tokens must be between 1 and 8192');
  }
  if (body.temperature !== undefined && (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2)) {
    throw new HttpError(400, 'invalid_temperature', 'temperature must be between 0 and 2');
  }
}

async function proxyCompletion({ body, config, fetchImpl, requestId, logger, externalSignal }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  try {
    const upstream = await fetchImpl(`${config.upstreamBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.upstreamApiKey ? { Authorization: `Bearer ${config.upstreamApiKey}` } : {}),
        'X-Request-Id': requestId,
        'X-Eclipse-Client': 'eclipse-ai-gateway',
      },
      body: JSON.stringify({ ...body, stream: false }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (!upstream.ok) {
      await upstream.body?.cancel();
      logger.warn({ event: 'upstream_rejected', requestId, model: body.model, status: upstream.status, latencyMs });
      const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status;
      throw new HttpError(status, 'upstream_rejected', 'Configured AI provider rejected the request');
    }

    const payload = await readResponseJson(upstream);
    if (!Array.isArray(payload?.choices) || payload.choices.length === 0) {
      throw new HttpError(502, 'invalid_upstream_response', 'Configured AI provider returned no choices');
    }

    logger.info({ event: 'completion_succeeded', requestId, model: body.model, status: 200, latencyMs });
    const headerCost = optionalNonNegativeNumber(upstream.headers, 'x-omniroute-response-cost');
    const headerPromptTokens = optionalNonNegativeNumber(upstream.headers, 'x-omniroute-tokens-in', { integer: true });
    const headerCompletionTokens = optionalNonNegativeNumber(upstream.headers, 'x-omniroute-tokens-out', { integer: true });
    return {
      payload,
      latencyMs,
      costUsd: headerCost ?? 0,
      promptTokens: headerPromptTokens ?? payload.usage?.prompt_tokens,
      completionTokens: headerCompletionTokens ?? payload.usage?.completion_tokens,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (!timedOut && externalSignal?.aborted) {
        throw new HttpError(499, 'request_cancelled', 'Gateway request was cancelled');
      }
      throw new HttpError(504, 'upstream_timeout', 'Configured AI provider timed out');
    }
    if (error instanceof HttpError) throw error;
    logger.warn({
      event: 'upstream_unavailable',
      requestId,
      model: body.model,
      error: error instanceof Error ? error.name : 'unknown',
    });
    throw new HttpError(502, 'upstream_unavailable', 'Configured AI provider is unavailable');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export function createGatewayServer(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console;
  const limiters = new Map(
    config.serviceClients.map((client) => [client.id, new FixedWindowLimiter(client.requestsPerMinute)]),
  );
  const allowedModels = new Set(config.models);
  const telemetry = options.telemetry ?? createGatewayTelemetry(config, { logger });

  const server = createServer(async (request, response) => {
    const requestId = safeRequestId(request.headers['x-request-id']);
    const requestStartedAt = Date.now();
    let recordCompletion = false;
    let completionRecorded = false;
    const downstreamController = new AbortController();
    request.once('aborted', () => downstreamController.abort());
    response.once('close', () => {
      if (!response.writableEnded) downstreamController.abort();
    });
    try {
      const url = new URL(request.url || '/', 'http://gateway.local');
      if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/v1/health')) {
        sendJson(response, 200, {
          ok: true,
          service: 'eclipse-ai-gateway',
          contract: 'ai.v1',
          modelCount: config.models.length,
        }, requestId);
        return;
      }

      const client = authenticateClient(request.headers.authorization, config.serviceClients);
      if (!client) {
        throw new HttpError(401, 'unauthorized', 'A valid service token is required');
      }
      recordCompletion = request.method === 'POST'
        && (url.pathname === '/v1/chat/completions' || url.pathname === '/v1/growth/execute');
      const scope = requiredScope(request.method, url.pathname);
      if (!scope) {
        throw new HttpError(404, 'not_found', 'Route not found');
      }
      if (!client.scopes.includes(scope)) {
        throw new HttpError(403, 'forbidden_scope', `Service client requires the ${scope} scope`);
      }
      if (!limiters.get(client.id).consume()) {
        throw new HttpError(429, 'rate_limited', 'Service client request budget is exhausted');
      }

      if (request.method === 'GET' && url.pathname === '/v1/models') {
        sendJson(response, 200, {
          object: 'list',
          data: config.models.map((id) => ({ id, object: 'model', owned_by: 'eclipse-ai-hub' })),
        }, requestId);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/telemetry') {
        sendJson(response, 200, telemetry.summary(), requestId);
        return;
      }

      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
      }

      const body = await readJson(request, config.maxBodyBytes);
      let completionBody = body;
      let growthMeta = null;
      if (url.pathname === '/v1/growth/execute') {
        try {
          growthMeta = buildGrowthCompletion(body, config.models[0]);
          completionBody = growthMeta.completion;
        } catch (error) {
          if (error instanceof GrowthRequestError) {
            throw new HttpError(400, error.code, error.message);
          }
          throw error;
        }
      }
      validateCompletion(completionBody, allowedModels);
      const { payload, latencyMs, costUsd, promptTokens, completionTokens } = await proxyCompletion({
        body: completionBody,
        config,
        fetchImpl,
        requestId,
        logger,
        externalSignal: downstreamController.signal,
      });
      let responsePayload = payload;
      if (growthMeta) {
        let content;
        try {
          content = growthResultContent(payload, growthMeta.step, growthMeta.allowedSourceUrls, growthMeta.evidenceCards);
        } catch (error) {
          if (error instanceof GrowthRequestError) {
            throw new HttpError(502, 'invalid_upstream_response', 'Configured AI provider returned an invalid Growth result');
          }
          throw error;
        }
        responsePayload = {
            schemaVersion: 'growth.execute.result.v1',
            step: growthMeta.step,
            role: growthMeta.role,
            content,
            provider: 'eclipse-ai-hub',
            model: payload.model || completionBody.model,
            usage: {
              promptTokens: promptTokens ?? null,
              completionTokens: completionTokens ?? null,
            },
          };
      }
      telemetry.record({ status: 200, latencyMs, costUsd, promptTokens, completionTokens });
      completionRecorded = true;
      sendJson(response, 200, responsePayload, requestId, {
        'X-Eclipse-Latency-Ms': String(latencyMs),
        'X-Eclipse-Upstream': 'configured-provider',
      });
    } catch (error) {
      if (recordCompletion && !completionRecorded) {
        const status = error instanceof HttpError ? error.status : 500;
        const errorCode = error instanceof HttpError ? error.code : 'internal_error';
        const telemetryStatus = errorCode === 'upstream_rejected' && status !== 429 ? 502 : status;
        telemetry.record({ status: telemetryStatus, errorCode, latencyMs: Date.now() - requestStartedAt });
      }
      if (!(error instanceof HttpError)) {
        logger.error({ event: 'gateway_failed', requestId, error: error instanceof Error ? error.name : 'unknown' });
      }
      sendError(response, error, requestId, error instanceof HttpError && error.status === 429 ? { 'Retry-After': '60' } : {});
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  server.on('close', () => telemetry.flush());
  return server;
}

async function start() {
  const config = loadGatewayConfig();
  const server = createGatewayServer(config);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(config.port, config.host, resolveListen);
  });
  console.info({ event: 'gateway_started', host: config.host, port: config.port, contract: 'ai.v1' });

  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  start().catch((error) => {
    console.error({ event: 'gateway_start_failed', error: error instanceof Error ? error.message : 'unknown' });
    process.exit(1);
  });
}
