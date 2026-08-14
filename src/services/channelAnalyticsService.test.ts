import { describe, expect, it } from 'vitest';
import {
  createChannelSnapshot,
  findComparableSnapshot,
  getChannelRates,
  MAX_CHANNEL_ANALYTICS_BYTES,
  parseChannelSnapshots,
  serializeChannelSnapshots,
  type ChannelSnapshotDraft,
} from './channelAnalyticsService';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const DRAFT: ChannelSnapshotDraft = {
  product: 'Eclipse Library',
  channel: 'telegram',
  windowDays: 30,
  periodEnd: '2026-08-13',
  publishedCount: 8,
  impressions: 10_000,
  medianImpressions: 1_100,
  saves: 400,
  clicks: 600,
  productVisits: 300,
  qualifiedLeads: 30,
  sourceUrl: 'https://example.com/analytics#period',
  note: 'Агрегированный экспорт без пользовательских и персональных данных.',
};

describe('channel analytics service', () => {
  it('creates a bounded evidence-backed snapshot and strips URL fragments', () => {
    const snapshot = createChannelSnapshot(DRAFT, NOW, 'snapshot-1');
    expect(snapshot).toMatchObject({
      schemaVersion: 'growth.channel-snapshot.v1',
      id: 'snapshot-1',
      sourceUrl: 'https://example.com/analytics',
      windowDays: 30,
    });
  });

  it('rejects impossible funnels, future dates and unsafe evidence', () => {
    expect(() => createChannelSnapshot({ ...DRAFT, productVisits: 601 }, NOW)).toThrow('больше кликов');
    expect(() => createChannelSnapshot({ ...DRAFT, qualifiedLeads: 301 }, NOW)).toThrow('больше переходов');
    expect(() => createChannelSnapshot({ ...DRAFT, periodEnd: '2026-08-15' }, NOW)).toThrow('будущем');
    expect(() => createChannelSnapshot({ ...DRAFT, sourceUrl: 'https://user:pass@example.com' }, NOW)).toThrow('credentials');
    expect(() => createChannelSnapshot({ ...DRAFT, note: 'Нормальная заметка\u202e с подменой направления' }, NOW)).toThrow('безопасных');
  });

  it('calculates rates without dividing by zero', () => {
    const snapshot = createChannelSnapshot(DRAFT, NOW, 'snapshot-1');
    expect(getChannelRates(snapshot)).toEqual({
      saveRate: 0.04,
      clickThroughRate: 0.06,
      visitRate: 0.5,
      leadRate: 0.1,
    });
    const noBottomFunnel = createChannelSnapshot({ ...DRAFT, productVisits: 0, qualifiedLeads: 0 }, NOW, 'snapshot-2');
    expect(getChannelRates(noBottomFunnel).leadRate).toBe(0);
  });

  it('compares only the same product, channel and window', () => {
    const previous = createChannelSnapshot({ ...DRAFT, periodEnd: '2026-07-14' }, NOW, 'previous');
    const current = createChannelSnapshot(DRAFT, NOW, 'current');
    const otherChannel = createChannelSnapshot({ ...DRAFT, channel: 'linkedin', periodEnd: '2026-08-12' }, NOW, 'other');
    expect(findComparableSnapshot(current, [otherChannel, previous])).toEqual(previous);
    expect(findComparableSnapshot(otherChannel, [previous])).toBeNull();
  });

  it('treats localStorage as untrusted and drops corrupt or duplicate entries', () => {
    const snapshot = createChannelSnapshot(DRAFT, NOW, 'snapshot-1');
    const duplicate = { ...snapshot, id: 'snapshot-copy' };
    const impossible = { ...snapshot, id: 'bad', qualifiedLeads: 301 };
    const unknownField = { ...snapshot, injected: true };
    expect(parseChannelSnapshots(JSON.stringify([snapshot, duplicate, impossible, unknownField]), NOW)).toEqual([snapshot]);
    expect(parseChannelSnapshots('{', NOW)).toEqual([]);
    expect(parseChannelSnapshots('x'.repeat(MAX_CHANNEL_ANALYTICS_BYTES + 1), NOW)).toEqual([]);
    expect(serializeChannelSnapshots([snapshot])).not.toContain('apiKey');
  });
});
