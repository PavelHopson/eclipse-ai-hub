import { useState } from 'react';
import { Ban, CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import type { GrowthRun } from '../../services/growthWorkflowService';
import {
  approveGrowthAction,
  cancelGrowthAction,
  createGrowthAction,
  serializeGrowthAction,
  submitGrowthAction,
  type GrowthAction,
  type GrowthActionInput,
  type GrowthActionType,
} from '../../services/growthActionLedgerService';

const TYPE_LABELS: Record<GrowthActionType, string> = {
  export: 'Локальный экспорт',
  publish: 'Публикация',
  schedule: 'Расписание',
  outreach: 'Личная рассылка',
};

const STATUS_LABELS: Record<GrowthAction['status'], string> = {
  draft: 'черновик',
  awaiting_approval: 'ожидает проверки',
  approved_not_executed: 'одобрен, не выполнен',
  cancelled: 'отменён',
};

const EVENT_LABELS: Record<GrowthAction['events'][number]['type'], string> = {
  created: 'создан',
  submitted: 'на проверке',
  approved: 'одобрен',
  cancelled: 'отменён',
};

function downloadAction(action: GrowthAction) {
  const url = URL.createObjectURL(new Blob([serializeGrowthAction(action)], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `growth-action-${action.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GrowthActionLedgerPanel({ run }: { run: GrowthRun }) {
  const [type, setType] = useState<GrowthActionType>('export');
  const [connector, setConnector] = useState('Локальный JSON');
  const [target, setTarget] = useState('Папка проекта');
  const [purpose, setPurpose] = useState('Передать утверждённый материал в ручной процесс публикации');
  const [scopes, setScopes] = useState('');
  const [lawfulBasis, setLawfulBasis] = useState('');
  const [suppression, setSuppression] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [action, setAction] = useState<GrowthAction | null>(null);
  const [error, setError] = useState('');

  function create() {
    try {
      const input: GrowthActionInput = {
        type,
        connector,
        target,
        purpose,
        scheduledAt: type === 'schedule' ? scheduledAt : null,
        oauthScopes: scopes.split(/\r?\n/).map((scope) => scope.trim()).filter(Boolean),
        lawfulBasis,
        suppressionListConfirmed: suppression,
      };
      setAction(createGrowthAction(run, input));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать план действия');
    }
  }

  function submit() {
    if (!action) return;
    try { setAction(submitGrowthAction(action)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось отправить план на проверку'); }
  }

  function approve() {
    if (!action) return;
    try {
      setAction(approveGrowthAction(action, {
        contentConfirmed: true,
        targetConfirmed: true,
        scopeConfirmed: true,
        lawfulBasisConfirmed: action.input.type === 'outreach',
      }));
      setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось одобрить план'); }
  }

  function cancel() {
    if (!action) return;
    try { setAction(cancelGrowthAction(action)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось отменить план'); }
  }

  return (
    <section className="hub-card p-5" aria-labelledby="growth-action-ledger-title">
      <header className="flex flex-col gap-3 border-b border-hub-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-hub-success" /><h2 id="growth-action-ledger-title" className="font-semibold text-white">План внешнего действия</h2></div><p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">Сначала понятный предпросмотр и минимальные разрешения, затем ручное одобрение. Этот модуль ничего не отправляет и не подключает OAuth.</p></div>
        <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[10px] uppercase tracking-wider text-emerald-300">исполнение выключено</span>
      </header>

      {!action ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-xs text-gray-400">Действие<select value={type} onChange={(event) => { const next = event.target.value as GrowthActionType; setType(next); if (next === 'export') { setConnector('Локальный JSON'); setScopes(''); } }} className="hub-input mt-2">{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs text-gray-400">Коннектор<input value={connector} onChange={(event) => setConnector(event.target.value)} maxLength={80} className="hub-input mt-2" /></label>
          <label className="text-xs text-gray-400">Получатель или канал<input value={target} onChange={(event) => setTarget(event.target.value)} maxLength={240} className="hub-input mt-2" /></label>
          {type === 'schedule' && <label className="text-xs text-gray-400">Дата и время<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="hub-input mt-2" /></label>}
          <label className="text-xs text-gray-400 lg:col-span-2">Зачем это действие<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={600} className="hub-input mt-2 min-h-20 resize-y" /></label>
          {type !== 'export' && <label className="text-xs text-gray-400">Минимальные разрешения OAuth<textarea value={scopes} onChange={(event) => setScopes(event.target.value)} placeholder="Один scope на строку" className="hub-input mt-2 min-h-20 resize-y font-mono" /></label>}
          {type === 'outreach' && <div className="space-y-3"><label className="block text-xs text-gray-400">Законное основание<textarea value={lawfulBasis} onChange={(event) => setLawfulBasis(event.target.value)} maxLength={300} className="hub-input mt-2 min-h-20 resize-y" /></label><label className="flex items-start gap-3 text-xs text-gray-300"><input type="checkbox" checked={suppression} onChange={(event) => setSuppression(event.target.checked)} className="mt-0.5" /><span>Проверены отписки и список исключений</span></label></div>}
          <button type="button" onClick={create} className="hub-btn min-h-11 lg:col-span-2">Создать предпросмотр действия</button>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-hub-accent">{TYPE_LABELS[action.input.type]} · {STATUS_LABELS[action.status]}</span>
            <h3 className="mt-2 text-base font-semibold text-white">{action.input.target}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">{action.input.purpose}</p>
            {action.input.oauthScopes.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{action.input.oauthScopes.map((scope) => <code key={scope} className="rounded-md border border-hub-border bg-hub-surface px-2 py-1 text-[10px] text-gray-300">{scope}</code>)}</div>}
            <ol className="mt-5 space-y-2 border-t border-hub-border pt-4">{action.events.map((event) => <li key={`${event.at}-${event.type}`} className="grid gap-1 text-xs sm:grid-cols-[150px_90px_minmax(0,1fr)]"><time className="text-gray-600">{new Date(event.at).toLocaleString('ru-RU')}</time><span className="text-hub-accent">{EVENT_LABELS[event.type]}</span><span className="text-gray-400">{event.message}</span></li>)}</ol>
          </div>
          <aside className="space-y-2 rounded-xl border border-hub-border bg-hub-surface p-4">
            {action.status === 'draft' && <button type="button" onClick={submit} className="hub-btn min-h-11 w-full">Отправить на проверку</button>}
            {action.status === 'awaiting_approval' && <button type="button" onClick={approve} className="hub-btn min-h-11 w-full"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} />Одобрить план, не выполнять</span></button>}
            {!['cancelled', 'approved_not_executed'].includes(action.status) && <button type="button" onClick={cancel} className="hub-btn-ghost min-h-11 w-full"><span className="inline-flex items-center gap-2"><Ban size={15} />Отменить</span></button>}
            <button type="button" onClick={() => downloadAction(action)} className="hub-btn-ghost min-h-11 w-full"><span className="inline-flex items-center gap-2"><Download size={15} />Скачать журнал JSON</span></button>
            {action.status === 'approved_not_executed' && <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-300"><CheckCircle2 size={15} className="mb-2" />План одобрен. Внешний вызов не выполнялся.</p>}
            <button type="button" onClick={() => { setAction(null); setError(''); }} className="flex min-h-10 w-full items-center justify-center gap-2 text-xs text-gray-500 hover:text-white"><ExternalLink size={14} />Новый план</button>
          </aside>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  );
}
