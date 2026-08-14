import { describe, expect, it } from 'vitest';
import {
  buildGrowthBriefFromHook,
  createHookVaultEntry,
  MAX_HOOK_VAULT_BYTES,
  parseHookVault,
  serializeHookVault,
  type HookVaultDraft,
} from './hookVaultService';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const DRAFT: HookVaultDraft = {
  pattern: 'Показать проблему, исправление и проверяемый результат',
  sourceUrl: 'https://example.com/case#fragment',
  author: 'Public author',
  capturedAt: '2026-08-13',
  rightsStatus: 'public-reference',
  note: 'Использовать только структуру рассказа, без копирования текста и визуала.',
};

describe('hook vault service', () => {
  it('normalizes a bounded local entry and strips URL fragments', () => {
    const entry = createHookVaultEntry(DRAFT, NOW, 'hook-1');
    expect(entry).toMatchObject({
      schemaVersion: 'growth.hook.v1',
      id: 'hook-1',
      sourceUrl: 'https://example.com/case',
      rightsStatus: 'public-reference',
    });
  });

  it('rejects credentials, non-HTTPS sources, future dates and bidi controls', () => {
    expect(() => createHookVaultEntry({ ...DRAFT, sourceUrl: 'http://example.com' }, NOW)).toThrow('HTTPS');
    expect(() => createHookVaultEntry({ ...DRAFT, sourceUrl: 'https://user:pass@example.com' }, NOW)).toThrow('credentials');
    expect(() => createHookVaultEntry({ ...DRAFT, capturedAt: '2026-08-15' }, NOW)).toThrow('будущем');
    expect(() => createHookVaultEntry({ ...DRAFT, note: 'Нормальная заметка\u202e с подменой' }, NOW)).toThrow('безопасных');
  });

  it('treats localStorage as untrusted and drops corrupt or duplicate entries', () => {
    const entry = createHookVaultEntry(DRAFT, NOW, 'hook-1');
    const corrupt = { ...entry, sourceUrl: 'javascript:alert(1)' };
    const unknownField = { ...entry, injected: true };
    expect(parseHookVault(JSON.stringify([entry, entry, corrupt, unknownField]), NOW)).toEqual([entry]);
    expect(parseHookVault('{', NOW)).toEqual([]);
    expect(parseHookVault('x'.repeat(MAX_HOOK_VAULT_BYTES + 1), NOW)).toEqual([]);
  });

  it('builds a reviewable brief without granting publication or copying authority', () => {
    const entry = createHookVaultEntry(DRAFT, NOW, 'hook-1');
    const brief = buildGrowthBriefFromHook(entry, { audience: 'Основатели AI-продуктов', channel: 'telegram' });
    expect(brief.sourceUrls).toEqual(['https://example.com/case']);
    expect(brief.releaseSummary).toMatch(/Не копировать/);
    expect(brief.evidenceNotes).toMatch(/идея для brief, а не подтверждение результата/);
    expect(serializeHookVault([entry])).not.toContain('apiKey');
  });
});
