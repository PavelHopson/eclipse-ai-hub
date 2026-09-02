import React from 'react';
import { Eye, EyeOff, Maximize2, Minimize2, ShieldCheck } from 'lucide-react';

export type AltronValkyrieState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
export type AltronValkyrieMode = 'panel' | 'presence';

const STATE_COPY: Record<AltronValkyrieState, { label: string; description: string }> = {
  idle: { label: 'Готова к диалогу', description: 'Ожидает следующую команду.' },
  listening: { label: 'Слушает', description: 'Микрофон включён по вашей команде.' },
  thinking: { label: 'Анализирует', description: 'Модель готовит ответ.' },
  speaking: { label: 'Отвечает', description: 'Ответ поступает в чат.' },
  error: { label: 'Нужна проверка', description: 'Провайдер вернул ошибку.' },
};

interface AltronValkyrieProps {
  state: AltronValkyrieState;
  provider: string;
  model: string;
  visible: boolean;
  mode: AltronValkyrieMode;
  onToggle: () => void;
  onModeToggle: () => void;
}

export const AltronValkyrie: React.FC<AltronValkyrieProps> = ({
  state,
  provider,
  model,
  visible,
  mode,
  onToggle,
  onModeToggle,
}) => {
  const copy = STATE_COPY[state];

  if (!visible) {
    return (
      <aside className="altron-persona-rail altron-persona-rail--collapsed" aria-label="Визуальный профиль Альтрона">
        <button
          type="button"
          className="altron-persona-restore"
          onClick={onToggle}
          aria-expanded="false"
          aria-label="Показать визуальный профиль Альтрона"
        >
          <img src="/personas/altron-valkyrie.webp" alt="" width="42" height="42" decoding="async" />
          <Eye size={16} aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="altron-persona-rail"
      aria-label="Визуальный компаньон Альтрон Валькирия"
      data-mode={mode}
      data-state={state}
    >
      <img
        className="altron-persona-backdrop"
        src="/personas/altron-valkyrie.webp"
        alt=""
        aria-hidden="true"
        width="768"
        height="768"
        decoding="async"
      />

      <div className="altron-persona-head">
        <div>
          <span>Альтрон</span>
          <strong>Валькирия</strong>
        </div>
        <div className="altron-persona-actions">
          <button
            type="button"
            className="altron-persona-toggle"
            onClick={onModeToggle}
            aria-pressed={mode === 'presence'}
            aria-label={mode === 'presence' ? 'Свернуть визуальный образ' : 'Развернуть визуальный образ'}
            title={mode === 'presence' ? 'Свернуть образ' : 'Развернуть образ'}
          >
            {mode === 'presence'
              ? <Minimize2 size={17} aria-hidden="true" />
              : <Maximize2 size={17} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="altron-persona-toggle"
            onClick={onToggle}
            aria-expanded="true"
            aria-label="Скрыть визуальный профиль"
            title="Скрыть визуальный профиль"
          >
            <EyeOff size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="altron-persona-stage" data-state={state}>
        <div className="altron-persona-portrait">
          <img
            src="/personas/altron-valkyrie.webp"
            alt="Оригинальный синтетический образ Альтрон Валькирия"
            width="768"
            height="768"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      <div className="altron-persona-intro">
        <strong>Я рядом.</strong>
        <p>Пишите в чат. Образ покажет, когда система слушает, думает или отвечает.</p>
      </div>

      <div className="altron-persona-status" role="status" aria-live="polite" aria-atomic="true">
        <span className="altron-persona-status__signal" data-state={state} aria-hidden="true" />
        <div>
          <strong>{copy.label}</strong>
          <span>{copy.description}</span>
        </div>
      </div>

      <dl className="altron-persona-runtime">
        <div>
          <dt>Провайдер</dt>
          <dd>{provider}</dd>
        </div>
        <div>
          <dt>Модель</dt>
          <dd title={model}>{model}</dd>
        </div>
      </dl>

      <p className="altron-persona-boundary">
        <ShieldCheck size={15} aria-hidden="true" />
        Визуальный слой не получает доступ к микрофону, файлам и инструментам.
      </p>
    </aside>
  );
};
