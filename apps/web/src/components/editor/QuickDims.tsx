'use client';
import type { ModuleSpec } from '@ms/domain';
import { NumberInput } from './inputs';

/** Medidas rápidas junto al dibujo: módulo activo + ancho, alto y fondo. */
export function QuickDims({ modules, selected, onSelect, onChange, disabled }: {
  modules: ModuleSpec[]; selected: string; onSelect: (id: string) => void; onChange: (m: ModuleSpec) => void; disabled?: boolean;
}) {
  const m = modules.find((x) => x.id === selected) ?? modules[0]!;
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-panel-2 p-2.5" data-testid="quick-dims">
      {modules.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Módulo">
          {modules.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === m.id} onClick={() => onSelect(x.id)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${x.id === m.id ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}>{x.id} · {x.label}</button>
          ))}
        </div>
      )}
      <fieldset disabled={disabled} className="grid grid-cols-3 gap-2">
        <legend className="sr-only">Medidas de {m.label}</legend>
        <NumberInput label="Ancho" suffix="mm" value={m.widthMm} min={1} max={6000} onChange={(v) => onChange({ ...m, widthMm: v })} testId="quick-width" />
        <NumberInput label="Alto" suffix="mm" value={m.heightMm} min={1} max={4000} onChange={(v) => onChange({ ...m, heightMm: v })} testId="quick-height" />
        <NumberInput label="Fondo" suffix="mm" value={m.depthMm} min={1} max={2000} onChange={(v) => onChange({ ...m, depthMm: v })} testId="quick-depth" />
      </fieldset>
    </div>
  );
}
