export type BuilderTemplate = 'landing' | 'dashboard' | 'catalog';
export type BuilderProjectStatus = 'draft' | 'ready_for_review' | 'approved';

export interface BuilderInput {
  name: string;
  audience: string;
  problem: string;
  primaryAction: string;
  template: BuilderTemplate;
  requirements: string[];
}

export interface BuilderRoute {
  path: string;
  label: string;
  purpose: string;
}

export interface BuilderSection {
  id: string;
  label: string;
  purpose: string;
}

export interface BuilderQueueItem {
  id: string;
  title: string;
  outcome: string;
  status: 'ready' | 'blocked';
  gate: string | null;
}

export interface BuilderApprovalChecklist {
  requirementsConfirmed: boolean;
  securityBoundaryConfirmed: boolean;
  previewReviewed: boolean;
}

export interface BuilderProject {
  schemaVersion: 'builder.project.v1';
  id: string;
  status: BuilderProjectStatus;
  createdAt: string;
  updatedAt: string;
  input: BuilderInput;
  blueprint: {
    routes: BuilderRoute[];
    sections: BuilderSection[];
    states: string[];
    entities: string[];
    design: {
      density: 'balanced';
      accent: '#6BA3FF';
      radius: 'medium';
      fontStack: 'system';
    };
  };
  preview: {
    eyebrow: string;
    headline: string;
    supportingText: string;
    actionLabel: string;
    proofPoints: string[];
  };
  buildQueue: BuilderQueueItem[];
  policy: {
    externalActions: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
    generatedCodeExecuted: false;
    githubConnected: false;
    deployAllowed: false;
    paymentsAllowed: false;
  };
  approval: null | BuilderApprovalChecklist & { approvedAt: string };
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const HIGH_CONFIDENCE_SECRET = /(?:AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const MAX_INPUT_BYTES = 16 * 1024;

function cleanText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error(`${field}: нужно от ${min} до ${max} символов без управляющих символов`);
  }
  if (HIGH_CONFIDENCE_SECRET.test(normalized)) {
    throw new Error(`${field}: похоже, здесь есть секрет или API-ключ. Удалите его перед продолжением`);
  }
  return normalized;
}

export function validateBuilderInput(input: BuilderInput): BuilderInput {
  if (!['landing', 'dashboard', 'catalog'].includes(input.template)) {
    throw new Error('Выберите один из поддерживаемых типов приложения');
  }
  if (input.requirements.length > 8) {
    throw new Error('Оставьте не больше восьми обязательных требований');
  }

  const normalized: BuilderInput = {
    name: cleanText(input.name, 'Название', 3, 80),
    audience: cleanText(input.audience, 'Пользователи', 5, 160),
    problem: cleanText(input.problem, 'Проблема', 20, 600),
    primaryAction: cleanText(input.primaryAction, 'Главное действие', 3, 80),
    template: input.template,
    requirements: [...new Set(input.requirements.filter(Boolean).map((item) => cleanText(item, 'Требование', 3, 240)))],
  };

  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_INPUT_BYTES) {
    throw new Error('Brief превышает безопасный лимит 16 КБ');
  }
  return normalized;
}

const TEMPLATE_BLUEPRINTS: Record<BuilderTemplate, {
  eyebrow: string;
  routes: BuilderRoute[];
  sections: BuilderSection[];
  entities: string[];
  proofPoints: string[];
}> = {
  landing: {
    eyebrow: 'Новый продукт',
    routes: [{ path: '/', label: 'Главная', purpose: 'Объяснить ценность и привести к одному действию' }],
    sections: [
      { id: 'hero', label: 'Первый экран', purpose: 'Проблема, ценность и главное действие' },
      { id: 'proof', label: 'Доказательства', purpose: 'Факты, кейсы и ограничения' },
      { id: 'how-it-works', label: 'Как это работает', purpose: 'Три коротких шага без жаргона' },
      { id: 'final-action', label: 'Следующий шаг', purpose: 'Повторить одно понятное действие' },
    ],
    entities: ['Lead', 'Evidence item', 'Conversion event'],
    proofPoints: ['Понятная ценность', 'Проверяемые доказательства', 'Одно главное действие'],
  },
  dashboard: {
    eyebrow: 'Рабочее пространство',
    routes: [
      { path: '/', label: 'Обзор', purpose: 'Показать статус и ближайшее действие' },
      { path: '/activity', label: 'Активность', purpose: 'Дать прозрачную историю изменений' },
      { path: '/settings', label: 'Настройки', purpose: 'Хранить редкие и безопасные параметры' },
    ],
    sections: [
      { id: 'summary', label: 'Состояние', purpose: 'Главный результат и проблемы' },
      { id: 'next-action', label: 'Следующее действие', purpose: 'Одна очевидная кнопка' },
      { id: 'recent-work', label: 'Последние изменения', purpose: 'Короткий проверяемый журнал' },
    ],
    entities: ['Workspace', 'Activity event', 'User preference'],
    proofPoints: ['Статус без поиска', 'Прозрачная история', 'Безопасные настройки'],
  },
  catalog: {
    eyebrow: 'Каталог',
    routes: [
      { path: '/', label: 'Все записи', purpose: 'Поиск, фильтры и понятные карточки' },
      { path: '/item/:id', label: 'Карточка', purpose: 'Полное описание и ограничения' },
      { path: '/saved', label: 'Сохранённое', purpose: 'Вернуться к выбранным материалам' },
    ],
    sections: [
      { id: 'search', label: 'Поиск', purpose: 'Найти результат по обычным словам' },
      { id: 'filters', label: 'Фильтры', purpose: 'Сузить выбор без перегрузки' },
      { id: 'results', label: 'Результаты', purpose: 'Сравнить ключевые свойства за три секунды' },
    ],
    entities: ['Catalog item', 'Category', 'Saved item'],
    proofPoints: ['Быстрый поиск', 'Понятные фильтры', 'Полные карточки'],
  },
};

function createBuildQueue(): BuilderQueueItem[] {
  return [
    { id: 'brief', title: 'Проверить brief', outcome: 'Цель, аудитория и главное действие согласованы', status: 'ready', gate: null },
    { id: 'interface', title: 'Собрать интерфейс', outcome: 'Responsive экран со всеми обязательными состояниями', status: 'blocked', gate: 'Сначала утвердите этот план' },
    { id: 'data', title: 'Спроектировать данные', outcome: 'Контракты, validation и ownership без секретов в клиенте', status: 'blocked', gate: 'Нужен отдельный architecture review' },
    { id: 'security', title: 'Проверить безопасность', outcome: 'AuthZ, input boundaries, dependencies и abuse cases', status: 'blocked', gate: 'Нужен security review' },
    { id: 'quality', title: 'Прогнать качество', outcome: 'Typecheck, tests, build, desktop и mobile QA', status: 'blocked', gate: 'Нужна реализованная версия' },
    { id: 'publish', title: 'Подготовить публикацию', outcome: 'Reviewable diff, rollback и явное подтверждение', status: 'blocked', gate: 'Deploy в этом модуле запрещён' },
  ];
}

export function createBuilderProject(
  input: BuilderInput,
  now = new Date(),
  id: string = crypto.randomUUID(),
): BuilderProject {
  const normalized = validateBuilderInput(input);
  const projectId = cleanText(id, 'ID проекта', 1, 96);
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error('ID проекта может содержать только латинские буквы, цифры, дефис и подчёркивание');
  }
  const template = TEMPLATE_BLUEPRINTS[normalized.template];
  const timestamp = now.toISOString();

  return {
    schemaVersion: 'builder.project.v1',
    id: projectId,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    input: normalized,
    blueprint: {
      routes: template.routes.map((route) => ({ ...route })),
      sections: template.sections.map((section) => ({ ...section })),
      states: ['loading', 'empty', 'error', 'success', 'disabled', 'no-access'],
      entities: [...template.entities],
      design: { density: 'balanced', accent: '#6BA3FF', radius: 'medium', fontStack: 'system' },
    },
    preview: {
      eyebrow: template.eyebrow,
      headline: normalized.name,
      supportingText: normalized.problem,
      actionLabel: normalized.primaryAction,
      proofPoints: [...template.proofPoints],
    },
    buildQueue: createBuildQueue(),
    policy: {
      externalActions: false,
      toolsAllowed: false,
      sourceContentTrusted: false,
      generatedCodeExecuted: false,
      githubConnected: false,
      deployAllowed: false,
      paymentsAllowed: false,
    },
    approval: null,
  };
}

export function markBuilderReady(project: BuilderProject, now = new Date()): BuilderProject {
  if (project.status === 'approved') throw new Error('Утверждённый план нельзя перевести назад в review');
  return { ...project, status: 'ready_for_review', updatedAt: now.toISOString(), approval: null };
}

export function approveBuilderProject(
  project: BuilderProject,
  checklist: BuilderApprovalChecklist,
  now = new Date(),
): BuilderProject {
  if (project.status !== 'ready_for_review') throw new Error('Сначала подготовьте план к проверке');
  if (!checklist.requirementsConfirmed || !checklist.securityBoundaryConfirmed || !checklist.previewReviewed) {
    throw new Error('Подтвердите требования, границы безопасности и preview');
  }
  return {
    ...project,
    status: 'approved',
    updatedAt: now.toISOString(),
    buildQueue: project.buildQueue.map((item) => item.id === 'interface'
      ? { ...item, status: 'ready', gate: null }
      : item),
    approval: { ...checklist, approvedAt: now.toISOString() },
  };
}

export function serializeBuilderProject(project: BuilderProject): string {
  return JSON.stringify(project, null, 2);
}
