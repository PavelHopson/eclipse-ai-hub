import type { GrowthWorkspaceInput } from './growthWorkflowService';

export const HOOK_VAULT_STORAGE_KEY = 'eclipse.growth.hook-vault.v1';
export const MAX_HOOK_VAULT_ENTRIES = 30;
export const MAX_HOOK_VAULT_BYTES = 64 * 1024;

export type HookRightsStatus = 'owned' | 'public-reference' | 'unknown';

export interface HookVaultDraft {
  pattern: string;
  sourceUrl: string;
  author: string;
  capturedAt: string;
  rightsStatus: HookRightsStatus;
  note: string;
}

export interface HookVaultEntry extends HookVaultDraft {
  schemaVersion: 'growth.hook.v1';
  id: string;
  createdAt: string;
}

const ENTRY_KEYS = [
  'schemaVersion', 'id', 'pattern', 'sourceUrl', 'author', 'capturedAt',
  'rightsStatus', 'note', 'createdAt',
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
    throw new Error('Дата источника не может быть в будущем');
  }
  return value;
}

function exactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...ENTRY_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function normalizeRightsStatus(value: unknown): HookRightsStatus {
  if (value === 'owned' || value === 'public-reference' || value === 'unknown') return value;
  throw new Error('Выберите статус прав');
}

export function createHookVaultEntry(
  draft: HookVaultDraft,
  now = new Date(),
  id: string = crypto.randomUUID(),
): HookVaultEntry {
  return {
    schemaVersion: 'growth.hook.v1',
    id: cleanText(id, 'ID', 3, 120),
    pattern: cleanText(draft.pattern, 'Паттерн', 8, 180),
    sourceUrl: normalizeSourceUrl(draft.sourceUrl),
    author: cleanText(draft.author, 'Автор', 2, 120),
    capturedAt: normalizeDate(draft.capturedAt, now),
    rightsStatus: normalizeRightsStatus(draft.rightsStatus),
    note: cleanText(draft.note, 'Заметка', 10, 600),
    createdAt: now.toISOString(),
  };
}

function parseEntry(value: unknown, now: Date): HookVaultEntry {
  if (!exactObject(value) || value.schemaVersion !== 'growth.hook.v1') {
    throw new Error('Некорректная запись Hook Vault');
  }
  const createdAt = cleanText(value.createdAt, 'Created at', 20, 30);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Некорректная дата создания');
  return {
    ...createHookVaultEntry({
      pattern: value.pattern as string,
      sourceUrl: value.sourceUrl as string,
      author: value.author as string,
      capturedAt: value.capturedAt as string,
      rightsStatus: normalizeRightsStatus(value.rightsStatus),
      note: value.note as string,
    }, now, value.id as string),
    createdAt,
  };
}

export function parseHookVault(raw: string | null, now = new Date()): HookVaultEntry[] {
  if (!raw) return [];
  if (new TextEncoder().encode(raw).byteLength > MAX_HOOK_VAULT_BYTES) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: HookVaultEntry[] = [];
  const identities = new Set<string>();
  for (const candidate of parsed.slice(0, MAX_HOOK_VAULT_ENTRIES * 2)) {
    try {
      const entry = parseEntry(candidate, now);
      const identity = `${entry.sourceUrl}\n${entry.pattern.toLocaleLowerCase('ru')}`;
      if (identities.has(identity)) continue;
      identities.add(identity);
      result.push(entry);
      if (result.length === MAX_HOOK_VAULT_ENTRIES) break;
    } catch {
      // localStorage is untrusted input: invalid legacy/corrupt entries fail closed.
    }
  }
  return result;
}

export function serializeHookVault(entries: HookVaultEntry[]): string {
  const raw = JSON.stringify(entries.slice(0, MAX_HOOK_VAULT_ENTRIES));
  if (new TextEncoder().encode(raw).byteLength > MAX_HOOK_VAULT_BYTES) {
    throw new Error('Hook Vault превышает локальный лимит 64 КБ');
  }
  return raw;
}

export function buildGrowthBriefFromHook(
  entry: HookVaultEntry,
  current: Pick<GrowthWorkspaceInput, 'audience' | 'channel'>,
): GrowthWorkspaceInput {
  const shortPattern = entry.pattern.length > 104 ? `${entry.pattern.slice(0, 103).trimEnd()}…` : entry.pattern;
  const rightsLabel = entry.rightsStatus === 'owned'
    ? 'owned material'
    : entry.rightsStatus === 'public-reference'
      ? 'public reference; do not copy assets or wording'
      : 'rights unknown; reference only until reviewed';
  return {
    releaseName: `Идея: ${shortPattern}`,
    releaseSummary: `Адаптировать паттерн «${entry.pattern}» к реальному результату Eclipse Forge. Не копировать исходный текст, визуал или обещания; сначала выбрать собственный доказуемый кейс.`,
    audience: current.audience,
    channel: current.channel,
    sourceUrls: [entry.sourceUrl],
    evidenceNotes: `Источник: ${entry.sourceUrl}\nАвтор: ${entry.author}\nДата: ${entry.capturedAt}\nПрава: ${rightsLabel}\nРедакторская заметка: ${entry.note}\nСтатус: это идея для brief, а не подтверждение результата.`,
  };
}
