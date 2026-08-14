import type { GrowthWorkspaceInput } from './growthWorkflowService';

export const COMPETITOR_TRACKER_STORAGE_KEY = 'eclipse.growth.competitor-observations.v1';
export const MAX_COMPETITOR_OBSERVATIONS = 30;
export const MAX_COMPETITOR_TRACKER_BYTES = 64 * 1024;

export type CompetitorChannel = 'telegram' | 'instagram' | 'linkedin' | 'youtube' | 'blog';
export type CompetitorFormat = 'post' | 'carousel' | 'short-video' | 'long-video' | 'landing';

export interface CompetitorObservationDraft {
  owner: string;
  sourceUrl: string;
  observedAt: string;
  channel: CompetitorChannel;
  format: CompetitorFormat;
  hookPattern: string;
  publicSignal: string;
  eclipseUse: string;
  note: string;
}

export interface CompetitorObservation extends CompetitorObservationDraft {
  schemaVersion: 'growth.competitor-observation.v1';
  id: string;
  createdAt: string;
}

const OBSERVATION_KEYS = [
  'schemaVersion', 'id', 'owner', 'sourceUrl', 'observedAt', 'channel', 'format',
  'hookPattern', 'publicSignal', 'eclipseUse', 'note', 'createdAt',
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
  const raw = cleanText(value, 'Источник', 12, 1_000);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Источник должен быть корректной HTTPS-ссылкой');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Источник должен использовать HTTPS и не содержать credentials');
  }
  url.hash = '';
  return url.toString();
}

function normalizeDate(value: unknown, now: Date): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Дата должна быть в формате YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Укажите существующую дату');
  }
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (parsed.getTime() >= Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate())) {
    throw new Error('Дата наблюдения не может быть в будущем');
  }
  return value;
}

function normalizeChannel(value: unknown): CompetitorChannel {
  if (value === 'telegram' || value === 'instagram' || value === 'linkedin' || value === 'youtube' || value === 'blog') return value;
  throw new Error('Выберите поддерживаемый канал');
}

function normalizeFormat(value: unknown): CompetitorFormat {
  if (value === 'post' || value === 'carousel' || value === 'short-video' || value === 'long-video' || value === 'landing') return value;
  throw new Error('Выберите поддерживаемый формат');
}

function exactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...OBSERVATION_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function createCompetitorObservation(
  draft: CompetitorObservationDraft,
  now = new Date(),
  id: string = crypto.randomUUID(),
): CompetitorObservation {
  return {
    schemaVersion: 'growth.competitor-observation.v1',
    id: cleanText(id, 'ID', 3, 120),
    owner: cleanText(draft.owner, 'Автор или проект', 2, 120),
    sourceUrl: normalizeSourceUrl(draft.sourceUrl),
    observedAt: normalizeDate(draft.observedAt, now),
    channel: normalizeChannel(draft.channel),
    format: normalizeFormat(draft.format),
    hookPattern: cleanText(draft.hookPattern, 'Паттерн', 8, 220),
    publicSignal: cleanText(draft.publicSignal, 'Публичный сигнал', 8, 360),
    eclipseUse: cleanText(draft.eclipseUse, 'Применение в Eclipse', 12, 500),
    note: cleanText(draft.note, 'Ограничение', 10, 500),
    createdAt: now.toISOString(),
  };
}

function parseObservation(value: unknown, now: Date): CompetitorObservation {
  if (!exactObject(value) || value.schemaVersion !== 'growth.competitor-observation.v1') {
    throw new Error('Некорректное наблюдение');
  }
  const createdAt = cleanText(value.createdAt, 'Created at', 20, 30);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Некорректная дата создания');
  return {
    ...createCompetitorObservation({
      owner: value.owner as string,
      sourceUrl: value.sourceUrl as string,
      observedAt: value.observedAt as string,
      channel: normalizeChannel(value.channel),
      format: normalizeFormat(value.format),
      hookPattern: value.hookPattern as string,
      publicSignal: value.publicSignal as string,
      eclipseUse: value.eclipseUse as string,
      note: value.note as string,
    }, now, value.id as string),
    createdAt,
  };
}

export function parseCompetitorObservations(raw: string | null, now = new Date()): CompetitorObservation[] {
  if (!raw) return [];
  if (new TextEncoder().encode(raw).byteLength > MAX_COMPETITOR_TRACKER_BYTES) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: CompetitorObservation[] = [];
  const sourceUrls = new Set<string>();
  for (const candidate of parsed.slice(0, MAX_COMPETITOR_OBSERVATIONS * 2)) {
    try {
      const entry = parseObservation(candidate, now);
      if (sourceUrls.has(entry.sourceUrl)) continue;
      sourceUrls.add(entry.sourceUrl);
      result.push(entry);
      if (result.length === MAX_COMPETITOR_OBSERVATIONS) break;
    } catch {
      // localStorage is untrusted input: invalid legacy/corrupt entries fail closed.
    }
  }
  return result.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function serializeCompetitorObservations(entries: CompetitorObservation[]): string {
  const raw = JSON.stringify(entries.slice(0, MAX_COMPETITOR_OBSERVATIONS));
  if (new TextEncoder().encode(raw).byteLength > MAX_COMPETITOR_TRACKER_BYTES) {
    throw new Error('Competitor Tracker превышает локальный лимит 64 КБ');
  }
  return raw;
}

export function buildGrowthBriefFromCompetitor(
  entry: CompetitorObservation,
  current: Pick<GrowthWorkspaceInput, 'audience' | 'channel'>,
): GrowthWorkspaceInput {
  const shortPattern = entry.hookPattern.length > 96 ? `${entry.hookPattern.slice(0, 95).trimEnd()}…` : entry.hookPattern;
  return {
    releaseName: `Свой кейс по паттерну: ${shortPattern}`,
    releaseSummary: `Проверить паттерн «${entry.hookPattern}» на собственном доказуемом кейсе Eclipse Forge. Не копировать формулировки, визуал, assets или claims источника.`,
    audience: current.audience,
    channel: current.channel,
    sourceUrls: [entry.sourceUrl],
    evidenceNotes: `Public reference: ${entry.sourceUrl}\nАвтор или проект: ${entry.owner}\nДата наблюдения: ${entry.observedAt}\nКанал и формат: ${entry.channel} / ${entry.format}\nВидимый сигнал: ${entry.publicSignal}\nГипотеза для Eclipse: ${entry.eclipseUse}\nОграничение: ${entry.note}\nСтатус: reference-only. Видимый сигнал — наблюдение, а не проверенный outcome Eclipse Forge.`,
  };
}
