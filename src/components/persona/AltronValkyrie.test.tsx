import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AltronValkyrie } from './AltronValkyrie';

describe('AltronValkyrie', () => {
  it('renders a bounded visual profile without microphone or tool controls', () => {
    const html = renderToStaticMarkup(
      <AltronValkyrie
        state="thinking"
        provider="ollama"
        model="qwen"
        visible
        mode="presence"
        onToggle={() => undefined}
        onModeToggle={() => undefined}
      />,
    );

    expect(html).toContain('Валькирия');
    expect(html).toContain('Я рядом.');
    expect(html).toContain('Анализирует');
    expect(html).toContain('Визуальный слой не получает доступ к микрофону, файлам и инструментам');
    expect(html).toContain('altron-valkyrie.webp');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('getUserMedia');
  });

  it('exposes a listening state without requesting microphone access', () => {
    const html = renderToStaticMarkup(
      <AltronValkyrie
        state="listening"
        provider="local"
        model="voice-gateway"
        visible
        mode="panel"
        onToggle={() => undefined}
        onModeToggle={() => undefined}
      />,
    );

    expect(html).toContain('Слушает');
    expect(html).toContain('Микрофон включён по вашей команде.');
    expect(html).not.toContain('getUserMedia');
  });

  it('keeps a keyboard-accessible restore action when the portrait is hidden', () => {
    const html = renderToStaticMarkup(
      <AltronValkyrie
        state="idle"
        provider="ollama"
        model="qwen"
        visible={false}
        mode="panel"
        onToggle={() => undefined}
        onModeToggle={() => undefined}
      />,
    );

    expect(html).toContain('Показать визуальный профиль Альтрона');
    expect(html).toContain('aria-expanded="false"');
  });
});
