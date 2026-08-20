export type ClaimStatus = 'verified' | 'qualified' | 'remove';
export type AuditStatus = 'draft' | 'ready_for_review' | 'approved';

export interface AutomationAuditInput {
  businessName: string;
  contactRole: string;
  objective: string;
  processName: string;
  processSteps: string[];
  systems: string[];
  constraints: string[];
  evidence: Array<{ id: string; description: string; source: string }>;
  proposal: { outcome: string; scope: string[]; exclusions: string[]; pilotMetric: string };
  validation: {
    problem: string;
    audience: string;
    offer: string;
    interviews: number;
    waitlist: number;
    pilotEvidence: string;
  };
  claims: Array<{ claim: string; evidenceIds: string[] }>;
}

export interface AutomationAuditArtifact {
  schemaVersion: 'eclipse.automation-audit.v1';
  id: string;
  status: AuditStatus;
  createdAt: string;
  updatedAt: string;
  input: AutomationAuditInput;
  processMap: Array<{ order: number; step: string; system: string | null; access: 'read_only' }>;
  claimAudit: Array<{ claim: string; status: ClaimStatus; evidenceIds: string[]; reason: string }>;
  policy: { externalActions: false; oauthConnected: false; productionChanges: false; paymentsAllowed: false; readOnly: true };
  approval: null | { scopeConfirmed: true; claimsConfirmed: true; noExternalActionsConfirmed: true; approvedAt: string };
  receipt: null | { receiptId: string; decision: 'approved'; issuedAt: string; statement: string };
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S{8,})/i;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const MAX_BYTES = 64 * 1024;

function text(value: string, field: string, min: number, max: number) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < min || clean.length > max || CONTROL.test(clean)) throw new Error(`${field}: нужно от ${min} до ${max} символов`);
  if (SECRET.test(clean)) throw new Error(`${field}: удалите секрет, токен или пароль`);
  return clean;
}

function list(values: string[], field: string, min: number, max: number) {
  const clean = [...new Set(values.filter(Boolean).map((value) => text(value, field, 2, 320)))];
  if (clean.length < min || clean.length > max) throw new Error(`${field}: нужно от ${min} до ${max} уникальных пунктов`);
  return clean;
}

export function validateAutomationAuditInput(input: AutomationAuditInput): AutomationAuditInput {
  const evidence = input.evidence.map((item) => ({
    id: text(item.id, 'Evidence ID', 2, 40),
    description: text(item.description, 'Evidence', 5, 320),
    source: text(item.source, 'Evidence source', 3, 240),
  }));
  if (evidence.length < 1 || evidence.length > 20 || new Set(evidence.map((item) => item.id)).size !== evidence.length) {
    throw new Error('Evidence: нужно 1–20 записей с уникальными ID');
  }
  if (evidence.some((item) => !SAFE_ID.test(item.id))) throw new Error('Evidence ID: только латинские буквы, цифры, дефис и подчёркивание');
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const claims = input.claims.map((item) => ({
    claim: text(item.claim, 'Claim', 5, 400),
    evidenceIds: [...new Set(item.evidenceIds.filter(Boolean))],
  }));
  if (claims.length < 1 || claims.length > 12) throw new Error('Claims: нужно от 1 до 12 утверждений');
  if (claims.some((item) => item.evidenceIds.some((id) => !evidenceIds.has(id)))) throw new Error('Claim ссылается на неизвестный Evidence ID');

  const normalized: AutomationAuditInput = {
    businessName: text(input.businessName, 'Компания', 2, 100),
    contactRole: text(input.contactRole, 'Роль', 2, 100),
    objective: text(input.objective, 'Цель', 10, 500),
    processName: text(input.processName, 'Процесс', 3, 120),
    processSteps: list(input.processSteps, 'Шаг процесса', 2, 12),
    systems: list(input.systems, 'Система', 1, 12),
    constraints: list(input.constraints, 'Ограничение', 1, 10),
    evidence,
    proposal: {
      outcome: text(input.proposal.outcome, 'Результат pilot', 10, 400),
      scope: list(input.proposal.scope, 'Scope', 1, 10),
      exclusions: list(input.proposal.exclusions, 'Exclusions', 1, 10),
      pilotMetric: text(input.proposal.pilotMetric, 'Pilot metric', 5, 240),
    },
    validation: {
      problem: text(input.validation.problem, 'Problem', 10, 500),
      audience: text(input.validation.audience, 'Audience', 5, 320),
      offer: text(input.validation.offer, 'Offer', 5, 320),
      interviews: Math.max(0, Math.min(10_000, Math.trunc(input.validation.interviews))),
      waitlist: Math.max(0, Math.min(1_000_000, Math.trunc(input.validation.waitlist))),
      pilotEvidence: text(input.validation.pilotEvidence, 'Pilot evidence', 5, 500),
    },
    claims,
  };
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BYTES) throw new Error('Audit превышает лимит 64 КБ');
  return normalized;
}

export function createAutomationAudit(input: AutomationAuditInput, now = new Date(), id: string = crypto.randomUUID()): AutomationAuditArtifact {
  const clean = validateAutomationAuditInput(input);
  if (!SAFE_ID.test(id)) throw new Error('Audit ID содержит недопустимые символы');
  const evidenceIds = new Set(clean.evidence.map((item) => item.id));
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'eclipse.automation-audit.v1', id, status: 'draft', createdAt: timestamp, updatedAt: timestamp, input: clean,
    processMap: clean.processSteps.map((step, index) => ({ order: index + 1, step, system: clean.systems[index] ?? null, access: 'read_only' })),
    claimAudit: clean.claims.map((item) => {
      const bound = item.evidenceIds.filter((evidenceId) => evidenceIds.has(evidenceId));
      return bound.length
        ? { claim: item.claim, status: 'verified' as const, evidenceIds: bound, reason: 'Утверждение связано с указанным evidence; человек проверяет достаточность источника.' }
        : { claim: item.claim, status: 'qualified' as const, evidenceIds: [], reason: 'Нет связанного evidence: оставить как гипотезу или удалить.' };
    }),
    policy: { externalActions: false, oauthConnected: false, productionChanges: false, paymentsAllowed: false, readOnly: true },
    approval: null, receipt: null,
  };
}

export function markAutomationAuditReady(artifact: AutomationAuditArtifact, now = new Date()) {
  if (artifact.status === 'approved') throw new Error('Утверждённый audit нельзя изменить');
  return { ...artifact, status: 'ready_for_review' as const, updatedAt: now.toISOString(), approval: null, receipt: null };
}

export function approveAutomationAudit(artifact: AutomationAuditArtifact, checklist: { scopeConfirmed: boolean; claimsConfirmed: boolean; noExternalActionsConfirmed: boolean }, now = new Date()) {
  if (artifact.status !== 'ready_for_review') throw new Error('Сначала передайте audit на review');
  if (!checklist.scopeConfirmed || !checklist.claimsConfirmed || !checklist.noExternalActionsConfirmed) throw new Error('Подтвердите scope, claims и запрет внешних действий');
  const issuedAt = now.toISOString();
  return {
    ...artifact, status: 'approved' as const, updatedAt: issuedAt,
    approval: { scopeConfirmed: true as const, claimsConfirmed: true as const, noExternalActionsConfirmed: true as const, approvedAt: issuedAt },
    receipt: { receiptId: `receipt-${artifact.id}`, decision: 'approved' as const, issuedAt, statement: 'Одобрен read-only pilot proposal. Receipt не подтверждает выполнение интеграций, платежей или production-изменений.' },
  };
}

export const serializeAutomationAudit = (artifact: AutomationAuditArtifact) => JSON.stringify(artifact, null, 2);
