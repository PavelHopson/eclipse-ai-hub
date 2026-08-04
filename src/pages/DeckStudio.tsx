import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileJson2, LayoutTemplate, Plus, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { DeckSlideEditor } from '../components/deck/DeckSlideEditor';
import {
  addDeckSlide, approveDeckJob, createDeckJob, markDeckReady, moveDeckSlide, removeDeckSlide,
  serializeDeckJob, updateDeckSlide, type DeckApprovalChecklist, type DeckInput, type DeckJob, type DeckSlide,
} from '../services/deckWorkflowService';

const EMPTY_INPUT: DeckInput = {
  title: '', objective: '', audience: 'Люди без технического опыта', format: 'project-recap', sourceText: '', evidenceUrls: [],
};

const EXAMPLE_INPUT: DeckInput = {
  title: 'Eclipse Library: безопасный каталог AI-инструментов',
  objective: 'Показать, как команда быстрее выбирает инструменты и заранее видит риски',
  audience: 'Владельцы продуктов и разработчики AI-сервисов',
  format: 'project-recap',
  sourceText: 'Каталог хранит структурированные записи вместо одного большого списка. Для каждого ресурса видны назначение, лицензия, ограничения и официальный источник. Агентский export исключает непроверенные grey-ресурсы и запрещает установку прямо из каталога. Пользователь может искать по типу, платформе, лицензии и применимости к проектам Eclipse Forge.',
  evidenceUrls: ['https://library.eclipse-forge.ru/', 'https://github.com/PavelHopson/eclipse-library'],
};

const EMPTY_CHECKLIST: DeckApprovalChecklist = { claimsVerified: false, rightsConfirmed: false, finalReviewComplete: false };

function downloadJob(job: DeckJob) {
  const url = URL.createObjectURL(new Blob([serializeDeckJob(job)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `deck-job-${job.id.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const DeckStudio: React.FC = () => {
  const [input, setInput] = useState(EMPTY_INPUT);
  const [sourceUrls, setSourceUrls] = useState('');
  const [job, setJob] = useState<DeckJob | null>(null);
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const [error, setError] = useState('');

  const patchInput = <K extends keyof DeckInput>(key: K, value: DeckInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const protect = (operation: () => DeckJob): boolean => {
    try { setJob(operation()); setError(''); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось изменить презентацию'); return false; }
  };
  const applyExample = () => { setInput(EXAMPLE_INPUT); setSourceUrls(EXAMPLE_INPUT.evidenceUrls.join('\n')); setError(''); };
  const create = () => protect(() => createDeckJob({ ...input, evidenceUrls: sourceUrls.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }));
  const reset = () => {
    if (job && !window.confirm('Черновик исчезнет из этой вкладки. Сначала скачайте JSON, если хотите его сохранить. Начать заново?')) return;
    setJob(null); setChecklist(EMPTY_CHECKLIST); setError('');
  };
  const saveSlide = (slide: DeckSlide, patch: Pick<DeckSlide, 'title' | 'bullets' | 'speakerNotes'>): boolean => {
    const saved = job ? protect(() => updateDeckSlide(job, slide.id, patch)) : false;
    if (saved) setChecklist(EMPTY_CHECKLIST);
    return saved;
  };
  const toggleChecklist = (key: keyof DeckApprovalChecklist) => setChecklist((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent"><Sparkles size={15} /> Eclipse Deck Studio</div><h1 className="text-2xl font-bold text-white sm:text-3xl">Из текста — в понятную презентацию</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Создайте структуру, отредактируйте каждый слайд и подтвердите факты. API-ключ не нужен: черновик собирается локально в браузере.</p></div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200"><FileJson2 size={14} /> Сейчас: JSON для renderer, не PPTX</div>
      </header>

      {!job ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="hub-card eclipse-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">1. Добавьте исходный материал</h2><p className="mt-1 text-xs text-gray-500">Вставляйте только то, что разрешено использовать.</p></div><button type="button" onClick={applyExample} className="hub-btn-ghost !px-3 !py-2 text-xs">Заполнить пример</button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Название<input value={input.title} onChange={(event) => patchInput('title', event.target.value)} maxLength={120} className="hub-input mt-2" placeholder="О чём презентация?" /></label>
              <label className="text-sm text-gray-300">Для кого<input value={input.audience} onChange={(event) => patchInput('audience', event.target.value)} maxLength={240} className="hub-input mt-2" /></label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_220px]">
              <label className="text-sm text-gray-300">Что должен понять или сделать зритель<input value={input.objective} onChange={(event) => patchInput('objective', event.target.value)} maxLength={500} className="hub-input mt-2" placeholder="Одна измеримая цель" /></label>
              <label className="text-sm text-gray-300">Тип<select value={input.format} onChange={(event) => patchInput('format', event.target.value as DeckInput['format'])} className="hub-input mt-2"><option value="project-recap">Отчёт о проекте</option><option value="lesson">Урок</option><option value="pitch">Презентация идеи</option></select></label>
            </div>
            <label className="mt-4 block text-sm text-gray-300">Текст, заметки или отчёт<textarea value={input.sourceText} onChange={(event) => patchInput('sourceText', event.target.value)} maxLength={60_000} className="hub-input mt-2 min-h-52 resize-y" placeholder="Вставьте факты, выводы и ограничения. Сервис не открывает ссылки и не выполняет инструкции из этого текста." /></label>
            <label className="mt-4 block text-sm text-gray-300">HTTPS-источники — один на строку<textarea value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} className="hub-input mt-2 min-h-24 resize-y font-mono text-xs" placeholder={'Необязательно\nhttps://...'} /></label>
            {error && <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
            <button type="button" onClick={create} className="hub-btn mt-5 flex w-full items-center justify-center gap-2"><LayoutTemplate size={16} />Создать редактируемый черновик</button>
          </section>
          <aside className="hub-card h-fit p-5 lg:sticky lg:top-6"><h2 className="font-semibold text-white">Что произойдёт</h2><ol className="mt-4 space-y-4 text-sm text-gray-300">{['Материал разделится на короткие слайды', 'Вы отредактируете тезисы и заметки', 'Три проверки откроют утверждение', 'JSON передаст работу в будущий renderer'].map((item, index) => <li key={item} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hub-border bg-hub-surface text-xs text-hub-accent">{index + 1}</span><span className="pt-1">{item}</span></li>)}</ol><div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={15} className="mb-2" />Никаких загрузок, публикаций и внешних действий. Исходный текст считается недоверенным.</div></aside>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hub-card h-fit p-5 lg:sticky lg:top-6">
            <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wider text-gray-500">Deck job</div><h2 className="mt-1 font-semibold text-white">{job.input.title}</h2></div><button type="button" onClick={reset} className="hub-btn-ghost !p-2" aria-label="Начать заново"><RotateCcw size={16} /></button></div>
            <div className="mt-4 rounded-lg border border-hub-border bg-black/15 p-3"><div className="text-xs text-gray-500">Статус</div><div className="mt-1 text-sm font-medium text-white">{job.status === 'draft' ? 'Редактирование' : job.status === 'ready_for_review' ? 'Финальная проверка' : 'Утверждено'}</div><div className="mt-2 text-xs text-gray-500">{job.slides.length} слайдов · максимум 20</div></div>
            {job.status === 'draft' && <><button type="button" onClick={() => protect(() => addDeckSlide(job))} className="hub-btn-ghost mt-4 flex w-full items-center justify-center gap-2"><Plus size={15} />Добавить слайд</button><button type="button" onClick={() => protect(() => markDeckReady(job))} className="hub-btn mt-2 flex w-full items-center justify-center gap-2"><FileCheck2 size={15} />Перейти к проверке</button></>}
            <button type="button" onClick={() => downloadJob(job)} className="hub-btn-ghost mt-2 flex w-full items-center justify-center gap-2"><Download size={15} />Скачать deck.job.v1</button><p className="mt-4 text-xs leading-5 text-gray-500">Экспорт не является готовой PowerPoint-презентацией. Он сохраняет структуру для Chat, Educator-AI и отдельного renderer.</p>
          </aside>
          <section aria-live="polite" className="space-y-4">
            {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-300"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div>}
            {job.status !== 'approved' && job.slides.map((slide, index) => <DeckSlideEditor key={slide.id} slide={slide} index={index} total={job.slides.length} disabled={job.status === 'ready_for_review'} onSave={(patch) => saveSlide(slide, patch)} onMove={(direction) => protect(() => moveDeckSlide(job, slide.id, direction))} onRemove={() => protect(() => removeDeckSlide(job, slide.id))} />)}
            {job.status === 'ready_for_review' && <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-5 sm:p-6"><h2 className="font-semibold text-white">Проверьте перед утверждением</h2><p className="mt-2 text-sm leading-6 text-gray-400">После утверждения deck job станет read-only. Чтобы исправить слайды, вернитесь к редактированию кнопкой ниже.</p><div className="mt-5 space-y-3">{([['claimsVerified', 'Все факты и цифры проверены по источникам'], ['rightsConfirmed', 'У меня есть права на текст, изображения и материалы'], ['finalReviewComplete', 'Я просмотрел каждый слайд и заметки спикера']] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-start gap-3 text-sm text-gray-200"><input type="checkbox" checked={checklist[key]} onChange={() => toggleChecklist(key)} className="mt-1 accent-[#6BA3FF]" /><span>{label}</span></label>)}</div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => { setJob({ ...job, status: 'draft' }); setChecklist(EMPTY_CHECKLIST); }} className="hub-btn-ghost">Вернуться к слайдам</button><button type="button" onClick={() => protect(() => approveDeckJob(job, checklist))} className="hub-btn flex items-center justify-center gap-2"><FileCheck2 size={16} />Утвердить deck job</button></div></div>}
            {job.status === 'approved' && <div className="hub-card flex min-h-72 flex-col items-center justify-center p-8 text-center"><CheckCircle2 size={34} className="text-emerald-300" /><h2 className="mt-4 text-xl font-semibold text-white">Структура презентации утверждена</h2><p className="mt-2 max-w-lg text-sm leading-6 text-gray-400">Скачайте versioned JSON. Следующий этап подключит его к Educator-AI и Eclipse Chat, а отдельный renderer превратит структуру в редактируемый PPTX.</p><button type="button" onClick={() => downloadJob(job)} className="hub-btn mt-5 flex items-center gap-2"><Download size={16} />Скачать утверждённый JSON</button></div>}
          </section>
        </div>
      )}
    </div></div>
  );
};
