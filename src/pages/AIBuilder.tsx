import React, { useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, Download, FileJson2, Laptop, LockKeyhole,
  RotateCcw, ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react';
import { BuilderFilesPanel } from '../components/builder/BuilderFilesPanel';
import { BuilderPreview } from '../components/builder/BuilderPreview';
import { renderBuilderFiles, type BuilderFilesArtifact } from '../services/builderFileRenderer';
import {
  approveBuilderProject, createBuilderProject, markBuilderReady, serializeBuilderProject,
  type BuilderApprovalChecklist, type BuilderInput, type BuilderProject, type BuilderTemplate,
} from '../services/builderWorkflowService';

const EMPTY_INPUT: BuilderInput = {
  name: '', audience: '', problem: '', primaryAction: '', template: 'landing', requirements: [],
};

const EXAMPLE_INPUT: BuilderInput = {
  name: 'Eclipse Client Portal',
  audience: 'Клиенты небольшой AI-студии',
  problem: 'Клиенты не понимают, на каком этапе находится проект и какое решение требуется от них сейчас.',
  primaryAction: 'Открыть статус проекта',
  template: 'dashboard',
  requirements: ['Работает на телефоне', 'Показывает историю решений', 'Не раскрывает внутренние заметки команды'],
};

const EMPTY_CHECKLIST: BuilderApprovalChecklist = {
  requirementsConfirmed: false, securityBoundaryConfirmed: false, previewReviewed: false,
};

const TEMPLATES: Array<{ id: BuilderTemplate; title: string; description: string }> = [
  { id: 'landing', title: 'Лендинг', description: 'Объяснить ценность и привести к одному действию' },
  { id: 'dashboard', title: 'Кабинет', description: 'Показать статус, историю и ближайшее решение' },
  { id: 'catalog', title: 'Каталог', description: 'Поиск, фильтры и понятные карточки' },
];

function downloadProject(project: BuilderProject) {
  const url = URL.createObjectURL(new Blob([serializeBuilderProject(project)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `builder-project-${project.id.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const AIBuilder: React.FC = () => {
  const [input, setInput] = useState(EMPTY_INPUT);
  const [requirements, setRequirements] = useState('');
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const [filesArtifact, setFilesArtifact] = useState<BuilderFilesArtifact | null>(null);
  const [error, setError] = useState('');

  const patchInput = <K extends keyof BuilderInput>(key: K, value: BuilderInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const protect = (operation: () => BuilderProject) => {
    try { setProject(operation()); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось подготовить план приложения'); }
  };
  const applyExample = () => { setInput(EXAMPLE_INPUT); setRequirements(EXAMPLE_INPUT.requirements.join('\n')); setError(''); };
  const create = () => protect(() => createBuilderProject({
    ...input, requirements: requirements.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
  }));
  const reset = () => {
    if (project && !window.confirm('Текущий план исчезнет из этой вкладки. Сначала скачайте JSON, если хотите его сохранить. Начать заново?')) return;
    setProject(null); setChecklist(EMPTY_CHECKLIST); setFilesArtifact(null); setError(''); setViewport('desktop');
  };
  const toggleChecklist = (key: keyof BuilderApprovalChecklist) => setChecklist((current) => ({ ...current, [key]: !current[key] }));
  const prepareFiles = () => {
    if (!project) return;
    try { setFilesArtifact(renderBuilderFiles(project)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось подготовить файлы'); }
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent"><Sparkles size={15} /> Eclipse AI Builder</div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Из идеи — в понятный план приложения</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Опишите продукт простыми словами. Builder покажет структуру, обязательные состояния, очередь разработки и responsive preview — локально, без API-ключа.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200"><FileJson2 size={14} /> Сейчас: план, preview и файлы — без deploy</div>
      </header>

      {!project ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="hub-card eclipse-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">1. Опишите, что нужно построить</h2><p className="mt-1 text-xs text-gray-500">Не вставляйте пароли, API-ключи и внутренние данные клиентов.</p></div><button type="button" onClick={applyExample} className="hub-btn-ghost min-h-11 !px-3 !py-2 text-xs">Заполнить пример</button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Название<input value={input.name} onChange={(event) => patchInput('name', event.target.value)} maxLength={80} className="hub-input mt-2" placeholder="Например, Eclipse Client Portal" /></label>
              <label className="text-sm text-gray-300">Кто будет пользоваться<input value={input.audience} onChange={(event) => patchInput('audience', event.target.value)} maxLength={160} className="hub-input mt-2" placeholder="Одна конкретная аудитория" /></label>
            </div>
            <label className="mt-4 block text-sm text-gray-300">Какую проблему решаем<textarea value={input.problem} onChange={(event) => patchInput('problem', event.target.value)} maxLength={600} className="hub-input mt-2 min-h-28 resize-y" placeholder="Что сейчас сложно, медленно или непонятно пользователю?" /></label>
            <label className="mt-4 block text-sm text-gray-300">Главное действие пользователя<input value={input.primaryAction} onChange={(event) => patchInput('primaryAction', event.target.value)} maxLength={80} className="hub-input mt-2" placeholder="Например, Проверить статус проекта" /></label>

            <fieldset className="mt-5"><legend className="text-sm text-gray-300">С чего начать</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => patchInput('template', template.id)} aria-pressed={input.template === template.id} className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${input.template === template.id ? 'border-hub-accent bg-hub-accent/10' : 'border-hub-border bg-hub-surface hover:border-gray-500'}`}><span className="flex items-center justify-between text-sm font-semibold text-white">{template.title}{input.template === template.id && <Check size={15} className="text-hub-accent" />}</span><span className="mt-2 block text-xs leading-5 text-gray-500">{template.description}</span></button>)}
            </div></fieldset>

            <label className="mt-5 block text-sm text-gray-300">Обязательные требования — по одному на строку<textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} className="hub-input mt-2 min-h-28 resize-y" placeholder={'Необязательно\nРаботает на телефоне\nПоказывает понятную ошибку'} /></label>
            {error && <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
            <button type="button" onClick={create} className="hub-btn mt-5 flex min-h-11 w-full items-center justify-center gap-2"><Sparkles size={16} />Собрать план приложения</button>
          </section>

          <aside className="hub-card h-fit p-5 lg:sticky lg:top-6"><h2 className="font-semibold text-white">Что вы получите</h2><ol className="mt-4 space-y-4 text-sm text-gray-300">{['Карту экранов и данных', 'Desktop и mobile preview', 'Очередь разработки с блокерами', 'JSON для следующего этапа'].map((item, index) => <li key={item} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hub-accent/30 bg-hub-accent/10 text-xs text-hub-accent">{index + 1}</span><span className="pt-0.5">{item}</span></li>)}</ol><div className="mt-5 flex gap-2 rounded-lg border border-hub-border bg-hub-surface p-3 text-xs leading-5 text-gray-400"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-hub-warning" />Builder не запускает код, не подключает GitHub и не публикует приложение.</div></aside>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-hub-border bg-hub-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div role="status" aria-live="polite"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${project.status === 'approved' ? 'bg-hub-success' : project.status === 'ready_for_review' ? 'bg-hub-warning' : 'bg-hub-accent'}`} /><span className="text-sm font-semibold text-white">{project.status === 'approved' ? 'План утверждён' : project.status === 'ready_for_review' ? 'Нужна ваша проверка' : 'Черновик плана готов'}</span></div><p className="mt-1 text-xs text-gray-500">Approval подтверждает только план. Build, GitHub и deploy остаются выключены.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadProject(project)} className="hub-btn-ghost flex min-h-11 items-center gap-2 !px-3 !py-2"><Download size={15} />Скачать JSON</button><button type="button" onClick={reset} className="hub-btn-ghost flex min-h-11 items-center gap-2 !px-3 !py-2"><RotateCcw size={15} />Новый brief</button></div>
          </div>

          <section className="hub-card p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">2. Проверьте будущий первый экран</h2><p className="mt-1 text-xs text-gray-500">Это безопасный preview структуры, а не запущенный сгенерированный код.</p></div><div className="inline-flex w-fit rounded-lg border border-hub-border bg-hub-bg p-1"><button type="button" onClick={() => setViewport('desktop')} aria-pressed={viewport === 'desktop'} className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-xs ${viewport === 'desktop' ? 'bg-hub-card text-white' : 'text-gray-500'}`}><Laptop size={15} />Desktop</button><button type="button" onClick={() => setViewport('mobile')} aria-pressed={viewport === 'mobile'} className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-xs ${viewport === 'mobile' ? 'bg-hub-card text-white' : 'text-gray-500'}`}><Smartphone size={15} />Mobile</button></div></div>
            <div className="rounded-xl bg-[#080b10] p-3 sm:p-6"><BuilderPreview project={project} viewport={viewport} /></div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="hub-card p-5"><h2 className="font-semibold text-white">3. Посмотрите план и очередь</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Экраны</h3><div className="mt-3 space-y-2">{project.blueprint.routes.map((route) => <div key={route.path} className="rounded-lg border border-hub-border bg-hub-surface p-3"><div className="flex items-center justify-between gap-3 text-sm font-medium text-white"><span>{route.label}</span><code className="text-xs text-hub-accent">{route.path}</code></div><p className="mt-1 text-xs leading-5 text-gray-500">{route.purpose}</p></div>)}</div></div><div><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Обязательные состояния</h3><div className="mt-3 flex flex-wrap gap-2">{project.blueprint.states.map((state) => <span key={state} className="rounded-md border border-hub-border bg-hub-surface px-2.5 py-1.5 text-xs text-gray-300">{state}</span>)}</div><h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-500">Данные</h3><ul className="mt-3 space-y-2 text-sm text-gray-300">{project.blueprint.entities.map((entity) => <li key={entity} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-hub-accent" />{entity}</li>)}</ul></div></div>
              <div className="mt-6 border-t border-hub-border pt-5"><h3 className="text-sm font-semibold text-white">Build queue</h3><div className="mt-3 space-y-3">{project.buildQueue.map((item, index) => <div key={item.id} className="flex gap-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${item.status === 'ready' ? 'bg-hub-success/15 text-hub-success' : 'bg-white/5 text-gray-500'}`}>{item.status === 'ready' ? <Check size={14} /> : index + 1}</span><div><div className="text-sm font-medium text-gray-200">{item.title}</div><p className="mt-0.5 text-xs leading-5 text-gray-500">{item.outcome}</p>{item.gate && <p className="mt-1 text-xs text-amber-300/80">Gate: {item.gate}</p>}</div></div>)}</div></div>
            </section>

            <aside className="hub-card h-fit p-5 lg:sticky lg:top-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-hub-success" /><h2 className="font-semibold text-white">4. Утвердите только план</h2></div><p className="mt-2 text-xs leading-5 text-gray-500">После подтверждения JSON станет reviewable handoff. Никакие внешние действия не включатся.</p>
              {project.status === 'draft' ? <button type="button" onClick={() => protect(() => markBuilderReady(project))} className="hub-btn mt-5 min-h-11 w-full">Подготовить план к проверке</button> : project.status === 'ready_for_review' ? <div className="mt-5 space-y-3">{([
                ['requirementsConfirmed', 'Требования и главное действие сформулированы верно'],
                ['securityBoundaryConfirmed', 'Я понимаю: код, GitHub, payments и deploy выключены'],
                ['previewReviewed', 'Я проверил desktop и mobile preview'],
              ] as Array<[keyof BuilderApprovalChecklist, string]>).map(([key, label]) => <label key={key} className="flex cursor-pointer gap-3 rounded-lg border border-hub-border p-3 text-sm text-gray-300"><input type="checkbox" checked={checklist[key]} onChange={() => toggleChecklist(key)} className="mt-0.5 h-4 w-4 accent-blue-500" /><span>{label}</span></label>)}<button type="button" onClick={() => protect(() => approveBuilderProject(project, checklist))} className="hub-btn min-h-11 w-full">Утвердить план приложения</button></div> : <div className="mt-5 rounded-lg border border-hub-success/25 bg-hub-success/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-hub-success"><CheckCircle2 size={17} />План готов к handoff</div><p className="mt-2 text-xs leading-5 text-gray-400">Теперь можно подготовить reviewable React/Vite-файлы. Они только отображаются и скачиваются как JSON — Builder ничего не записывает и не запускает.</p><button type="button" onClick={prepareFiles} className="hub-btn mt-4 min-h-11 w-full">{filesArtifact ? 'Пересобрать файлы' : 'Подготовить файлы для проверки'}</button>{filesArtifact && <p className="mt-2 text-xs text-hub-success" role="status">Файлы готовы ниже. Проверьте их перед следующим этапом.</p>}</div>}
              {error && <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
            </aside>
          </div>
          {filesArtifact && <BuilderFilesPanel artifact={filesArtifact} />}
        </>
      )}
    </div></div>
  );
};
