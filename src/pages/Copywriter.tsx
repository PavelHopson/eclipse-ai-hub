import React, { useState } from 'react';
import { PenTool, Send, Loader2, Copy, Check, ChevronDown, ChevronUp, Presentation } from 'lucide-react';
import { complete } from '../services/aiService';

const TEMPLATES = [
  { id: 'blog', label: 'Блог-пост' },
  { id: 'social', label: 'Соцсети' },
  { id: 'email', label: 'Email-рассылка' },
  { id: 'landing', label: 'Лендинг' },
  { id: 'seo', label: 'SEO-текст' },
  { id: 'ad', label: 'Рекламный текст' },
  { id: 'presentation', label: '📊 Презентация' },
];

const PRESENTATION_PRESETS = [
  {
    id: 'blueprint',
    label: 'План презентации',
    prompt: 'Act like a professional presentation consultant who has built decks for Fortune 500 boardrooms. Create a complete presentation blueprint for [TOPIC]. Define the objective, target audience, key message, emotional arc, and exact slide flow. Make every section earn its place.',
  },
  {
    id: 'hook',
    label: 'Захват внимания',
    prompt: 'You are a TED Talk opening specialist. Write the first slide and opening 30 seconds of spoken script for a presentation on [TOPIC]. The hook must create immediate tension and promise a payoff they can\'t ignore. No welcome slides. No agenda. Start mid-story.',
  },
  {
    id: 'script',
    label: 'Сценарий слайдов',
    prompt: 'Act like a world-class speechwriter. Write a full slide-by-slide script for [TOPIC] presentation. For each slide give: the headline, 3 bullet points max, the exact words to say out loud, and a transition line that pulls the audience into the next slide.',
  },
  {
    id: 'simplify',
    label: 'Упростить сложное',
    prompt: 'You are a McKinsey partner who makes complex ideas simple. Take [TOPIC] and strip it down to the 3 core ideas that actually matter. Rewrite each one as a single sentence a 12-year-old could understand. Then tell me exactly which parts to cut.',
  },
  {
    id: 'data-story',
    label: 'Визуал из данных',
    prompt: 'Act as a data visualization expert who turns raw numbers into narratives. Topic: [TOPIC]. Rewrite this as a story. Give the headline, the one number that matters most, the implication, and the exact words to say when this slide appears.',
  },
  {
    id: 'objections',
    label: 'Убить возражения',
    prompt: 'You are a debate champion and executive coach. My audience for [TOPIC] will silently object. List the 5 most likely objections they won\'t say out loud. Then write one slide that preemptively destroys each objection before they can form it.',
  },
  {
    id: 'one-slide',
    label: 'Всё в 1 слайд',
    prompt: 'Act as a Chief of Staff briefing a CEO in 90 seconds. Compress [TOPIC] into one slide. Include: the problem in one sentence, the solution in one sentence, the proof in one number, and the single ask. Every word must be load-bearing.',
  },
  {
    id: 'story-arc',
    label: 'Сюжетная арка',
    prompt: 'You are a Hollywood screenwriter consulting for Silicon Valley. Rewrite [TOPIC] as a 3-act story structure. Act 1: the world before. Act 2: the conflict and the turn. Act 3: the world after. Map each act to specific slides. Make the audience feel the stakes.',
  },
];

const TONES = [
  { id: 'professional', label: 'Деловой' },
  { id: 'casual', label: 'Дружеский' },
  { id: 'creative', label: 'Креативный' },
  { id: 'formal', label: 'Формальный' },
  { id: 'expert', label: '🔥 Эксперт' },
];

const EXPERT_SYSTEM_PROMPT = `Ты — копирайтер мирового уровня, сочетающий подходы:
- Naval Ravikant (ясность, мышление первыми принципами, философская глубина)
- Ann Handley (сторителлинг, ориентация на аудиторию, стандарты качества)
- David Ogilvy (убедительный копирайтинг, мастерство заголовков, инсайты на основе исследований)

Принципы:
- Ясность всегда побеждает хитроумность — делай сложные идеи доступными
- Начинай с инсайта, а не с введения — размещай ценность в начале
- Используй конкретные примеры вместо абстрактных концепций
- Не используй рваные предложения. Всегда заканчивай мысль
- Плавно вводи читателя в контекст. Используй меньше тире, вместо тире используй полноценные предложения
- Завершай практическими выводами или заставляющими задуматься вопросами

Проверки: одобрил бы Naval эту ясность? Проходит ли заголовок тест Ogilvy? Есть ли сюжетная арка (стандарт Handley)?`;

export const Copywriter: React.FC = () => {
  const [template, setTemplate] = useState('blog');
  const [tone, setTone] = useState('professional');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    const templateLabel = TEMPLATES.find((t) => t.id === template)?.label ?? template;
    const toneLabel = TONES.find((t) => t.id === tone)?.label ?? tone;

    const systemPrompt = tone === 'expert'
      ? `${EXPERT_SYSTEM_PROMPT}\n\nСгенерируй ${templateLabel} на тему "${topic}". Ответь на русском.`
      : `Ты — профессиональный копирайтер. Сгенерируй ${templateLabel} на тему "${topic}" в стиле "${toneLabel}". Ответь на русском.`;
    const userPrompt = details.trim()
      ? `Тема: ${topic}\nДетали: ${details}\n\nСгенерируй контент типа "${templateLabel}" в стиле "${toneLabel}".`
      : `Тема: ${topic}\n\nСгенерируй контент типа "${templateLabel}" в стиле "${toneLabel}".`;

    try {
      const res = await complete(systemPrompt, userPrompt);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при запросе к AI');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <PenTool size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Копирайтер</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings panel */}
          <div className="space-y-5">
            {/* Template */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Шаблон</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      template === t.id
                        ? 'bg-hub-accent text-white'
                        : 'bg-hub-surface border border-hub-border text-gray-400 hover:text-white hover:border-hub-accent/50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Тон</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      tone === t.id
                        ? 'bg-hub-accent text-white'
                        : 'bg-hub-surface border border-hub-border text-gray-400 hover:text-white hover:border-hub-accent/50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Тема</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="О чем писать..."
                className="hub-input"
              />
            </div>

            {/* Details */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Детали (опционально)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Ключевые слова, целевая аудитория, особые требования..."
                rows={3}
                className="hub-input resize-none"
              />
            </div>

            {/* Presentation presets */}
            {template === 'presentation' && (
              <div>
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-2"
                >
                  <Presentation size={12} />
                  Пресеты для презентаций
                  {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showPresets && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESENTATION_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setDetails(p.prompt.replace(/\[TOPIC\]/g, topic || '[тема]'))}
                        className="text-left text-xs px-2.5 py-2 rounded-lg bg-hub-surface hover:bg-hub-accent/10 text-gray-400 hover:text-white transition-colors border border-hub-border"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || loading}
              className="hub-btn w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Генерация...' : 'Сгенерировать'}
            </button>
          </div>

          {/* Result panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400">Результат</label>
              {result && (
                <button onClick={handleCopy} className="hub-btn-ghost text-xs flex items-center gap-1">
                  {copied ? <><Check size={12} className="text-green-400" /> Скопировано</> : <><Copy size={12} /> Копировать</>}
                </button>
              )}
            </div>
            <div className="hub-card p-5 flex-1 min-h-[400px] overflow-y-auto">
              {error ? (
                <div className="text-sm text-red-400">{error}</div>
              ) : result ? (
                <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{result}</div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <PenTool size={32} className="text-gray-600 mb-3" />
                  <p className="text-gray-500 text-sm">Результат появится здесь</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
