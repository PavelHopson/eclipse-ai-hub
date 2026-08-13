export type SpecGateStatus = 'draft' | 'ready_for_review' | 'approved';
export type SpecGateStageId = 'constitution' | 'specify' | 'clarify' | 'plan' | 'tasks' | 'implement';

export interface SpecGateClarification {
  question: string;
  answer: string;
}

export interface SpecGateInput {
  projectName: string;
  repository: string;
  problem: string;
  userOutcome: string;
  inScope: string[];
  outOfScope: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  clarifications: SpecGateClarification[];
  rollbackPlan: string;
  evidencePaths: string[];
}

export interface SpecGateApprovalChecklist {
  scopeConfirmed: boolean;
  risksConfirmed: boolean;
  rollbackConfirmed: boolean;
}

export interface SpecGateArtifact {
  schemaVersion: 'eclipse.spec-gate.v1';
  id: string;
  status: SpecGateStatus;
  createdAt: string;
  updatedAt: string;
  input: SpecGateInput;
  stages: Array<{
    id: SpecGateStageId;
    command: `/${SpecGateStageId}`;
    status: 'complete' | 'blocked';
    summary: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    acceptanceCriterion: string;
    status: 'pending';
  }>;
  verification: {
    evidencePaths: string[];
    requiredChecks: ['typecheck', 'tests', 'build', 'desktop-qa', 'mobile-qa', 'security-review'];
  };
  policy: {
    externalActions: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
    generatedCodeExecuted: false;
    githubConnected: false;
    deployAllowed: false;
    paymentsAllowed: false;
    implementationAllowed: false;
  };
  approval: null | SpecGateApprovalChecklist & { approvedAt: string };
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const HIGH_CONFIDENCE_SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_REPOSITORY = /^(?:https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/;
const REQUIRED_CHECKS = ['typecheck', 'tests', 'build', 'desktop-qa', 'mobile-qa', 'security-review'] as const;
const MAX_INPUT_BYTES = 48 * 1024;

function cleanText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error(`${field}: нужно от ${min} до ${max} символов без управляющих символов`);
  }
  if (HIGH_CONFIDENCE_SECRET.test(normalized)) {
    throw new Error(`${field}: похоже, здесь есть секрет или API-ключ. Удалите его перед продолжением`);
  }
  return normalized;
}

function cleanList(values: string[], field: string, minItems: number, maxItems: number): string[] {
  const normalized = [...new Set(values.filter(Boolean).map((value) => cleanText(value, field, 3, 320)))];
  if (normalized.length < minItems || normalized.length > maxItems) {
    throw new Error(`${field}: нужно от ${minItems} до ${maxItems} уникальных пунктов`);
  }
  return normalized;
}

function cleanEvidencePath(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.length > 240 || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error('Evidence path должен быть относительным путём внутри workspace');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..') || segments.includes('.git')) {
    throw new Error('Evidence path не может выходить из workspace или указывать на .git');
  }
  if (CONTROL_CHARACTERS.test(normalized)) throw new Error('Evidence path содержит управляющие символы');
  return normalized;
}

export function validateSpecGateInput(input: SpecGateInput): SpecGateInput {
  const repository = cleanText(input.repository, 'Репозиторий', 3, 200);
  if (!SAFE_REPOSITORY.test(repository)) throw new Error('Репозиторий: укажите owner/repo или HTTPS-ссылку GitHub без query-параметров');
  if (input.clarifications.length > 10) throw new Error('Уточнения: оставьте не больше десяти вопросов');

  const normalized: SpecGateInput = {
    projectName: cleanText(input.projectName, 'Название проекта', 3, 80),
    repository,
    problem: cleanText(input.problem, 'Проблема', 20, 800),
    userOutcome: cleanText(input.userOutcome, 'Пользовательский результат', 10, 320),
    inScope: cleanList(input.inScope, 'В scope', 1, 10),
    outOfScope: cleanList(input.outOfScope, 'Вне scope', 1, 10),
    constraints: cleanList(input.constraints, 'Ограничения', 1, 10),
    acceptanceCriteria: cleanList(input.acceptanceCriteria, 'Критерии приёмки', 2, 12),
    clarifications: input.clarifications.map((item) => ({
      question: cleanText(item.question, 'Вопрос', 5, 240),
      answer: cleanText(item.answer, 'Ответ', 2, 400),
    })),
    rollbackPlan: cleanText(input.rollbackPlan, 'План отката', 10, 600),
    evidencePaths: [...new Set(input.evidencePaths.filter(Boolean).map(cleanEvidencePath))],
  };
  if (normalized.evidencePaths.length < 1 || normalized.evidencePaths.length > 20) {
    throw new Error('Evidence paths: укажите от одного до двадцати файлов для offline-проверки');
  }
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_INPUT_BYTES) {
    throw new Error('Спецификация превышает безопасный лимит 48 КБ');
  }
  return normalized;
}

function stage(id: SpecGateStageId, status: 'complete' | 'blocked', summary: string) {
  return { id, command: `/${id}` as const, status, summary };
}

export function createSpecGateArtifact(
  input: SpecGateInput,
  now = new Date(),
  id: string = crypto.randomUUID(),
): SpecGateArtifact {
  const normalized = validateSpecGateInput(input);
  const artifactId = cleanText(id, 'ID спецификации', 1, 96);
  if (!SAFE_ID.test(artifactId)) throw new Error('ID спецификации может содержать только латинские буквы, цифры, дефис и подчёркивание');
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'eclipse.spec-gate.v1',
    id: artifactId,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    input: normalized,
    stages: [
      stage('constitution', 'complete', 'Границы продукта, качество и запрет опасных действий зафиксированы.'),
      stage('specify', 'complete', 'Проблема, результат, scope и критерии приёмки описаны.'),
      stage('clarify', 'complete', normalized.clarifications.length ? `Закрыто уточнений: ${normalized.clarifications.length}.` : 'Открытых вопросов не заявлено.'),
      stage('plan', 'complete', 'Ограничения, evidence paths и безопасный rollback определены.'),
      stage('tasks', 'complete', `Создано проверяемых задач: ${normalized.acceptanceCriteria.length}.`),
      stage('implement', 'blocked', 'Нужны независимый review в Eclipse Chat и отдельное разрешение на реализацию.'),
    ],
    tasks: normalized.acceptanceCriteria.map((criterion, index) => ({
      id: `task-${String(index + 1).padStart(2, '0')}`,
      title: `Подтвердить критерий ${index + 1}`,
      acceptanceCriterion: criterion,
      status: 'pending',
    })),
    verification: { evidencePaths: [...normalized.evidencePaths], requiredChecks: [...REQUIRED_CHECKS] },
    policy: {
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      generatedCodeExecuted: false,
      githubConnected: false,
      deployAllowed: false,
      paymentsAllowed: false,
      implementationAllowed: false,
    },
    approval: null,
  };
}

export function markSpecGateReady(artifact: SpecGateArtifact, now = new Date()): SpecGateArtifact {
  if (artifact.status === 'approved') throw new Error('Утверждённую спецификацию нельзя вернуть в review');
  return { ...artifact, status: 'ready_for_review', updatedAt: now.toISOString(), approval: null };
}

export function approveSpecGate(
  artifact: SpecGateArtifact,
  checklist: SpecGateApprovalChecklist,
  now = new Date(),
): SpecGateArtifact {
  if (artifact.status !== 'ready_for_review') throw new Error('Сначала подготовьте спецификацию к проверке');
  if (!checklist.scopeConfirmed || !checklist.risksConfirmed || !checklist.rollbackConfirmed) {
    throw new Error('Подтвердите scope, риски и план отката');
  }
  return {
    ...artifact,
    status: 'approved',
    updatedAt: now.toISOString(),
    approval: { ...checklist, approvedAt: now.toISOString() },
  };
}

export function serializeSpecGate(artifact: SpecGateArtifact): string {
  return JSON.stringify(artifact, null, 2);
}
