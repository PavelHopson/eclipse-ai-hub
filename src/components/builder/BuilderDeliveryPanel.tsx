import { useMemo, useState } from 'react';
import { CheckCircle2, Download, GitBranch, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { serializeBuilderFiles, type BuilderFilesArtifact } from '../../services/builderFileRenderer';
import {
  createBuilderDelivery,
  prepareBuilderHandoff,
  recordBuilderCheck,
  restoreBuilderCheckpoint,
  serializeBuilderDelivery,
  type BuilderCheckId,
  type BuilderDelivery,
} from '../../services/builderDeliveryService';

function downloadJson(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BuilderDeliveryPanel({ artifact }: { artifact: BuilderFilesArtifact }) {
  const initial = useMemo(() => createBuilderDelivery(artifact), [artifact]);
  const [delivery, setDelivery] = useState<BuilderDelivery>(initial);
  const [branch, setBranch] = useState('master');
  const [error, setError] = useState('');

  function mark(id: BuilderCheckId, status: 'passed' | 'failed') {
    const check = delivery.checks.find((item) => item.id === id);
    try {
      setDelivery(recordBuilderCheck(delivery, id, status, status === 'passed'
        ? `${check?.label ?? id}: проверено человеком`
        : `${check?.label ?? id}: требуется исправление`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить результат проверки');
    }
  }

  function prepare() {
    try {
      setDelivery(prepareBuilderHandoff(delivery, branch));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Handoff пока недоступен');
    }
  }

  function rollback() {
    try {
      const restored = restoreBuilderCheckpoint(delivery, delivery.currentCheckpointId);
      downloadJson(serializeBuilderFiles(restored), `builder-rollback-${restored.projectId}.json`);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось восстановить checkpoint');
    }
  }

  const passed = delivery.checks.filter((check) => check.status === 'passed').length;

  return (
    <section className="hub-card p-4 sm:p-5" aria-labelledby="builder-delivery-title">
      <div className="flex flex-col gap-4 border-b border-hub-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-hub-success" /><h2 id="builder-delivery-title" className="font-semibold text-white">6. Контрольная точка, тесты и передача</h2></div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">Один результат — один восстанавливаемый снимок. Сеть, MCP, выполнение кода и продакшен-деплой остаются выключены.</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hub-border bg-hub-border text-center text-xs">
          <span className="bg-hub-surface px-3 py-2 text-gray-500">Стоимость<strong className="ml-2 text-white">$0</strong></span>
          <span className="bg-hub-surface px-3 py-2 text-gray-500">Проверки<strong className="ml-2 text-white">{passed}/{delivery.checks.length}</strong></span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-hub-border bg-hub-surface p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-hub-accent">ТОЧКА 01</span>
          <h3 className="mt-2 text-sm font-semibold text-white">Исходный каркас сохранён</h3>
          <p className="mt-2 break-all font-mono text-[10px] text-gray-500">{delivery.checkpoints[0].fingerprint}</p>
          <button type="button" onClick={rollback} className="hub-btn-ghost mt-4 flex min-h-11 w-full items-center justify-center gap-2"><RotateCcw size={15} />Скачать JSON для отката</button>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Обязательные проверки</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {delivery.checks.map((check) => (
              <div key={check.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-hub-border bg-hub-surface px-3 py-2">
                <div className="min-w-0"><strong className="block truncate text-xs text-gray-200">{check.label}</strong><span className={`text-[10px] ${check.status === 'failed' ? 'text-red-300' : check.status === 'passed' ? 'text-emerald-300' : 'text-gray-600'}`}>{check.status === 'passed' ? 'Проверено' : check.status === 'failed' ? 'Нужно исправить' : 'Не проверено'}</span></div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => mark(check.id, 'passed')} aria-label={`Подтвердить: ${check.label}`} className="rounded-md border border-emerald-400/20 p-2 text-emerald-300 hover:bg-emerald-400/10"><CheckCircle2 size={14} /></button>
                  <button type="button" onClick={() => mark(check.id, 'failed')} aria-label={`Отклонить: ${check.label}`} className="rounded-md border border-red-400/20 p-2 text-red-300 hover:bg-red-400/10"><XCircle size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-hub-border bg-hub-surface p-4">
          <div className="flex items-center gap-2"><GitBranch size={16} className="text-hub-accent" /><h3 className="text-sm font-semibold text-white">Подготовить передачу</h3></div>
          <p className="mt-2 text-xs leading-5 text-gray-500">Только в уже существующую ветку. Этот экран не создаёт ветку, коммит, отправку или деплой.</p>
          <label className="mt-4 block text-xs text-gray-400">Целевая ветка<input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={120} className="hub-input mt-2" /></label>
          <button type="button" onClick={prepare} disabled={passed !== delivery.checks.length} className="hub-btn mt-3 min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-40">Проверить готовность</button>
          {delivery.handoff && <p className="mt-3 text-xs leading-5 text-emerald-300" role="status">Передача в {delivery.handoff.targetBranch} подготовлена. Патч ещё не создан.</p>}
          <button type="button" onClick={() => downloadJson(serializeBuilderDelivery(delivery), `builder-delivery-${delivery.id}.json`)} className="hub-btn-ghost mt-2 flex min-h-11 w-full items-center justify-center gap-2"><Download size={15} />Скачать паспорт передачи</button>
        </section>
      </div>
      {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  );
}
