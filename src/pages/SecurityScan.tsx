import React, { useState } from 'react';
import {
  Shield,
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Lock,
  Mail,
  Key,
  Eye,
  EyeOff,
  Database,
  Calendar,
} from 'lucide-react';
import { complete } from '../services/aiService';
import {
  checkEmailBreaches,
  checkPasswordHash,
  type BreachResult,
} from '../services/leakCheckService';

/* ------------------------------------------------------------------ */
/*  AI Code Scanner types & helpers                                   */
/* ------------------------------------------------------------------ */

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
    // fallback below
  }
  return [
    {
      severity: 'info',
      title: 'Результат анализа',
      description: raw,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Shared severity config                                            */
/* ------------------------------------------------------------------ */

const severityConfig = {
  critical: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20',
    label: 'Warning',
  },
  info: {
    icon: CheckCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    label: 'Info',
  },
};

/* ------------------------------------------------------------------ */
/*  Tabs                                                              */
/* ------------------------------------------------------------------ */

type TabId = 'code' | 'leak';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'code', label: 'Code Scanner', icon: Search },
  { id: 'leak', label: 'Leak Check', icon: Lock },
];

/* ------------------------------------------------------------------ */
/*  Helper: format large numbers                                      */
/* ------------------------------------------------------------------ */

function fmtCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SecurityScan: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('code');

  /* --- Code Scanner state --- */
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [error, setError] = useState('');

  /* --- Leak Check state --- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [breaches, setBreaches] = useState<BreachResult[] | null>(null);
  const [breachError, setBreachError] = useState('');
  const [pwResult, setPwResult] = useState<{ found: boolean; count: number } | null>(null);

  /* --- Code Scanner handler --- */
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

  /* --- Leak Check handlers --- */
  const handleEmailCheck = async () => {
    if (!email.trim() || emailLoading) return;
    setEmailLoading(true);
    setBreaches(null);
    setBreachError('');
    try {
      const res = await checkEmailBreaches(email.trim());
      if (res.error) {
        setBreachError(res.error);
      } else {
        setBreaches(res.breaches);
      }
    } catch (err) {
      setBreachError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordCheck = async () => {
    if (!password || passwordLoading) return;
    setPasswordLoading(true);
    setPwResult(null);
    try {
      const res = await checkPasswordHash(password);
      setPwResult(res);
    } catch {
      setPwResult({ found: false, count: 0 });
    } finally {
      setPasswordLoading(false);
    }
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-16 border-b border-hub-border shrink-0">
        <Shield size={20} className="text-hub-accent" />
        <h1 className="text-lg font-semibold text-white">Security Scanner</h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-hub-accent/15 text-hub-accent'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* ======== CODE SCANNER TAB ======== */}
        {activeTab === 'code' && (
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
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}
                              >
                                {cfg.label}
                              </span>
                              {r.line && (
                                <span className="text-[10px] text-gray-500">line {r.line}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                              {r.description}
                            </p>
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
        )}

        {/* ======== LEAK CHECK TAB ======== */}
        {activeTab === 'leak' && (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Intro */}
            <div className="hub-card p-5 border border-hub-accent/20">
              <div className="flex items-start gap-3">
                <Shield size={20} className="text-hub-accent shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-white mb-1">
                    Data Breach & Leak Checker
                  </h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Check if your email or password has been exposed in known data breaches. Email
                    checks use demo data (HIBP v3 requires a paid key). Password checks use the
                    real{' '}
                    <span className="text-hub-accent">Have I Been Pwned Passwords</span> API with
                    k-Anonymity — your password never leaves your browser.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ---- Email breach check ---- */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Mail size={15} className="text-hub-accent" />
                  Email Breach Check
                </h3>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailCheck()}
                      placeholder="you@example.com"
                      className="hub-input w-full pl-9 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleEmailCheck}
                    disabled={!email.trim() || emailLoading}
                    className="hub-btn flex items-center gap-2 text-sm disabled:opacity-40 shrink-0"
                  >
                    {emailLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Check
                  </button>
                </div>

                {/* Breach results */}
                {breachError && <p className="text-xs text-red-400">{breachError}</p>}

                {breaches !== null && (
                  <div className="space-y-3">
                    {/* Summary banner */}
                    <div
                      className={`hub-card p-4 border-l-2 ${
                        breaches.length > 0
                          ? 'border-red-400/40 bg-red-400/5'
                          : 'border-green-400/40 bg-green-400/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {breaches.length > 0 ? (
                          <XCircle size={18} className="text-red-400 shrink-0" />
                        ) : (
                          <CheckCircle size={18} className="text-green-400 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">
                            {breaches.length > 0
                              ? `Found in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''}`
                              : 'No breaches found'}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {breaches.length > 0
                              ? 'Your data was exposed in known breaches. Change your passwords immediately.'
                              : 'This email was not found in any known breach database.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Individual breaches */}
                    {breaches.map((b, i) => (
                      <div key={i} className="hub-card border-l-2 border-red-400/20 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database size={14} className="text-red-400" />
                            <span className="text-sm font-semibold text-white">{b.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 font-medium">
                              Breached
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">{b.domain}</span>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {b.breachDate}
                          </span>
                          <span>{fmtCount(b.pwnCount)} accounts affected</span>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">{b.description}</p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {b.dataClasses.map((dc) => (
                            <span
                              key={dc}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-hub-accent/10 text-hub-accent border border-hub-accent/20"
                            >
                              {dc}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {breaches === null && !breachError && (
                  <div className="hub-card flex flex-col items-center justify-center text-center p-8">
                    <Mail size={28} className="text-gray-600 mb-2" />
                    <p className="text-gray-500 text-xs">
                      Enter an email to check for known breaches
                    </p>
                  </div>
                )}
              </div>

              {/* ---- Password leak check ---- */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key size={15} className="text-hub-accent" />
                  Password Leak Check
                </h3>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePasswordCheck()}
                      placeholder="Enter password to check"
                      className="hub-input w-full pl-9 pr-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={handlePasswordCheck}
                    disabled={!password || passwordLoading}
                    className="hub-btn flex items-center gap-2 text-sm disabled:opacity-40 shrink-0"
                  >
                    {passwordLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Check
                  </button>
                </div>

                {/* Password result */}
                {pwResult !== null && (
                  <div
                    className={`hub-card p-4 border-l-2 ${
                      pwResult.found
                        ? 'border-red-400/40 bg-red-400/5'
                        : 'border-green-400/40 bg-green-400/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {pwResult.found ? (
                        <XCircle size={18} className="text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle size={18} className="text-green-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">
                          {pwResult.found ? 'Password Compromised!' : 'Password Not Found'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {pwResult.found
                            ? `This password has been seen ${fmtCount(pwResult.count)} times in data breaches. Do NOT use it.`
                            : 'This password was not found in any known breach database. It may still be weak — use a password manager.'}
                        </p>
                      </div>
                    </div>

                    {pwResult.found && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-gray-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400"
                            style={{
                              width: `${Math.min(100, Math.log10(pwResult.count + 1) * 15)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-red-400 font-mono tabular-nums">
                          {pwResult.count.toLocaleString()}x
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {pwResult === null && (
                  <div className="hub-card flex flex-col items-center justify-center text-center p-8">
                    <Lock size={28} className="text-gray-600 mb-2" />
                    <p className="text-gray-500 text-xs">
                      Enter a password to check against known leaks
                    </p>
                  </div>
                )}

                {/* Safety note */}
                <div className="hub-card p-3 border border-green-400/10 bg-green-400/5">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      <span className="text-green-400 font-medium">Safe by design:</span> Your
                      password is hashed locally using SHA-1. Only the first 5 characters of the
                      hash are sent to the API (k-Anonymity). The full password never leaves your
                      browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
