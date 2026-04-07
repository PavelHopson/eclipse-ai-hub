import React, { useState } from 'react';
import { Swords, Send, Loader2 } from 'lucide-react';
import { ProviderBadge } from '../components/ProviderBadge';
import { AIProvider, AIConfig, ArenaResult, PROVIDERS } from '../types';
import { completeWithConfig, getConfig } from '../services/aiService';

/** Build arena configs: current config + all providers with saved keys. */
function getArenaConfigs(): AIConfig[] {
  const primary = getConfig();
  const configs: AIConfig[] = [primary];

  // Try to add different Ollama models
  if (primary.provider === 'ollama') {
    const ollamaModels = PROVIDERS.ollama.models.filter((m) => m !== primary.model);
    for (const model of ollamaModels.slice(0, 1)) {
      configs.push({ ...primary, model });
    }
  }

  // Check for other providers with stored keys
  const providers: AIProvider[] = ['gemini', 'openai', 'anthropic', 'openrouter', 'ollama'];
  for (const p of providers) {
    if (configs.some((c) => c.provider === p)) continue;
    try {
      const raw = localStorage.getItem(`eclipse-hub-arena-${p}`);
      if (raw) {
        const cfg = JSON.parse(raw) as AIConfig;
        if (cfg.apiKey || cfg.provider === 'ollama') {
          configs.push(cfg);
        }
      }
    } catch { /* skip */ }
  }

  return configs.slice(0, 4);
}

export const Arena: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ArenaResult | null>(null);

  const handleRun = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResults(null);

    const configs = getArenaConfigs();
    const systemPrompt = 'Ответь кратко и по существу на вопрос пользователя. Ответь на русском, если вопрос на русском.';

    const settled = await Promise.allSettled(
      configs.map(async (cfg) => {
        const start = performance.now();
        const content = await completeWithConfig(cfg, systemPrompt, prompt.trim());
        const durationMs = Math.round(performance.now() - start);
        return { provider: cfg.provider, model: cfg.model, content, durationMs };
      }),
    );

    const responses = settled
      .filter((r): r is PromiseFulfilledResult<{ provider: AIProvider; model: string; content: string; durationMs: number }> => r.status === 'fulfilled')
      .map((r) => r.value);

    // Include failed ones with error message
    settled.forEach((r, i) => {
      if (r.status === 'rejected') {
        responses.push({
          provider: configs[i].provider,
          model: configs[i].model,
          content: `Ошибка: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
          durationMs: 0,
        });
      }
    });

    setResults({ prompt: prompt.trim(), responses });
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <Swords size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Арена моделей</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Prompt input */}
        <div className="max-w-3xl mx-auto mb-8">
          <label className="text-sm text-gray-400 mb-2 block">Промпт для сравнения</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Введите промпт, который будет отправлен всем моделям..."
            rows={3}
            className="hub-input resize-none mb-3"
          />
          <button
            onClick={handleRun}
            disabled={!prompt.trim() || loading}
            className="hub-btn flex items-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Запрос...' : 'Запустить'}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-sm text-gray-400 mb-4">Результаты</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.responses.map((r, i) => (
                <div key={i} className="hub-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <ProviderBadge provider={r.provider} model={r.model} />
                    <span className="text-xs text-gray-500">{r.durationMs} мс</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && !loading && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-hub-accent/10 flex items-center justify-center mb-4">
              <Swords size={24} className="text-hub-accent" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Сравните модели</h2>
            <p className="text-gray-500 text-sm max-w-md">
              Отправьте один промпт нескольким моделям и сравните скорость и качество ответов.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
