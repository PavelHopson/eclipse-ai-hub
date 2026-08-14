import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  ContentPlannerItem,
  PlannerChannel,
  PlannerFormat,
} from '../../services/contentPlannerService';
import { getPlannerCalendarDays } from './contentPlannerView';

const CHANNEL_LABEL: Record<PlannerChannel, string> = {
  telegram: 'Telegram', instagram: 'Instagram', linkedin: 'LinkedIn',
  youtube: 'YouTube', blog: 'Блог / SEO',
};

const FORMAT_LABEL: Record<PlannerFormat, string> = {
  post: 'Пост', carousel: 'Карусель', 'short-video': 'Короткое видео',
  'long-video': 'Длинное видео', article: 'Статья', 'release-note': 'Release note',
};

interface PlannerViewProps {
  items: ContentPlannerItem[];
  today: string;
  pendingDeleteId: string | null;
  onChangeStatus: (item: ContentPlannerItem) => void;
  onRemove: (id: string) => void;
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
    .format(new Date(`${isoDate}T12:00:00.000Z`));
}

function StatusBadge({ item }: { item: ContentPlannerItem }) {
  const ready = item.status === 'ready-for-review';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${ready ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300' : 'border-hub-border bg-white/[0.02] text-gray-400'}`}>{ready ? 'К review' : 'Черновик'}</span>;
}

function PlannerActions({ item, pendingDeleteId, onChangeStatus, onRemove }: Omit<PlannerViewProps, 'items' | 'today'> & { item: ContentPlannerItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="hub-btn inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => onChangeStatus(item)}>
        {item.status === 'draft' ? <Send size={13} /> : <Undo2 size={13} />}
        {item.status === 'draft' ? 'На review' : 'В черновик'}
      </button>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs">Evidence <ExternalLink size={13} /></a>
      <button type="button" className={`hub-btn-ghost inline-flex items-center gap-2 !px-3 !py-2 text-xs ${pendingDeleteId === item.id ? '!border-red-400/40 !text-red-300' : ''}`} onClick={() => onRemove(item.id)}>
        <Trash2 size={14} />{pendingDeleteId === item.id ? 'Подтвердить' : 'Удалить'}
      </button>
    </div>
  );
}

function PlannerCard(props: PlannerViewProps & { item: ContentPlannerItem; compact?: boolean }) {
  const { item, today, compact = false } = props;
  const overdue = item.reviewOn < today;
  return (
    <article className="group rounded-xl border border-hub-border bg-black/10 p-4 transition-colors hover:border-hub-accent/30 hover:bg-hub-accent/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-hub-accent">{item.product}</div><h4 className="mt-1 font-medium text-white">{item.workingTitle}</h4><p className="mt-1 text-xs text-gray-500">{CHANNEL_LABEL[item.channel]} · {FORMAT_LABEL[item.format]} · effort {item.effort}</p></div>
        <StatusBadge item={item} />
      </div>
      <div className={`mt-4 grid gap-3 text-xs leading-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <div><div className="font-medium text-gray-300">Цель</div><div className="text-gray-500">{item.goal}</div></div>
        <div><div className="font-medium text-gray-300">Review</div><div className={overdue ? 'font-medium text-amber-300' : 'text-gray-400'}>{formatDate(item.reviewOn)}{overdue ? ' · просрочено' : ''}</div></div>
        {!compact && <><div><div className="font-medium text-gray-300">Аудитория</div><div className="text-gray-500">{item.audience}</div></div><div><div className="font-medium text-gray-300">CTA</div><div className="text-gray-500">{item.cta}</div></div></>}
      </div>
      <div className="mt-4"><PlannerActions {...props} item={item} /></div>
    </article>
  );
}

export function ContentPlannerTable(props: PlannerViewProps) {
  return (
    <>
      <div className="hidden xl:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
          <colgroup><col className="w-[31%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[13%]" /><col className="w-[26%]" /></colgroup>
          <thead><tr className="text-[10px] uppercase tracking-[0.14em] text-gray-500"><th className="border-b border-hub-border px-3 py-3">Материал</th><th className="border-b border-hub-border px-3 py-3">Канал</th><th className="border-b border-hub-border px-3 py-3">Review</th><th className="border-b border-hub-border px-3 py-3">Статус</th><th className="border-b border-hub-border px-3 py-3">Действия</th></tr></thead>
          <tbody>{props.items.map((item) => { const overdue = item.reviewOn < props.today; return <tr key={item.id} className="group align-top transition-colors hover:bg-hub-accent/[0.025]"><td className="border-b border-hub-border/70 px-3 py-4"><div className="font-medium text-white">{item.workingTitle}</div><div className="mt-1 truncate text-gray-500">{item.product} · {item.goal}</div></td><td className="border-b border-hub-border/70 px-3 py-4 text-gray-400">{CHANNEL_LABEL[item.channel]}<div className="mt-1 text-gray-600">{FORMAT_LABEL[item.format]} · {item.effort}</div></td><td className={`border-b border-hub-border/70 px-3 py-4 ${overdue ? 'font-medium text-amber-300' : 'text-gray-400'}`}>{formatDate(item.reviewOn)}{overdue && <div className="mt-1 text-[10px]">Просрочено</div>}</td><td className="border-b border-hub-border/70 px-3 py-4"><StatusBadge item={item} /></td><td className="border-b border-hub-border/70 px-3 py-3"><PlannerActions {...props} item={item} /></td></tr>; })}</tbody>
        </table>
      </div>
      <div className="grid gap-3 xl:hidden">{props.items.map((item) => <PlannerCard key={item.id} {...props} item={item} />)}</div>
    </>
  );
}

export function ContentPlannerBoard(props: PlannerViewProps) {
  const columns = [
    { status: 'draft', title: 'Черновики', hint: 'Нужно дополнить и проверить' },
    { status: 'ready-for-review', title: 'Готово к review', hint: 'Ожидает ручного решения' },
  ] as const;
  return <div className="grid gap-4 lg:grid-cols-2">{columns.map((column) => { const items = props.items.filter((item) => item.status === column.status); return <section key={column.status} className="rounded-xl border border-hub-border bg-black/[0.08] p-3"><header className="mb-3 flex items-center justify-between gap-3 px-1"><div><h4 className="text-sm font-semibold text-white">{column.title}</h4><p className="mt-1 text-[11px] text-gray-500">{column.hint}</p></div><span className="rounded-full border border-hub-border px-2 py-1 text-[10px] text-gray-400">{items.length}</span></header><div className="space-y-3">{items.length ? items.map((item) => <PlannerCard key={item.id} {...props} item={item} compact />) : <div className="rounded-lg border border-dashed border-hub-border p-5 text-center text-xs text-gray-600">В этой колонке пока нет задач.</div>}</div></section>; })}</div>;
}

export function ContentPlannerCalendar(props: PlannerViewProps) {
  const [month, setMonth] = useState(() => new Date(`${props.today.slice(0, 7)}-01T12:00:00.000Z`));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const days = useMemo(() => getPlannerCalendarDays(month), [month]);
  const byDate = useMemo(() => new Map(days.map((day) => [day.isoDate, props.items.filter((item) => item.reviewOn === day.isoDate)])), [days, props.items]);
  const monthPrefix = month.toISOString().slice(0, 7);
  const monthItems = useMemo(() => props.items.filter((item) => item.reviewOn.startsWith(monthPrefix)), [props.items, monthPrefix]);
  const selected = props.items.find((item) => item.id === selectedId);
  const moveMonth = (delta: number) => setMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1, 12)));
  const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3"><button type="button" className="hub-btn-ghost !p-2" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц"><ArrowLeft size={16} /></button><h4 className="text-sm font-semibold capitalize text-white">{monthLabel}</h4><button type="button" className="hub-btn-ghost !p-2" onClick={() => moveMonth(1)} aria-label="Следующий месяц"><ArrowRight size={16} /></button></div>
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-hub-border bg-hub-border lg:grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => <div key={day} className="bg-hub-surface px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">{day}</div>)}
        {days.map((day) => { const tasks = byDate.get(day.isoDate) ?? []; return <div key={day.isoDate} className={`min-h-28 bg-hub-card p-2 ${day.inCurrentMonth ? '' : 'opacity-35'} ${day.isoDate === props.today ? 'ring-1 ring-inset ring-hub-accent/50' : ''}`}><div className="text-[10px] text-gray-500">{formatDate(day.isoDate)}</div><div className="mt-2 space-y-1">{tasks.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`block w-full truncate rounded border px-2 py-1.5 text-left text-[10px] transition-colors ${item.status === 'ready-for-review' ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200' : 'border-hub-border bg-black/10 text-gray-300'} hover:border-hub-accent/40`}>{item.workingTitle}</button>)}{tasks.length > 3 && <div className="px-1 text-[10px] text-gray-600">+ ещё {tasks.length - 3}</div>}</div></div>; })}
      </div>
      <div className="grid gap-3 lg:hidden">{monthItems.length ? monthItems.map((item) => <PlannerCard key={item.id} {...props} item={item} />) : <div className="rounded-xl border border-dashed border-hub-border p-5 text-center text-xs text-gray-600">В этом месяце задач нет.</div>}</div>
      {selected && <div className="mt-4 hidden lg:block"><PlannerCard {...props} item={selected} /></div>}
    </div>
  );
}
