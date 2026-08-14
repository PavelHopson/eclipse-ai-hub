import { describe, expect, it } from 'vitest';
import type { ContentPlannerItem } from '../../services/contentPlannerService';
import {
  filterPlannerItems,
  getPlannerCalendarDays,
  getPlannerSummary,
} from './contentPlannerView';

function item(overrides: Partial<ContentPlannerItem> = {}): ContentPlannerItem {
  return {
    schemaVersion: 'growth.planner-item.v1',
    id: 'planner-1',
    owner: 'Павел',
    product: 'Eclipse Library',
    audience: 'Разработчики',
    workingTitle: 'Проверенный каталог',
    goal: '10 переходов',
    channel: 'telegram',
    format: 'post',
    effort: 'S',
    sourceUrl: 'https://example.com/release',
    cta: 'Открыть каталог',
    reviewOn: '2026-08-16',
    note: 'Проверить claims',
    status: 'draft',
    approval: 'required',
    createdAt: '2026-08-14T10:00:00.000Z',
    updatedAt: '2026-08-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('content planner view helpers', () => {
  it('summarizes review states without treating review as approval', () => {
    const items = [
      item({ id: 'overdue', reviewOn: '2026-08-13' }),
      item({ id: 'ready', status: 'ready-for-review', reviewOn: '2026-08-15' }),
      item({ id: 'later', reviewOn: '2026-08-25' }),
    ];
    expect(getPlannerSummary(items, '2026-08-14')).toEqual({
      total: 3,
      draft: 2,
      readyForReview: 1,
      overdue: 1,
      dueThisWeek: 1,
    });
  });

  it('combines safe local search, status and channel filters', () => {
    const items = [
      item({ id: 'telegram' }),
      item({ id: 'youtube', channel: 'youtube', product: 'Eclipse Media', workingTitle: 'Release demo' }),
    ];
    expect(filterPlannerItems(items, 'media', 'all', 'youtube', '2026-08-14').map(({ id }) => id)).toEqual(['youtube']);
    expect(filterPlannerItems(items, '', 'overdue', 'all', '2026-08-17').map(({ id }) => id)).toEqual(['telegram', 'youtube']);
  });

  it('builds a six-week Monday-first calendar grid', () => {
    const days = getPlannerCalendarDays(new Date('2026-08-01T12:00:00.000Z'));
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ isoDate: '2026-07-27', inCurrentMonth: false });
    expect(days.at(-1)).toEqual({ isoDate: '2026-09-06', inCurrentMonth: false });
  });
});
