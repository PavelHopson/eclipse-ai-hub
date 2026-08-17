export const GPT56_ROUTER_PROFILES = Object.freeze({
  fast: Object.freeze({
    model: 'gpt-5.6-luna',
    reasoningEffort: 'low',
    intendedUse: 'High-volume extraction, classification and short bounded drafts',
  }),
  balanced: Object.freeze({
    model: 'gpt-5.6-terra',
    reasoningEffort: 'medium',
    intendedUse: 'Default product work that balances quality, latency and cost',
  }),
  deep: Object.freeze({
    model: 'gpt-5.6-sol',
    reasoningEffort: 'high',
    intendedUse: 'Complex architecture, security review and difficult multi-step reasoning',
  }),
});

export class Gpt56RouterError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function boundedText(value, name, maxLength, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Gpt56RouterError(`invalid_${name}`, `${name} must be non-empty text up to ${maxLength} characters`);
  }
  return value;
}

export function buildGpt56ResponseRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Gpt56RouterError('invalid_request', 'Request body must be an object');
  }
  const allowedFields = new Set(['schemaVersion', 'profile', 'input', 'instructions', 'maxOutputTokens']);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new Gpt56RouterError('unsupported_field', 'Request contains a field outside eclipse.gpt56.request.v1');
  }
  if (body.schemaVersion !== 'eclipse.gpt56.request.v1') {
    throw new Gpt56RouterError('invalid_schema_version', 'schemaVersion must be eclipse.gpt56.request.v1');
  }

  const profile = body.profile ?? 'balanced';
  const route = GPT56_ROUTER_PROFILES[profile];
  if (!route) {
    throw new Gpt56RouterError('invalid_profile', 'profile must be fast, balanced or deep');
  }

  const input = boundedText(body.input, 'input', 100_000);
  const instructions = boundedText(body.instructions, 'instructions', 20_000, { optional: true });
  const maxOutputTokens = body.maxOutputTokens ?? 4096;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32_768) {
    throw new Gpt56RouterError('invalid_max_output_tokens', 'maxOutputTokens must be between 1 and 32768');
  }

  return {
    meta: {
      profile,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      intendedUse: route.intendedUse,
    },
    request: {
      model: route.model,
      input,
      ...(instructions ? { instructions } : {}),
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: route.reasoningEffort },
      store: false,
    },
  };
}
