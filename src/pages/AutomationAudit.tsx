import React, { useState } from 'react';
import { CheckCircle2, Download, FileCheck2, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import { approveAutomationAudit, createAutomationAudit, markAutomationAuditReady, serializeAutomationAudit, type AutomationAuditArtifact, type AutomationAuditInput } from '../services/automationAuditService';

const EXAMPLE: AutomationAuditInput = {
  businessName: 'Demo Studio', contactRole: 'Владелец', objective: 'Сократить ручную подготовку коммерческих предложений без подключения рабочих аккаунтов.',
  processName: 'Квалификация заявки', processSteps: ['Получить заявку', 'Сверить требования', 'Подготовить предложение'], systems: ['Сайт', 'CRM'], constraints: ['Только публичные и обезличенные данные', 'Без OAuth и отправки сообщений'],
  evidence: [{ id: 'EV-01', description: 'Пять заявок потребовали повторной ручной сверки.', source: 'Обезличенная выборка интервью' }],
  proposal: { outcome: 'Проверить экономию времени на пяти заявках.', scope: ['Read-only карта процесса', 'Черновик предложения'], exclusions: ['Автоотправка', 'Production-доступ'], pilotMetric: 'Минуты на одно предложение' },
  validation: { problem: 'Владелец тратит время на повторяющуюся сверку требований.', audience: 'Малый B2B-бизнес с 5–30 заявками в неделю', offer: 'Read-only audit и pilot proposal', interviews: 5, waitlist: 0, pilotEvidence: 'Пять обезличенных интервью; оплаченного pilot пока нет.' },
  claims: [{ claim: 'Пять заявок потребовали повторной ручной сверки.', evidenceIds: ['EV-01'] }, { claim: 'Pilot сократит время вдвое.', evidenceIds: [] }],
};
const EMPTY: AutomationAuditInput = { businessName: '', contactRole: '', objective: '', processName: '', processSteps: [], systems: [], constraints: [], evidence: [], proposal: { outcome: '', scope: [], exclusions: [], pilotMetric: '' }, validation: { problem: '', audience: '', offer: '', interviews: 0, waitlist: 0, pilotEvidence: '' }, claims: [] };
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const join = (value: string[]) => value.join('\n');

function download(artifact: AutomationAuditArtifact) {
  const url = URL.createObjectURL(new Blob([serializeAutomationAudit(artifact)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `automation-audit-${artifact.id.slice(0, 8)}.json`; anchor.click(); URL.revokeObjectURL(url);
}

export const AutomationAudit: React.FC = () => {
  const [input, setInput] = useState<AutomationAuditInput>(EMPTY);
  const [artifact, setArtifact] = useState<AutomationAuditArtifact | null>(null);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState({ scopeConfirmed: false, claimsConfirmed: false, noExternalActionsConfirmed: false });
  const patch = <K extends keyof AutomationAuditInput>(key: K, value: AutomationAuditInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const action = (fn: () => AutomationAuditArtifact) => { try { setArtifact(fn()); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось подготовить audit'); } };
  const applyExample = () => { setInput(EXAMPLE); setArtifact(null); setError(''); setChecks({ scopeConfirmed: false, claimsConfirmed: false, noExternalActionsConfirmed: false }); };
  const inputClass = 'hub-input mt-2';

  return <div className="min-h-full p-5 md:p-8 text-gray-100">
    <header className="max-w-6xl mx-auto flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs uppercase tracking-[.18em] text-hub-accent">B2B AI automation</p><h1 className="mt-2 text-3xl font-semibold">Automation Audit</h1><p className="mt-2 max-w-3xl text-sm text-gray-400">Intake → read-only process map → proposal → Claim Auditor → human approval → receipt. Никаких OAuth, отправок или production-изменений.</p></div>
      <button className="hub-btn-ghost border border-hub-border" type="button" onClick={applyExample}>Заполнить безопасный пример</button>
    </header>

    <main className="max-w-6xl mx-auto mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <section className="hub-card eclipse-card p-5 space-y-5" aria-label="Intake и validation">
        <div className="flex items-center gap-3"><FileCheck2 className="text-hub-accent"/><div><h2 className="font-semibold">1. Intake и evidence</h2><p className="text-xs text-gray-500">Не добавляйте клиентские базы, секреты и персональные данные.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">Компания<input className={inputClass} value={input.businessName} onChange={(e) => patch('businessName', e.target.value)} /></label>
          <label className="text-sm">Роль собеседника<input className={inputClass} value={input.contactRole} onChange={(e) => patch('contactRole', e.target.value)} /></label>
        </div>
        <label className="block text-sm">Цель<textarea className={`${inputClass} min-h-20`} value={input.objective} onChange={(e) => patch('objective', e.target.value)} /></label>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Процесс<input className={inputClass} value={input.processName} onChange={(e) => patch('processName', e.target.value)} /></label><label className="text-sm">Шаги · по одному на строку<textarea className={`${inputClass} min-h-28`} value={join(input.processSteps)} onChange={(e) => patch('processSteps', lines(e.target.value))}/></label></div>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Системы<textarea className={`${inputClass} min-h-24`} value={join(input.systems)} onChange={(e) => patch('systems', lines(e.target.value))}/></label><label className="text-sm">Ограничения<textarea className={`${inputClass} min-h-24`} value={join(input.constraints)} onChange={(e) => patch('constraints', lines(e.target.value))}/></label></div>
        <label className="block text-sm">Evidence · формат ID | описание | источник<textarea className={`${inputClass} min-h-28`} value={input.evidence.map((x) => `${x.id} | ${x.description} | ${x.source}`).join('\n')} onChange={(e) => patch('evidence', lines(e.target.value).map((row) => { const [id='', description='', source=''] = row.split('|').map((x) => x.trim()); return { id, description, source }; }))}/></label>

        <div className="border-t border-hub-border pt-5"><h2 className="font-semibold">2. SaaS validation workspace</h2><p className="mt-1 text-xs text-gray-500">Фиксируем evidence, не изображаем product-market fit.</p></div>
        {(['problem','audience','offer','pilotEvidence'] as const).map((key) => <label className="block text-sm" key={key}>{({problem:'Problem',audience:'Audience',offer:'Offer',pilotEvidence:'Pilot evidence'})[key]}<textarea className={`${inputClass} min-h-20`} value={input.validation[key]} onChange={(e) => patch('validation', { ...input.validation, [key]: e.target.value })}/></label>)}
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Interviews<input className={inputClass} min="0" type="number" value={input.validation.interviews} onChange={(e) => patch('validation', { ...input.validation, interviews: Number(e.target.value) })}/></label><label className="text-sm">Waitlist<input className={inputClass} min="0" type="number" value={input.validation.waitlist} onChange={(e) => patch('validation', { ...input.validation, waitlist: Number(e.target.value) })}/></label></div>

        <div className="border-t border-hub-border pt-5"><h2 className="font-semibold">3. Proposal и claims</h2></div>
        <label className="block text-sm">Pilot outcome<textarea className={`${inputClass} min-h-20`} value={input.proposal.outcome} onChange={(e) => patch('proposal', { ...input.proposal, outcome: e.target.value })}/></label>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Scope<textarea className={`${inputClass} min-h-24`} value={join(input.proposal.scope)} onChange={(e) => patch('proposal', { ...input.proposal, scope: lines(e.target.value) })}/></label><label className="text-sm">Exclusions<textarea className={`${inputClass} min-h-24`} value={join(input.proposal.exclusions)} onChange={(e) => patch('proposal', { ...input.proposal, exclusions: lines(e.target.value) })}/></label></div>
        <label className="block text-sm">Pilot metric<input className={inputClass} value={input.proposal.pilotMetric} onChange={(e) => patch('proposal', { ...input.proposal, pilotMetric: e.target.value })}/></label>
        <label className="block text-sm">Claims · формат claim | EV-01,EV-02<textarea className={`${inputClass} min-h-28`} value={input.claims.map((x) => `${x.claim} | ${x.evidenceIds.join(',')}`).join('\n')} onChange={(e) => patch('claims', lines(e.target.value).map((row) => { const [claim='', ids=''] = row.split('|').map((x) => x.trim()); return { claim, evidenceIds: ids ? ids.split(',').map((x) => x.trim()).filter(Boolean) : [] }; }))}/></label>
        {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="flex flex-wrap gap-3"><button type="button" className="hub-btn" onClick={() => action(() => createAutomationAudit(input))}>Построить read-only audit</button><button type="button" className="hub-btn-ghost" onClick={() => { setInput(EMPTY); setArtifact(null); setError(''); }}><RotateCcw size={16} className="inline mr-2"/>Сбросить</button></div>
      </section>

      <aside className="space-y-5" aria-live="polite">
        {!artifact ? <section className="hub-card p-6 text-center"><LockKeyhole className="mx-auto text-gray-600"/><h2 className="mt-4 font-semibold">Audit ещё не построен</h2><p className="mt-2 text-sm text-gray-500">Заполните intake или примените пример. Карта создаётся локально без AI-запроса.</p></section> : <>
          <section className="hub-card p-5"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-gray-500">{artifact.schemaVersion}</span><span className="text-xs text-hub-accent">{artifact.status}</span></div><h2 className="mt-3 font-semibold">Read-only process map</h2><ol className="mt-3 space-y-2">{artifact.processMap.map((step) => <li className="rounded-lg border border-hub-border p-3 text-sm" key={step.order}><strong>{step.order}. {step.step}</strong><small className="block mt-1 text-gray-500">{step.system ?? 'Система не назначена'} · read-only</small></li>)}</ol></section>
          <section className="hub-card p-5">
            <div className="flex items-start justify-between gap-3"><div><span className="text-xs uppercase tracking-wider text-hub-accent">{artifact.orchestration.schemaVersion}</span><h2 className="mt-2 font-semibold">Ограниченный план агентов</h2></div><span className="rounded border border-amber-400/25 px-2 py-1 text-[10px] uppercase text-amber-300">запуск запрещён</span></div>
            <p className="mt-2 text-xs leading-5 text-gray-500">План фиксирует лимиты и точки остановки. Он не запускает агентов и не расширяет permissions.</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-hub-border p-3"><dt className="text-gray-500">Шаги / вызовы моделей</dt><dd className="mt-1 font-mono text-gray-200">{artifact.orchestration.budget.maxSteps} / {artifact.orchestration.budget.maxModelCalls}</dd></div>
              <div className="rounded-lg border border-hub-border p-3"><dt className="text-gray-500">Входные / выходные токены</dt><dd className="mt-1 font-mono text-gray-200">{artifact.orchestration.budget.maxInputTokens} / {artifact.orchestration.budget.maxOutputTokens}</dd></div>
              <div className="rounded-lg border border-hub-border p-3"><dt className="text-gray-500">Лимит стоимости</dt><dd className="mt-1 font-mono text-gray-200">${artifact.orchestration.budget.maxCostUsd.toFixed(2)}</dd></div>
              <div className="rounded-lg border border-hub-border p-3"><dt className="text-gray-500">Тайм-аут / параллельно</dt><dd className="mt-1 font-mono text-gray-200">{artifact.orchestration.budget.timeoutMs / 1000} с / {artifact.orchestration.budget.maxParallelAgents}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">{artifact.orchestration.roles.map((role) => <div key={role.id} className="rounded-lg border border-hub-border p-3"><b className="text-xs text-gray-200">{role.id}</b><p className="mt-1 text-xs leading-5 text-gray-500">{role.responsibility}</p></div>)}</div>
            <details className="mt-4 rounded-lg border border-hub-border p-3"><summary className="cursor-pointer text-xs font-medium text-gray-300">Точки принудительной остановки</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-500">{artifact.orchestration.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></details>
          </section>
          <section className="hub-card p-5"><h2 className="font-semibold">Claim Auditor</h2><div className="mt-3 space-y-3">{artifact.claimAudit.map((claim) => <article className="rounded-lg border border-hub-border p-3" key={claim.claim}><span className={claim.status === 'verified' ? 'text-emerald-400 text-xs' : 'text-amber-400 text-xs'}>{claim.status}</span><p className="mt-1 text-sm">{claim.claim}</p><small className="mt-2 block text-gray-500">{claim.reason}</small></article>)}</div></section>
          {artifact.status === 'draft' ? <button className="hub-btn w-full" type="button" onClick={() => action(() => markAutomationAuditReady(artifact))}>Передать на human review</button> : artifact.status === 'ready_for_review' ? <section className="hub-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="text-hub-accent"/><h2 className="font-semibold">Human approval</h2></div><p className="mt-2 text-xs text-gray-500">Approval не запускает интеграции или работу с клиентами.</p>{([['scopeConfirmed','Scope и exclusions проверены'],['claimsConfirmed','Claims и evidence проверены'],['noExternalActionsConfirmed','Внешние действия запрещены']] as const).map(([key,label]) => <label className="mt-3 flex gap-2 text-sm" key={key}><input type="checkbox" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}/><span>{label}</span></label>)}<button className="hub-btn mt-4 w-full" type="button" disabled={!Object.values(checks).every(Boolean)} onClick={() => action(() => approveAutomationAudit(artifact, checks))}>Утвердить proposal</button></section> : <section className="hub-card p-5 border-emerald-500/30"><CheckCircle2 className="text-emerald-400"/><h2 className="mt-3 font-semibold">Approval receipt</h2><p className="mt-2 text-sm text-gray-400">{artifact.receipt?.statement}</p><code className="mt-3 block text-xs text-gray-500">{artifact.receipt?.receiptId}</code></section>}
          <button className="hub-btn-ghost w-full border border-hub-border" type="button" onClick={() => download(artifact)}><Download size={16} className="inline mr-2"/>Скачать JSON для Eclipse Chat</button>
        </>}
      </aside>
    </main>
  </div>;
};
