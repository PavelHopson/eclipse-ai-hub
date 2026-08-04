export type DeckFormat = 'project-recap' | 'lesson' | 'pitch';
export type DeckJobStatus = 'draft' | 'ready_for_review' | 'approved';

export interface DeckInput {
  title: string;
  objective: string;
  audience: string;
  format: DeckFormat;
  sourceText: string;
  evidenceUrls: string[];
}

export interface DeckSlide {
  id: string;
  kind: 'cover' | 'content' | 'evidence' | 'summary';
  title: string;
  bullets: string[];
  speakerNotes: string;
  sourceRefs: string[];
}

export interface DeckApprovalChecklist {
  claimsVerified: boolean;
  rightsConfirmed: boolean;
  finalReviewComplete: boolean;
}

export interface DeckJob {
  schemaVersion: 'deck.job.v1';
  id: string;
  status: DeckJobStatus;
  createdAt: string;
  updatedAt: string;
  input: DeckInput;
  slides: DeckSlide[];
  policy: {
    externalActions: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
    autoPublishAllowed: false;
    pptxRendered: false;
  };
  approval: null | DeckApprovalChecklist & { approvedAt: string };
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_INPUT_BYTES = 96 * 1024;
const MAX_SLIDES = 20;

function cleanText(value: string, field: string, min: number, max: number): string {
  const result = value.trim();
  if (result.length < min || result.length > max || CONTROL_CHARACTERS.test(result)) {
    throw new Error(`${field}: требуется от ${min} до ${max} символов без управляющих символов`);
  }
  return result;
}

function validateEvidenceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`Источник «${raw.slice(0, 60)}» не похож на ссылку`);
  }
  if (url.protocol !== 'https:') throw new Error('Источники должны использовать HTTPS');
  if (url.username || url.password) throw new Error('Ссылки с логином или паролем запрещены');
  url.hash = '';
  if (url.toString().length > 480) throw new Error('Ссылка на источник слишком длинная');
  return url.toString();
}

export function validateDeckInput(input: DeckInput): DeckInput {
  if (!['project-recap', 'lesson', 'pitch'].includes(input.format)) {
    throw new Error('Выберите поддерживаемый тип презентации');
  }
  const normalized: DeckInput = {
    title: cleanText(input.title, 'Название', 3, 120),
    objective: cleanText(input.objective, 'Цель презентации', 10, 500),
    audience: cleanText(input.audience, 'Аудитория', 3, 240),
    format: input.format,
    sourceText: cleanText(input.sourceText, 'Исходный материал', 40, 60_000),
    evidenceUrls: [...new Set(input.evidenceUrls.filter(Boolean).map(validateEvidenceUrl))],
  };
  if (normalized.evidenceUrls.length > 12) throw new Error('Добавьте не больше 12 HTTPS-источников');
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_INPUT_BYTES) {
    throw new Error('Материалы превышают безопасный лимит 96 КБ');
  }
  return normalized;
}

function shortLines(sourceText: string): string[] {
  const lines = sourceText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim().slice(0, 500))
    .filter((line) => line.length >= 12);
  return [...new Set(lines)].slice(0, 24);
}

function groupLines(lines: string[], groupSize = 3): string[][] {
  const groups: string[][] = [];
  for (let index = 0; index < lines.length; index += groupSize) groups.push(lines.slice(index, index + groupSize));
  return groups;
}

function contentTitle(format: DeckFormat, index: number): string {
  const labels: Record<DeckFormat, string[]> = {
    'project-recap': ['Что изменилось', 'Как это работает', 'Что получил пользователь', 'Ограничения и риски'],
    lesson: ['Главная идея', 'Разберём по шагам', 'Пример', 'Проверьте себя'],
    pitch: ['Проблема', 'Решение', 'Ценность', 'Почему сейчас'],
  };
  return labels[format][index] ?? `Ключевая часть ${index + 1}`;
}

function slideId(jobId: string, index: number): string {
  return `${jobId}-slide-${index + 1}`;
}

export function createDeckJob(
  input: DeckInput,
  now = new Date(),
  id: string = crypto.randomUUID(),
): DeckJob {
  const normalized = validateDeckInput(input);
  const jobId = cleanText(id, 'ID deck job', 1, 96);
  const lines = shortLines(normalized.sourceText);
  const groups = groupLines(lines.length ? lines : [normalized.objective]).slice(0, 6);
  const slides: DeckSlide[] = [
    {
      id: slideId(jobId, 0),
      kind: 'cover',
      title: normalized.title,
      bullets: [normalized.objective],
      speakerNotes: `Для кого: ${normalized.audience}`,
      sourceRefs: [],
    },
    ...groups.map((bullets, index): DeckSlide => ({
      id: slideId(jobId, index + 1),
      kind: 'content',
      title: contentTitle(normalized.format, index),
      bullets,
      speakerNotes: 'Объясните этот слайд простыми словами и не добавляйте неподтверждённые факты.',
      sourceRefs: [],
    })),
  ];
  if (normalized.evidenceUrls.length) {
    slides.push({
      id: slideId(jobId, slides.length),
      kind: 'evidence',
      title: 'Источники и доказательства',
      bullets: normalized.evidenceUrls.map((url, index) => `[S${index + 1}] ${url}`),
      speakerNotes: 'Откройте и вручную проверьте каждый источник перед утверждением.',
      sourceRefs: normalized.evidenceUrls.map((_, index) => `S${index + 1}`),
    });
  }
  slides.push({
    id: slideId(jobId, slides.length),
    kind: 'summary',
    title: normalized.format === 'lesson' ? 'Что запомнить' : 'Следующий шаг',
    bullets: [normalized.objective],
    speakerNotes: 'Завершите одним понятным действием для аудитории.',
    sourceRefs: [],
  });
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'deck.job.v1',
    id: jobId,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    input: normalized,
    slides,
    policy: {
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      autoPublishAllowed: false,
      pptxRendered: false,
    },
    approval: null,
  };
}

function validateSlide(slide: DeckSlide): DeckSlide {
  const bullets = slide.bullets.map((item) => cleanText(item, 'Пункт слайда', 2, 500)).slice(0, 8);
  if (bullets.length === 0) throw new Error('Добавьте хотя бы один тезис на слайд');
  return {
    ...slide,
    title: cleanText(slide.title, 'Заголовок слайда', 2, 120),
    bullets,
    speakerNotes: slide.speakerNotes.trim().slice(0, 2_000),
    sourceRefs: [...new Set(slide.sourceRefs.map((item) => item.trim()).filter(Boolean))].slice(0, 12),
  };
}

export function updateDeckSlide(job: DeckJob, slideIdValue: string, patch: Partial<DeckSlide>, now = new Date()): DeckJob {
  if (job.status === 'approved') throw new Error('Утверждённую презентацию нельзя менять');
  const index = job.slides.findIndex((slide) => slide.id === slideIdValue);
  if (index < 0) throw new Error('Слайд не найден');
  const slides = [...job.slides];
  slides[index] = validateSlide({ ...slides[index], ...patch, id: slides[index].id });
  return { ...job, status: 'draft', updatedAt: now.toISOString(), slides, approval: null };
}

export function moveDeckSlide(job: DeckJob, slideIdValue: string, direction: -1 | 1, now = new Date()): DeckJob {
  if (job.status === 'approved') throw new Error('Утверждённую презентацию нельзя менять');
  const index = job.slides.findIndex((slide) => slide.id === slideIdValue);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= job.slides.length) return job;
  const slides = [...job.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...job, status: 'draft', updatedAt: now.toISOString(), slides, approval: null };
}

export function addDeckSlide(job: DeckJob, now = new Date()): DeckJob {
  if (job.status === 'approved') throw new Error('Утверждённую презентацию нельзя менять');
  if (job.slides.length >= MAX_SLIDES) throw new Error(`В одной презентации может быть не больше ${MAX_SLIDES} слайдов`);
  const slide: DeckSlide = {
    id: `${job.id}-slide-${crypto.randomUUID()}`,
    kind: 'content',
    title: 'Новый слайд',
    bullets: ['Добавьте одну понятную мысль'],
    speakerNotes: '',
    sourceRefs: [],
  };
  return { ...job, status: 'draft', updatedAt: now.toISOString(), slides: [...job.slides, slide], approval: null };
}

export function removeDeckSlide(job: DeckJob, slideIdValue: string, now = new Date()): DeckJob {
  if (job.status === 'approved') throw new Error('Утверждённую презентацию нельзя менять');
  if (job.slides.length <= 3) throw new Error('Оставьте минимум три слайда');
  return { ...job, status: 'draft', updatedAt: now.toISOString(), slides: job.slides.filter((slide) => slide.id !== slideIdValue), approval: null };
}

export function markDeckReady(job: DeckJob, now = new Date()): DeckJob {
  if (job.slides.length < 3 || job.slides.length > MAX_SLIDES) throw new Error('Презентация должна содержать от 3 до 20 слайдов');
  const slides = job.slides.map(validateSlide);
  return { ...job, status: 'ready_for_review', updatedAt: now.toISOString(), slides, approval: null };
}

export function approveDeckJob(job: DeckJob, checklist: DeckApprovalChecklist, now = new Date()): DeckJob {
  if (job.status !== 'ready_for_review') throw new Error('Сначала завершите редактирование');
  if (!checklist.claimsVerified || !checklist.rightsConfirmed || !checklist.finalReviewComplete) {
    throw new Error('Подтвердите факты, права на материалы и финальную проверку');
  }
  return { ...job, status: 'approved', updatedAt: now.toISOString(), approval: { ...checklist, approvedAt: now.toISOString() } };
}

export function serializeDeckJob(job: DeckJob): string {
  return JSON.stringify(job, null, 2);
}
