'use client';
import { useMemo, useState } from 'react';
import { EQUIPMENT, EQUIPMENT_CATEGORY_LABEL, STATIONS, type EquipmentItem, type EquipmentNeed, type NeedLevel, type RouteStation, type StationDefinition } from '@ms/domain';
import { Badge, type Tone } from '../ui';

const NEED_TONE: Record<NeedLevel, Tone> = { esencial: 'ok', recomendado: 'info', opcional: 'neutral' };
const NEED_LABEL: Record<NeedLevel, string> = { esencial: 'Esencial', recomendado: 'Recomendado', opcional: 'Opcional' };
const stationName = (id: string) => STATIONS.find((s) => s.id === id)?.name ?? id;
const equipmentName = (id: string) => EQUIPMENT.find((e) => e.id === id)?.name ?? id;
const anchor = (id: string) => `equipo-${id}`;

/** Flujo vertical de estaciones: número, objetivo, entrada → salida, equipo, cifras y avisos. */
export function RouteFlow({ stations }: { stations: (RouteStation | (StationDefinition & { number: number; equipmentIds: string[]; metrics?: RouteStation['metrics']; alerts?: string[]; parallel?: boolean }))[] }) {
  return (
    <ol className="grid gap-0" aria-label="Ruta de taller" data-testid="route-flow">
      {stations.map((s, i) => (
        <li key={s.id} className="grid grid-cols-[44px_1fr] gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f6f86] text-[15px] font-bold text-white" aria-hidden>{s.number}</span>
            {i < stations.length - 1 && <span className="w-[3px] flex-1 bg-[#2f6f86]/60" aria-hidden />}
            {i < stations.length - 1 && <span className="-mt-1 text-[#2f6f86]" aria-hidden>▼</span>}
          </div>
          <div className={`mb-3 rounded-xl border bg-panel-2 p-3 ${s.parallel ? 'border-dashed border-[#c98a3d]' : 'border-line'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-bold"><span className="sr-only">Paso {s.number}: </span>{s.name}{s.parallel && <span className="ml-2 text-[11.5px] font-semibold text-warn">en paralelo con la carpintería</span>}</h3>
              <span className="text-[11.5px] text-muted">{s.input} <span aria-hidden>→</span><span className="sr-only">resultado:</span> {s.output}</span>
            </div>
            <p className="mt-1 text-[13px]">{s.goal}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.equipmentIds.map((id) => <a key={id} href={`#${anchor(id)}`} className="rounded-full border border-[#3c6074] bg-[#1d3140] px-2 py-0.5 text-[11.5px] font-semibold text-[#bce8f2] hover:underline">{equipmentName(id)}</a>)}
            </div>
            {!!s.metrics?.length && (
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
                {s.metrics.map((m) => <div key={m.label} className="flex gap-1.5"><dt className="text-muted">{m.label}:</dt><dd className="font-semibold">{m.value}</dd></div>)}
              </dl>
            )}
            {s.alerts?.map((a) => <p key={a} className="mt-2 rounded-lg border border-[#907448] bg-warn-bg px-2 py-1 text-[12px] text-warn">⚠ {a}</p>)}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Pasos de la operación como cadena numerada (horizontal en pantalla ancha, vertical en móvil). */
export function StepChain({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0" aria-label="Pasos de la operación">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-col items-stretch sm:flex-row sm:items-center">
          <div className="flex items-start gap-2 rounded-lg border border-[#3c6074] bg-[#162a36] px-2.5 py-1.5 text-[12.5px] sm:max-w-[190px]">
            <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</span>
            <span>{s}</span>
          </div>
          {i < steps.length - 1 && <span className="self-center px-1.5 text-[#5fb3c9] sm:py-0" aria-hidden><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></span>}
        </li>
      ))}
    </ol>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone?: 'warn' | 'ok' }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={`mb-1 text-[12px] font-bold uppercase tracking-wide ${tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-[#9bc7d5]'}`}>{title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

export function EquipmentCard({ item, need }: { item: EquipmentItem; need?: EquipmentNeed }) {
  return (
    <article id={anchor(item.id)} className="scroll-mt-20 rounded-xl border border-line bg-panel-2 p-3" data-testid={`equipment-${item.id}`}>
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold">{item.name}</h3>
          <p className="text-[12.5px] text-muted">{item.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_CATEGORY_LABEL[item.category] !== stationName(item.station) && <Badge tone="neutral">{EQUIPMENT_CATEGORY_LABEL[item.category]}</Badge>}
          <Badge tone="info">{stationName(item.station)}</Badge>
          {need && <Badge tone={NEED_TONE[need.need]}>{NEED_LABEL[need.need]}</Badge>}
        </div>
      </header>
      {need && <p className="mb-2 text-[12.5px]"><span className="text-muted">En este proyecto:</span> <strong>{need.reason}</strong></p>}
      <StepChain steps={item.steps} />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ListBlock title="Ajustes para este proyecto" items={need?.projectSettings ?? []} tone="ok" />
        <ListBlock title="Ajustes y puntos críticos" items={item.keySettings} />
        <ListBlock title="Seguridad (EPP)" items={item.safety} tone="warn" />
        <ListBlock title="Control al terminar" items={item.qualityChecks} />
        <ListBlock title="Alternativas" items={item.alternatives} />
        <ListBlock title="Consumibles" items={item.consumables} />
      </div>
    </article>
  );
}

export function ToolTable({ needs }: { needs: EquipmentNeed[] }) {
  const [level, setLevel] = useState<'' | NeedLevel>('');
  const shown = useMemo(() => needs.filter((n) => !level || n.need === level), [needs, level]);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12.5px] text-muted" htmlFor="tool-filter">Mostrar</label>
        <select id="tool-filter" className="!w-48" value={level} onChange={(e) => setLevel(e.target.value as '' | NeedLevel)}>
          <option value="">Todo el equipo ({needs.length})</option>
          {(['esencial', 'recomendado', 'opcional'] as const).map((l) => <option key={l} value={l}>{NEED_LABEL[l]} ({needs.filter((n) => n.need === l).length})</option>)}
        </select>
      </div>
      <div className="overflow-auto">
        <table data-testid="tool-table">
          <thead><tr><th>Equipo</th><th>Estación</th><th>Necesidad</th><th>Para qué en este proyecto</th></tr></thead>
          <tbody>{shown.map((n) => (
            <tr key={n.item.id}>
              <td><a className="font-semibold text-[#bce8f2] hover:underline" href={`#${anchor(n.item.id)}`}>{n.item.name}</a></td>
              <td>{stationName(n.item.station)}</td>
              <td><Badge tone={NEED_TONE[n.need]}>{NEED_LABEL[n.need]}</Badge></td>
              <td className="whitespace-normal">{n.reason}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
