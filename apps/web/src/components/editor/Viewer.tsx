'use client';
import { useMemo, useState } from 'react';
import { DEFAULT_CATALOG, type ProjectCalculation, type Project } from '@ms/domain';
import { buildScene, sceneToSvg, type ViewKind } from '@ms/geometry';
import { Download, EyeOff, Hash, Layers } from 'lucide-react';
import { Hint } from '../ui';

export function Viewer({ project, calc, selected, onSelect }: { project: Project; calc: ProjectCalculation; selected: string | null; onSelect: (id: string | null) => void }) {
  const [view, setView] = useState<ViewKind>('iso');
  const [exploded, setExploded] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [hideFronts, setHideFronts] = useState(false);
  const scene = useMemo(() => buildScene(project, calc, DEFAULT_CATALOG, { view, exploded, showIds, hideFronts, selectedPartId: selected, noTitle: true }), [project, calc, view, exploded, showIds, hideFronts, selected]);
  const views: { v: ViewKind; label: string }[] = [{ v: 'iso', label: 'Isométrico' }, { v: 'front', label: 'Frente' }, { v: 'side', label: 'Lateral' }, { v: 'top', label: 'Planta' }];

  function downloadSvg() {
    const blob = new Blob([sceneToSvg(scene, 'light')], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.id}-${view}${exploded ? '-despiece' : ''}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div role="radiogroup" aria-label="Vista" className="flex gap-1">
          {views.map((x) => (
            <button key={x.v} type="button" role="radio" aria-checked={view === x.v} onClick={() => setView(x.v)}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${view === x.v ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}>{x.label}</button>
          ))}
        </div>
        <button type="button" aria-pressed={exploded} onClick={() => setExploded(!exploded)} title="Separar piezas" aria-label="Separar piezas" data-testid="toggle-exploded"
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${exploded ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}><Layers aria-hidden className="h-4 w-4" /><span className="hidden sm:inline">Separar piezas</span></button>
        <button type="button" aria-pressed={showIds} onClick={() => setShowIds(!showIds)} title="IDs" aria-label="IDs"
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${showIds ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}><Hash aria-hidden className="h-4 w-4" /><span className="hidden sm:inline">IDs</span></button>
        <button type="button" aria-pressed={hideFronts} onClick={() => setHideFronts(!hideFronts)} title="Sin frentes" aria-label="Sin frentes"
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${hideFronts ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}><EyeOff aria-hidden className="h-4 w-4" /><span className="hidden sm:inline">Sin frentes</span></button>
        <button type="button" onClick={downloadSvg} title="Descargar SVG de esta vista" aria-label="Descargar SVG de esta vista" className="flex h-8 items-center rounded-lg bg-[#253541] px-2"><Download aria-hidden className="h-4 w-4" /></button>
      </div>
      <div className="overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,#304555,#14202a_75%)]">
        <svg viewBox={`0 0 ${scene.width} ${scene.height}`} className="h-auto w-full max-h-[620px]" role="img" aria-label={scene.ariaLabel} data-testid="model-svg" fontFamily="Inter, system-ui, sans-serif">
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#ffbe66" strokeWidth="1.2" /></marker></defs>
          {scene.polygons.map((p) => (
            <polygon key={p.key} data-part-id={p.partId} points={p.points.map((x) => x.join(',')).join(' ')} fill={p.fill} stroke={p.stroke} strokeWidth={p.selected ? 2.4 : 1} strokeLinejoin="round"
              className="cursor-pointer" onClick={() => onSelect(p.partId === selected ? null : p.partId)}>
              <title>{p.partId}</title>
            </polygon>
          ))}
          {scene.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#ffbe66" strokeWidth={1.3} markerStart="url(#arrow)" markerEnd="url(#arrow)" />)}
          {scene.labels.map((t, i) => (
            <text key={i} x={t.x} y={t.y} textAnchor={t.anchor}
              {...(t.kind === 'title' ? { fontSize: 17, fill: '#a7dae4', fontWeight: 700 } : t.kind === 'subtitle' ? { fontSize: 12, fill: '#c8d3df' } : t.kind === 'dim' ? { fontSize: 14, fill: '#ffe0a9', fontWeight: 700, stroke: '#17202a', strokeWidth: 3.5, paintOrder: 'stroke' } : { fontSize: 10.5, fill: '#fff', stroke: '#0b1218', strokeWidth: 3, paintOrder: 'stroke', pointerEvents: 'none' })}>
              {t.text}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">{selected && <span className="rounded-full bg-[#2b4252] px-2 py-0.5 font-semibold">Pieza: {selected}</span>}<Hint>Toca una pieza para seleccionarla. El dibujo sale de las mismas medidas del despiece; es un esquema, no un render ni un plano CNC.</Hint></div>
    </div>
  );
}
