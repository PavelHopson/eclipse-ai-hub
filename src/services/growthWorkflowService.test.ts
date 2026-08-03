import { describe, expect, it } from 'vitest';
import {
  approveGrowthRun,
  createGrowthRun,
  editFinalArtifact,
  GROWTH_STEPS,
  getNextGrowthStep,
  GrowthWorkspaceInput,
  recordGrowthArtifact,
  serializeGrowthRun,
} from './growthWorkflowService';

const INPUT: GrowthWorkspaceInput = {
  releaseName: 'Eclipse Library structured catalog',
  releaseSummary: 'Каталог переведён на структурированные записи с безопасным экспортом для агентов.',
  audience: 'Разработчики и владельцы AI-продуктов',
  channel: 'telegram',
  sourceUrls: ['https://library.eclipse-forge.ru/', 'https://github.com/PavelHopson/eclipse-library'],
  evidenceNotes: 'Production build и проверки прошли. Прямые install-действия из каталога запрещены.',
};

describe('growth workflow service', () => {
  it('creates a fail-closed run without tools or publishing', () => {
    const run = createGrowthRun(INPUT, 'ollama', 'qwen2.5', new Date('2026-08-03T10:00:00Z'), 'run-1');
    expect(run.policy).toEqual({
      externalActions: false,
      publishAllowed: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
    });
    expect(getNextGrowthStep(run)?.id).toBe('research');
    expect(serializeGrowthRun(run)).not.toContain('apiKey');
  });

  it('requires ordered steps and explicit human approval', () => {
    let run = createGrowthRun(INPUT, 'ollama', 'qwen2.5', new Date('2026-08-03T10:00:00Z'), 'run-2');
    expect(() => recordGrowthArtifact(run, 'draft', 'x'.repeat(80))).toThrow('Шаг нельзя сохранить');
    for (const step of GROWTH_STEPS) {
      run = recordGrowthArtifact(run, step.id, `${step.role}: ${'проверенный результат '.repeat(4)}`);
    }
    expect(run.status).toBe('ready_for_approval');
    run = editFinalArtifact(run, 'Финальный материал вручную уточнён и содержит только проверенные факты и один понятный CTA.');
    expect(run.artifacts.at(-1)?.content).toContain('вручную уточнён');
    expect(() => approveGrowthRun(run, false)).toThrow('ручную проверку');
    expect(approveGrowthRun(run, true).status).toBe('approved');
  });

  it('does not approve an empty edited final artifact', () => {
    let run = createGrowthRun(INPUT, 'ollama', 'qwen2.5', new Date('2026-08-03T10:00:00Z'), 'run-3');
    for (const step of GROWTH_STEPS) run = recordGrowthArtifact(run, step.id, `${step.role}: ${'результат '.repeat(8)}`);
    run = editFinalArtifact(run, '');
    expect(() => approveGrowthRun(run, true)).toThrow('Финальный материал');
  });

  it('rejects unsafe or ambiguous source inputs', () => {
    expect(() => createGrowthRun({ ...INPUT, sourceUrls: ['http://example.com'] }, 'ollama', 'qwen2.5')).toThrow('HTTPS');
    expect(() => createGrowthRun({ ...INPUT, sourceUrls: ['https://user:pass@example.com'] }, 'ollama', 'qwen2.5')).toThrow('логином');
    expect(() => createGrowthRun({ ...INPUT, sourceUrls: [] }, 'ollama', 'qwen2.5')).toThrow('1 до 8');
  });
});
