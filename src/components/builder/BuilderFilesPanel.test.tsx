import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { approveBuilderProject, createBuilderProject, markBuilderReady } from '../../services/builderWorkflowService';
import { renderBuilderFiles } from '../../services/builderFileRenderer';
import { BuilderFilesPanel } from './BuilderFilesPanel';

describe('BuilderFilesPanel', () => {
  it('shows the review boundary and generated file list', () => {
    const draft = createBuilderProject({
      name: 'Eclipse Portal',
      audience: 'Клиенты студии',
      problem: 'Статус проекта сложно увидеть в одном месте.',
      primaryAction: 'Открыть проект',
      template: 'dashboard',
      requirements: ['Работает на телефоне'],
    }, new Date('2026-08-05T10:00:00Z'), 'builder-panel');
    const ready = markBuilderReady(draft, new Date('2026-08-05T10:05:00Z'));
    const approved = approveBuilderProject(ready, {
      requirementsConfirmed: true,
      securityBoundaryConfirmed: true,
      previewReviewed: true,
    }, new Date('2026-08-05T10:10:00Z'));

    const html = renderToStaticMarkup(
      <BuilderFilesPanel artifact={renderBuilderFiles(approved, new Date('2026-08-05T10:15:00Z'))} />,
    );

    expect(html).toContain('5. Проверьте подготовленные файлы');
    expect(html).toContain('8 файлов');
    expect(html).toContain('src/App.tsx');
    expect(html).toContain('Скачать files JSON');
    expect(html).toContain('Этот экран не выполняет код');
  });
});
