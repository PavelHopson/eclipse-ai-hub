import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileJson, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  AdsAuditReport,
  auditAdsSnapshot,
  parseAdsSnapshot,
  SAMPLE_ADS_SNAPSHOT,
} from '../services/adsAuditService';

const severityStyle = {
  high: 'border-red-400/30 bg-red-400/5 text-red-300',
  medium: 'border-amber-400/30 bg-amber-400/5 text-amber-300',
  low: 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300',
};

export const AdsAudit: React.FC = () => {
  const [raw, setRaw] = useState(SAMPLE_ADS_SNAPSHOT);
  const [report, setReport] = useState<AdsAuditReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const highCount = useMemo(() => report?.findings.filter((finding) => finding.severity === 'high').length ?? 0, [report]);

  const runAudit = () => {
    setBusy(true);
    setError('');
    try {
      setReport(auditAdsSnapshot(parseAdsSnapshot(raw)));
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : 'Не удалось провести аудит');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ads-audit-${report.generatedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-hub-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent">
              <ShieldCheck size={15} /> Eclipse Ads Operator
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Проверьте рекламу до изменения бюджета</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              Вставьте безопасный JSON-export. Аудит выполняется в браузере, показывает доказательства и только предлагает diff — ничего не отправляет в рекламный кабинет.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
            <LockKeyhole size={14} /> Read-only · без Ads API
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
          <section className="hub-card eclipse-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-white"><FileJson size={17} /> Данные кампаний</h2>
                <p className="mt-1 text-xs text-gray-500">Schema: ads.snapshot.v1 · максимум 256 КБ / 500 кампаний</p>
              </div>
              <button
                type="button"
                onClick={() => { setRaw(SAMPLE_ADS_SNAPSHOT); setError(''); setReport(null); }}
                className="hub-btn-ghost !px-3 !py-2 text-xs"
              >
                Пример
              </button>
            </div>
            <label className="sr-only" htmlFor="ads-json">JSON с данными рекламных кампаний</label>
            <textarea
              id="ads-json"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              spellCheck={false}
              className="hub-input min-h-[330px] resize-y font-mono text-xs leading-5"
            />
            {error && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-400/5 p-3 text-sm text-red-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button type="button" onClick={runAudit} disabled={busy || raw.trim().length === 0} className="hub-btn mt-4 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {busy ? 'Проверяю…' : 'Провести безопасный аудит'}
            </button>
          </section>

          <section aria-live="polite" className="space-y-4">
            {!report ? (
              <div className="hub-card flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-hub-accent/10 text-hub-accent"><ShieldCheck size={24} /></div>
                <h2 className="font-semibold text-white">Здесь появится отчёт</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Сначала проверьте пример. Затем замените account, period и campaigns данными из read-only export.</p>
              </div>
            ) : (
              <>
                <div className="hub-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500">Audit score</div>
                      <div className="mt-1 text-4xl font-bold text-white">{report.score}<span className="text-base text-gray-500">/100</span></div>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 text-xs ${highCount ? 'border-red-400/25 bg-red-400/5 text-red-300' : 'border-emerald-400/25 bg-emerald-400/5 text-emerald-300'}`}>
                      {highCount ? `${highCount} важных риска` : 'Красных флагов нет'}
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-hub-border pt-4 text-sm">
                    <div><dt className="text-xs text-gray-500">Расход</dt><dd className="mt-1 font-semibold text-white">{report.totals.spend.toFixed(0)} {report.currency}</dd></div>
                    <div><dt className="text-xs text-gray-500">Конверсии</dt><dd className="mt-1 font-semibold text-white">{report.totals.conversions}</dd></div>
                    <div><dt className="text-xs text-gray-500">ROAS</dt><dd className="mt-1 font-semibold text-white">{report.totals.roas?.toFixed(2) ?? '—'}</dd></div>
                  </dl>
                </div>

                <div className="space-y-3">
                  {report.findings.map((finding) => (
                    <article key={finding.id} className={`rounded-xl border p-4 ${severityStyle[finding.severity]}`}>
                      <div className="flex items-start gap-2">
                        {finding.severity === 'low' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" />}
                        <div>
                          <h3 className="font-semibold">{finding.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-gray-300">{finding.evidence}</p>
                          <p className="mt-2 text-xs leading-5 text-gray-400">Что делать: {finding.recommendation}</p>
                          {finding.diff && (
                            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                              <div className="rounded-md bg-black/20 p-2"><span className="block text-gray-500">Сейчас</span>{finding.diff.before}</div>
                              <div className="rounded-md bg-black/20 p-2"><span className="block text-gray-500">Предложение, не действие</span>{finding.diff.after}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <button type="button" onClick={downloadReport} className="hub-btn-ghost flex w-full items-center justify-center gap-2 border border-hub-border">
                  <Download size={15} /> Скачать versioned JSON-отчёт
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
