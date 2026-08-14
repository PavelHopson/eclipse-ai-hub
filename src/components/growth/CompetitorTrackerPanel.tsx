import { useState } from 'react';
import { ArrowRight, ChevronDown, ExternalLink, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import {
  COMPETITOR_TRACKER_STORAGE_KEY,
  createCompetitorObservation,
  MAX_COMPETITOR_OBSERVATIONS,
  parseCompetitorObservations,
  serializeCompetitorObservations,
  type CompetitorChannel,
  type CompetitorFormat,
  type CompetitorObservation,
  type CompetitorObservationDraft,
} from '../../services/competitorTrackerService';

interface CompetitorTrackerPanelProps {
  onUse: (entry: CompetitorObservation) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_DRAFT: CompetitorObservationDraft = {
  owner: '',
  sourceUrl: '',
  observedAt: today(),
  channel: 'instagram',
  format: 'short-video',
  hookPattern: '',
  publicSignal: '',
  eclipseUse: '',
  note: '',
};

const CHANNEL_LABEL: Record<CompetitorChannel, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  blog: 'Блог / сайт',
};
const FORMAT_LABEL: Record<CompetitorFormat, string> = {
  post: 'Пост',
  carousel: 'Карусель',
  'short-video': 'Короткое видео',
  'long-video': 'Длинное видео',
  landing: 'Лендинг',
};

function loadInitialEntries(): CompetitorObservation[] {
  try {
    return parseCompetitorObservations(window.localStorage.getItem(COMPETITOR_TRACKER_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function CompetitorTrackerPanel({ onUse }: CompetitorTrackerPanelProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(loadInitialEntries);
  const [draft, setDraft] = useState<CompetitorObservationDraft>(EMPTY_DRAFT);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const patchDraft = <K extends keyof CompetitorObservationDraft>(key: K, value: CompetitorObservationDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setStatus('');
  };

  const persist = (next: CompetitorObservation[]) => {
    window.localStorage.setItem(COMPETITOR_TRACKER_STORAGE_KEY, serializeCompetitorObservations(next));
    setEntries(next);
  };

  const save = () => {
    try {
      if (entries.length >= MAX_COMPETITOR_OBSERVATIONS) {
        throw new Error('Локальный лимит — 30 наблюдений. Удалите устаревший reference.');
      }
      const entry = createCompetitorObservation(draft);
      if (entries.some((item) => item.sourceUrl === entry.sourceUrl)) {
        throw new Error('Эта публичная ссылка уже сохранена. Дополните существующее наблюдение вне каталога.');
      }
      persist([entry, ...entries].sort((a, b) => b.observedAt.localeCompare(a.observedAt)));
      setDraft((current) => ({ ...EMPTY_DRAFT, observedAt: today(), channel: current.channel, format: current.format }));
      setError('');
      setStatus('Наблюдение сохранено локально как reference, а не как доказанный результат.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить наблюдение локально.');
      setStatus('');
    }
  };

  const useInBrief = (entry: CompetitorObservation) => {
    onUse(entry);
    setError('');
    setStatus('Паттерн перенесён в brief с source и запретом на копирование. Проверьте форму ниже.');
  };

  const remove = (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setStatus('Нажмите ещё раз, чтобы удалить наблюдение только из этого браузера.');
      return;
    }
    try {
      persist(entries.filter((entry) => entry.id !== id));
      setPendingDeleteId(null);
      setError('');
      setStatus('Наблюдение удалено из локального журнала.');
    } catch {
      setError('Не удалось обновить локальное хранилище.');
      setStatus('');
    }
  };

  return (
    <section className="hub-card overflow-hidden" aria-labelledby="competitor-tracker-title">
      <button type="button" className="flex w-full items-start justify-between gap-4 p-5 text-left sm:items-center sm:p-6" aria-expanded={open} aria-controls="competitor-tracker-content" onClick={() => setOpen((value) => !value)}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hub-accent/25 bg-hub-accent/5 text-hub-accent"><Search size={18} /></span>
          <span className="min-w-0"><span id="competitor-tracker-title" className="block font-semibold text-white">Публичные референсы</span><span className="mt-1 block text-xs leading-5 text-gray-500">Фиксируйте видимый паттерн и превращайте его в собственный проверяемый кейс Eclipse.</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full border border-hub-border px-2.5 py-1 text-xs text-gray-400 sm:inline-flex">{entries.length} / {MAX_COMPETITOR_OBSERVATIONS}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
      </button>

      {open && (
        <div id="competitor-tracker-content" className="border-t border-hub-border p-5 sm:p-6">
          <div className="mb-5 flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Только публичная HTTPS-ссылка и ручное наблюдение. Экран не парсит сайты, не использует cookies, login, OAuth и не копирует чужой материал.</span></div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-gray-300 sm:col-span-2">Автор или проект<input className="hub-input mt-2" value={draft.owner} maxLength={120} onChange={(event) => patchDraft('owner', event.target.value)} placeholder="Кто опубликовал материал?" /></label>
            <label className="text-sm text-gray-300">Канал<select className="hub-input mt-2" value={draft.channel} onChange={(event) => patchDraft('channel', event.target.value as CompetitorChannel)}><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="telegram">Telegram</option><option value="linkedin">LinkedIn</option><option value="blog">Блог / сайт</option></select></label>
            <label className="text-sm text-gray-300">Формат<select className="hub-input mt-2" value={draft.format} onChange={(event) => patchDraft('format', event.target.value as CompetitorFormat)}><option value="short-video">Короткое видео</option><option value="post">Пост</option><option value="carousel">Карусель</option><option value="long-video">Длинное видео</option><option value="landing">Лендинг</option></select></label>
            <label className="text-sm text-gray-300">Дата наблюдения<input className="hub-input mt-2" type="date" max={today()} value={draft.observedAt} onChange={(event) => patchDraft('observedAt', event.target.value)} /></label>
            <label className="text-sm text-gray-300 sm:col-span-2 lg:col-span-3">Публичная ссылка<input className="hub-input mt-2 font-mono text-xs" type="url" value={draft.sourceUrl} maxLength={1_000} onChange={(event) => patchDraft('sourceUrl', event.target.value)} placeholder="https://..." /></label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm text-gray-300">Как устроен hook<textarea className="hub-input mt-2 min-h-24 resize-y" value={draft.hookPattern} maxLength={220} onChange={(event) => patchDraft('hookPattern', event.target.value)} placeholder="Опишите структуру своими словами, не копируя текст" /></label>
            <label className="text-sm text-gray-300">Что видно публично<textarea className="hub-input mt-2 min-h-24 resize-y" value={draft.publicSignal} maxLength={360} onChange={(event) => patchDraft('publicSignal', event.target.value)} placeholder="Например: видны просмотры и комментарии; конверсии неизвестны" /></label>
            <label className="text-sm text-gray-300">Как проверить в Eclipse<textarea className="hub-input mt-2 min-h-24 resize-y" value={draft.eclipseUse} maxLength={500} onChange={(event) => patchDraft('eclipseUse', event.target.value)} placeholder="Проект, сценарий и измеримый результат собственного теста" /></label>
            <label className="text-sm text-gray-300">Что нельзя переносить<textarea className="hub-input mt-2 min-h-24 resize-y" value={draft.note} maxLength={500} onChange={(event) => patchDraft('note', event.target.value)} placeholder="Текст, визуал, claims, неизвестные права или ограничения" /></label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {status && <p aria-live="polite" className="mt-3 text-sm text-emerald-300">{status}</p>}
          <button type="button" className="hub-btn mt-4 inline-flex w-full items-center justify-center gap-2 sm:w-auto" onClick={save}><Plus size={16} />Сохранить наблюдение</button>

          <div className="mt-6 border-t border-hub-border pt-5">
            <h3 className="text-sm font-semibold text-white">Журнал наблюдений</h3>
            <p className="mt-1 text-xs text-gray-500">Reference помогает сформулировать гипотезу, но не подтверждает будущий результат.</p>
            {entries.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-hub-border p-5 text-center text-sm text-gray-500">Добавьте первый публичный пример. Достаточно ссылки, видимого сигнала и своей гипотезы для Eclipse.</div>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {entries.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-hub-border bg-black/10 p-4">
                    <div className="flex items-start justify-between gap-3"><div><h4 className="font-medium text-white">{entry.owner}</h4><p className="mt-1 text-xs text-gray-500">{CHANNEL_LABEL[entry.channel]} · {FORMAT_LABEL[entry.format]} · {entry.observedAt}</p></div><span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[10px] text-amber-200">reference-only</span></div>
                    <dl className="mt-4 space-y-3 text-xs leading-5"><div><dt className="font-medium text-gray-300">Паттерн</dt><dd className="text-gray-400">{entry.hookPattern}</dd></div><div><dt className="font-medium text-gray-300">Видимый сигнал</dt><dd className="text-gray-400">{entry.publicSignal}</dd></div><div><dt className="font-medium text-gray-300">Гипотеза для Eclipse</dt><dd className="text-gray-400">{entry.eclipseUse}</dd></div><div><dt className="font-medium text-gray-300">Ограничение</dt><dd className="text-gray-500">{entry.note}</dd></div></dl>
                    <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="hub-btn inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => useInBrief(entry)}>В brief <ArrowRight size={13} /></button><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs">Источник <ExternalLink size={13} /></a><button type="button" className={`hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs ${pendingDeleteId === entry.id ? '!border-red-400/40 !text-red-300' : ''}`} onClick={() => remove(entry.id)}><Trash2 size={14} />{pendingDeleteId === entry.id ? 'Подтвердить' : 'Удалить'}</button></div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
