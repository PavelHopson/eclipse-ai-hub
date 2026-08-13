import { describe, expect, it } from 'vitest';
import {
  approveSpecGate,
  createSpecGateArtifact,
  markSpecGateReady,
  serializeSpecGate,
  type SpecGateInput,
} from './specGateService';

const INPUT: SpecGateInput = {
  projectName: 'Eclipse Library Spec Gate',
  repository: 'PavelHopson/eclipse-library',
  problem: 'Большая задача может перейти в код до того, как команда согласует границы, риски и проверяемый результат.',
  userOutcome: 'Команда видит одну утверждённую спецификацию до начала реализации.',
  inScope: ['Создать versioned JSON', 'Показать независимый review'],
  outOfScope: ['Автоматический deploy', 'Автономная установка зависимостей'],
  constraints: ['Работать offline', 'Не хранить секреты'],
  acceptanceCriteria: ['JSON проходит строгую проверку', 'Реализация остаётся заблокированной'],
  clarifications: [{ question: 'Кто утверждает реализацию?', answer: 'Участник с правом TASK_APPROVE в Eclipse Chat.' }],
  rollbackPlan: 'Удалить только новый модуль и вернуть предыдущую навигацию без изменения данных.',
  evidencePaths: ['src/pages/SpecGate.tsx', 'src/services/specGateService.test.ts'],
};

describe('spec gate service', () => {
  it('creates the six-stage bounded artifact without execution permissions', () => {
    const artifact = createSpecGateArtifact(INPUT, new Date('2026-08-13T10:00:00Z'), 'spec-1');
    expect(artifact.schemaVersion).toBe('eclipse.spec-gate.v1');
    expect(artifact.stages.map((item) => item.command)).toEqual(['/constitution', '/specify', '/clarify', '/plan', '/tasks', '/implement']);
    expect(artifact.stages.at(-1)).toMatchObject({ id: 'implement', status: 'blocked' });
    expect(artifact.tasks).toHaveLength(2);
    expect(Object.values(artifact.policy).every((value) => value === false)).toBe(true);
  });

  it('requires an explicit complete approval but never unlocks implementation', () => {
    let artifact = createSpecGateArtifact(INPUT, new Date(), 'spec-2');
    expect(() => approveSpecGate(artifact, { scopeConfirmed: true, risksConfirmed: true, rollbackConfirmed: true })).toThrow('Сначала');
    artifact = markSpecGateReady(artifact, new Date('2026-08-13T11:00:00Z'));
    expect(() => approveSpecGate(artifact, { scopeConfirmed: true, risksConfirmed: false, rollbackConfirmed: true })).toThrow('Подтвердите');
    artifact = approveSpecGate(artifact, { scopeConfirmed: true, risksConfirmed: true, rollbackConfirmed: true }, new Date('2026-08-13T12:00:00Z'));
    expect(artifact.status).toBe('approved');
    expect(artifact.policy.implementationAllowed).toBe(false);
    expect(artifact.stages.at(-1)?.status).toBe('blocked');
  });

  it('rejects secrets, unsafe evidence paths and vague acceptance criteria', () => {
    expect(() => createSpecGateArtifact({ ...INPUT, problem: `Использовать ключ sk-${'a'.repeat(24)} в новом workflow.` })).toThrow('секрет');
    expect(() => createSpecGateArtifact({ ...INPUT, evidencePaths: ['../outside.txt'] })).toThrow('workspace');
    expect(() => createSpecGateArtifact({ ...INPUT, acceptanceCriteria: ['Готово'] })).toThrow('от 2 до 12');
  });

  it('exports a portable JSON contract without credentials', () => {
    const serialized = serializeSpecGate(createSpecGateArtifact(INPUT, new Date(), 'spec-3'));
    expect(JSON.parse(serialized).schemaVersion).toBe('eclipse.spec-gate.v1');
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('serviceToken');
  });
});
