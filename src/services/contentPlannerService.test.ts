import { describe, expect, it } from 'vitest';
import {
  createContentPlannerItem,
  MAX_CONTENT_PLANNER_BYTES,
  parseContentPlanner,
  serializeContentPlanner,
  updateContentPlannerStatus,
  type ContentPlannerDraft,
} from './contentPlannerService';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const DRAFT: ContentPlannerDraft = {
  owner: 'Павел / Eclipse Forge',
  product: 'Eclipse Library',
  audience: 'Разработчики, выбирающие AI-инструменты',
  workingTitle: 'Как проверить AI-инструмент до установки',
  goal: 'Получить не менее 10 переходов в проверенную карточку за 72 часа',
  channel: 'telegram',
  format: 'post',
  effort: 'S',
  sourceUrl: 'https://library.eclipse-forge.ru/#guide/security',
  cta: 'Открыть проверенную карточку в Eclipse Library',
  reviewOn: '2026-08-15',
  note: 'Проверить license, дату источника и не обещать безопасность без аудита.',
};

describe('content planner service', () => {
  it('creates a bounded draft with required approval and normalized evidence', () => {
    const item = createContentPlannerItem(DRAFT, NOW, 'planner-1');
    expect(item).toMatchObject({
      schemaVersion: 'growth.planner-item.v1',
      id: 'planner-1',
      sourceUrl: 'https://library.eclipse-forge.ru/',
      status: 'draft',
      approval: 'required',
    });
  });

  it('rejects credentials, non-HTTPS, past/far dates, unsafe text and unknown enums', () => {
    expect(() => createContentPlannerItem({ ...DRAFT, sourceUrl: 'http://example.com' }, NOW)).toThrow('HTTPS');
    expect(() => createContentPlannerItem({ ...DRAFT, sourceUrl: 'https://user:pass@example.com' }, NOW)).toThrow('credentials');
    expect(() => createContentPlannerItem({ ...DRAFT, reviewOn: '2026-08-13' }, NOW)).toThrow('прошлом');
    expect(() => createContentPlannerItem({ ...DRAFT, reviewOn: '2027-08-15' }, NOW)).toThrow('365');
    expect(() => createContentPlannerItem({ ...DRAFT, note: 'Проверить факты\u202e и источник' }, NOW)).toThrow('безопасных');
    expect(() => createContentPlannerItem({ ...DRAFT, channel: 'private-chat' as never }, NOW)).toThrow('канал');
  });

  it('keeps overdue tasks visible but only supports draft and ready-for-review', () => {
    const item = createContentPlannerItem(DRAFT, NOW, 'planner-1');
    const ready = updateContentPlannerStatus(item, 'ready-for-review', new Date('2026-08-15T12:00:00.000Z'));
    expect(ready.status).toBe('ready-for-review');
    expect(parseContentPlanner(JSON.stringify([ready]), new Date('2026-08-20T12:00:00.000Z'))).toEqual([ready]);
    expect(() => updateContentPlannerStatus(item, 'published' as never, NOW)).toThrow('draft');
  });

  it('treats localStorage as untrusted and drops corrupt, extra-field or duplicate entries', () => {
    const item = createContentPlannerItem(DRAFT, NOW, 'planner-1');
    const duplicate = { ...item, id: 'planner-copy' };
    const unsafe = { ...item, id: 'unsafe', sourceUrl: 'javascript:alert(1)' };
    const unknownField = { ...item, injected: true };
    expect(parseContentPlanner(JSON.stringify([item, duplicate, unsafe, unknownField]), NOW)).toEqual([item]);
    expect(parseContentPlanner('{', NOW)).toEqual([]);
    expect(parseContentPlanner('x'.repeat(MAX_CONTENT_PLANNER_BYTES + 1), NOW)).toEqual([]);
  });

  it('serializes no credentials or publication authority', () => {
    const item = createContentPlannerItem(DRAFT, NOW, 'planner-1');
    const raw = serializeContentPlanner([item]);
    expect(raw).not.toContain('apiKey');
    expect(raw).not.toContain('publishAllowed');
    expect(raw).not.toContain('approved');
  });
});
