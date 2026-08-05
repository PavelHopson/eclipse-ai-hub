import { describe, expect, it } from 'vitest';
import { approveBuilderProject, createBuilderProject, markBuilderReady, type BuilderInput } from './builderWorkflowService';
import { renderBuilderFiles, serializeBuilderFiles } from './builderFileRenderer';

const INPUT: BuilderInput = {
  name: 'Eclipse Portal',
  audience: 'Клиенты AI-студии',
  problem: 'Клиентам нужен один экран, где видны статус проекта и ближайшее решение.',
  primaryAction: 'Открыть проект',
  template: 'dashboard',
  requirements: ['Работает на телефоне'],
};

function approvedProject(input = INPUT) {
  const draft = createBuilderProject(input, new Date('2026-08-05T10:00:00Z'), 'builder-render');
  const ready = markBuilderReady(draft, new Date('2026-08-05T10:05:00Z'));
  return approveBuilderProject(ready, {
    requirementsConfirmed: true, securityBoundaryConfirmed: true, previewReviewed: true,
  }, new Date('2026-08-05T10:10:00Z'));
}

describe('builder file renderer', () => {
  it('requires an approved source plan', () => {
    const draft = createBuilderProject(INPUT, new Date(), 'draft-render');
    expect(() => renderBuilderFiles(draft)).toThrow('утвердите');
  });

  it('emits a bounded reviewable React/Vite scaffold without executing it', () => {
    const artifact = renderBuilderFiles(approvedProject(), new Date('2026-08-05T11:00:00Z'));
    expect(artifact.schemaVersion).toBe('builder.files.v1');
    expect(artifact.files.map((file) => file.path)).toEqual([
      'index.html', 'package.json', 'README.md', 'src/App.tsx', 'src/main.tsx', 'src/styles.css', 'tsconfig.json', 'vite.config.ts',
    ]);
    expect(artifact.policy).toEqual({
      filesWritten: false,
      dependenciesInstalled: false,
      generatedCodeExecuted: false,
      networkAccess: false,
      githubConnected: false,
      deployed: false,
    });
    expect(artifact.files.reduce((sum, file) => sum + file.sizeBytes, 0)).toBeLessThan(128 * 1024);
  });

  it('escapes user strings before placing them in generated TypeScript and Markdown', () => {
    const project = approvedProject({
      ...INPUT,
      name: 'Safe </script> Portal',
      problem: 'Пользовательский текст не должен превращаться в исполняемый HTML или JavaScript.',
      requirements: ['Не выполнять <script>alert(1)</script>'],
    });
    const artifact = renderBuilderFiles(project);
    const app = artifact.files.find((file) => file.path === 'src/App.tsx')!.content;
    const readme = artifact.files.find((file) => file.path === 'README.md')!.content;
    expect(app).toContain('\\u003c/script\\u003e');
    expect(app).not.toContain('</script>');
    expect(readme).not.toContain('<script>');
  });

  it('pins scaffold dependencies and exports no credentials', () => {
    const artifact = renderBuilderFiles(approvedProject());
    const packageFile = JSON.parse(artifact.files.find((file) => file.path === 'package.json')!.content);
    expect(packageFile.dependencies.react).toBe('19.2.4');
    expect(packageFile.devDependencies.vite).toBe('6.4.2');
    const serialized = serializeBuilderFiles(artifact);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('serviceToken');
  });
});
