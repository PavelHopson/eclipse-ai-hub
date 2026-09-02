import type { GrowthRun } from './growthWorkflowService';

export const GROWTH_ACTION_SCHEMA = 'growth.action.v1' as const;

export type GrowthActionType = 'export' | 'publish' | 'schedule' | 'outreach';
export type GrowthActionStatus = 'draft' | 'awaiting_approval' | 'approved_not_executed' | 'cancelled';

export interface GrowthActionInput {
  type: GrowthActionType;
  connector: string;
  target: string;
  purpose: string;
  scheduledAt: string | null;
  oauthScopes: string[];
  lawfulBasis: string;
  suppressionListConfirmed: boolean;
}

export interface GrowthActionApproval {
  contentConfirmed: boolean;
  targetConfirmed: boolean;
  scopeConfirmed: boolean;
  lawfulBasisConfirmed: boolean;
}

export interface GrowthAction {
  schemaVersion: typeof GROWTH_ACTION_SCHEMA;
  id: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
  status: GrowthActionStatus;
  input: GrowthActionInput;
  preview: {
    summary: string;
    externalSideEffect: boolean;
    reversibleBeforeExecution: true;
  };
  authorization: {
    oauthGranted: false;
    credentialsStored: false;
    humanApprovalRequired: true;
  };
  execution: {
    performed: false;
    providerResponse: null;
  };
  approval: null | GrowthActionApproval & { approvedAt: string };
  events: Array<{
    at: string;
    type: 'created' | 'submitted' | 'approved' | 'cancelled';
    message: string;
  }>;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,96}$/;
const MAX_SCOPES = 8;
const HIGH_CONFIDENCE_SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;

function cleanText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${field}: нужно от ${min} до ${max} символов`);
  }
  if (HIGH_CONFIDENCE_SECRET.test(normalized)) throw new Error(`${field}: удалите secret или API-ключ`);
  return normalized;
}

function validateInput(input: GrowthActionInput, now: Date): GrowthActionInput {
  if (!['export', 'publish', 'schedule', 'outreach'].includes(input.type)) throw new Error('Неподдерживаемый тип действия');
  const scopes = [...new Set(input.oauthScopes.map((scope) => cleanText(scope, 'OAuth scope', 2, 120)))];
  if (scopes.length > MAX_SCOPES) throw new Error('Оставьте не больше восьми OAuth scopes');
  if (input.type === 'export' && scopes.length) throw new Error('Локальному экспорту OAuth scopes не нужны');
  if (input.type !== 'export' && scopes.length === 0) throw new Error('Укажите минимальный OAuth scope для внешнего действия');

  let scheduledAt: string | null = null;
  if (input.type === 'schedule') {
    if (!input.scheduledAt) throw new Error('Укажите дату и время расписания');
    const parsed = new Date(input.scheduledAt);
    if (Number.isNaN(parsed.valueOf()) || parsed.valueOf() <= now.valueOf()) throw new Error('Расписание должно быть в будущем');
    scheduledAt = parsed.toISOString();
  }

  const lawfulBasis = input.type === 'outreach'
    ? cleanText(input.lawfulBasis, 'Законное основание', 12, 300)
    : input.lawfulBasis.trim().slice(0, 300);
  if (input.type === 'outreach' && !input.suppressionListConfirmed) {
    throw new Error('Для outreach подтвердите список исключений и отписок');
  }

  return {
    type: input.type,
    connector: cleanText(input.connector, 'Коннектор', 2, 80),
    target: cleanText(input.target, 'Получатель или канал', 3, 240),
    purpose: cleanText(input.purpose, 'Цель действия', 12, 600),
    scheduledAt,
    oauthScopes: scopes,
    lawfulBasis,
    suppressionListConfirmed: input.type === 'outreach' ? true : false,
  };
}

export function createGrowthAction(
  run: GrowthRun,
  input: GrowthActionInput,
  now = new Date(),
  id: string = crypto.randomUUID(),
): GrowthAction {
  if (run.status !== 'approved' || !run.approval?.humanConfirmed) {
    throw new Error('Сначала утвердите финальный материал Growth OS');
  }
  if (!SAFE_ID.test(id)) throw new Error('ID действия содержит недопустимые символы');
  const normalized = validateInput(input, now);
  const externalSideEffect = normalized.type !== 'export';
  return {
    schemaVersion: GROWTH_ACTION_SCHEMA,
    id,
    runId: run.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'draft',
    input: normalized,
    preview: {
      summary: `${normalized.type}: ${normalized.target} — ${normalized.purpose}`,
      externalSideEffect,
      reversibleBeforeExecution: true,
    },
    authorization: {
      oauthGranted: false,
      credentialsStored: false,
      humanApprovalRequired: true,
    },
    execution: {
      performed: false,
      providerResponse: null,
    },
    approval: null,
    events: [{ at: now.toISOString(), type: 'created', message: 'Черновик действия создан без внешнего вызова' }],
  };
}

export function submitGrowthAction(action: GrowthAction, now = new Date()): GrowthAction {
  if (action.status !== 'draft') throw new Error('На проверку можно отправить только черновик');
  return {
    ...action,
    status: 'awaiting_approval',
    updatedAt: now.toISOString(),
    events: [...action.events, { at: now.toISOString(), type: 'submitted', message: 'Действие ожидает ручного подтверждения' }],
  };
}

export function approveGrowthAction(
  action: GrowthAction,
  approval: GrowthActionApproval,
  now = new Date(),
): GrowthAction {
  if (action.status !== 'awaiting_approval') throw new Error('Сначала отправьте действие на проверку');
  if (!approval.contentConfirmed || !approval.targetConfirmed || !approval.scopeConfirmed) {
    throw new Error('Подтвердите контент, получателя и минимальные permissions');
  }
  if (action.input.type === 'outreach' && !approval.lawfulBasisConfirmed) {
    throw new Error('Подтвердите законное основание outreach');
  }
  return {
    ...action,
    status: 'approved_not_executed',
    updatedAt: now.toISOString(),
    approval: { ...approval, approvedAt: now.toISOString() },
    events: [...action.events, { at: now.toISOString(), type: 'approved', message: 'План одобрен; внешний вызов не выполнялся' }],
  };
}

export function cancelGrowthAction(action: GrowthAction, now = new Date()): GrowthAction {
  if (action.status === 'cancelled') throw new Error('Действие уже отменено');
  if (action.execution.performed) throw new Error('Выполненное действие нельзя отменить этим локальным контрактом');
  return {
    ...action,
    status: 'cancelled',
    updatedAt: now.toISOString(),
    approval: null,
    events: [...action.events, { at: now.toISOString(), type: 'cancelled', message: 'Действие отменено до внешнего вызова' }],
  };
}

export function serializeGrowthAction(action: GrowthAction): string {
  return JSON.stringify(action, null, 2);
}
