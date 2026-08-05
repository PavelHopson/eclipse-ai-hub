// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { transformWithEsbuild } from 'vite';
import { approveBuilderProject, createBuilderProject, markBuilderReady } from './builderWorkflowService';
import { renderBuilderFiles } from './builderFileRenderer';

describe('generated Builder source', () => {
  it('parses the emitted TypeScript and TSX without writing or executing it', async () => {
    const draft = createBuilderProject({
      name: 'Eclipse <Review> Portal',
      audience: 'Клиенты AI-студии',
      problem: 'Статус проекта должен быть понятен без инструкции.',
      primaryAction: 'Открыть проект',
      template: 'dashboard',
      requirements: ['Работает на телефоне'],
    }, new Date('2026-08-05T10:00:00Z'), 'builder-source');
    const approved = approveBuilderProject(markBuilderReady(draft), {
      requirementsConfirmed: true,
      securityBoundaryConfirmed: true,
      previewReviewed: true,
    });
    const artifact = renderBuilderFiles(approved);

    for (const file of artifact.files.filter((item) => item.path.endsWith('.tsx') || item.path.endsWith('.ts'))) {
      const loader = file.path.endsWith('.tsx') ? 'tsx' : 'ts';
      const result = await transformWithEsbuild(file.content, file.path, { loader, jsx: 'automatic' });
      expect(result.code.length, file.path).toBeGreaterThan(0);
    }

    expect(() => JSON.parse(artifact.files.find((file) => file.path === 'package.json')!.content)).not.toThrow();
    expect(() => JSON.parse(artifact.files.find((file) => file.path === 'tsconfig.json')!.content)).not.toThrow();
  });
});
