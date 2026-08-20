import { describe, expect, it } from 'vitest';
import { approveAutomationAudit, createAutomationAudit, markAutomationAuditReady, type AutomationAuditInput } from './automationAuditService';

const INPUT: AutomationAuditInput = {
  businessName: 'Demo Studio', contactRole: 'Owner', objective: 'Сократить ручную подготовку коммерческих предложений.',
  processName: 'Lead qualification', processSteps: ['Получить заявку', 'Проверить требования', 'Подготовить предложение'], systems: ['Сайт', 'CRM'],
  constraints: ['Только публичные данные', 'Без OAuth'],
  evidence: [{ id: 'EV-01', description: 'Пять заявок потребовали ручной сверки.', source: 'Обезличенная выборка интервью' }],
  proposal: { outcome: 'Проверить экономию времени на пяти заявках.', scope: ['Read-only process map'], exclusions: ['Автоотправка клиенту'], pilotMetric: 'Минуты на одно предложение' },
  validation: { problem: 'Владелец тратит время на повторяющуюся сверку требований.', audience: 'Малый B2B-бизнес', offer: 'Read-only audit и pilot proposal', interviews: 5, waitlist: 0, pilotEvidence: 'Пять обезличенных интервью, продаж пока нет.' },
  claims: [{ claim: 'Пять заявок потребовали ручной сверки.', evidenceIds: ['EV-01'] }, { claim: 'Pilot сократит время вдвое.', evidenceIds: [] }],
};

describe('automation audit', () => {
  it('creates a read-only map and qualifies unsupported claims', () => {
    const audit = createAutomationAudit(INPUT, new Date('2026-08-20T10:00:00Z'), 'audit-1');
    expect(audit.processMap.every((step) => step.access === 'read_only')).toBe(true);
    expect(audit.claimAudit.map((claim) => claim.status)).toEqual(['verified', 'qualified']);
    expect(audit.policy.externalActions).toBe(false);
  });

  it('issues a bounded receipt only after explicit approval', () => {
    const ready = markAutomationAuditReady(createAutomationAudit(INPUT, new Date(), 'audit-1'));
    expect(() => approveAutomationAudit(ready, { scopeConfirmed: true, claimsConfirmed: false, noExternalActionsConfirmed: true })).toThrow(/Подтвердите/);
    const approved = approveAutomationAudit(ready, { scopeConfirmed: true, claimsConfirmed: true, noExternalActionsConfirmed: true }, new Date('2026-08-20T11:00:00Z'));
    expect(approved.receipt?.statement).toMatch(/не подтверждает выполнение/);
  });

  it('rejects secrets and unknown evidence bindings', () => {
    expect(() => createAutomationAudit({ ...INPUT, objective: 'Use token=super-secret-value-now' })).toThrow(/секрет/);
    expect(() => createAutomationAudit({ ...INPUT, claims: [{ claim: 'Unknown evidence claim', evidenceIds: ['EV-404'] }] })).toThrow(/неизвестный/);
  });
});
