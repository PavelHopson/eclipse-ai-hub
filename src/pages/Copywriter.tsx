import React, { useState } from 'react';
import { PenTool, Send, Loader2, Copy, Check, ChevronDown, ChevronUp, Presentation, Wand2, Briefcase } from 'lucide-react';
import { complete } from '../services/aiService';

const TEMPLATES = [
  { id: 'blog', label: 'Блог-пост' },
  { id: 'social', label: 'Соцсети' },
  { id: 'email', label: 'Email-рассылка' },
  { id: 'landing', label: 'Лендинг' },
  { id: 'seo', label: 'SEO-текст' },
  { id: 'ad', label: 'Рекламный текст' },
  { id: 'presentation', label: '📊 Презентация' },
  { id: 'humanize', label: '🔧 Humanize-rewrite' },
  { id: 'resume', label: '💼 Резюме / Найм' },
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

/**
 * Anti-AI-Text — 6 промптов из eclipse-library/prompts/anti-ai-text-6-prompts.md
 * (батч 27.05.2026, Telegram «Не баг, а фича»). Каждый attacks specific
 * AI-почерк pattern; chain (1→4→6) даёт maximum-impact humanize.
 *
 * Использование: пишешь черновик в "Детали", выбираешь preset → берёт
 * подходящий instruction-prompt + appendит твой текст в [TEXT] плейсхолдер.
 */
const HUMANIZE_PRESETS = [
  {
    id: 'cliche',
    label: '1️⃣ Убрать клише',
    prompt: `Never use:\n- Generic introductions\n- Generic conclusions\n- Empty transitions\n- Corporate jargon\n- Motivational filler\n- Overexplaining\n- Predictable sentence patterns\n- Obvious observations\n- Unnecessary context\n- Balanced arguments where evidence clearly favors one side\n\nAlways:\n- Lead with the most important idea\n- Prioritize insight over explanation\n- Prefer specificity over abstraction\n- Use natural sentence variation\n- Include meaningful judgment\n- Challenge assumptions when appropriate\n- Write with conviction\n- Cut anything that does not create value\n- Sound like a person who understands the subject deeply\n\nAfter drafting, review every paragraph and remove anything that feels generated rather than genuinely written. Now write:\n[TEXT]`,
  },
  {
    id: 'position',
    label: '2️⃣ Добавить позицию',
    prompt: `AI often avoids taking positions.\n\nHumans make judgments.\n\nRewrite the text below and introduce thoughtful judgment where appropriate.\n\nYou may:\n- Prioritize certain ideas over others\n- Point out weaknesses\n- Challenge assumptions\n- Express confidence levels\n- Mention trade-offs\n- Show skepticism\n\nDo not become opinionated for the sake of it.\n\nThe goal is to sound like a knowledgeable human evaluating information rather than simply presenting it.\n\nTEXT:\n[TEXT]`,
  },
  {
    id: 'no-water',
    label: '3️⃣ Убрать воду',
    prompt: `Review the text below. For every paragraph, ask:\n"Is this explaining something obvious, or offering a meaningful insight?"\nRemove content that merely explains.\nKeep content that reveals, challenges, questions, compares, or reframes.\nThe final version should contain fewer explanations and more insights.\nReaders should finish the piece feeling they learned something they did not already know.\n\nTEXT:\n[TEXT]`,
  },
  {
    id: 'rhythm',
    label: '4️⃣ Живой ритм',
    prompt: `Most AI writing has a predictable rhythm.\n\nThe sentences are similar lengths.\nThe structure becomes repetitive.\nThe pacing feels mechanical.\n\nRewrite the text using natural human rhythm.\n\nRequirements:\n- Mix short and long sentences\n- Occasionally use fragments\n- Vary paragraph length\n- Avoid repetitive openings\n- Create contrast and momentum\n- Remove anything that feels mechanically optimized\n\nThe writing should feel alive rather than generated.\n\nTEXT:\n[TEXT]`,
  },
  {
    id: 'template-strip',
    label: '5️⃣ Снять шаблоны',
    prompt: `Analyze the text below. Highlight every sentence that could easily appear in thousands of AI-generated articles. For each sentence:\n1. Explain why it feels generic.\n2. Rewrite it with a more original observation.\n3. Increase specificity.\n4. Add a clearer perspective.\nThen provide a fully rewritten version that sounds distinctive and memorable.\n\nTEXT:\n[TEXT]`,
  },
  {
    id: 'conviction',
    label: '6️⃣ Убедительность',
    prompt: `Rewrite this text as if it were written by someone whose reputation depends on being correct.\n\nAvoid:\n- Generic advice\n- Safe observations\n- Obvious statements\n- Neutral commentary\n- Broad claims that apply everywhere\n\nInstead:\n- Prioritize useful insights\n- Include stronger reasoning\n- Focus on what actually matters\n- Eliminate filler\n- Speak with informed conviction\n\nEvery sentence should sound earned rather than generated.\n\nTEXT:\n[TEXT]`,
  },
  {
    id: 'chain-146',
    label: '⛓ Chain 1+4+6 (максимум)',
    prompt: `Apply THREE rewrites in sequence to maximize human-like quality:\n\nSTAGE 1 — Remove AI clichés:\nNever use generic introductions/conclusions, empty transitions, corporate jargon, motivational filler, predictable patterns, obvious observations. Always lead with insight, prefer specificity, include judgment, write with conviction.\n\nSTAGE 2 — Natural rhythm:\nMix short and long sentences. Use fragments occasionally. Vary paragraph length. Avoid repetitive openings. Create contrast. Remove mechanically-optimized openings.\n\nSTAGE 3 — Earned conviction:\nWrite as if your reputation depends on being correct. Eliminate safe observations, neutral commentary, broad claims. Prioritize useful insights, stronger reasoning, what actually matters.\n\nReturn ONLY the final rewritten text after all three stages.\n\nTEXT:\n[TEXT]`,
  },
];

/**
 * Resume Toolkit — 7 промптов из eclipse-library/prompts/resume-toolkit-7.md
 * (батч 28.05–05.06.2026). Полный путь найма: аудит → ATS → опыт-в-результаты →
 * summary → адаптация → сопроводительное → STAR-симулятор собеседования.
 *
 * [RESUME] заменяется на текст из поля «О чём писать». [VACANCY] оставлен
 * литералом — пользователь подставляет описание вакансии в «Детали».
 */
const RESUME_PRESETS = [
  {
    id: 'audit',
    label: '1️⃣ Аудит (10 причин отказа)',
    prompt: `Проанализируй это резюме [RESUME] и перечисли 10 причин, по которым HR отвергнет его за 6 секунд. Для каждой: где ошибка, почему это повод для отказа, исправленная версия. Отсортируй от самой опасной к наименее опасной. Будь беспощаден.`,
  },
  {
    id: 'ats',
    label: '2️⃣ Обход ATS-фильтра',
    prompt: `Моё резюме [RESUME] должно пройти ATS-фильтр для вакансии [VACANCY]. Найди все недостающие ключевые слова, укажи в какой части резюме их естественно добавить, и оцени совместимость до и после правок по шкале 0–100.`,
  },
  {
    id: 'results',
    label: '3️⃣ Опыт → результаты',
    prompt: `Возьми рабочий опыт из резюме [RESUME] и перепиши каждый пункт: вместо описания задач — результат (мощный глагол + конкретное достижение + цифра/влияние). Покажи «до/после» рядом. Если цифр нет — помоги их оценить правильными вопросами.`,
  },
  {
    id: 'summary',
    label: '4️⃣ Цепляющее summary (×5)',
    prompt: `Напиши 5 версий профессионального summary для резюме [RESUME]. Каждая — 3 строки: позиция + конкретный результат + карьерная ориентация. Без клише «амбициозный профессионал». Цель: чтобы читатель сразу сказал «хочу познакомиться».`,
  },
  {
    id: 'tailor',
    label: '5️⃣ Адаптация под вакансию',
    prompt: `Адаптируй резюме [RESUME] под вакансию [VACANCY]. Добавь ключевые слова для ATS, перепиши пункты опыта под требования, сделай summary под целевую позицию, удали лишнее. Дай финальную версию, готовую к отправке.`,
  },
  {
    id: 'cover',
    label: '6️⃣ Сопроводительное письмо',
    prompt: `Проанализируй вакансию [VACANCY] обратным разбором и определи 3 критические потребности компании. Напиши сопроводительное на 200 слов, сопоставив мой опыт [RESUME] с каждой: цепляющее введение, конкретные доказательства результатов, чёткий призыв к собеседованию.`,
  },
  {
    id: 'interview',
    label: '7️⃣ STAR-симулятор',
    prompt: `Проведи собеседование на должность из вакансии [VACANCY]. Задавай 10 вопросов постепенно — поведенческие, технические, сценарные. Я отвечаю, ты оцениваешь каждый 0–10, объясняешь слабые места и показываешь, как переформулировать через STAR. В конце — комплексная оценка и план развития.`,
  },
];

const TONES = [
  { id: 'professional', label: 'Деловой' },
  { id: 'casual', label: 'Дружеский' },
  { id: 'creative', label: 'Креативный' },
  { id: 'formal', label: 'Формальный' },
  { id: 'expert', label: '🔥 Эксперт' },
  { id: 'skeptic', label: '🧐 Скептик' },
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

// Skeptical Verifier — eclipse-library/prompts/skeptical-verifier.md (батч 28.05–05.06.2026).
// Анти-sycophancy режим: модель перепроверяет факты и явно помечает неопределённость.
const SKEPTIC_SYSTEM_PROMPT = `Ты — скептичный эксперт. Режим по умолчанию: проверять, перепроверять, рассуждать от первых принципов.
Правила:
- Считай каждое утверждение (моё И своё) гипотезой для проверки, а не фактом.
- Точность важнее уверенности; доказательства важнее допущений; ясность важнее скорости.
- Где есть неопределённость — явно говори об этом и перечисляй, что нужно для подтверждения.
- Не поддакивай и не разбавляй текст похвалой или водой. Если я неправ — скажи прямо.`;

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
      : tone === 'skeptic'
      ? `${SKEPTIC_SYSTEM_PROMPT}\n\nЗадача: сгенерируй ${templateLabel} на тему "${topic}", критически проверяя факты и помечая неопределённость. Ответь на русском.`
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

            {/* Humanize presets — 27.05.2026 batch / Anti-AI-Text 6 prompts */}
            {template === 'humanize' && (
              <div>
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-2"
                >
                  <Wand2 size={12} />
                  Атаки на AI-почерк (6 + chain)
                  {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showPresets && (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {HUMANIZE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setDetails(p.prompt.replace(/\[TEXT\]/g, topic || '[вставь черновик в поле «О чём писать» выше]'))}
                          className="text-left text-xs px-2.5 py-2 rounded-lg bg-hub-surface hover:bg-hub-accent/10 text-gray-400 hover:text-white transition-colors border border-hub-border"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                      Положи черновик в поле «О чём писать» сверху, нажми preset — он сгенерирует
                      полный инструкцияй-promпт в «Деталях». Chain 1+4+6 — для максимум-impact rewrite.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Resume / hiring presets — 28.05–05.06.2026 batch / Resume Toolkit 7 */}
            {template === 'resume' && (
              <div>
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-2"
                >
                  <Briefcase size={12} />
                  Резюме и найм (7 промптов)
                  {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showPresets && (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {RESUME_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setDetails(p.prompt.replace(/\[RESUME\]/g, topic || '[вставь резюме в поле «О чём писать» выше]'))}
                          className="text-left text-xs px-2.5 py-2 rounded-lg bg-hub-surface hover:bg-hub-accent/10 text-gray-400 hover:text-white transition-colors border border-hub-border"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                      Вставь резюме в поле «О чём писать» сверху, выбери пресет — инструкция попадёт в «Детали».
                      Где нужен текст вакансии — замени [VACANCY] на описание. Источник: resume-toolkit-7.md
                    </p>
                  </>
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
