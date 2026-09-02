import { describe, expect, it } from 'vitest';
import { approveGrowthRun, createGrowthRun, GROWTH_STEPS, recordGrowthArtifact } from './growthWorkflowService';
import {
  approveGrowthAction,
  cancelGrowthAction,
  createGrowthAction,
  serializeGrowthAction,
  submitGrowthAction,
  type GrowthActionInput,
} from './growthActionLedgerService';

function approvedRun() {
  let run = createGrowthRun({
    releaseName: 'Eclipse Growth release',
    releaseSummary: 'Проверенный релиз с материалом для безопасного ручного распространения.',
    audience: 'Пользователи Eclipse',
    channel: 'telegram',
    sourceUrls: ['https://eclipse-forge.ru/'],
    evidenceNotes: 'Факты, ссылки и ограничения проверены владельцем релиза.',
  }, 'ollama', 'qwen', new Date('2026-09-02T08:00:00.000Z'), 'growth-run');
  for (const step of GROWTH_STEPS) run = recordGrowthArtifact(run, step.id, `${step.role}: ${'проверенный результат '.repeat(4)}`);
  return approveGrowthRun(run, true, new Date('2026-09-02T08:30:00.000Z'));
}

const EXPORT_INPUT: GrowthActionInput = {
  type: 'export', connector: 'Локальный JSON', target: 'Папка проекта',
  purpose: 'Передать одобренный материал в ручной publishing workflow', scheduledAt: null,
  oauthScopes: [], lawfulBasis: '', suppressionListConfirmed: false,
};

describe('growth action ledger service', () => {
  it('creates a fail-closed action from an approved run only', () => {
    const unapproved = createGrowthRun(approvedRun().input, 'ollama', 'qwen');
    expect(() => createGrowthAction(unapproved, EXPORT_INPUT)).toThrow('утвердите');
    const action = createGrowthAction(approvedRun(), EXPORT_INPUT, new Date('2026-09-02T09:00:00.000Z'), 'action-1');
    expect(action.status).toBe('draft');
    expect(action.authorization).toEqual({ oauthGranted: false, credentialsStored: false, humanApprovalRequired: true });
    expect(action.execution).toEqual({ performed: false, providerResponse: null });
  });

  it('approves a plan without executing it and keeps an audit trail', () => {
    let action = createGrowthAction(approvedRun(), EXPORT_INPUT, new Date(), 'action-2');
    action = submitGrowthAction(action);
    action = approveGrowthAction(action, {
      contentConfirmed: true, targetConfirmed: true, scopeConfirmed: true, lawfulBasisConfirmed: false,
    });
    expect(action.status).toBe('approved_not_executed');
    expect(action.execution.performed).toBe(false);
    expect(action.events.map((event) => event.type)).toEqual(['created', 'submitted', 'approved']);
    expect(serializeGrowthAction(action)).not.toMatch(/apiKey|accessToken|refreshToken/);
  });

  it('requires scopes, lawful basis and suppression for outreach', () => {
    const input: GrowthActionInput = {
      ...EXPORT_INPUT,
      type: 'outreach',
      connector: 'CRM connector',
      target: 'Сегмент согласившихся клиентов',
      oauthScopes: ['messages:write'],
      lawfulBasis: 'Явное согласие получателей на продуктовые обновления',
      suppressionListConfirmed: true,
    };
    let action = createGrowthAction(approvedRun(), input, new Date(), 'action-3');
    action = submitGrowthAction(action);
    expect(() => approveGrowthAction(action, {
      contentConfirmed: true, targetConfirmed: true, scopeConfirmed: true, lawfulBasisConfirmed: false,
    })).toThrow('законное основание');
    expect(() => createGrowthAction(approvedRun(), { ...input, oauthScopes: [] })).toThrow('OAuth scope');
    expect(() => createGrowthAction(approvedRun(), { ...input, suppressionListConfirmed: false })).toThrow('исключений');
  });

  it('cancels reversibly before any external execution', () => {
    const action = cancelGrowthAction(createGrowthAction(approvedRun(), EXPORT_INPUT, new Date(), 'action-4'));
    expect(action.status).toBe('cancelled');
    expect(action.events.at(-1)?.type).toBe('cancelled');
    expect(action.execution.performed).toBe(false);
  });
});
