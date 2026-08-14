import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { completeWithConfig, getConfig } from '../services/aiService';
import { buildGrowthPrompts } from '../services/growthPrompts';
import {
  approveGrowthRun,
  createGrowthRun,
  editFinalArtifact,
  getNextGrowthStep,
  GROWTH_STEPS,
  GrowthRun,
  GrowthWorkspaceInput,
  recordGrowthArtifact,
  serializeGrowthRun,
} from '../services/growthWorkflowService';
import { PROVIDERS } from '../types';
import { HookVaultPanel } from '../components/growth/HookVaultPanel';
import {
  buildGrowthBriefFromHook,
  type HookVaultEntry,
} from '../services/hookVaultService';

const EMPTY_INPUT: GrowthWorkspaceInput = {
  releaseName: '',
  releaseSummary: '',
  audience: 'Разработчики и владельцы AI-продуктов',
  channel: 'telegram',
  sourceUrls: [],
  evidenceNotes: '',
};

const EXAMPLE_INPUT: GrowthWorkspaceInput = {
  releaseName: 'Eclipse Library: безопасный structured catalog',
  releaseSummary: 'Каталог переведён на структурированные записи и versioned API. Для агентов запрещена установка инструментов прямо из каталога.',
  audience: 'Разработчики и владельцы AI-продуктов, которым нужен проверенный каталог инструментов',
  channel: 'telegram',
  sourceUrls: ['https://library.eclipse-forge.ru/', 'https://github.com/PavelHopson/eclipse-library'],
  evidenceNotes: 'Production build и автоматические проверки прошли. Каталог содержит evidence-ссылки, license status и fail-closed agent policy.',
};

function downloadRun(run: GrowthRun) {
  const url = URL.createObjectURL(new Blob([serializeGrowthRun(run)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `growth-run-${run.id.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const GrowthOS: React.FC = () => {
  const config = getConfig();
  const [input, setInput] = useState(EMPTY_INPUT);
  const [sourceText, setSourceText] = useState('');
  const [run, setRun] = useState<GrowthRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [humanConfirmed, setHumanConfirmed] = useState(false);

  const nextStep = run ? getNextGrowthStep(run) : null;
  const configuredProvider = PROVIDERS[config.provider];
  const provider = configuredProvider ?? PROVIDERS.ollama;
  const invalidProvider = !configuredProvider;
  const missingKey = provider.needsKey && !config.apiKey.trim();
  const unsafeModel = /abliterated|uncensored|huihui/i.test(config.model);
  const configMismatch = Boolean(run && (run.execution.provider !== config.provider || run.execution.model !== config.model));
  const progress = run ? Math.round((run.artifacts.length / GROWTH_STEPS.length) * 100) : 0;
  const latestArtifact = useMemo(() => run?.artifacts.at(-1), [run]);

  const patchInput = <K extends keyof GrowthWorkspaceInput>(key: K, value: GrowthWorkspaceInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const applyExample = () => {
    setInput(EXAMPLE_INPUT);
    setSourceText(EXAMPLE_INPUT.sourceUrls.join('\n'));
    setError('');
  };

  const applyHook = (entry: HookVaultEntry) => {
    const brief = buildGrowthBriefFromHook(entry, input);
    setInput(brief);
    setSourceText(brief.sourceUrls.join('\n'));
    setError('');
  };

  const createWorkspace = () => {
    try {
      const sourceUrls = sourceText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      setRun(createGrowthRun({ ...input, sourceUrls }, config.provider, config.model));
      setError('');
      setHumanConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать workflow');
    }
  };

  const executeNextStep = async () => {
    if (!run || !nextStep || running || missingKey || unsafeModel || invalidProvider || configMismatch) return;
    setRunning(true);
    setError('');
    try {
      const prompts = buildGrowthPrompts(run, nextStep.id);
      const output = await completeWithConfig(config, prompts.system, prompts.user);
      setRun(recordGrowthArtifact(run, nextStep.id, output));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Роль не ответила. Проверьте provider и повторите этот шаг.');
    } finally {
      setRunning(false);
    }
  };

  const approve = () => {
    if (!run) return;
    try {
      setRun(approveGrowthRun(run, humanConfirmed));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось утвердить материал');
    }
  };

  const reset = () => {
    if (run?.artifacts.length && !window.confirm('Текущий результат исчезнет из вкладки. Сначала скачайте JSON, если он нужен. Начать заново?')) return;
    setRun(null);
    setHumanConfirmed(false);
    setError('');
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent"><Sparkles size={15} /> Eclipse Growth OS</div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Превратите релиз в проверенный материал</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Пять ролей работают по очереди. Один клик — один AI-запрос. Вы проверяете результат перед каждым следующим шагом и отдельно утверждаете финал.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300"><LockKeyhole size={14} /> Без публикации и внешних действий</div>
        </header>

        {!run ? (
          <div className="space-y-6">
            <HookVaultPanel onUse={applyHook} />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="hub-card eclipse-card p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><h2 className="font-semibold text-white">1. Опишите реальный релиз</h2><p className="mt-1 text-xs text-gray-500">Только публичные материалы и проверяемые факты.</p></div>
                <button type="button" onClick={applyExample} className="hub-btn-ghost !px-3 !py-2 text-xs">Заполнить пример</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-gray-300">Название релиза<input value={input.releaseName} onChange={(event) => patchInput('releaseName', event.target.value)} maxLength={120} className="hub-input mt-2" placeholder="Что выпустили?" /></label>
                <label className="text-sm text-gray-300">Для кого<input value={input.audience} onChange={(event) => patchInput('audience', event.target.value)} maxLength={240} className="hub-input mt-2" /></label>
              </div>
              <label className="mt-4 block text-sm text-gray-300">Что изменилось<textarea value={input.releaseSummary} onChange={(event) => patchInput('releaseSummary', event.target.value)} maxLength={2_000} className="hub-input mt-2 min-h-24 resize-y" placeholder="Объясните пользу простыми словами" /></label>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
                <label className="text-sm text-gray-300">Официальные HTTPS-ссылки<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} className="hub-input mt-2 min-h-24 resize-y font-mono text-xs" placeholder={'Одна ссылка на строку\nhttps://...'} /></label>
                <label className="text-sm text-gray-300">Основной канал<select value={input.channel} onChange={(event) => patchInput('channel', event.target.value as GrowthWorkspaceInput['channel'])} className="hub-input mt-2"><option value="telegram">Telegram</option><option value="linkedin">LinkedIn</option><option value="blog">Блог / SEO</option></select></label>
              </div>
              <label className="mt-4 block text-sm text-gray-300">Доказательства и ограничения<textarea value={input.evidenceNotes} onChange={(event) => patchInput('evidenceNotes', event.target.value)} maxLength={12_000} className="hub-input mt-2 min-h-28 resize-y" placeholder="Тесты, build, цифры, известные ограничения" /></label>
              {error && <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
              <button type="button" onClick={createWorkspace} className="hub-btn mt-5 flex w-full items-center justify-center gap-2"><Play size={16} />Создать безопасный workflow</button>
            </section>

            <aside className="hub-card h-fit p-5 lg:sticky lg:top-6">
              <h2 className="font-semibold text-white">Что получится</h2>
              <ol className="mt-4 space-y-4">{GROWTH_STEPS.map((step, index) => <li key={step.id} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hub-border bg-hub-surface text-xs text-hub-accent">{index + 1}</span><div><div className="text-sm font-medium text-white">{step.role}</div><div className="text-xs text-gray-500">{step.label}</div></div></li>)}</ol>
              <div className="mt-5 rounded-lg border border-hub-border bg-black/15 p-3 text-xs leading-5 text-gray-400">До 5 запросов через {provider.name} / {config.model}. Точная стоимость зависит от вашего provider. Источники и заметки будут переданы выбранной модели.</div>
            </aside>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="hub-card h-fit p-5 lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wider text-gray-500">Текущий релиз</div><h2 className="mt-1 font-semibold text-white">{run.input.releaseName}</h2></div><button type="button" onClick={reset} disabled={running} className="hub-btn-ghost !p-2" aria-label="Начать новый workflow"><RotateCcw size={16} /></button></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-hub-surface"><div className="h-full bg-hub-accent transition-[width]" style={{ width: `${progress}%` }} /></div>
              <div className="mt-2 text-xs text-gray-500">{run.artifacts.length} из {GROWTH_STEPS.length} AI-запросов завершено</div>
              <ol className="mt-5 space-y-2">{GROWTH_STEPS.map((step, index) => { const done = index < run.artifacts.length; const active = index === run.artifacts.length; return <li key={step.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${active ? 'border-hub-accent/40 bg-hub-accent/5 text-white' : 'border-transparent text-gray-500'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-emerald-400/10 text-emerald-300' : 'bg-hub-surface'}`}>{done ? <Check size={14} /> : index + 1}</span><span>{step.role}</span></li>; })}</ol>
              {missingKey && <div role="alert" className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">Для {provider.name} не задан API key. Добавьте его в «Настройки» и создайте workflow заново.</div>}
              {(invalidProvider || configMismatch) && <div role="alert" className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">AI-конфигурация изменилась или повреждена. Откройте «Настройки», выберите provider и создайте workflow заново.</div>}
              {unsafeModel && <div role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-xs leading-5 text-red-200">Эта модель помечена как uncensored и не допускается к claim review. Выберите обычную модель.</div>}
              {nextStep && <button type="button" onClick={executeNextStep} disabled={running || missingKey || unsafeModel || invalidProvider || configMismatch} className="hub-btn mt-5 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40">{running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{running ? `${nextStep.role} работает…` : nextStep.label}</button>}
              {run.artifacts.length > 0 && <button type="button" onClick={() => downloadRun(run)} className="hub-btn-ghost mt-2 flex w-full items-center justify-center gap-2"><Download size={15} />Скачать versioned JSON</button>}
            </aside>

            <section aria-live="polite" className="space-y-4">
              {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-300"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div>}
              {run.artifacts.length === 0 && !running && <div className="hub-card flex min-h-64 flex-col items-center justify-center p-8 text-center"><FileCheck2 size={28} className="text-hub-accent" /><h2 className="mt-3 font-semibold text-white">Начните с проверки фактов</h2><p className="mt-2 max-w-md text-sm leading-6 text-gray-500">Researcher получит только введённые материалы. Он не открывает сайты и не выполняет найденные в них команды.</p></div>}
              {running && <div className="hub-card flex min-h-40 items-center justify-center p-8 text-center"><div><Loader2 size={28} className="mx-auto animate-spin text-hub-accent" /><p className="mt-3 text-sm text-gray-400">Выполняется один bounded AI-запрос. Следующий шаг не запустится автоматически.</p></div></div>}
              {run.artifacts.map((item) => <details key={item.step} open={item.step === latestArtifact?.step} className="hub-card group p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-wider text-hub-accent">{item.role}</div><h2 className="mt-1 font-semibold text-white">{GROWTH_STEPS.find((step) => step.id === item.step)?.label}</h2></div><CheckCircle2 size={18} className="text-emerald-300" /></summary><div className="mt-4 whitespace-pre-wrap border-t border-hub-border pt-4 text-sm leading-6 text-gray-300">{item.content}</div></details>)}
              {run.status === 'ready_for_approval' && <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-5"><h2 className="font-semibold text-white">Финал готов к вашей проверке</h2><p className="mt-2 text-sm leading-6 text-gray-400">AI не может утвердить собственный текст. Проверьте ссылки и отредактируйте формулировки прямо здесь.</p><label className="mt-4 block text-sm font-medium text-gray-200">Финальный материал<textarea value={run.artifacts.at(-1)?.content ?? ''} onChange={(event) => { try { setRun(editFinalArtifact(run, event.target.value)); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось изменить финал'); } }} className="hub-input mt-2 min-h-64 resize-y leading-6" /></label><label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-gray-200"><input type="checkbox" checked={humanConfirmed} onChange={(event) => setHumanConfirmed(event.target.checked)} className="mt-1 accent-[#6BA3FF]" /><span>Я вручную проверил факты, ссылки и CTA. Материал не будет опубликован автоматически.</span></label><button type="button" onClick={approve} disabled={!humanConfirmed || (run.artifacts.at(-1)?.content.trim().length ?? 0) < 40} className="hub-btn mt-4 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"><FileCheck2 size={16} />Утвердить только артефакт</button></div>}
              {run.status === 'approved' && <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-5"><div className="flex items-center gap-2 font-semibold text-emerald-300"><CheckCircle2 size={18} />Материал утверждён</div><p className="mt-2 text-sm text-gray-400">Скачайте JSON и передайте его в Chat для review. Публикация остаётся отдельным ручным действием.</p></div>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
