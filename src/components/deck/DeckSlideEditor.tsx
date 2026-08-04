import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { DeckSlide } from '../../services/deckWorkflowService';

interface DeckSlideEditorProps {
  slide: DeckSlide;
  index: number;
  total: number;
  disabled: boolean;
  onSave: (patch: Pick<DeckSlide, 'title' | 'bullets' | 'speakerNotes'>) => boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

export const DeckSlideEditor: React.FC<DeckSlideEditorProps> = ({ slide, index, total, disabled, onSave, onMove, onRemove }) => {
  const [title, setTitle] = useState(slide.title);
  const [bullets, setBullets] = useState(slide.bullets.join('\n'));
  const [speakerNotes, setSpeakerNotes] = useState(slide.speakerNotes);

  useEffect(() => {
    setTitle(slide.title);
    setBullets(slide.bullets.join('\n'));
    setSpeakerNotes(slide.speakerNotes);
  }, [slide]);

  const save = () => {
    const saved = onSave({
      title,
      bullets: bullets.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      speakerNotes,
    });
    if (!saved) {
      setTitle(slide.title);
      setBullets(slide.bullets.join('\n'));
      setSpeakerNotes(slide.speakerNotes);
    }
  };

  return (
    <article className="hub-card eclipse-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-hub-border bg-black/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-hub-border bg-hub-surface text-xs font-semibold text-hub-accent">{index + 1}</span>
          <div><div className="text-sm font-medium text-white">Слайд {index + 1}</div><div className="text-[11px] uppercase tracking-wider text-gray-500">{slide.kind}</div></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} className="hub-btn-ghost !p-2 disabled:opacity-30" aria-label="Поднять слайд"><ArrowUp size={15} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={disabled || index === total - 1} className="hub-btn-ghost !p-2 disabled:opacity-30" aria-label="Опустить слайд"><ArrowDown size={15} /></button>
          <button type="button" onClick={onRemove} disabled={disabled || total <= 3} className="hub-btn-ghost !p-2 text-red-300 disabled:opacity-30" aria-label="Удалить слайд"><Trash2 size={15} /></button>
        </div>
      </header>
      <div className="grid gap-4 p-4 sm:p-5">
        <label className="text-sm text-gray-300">Заголовок<input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={save} disabled={disabled} maxLength={120} className="hub-input mt-2" /></label>
        <label className="text-sm text-gray-300">Тезисы — один на строку<textarea value={bullets} onChange={(event) => setBullets(event.target.value)} onBlur={save} disabled={disabled} maxLength={4_000} className="hub-input mt-2 min-h-28 resize-y" /></label>
        <label className="text-sm text-gray-300">Заметки спикера<textarea value={speakerNotes} onChange={(event) => setSpeakerNotes(event.target.value)} onBlur={save} disabled={disabled} maxLength={2_000} className="hub-input mt-2 min-h-20 resize-y" placeholder="Что сказать вслух, но не показывать на слайде" /></label>
      </div>
    </article>
  );
};
