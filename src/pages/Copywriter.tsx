import React, { useState } from 'react';
import { PenTool, Send, Loader2, Copy, Check } from 'lucide-react';
import { complete } from '../services/aiService';

const TEMPLATES = [
  { id: 'blog', label: 'Блог-пост' },
  { id: 'social', label: 'Соцсети' },
  { id: 'email', label: 'Email-рассылка' },
  { id: 'landing', label: 'Лендинг' },
  { id: 'seo', label: 'SEO-текст' },
  { id: 'ad', label: 'Рекламный текст' },
];

const TONES = [
  { id: 'professional', label: 'Деловой' },
  { id: 'casual', label: 'Дружеский' },
  { id: 'creative', label: 'Креативный' },
  { id: 'formal', label: 'Формальный' },
];

export const Copywriter: React.FC = () => {
  const [template, setTemplate] = useState('blog');
  const [tone, setTone] = useState('professional');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    const templateLabel = TEMPLATES.find((t) => t.id === template)?.label ?? template;
    const toneLabel = TONES.find((t) => t.id === tone)?.label ?? tone;

    const systemPrompt = `Ты — профессиональный копирайтер. Сгенерируй ${templateLabel} на тему "${topic}" в стиле "${toneLabel}". Ответь на русском.`;
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
