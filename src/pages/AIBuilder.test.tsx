import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuilderPreview } from '../components/builder/BuilderPreview';
import { createBuilderProject } from '../services/builderWorkflowService';
import { AIBuilder } from './AIBuilder';

describe('AI Builder UI', () => {
  it('renders an obvious empty-state action and the no-deploy boundary', () => {
    const html = renderToStaticMarkup(<AIBuilder />);
    expect(html).toContain('Собрать план приложения');
    expect(html).toContain('не подключает GitHub');
    expect(html).toContain('Какую проблему решаем');
  });

  it('renders user content as escaped text in desktop and mobile previews', () => {
    const project = createBuilderProject({
      name: 'Safe <script> preview',
      audience: 'Владельцы небольших продуктов',
      problem: 'Пользователь должен увидеть безопасный preview без выполнения вставленного HTML-кода.',
      primaryAction: 'Проверить результат',
      template: 'landing',
      requirements: [],
    }, new Date('2026-08-05T10:00:00Z'), 'safe-preview');

    const desktop = renderToStaticMarkup(<BuilderPreview project={project} viewport="desktop" />);
    const mobile = renderToStaticMarkup(<BuilderPreview project={project} viewport="mobile" />);
    expect(desktop).toContain('Safe &lt;script&gt; preview');
    expect(desktop).not.toContain('<script>');
    expect(mobile).toContain('max-w-[390px]');
    expect(mobile).toContain('Проверить результат');
  });
});
