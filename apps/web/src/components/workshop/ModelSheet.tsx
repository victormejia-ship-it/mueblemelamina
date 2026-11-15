'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ModelFocus, Project, ProjectCalculation } from '@ms/domain';
import { Viewer } from '../editor/Viewer';

export interface ModelTarget { title: string; focus: ModelFocus }

/** Hoja con el modelo 3D enfocado en lo que toca la herramienta o el paso. */
export function ModelSheet({ target, project, calc, onClose }: { target: ModelTarget | null; project: Project; calc: ProjectCalculation; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);
  if (!target) return null;
  const f = target.focus;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label={`Modelo: ${target.title}`} onClick={onClose} data-testid="model-sheet">
      <div className="ms-fade-up max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-line bg-panel p-3 sm:max-w-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold">{target.title}</h2>
            <p className="text-[12.5px] text-muted">{f.note}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-[#22313e]"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
          <span className="flex items-center gap-1 rounded-full bg-[#1d3140] px-2 py-0.5"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#5fd4ef]" />Dónde se usa</span>
          {f.edges && <span className="flex items-center gap-1 rounded-full bg-[#1d3140] px-2 py-0.5"><span className="h-[3px] w-4 rounded bg-[#ff9f43]" />Canto</span>}
          {f.diagonals && <span className="flex items-center gap-1 rounded-full bg-[#1d3140] px-2 py-0.5"><span className="w-4 border-t-2 border-dashed border-[#5fd4ef]" />Diagonales</span>}
        </div>
        <Viewer project={project} calc={calc} selected={selected} onSelect={setSelected} focus={f} />
      </div>
    </div>
  );
}
