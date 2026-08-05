import { describe, expect, it } from 'vitest';
import {
  approveBuilderProject,
  createBuilderProject,
  markBuilderReady,
  serializeBuilderProject,
  type BuilderInput,
} from './builderWorkflowService';

const INPUT: BuilderInput = {
  name: 'Eclipse Client Portal',
  audience: 'Клиенты небольшой AI-студии',
  problem: 'Клиенты не понимают, на каком этапе находится проект и какое решение требуется от них сейчас.',
  primaryAction: 'Открыть статус проекта',
  template: 'dashboard',
  requirements: ['Работает на телефоне', 'Показывает историю решений'],
};

describe('builder workflow service', () => {
  it('creates a bounded project plan without execution permissions', () => {
    const project = createBuilderProject(INPUT, new Date('2026-08-05T10:00:00Z'), 'builder-1');
    expect(project.schemaVersion).toBe('builder.project.v1');
    expect(project.blueprint.states).toEqual(['loading', 'empty', 'error', 'success', 'disabled', 'no-access']);
    expect(project.blueprint.routes).toHaveLength(3);
    expect(project.policy).toEqual({
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      generatedCodeExecuted: false,
      githubConnected: false,
      deployAllowed: false,
      paymentsAllowed: false,
    });
    expect(project.buildQueue.find((item) => item.id === 'publish')?.status).toBe('blocked');
  });

  it('builds distinct blueprints for all supported templates', () => {
    const landing = createBuilderProject({ ...INPUT, template: 'landing' }, new Date(), 'landing');
    const catalog = createBuilderProject({ ...INPUT, template: 'catalog' }, new Date(), 'catalog');
    expect(landing.blueprint.routes.map((route) => route.path)).toEqual(['/']);
    expect(catalog.blueprint.entities).toContain('Catalog item');
    expect(catalog.preview.eyebrow).toBe('Каталог');
  });

  it('requires a complete review before plan approval', () => {
    let project = createBuilderProject(INPUT, new Date(), 'builder-2');
    expect(() => approveBuilderProject(project, { requirementsConfirmed: true, securityBoundaryConfirmed: true, previewReviewed: true })).toThrow('Сначала');
    project = markBuilderReady(project, new Date('2026-08-05T11:00:00Z'));
    expect(() => approveBuilderProject(project, { requirementsConfirmed: true, securityBoundaryConfirmed: false, previewReviewed: true })).toThrow('Подтвердите');
    project = approveBuilderProject(project, { requirementsConfirmed: true, securityBoundaryConfirmed: true, previewReviewed: true }, new Date('2026-08-05T12:00:00Z'));
    expect(project.status).toBe('approved');
    expect(project.buildQueue.find((item) => item.id === 'interface')).toMatchObject({ status: 'ready', gate: null });
    expect(project.policy.deployAllowed).toBe(false);
  });

  it('rejects secrets, oversized requirements and unsupported templates', () => {
    expect(() => createBuilderProject({ ...INPUT, problem: `Используй этот ключ sk-${'a'.repeat(24)} для запуска приложения` })).toThrow('секрет');
    expect(() => createBuilderProject({ ...INPUT, requirements: Array.from({ length: 9 }, (_, index) => `Требование ${index}`) })).toThrow('восьми');
    expect(() => createBuilderProject({ ...INPUT, template: 'mobile' as BuilderInput['template'] })).toThrow('поддерживаемых');
    expect(() => createBuilderProject(INPUT, new Date(), '../unsafe')).toThrow('ID проекта');
  });

  it('exports only the versioned plan and no credentials', () => {
    const serialized = serializeBuilderProject(createBuilderProject(INPUT, new Date(), 'builder-3'));
    expect(JSON.parse(serialized).schemaVersion).toBe('builder.project.v1');
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('serviceToken');
  });
});
