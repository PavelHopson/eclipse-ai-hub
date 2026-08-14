import { useState } from 'react';
import { BarChart3, ChevronDown, ExternalLink, Plus, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import {
  CHANNEL_ANALYTICS_STORAGE_KEY,
  createChannelSnapshot,
  findComparableSnapshot,
  getChannelRates,
  MAX_CHANNEL_SNAPSHOTS,
  parseChannelSnapshots,
  serializeChannelSnapshots,
  type ChannelSnapshot,
  type ChannelSnapshotDraft,
  type GrowthChannel,
} from '../../services/channelAnalyticsService';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_DRAFT: ChannelSnapshotDraft = {
  product: 'Eclipse Forge',
  channel: 'telegram',
  windowDays: 30,
  periodEnd: today(),
  publishedCount: 1,
  impressions: 0,
  medianImpressions: 0,
  saves: 0,
  clicks: 0,
  productVisits: 0,
  qualifiedLeads: 0,
  sourceUrl: '',
  note: '',
};

const CHANNEL_LABEL: Record<GrowthChannel, string> = {
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  blog: 'Блог / SEO',
};
const INTEGER_FORMAT = new Intl.NumberFormat('ru-RU');
const PERCENT_FORMAT = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 });

function loadInitialSnapshots(): ChannelSnapshot[] {
  try {
    return parseChannelSnapshots(window.localStorage.getItem(CHANNEL_ANALYTICS_STORAGE_KEY));
  } catch {
    return [];
  }
}

function impressionDelta(current: ChannelSnapshot, previous: ChannelSnapshot | null): string {
  if (!previous || previous.impressions === 0) return 'Первый baseline';
  const delta = (current.impressions - previous.impressions) / previous.impressions;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${PERCENT_FORMAT.format(delta)} к ${previous.periodEnd}`;
}

function ctrDelta(current: ChannelSnapshot, previous: ChannelSnapshot | null): string {
  if (!previous) return 'Нет сравнимого периода';
  const delta = (getChannelRates(current).clickThroughRate - getChannelRates(previous).clickThroughRate) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} п.п.`;
}

export function ChannelAnalyticsPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(loadInitialSnapshots);
  const [draft, setDraft] = useState<ChannelSnapshotDraft>(EMPTY_DRAFT);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const patchDraft = <K extends keyof ChannelSnapshotDraft>(key: K, value: ChannelSnapshotDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setStatus('');
  };

  const persist = (next: ChannelSnapshot[]) => {
    const serialized = serializeChannelSnapshots(next);
    window.localStorage.setItem(CHANNEL_ANALYTICS_STORAGE_KEY, serialized);
    setEntries(next);
  };

  const save = () => {
    try {
      if (entries.length >= MAX_CHANNEL_SNAPSHOTS) throw new Error('Локальный лимит — 24 периода. Удалите устаревший snapshot.');
      const entry = createChannelSnapshot(draft);
      const duplicate = entries.some((item) => item.product.toLocaleLowerCase('ru') === entry.product.toLocaleLowerCase('ru')
        && item.channel === entry.channel && item.windowDays === entry.windowDays && item.periodEnd === entry.periodEnd);
      if (duplicate) throw new Error('Для этого продукта, канала, окна и даты snapshot уже сохранён.');
      persist([entry, ...entries].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)));
      setDraft((current) => ({
        ...EMPTY_DRAFT,
        product: current.product,
        channel: current.channel,
        windowDays: current.windowDays,
        periodEnd: today(),
      }));
      setError('');
      setStatus('Период сохранён локально. Сравнение доступно только с сопоставимым baseline.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить аналитику локально.');
      setStatus('');
    }
  };

  const remove = (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setStatus('Нажмите ещё раз, чтобы удалить snapshot.');
      return;
    }
    try {
      persist(entries.filter((entry) => entry.id !== id));
      setPendingDeleteId(null);
      setError('');
      setStatus('Snapshot удалён из этого браузера.');
    } catch {
      setError('Не удалось обновить локальное хранилище.');
    }
  };

  const numberField = (label: string, key: keyof Pick<ChannelSnapshotDraft, 'publishedCount' | 'impressions' | 'medianImpressions' | 'saves' | 'clicks' | 'productVisits' | 'qualifiedLeads'>, min = 0) => (
    <label className="text-xs text-gray-400">{label}<input className="hub-input mt-2" type="number" inputMode="numeric" min={min} max={1_000_000_000} step="1" value={draft[key]} onChange={(event) => patchDraft(key, Number(event.target.value))} /></label>
  );

  return (
    <section className="hub-card overflow-hidden" aria-labelledby="channel-analytics-title">
      <button type="button" className="flex w-full items-start justify-between gap-4 p-5 text-left sm:items-center sm:p-6" aria-expanded={open} aria-controls="channel-analytics-content" onClick={() => setOpen((value) => !value)}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hub-accent/25 bg-hub-accent/5 text-hub-accent"><BarChart3 size={18} /></span>
          <span className="min-w-0"><span id="channel-analytics-title" className="block font-semibold text-white">Аналитика каналов</span><span className="mt-1 block text-xs leading-5 text-gray-500">Сравнивайте агрегированные результаты одного продукта и канала за 7, 30 или 90 дней.</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full border border-hub-border px-2.5 py-1 text-xs text-gray-400 sm:inline-flex">{entries.length} / {MAX_CHANNEL_SNAPSHOTS}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
      </button>

      {open && (
        <div id="channel-analytics-content" className="border-t border-hub-border p-5 sm:p-6">
          <div className="mb-5 flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Только агрегаты: без OAuth, cookies, имён пользователей и автоматического fetch. Evidence открывается лишь по вашему клику.</span></div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-gray-300 sm:col-span-2">Продукт<input className="hub-input mt-2" value={draft.product} maxLength={100} onChange={(event) => patchDraft('product', event.target.value)} placeholder="Например: Eclipse Library" /></label>
            <label className="text-sm text-gray-300">Канал<select className="hub-input mt-2" value={draft.channel} onChange={(event) => patchDraft('channel', event.target.value as GrowthChannel)}><option value="telegram">Telegram</option><option value="linkedin">LinkedIn</option><option value="blog">Блог / SEO</option></select></label>
            <label className="text-sm text-gray-300">Окно<select className="hub-input mt-2" value={draft.windowDays} onChange={(event) => patchDraft('windowDays', Number(event.target.value) as 7 | 30 | 90)}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></label>
            <label className="text-sm text-gray-300">Конец периода<input className="hub-input mt-2" type="date" max={today()} value={draft.periodEnd} onChange={(event) => patchDraft('periodEnd', event.target.value)} /></label>
            <label className="text-sm text-gray-300 sm:col-span-2 lg:col-span-3">Evidence-ссылка<input className="hub-input mt-2 font-mono text-xs" type="url" value={draft.sourceUrl} maxLength={1_000} onChange={(event) => patchDraft('sourceUrl', event.target.value)} placeholder="https://.../aggregate-report" /></label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {numberField('Публикации', 'publishedCount', 1)}
            {numberField('Показы', 'impressions', 1)}
            {numberField('Медиана', 'medianImpressions')}
            {numberField('Сохранения', 'saves')}
            {numberField('Клики', 'clicks')}
            {numberField('В продукт', 'productVisits')}
            {numberField('Целевые', 'qualifiedLeads')}
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-500">Воронка проверяется автоматически: показы ≥ клики ≥ переходы в продукт ≥ целевые обращения.</p>
          <label className="mt-4 block text-sm text-gray-300">Что изменилось и откуда взяты цифры<textarea className="hub-input mt-2 min-h-20 resize-y" value={draft.note} maxLength={500} onChange={(event) => patchDraft('note', event.target.value)} placeholder="Метод подсчёта, ограничения и важный контекст периода" /></label>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {status && <p aria-live="polite" className="mt-3 text-sm text-emerald-300">{status}</p>}
          <button type="button" className="hub-btn mt-4 inline-flex items-center gap-2" onClick={save}><Plus size={16} />Сохранить период</button>

          <div className="mt-6 border-t border-hub-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-sm font-semibold text-white">История результатов</h3><p className="mt-1 text-xs text-gray-500">Мы не объединяем разные каналы, продукты или окна в одну динамику.</p></div></div>
            {entries.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-hub-border p-5 text-center text-sm text-gray-500">Сохраните первый проверенный период — он станет baseline для следующего сравнения.</div>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {entries.map((entry) => {
                  const rates = getChannelRates(entry);
                  const previous = findComparableSnapshot(entry, entries);
                  return (
                    <article key={entry.id} className="rounded-xl border border-hub-border bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3"><div><h4 className="font-medium text-white">{entry.product}</h4><p className="mt-1 text-xs text-gray-500">{CHANNEL_LABEL[entry.channel]} · {entry.windowDays} дней · до {entry.periodEnd}</p></div><span className="rounded-full border border-hub-border px-2 py-1 text-[10px] text-gray-400">{entry.publishedCount} публ.</span></div>
                      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div className="rounded-lg bg-white/[0.025] p-3"><dt className="text-[10px] uppercase tracking-wider text-gray-500">Показы</dt><dd className="mt-1 text-sm font-semibold text-white">{INTEGER_FORMAT.format(entry.impressions)}</dd><dd className="mt-1 text-[10px] text-gray-500">{impressionDelta(entry, previous)}</dd></div>
                        <div className="rounded-lg bg-white/[0.025] p-3"><dt className="text-[10px] uppercase tracking-wider text-gray-500">Медиана</dt><dd className="mt-1 text-sm font-semibold text-white">{INTEGER_FORMAT.format(entry.medianImpressions)}</dd><dd className="mt-1 text-[10px] text-gray-500">на публикацию</dd></div>
                        <div className="rounded-lg bg-white/[0.025] p-3"><dt className="text-[10px] uppercase tracking-wider text-gray-500">Сохранения</dt><dd className="mt-1 text-sm font-semibold text-white">{INTEGER_FORMAT.format(entry.saves)}</dd><dd className="mt-1 text-[10px] text-gray-500">{PERCENT_FORMAT.format(rates.saveRate)} от показов</dd></div>
                        <div className="rounded-lg bg-white/[0.025] p-3"><dt className="text-[10px] uppercase tracking-wider text-gray-500">CTR</dt><dd className="mt-1 text-sm font-semibold text-white">{PERCENT_FORMAT.format(rates.clickThroughRate)}</dd><dd className="mt-1 text-[10px] text-gray-500">{ctrDelta(entry, previous)}</dd></div>
                        <div className="rounded-lg bg-white/[0.025] p-3"><dt className="text-[10px] uppercase tracking-wider text-gray-500">Целевые</dt><dd className="mt-1 text-sm font-semibold text-white">{INTEGER_FORMAT.format(entry.qualifiedLeads)}</dd><dd className="mt-1 text-[10px] text-gray-500">{PERCENT_FORMAT.format(rates.leadRate)} от визитов</dd></div>
                      </dl>
                      <p className="mt-3 text-xs leading-5 text-gray-400">{entry.note}</p>
                      <div className="mt-4 flex flex-wrap gap-2"><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs">Evidence <ExternalLink size={13} /></a><button type="button" className={`hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs ${pendingDeleteId === entry.id ? '!border-red-400/40 !text-red-300' : ''}`} onClick={() => remove(entry.id)}><Trash2 size={14} />{pendingDeleteId === entry.id ? 'Подтвердить' : 'Удалить'}</button></div>
                      {!previous && <div className="mt-3 flex items-center gap-2 text-[11px] text-hub-accent"><TrendingUp size={13} />Следующий сопоставимый период покажет динамику.</div>}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
