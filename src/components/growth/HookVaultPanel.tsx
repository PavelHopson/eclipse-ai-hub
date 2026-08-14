import { useState } from 'react';
import { ArrowRight, BookMarked, ChevronDown, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  createHookVaultEntry,
  HOOK_VAULT_STORAGE_KEY,
  MAX_HOOK_VAULT_ENTRIES,
  parseHookVault,
  serializeHookVault,
  type HookRightsStatus,
  type HookVaultDraft,
  type HookVaultEntry,
} from '../../services/hookVaultService';

interface HookVaultPanelProps {
  onUse: (entry: HookVaultEntry) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_DRAFT: HookVaultDraft = {
  pattern: '',
  sourceUrl: '',
  author: '',
  capturedAt: today(),
  rightsStatus: 'unknown',
  note: '',
};

const RIGHTS_LABEL: Record<HookRightsStatus, string> = {
  owned: 'Наш материал',
  'public-reference': 'Публичный reference',
  unknown: 'Права не проверены',
};

function loadInitialEntries(): HookVaultEntry[] {
  try {
    return parseHookVault(window.localStorage.getItem(HOOK_VAULT_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function HookVaultPanel({ onUse }: HookVaultPanelProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(loadInitialEntries);
  const [draft, setDraft] = useState<HookVaultDraft>(EMPTY_DRAFT);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const patchDraft = <K extends keyof HookVaultDraft>(key: K, value: HookVaultDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setStatus('');
  };

  const persist = (next: HookVaultEntry[]) => {
    const serialized = serializeHookVault(next);
    window.localStorage.setItem(HOOK_VAULT_STORAGE_KEY, serialized);
    setEntries(next);
  };

  const save = () => {
    try {
      if (entries.length >= MAX_HOOK_VAULT_ENTRIES) throw new Error('Локальный лимит — 30 записей. Удалите ненужную идею.');
      const entry = createHookVaultEntry(draft);
      const duplicate = entries.some((item) => item.sourceUrl === entry.sourceUrl && item.pattern.toLocaleLowerCase('ru') === entry.pattern.toLocaleLowerCase('ru'));
      if (duplicate) throw new Error('Такая идея из этого источника уже сохранена.');
      persist([entry, ...entries]);
      setDraft((current) => ({ ...EMPTY_DRAFT, capturedAt: today(), rightsStatus: current.rightsStatus }));
      setError('');
      setStatus('Идея сохранена только в этом браузере.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить идею локально.');
      setStatus('');
    }
  };

  const remove = (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setStatus('Нажмите ещё раз, чтобы удалить запись.');
      return;
    }
    try {
      persist(entries.filter((entry) => entry.id !== id));
      setPendingDeleteId(null);
      setError('');
      setStatus('Запись удалена из локального хранилища.');
    } catch {
      setError('Не удалось обновить локальное хранилище.');
    }
  };

  const useEntry = (entry: HookVaultEntry) => {
    onUse(entry);
    setStatus('Идея перенесена в brief. Проверьте формулировки перед запуском Researcher.');
    setError('');
  };

  return (
    <section className="hub-card overflow-hidden" aria-labelledby="hook-vault-title">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-5 text-left sm:items-center sm:p-6"
        aria-expanded={open}
        aria-controls="hook-vault-content"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hub-accent/25 bg-hub-accent/5 text-hub-accent"><BookMarked size={18} /></span>
          <span className="min-w-0"><span id="hook-vault-title" className="block font-semibold text-white">База хуков</span><span className="mt-1 block text-xs leading-5 text-gray-500">Сохраняйте публичные паттерны как идеи — с источником, автором и статусом прав.</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full border border-hub-border px-2.5 py-1 text-xs text-gray-400 sm:inline-flex">{entries.length} / {MAX_HOOK_VAULT_ENTRIES}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
      </button>

      {open && (
        <div id="hook-vault-content" className="border-t border-hub-border p-5 sm:p-6">
          <div className="mb-5 flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Локально и без fetch: AI Hub не открывает ссылку, не копирует исходник и не публикует материал.</span></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm text-gray-300">Паттерн или идея<input className="hub-input mt-2" value={draft.pattern} maxLength={180} onChange={(event) => patchDraft('pattern', event.target.value)} placeholder="Например: проблема → diff → проверяемый результат" /></label>
            <label className="text-sm text-gray-300">Публичный источник<input className="hub-input mt-2 font-mono text-xs" type="url" value={draft.sourceUrl} maxLength={1_000} onChange={(event) => patchDraft('sourceUrl', event.target.value)} placeholder="https://..." /></label>
            <label className="text-sm text-gray-300">Автор или владелец<input className="hub-input mt-2" value={draft.author} maxLength={120} onChange={(event) => patchDraft('author', event.target.value)} placeholder="Название проекта или автора" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-300">Дата<input className="hub-input mt-2" type="date" max={today()} value={draft.capturedAt} onChange={(event) => patchDraft('capturedAt', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Права<select className="hub-input mt-2" value={draft.rightsStatus} onChange={(event) => patchDraft('rightsStatus', event.target.value as HookRightsStatus)}><option value="unknown">Не проверены</option><option value="public-reference">Public reference</option><option value="owned">Наш материал</option></select></label>
            </div>
          </div>
          <label className="mt-4 block text-sm text-gray-300">Почему идея полезна и что нельзя копировать<textarea className="hub-input mt-2 min-h-24 resize-y" value={draft.note} maxLength={600} onChange={(event) => patchDraft('note', event.target.value)} placeholder="Короткая редакторская заметка и ограничения" /></label>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {status && <p aria-live="polite" className="mt-3 text-sm text-emerald-300">{status}</p>}
          <button type="button" className="hub-btn mt-4 inline-flex items-center gap-2" onClick={save}><Plus size={16} />Сохранить идею</button>

          <div className="mt-6 border-t border-hub-border pt-5">
            <h3 className="text-sm font-semibold text-white">Сохранённые идеи</h3>
            {entries.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-hub-border p-5 text-center text-sm text-gray-500">Здесь появятся идеи с доказуемым источником. Начните с одного собственного кейса.</div>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {entries.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-hub-border bg-black/10 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-medium leading-6 text-white">{entry.pattern}</h4><p className="mt-1 truncate text-xs text-gray-500" title={entry.sourceUrl}>{entry.author} · {entry.capturedAt}</p></div><span className="shrink-0 rounded-full border border-hub-border px-2 py-1 text-[10px] text-gray-400">{RIGHTS_LABEL[entry.rightsStatus]}</span></div>
                    <p className="mt-3 text-xs leading-5 text-gray-400">{entry.note}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => useEntry(entry)}>В brief <ArrowRight size={14} /></button>
                      <button type="button" className={`hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs ${pendingDeleteId === entry.id ? '!border-red-400/40 !text-red-300' : ''}`} onClick={() => remove(entry.id)}><Trash2 size={14} />{pendingDeleteId === entry.id ? 'Подтвердить' : 'Удалить'}</button>
                    </div>
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
