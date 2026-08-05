import React, { useState } from 'react';
import { Code2, Download, FileCode2, LockKeyhole } from 'lucide-react';
import { serializeBuilderFiles, type BuilderFilesArtifact } from '../../services/builderFileRenderer';

function downloadArtifact(artifact: BuilderFilesArtifact) {
  const url = URL.createObjectURL(new Blob([serializeBuilderFiles(artifact)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `builder-files-${artifact.projectId.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const BuilderFilesPanel: React.FC<{ artifact: BuilderFilesArtifact }> = ({ artifact }) => {
  const [selectedPath, setSelectedPath] = useState(artifact.files[0]?.path ?? '');
  const selected = artifact.files.find((file) => file.path === selectedPath) ?? artifact.files[0];
  const totalBytes = artifact.files.reduce((sum, file) => sum + file.sizeBytes, 0);

  return (
    <section className="hub-card p-4 sm:p-5" aria-labelledby="builder-files-title">
      <div className="flex flex-col gap-4 border-b border-hub-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><Code2 size={18} className="text-hub-accent" /><h2 id="builder-files-title" className="font-semibold text-white">5. Проверьте подготовленные файлы</h2></div><p className="mt-1 text-xs text-gray-500">{artifact.files.length} файлов · {(totalBytes / 1024).toFixed(1)} КБ · ничего не записано и не запущено</p></div>
        <button type="button" onClick={() => downloadArtifact(artifact)} className="hub-btn flex min-h-11 items-center justify-center gap-2"><Download size={15} />Скачать files JSON</button>
      </div>
      <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100"><LockKeyhole size={16} className="mt-0.5 shrink-0" />Перед записью в workspace нужны schema validation, dependency review и отдельное подтверждение. Этот экран не выполняет код.</div>
      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="space-y-1" aria-label="Файлы scaffold">
          {artifact.files.map((file) => <button key={file.path} type="button" onClick={() => setSelectedPath(file.path)} aria-current={selected?.path === file.path ? 'true' : undefined} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-xs ${selected?.path === file.path ? 'bg-hub-accent/10 text-hub-accent-light' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><span className="flex min-w-0 items-center gap-2"><FileCode2 size={14} className="shrink-0" /><span className="truncate">{file.path}</span></span><span className="shrink-0 text-[10px] text-gray-600">{file.sizeBytes} B</span></button>)}
        </nav>
        {selected && <div className="min-w-0 overflow-hidden rounded-xl border border-hub-border bg-[#070a0f]"><div className="border-b border-hub-border px-4 py-3 font-mono text-xs text-gray-400">{selected.path}</div><pre className="max-h-[560px] overflow-auto p-4 text-xs leading-6 text-gray-300"><code>{selected.content}</code></pre></div>}
      </div>
    </section>
  );
};
