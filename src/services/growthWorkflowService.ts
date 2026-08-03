export const GROWTH_STEPS = [
  { id: 'research', role: 'Researcher', label: 'Проверить факты' },
  { id: 'strategy', role: 'Strategist', label: 'Собрать стратегию' },
  { id: 'draft', role: 'Writer', label: 'Написать материал' },
  { id: 'claims', role: 'Claim Auditor', label: 'Проверить утверждения' },
  { id: 'final', role: 'Editor', label: 'Подготовить финал' },
] as const;

export type GrowthStepId = typeof GROWTH_STEPS[number]['id'];
export type GrowthRunStatus = 'draft' | 'in_progress' | 'ready_for_approval' | 'approved';

export interface GrowthWorkspaceInput {
  releaseName: string;
  releaseSummary: string;
  audience: string;
  channel: 'telegram' | 'linkedin' | 'blog';
  sourceUrls: string[];
  evidenceNotes: string;
}

export interface GrowthArtifact {
  step: GrowthStepId;
  role: string;
  content: string;
  createdAt: string;
}

export interface GrowthRun {
  schemaVersion: 'growth.run.v1';
  id: string;
  status: GrowthRunStatus;
  createdAt: string;
  updatedAt: string;
  input: GrowthWorkspaceInput;
  execution: {
    provider: string;
    model: string;
    maxRequests: 5;
    completedRequests: number;
    cost: 'provider-dependent';
  };
  policy: {
    externalActions: false;
    publishAllowed: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
  };
  artifacts: GrowthArtifact[];
  approval: null | { approvedAt: string; humanConfirmed: true };
}

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_ARTIFACT_CHARS = 16_000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function cleanText(value: string, field: string, min: number, max: number): string {
  const result = value.trim();
  if (result.length < min || result.length > max || CONTROL_CHARACTERS.test(result)) {
    throw new Error(`${field}: требуется от ${min} до ${max} символов без управляющих символов`);
  }
  return result;
}

function validateSourceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`Источник «${raw.slice(0, 60)}» не похож на ссылку`);
  }
  if (url.protocol !== 'https:') throw new Error('Источники должны использовать HTTPS');
  if (url.username || url.password) throw new Error('Ссылки с логином или паролем запрещены');
  url.hash = '';
  return url.toString();
}

export function validateGrowthInput(input: GrowthWorkspaceInput): GrowthWorkspaceInput {
  const sourceUrls = [...new Set(input.sourceUrls.map(validateSourceUrl))];
  if (sourceUrls.length === 0 || sourceUrls.length > 8) {
    throw new Error('Добавьте от 1 до 8 официальных HTTPS-источников');
  }
  if (!['telegram', 'linkedin', 'blog'].includes(input.channel)) {
    throw new Error('Выберите поддерживаемый канал');
  }

  const normalized: GrowthWorkspaceInput = {
    releaseName: cleanText(input.releaseName, 'Название релиза', 3, 120),
    releaseSummary: cleanText(input.releaseSummary, 'Что изменилось', 20, 2_000),
    audience: cleanText(input.audience, 'Аудитория', 3, 240),
    channel: input.channel,
    sourceUrls,
    evidenceNotes: cleanText(input.evidenceNotes, 'Доказательства', 20, 12_000),
  };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_INPUT_BYTES) {
    throw new Error('Материалы превышают безопасный лимит 64 КБ');
  }
  return normalized;
}

export function createGrowthRun(
  input: GrowthWorkspaceInput,
  provider: string,
  model: string,
  now = new Date(),
  id: string = crypto.randomUUID(),
): GrowthRun {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'growth.run.v1',
    id,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    input: validateGrowthInput(input),
    execution: {
      provider: cleanText(provider, 'Provider', 2, 80),
      model: cleanText(model, 'Model', 1, 160),
      maxRequests: 5,
      completedRequests: 0,
      cost: 'provider-dependent',
    },
    policy: {
      externalActions: false,
      publishAllowed: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
    },
    artifacts: [],
    approval: null,
  };
}

export function getNextGrowthStep(run: GrowthRun) {
  return GROWTH_STEPS[run.artifacts.length] ?? null;
}

export function recordGrowthArtifact(
  run: GrowthRun,
  step: GrowthStepId,
  content: string,
  now = new Date(),
): GrowthRun {
  const expected = getNextGrowthStep(run);
  if (!expected || expected.id !== step || run.status === 'approved') {
    throw new Error('Шаг нельзя сохранить: workflow изменился или уже завершён');
  }
  const normalized = cleanText(content.slice(0, MAX_ARTIFACT_CHARS), 'Ответ роли', 40, MAX_ARTIFACT_CHARS);
  const artifacts = [...run.artifacts, {
    step,
    role: expected.role,
    content: normalized,
    createdAt: now.toISOString(),
  }];
  return {
    ...run,
    status: artifacts.length === GROWTH_STEPS.length ? 'ready_for_approval' : 'in_progress',
    updatedAt: now.toISOString(),
    execution: { ...run.execution, completedRequests: artifacts.length },
    artifacts,
  };
}

export function approveGrowthRun(run: GrowthRun, humanConfirmed: boolean, now = new Date()): GrowthRun {
  if (!humanConfirmed) throw new Error('Подтвердите ручную проверку фактов и ссылок');
  if (run.status !== 'ready_for_approval' || run.artifacts.length !== GROWTH_STEPS.length) {
    throw new Error('Сначала завершите все пять ролей');
  }
  cleanText(run.artifacts.at(-1)?.content ?? '', 'Финальный материал', 40, MAX_ARTIFACT_CHARS);
  return {
    ...run,
    status: 'approved',
    updatedAt: now.toISOString(),
    approval: { approvedAt: now.toISOString(), humanConfirmed: true },
  };
}

export function editFinalArtifact(run: GrowthRun, content: string, now = new Date()): GrowthRun {
  const final = run.artifacts.at(-1);
  if (run.status !== 'ready_for_approval' || final?.step !== 'final') {
    throw new Error('Финальный материал пока нельзя редактировать');
  }
  if (content.length > MAX_ARTIFACT_CHARS || CONTROL_CHARACTERS.test(content)) {
    throw new Error(`Финальный материал: максимум ${MAX_ARTIFACT_CHARS} символов без управляющих символов`);
  }
  return {
    ...run,
    updatedAt: now.toISOString(),
    artifacts: run.artifacts.map((item) => item.step === 'final' ? { ...item, content } : item),
  };
}

export function serializeGrowthRun(run: GrowthRun): string {
  return JSON.stringify(run, null, 2);
}
