const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const ROLE_SCHEMA_MARKERS = /growth\.(?:research|strategy|draft|claims|final)\.v1/g;
const EXPERIMENT_LANGUAGE = /(?:\btest(?:ed|ing)?\b|\bexperiment(?:al)?\b|провер|тестир|эксперимент|гипотез)/iu;

export class GrowthOutputError extends Error {}

export const ROLE_OUTPUT_INSTRUCTIONS = Object.freeze({
  research: `Верни только JSON без Markdown и пояснений. Точная схема:
{"schemaVersion":"growth.research.v1","verifiedFacts":[{"claim":"...","sourceUrls":["https://..."],"evidenceBoundary":"..."}],"hypotheses":[{"claim":"...","testNeeded":"..."}],"unknowns":[{"question":"...","whyItMatters":"..."}]}
Используй не больше 6 элементов в каждом массиве. verifiedFacts допускает только факты, для которых связь claim → source URL прямо указана в evidence notes. Копируй URL точно из входного allowlist. Offer, CTA, KPI и product plan не являются verified facts без независимого evidence результата. Отсутствие доказательств означает unknown, а не доказательство отсутствия. Не создавай strategy, draft, claim audit или final.`,
  strategy: `Верни только JSON без Markdown и пояснений. Точная схема:
{"schemaVersion":"growth.strategy.v1","audience":"...","problemHypothesis":"...","proposition":"...","offer":"...","cta":"...","kpi":{"name":"...","baseline":"not_available"}}
Выбери ровно одну аудиторию, одну проверяемую проблему-гипотезу, одно предложение, один offer, один CTA и один KPI. proposition обязан прямо описывать test, experiment или гипотезу, а не готовую capability. Не заявляй гипотезу как наблюдаемый факт. Не создавай research, draft, claim audit или final.`,
  draft: `Верни только JSON без Markdown и пояснений. Точная схема:
{"schemaVersion":"growth.draft.v1","title":"...","body":"...","evidenceBoundary":"...","cta":"..."}
Напиши один связный внутренний draft для выбранного канала. Сохрани неопределённость и один CTA. Не добавляй таблицу claim audit, KPI или финальный verdict.`,
  claims: `Верни только JSON без Markdown и пояснений. Точная схема:
{"schemaVersion":"growth.claims.v1","claims":[{"claim":"...","status":"verified|qualified|planned|remove","sourceUrls":["https://..."],"evidenceBoundary":"..."}],"auditComplete":true}
Проверь не больше 6 материальных утверждений. status=verified требует прямой источник, точно скопированный из входного allowlist; если связь claim → source не доказана, используй qualified или remove и sourceUrls=[]. Запланированный offer, CTA или KPI имеет status=planned, если нет независимого evidence результата. Не создавай финальный текст. auditComplete обязан быть true.`,
  final: `Верни только JSON без Markdown и пояснений. Точная схема:
{"schemaVersion":"growth.final.v1","audience":"...","problemHypothesis":"...","proposition":"...","evidenceBoundary":"...","offer":"...","cta":"...","kpi":{"name":"...","baseline":"not_available"},"finalComplete":true}
Сохрани только утверждения, разрешённые claim audit. Дай один компактный внутренний positioning artifact. Не копируй audit table и не добавляй другие schema. finalComplete обязан быть true.`,
});

function exactObject(value, fields, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GrowthOutputError(`${name} must be an object`);
  }
  const allowed = new Set(fields);
  if (Object.keys(value).some((field) => !allowed.has(field))) {
    throw new GrowthOutputError(`${name} contains an unsupported field`);
  }
  if (fields.some((field) => !(field in value))) {
    throw new GrowthOutputError(`${name} is missing a required field`);
  }
  return value;
}

function safeText(value, name, min = 2, max = 2_000) {
  if (typeof value !== 'string') throw new GrowthOutputError(`${name} must be text`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || CONTROL_CHARACTERS.test(normalized)) {
    throw new GrowthOutputError(`${name} must contain ${min}..${max} safe characters`);
  }
  return normalized;
}

function experimentText(value, name) {
  const normalized = safeText(value, name, 5, 1_000);
  if (!EXPERIMENT_LANGUAGE.test(normalized)) {
    throw new GrowthOutputError(`${name} must describe a test, experiment or hypothesis`);
  }
  return normalized;
}

function boundedArray(value, name, min = 0, max = 6) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new GrowthOutputError(`${name} must contain ${min}..${max} items`);
  }
  return value;
}

function sourceUrls(value, name, allowlist, required = false) {
  return boundedArray(value, name, required ? 1 : 0, 3).map((raw) => {
    const candidate = safeText(raw, `${name} item`, 8, 2_048);
    let normalized;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe');
      url.hash = '';
      normalized = url.toString();
    } catch {
      throw new GrowthOutputError(`${name} must contain safe HTTPS URLs`);
    }
    if (!allowlist.has(normalized)) throw new GrowthOutputError(`${name} contains a URL outside the source allowlist`);
    return normalized;
  });
}

function schema(value, expected) {
  if (value !== expected) throw new GrowthOutputError(`schemaVersion must be ${expected}`);
  return expected;
}

function validateResearch(raw, allowlist) {
  const value = exactObject(raw, ['schemaVersion', 'verifiedFacts', 'hypotheses', 'unknowns'], 'research output');
  const verifiedFacts = boundedArray(value.verifiedFacts, 'verifiedFacts').map((item, index) => {
    const fact = exactObject(item, ['claim', 'sourceUrls', 'evidenceBoundary'], `verifiedFacts[${index}]`);
    return {
      claim: safeText(fact.claim, `verifiedFacts[${index}].claim`, 5, 500),
      sourceUrls: sourceUrls(fact.sourceUrls, `verifiedFacts[${index}].sourceUrls`, allowlist, true),
      evidenceBoundary: safeText(fact.evidenceBoundary, `verifiedFacts[${index}].evidenceBoundary`, 5, 1_000),
    };
  });
  const hypotheses = boundedArray(value.hypotheses, 'hypotheses').map((item, index) => {
    const hypothesis = exactObject(item, ['claim', 'testNeeded'], `hypotheses[${index}]`);
    return {
      claim: safeText(hypothesis.claim, `hypotheses[${index}].claim`, 5, 500),
      testNeeded: safeText(hypothesis.testNeeded, `hypotheses[${index}].testNeeded`, 5, 1_000),
    };
  });
  const unknowns = boundedArray(value.unknowns, 'unknowns').map((item, index) => {
    const unknown = exactObject(item, ['question', 'whyItMatters'], `unknowns[${index}]`);
    return {
      question: safeText(unknown.question, `unknowns[${index}].question`, 5, 500),
      whyItMatters: safeText(unknown.whyItMatters, `unknowns[${index}].whyItMatters`, 5, 1_000),
    };
  });
  if (verifiedFacts.length + hypotheses.length + unknowns.length === 0) {
    throw new GrowthOutputError('research output must contain at least one finding');
  }
  return { schemaVersion: schema(value.schemaVersion, 'growth.research.v1'), verifiedFacts, hypotheses, unknowns };
}

function validateStrategy(raw) {
  const value = exactObject(raw, ['schemaVersion', 'audience', 'problemHypothesis', 'proposition', 'offer', 'cta', 'kpi'], 'strategy output');
  const kpi = exactObject(value.kpi, ['name', 'baseline'], 'strategy output.kpi');
  return {
    schemaVersion: schema(value.schemaVersion, 'growth.strategy.v1'),
    audience: safeText(value.audience, 'strategy output.audience', 5, 500),
    problemHypothesis: safeText(value.problemHypothesis, 'strategy output.problemHypothesis', 5, 1_000),
    proposition: experimentText(value.proposition, 'strategy output.proposition'),
    offer: safeText(value.offer, 'strategy output.offer', 2, 300),
    cta: safeText(value.cta, 'strategy output.cta', 2, 300),
    kpi: { name: safeText(kpi.name, 'strategy output.kpi.name', 5, 500), baseline: safeText(kpi.baseline, 'strategy output.kpi.baseline', 2, 100) },
  };
}

function validateDraft(raw) {
  const value = exactObject(raw, ['schemaVersion', 'title', 'body', 'evidenceBoundary', 'cta'], 'draft output');
  return {
    schemaVersion: schema(value.schemaVersion, 'growth.draft.v1'),
    title: safeText(value.title, 'draft output.title', 5, 300),
    body: safeText(value.body, 'draft output.body', 40, 8_000),
    evidenceBoundary: safeText(value.evidenceBoundary, 'draft output.evidenceBoundary', 5, 2_000),
    cta: safeText(value.cta, 'draft output.cta', 2, 300),
  };
}

function validateClaims(raw, allowlist) {
  const value = exactObject(raw, ['schemaVersion', 'claims', 'auditComplete'], 'claims output');
  if (value.auditComplete !== true) throw new GrowthOutputError('claims output.auditComplete must be true');
  const claims = boundedArray(value.claims, 'claims', 1).map((item, index) => {
    const claim = exactObject(item, ['claim', 'status', 'sourceUrls', 'evidenceBoundary'], `claims[${index}]`);
    if (!['verified', 'qualified', 'planned', 'remove'].includes(claim.status)) {
      throw new GrowthOutputError(`claims[${index}].status is unsupported`);
    }
    return {
      claim: safeText(claim.claim, `claims[${index}].claim`, 5, 500),
      status: claim.status,
      sourceUrls: sourceUrls(claim.sourceUrls, `claims[${index}].sourceUrls`, allowlist, claim.status === 'verified'),
      evidenceBoundary: safeText(claim.evidenceBoundary, `claims[${index}].evidenceBoundary`, 5, 1_000),
    };
  });
  return { schemaVersion: schema(value.schemaVersion, 'growth.claims.v1'), claims, auditComplete: true };
}

function validateFinal(raw) {
  const value = exactObject(raw, ['schemaVersion', 'audience', 'problemHypothesis', 'proposition', 'evidenceBoundary', 'offer', 'cta', 'kpi', 'finalComplete'], 'final output');
  if (value.finalComplete !== true) throw new GrowthOutputError('final output.finalComplete must be true');
  const kpi = exactObject(value.kpi, ['name', 'baseline'], 'final output.kpi');
  return {
    schemaVersion: schema(value.schemaVersion, 'growth.final.v1'),
    audience: safeText(value.audience, 'final output.audience', 5, 500),
    problemHypothesis: safeText(value.problemHypothesis, 'final output.problemHypothesis', 5, 1_000),
    proposition: experimentText(value.proposition, 'final output.proposition'),
    evidenceBoundary: safeText(value.evidenceBoundary, 'final output.evidenceBoundary', 5, 2_000),
    offer: safeText(value.offer, 'final output.offer', 2, 300),
    cta: safeText(value.cta, 'final output.cta', 2, 300),
    kpi: { name: safeText(kpi.name, 'final output.kpi.name', 5, 500), baseline: safeText(kpi.baseline, 'final output.kpi.baseline', 2, 100) },
    finalComplete: true,
  };
}

export function normalizeGrowthOutput(content, step, allowedSourceUrls) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new GrowthOutputError('Growth output must be one JSON object without Markdown');
  }
  const allowlist = new Set(allowedSourceUrls);
  const validators = { research: validateResearch, strategy: validateStrategy, draft: validateDraft, claims: validateClaims, final: validateFinal };
  const normalized = validators[step]?.(parsed, allowlist);
  if (!normalized) throw new GrowthOutputError('Unknown Growth output step');
  const serialized = JSON.stringify(normalized);
  const expectedMarker = `growth.${step}.v1`;
  const hasForeignMarker = [...serialized.matchAll(ROLE_SCHEMA_MARKERS)]
    .some(([marker]) => marker !== expectedMarker);
  if (hasForeignMarker) {
    throw new GrowthOutputError('Growth output contains a foreign role marker');
  }
  if (/AUDIT_COMPLETE|FINAL_COMPLETE/.test(serialized)) {
    throw new GrowthOutputError('Growth output contains a deprecated cross-role marker');
  }
  return JSON.stringify(normalized, null, 2);
}
