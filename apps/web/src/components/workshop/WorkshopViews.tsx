'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Box } from 'lucide-react';
import { EQUIPMENT, STATIONS, equipmentFocus, stationFocus, type ModelFocus, type Project, type ProjectCalculation, type EquipmentItem, type EquipmentNeed, type NeedLevel, type RouteStation, type StationDefinition, type StationId } from '@ms/domain';
import { PPE_INFO, STATION_ICON, TriangleAlert } from '../icons';
import { Badge, type Tone } from '../ui';
import { ModelSheet, type ModelTarget } from './ModelSheet';
import { useLang } from '@/lib/lang';

const NEED_TONE: Record<NeedLevel, Tone> = { esencial: 'ok', recomendado: 'info', opcional: 'neutral' };
const NEED_LABEL: Record<NeedLevel, string> = { esencial: 'Esencial', recomendado: 'Recomendado', opcional: 'Opcional' };
const equipmentName = (id: string) => EQUIPMENT.find((e) => e.id === id)?.name ?? id;
const anchor = (id: string) => `equipo-${id}`;

interface ModelCtx { calc: ProjectCalculation; open: (t: ModelTarget) => void }
const ModelContext = createContext<ModelCtx | null>(null);

/** Da a la ruta y a las fichas de equipo un modelo donde señalar dónde se usa cada cosa. */
export function WorkshopModelProvider({ project, calc, children }: { project: Project; calc: ProjectCalculation; children: ReactNode }) {
  const [target, setTarget] = useState<ModelTarget | null>(null);
  const close = useCallback(() => setTarget(null), []);
  const value = useMemo(() => ({ calc, open: setTarget }), [calc]);
  return (
    <ModelContext.Provider value={value}>
      {children}
      <ModelSheet target={target} project={project} calc={calc} onClose={close} />
    </ModelContext.Provider>
  );
}

function ModelButton({ title, focus, testId }: { title: string; focus: (calc: ProjectCalculation) => ModelFocus; testId: string }) {
  const ctx = useContext(ModelContext);
  const f = useMemo(() => (ctx ? focus(ctx.calc) : null), [ctx, focus]);
  if (!ctx || !f || f.empty) return null;
  return (
    <button type="button" onClick={() => ctx.open({ title, focus: f })} data-testid={testId}
      className="flex w-fit items-center gap-1.5 rounded-lg border border-[#3c6074] bg-[#162a36] px-2.5 py-1 text-[12.5px] font-semibold text-[#bce8f2] hover:bg-[#1d3140]">
      <Box aria-hidden className="h-4 w-4" />Ver en el modelo
    </button>
  );
}

type FlowStation = (RouteStation | (StationDefinition & { number: number; equipmentIds: string[]; metrics?: RouteStation['metrics']; highlights?: string[]; alerts?: string[]; parallel?: boolean }));

function StationIcon({ id, className = 'h-5 w-5' }: { id: StationId; className?: string }) {
  const Icon = STATION_ICON[id];
  return <Icon aria-hidden className={className} />;
}

/**
 * Ruta de taller: una línea por estación (número, ícono, nombre y cifras clave).
 * Los avisos siempre se ven; el detalle (objetivo, equipo, todas las cifras) se abre al tocar.
 */
export function RouteFlow({ stations }: { stations: FlowStation[] }) {
  const { t } = useLang();
  return (
    <ol className="grid" aria-label="Ruta de taller" data-testid="route-flow">
      {stations.map((s, i) => (
        <li key={s.id} className="grid grid-cols-[36px_1fr] gap-2.5">
          <div className="flex flex-col items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f6f86] text-[15px] font-bold text-white" aria-hidden>{s.number}</span>
            {i < stations.length - 1 && <span className="w-[3px] flex-1 bg-[#2f6f86]/50" aria-hidden />}
          </div>
          <div className="mb-2.5 min-w-0">
            <details className={`group rounded-xl border bg-panel-2 ${s.parallel ? 'border-dashed border-[#c98a3d]' : 'border-line'}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-[15px] font-bold">
                  <StationIcon id={s.id} />
                  <span><span className="sr-only">Paso {s.number}: </span>{s.name}</span>
                  {s.parallel && <span className="text-[11px] font-semibold text-warn">en paralelo</span>}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {s.highlights?.map((h) => <span key={h} className="rounded-full bg-[#1d3140] px-2 py-0.5 text-[12px] font-semibold text-[#cfeff7]">{t(h)}</span>)}
                </span>
                <span aria-hidden className="ml-auto text-muted transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="grid gap-2 border-t border-line px-3 py-2.5 text-[12.5px]">
                <p>{s.goal}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.equipmentIds.map((id) => <a key={id} href={`#${anchor(id)}`} className="rounded-full border border-[#3c6074] px-2 py-0.5 text-[11.5px] font-semibold text-[#bce8f2] hover:underline">{equipmentName(id)}</a>)}
                </div>
                <ModelButton title={s.name} focus={(c) => stationFocus(s.id, s.equipmentIds, c)} testId={`station-model-${s.id}`} />
                {!!s.metrics?.length && (
                  <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                    {s.metrics.map((m) => <div key={m.label} className="flex gap-1.5"><dt className="text-muted">{m.label}:</dt><dd className="font-semibold">{t(m.value)}</dd></div>)}
                  </dl>
                )}
              </div>
            </details>
            {s.alerts?.map((a) => (
              <p key={a} className="mt-1 flex items-start gap-1.5 rounded-lg bg-warn-bg px-2 py-1 text-[12px] text-warn"><TriangleAlert aria-hidden className="mt-[1px] h-3.5 w-3.5 shrink-0" />{t(a)}</p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Pasos cortos encadenados con flechas (vertical en móvil). */
export function StepChain({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-1.5" aria-label="Pasos">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          <span className="flex items-center gap-1.5 rounded-lg border border-[#3c6074] bg-[#162a36] px-2 py-1 text-[12.5px]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</span>
            {s}
          </span>
          {i < steps.length - 1 && <span className="hidden px-1 text-[#5fb3c9] sm:inline" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}

function PpeRow({ item }: { item: EquipmentItem }) {
  if (!item.ppe.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Equipo de protección">
      {item.ppe.map((p) => {
        const { icon: Icon, label } = PPE_INFO[p];
        return <li key={p} title={label} className="flex items-center gap-1 rounded-full border border-[#907448] bg-warn-bg px-2 py-0.5 text-[11.5px] font-semibold text-warn"><Icon aria-hidden className="h-3.5 w-3.5" />{label}</li>;
      })}
    </ul>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-0.5 text-[11.5px] font-bold uppercase tracking-wide text-[#9bc7d5]">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

/** Ficha de equipo: lo esencial a la vista (pasos, EPP); el resto en «Detalles». */
export function EquipmentCard({ item, need }: { item: EquipmentItem; need?: EquipmentNeed }) {
  const { t } = useLang();
  return (
    <article id={anchor(item.id)} className="flex scroll-mt-20 flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3" data-testid={`equipment-${item.id}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <StationIcon id={item.station} className="mt-0.5 h-5 w-5 shrink-0 text-[#5fb3c9]" />
          <div>
            <h3 className="text-[14.5px] font-bold leading-tight">{item.name}</h3>
            {need && <p className="text-[12px] text-muted">{need.reason}</p>}
          </div>
        </div>
        {need && <Badge tone={NEED_TONE[need.need]}>{NEED_LABEL[need.need]}</Badge>}
      </header>
      <StepChain steps={item.steps} />
      <PpeRow item={item} />
      <ModelButton title={item.name} focus={(c) => equipmentFocus(item.id, c)} testId={`equipment-model-${item.id}`} />
      <details className="group mt-auto">
        <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-[#bce8f2] [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver detalles ▾</span><span className="hidden group-open:inline">Ocultar detalles ▴</span>
        </summary>
        <div className="mt-2 grid gap-2.5">
          <p className="text-[12.5px] text-muted">{item.purpose}</p>
          <ListBlock title="Con los datos de este proyecto" items={(need?.projectSettings ?? []).map(t)} />
          <ListBlock title="Puntos críticos" items={item.keySettings} />
          <ListBlock title="Revisar al terminar" items={item.qualityChecks} />
          <ListBlock title="Seguridad" items={item.safety} />
          <ListBlock title="Si no tienes este equipo" items={item.alternatives} />
          <ListBlock title="Consumibles" items={item.consumables} />
        </div>
      </details>
    </article>
  );
}

/** Rejilla de equipos filtrable por necesidad (reemplaza la tabla larga). */
export function EquipmentGrid({ needs }: { needs: EquipmentNeed[] }) {
  const [level, setLevel] = useState<'' | NeedLevel>('esencial');
  const shown = needs.filter((n) => !level || n.need === level);
  const options: ('' | NeedLevel)[] = ['esencial', 'recomendado', 'opcional', ''];
  return (
    <div className="grid gap-3" data-testid="tool-table">
      <div role="radiogroup" aria-label="Mostrar equipo" className="flex flex-wrap gap-1.5">
        {options.map((l) => {
          const count = l ? needs.filter((n) => n.need === l).length : needs.length;
          if (l && !count) return null;
          return (
            <button key={l || 'todo'} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${level === l ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}>
              {l ? NEED_LABEL[l] : 'Todo'} · {count}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{shown.map((n) => <EquipmentCard key={n.item.id} item={n.item} need={n} />)}</div>
    </div>
  );
}

export const ALL_STATIONS = STATIONS;
