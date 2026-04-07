import React, { useState } from 'react';
import { Code, Play, Loader2, Copy, Check } from 'lucide-react';
import { complete } from '../services/aiService';

const SYSTEM_PROMPT =
  'Ты — старший code reviewer. Проанализируй код: найди баги, уязвимости, антипаттерны. Предложи улучшения. Ответь на русском.';

export const CodeReview: React.FC = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleReview = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setReview('');
    setError('');

    try {
      const userPrompt = `Язык: ${language}\n\n\`\`\`${language}\n${code.trim()}\n\`\`\``;
      const result = await complete(SYSTEM_PROMPT, userPrompt);
      setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при запросе к AI');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const LANGUAGES = [
    'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'php', 'c++', 'sql', 'other',
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <Code size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Code Review</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400">Код для ревью</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="hub-input w-auto text-xs py-1.5 px-3"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Вставьте код для анализа..."
              className="hub-input font-mono text-xs resize-none flex-1 min-h-[300px]"
              spellCheck={false}
            />
            <button
              onClick={handleReview}
              disabled={!code.trim() || loading}
              className="hub-btn mt-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {loading ? 'Анализ...' : 'Запустить ревью'}
            </button>
          </div>

          {/* Output panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400">Результат</label>
              {review && (
                <button onClick={handleCopy} className="hub-btn-ghost text-xs flex items-center gap-1">
                  {copied ? <><Check size={12} className="text-green-400" /> Скопировано</> : <><Copy size={12} /> Копировать</>}
                </button>
              )}
            </div>
            <div className="hub-card p-5 flex-1 min-h-[300px] overflow-y-auto">
              {error ? (
                <div className="text-sm text-red-400">{error}</div>
              ) : review ? (
                <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{review}</div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Результат ревью появится здесь
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
