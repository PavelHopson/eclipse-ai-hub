import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clipboard, FilePenLine, Loader2, LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import { completeWithConfig, getConfig } from '../services/aiService';
import { buildEditorPrompts, parseEditorResult, validateEditorBrief, type EditorBrief, type EditorMode, type EditorResult } from '../services/editorStylistService';
import { PROVIDERS } from '../types';

const MODES: Array<{ id: EditorMode; label: string; description: string }> = [
  { id: 'senior-editor', label: 'Редактор', description: 'Прояснить логику и убрать повторы' },
  { id: 'live-author', label: 'Живой автор', description: 'Естественный ритм без имитации личности' },
  { id: 'anti-ai', label: 'Убрать AI-паттерны', description: 'Меньше шаблонов и машинной гладкости' },
  { id: 'expert-copywriter', label: 'Копирайтер', description: 'Усилить конкретику и понятный CTA' },
];

const EMPTY_BRIEF: EditorBrief = {
  sourceText: '', audience: 'Разработчики и владельцы digital-продуктов', channel: 'Telegram',
  purpose: 'Понятно объяснить ценность обновления',
  brandVoice: 'Прямо, спокойно и доказательно. Без рекламной воды, ложной срочности и неподтверждённых обещаний.',
  lockedFacts: [], mode: 'senior-editor',
};

export const EditorStylist: React.FC = () => {
  const config = getConfig();
  const provider = PROVIDERS[config.provider] ?? PROVIDERS.ollama;
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [factsText, setFactsText] = useState('');
  const [result, setResult] = useState<EditorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const missingKey = provider.needsKey && !config.apiKey.trim();
  const unsafeModel = /abliterated|uncensored|huihui/i.test(config.model);
  const facts = useMemo(() => factsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), [factsText]);

  const patchBrief = <K extends keyof EditorBrief>(key: K, value: EditorBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value })); setResult(null); setConfirmed(false);
  };

  const generate = async () => {
    if (loading || missingKey || unsafeModel) return;
    setError(''); setResult(null); setConfirmed(false);
    const currentBrief = { ...brief, lockedFacts: facts };
    try {
      validateEditorBrief(currentBrief); setLoading(true);
      const prompts = buildEditorPrompts(currentBrief);
      setResult(parseEditorResult(await completeWithConfig(config, prompts.system, prompts.user), facts));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось обработать текст.'); }
    finally { setLoading(false); }
  };

  const copyResult = async () => {
    if (!result || !confirmed) return;
    try { await navigator.clipboard.writeText(result.finalText); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Браузер не разрешил копирование. Выделите текст вручную.'); }
  };

  const reset = () => { setBrief(EMPTY_BRIEF); setFactsText(''); setResult(null); setConfirmed(false); setError(''); };

  return <div className="min-h-full p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent"><Sparkles size={15} /> Editor Stylist</div><h1 className="text-2xl font-bold text-white sm:text-3xl">Сделайте текст живым, не меняя факты</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Вставьте черновик, зафиксируйте важные формулировки и получите редактуру с отчётом об изменениях. Копирование открывается только после вашей проверки.</p></div>
      <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300"><LockKeyhole size={14} /> Без автопубликации</div>
    </header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="hub-card space-y-5 p-5 sm:p-6" aria-labelledby="editor-brief-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Шаг 1</p><h2 id="editor-brief-title" className="mt-1 text-lg font-semibold text-white">Дайте редактору контекст</h2></div><button type="button" onClick={reset} className="hub-btn-ghost flex items-center gap-1.5 text-xs"><RotateCcw size={13} /> Очистить</button></div>
        <div className="grid gap-2 sm:grid-cols-2">{MODES.map((mode) => <button key={mode.id} type="button" onClick={() => patchBrief('mode', mode.id)} aria-pressed={brief.mode === mode.id} className={`rounded-lg border p-3 text-left transition-colors ${brief.mode === mode.id ? 'border-hub-accent bg-hub-accent/10' : 'border-hub-border bg-hub-surface hover:border-hub-accent/40'}`}><span className="block text-sm font-medium text-white">{mode.label}</span><span className="mt-1 block text-xs leading-5 text-gray-400">{mode.description}</span></button>)}</div>
        <label className="block text-sm text-gray-300">Исходный текст<textarea value={brief.sourceText} onChange={(event) => patchBrief('sourceText', event.target.value)} rows={9} placeholder="Вставьте черновик публикации, страницы или письма…" className="hub-input mt-2 resize-y" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-gray-300">Для кого<input value={brief.audience} onChange={(event) => patchBrief('audience', event.target.value)} className="hub-input mt-2" /></label>
          <label className="text-sm text-gray-300">Канал<select value={brief.channel} onChange={(event) => patchBrief('channel', event.target.value)} className="hub-input mt-2"><option>Telegram</option><option>Сайт</option><option>VK</option><option>Email</option><option>Презентация</option><option>Коммерческое предложение</option></select></label>
          <label className="text-sm text-gray-300 sm:col-span-2">Цель<input value={brief.purpose} onChange={(event) => patchBrief('purpose', event.target.value)} className="hub-input mt-2" /></label>
          <label className="text-sm text-gray-300 sm:col-span-2">Голос бренда<textarea value={brief.brandVoice} onChange={(event) => patchBrief('brandVoice', event.target.value)} rows={2} className="hub-input mt-2 resize-y" /></label>
          <label className="text-sm text-gray-300 sm:col-span-2">Факты, которые нельзя менять <span className="text-gray-500">— по одному в строке</span><textarea value={factsText} onChange={(event) => { setFactsText(event.target.value); setResult(null); setConfirmed(false); }} rows={3} placeholder={'Например: 610 структурированных записей\nБез автоматической установки'} className="hub-input mt-2 resize-y" /></label>
        </div>
        {(missingKey || unsafeModel) && <div role="alert" className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-200"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{missingKey ? 'Добавьте API-ключ выбранного provider в настройках.' : 'Для доказательной редактуры выберите обычную instruct-модель.'}</span></div>}
        <button type="button" onClick={generate} disabled={loading || missingKey || unsafeModel || brief.sourceText.trim().length < 20} className="hub-btn flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Loader2 size={16} className="animate-spin" /> : <FilePenLine size={16} />}{loading ? 'Редактируем…' : 'Отредактировать и проверить факты'}</button>
        <p className="text-xs leading-5 text-gray-500">Не вставляйте секреты и персональные данные: текст отправляется выбранному AI provider, если вы не используете локальную Ollama.</p>
      </section>
      <section className="hub-card flex min-h-[560px] flex-col p-5 sm:p-6" aria-labelledby="editor-result-title">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Шаг 2</p><h2 id="editor-result-title" className="mt-1 text-lg font-semibold text-white">Проверьте результат</h2></div>
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300">{error}</div>}
        {!result && !error && <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><FilePenLine size={34} className="mb-3 text-gray-600" /><p className="text-sm text-gray-400">Готовый текст и проверка locked facts появятся здесь.</p></div>}
        {result && <><div className={`mt-4 rounded-lg border p-3 ${result.reviewRequired ? 'border-amber-400/25 bg-amber-400/5 text-amber-200' : 'border-emerald-400/25 bg-emerald-400/5 text-emerald-300'}`}><div className="flex items-center gap-2 text-sm font-medium">{result.reviewRequired ? <AlertTriangle size={16} /> : <Check size={16} />}{result.reviewRequired ? 'Нужна особая проверка фактов' : 'Locked facts сохранены'}</div>{result.missingLockedFacts.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{result.missingLockedFacts.map((fact) => <li key={fact}>Не найдено: {fact}</li>)}</ul>}</div>
          <div className="mt-4 flex-1 whitespace-pre-wrap rounded-lg border border-hub-border bg-black/15 p-4 text-sm leading-6 text-gray-200">{result.finalText}</div>
          {result.changeSummary.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Что изменено</p><ul className="mt-2 space-y-1 text-xs leading-5 text-gray-400">{result.changeSummary.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-hub-border p-3 text-sm text-gray-300"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Я сверил факты, ссылки, числа и принимаю финальную формулировку.</span></label>
          <button type="button" onClick={copyResult} disabled={!confirmed} className="hub-btn mt-3 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"><Clipboard size={15} />{copied ? 'Скопировано' : 'Скопировать подтверждённый текст'}</button></>}
      </section>
    </div>
  </div></div>;
};
