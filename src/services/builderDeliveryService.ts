import type { BuilderFilesArtifact } from './builderFileRenderer';

export const BUILDER_DELIVERY_SCHEMA = 'builder.delivery.v1' as const;

export const BUILDER_CHECKS = [
  { id: 'schema', label: 'Схема и размеры' },
  { id: 'dependencies', label: 'Зависимости и лицензии' },
  { id: 'security', label: 'Проверка безопасности' },
  { id: 'unit', label: 'Модульные тесты' },
  { id: 'build', label: 'Продакшен-сборка' },
  { id: 'desktop', label: 'Проверка на компьютере' },
  { id: 'mobile', label: 'Проверка на телефоне' },
] as const;

export type BuilderCheckId = typeof BUILDER_CHECKS[number]['id'];
export type BuilderCheckStatus = 'pending' | 'passed' | 'failed';
export type BuilderDeliveryStage = 'checkpoint' | 'testing' | 'ready_for_handoff' | 'handoff_prepared';

export interface BuilderCheckpoint {
  id: string;
  label: string;
  createdAt: string;
  fingerprint: string;
  artifact: BuilderFilesArtifact;
}

export interface BuilderDelivery {
  schemaVersion: typeof BUILDER_DELIVERY_SCHEMA;
  id: string;
  projectId: string;
  sourceArtifactId: string;
  createdAt: string;
  updatedAt: string;
  stage: BuilderDeliveryStage;
  capabilities: {
    network: false;
    mcp: false;
    secretsInPrompt: false;
    generatedCodeExecuted: false;
    productionDeploy: false;
  };
  budget: {
    providerRequests: 0;
    estimatedCost: '0';
    currency: 'USD';
    reason: 'deterministic-local-renderer';
  };
  checkpoints: BuilderCheckpoint[];
  currentCheckpointId: string;
  checks: Array<{
    id: BuilderCheckId;
    label: string;
    status: BuilderCheckStatus;
    note: string;
    checkedAt: string | null;
  }>;
  handoff: null | {
    targetBranch: string;
    preparedAt: string;
    branchMustAlreadyExist: true;
    patchExported: false;
    humanReviewRequired: true;
  };
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,96}$/;
const SAFE_BRANCH = /^(?![./])(?!.*(?:\.\.|\s|[~^:?*\[\\]))[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const MAX_CHECKPOINTS = 5;

function cleanText(value: string, field: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${field}: укажите от 1 до ${max} символов без управляющих символов`);
  }
  return normalized;
}

function assertSafeArtifact(artifact: BuilderFilesArtifact): void {
  if (artifact.schemaVersion !== 'builder.files.v1' || artifact.reviewStatus !== 'unreviewed') {
    throw new Error('Нужен неподтверждённый builder.files.v1 artifact');
  }
  if (
    artifact.policy.filesWritten
    || artifact.policy.dependenciesInstalled
    || artifact.policy.generatedCodeExecuted
    || artifact.policy.networkAccess
    || artifact.policy.githubConnected
    || artifact.policy.deployed
  ) {
    throw new Error('Delivery принимает только пассивный artifact без внешних действий');
  }
  if (!artifact.files.length || artifact.files.length > 24) throw new Error('Artifact содержит недопустимое число файлов');
  const bytes = artifact.files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (bytes > 128 * 1024) throw new Error('Artifact превышает безопасный лимит 128 КБ');
}

function cloneArtifact(artifact: BuilderFilesArtifact): BuilderFilesArtifact {
  return JSON.parse(JSON.stringify(artifact)) as BuilderFilesArtifact;
}

function artifactFingerprint(artifact: BuilderFilesArtifact): string {
  const input = [...artifact.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}\u0000${file.sizeBytes}\u0000${file.content}`)
    .join('\u0001');
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function makeCheckpoint(artifact: BuilderFilesArtifact, label: string, now: Date, id: string): BuilderCheckpoint {
  if (!SAFE_ID.test(id)) throw new Error('ID checkpoint содержит недопустимые символы');
  return {
    id,
    label: cleanText(label, 'Название checkpoint', 80),
    createdAt: now.toISOString(),
    fingerprint: artifactFingerprint(artifact),
    artifact: cloneArtifact(artifact),
  };
}

export function createBuilderDelivery(
  artifact: BuilderFilesArtifact,
  now = new Date(),
  id: string = crypto.randomUUID(),
  checkpointId: string = crypto.randomUUID(),
): BuilderDelivery {
  assertSafeArtifact(artifact);
  if (!SAFE_ID.test(id)) throw new Error('ID delivery содержит недопустимые символы');
  const timestamp = now.toISOString();
  const checkpoint = makeCheckpoint(artifact, 'Исходный проверяемый scaffold', now, checkpointId);
  return {
    schemaVersion: BUILDER_DELIVERY_SCHEMA,
    id,
    projectId: artifact.projectId,
    sourceArtifactId: artifact.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    stage: 'checkpoint',
    capabilities: {
      network: false,
      mcp: false,
      secretsInPrompt: false,
      generatedCodeExecuted: false,
      productionDeploy: false,
    },
    budget: {
      providerRequests: 0,
      estimatedCost: '0',
      currency: 'USD',
      reason: 'deterministic-local-renderer',
    },
    checkpoints: [checkpoint],
    currentCheckpointId: checkpoint.id,
    checks: BUILDER_CHECKS.map((check) => ({ ...check, status: 'pending', note: '', checkedAt: null })),
    handoff: null,
  };
}

export function saveBuilderCheckpoint(
  delivery: BuilderDelivery,
  artifact: BuilderFilesArtifact,
  label: string,
  now = new Date(),
  checkpointId: string = crypto.randomUUID(),
): BuilderDelivery {
  assertSafeArtifact(artifact);
  if (artifact.projectId !== delivery.projectId) throw new Error('Checkpoint относится к другому проекту');
  if (delivery.checkpoints.length >= MAX_CHECKPOINTS) throw new Error('Оставьте не больше пяти checkpoint');
  const checkpoint = makeCheckpoint(artifact, label, now, checkpointId);
  return {
    ...delivery,
    updatedAt: now.toISOString(),
    stage: 'checkpoint',
    checkpoints: [...delivery.checkpoints, checkpoint],
    currentCheckpointId: checkpoint.id,
    checks: delivery.checks.map((check) => ({ ...check, status: 'pending', note: '', checkedAt: null })),
    handoff: null,
  };
}

export function restoreBuilderCheckpoint(delivery: BuilderDelivery, checkpointId: string): BuilderFilesArtifact {
  const checkpoint = delivery.checkpoints.find((item) => item.id === checkpointId);
  if (!checkpoint) throw new Error('Checkpoint не найден');
  assertSafeArtifact(checkpoint.artifact);
  return cloneArtifact(checkpoint.artifact);
}

export function recordBuilderCheck(
  delivery: BuilderDelivery,
  id: BuilderCheckId,
  status: Exclude<BuilderCheckStatus, 'pending'>,
  note: string,
  now = new Date(),
): BuilderDelivery {
  if (!delivery.checks.some((check) => check.id === id)) throw new Error('Неизвестная проверка');
  const normalizedNote = cleanText(note, 'Комментарий проверки', 240);
  const checks = delivery.checks.map((check) => check.id === id
    ? { ...check, status, note: normalizedNote, checkedAt: now.toISOString() }
    : check);
  const allPassed = checks.every((check) => check.status === 'passed');
  return {
    ...delivery,
    updatedAt: now.toISOString(),
    stage: allPassed ? 'ready_for_handoff' : 'testing',
    checks,
    handoff: null,
  };
}

export function prepareBuilderHandoff(delivery: BuilderDelivery, targetBranch: string, now = new Date()): BuilderDelivery {
  if (!delivery.checks.every((check) => check.status === 'passed')) {
    throw new Error('Сначала завершите все проверки без ошибок');
  }
  const branch = cleanText(targetBranch, 'Целевая ветка', 120);
  if (!SAFE_BRANCH.test(branch) || branch.endsWith('/') || branch.endsWith('.lock')) {
    throw new Error('Укажите имя уже существующей безопасной Git-ветки');
  }
  return {
    ...delivery,
    updatedAt: now.toISOString(),
    stage: 'handoff_prepared',
    handoff: {
      targetBranch: branch,
      preparedAt: now.toISOString(),
      branchMustAlreadyExist: true,
      patchExported: false,
      humanReviewRequired: true,
    },
  };
}

export function serializeBuilderDelivery(delivery: BuilderDelivery): string {
  return JSON.stringify(delivery, null, 2);
}
