import React from 'react';
import { ArrowRight, CheckCircle2, Search } from 'lucide-react';
import type { BuilderProject } from '../../services/builderWorkflowService';

interface BuilderPreviewProps {
  project: BuilderProject;
  viewport: 'desktop' | 'mobile';
}

const ProofList: React.FC<{ points: string[] }> = ({ points }) => (
  <div className="grid gap-2 sm:grid-cols-3">
    {points.map((point) => (
      <div key={point} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <CheckCircle2 size={14} className="shrink-0 text-blue-600" />{point}
      </div>
    ))}
  </div>
);

export const BuilderPreview: React.FC<BuilderPreviewProps> = ({ project, viewport }) => {
  const isMobile = viewport === 'mobile';
  const isDashboard = project.input.template === 'dashboard';
  const isCatalog = project.input.template === 'catalog';

  return (
    <div className={`mx-auto overflow-hidden rounded-[18px] border border-slate-300 bg-slate-50 text-slate-950 shadow-2xl shadow-black/20 transition-[max-width] duration-200 ${isMobile ? 'max-w-[390px]' : 'max-w-5xl'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />{project.input.name}</div>
        <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200" /><span className="h-2 w-2 rounded-full bg-slate-200" /><span className="h-2 w-2 rounded-full bg-slate-200" /></div>
      </div>

      <div className={isDashboard && !isMobile ? 'grid grid-cols-[150px_1fr]' : ''}>
        {isDashboard && !isMobile && (
          <aside className="border-r border-slate-200 bg-slate-950 p-4 text-xs text-slate-300">
            {project.blueprint.routes.map((route, index) => <div key={route.path} className={`mb-2 rounded-md px-3 py-2 ${index === 0 ? 'bg-blue-500/15 text-blue-300' : ''}`}>{route.label}</div>)}
          </aside>
        )}

        <main className={isMobile ? 'p-4' : 'p-7'}>
          {isCatalog && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400"><Search size={15} />Поиск по каталогу</div>
          )}
          <div className="max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">{project.preview.eyebrow}</div>
            <h3 className={`mt-2 font-bold tracking-tight ${isMobile ? 'text-2xl' : 'text-4xl'}`}>{project.preview.headline}</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{project.preview.supportingText}</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{project.preview.actionLabel}<ArrowRight size={15} /></span>
          </div>

          {isDashboard ? (
            <div className={`mt-7 grid gap-3 ${isMobile ? '' : 'grid-cols-3'}`}>
              {['Текущий статус', 'Ближайшее решение', 'Последнее изменение'].map((label, index) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-3 h-2 rounded bg-slate-100"><div className="h-full rounded bg-blue-500" style={{ width: `${72 - index * 16}%` }} /></div></div>
              ))}
            </div>
          ) : isCatalog ? (
            <div className={`mt-7 grid gap-3 ${isMobile ? '' : 'grid-cols-3'}`}>
              {project.preview.proofPoints.map((label) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="h-20 rounded-lg bg-slate-100" /><div className="mt-3 text-sm font-semibold">{label}</div><div className="mt-2 h-2 w-2/3 rounded bg-slate-100" /></div>)}
            </div>
          ) : (
            <div className="mt-8"><ProofList points={project.preview.proofPoints} /></div>
          )}
        </main>
      </div>
    </div>
  );
};
