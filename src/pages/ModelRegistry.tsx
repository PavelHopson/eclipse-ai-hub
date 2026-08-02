import React, { useMemo, useState } from 'react';
import { CheckCircle2, Cpu, Database, HardDrive, ShieldAlert, Sparkles } from 'lucide-react';
import {
  hardwareStatus,
  MODEL_REGISTRY,
  ModelCapability,
  recommendModel,
} from '../services/modelRegistry';

const CAPABILITIES: Array<{ id: ModelCapability; label: string }> = [
  { id: 'text', label: 'Текст' }, { id: 'image', label: 'Изображения' }, { id: 'video', label: 'Видео' }, { id: 'audio', label: 'Аудио' },
];

const statusLabel = { ready: 'Готово', limited: 'Медленно', missing: 'Не хватает ресурсов' };
const statusStyle = { ready: 'text-emerald-300 bg-emerald-400/10', limited: 'text-amber-300 bg-amber-400/10', missing: 'text-red-300 bg-red-400/10' };

export const ModelRegistry: React.FC = () => {
  const [capability, setCapability] = useState<ModelCapability>('text');
  const [privateOnly, setPrivateOnly] = useState(false);
  const [ramGb, setRamGb] = useState(16);
  const [vramGb, setVramGb] = useState(8);
  const [diskGb, setDiskGb] = useState(80);
  const profile = useMemo(() => ({ ramGb, vramGb, diskGb }), [ramGb, vramGb, diskGb]);
  const recommended = useMemo(() => recommendModel(capability, privateOnly, profile), [capability, privateOnly, profile]);
  const visible = MODEL_REGISTRY.filter((model) => model.capabilities.includes(capability) && (!privateOnly || model.badges.includes('Private')));

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-hub-border pb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hub-accent"><Database size={15} /> Eclipse Model Registry</div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Сначала условия и стоимость — потом запуск</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Каталог не обещает «200+ моделей локально». Он честно показывает runtime, privacy boundary, hardware, лицензию и готовность каждого маршрута.</p>
        </header>

        <section className="hub-card p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white"><Sparkles size={17} /> Что нужно сделать?</h2>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Тип модели">
                {CAPABILITIES.map((item) => (
                  <button key={item.id} type="button" onClick={() => setCapability(item.id)} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${capability === item.id ? 'border-hub-accent bg-hub-accent/10 text-white' : 'border-hub-border text-gray-400 hover:text-white'}`}>{item.label}</button>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-gray-300">
                <input type="checkbox" checked={privateOnly} onChange={(event) => setPrivateOnly(event.target.checked)} className="h-4 w-4 accent-blue-500" /> Только private/local маршруты
              </label>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white"><Cpu size={17} /> Hardware Doctor</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: 'RAM, ГБ', value: ramGb, set: setRamGb, icon: Cpu },
                  { label: 'VRAM, ГБ', value: vramGb, set: setVramGb, icon: Database },
                  { label: 'Disk, ГБ', value: diskGb, set: setDiskGb, icon: HardDrive },
                ].map((field) => (
                  <label key={field.label} className="text-xs text-gray-500"><span className="mb-1 flex items-center gap-1"><field.icon size={12} />{field.label}</span><input type="number" min={0} max={2048} value={field.value} onChange={(event) => field.set(Math.max(0, Number(event.target.value) || 0))} className="hub-input !px-3 !py-2" /></label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-live="polite" className={`rounded-xl border p-4 ${recommended ? 'border-emerald-400/25 bg-emerald-400/5' : 'border-amber-400/25 bg-amber-400/5'}`}>
          {recommended ? (
            <div className="flex items-start gap-3"><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-300" /><div><div className="font-semibold text-white">Рекомендуемый маршрут: {recommended.name}</div><p className="mt-1 text-sm text-gray-400">{recommended.privacy}. Перед production сверяем условия, стоимость и exact model artifact.</p></div></div>
          ) : (
            <div className="flex items-start gap-3"><ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-300" /><div><div className="font-semibold text-white">Безопасного маршрута пока нет</div><p className="mt-1 text-sm text-gray-400">Registry не выбирает модель с непроверенной лицензией или несовместимым hardware.</p></div></div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((model) => {
            const status = hardwareStatus(model, profile);
            return (
              <article key={model.id} className="hub-card eclipse-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold text-white">{model.name}</h2><p className="mt-1 text-xs text-gray-500">{model.provider}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${statusStyle[status]}`}>{statusLabel[status]}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{model.badges.map((badge) => <span key={badge} className="rounded-md border border-hub-border bg-hub-surface px-2 py-1 text-[11px] text-gray-300">{badge}</span>)}</div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-gray-500">Где работают данные</dt><dd className="mt-1 text-gray-300">{model.privacy}</dd></div>
                  <div><dt className="text-xs text-gray-500">Стоимость до запуска</dt><dd className="mt-1 text-gray-300">{model.cost}</dd></div>
                  <div><dt className="text-xs text-gray-500">Лицензия / commercial use</dt><dd className="mt-1 text-gray-300">{model.license}. {model.commercialUse}.</dd></div>
                  <div><dt className="text-xs text-gray-500">Минимум</dt><dd className="mt-1 text-gray-300">RAM {model.minRamGb} ГБ · VRAM {model.minVramGb} ГБ · Disk {model.minDiskGb} ГБ · {model.route === 'batch' ? 'очередь Eclipse Media' : 'interactive'}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
