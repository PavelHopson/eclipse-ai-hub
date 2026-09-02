import { describe, expect, it } from 'vitest';
import { approveBuilderProject, createBuilderProject, markBuilderReady } from './builderWorkflowService';
import { renderBuilderFiles } from './builderFileRenderer';
import {
  BUILDER_CHECKS,
  createBuilderDelivery,
  prepareBuilderHandoff,
  recordBuilderCheck,
  restoreBuilderCheckpoint,
  saveBuilderCheckpoint,
  serializeBuilderDelivery,
} from './builderDeliveryService';

function artifact() {
  const draft = createBuilderProject({
    name: 'Eclipse Builder Delivery',
    audience: 'Команда разработки Eclipse',
    problem: 'Команде нужен прозрачный путь от brief до проверяемого handoff без скрытого deploy.',
    primaryAction: 'Проверить handoff',
    template: 'dashboard',
    requirements: ['Видимый diff', 'Checkpoint и rollback'],
  }, new Date('2026-09-02T08:00:00.000Z'), 'delivery-project');
  const approved = approveBuilderProject(markBuilderReady(draft), {
    requirementsConfirmed: true,
    securityBoundaryConfirmed: true,
    previewReviewed: true,
  });
  return renderBuilderFiles(approved, new Date('2026-09-02T08:05:00.000Z'));
}

describe('builder delivery service', () => {
  it('starts with a recoverable checkpoint and every external capability disabled', () => {
    const files = artifact();
    const delivery = createBuilderDelivery(files, new Date('2026-09-02T08:10:00.000Z'), 'delivery-1', 'checkpoint-1');
    expect(delivery.schemaVersion).toBe('builder.delivery.v1');
    expect(delivery.checkpoints).toHaveLength(1);
    expect(delivery.checkpoints[0].fingerprint).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(delivery.capabilities).toEqual({ network: false, mcp: false, secretsInPrompt: false, generatedCodeExecuted: false, productionDeploy: false });
    expect(delivery.budget).toMatchObject({ providerRequests: 0, estimatedCost: '0' });
    expect(restoreBuilderCheckpoint(delivery, 'checkpoint-1')).toEqual(files);
  });

  it('resets checks after a new checkpoint and limits snapshot growth', () => {
    const files = artifact();
    let delivery = createBuilderDelivery(files, new Date(), 'delivery-2', 'checkpoint-1');
    delivery = recordBuilderCheck(delivery, 'schema', 'passed', 'Строгая схема подтверждена');
    delivery = saveBuilderCheckpoint(delivery, files, 'После ручного review', new Date(), 'checkpoint-2');
    expect(delivery.checks.every((check) => check.status === 'pending')).toBe(true);
    expect(delivery.currentCheckpointId).toBe('checkpoint-2');
    delivery = saveBuilderCheckpoint(delivery, files, 'Третий', new Date(), 'checkpoint-3');
    delivery = saveBuilderCheckpoint(delivery, files, 'Четвёртый', new Date(), 'checkpoint-4');
    delivery = saveBuilderCheckpoint(delivery, files, 'Пятый', new Date(), 'checkpoint-5');
    expect(() => saveBuilderCheckpoint(delivery, files, 'Лишний')).toThrow('пяти');
  });

  it('prepares a handoff only after every check passes and never writes a patch', () => {
    let delivery = createBuilderDelivery(artifact(), new Date(), 'delivery-3', 'checkpoint-1');
    expect(() => prepareBuilderHandoff(delivery, 'master')).toThrow('все проверки');
    for (const check of BUILDER_CHECKS) {
      delivery = recordBuilderCheck(delivery, check.id, 'passed', `${check.label} подтверждена`);
    }
    expect(delivery.stage).toBe('ready_for_handoff');
    expect(() => prepareBuilderHandoff(delivery, '../new branch')).toThrow('безопасной');
    delivery = prepareBuilderHandoff(delivery, 'master', new Date('2026-09-02T09:00:00.000Z'));
    expect(delivery.handoff).toEqual({
      targetBranch: 'master',
      preparedAt: '2026-09-02T09:00:00.000Z',
      branchMustAlreadyExist: true,
      patchExported: false,
      humanReviewRequired: true,
    });
    expect(serializeBuilderDelivery(delivery)).not.toMatch(/apiKey|serviceToken|privateKey/);
  });

  it('records a failed gate and keeps handoff blocked', () => {
    let delivery = createBuilderDelivery(artifact(), new Date(), 'delivery-4', 'checkpoint-1');
    delivery = recordBuilderCheck(delivery, 'security', 'failed', 'Найден непроверенный MCP server');
    expect(delivery.stage).toBe('testing');
    expect(delivery.checks.find((check) => check.id === 'security')).toMatchObject({ status: 'failed' });
    expect(() => prepareBuilderHandoff(delivery, 'master')).toThrow('все проверки');
  });
});
