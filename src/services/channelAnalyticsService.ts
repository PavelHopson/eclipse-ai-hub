export const CHANNEL_ANALYTICS_STORAGE_KEY = 'eclipse.growth.channel-analytics.v1';
export const MAX_CHANNEL_SNAPSHOTS = 24;
export const MAX_CHANNEL_ANALYTICS_BYTES = 64 * 1024;

export type GrowthChannel = 'telegram' | 'linkedin' | 'blog';
export type AnalyticsWindowDays = 7 | 30 | 90;

export interface ChannelSnapshotDraft {
  product: string;
  channel: GrowthChannel;
  windowDays: AnalyticsWindowDays;
  periodEnd: string;
  publishedCount: number;
  impressions: number;
  medianImpressions: number;
  saves: number;
  clicks: number;
  productVisits: number;
  qualifiedLeads: number;
  sourceUrl: string;
  note: string;
}

export interface ChannelSnapshot extends ChannelSnapshotDraft {
  schemaVersion: 'growth.channel-snapshot.v1';
  id: string;
  createdAt: string;
}

export interface ChannelRates {
  saveRate: number;
  clickThroughRate: number;
  visitRate: number;
  leadRate: number;
}

const ENTRY_KEYS = [
  'schemaVersion', 'id', 'product', 'channel', 'windowDays', 'periodEnd',
  'publishedCount', 'impressions', 'medianImpressions', 'saves', 'clicks',
  'productVisits', 'qualifiedLeads', 'sourceUrl', 'note', 'createdAt',
] as const;
const UNSAFE_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;

function cleanText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field}: требуется текст`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || UNSAFE_CHARACTERS.test(normalized)) {
    throw new Error(`${field}: требуется от ${min} до ${max} безопасных символов`);
  }
  return normalized;
}

function normalizeSourceUrl(value: unknown): string {
  const raw = cleanText(value, 'Evidence', 12, 1_000);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Evidence должно быть корректной HTTPS-ссылкой');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Evidence должно использовать HTTPS и не содержать credentials');
  }
  url.hash = '';
  return url.toString();
}

function normalizeDate(value: unknown, now: Date): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Конец периода должен быть в формате YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Укажите существующую дату конца периода');
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (parsed.getTime() > today) throw new Error('Конец периода не может быть в будущем');
  return value;
}

function normalizeInteger(value: unknown, field: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > 1_000_000_000) {
    throw new Error(`${field}: укажите целое число от ${min} до 1 000 000 000`);
  }
  return value;
}

function normalizeChannel(value: unknown): GrowthChannel {
  if (value === 'telegram' || value === 'linkedin' || value === 'blog') return value;
  throw new Error('Выберите поддерживаемый канал');
}

function normalizeWindow(value: unknown): AnalyticsWindowDays {
  if (value === 7 || value === 30 || value === 90) return value;
  throw new Error('Окно аналитики должно быть 7, 30 или 90 дней');
}

function exactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...ENTRY_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function createChannelSnapshot(
  draft: ChannelSnapshotDraft,
  now = new Date(),
  id: string = crypto.randomUUID(),
): ChannelSnapshot {
  const snapshot: ChannelSnapshot = {
    schemaVersion: 'growth.channel-snapshot.v1',
    id: cleanText(id, 'ID', 3, 120),
    product: cleanText(draft.product, 'Продукт', 2, 100),
    channel: normalizeChannel(draft.channel),
    windowDays: normalizeWindow(draft.windowDays),
    periodEnd: normalizeDate(draft.periodEnd, now),
    publishedCount: normalizeInteger(draft.publishedCount, 'Публикации', 1),
    impressions: normalizeInteger(draft.impressions, 'Показы', 1),
    medianImpressions: normalizeInteger(draft.medianImpressions, 'Медиана показов'),
    saves: normalizeInteger(draft.saves, 'Сохранения'),
    clicks: normalizeInteger(draft.clicks, 'Клики'),
    productVisits: normalizeInteger(draft.productVisits, 'Переходы в продукт'),
    qualifiedLeads: normalizeInteger(draft.qualifiedLeads, 'Целевые обращения'),
    sourceUrl: normalizeSourceUrl(draft.sourceUrl),
    note: cleanText(draft.note, 'Заметка', 10, 500),
    createdAt: now.toISOString(),
  };

  if (snapshot.medianImpressions > snapshot.impressions) throw new Error('Медиана показов не может быть больше всех показов');
  if (snapshot.saves > snapshot.impressions) throw new Error('Сохранения не могут быть больше показов');
  if (snapshot.clicks > snapshot.impressions) throw new Error('Клики не могут быть больше показов');
  if (snapshot.productVisits > snapshot.clicks) throw new Error('Переходы в продукт не могут быть больше кликов');
  if (snapshot.qualifiedLeads > snapshot.productVisits) throw new Error('Целевые обращения не могут быть больше переходов в продукт');
  return snapshot;
}

function parseSnapshot(value: unknown, now: Date): ChannelSnapshot {
  if (!exactObject(value) || value.schemaVersion !== 'growth.channel-snapshot.v1') {
    throw new Error('Некорректный snapshot аналитики');
  }
  const createdAt = cleanText(value.createdAt, 'Created at', 20, 30);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Некорректная дата создания');
  return {
    ...createChannelSnapshot({
      product: value.product as string,
      channel: normalizeChannel(value.channel),
      windowDays: normalizeWindow(value.windowDays),
      periodEnd: value.periodEnd as string,
      publishedCount: value.publishedCount as number,
      impressions: value.impressions as number,
      medianImpressions: value.medianImpressions as number,
      saves: value.saves as number,
      clicks: value.clicks as number,
      productVisits: value.productVisits as number,
      qualifiedLeads: value.qualifiedLeads as number,
      sourceUrl: value.sourceUrl as string,
      note: value.note as string,
    }, now, value.id as string),
    createdAt,
  };
}

export function parseChannelSnapshots(raw: string | null, now = new Date()): ChannelSnapshot[] {
  if (!raw) return [];
  if (new TextEncoder().encode(raw).byteLength > MAX_CHANNEL_ANALYTICS_BYTES) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: ChannelSnapshot[] = [];
  const identities = new Set<string>();
  for (const candidate of parsed.slice(0, MAX_CHANNEL_SNAPSHOTS * 2)) {
    try {
      const snapshot = parseSnapshot(candidate, now);
      const identity = [snapshot.product.toLocaleLowerCase('ru'), snapshot.channel, snapshot.windowDays, snapshot.periodEnd].join('\n');
      if (identities.has(identity)) continue;
      identities.add(identity);
      result.push(snapshot);
      if (result.length === MAX_CHANNEL_SNAPSHOTS) break;
    } catch {
      // localStorage is untrusted input: invalid entries fail closed.
    }
  }
  return result.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export function serializeChannelSnapshots(entries: ChannelSnapshot[]): string {
  const raw = JSON.stringify(entries.slice(0, MAX_CHANNEL_SNAPSHOTS));
  if (new TextEncoder().encode(raw).byteLength > MAX_CHANNEL_ANALYTICS_BYTES) {
    throw new Error('Аналитика превышает локальный лимит 64 КБ');
  }
  return raw;
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

export function getChannelRates(snapshot: ChannelSnapshot): ChannelRates {
  return {
    saveRate: ratio(snapshot.saves, snapshot.impressions),
    clickThroughRate: ratio(snapshot.clicks, snapshot.impressions),
    visitRate: ratio(snapshot.productVisits, snapshot.clicks),
    leadRate: ratio(snapshot.qualifiedLeads, snapshot.productVisits),
  };
}

export function findComparableSnapshot(current: ChannelSnapshot, entries: ChannelSnapshot[]): ChannelSnapshot | null {
  const product = current.product.toLocaleLowerCase('ru');
  return entries
    .filter((entry) => entry.id !== current.id
      && entry.product.toLocaleLowerCase('ru') === product
      && entry.channel === current.channel
      && entry.windowDays === current.windowDays
      && entry.periodEnd < current.periodEnd)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
}
