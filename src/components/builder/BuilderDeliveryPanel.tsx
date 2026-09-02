import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileDiff, GitBranch, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
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
import {
  buildBuilderPatch,
  markBuilderPatchExported,
  serializeBuilderPatchArtifact,
  type BuilderPatchArtifact,
} from '../../services/builderPatchService';

function downloadJson(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPatch(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/x-diff;charset=utf-8' }));
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
  const [patchArtifact, setPatchArtifact] = useState<BuilderPatchArtifact | null>(null);
  const [error, setError] = useState('');

  function mark(id: BuilderCheckId, status: 'passed' | 'failed') {
    const check = delivery.checks.find((item) => item.id === id);
    try {
      setDelivery(recordBuilderCheck(delivery, id, status, status === 'passed'
        ? `${check?.label ?? id}: проверено человеком`
        : `${check?.label ?? id}: требуется исправление`));
      setPatchArtifact(null);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить результат проверки');
    }
  }

  function prepare() {
    try {
      const prepared = prepareBuilderHandoff(delivery, branch);
      const nextPatch = buildBuilderPatch(prepared);
      setDelivery(prepared);
      setPatchArtifact(nextPatch);
      setError('');
    } catch (caught) {
      setPatchArtifact(null);
      setError(caught instanceof Error ? caught.message : 'Git patch пока недоступен');
    }
  }

  function changeBranch(value: string) {
    setBranch(value);
    setPatchArtifact(null);
    if (delivery.handoff) {
      setDelivery({
        ...delivery,
        updatedAt: new Date().toISOString(),
        stage: 'ready_for_handoff',
        handoff: null,
      });
    }
  }

  function exportPatch() {
    if (!patchArtifact) return;
    try {
      downloadPatch(
        patchArtifact.patch,
        `builder-${delivery.projectId}-${patchArtifact.patchFingerprint.replace(':', '-')}.patch`,
      );
      setDelivery(markBuilderPatchExported(delivery, patchArtifact));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось экспортировать Git patch');
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
          <p className="mt-2 text-xs leading-5 text-gray-500">Укажите уже существующую ветку. Builder покажет полный diff, но не создаст ветку, коммит, отправку или деплой.</p>
          <label className="mt-4 block text-xs text-gray-400">Целевая ветка<input value={branch} onChange={(event) => changeBranch(event.target.value)} maxLength={120} autoComplete="off" spellCheck={false} className="hub-input mt-2" /></label>
          <button type="button" onClick={prepare} disabled={passed !== delivery.checks.length} className="hub-btn mt-3 min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-40">Собрать видимый Git patch</button>
          {patchArtifact && <p className="mt-3 text-xs leading-5 text-emerald-300" role="status">Patch для {patchArtifact.targetBranch} готов к просмотру. Репозиторий не изменён.</p>}
          <button type="button" onClick={() => downloadJson(serializeBuilderDelivery(delivery), `builder-delivery-${delivery.id}.json`)} className="hub-btn-ghost mt-2 flex min-h-11 w-full items-center justify-center gap-2"><Download size={15} />Скачать паспорт передачи</button>
        </section>
      </div>

      {patchArtifact && (
        <section className="mt-5 overflow-hidden rounded-xl border border-hub-border bg-hub-surface" aria-labelledby="builder-patch-title">
          <header className="flex flex-col gap-3 border-b border-hub-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><FileDiff size={17} className="text-hub-accent" /><h3 id="builder-patch-title" className="text-sm font-semibold text-white">7. Проверьте полный Git diff</h3></div>
              <p className="mt-1 text-xs leading-5 text-gray-500">Только новые файлы. Скачивание не применяет patch и не подключается к GitHub.</p>
            </div>
            <button type="button" onClick={exportPatch} className="hub-btn flex min-h-11 shrink-0 items-center justify-center gap-2"><Download size={15} />Скачать .patch</button>
          </header>
          <div className="flex flex-wrap gap-2 border-b border-hub-border px-4 py-3 text-[10px]">
            <span className="rounded border border-hub-border px-2 py-1 text-gray-400">{patchArtifact.files.length} файлов</span>
            <span className="rounded border border-hub-border px-2 py-1 font-mono text-gray-400">{patchArtifact.patchFingerprint}</span>
            <span className="rounded border border-hub-border px-2 py-1 text-gray-400">ветка: {patchArtifact.targetBranch}</span>
          </div>
          <pre className="max-h-[28rem] overflow-auto whitespace-pre p-4 text-[11px] leading-5 text-gray-300" tabIndex={0} aria-label="Полный Git patch">{patchArtifact.patch}</pre>
          <footer className="flex flex-col gap-3 border-t border-hub-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-gray-500">Перед применением нужен человек: проверить ветку, выполнить <code className="text-gray-300">git apply --check</code>, затем тесты проекта.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => downloadJson(serializeBuilderPatchArtifact(patchArtifact), `builder-patch-${delivery.id}.json`)} className="hub-btn-ghost flex min-h-11 items-center justify-center gap-2"><Download size={15} />Паспорт patch</button>
              {delivery.handoff?.patchExported && <span className="flex min-h-11 items-center justify-center gap-2 text-xs text-emerald-300" role="status"><CheckCircle2 size={15} />Patch скачан</span>}
            </div>
          </footer>
        </section>
      )}
      {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  );
}
