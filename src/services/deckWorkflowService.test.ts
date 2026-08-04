import { describe, expect, it } from 'vitest';
import {
  addDeckSlide,
  approveDeckJob,
  createDeckJob,
  markDeckReady,
  moveDeckSlide,
  removeDeckSlide,
  serializeDeckJob,
  updateDeckSlide,
  type DeckInput,
} from './deckWorkflowService';

const INPUT: DeckInput = {
  title: 'Eclipse Library release',
  objective: 'Показать, как безопасный каталог экономит время команды',
  audience: 'Владельцы AI-продуктов',
  format: 'project-recap',
  sourceText: 'Каталог хранит структурированные записи. Каждый ресурс имеет evidence и статус лицензии. Агентский export запрещает прямую установку.',
  evidenceUrls: ['https://library.eclipse-forge.ru/', 'https://github.com/PavelHopson/eclipse-library'],
};

describe('deck workflow service', () => {
  it('creates an editable fail-closed deck job', () => {
    const job = createDeckJob(INPUT, new Date('2026-08-04T10:00:00Z'), 'deck-1');
    expect(job.schemaVersion).toBe('deck.job.v1');
    expect(job.slides.length).toBeGreaterThanOrEqual(4);
    expect(job.policy).toEqual({
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      autoPublishAllowed: false,
      pptxRendered: false,
    });
    expect(serializeDeckJob(job)).not.toContain('apiKey');
  });

  it('supports editing, ordering, adding and removing slides', () => {
    let job = createDeckJob(INPUT, new Date('2026-08-04T10:00:00Z'), 'deck-2');
    const secondId = job.slides[1].id;
    job = updateDeckSlide(job, secondId, { title: 'Проверенная ценность', bullets: ['Экономит время на первичном аудите'] });
    expect(job.slides[1].title).toBe('Проверенная ценность');
    job = moveDeckSlide(job, secondId, 1);
    expect(job.slides[2].id).toBe(secondId);
    const count = job.slides.length;
    job = addDeckSlide(job);
    expect(job.slides).toHaveLength(count + 1);
    job = removeDeckSlide(job, job.slides.at(-1)!.id);
    expect(job.slides).toHaveLength(count);
  });

  it('requires review and the complete human approval checklist', () => {
    let job = createDeckJob(INPUT, new Date('2026-08-04T10:00:00Z'), 'deck-3');
    expect(() => approveDeckJob(job, { claimsVerified: true, rightsConfirmed: true, finalReviewComplete: true })).toThrow('Сначала');
    job = markDeckReady(job);
    expect(() => approveDeckJob(job, { claimsVerified: true, rightsConfirmed: false, finalReviewComplete: true })).toThrow('Подтвердите');
    job = approveDeckJob(job, { claimsVerified: true, rightsConfirmed: true, finalReviewComplete: true });
    expect(job.status).toBe('approved');
    expect(() => updateDeckSlide(job, job.slides[0].id, { title: 'Изменено' })).toThrow('нельзя менять');
  });

  it('rejects unsafe links and oversized source lists', () => {
    expect(() => createDeckJob({ ...INPUT, evidenceUrls: ['http://example.com'] })).toThrow('HTTPS');
    expect(() => createDeckJob({ ...INPUT, evidenceUrls: ['https://user:pass@example.com'] })).toThrow('логином');
    expect(() => createDeckJob({ ...INPUT, evidenceUrls: Array.from({ length: 13 }, (_, index) => `https://example.com/${index}`) })).toThrow('12');
  });
  it('rejects oversized identifiers and evidence links', () => {
    expect(() => createDeckJob(INPUT, new Date(), 'x'.repeat(97))).toThrow('ID deck job');
    expect(() => createDeckJob({ ...INPUT, evidenceUrls: ['https://example.com/' + 'x'.repeat(500)] })).toThrow('слишком длинная');
  });

  it('keeps generated bullets schema-bounded and rejects an empty slide', () => {
    let job = createDeckJob({ ...INPUT, sourceText: 'Очень длинный проверяемый факт '.repeat(100) }, new Date(), 'deck-4');
    expect(Math.max(...job.slides.flatMap((slide) => slide.bullets.map((bullet) => bullet.length)))).toBeLessThanOrEqual(500);
    expect(() => updateDeckSlide(job, job.slides[1].id, { bullets: [] })).toThrow('хотя бы один тезис');
  });
});
