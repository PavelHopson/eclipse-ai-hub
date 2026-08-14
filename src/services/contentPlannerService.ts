export const CONTENT_PLANNER_STORAGE_KEY = 'eclipse.growth.content-planner.v1';
export const MAX_CONTENT_PLANNER_ITEMS = 30;
export const MAX_CONTENT_PLANNER_BYTES = 64 * 1024;

export type PlannerChannel = 'telegram' | 'instagram' | 'linkedin' | 'youtube' | 'blog';
export type PlannerFormat = 'post' | 'carousel' | 'short-video' | 'long-video' | 'article' | 'release-note';
export type PlannerStatus = 'draft' | 'ready-for-review';
export type PlannerEffort = 'S' | 'M' | 'L';

export interface ContentPlannerDraft {
  owner: string;
  product: string;
  audience: string;
  workingTitle: string;
  goal: string;
  channel: PlannerChannel;
  format: PlannerFormat;
  effort: PlannerEffort;
  sourceUrl: string;
  cta: string;
  reviewOn: string;
  note: string;
}

export interface ContentPlannerItem extends ContentPlannerDraft {
  schemaVersion: 'growth.planner-item.v1';
  id: string;
  status: PlannerStatus;
  approval: 'required';
  createdAt: string;
  updatedAt: string;
}

const ITEM_KEYS = [
  'schemaVersion', 'id', 'owner', 'product', 'audience', 'workingTitle', 'goal', 'channel',
  'format', 'effort', 'sourceUrl', 'cta', 'reviewOn', 'note', 'status', 'approval',
  'createdAt', 'updatedAt',
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
    throw new Error('Evidence должен быть корректной HTTPS-ссылкой');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Evidence должен использовать HTTPS и не содержать credentials');
  }
  url.hash = '';
  return url.toString();
}

function normalizeReviewDate(value: unknown, now: Date, allowPast: boolean): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Дата review должна быть в формате YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Укажите существующую дату review');
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (!allowPast && parsed.getTime() < today) {
    throw new Error('Дата review не может быть в прошлом');
  }
  const latest = new Date(today);
  latest.setUTCDate(latest.getUTCDate() + 365);
  if (parsed.getTime() > latest.getTime()) {
    throw new Error('Дата review должна быть в пределах ближайших 365 дней');
  }
  return value;
}

function normalizeChannel(value: unknown): PlannerChannel {
  if (value === 'telegram' || value === 'instagram' || value === 'linkedin' || value === 'youtube' || value === 'blog') return value;
  throw new Error('Выберите поддерживаемый канал');
}

function normalizeFormat(value: unknown): PlannerFormat {
  if (value === 'post' || value === 'carousel' || value === 'short-video' || value === 'long-video' || value === 'article' || value === 'release-note') return value;
  throw new Error('Выберите поддерживаемый формат');
}

function normalizeEffort(value: unknown): PlannerEffort {
  if (value === 'S' || value === 'M' || value === 'L') return value;
  throw new Error('Выберите effort S, M или L');
}

function normalizeStatus(value: unknown): PlannerStatus {
  if (value === 'draft' || value === 'ready-for-review') return value;
  throw new Error('Planner поддерживает только draft и ready-for-review');
}

function normalizeTimestamp(value: unknown, field: string): string {
  const timestamp = cleanText(value, field, 20, 30);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${field}: некорректная дата`);
  return timestamp;
}

function exactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...ITEM_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function normalizeDraft(draft: ContentPlannerDraft, now: Date, allowPast: boolean): ContentPlannerDraft {
  return {
    owner: cleanText(draft.owner, 'Owner', 2, 120),
    product: cleanText(draft.product, 'Продукт', 2, 120),
    audience: cleanText(draft.audience, 'Аудитория', 8, 240),
    workingTitle: cleanText(draft.workingTitle, 'Рабочий заголовок', 8, 180),
    goal: cleanText(draft.goal, 'Цель и KPI', 8, 300),
    channel: normalizeChannel(draft.channel),
    format: normalizeFormat(draft.format),
    effort: normalizeEffort(draft.effort),
    sourceUrl: normalizeSourceUrl(draft.sourceUrl),
    cta: cleanText(draft.cta, 'CTA', 4, 240),
    reviewOn: normalizeReviewDate(draft.reviewOn, now, allowPast),
    note: cleanText(draft.note, 'Что проверить', 10, 600),
  };
}

export function createContentPlannerItem(
  draft: ContentPlannerDraft,
  now = new Date(),
  id: string = crypto.randomUUID(),
): ContentPlannerItem {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'growth.planner-item.v1',
    id: cleanText(id, 'ID', 3, 120),
    ...normalizeDraft(draft, now, false),
    status: 'draft',
    approval: 'required',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function parsePlannerItem(value: unknown, now: Date): ContentPlannerItem {
  if (!exactObject(value) || value.schemaVersion !== 'growth.planner-item.v1' || value.approval !== 'required') {
    throw new Error('Некорректная задача Planner');
  }
  return {
    schemaVersion: 'growth.planner-item.v1',
    id: cleanText(value.id, 'ID', 3, 120),
    ...normalizeDraft({
      owner: value.owner as string,
      product: value.product as string,
      audience: value.audience as string,
      workingTitle: value.workingTitle as string,
      goal: value.goal as string,
      channel: normalizeChannel(value.channel),
      format: normalizeFormat(value.format),
      effort: normalizeEffort(value.effort),
      sourceUrl: value.sourceUrl as string,
      cta: value.cta as string,
      reviewOn: value.reviewOn as string,
      note: value.note as string,
    }, now, true),
    status: normalizeStatus(value.status),
    approval: 'required',
    createdAt: normalizeTimestamp(value.createdAt, 'Created at'),
    updatedAt: normalizeTimestamp(value.updatedAt, 'Updated at'),
  };
}

export function updateContentPlannerStatus(
  item: ContentPlannerItem,
  status: PlannerStatus,
  now = new Date(),
): ContentPlannerItem {
  const normalized = parsePlannerItem(item, now);
  return { ...normalized, status: normalizeStatus(status), updatedAt: now.toISOString() };
}

export function parseContentPlanner(raw: string | null, now = new Date()): ContentPlannerItem[] {
  if (!raw) return [];
  if (new TextEncoder().encode(raw).byteLength > MAX_CONTENT_PLANNER_BYTES) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: ContentPlannerItem[] = [];
  const identities = new Set<string>();
  for (const candidate of parsed.slice(0, MAX_CONTENT_PLANNER_ITEMS * 2)) {
    try {
      const item = parsePlannerItem(candidate, now);
      const identity = [item.sourceUrl, item.workingTitle.toLocaleLowerCase('ru'), item.channel, item.format, item.reviewOn].join('\n');
      if (identities.has(identity)) continue;
      identities.add(identity);
      result.push(item);
      if (result.length === MAX_CONTENT_PLANNER_ITEMS) break;
    } catch {
      // localStorage is untrusted input: invalid legacy/corrupt entries fail closed.
    }
  }
  return result.sort((a, b) => a.reviewOn.localeCompare(b.reviewOn) || b.updatedAt.localeCompare(a.updatedAt));
}

export function serializeContentPlanner(items: ContentPlannerItem[]): string {
  const raw = JSON.stringify(items.slice(0, MAX_CONTENT_PLANNER_ITEMS));
  if (new TextEncoder().encode(raw).byteLength > MAX_CONTENT_PLANNER_BYTES) {
    throw new Error('Planner превышает локальный лимит 64 КБ');
  }
  return raw;
}
