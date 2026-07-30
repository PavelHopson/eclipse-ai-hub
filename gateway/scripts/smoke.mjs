const baseUrl = (process.env.AI_GATEWAY_SMOKE_BASE_URL || 'http://127.0.0.1:8810').replace(/\/+$/, '');
const token = process.env.AI_GATEWAY_SERVICE_TOKEN?.trim();

if (!token) {
  console.error('AI_GATEWAY_SERVICE_TOKEN is required for the protected smoke checks');
  process.exit(1);
}

async function readJson(response, label) {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

const authHeaders = { Authorization: `Bearer ${token}` };

const health = await readJson(await fetch(`${baseUrl}/health`), 'health');
if (health?.ok !== true || health?.contract !== 'ai.v1') {
  throw new Error('health response does not identify a ready ai.v1 gateway');
}

const models = await readJson(
  await fetch(`${baseUrl}/v1/models`, { headers: authHeaders }),
  'models',
);
if (!Array.isArray(models?.data) || models.data.length === 0) {
  throw new Error('models response is empty');
}

const telemetry = await readJson(
  await fetch(`${baseUrl}/v1/telemetry`, { headers: authHeaders }),
  'telemetry',
);
if (
  telemetry?.privacy?.contentStored !== false
  || telemetry?.privacy?.identifiersStored !== false
  || !telemetry?.windows?.['24h']
) {
  throw new Error('telemetry response does not satisfy the aggregate-only contract');
}

const summary = {
  ok: true,
  contract: health.contract,
  modelCount: models.data.length,
  telemetry: {
    persistence: telemetry.persistence,
    status24h: telemetry.windows['24h'].slo?.status ?? 'no_data',
  },
  completion: 'skipped',
};

if (process.env.AI_GATEWAY_SMOKE_COMPLETION === '1') {
  const requestedModel = process.env.AI_GATEWAY_SMOKE_MODEL?.trim() || models.data[0].id;
  const completion = await readJson(
    await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: requestedModel,
        messages: [{ role: 'user', content: 'Return exactly one lowercase word: ok' }],
        max_tokens: 128,
        temperature: 0,
        stream: false,
      }),
    }),
    'completion',
  );
  if (!completion?.choices?.[0]?.message) throw new Error('completion response has no message');
  summary.completion = 'passed';
  summary.model = completion.model || requestedModel;
}

console.log(JSON.stringify(summary));
