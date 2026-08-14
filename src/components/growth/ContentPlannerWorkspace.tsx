import { useMemo, useState } from 'react';
import {
  CalendarRange,
  Columns3,
  Search,
  Table2,
} from 'lucide-react';
import type {
  ContentPlannerItem,
} from '../../services/contentPlannerService';
import {
  filterPlannerItems,
  getPlannerSummary,
  type PlannerChannelFilter,
  type PlannerStatusFilter,
  type PlannerView,
} from './contentPlannerView';
import {
  ContentPlannerBoard,
  ContentPlannerCalendar,
  ContentPlannerTable,
} from './ContentPlannerViews';

interface ContentPlannerWorkspaceProps {
  items: ContentPlannerItem[];
  today: string;
  pendingDeleteId: string | null;
  onChangeStatus: (item: ContentPlannerItem) => void;
  onRemove: (id: string) => void;
}

const VIEW_OPTIONS: Array<{ id: PlannerView; label: string; icon: typeof Table2 }> = [
  { id: 'table', label: 'Таблица', icon: Table2 },
  { id: 'board', label: 'Канбан', icon: Columns3 },
  { id: 'calendar', label: 'Календарь', icon: CalendarRange },
];

const CHANNEL_OPTIONS: Array<{ id: PlannerChannelFilter; label: string }> = [
  { id: 'all', label: 'Все каналы' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'blog', label: 'Блог / SEO' },
];

export function ContentPlannerWorkspace(props: ContentPlannerWorkspaceProps) {
  const [view, setView] = useState<PlannerView>('table');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlannerStatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<PlannerChannelFilter>('all');
  const summary = useMemo(() => getPlannerSummary(props.items, props.today), [props.items, props.today]);
  const visibleItems = useMemo(() => filterPlannerItems(props.items, query, statusFilter, channelFilter, props.today), [props.items, query, statusFilter, channelFilter, props.today]);

  const summaryCards: Array<{ id: PlannerStatusFilter; label: string; value: number; hint: string; tone: string }> = [
    { id: 'all', label: 'Всего', value: summary.total, hint: `${summary.dueThisWeek} на этой неделе`, tone: 'text-hub-accent' },
    { id: 'draft', label: 'Черновики', value: summary.draft, hint: 'Нужно доработать', tone: 'text-gray-200' },
    { id: 'ready-for-review', label: 'К review', value: summary.readyForReview, hint: 'Ждут решения', tone: 'text-emerald-300' },
    { id: 'overdue', label: 'Просрочено', value: summary.overdue, hint: 'Не скрываются', tone: summary.overdue ? 'text-amber-300' : 'text-gray-500' },
  ];

  const viewProps = {
    items: visibleItems,
    today: props.today,
    pendingDeleteId: props.pendingDeleteId,
    onChangeStatus: props.onChangeStatus,
    onRemove: props.onRemove,
  };

  return (
    <section className="mt-6 border-t border-hub-border pt-5" aria-labelledby="planner-queue-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 id="planner-queue-title" className="text-sm font-semibold text-white">Редакторская очередь</h3><p className="mt-1 text-xs leading-5 text-gray-500">Выберите удобный вид. Review остаётся запросом на проверку, а не разрешением публиковать.</p></div>
        <div className="inline-flex w-fit rounded-lg border border-hub-border bg-black/10 p-1" aria-label="Представление задач">{VIEW_OPTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${view === id ? 'bg-hub-accent/10 text-hub-accent shadow-[inset_0_0_0_1px_rgba(107,163,255,.2)]' : 'text-gray-500 hover:text-gray-200'}`}><Icon size={14} /><span className="hidden sm:inline">{label}</span></button>)}</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map((card) => <button key={card.id} type="button" onClick={() => setStatusFilter(card.id)} aria-pressed={statusFilter === card.id} className={`rounded-xl border p-4 text-left transition-colors ${statusFilter === card.id ? 'border-hub-accent/35 bg-hub-accent/[0.045]' : 'border-hub-border bg-black/10 hover:border-hub-accent/20'}`}><div className="flex items-baseline justify-between gap-3"><span className="text-xs font-medium text-gray-400">{card.label}</span><strong className={`text-xl ${card.tone}`}>{card.value}</strong></div><div className="mt-2 text-[11px] text-gray-600">{card.hint}</div></button>)}</div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
        <label className="relative block"><span className="sr-only">Найти задачу</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="hub-input !py-2.5 !pl-9" placeholder="Найти материал, продукт или CTA…" /></label>
        <label><span className="sr-only">Фильтр по каналу</span><select className="hub-input !py-2.5" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as PlannerChannelFilter)}>{CHANNEL_OPTIONS.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-600"><span>Показано {visibleItems.length} из {props.items.length}</span>{(query || channelFilter !== 'all' || statusFilter !== 'all') && <button type="button" className="text-hub-accent hover:text-white" onClick={() => { setQuery(''); setChannelFilter('all'); setStatusFilter('all'); }}>Сбросить фильтры</button>}</div>

      <div className="mt-4">
        {props.items.length === 0 ? <div className="rounded-xl border border-dashed border-hub-border p-7 text-center"><CalendarRange size={22} className="mx-auto text-hub-accent" /><div className="mt-3 text-sm font-medium text-gray-300">Очередь пока пуста</div><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-gray-600">Добавьте первую задачу: один материал, одно evidence, один CTA и дата следующего решения.</p></div>
          : visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-hub-border p-7 text-center"><Search size={22} className="mx-auto text-gray-600" /><div className="mt-3 text-sm font-medium text-gray-300">По этим условиям ничего не найдено</div><button type="button" className="mt-3 text-xs text-hub-accent hover:text-white" onClick={() => { setQuery(''); setChannelFilter('all'); setStatusFilter('all'); }}>Показать все задачи</button></div>
            : <>{view === 'table' && <ContentPlannerTable {...viewProps} />}{view === 'board' && <ContentPlannerBoard {...viewProps} />}{view === 'calendar' && <ContentPlannerCalendar {...viewProps} />}</>}
      </div>
    </section>
  );
}
