import { describe, expect, it } from 'vitest';
import {
  buildGrowthBriefFromCompetitor,
  createCompetitorObservation,
  MAX_COMPETITOR_TRACKER_BYTES,
  parseCompetitorObservations,
  serializeCompetitorObservations,
  type CompetitorObservationDraft,
} from './competitorTrackerService';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const DRAFT: CompetitorObservationDraft = {
  owner: 'Public creator',
  sourceUrl: 'https://example.com/public-case#comments',
  observedAt: '2026-08-13',
  channel: 'youtube',
  format: 'short-video',
  hookPattern: 'Начать с проверяемой проблемы и показать исправление в одном сценарии',
  publicSignal: 'На публичной странице видны просмотры и содержательные комментарии; конверсии неизвестны.',
  eclipseUse: 'Проверить формат на коротком видео о production deploy Eclipse Chat.',
  note: 'Не копировать текст, визуал и обещания; использовать только структуру рассказа.',
};

describe('competitor tracker service', () => {
  it('normalizes a bounded public observation and strips URL fragments', () => {
    const entry = createCompetitorObservation(DRAFT, NOW, 'observation-1');
    expect(entry).toMatchObject({
      schemaVersion: 'growth.competitor-observation.v1',
      id: 'observation-1',
      sourceUrl: 'https://example.com/public-case',
      channel: 'youtube',
      format: 'short-video',
    });
  });

  it('rejects private-style URLs, future dates, unsafe text and unknown enums', () => {
    expect(() => createCompetitorObservation({ ...DRAFT, sourceUrl: 'http://example.com' }, NOW)).toThrow('HTTPS');
    expect(() => createCompetitorObservation({ ...DRAFT, sourceUrl: 'https://user:pass@example.com' }, NOW)).toThrow('credentials');
    expect(() => createCompetitorObservation({ ...DRAFT, observedAt: '2026-08-15' }, NOW)).toThrow('будущем');
    expect(() => createCompetitorObservation({ ...DRAFT, note: 'Нормальная заметка\u202e с подменой' }, NOW)).toThrow('безопасных');
    expect(() => createCompetitorObservation({ ...DRAFT, channel: 'private-chat' as never }, NOW)).toThrow('канал');
  });

  it('treats localStorage as untrusted and drops corrupt or duplicate sources', () => {
    const entry = createCompetitorObservation(DRAFT, NOW, 'observation-1');
    const duplicate = { ...entry, id: 'observation-copy' };
    const unsafe = { ...entry, id: 'unsafe', sourceUrl: 'javascript:alert(1)' };
    const unknownField = { ...entry, injected: true };
    expect(parseCompetitorObservations(JSON.stringify([entry, duplicate, unsafe, unknownField]), NOW)).toEqual([entry]);
    expect(parseCompetitorObservations('{', NOW)).toEqual([]);
    expect(parseCompetitorObservations('x'.repeat(MAX_COMPETITOR_TRACKER_BYTES + 1), NOW)).toEqual([]);
  });

  it('builds a reference-only brief without copying or granting publication authority', () => {
    const entry = createCompetitorObservation(DRAFT, NOW, 'observation-1');
    const brief = buildGrowthBriefFromCompetitor(entry, { audience: 'Основатели AI-продуктов', channel: 'telegram' });
    expect(brief.sourceUrls).toEqual(['https://example.com/public-case']);
    expect(brief.releaseSummary).toMatch(/Не копировать/);
    expect(brief.evidenceNotes).toMatch(/reference-only/);
    expect(brief.evidenceNotes).toMatch(/не проверенный outcome/);
    expect(serializeCompetitorObservations([entry])).not.toContain('apiKey');
  });
});
