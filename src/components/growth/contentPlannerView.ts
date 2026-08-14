import type {
  ContentPlannerItem,
  PlannerChannel,
  PlannerStatus,
} from '../../services/contentPlannerService';

export type PlannerView = 'table' | 'board' | 'calendar';
export type PlannerStatusFilter = 'all' | PlannerStatus | 'overdue';
export type PlannerChannelFilter = 'all' | PlannerChannel;

export interface PlannerSummary {
  total: number;
  draft: number;
  readyForReview: number;
  overdue: number;
  dueThisWeek: number;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getPlannerSummary(items: ContentPlannerItem[], today: string): PlannerSummary {
  const weekEnd = addDays(today, 6);
  return {
    total: items.length,
    draft: items.filter((item) => item.status === 'draft').length,
    readyForReview: items.filter((item) => item.status === 'ready-for-review').length,
    overdue: items.filter((item) => item.reviewOn < today).length,
    dueThisWeek: items.filter((item) => item.reviewOn >= today && item.reviewOn <= weekEnd).length,
  };
}

export function filterPlannerItems(
  items: ContentPlannerItem[],
  query: string,
  status: PlannerStatusFilter,
  channel: PlannerChannelFilter,
  today: string,
): ContentPlannerItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  return items.filter((item) => {
    if (channel !== 'all' && item.channel !== channel) return false;
    if (status === 'overdue' && item.reviewOn >= today) return false;
    if (status !== 'all' && status !== 'overdue' && item.status !== status) return false;
    if (!normalizedQuery) return true;
    return [item.workingTitle, item.product, item.owner, item.audience, item.goal, item.cta]
      .some((value) => value.toLocaleLowerCase('ru').includes(normalizedQuery));
  });
}

export interface PlannerCalendarDay {
  isoDate: string;
  inCurrentMonth: boolean;
}

export function getPlannerCalendarDays(month: Date): PlannerCalendarDay[] {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return {
      isoDate: date.toISOString().slice(0, 10),
      inCurrentMonth: date.getUTCMonth() === monthIndex,
    };
  });
}
