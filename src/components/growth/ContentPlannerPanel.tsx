import { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  CONTENT_PLANNER_STORAGE_KEY,
  createContentPlannerItem,
  MAX_CONTENT_PLANNER_ITEMS,
  parseContentPlanner,
  serializeContentPlanner,
  updateContentPlannerStatus,
  type ContentPlannerDraft,
  type ContentPlannerItem,
  type PlannerChannel,
  type PlannerEffort,
  type PlannerFormat,
} from '../../services/contentPlannerService';

function dateFromToday(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const EMPTY_DRAFT: ContentPlannerDraft = {
  owner: 'Павел / Eclipse Forge',
  product: 'Eclipse Forge',
  audience: 'Разработчики и владельцы AI-продуктов',
  workingTitle: '',
  goal: '',
  channel: 'telegram',
  format: 'post',
  effort: 'S',
  sourceUrl: '',
  cta: '',
  reviewOn: dateFromToday(1),
  note: '',
};

const CHANNEL_LABEL: Record<PlannerChannel, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  blog: 'Блог / SEO',
};
const FORMAT_LABEL: Record<PlannerFormat, string> = {
  post: 'Пост',
  carousel: 'Карусель',
  'short-video': 'Короткое видео',
  'long-video': 'Длинное видео',
  article: 'Статья',
  'release-note': 'Release note',
};

function loadInitialItems(): ContentPlannerItem[] {
  try {
    return parseContentPlanner(window.localStorage.getItem(CONTENT_PLANNER_STORAGE_KEY));
  } catch {
    return [];
  }
}

function sortItems(items: ContentPlannerItem[]): ContentPlannerItem[] {
  return [...items].sort((a, b) => a.reviewOn.localeCompare(b.reviewOn) || b.updatedAt.localeCompare(a.updatedAt));
}

export function ContentPlannerPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(loadInitialItems);
  const [draft, setDraft] = useState<ContentPlannerDraft>(EMPTY_DRAFT);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const patchDraft = <K extends keyof ContentPlannerDraft>(key: K, value: ContentPlannerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setStatus('');
  };

  const persist = (next: ContentPlannerItem[]) => {
    const sorted = sortItems(next);
    window.localStorage.setItem(CONTENT_PLANNER_STORAGE_KEY, serializeContentPlanner(sorted));
    setItems(sorted);
  };

  const save = () => {
    try {
      if (items.length >= MAX_CONTENT_PLANNER_ITEMS) {
        throw new Error('Локальный лимит — 30 задач. Удалите завершённую или устаревшую задачу.');
      }
      const item = createContentPlannerItem(draft);
      const duplicate = items.some((candidate) => candidate.sourceUrl === item.sourceUrl
        && candidate.workingTitle.toLocaleLowerCase('ru') === item.workingTitle.toLocaleLowerCase('ru')
        && candidate.channel === item.channel && candidate.format === item.format
        && candidate.reviewOn === item.reviewOn);
      if (duplicate) throw new Error('Такая задача с тем же evidence, форматом и датой review уже есть.');
      persist([...items, item]);
      setDraft((current) => ({
        ...EMPTY_DRAFT,
        owner: current.owner,
        product: current.product,
        audience: current.audience,
        channel: current.channel,
        format: current.format,
        effort: current.effort,
        reviewOn: dateFromToday(1),
      }));
      setError('');
      setStatus('Задача сохранена как черновик. Ничего не опубликовано и не запланировано во внешнем сервисе.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить задачу локально.');
      setStatus('');
    }
  };

  const changeStatus = (item: ContentPlannerItem) => {
    try {
      const nextStatus = item.status === 'draft' ? 'ready-for-review' : 'draft';
      const updated = updateContentPlannerStatus(item, nextStatus);
      persist(items.map((candidate) => candidate.id === item.id ? updated : candidate));
      setError('');
      setStatus(nextStatus === 'ready-for-review'
        ? 'Задача отмечена готовой к ручному review. Это не approval и не публикация.'
        : 'Задача возвращена в черновик.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось изменить статус задачи.');
      setStatus('');
    }
  };

  const remove = (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setStatus('Нажмите ещё раз, чтобы удалить задачу только из этого браузера.');
      return;
    }
    try {
      persist(items.filter((item) => item.id !== id));
      setPendingDeleteId(null);
      setError('');
      setStatus('Задача удалена из локального Planner.');
    } catch {
      setError('Не удалось обновить локальное хранилище.');
      setStatus('');
    }
  };

  return (
    <section className="hub-card overflow-hidden" aria-labelledby="content-planner-title">
      <button type="button" className="flex w-full items-start justify-between gap-4 p-5 text-left sm:items-center sm:p-6" aria-expanded={open} aria-controls="content-planner-content" onClick={() => setOpen((value) => !value)}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hub-accent/25 bg-hub-accent/5 text-hub-accent"><CalendarDays size={18} /></span>
          <span className="min-w-0"><span id="content-planner-title" className="block font-semibold text-white">Планировщик контента</span><span className="mt-1 block text-xs leading-5 text-gray-500">Соберите редакторскую задачу с evidence, KPI и review — без автопубликации.</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full border border-hub-border px-2.5 py-1 text-xs text-gray-400 sm:inline-flex">{items.length} / {MAX_CONTENT_PLANNER_ITEMS}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
      </button>

      {open && (
        <div id="content-planner-content" className="border-t border-hub-border p-5 sm:p-6">
          <div className="mb-5 flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Planner хранится только в этом браузере. Он не подключает аккаунты, не ставит внешние публикации в очередь и не выполняет CTA.</span></div>

          <form onSubmit={(event) => { event.preventDefault(); save(); }}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-gray-300">Owner<input className="hub-input mt-2" value={draft.owner} maxLength={120} onChange={(event) => patchDraft('owner', event.target.value)} /></label>
              <label className="text-sm text-gray-300">Продукт<input className="hub-input mt-2" value={draft.product} maxLength={120} onChange={(event) => patchDraft('product', event.target.value)} placeholder="Например: Eclipse Library" /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Аудитория<input className="hub-input mt-2" value={draft.audience} maxLength={240} onChange={(event) => patchDraft('audience', event.target.value)} /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Рабочий заголовок<input className="hub-input mt-2" value={draft.workingTitle} maxLength={180} onChange={(event) => patchDraft('workingTitle', event.target.value)} placeholder="Одна понятная мысль материала" /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Цель и KPI<input className="hub-input mt-2" value={draft.goal} maxLength={300} onChange={(event) => patchDraft('goal', event.target.value)} placeholder="Например: 10 переходов в кейс за 72 часа" /></label>
              <label className="text-sm text-gray-300">Канал<select className="hub-input mt-2" value={draft.channel} onChange={(event) => patchDraft('channel', event.target.value as PlannerChannel)}><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="youtube">YouTube</option><option value="blog">Блог / SEO</option></select></label>
              <label className="text-sm text-gray-300">Формат<select className="hub-input mt-2" value={draft.format} onChange={(event) => patchDraft('format', event.target.value as PlannerFormat)}><option value="post">Пост</option><option value="carousel">Карусель</option><option value="short-video">Короткое видео</option><option value="long-video">Длинное видео</option><option value="article">Статья</option><option value="release-note">Release note</option></select></label>
              <label className="text-sm text-gray-300">Effort<select className="hub-input mt-2" value={draft.effort} onChange={(event) => patchDraft('effort', event.target.value as PlannerEffort)}><option value="S">S · до 2 часов</option><option value="M">M · до 1 дня</option><option value="L">L · больше дня</option></select></label>
              <label className="text-sm text-gray-300">Следующий review<input className="hub-input mt-2" type="date" min={dateFromToday(0)} max={dateFromToday(365)} value={draft.reviewOn} onChange={(event) => patchDraft('reviewOn', event.target.value)} /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">HTTPS evidence<input className="hub-input mt-2 font-mono text-xs" type="url" value={draft.sourceUrl} maxLength={1_000} onChange={(event) => patchDraft('sourceUrl', event.target.value)} placeholder="https://.../release-or-case" /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Один CTA<input className="hub-input mt-2" value={draft.cta} maxLength={240} onChange={(event) => patchDraft('cta', event.target.value)} placeholder="Что человек должен сделать после материала?" /></label>
            </div>
            <label className="mt-4 block text-sm text-gray-300">Что проверить на review<textarea className="hub-input mt-2 min-h-20 resize-y" value={draft.note} maxLength={600} onChange={(event) => patchDraft('note', event.target.value)} placeholder="Claims, лицензия, screenshots, ограничения и mobile preview" /></label>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            {status && <p aria-live="polite" className="mt-3 text-sm text-emerald-300">{status}</p>}
            <button type="submit" disabled={items.length >= MAX_CONTENT_PLANNER_ITEMS} className="hub-btn mt-4 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} />Добавить задачу</button>
          </form>

          <div className="mt-6 border-t border-hub-border pt-5">
            <div><h3 className="text-sm font-semibold text-white">Редакторская очередь</h3><p className="mt-1 text-xs text-gray-500">Готово к review — это просьба проверить, а не разрешение публиковать.</p></div>
            {items.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-hub-border p-5 text-center text-sm text-gray-500">Добавьте первую задачу: один материал, одно evidence, один CTA и дата следующего решения.</div>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {items.map((item) => {
                  const overdue = item.reviewOn < dateFromToday(0);
                  return (
                    <article key={item.id} className="rounded-xl border border-hub-border bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.16em] text-hub-accent">{item.product}</div><h4 className="mt-1 font-medium text-white">{item.workingTitle}</h4><p className="mt-1 text-xs text-gray-500">{CHANNEL_LABEL[item.channel]} · {FORMAT_LABEL[item.format]} · effort {item.effort}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${item.status === 'ready-for-review' ? 'border-emerald-400/30 text-emerald-300' : 'border-hub-border text-gray-400'}`}>{item.status === 'ready-for-review' ? 'Готово к review' : 'Черновик'}</span></div>
                      <dl className="mt-4 space-y-2 text-xs leading-5"><div><dt className="font-medium text-gray-300">Аудитория</dt><dd className="text-gray-500">{item.audience}</dd></div><div><dt className="font-medium text-gray-300">Цель</dt><dd className="text-gray-400">{item.goal}</dd></div><div><dt className="font-medium text-gray-300">CTA</dt><dd className="text-gray-400">{item.cta}</dd></div><div><dt className="font-medium text-gray-300">Review</dt><dd className={overdue ? 'text-amber-300' : 'text-gray-400'}>{item.reviewOn}{overdue ? ' · просрочено' : ''} · {item.owner}</dd></div><div><dt className="font-medium text-gray-300">Проверить</dt><dd className="text-gray-500">{item.note}</dd></div></dl>
                      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="hub-btn inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => changeStatus(item)}>{item.status === 'draft' ? <Send size={13} /> : <Undo2 size={13} />}{item.status === 'draft' ? 'Передать на review' : 'Вернуть в черновик'}</button><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs">Evidence <ExternalLink size={13} /></a><button type="button" className={`hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs ${pendingDeleteId === item.id ? '!border-red-400/40 !text-red-300' : ''}`} onClick={() => remove(item.id)}><Trash2 size={14} />{pendingDeleteId === item.id ? 'Подтвердить' : 'Удалить'}</button></div>
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
