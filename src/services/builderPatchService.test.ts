import { describe, expect, it } from 'vitest';
import { approveBuilderProject, createBuilderProject, markBuilderReady } from './builderWorkflowService';
import { renderBuilderFiles } from './builderFileRenderer';
import { BUILDER_CHECKS, createBuilderDelivery, prepareBuilderHandoff, recordBuilderCheck } from './builderDeliveryService';
import { buildBuilderPatch, markBuilderPatchExported, serializeBuilderPatchArtifact } from './builderPatchService';

function readyDelivery() {
  const draft = createBuilderProject({
    name: 'Eclipse Patch Export',
    audience: 'Команда разработки Eclipse',
    problem: 'Команде нужен видимый patch, который можно проверить до записи в репозиторий.',
    primaryAction: 'Проверить patch',
    template: 'dashboard',
    requirements: ['Только существующая ветка', 'Ручной review перед применением'],
  }, new Date('2026-09-02T09:00:00.000Z'), 'patch-project');
  const project = approveBuilderProject(markBuilderReady(draft), {
    requirementsConfirmed: true,
    securityBoundaryConfirmed: true,
    previewReviewed: true,
  });
  let delivery = createBuilderDelivery(
    renderBuilderFiles(project, new Date('2026-09-02T09:05:00.000Z')),
    new Date('2026-09-02T09:10:00.000Z'),
    'patch-delivery',
    'patch-checkpoint',
  );
  for (const check of BUILDER_CHECKS) {
    delivery = recordBuilderCheck(delivery, check.id, 'passed', `${check.label}: проверено`);
  }
  return prepareBuilderHandoff(delivery, 'master', new Date('2026-09-02T09:15:00.000Z'));
}

describe('builder patch service', () => {
  it('builds a deterministic add-only Git patch bound to the current checkpoint and branch', () => {
    const artifact = buildBuilderPatch(readyDelivery(), new Date('2026-09-02T09:20:00.000Z'));
    expect(artifact.schemaVersion).toBe('builder.patch.v1');
    expect(artifact.targetBranch).toBe('master');
    expect(artifact.checkpointId).toBe('patch-checkpoint');
    expect(artifact.patchFingerprint).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(artifact.files).toHaveLength(8);
    expect(artifact.patch).toContain('diff --git a/src/App.tsx b/src/App.tsx');
    expect(artifact.patch).toContain('--- /dev/null');
    expect(artifact.patch).not.toContain('delete mode');
    expect(artifact.policy).toEqual({
      filesWritten: false,
      githubConnected: false,
      branchVerified: false,
      patchApplied: false,
      humanReviewRequired: true,
    });
  });

  it('refuses patch creation before checks and handoff are complete', () => {
    const prepared = readyDelivery();
    const unprepared = { ...prepared, stage: 'testing' as const, handoff: null };
    expect(() => buildBuilderPatch(unprepared)).toThrow('подготовьте handoff');
    const failed = {
      ...prepared,
      checks: prepared.checks.map((check) => check.id === 'security' ? { ...check, status: 'failed' as const } : check),
    };
    expect(() => buildBuilderPatch(failed)).toThrow('после всех проверок');
  });

  it('marks only the exact exported patch and keeps external actions disabled', () => {
    const delivery = readyDelivery();
    const artifact = buildBuilderPatch(delivery);
    const exported = markBuilderPatchExported(delivery, artifact, new Date('2026-09-02T09:25:00.000Z'));
    expect(exported.handoff).toMatchObject({
      targetBranch: 'master',
      patchExported: true,
      patchFingerprint: artifact.patchFingerprint,
      exportedAt: '2026-09-02T09:25:00.000Z',
      humanReviewRequired: true,
    });
    expect(exported.capabilities).toMatchObject({ network: false, mcp: false, generatedCodeExecuted: false, productionDeploy: false });
    expect(() => markBuilderPatchExported(delivery, { ...artifact, patch: `${artifact.patch}tampered` })).toThrow('не соответствует');
  });

  it('serializes a bounded passport without credentials', () => {
    const serialized = serializeBuilderPatchArtifact(buildBuilderPatch(readyDelivery()));
    expect(serialized).toContain('builder.patch.v1');
    expect(serialized).not.toMatch(/apiKey|accessToken|privateKey|cookie/i);
  });
});
