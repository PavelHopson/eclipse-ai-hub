import React, { useState } from 'react';
import { Shield, Play, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { complete } from '../services/aiService';

const SYSTEM_PROMPT =
  'Ты — эксперт по кибербезопасности. Проанализируй код на уязвимости (SQL injection, XSS, CSRF, etc.). Для каждой уязвимости укажи: severity (CRITICAL/HIGH/MEDIUM/LOW), описание, строку кода, рекомендацию. Ответь на русском. Ответ ОБЯЗАТЕЛЬНО верни в формате JSON-массива: [{"severity":"CRITICAL"|"HIGH"|"MEDIUM"|"LOW","title":"название","description":"описание","line":номер_строки_или_null}]. Если уязвимостей нет, верни пустой массив [].';

interface ScanResult {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  line?: number;
}

function parseSeverity(s: string): 'critical' | 'warning' | 'info' {
  const upper = s.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH') return 'critical';
  if (upper === 'MEDIUM') return 'warning';
  return 'info';
}

function parseAIResponse(raw: string): ScanResult[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        severity: string;
        title: string;
        description: string;
        line?: number | null;
      }>;
      return parsed.map((item) => ({
        severity: parseSeverity(item.severity),
        title: item.title,
        description: item.description,
        line: item.line ?? undefined,
      }));
    }
  } catch {
    // fallback: show raw response as single info item
  }

  // Fallback: return the raw AI response as a single result
  return [
    {
      severity: 'info',
      title: 'Результат анализа',
      description: raw,
    },
  ];
}

export const SecurityScan: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setResults(null);
    setError('');

    try {
      const userPrompt = `Проанализируй следующий код:\n\n\`\`\`\n${code.trim()}\n\`\`\``;
      const raw = await complete(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIResponse(raw);
      setResults(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при запросе к AI');
    } finally {
      setLoading(false);
    }
  };

  const severityConfig = {
    critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Critical' },
    warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', label: 'Warning' },
    info: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Info' },
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <Shield size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Security Scanner</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-400 mb-3">Код для сканирования</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Вставьте код для анализа безопасности..."
              className="hub-input font-mono text-xs resize-none flex-1 min-h-[400px]"
              spellCheck={false}
            />
            <button
              onClick={handleScan}
              disabled={!code.trim() || loading}
              className="hub-btn mt-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {loading ? 'Сканирование...' : 'Запустить скан'}
            </button>
          </div>

          {/* Results */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-400 mb-3">Результаты</label>
            {error ? (
              <div className="hub-card flex-1 min-h-[400px] flex items-center justify-center p-6">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : results ? (
              <div className="space-y-3">
                {/* Summary */}
                <div className="hub-card p-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400">Найдено уязвимостей</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-400 font-medium">
                      {results.filter((r) => r.severity === 'critical').length} critical
                    </span>
                    <span className="text-xs text-yellow-400 font-medium">
                      {results.filter((r) => r.severity === 'warning').length} warning
                    </span>
                    <span className="text-xs text-blue-400 font-medium">
                      {results.filter((r) => r.severity === 'info').length} info
                    </span>
                  </div>
                </div>

                {/* Issues */}
                {results.map((r, i) => {
                  const cfg = severityConfig[r.severity];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`hub-card border-l-2 ${cfg.border} p-4`}>
                      <div className="flex items-start gap-3">
                        <Icon size={18} className={`${cfg.color} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{r.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}>
                              {cfg.label}
                            </span>
                            {r.line && (
                              <span className="text-[10px] text-gray-500">line {r.line}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{r.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="hub-card flex-1 min-h-[400px] flex flex-col items-center justify-center text-center p-6">
                <Shield size={32} className="text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">Результаты сканирования появятся здесь</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
