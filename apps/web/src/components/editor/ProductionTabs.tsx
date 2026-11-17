'use client';
import { useMemo, useState } from 'react';
import { DEFAULT_CATALOG, STEEL_FINISH_ES, assemblySteps, catalogLookup, hwCategoryLabel, mermaidDiagram, patternLabel, type ManufacturingPlan, type Project } from '@ms/domain';
import { useLang } from '@/lib/lang';
import { assemblyGuide, cutPlanSvg } from '@ms/geometry';
import { saveBlob } from '@/lib/data/exports';
import { Alert, Badge, BigStat, Button, EmptyState, Hint, More, Stat } from '../ui';
import { NumberInput } from './inputs';

const L = catalogLookup(DEFAULT_CATALOG);
const vTone = (s: string) => (s === 'verified' ? 'ok' : s === 'blocked' ? 'err' : 'warn') as 'ok' | 'err' | 'warn';
const vLabel: Record<string, string> = { verified: 'Verificado', pending_validation: 'Pendiente validación', blocked: 'Bloqueado' };

export function PartsTab({ plan, selected, onSelect }: { plan: ManufacturingPlan; selected: string | null; onSelect: (id: string | null) => void }) {
  const { t } = useLang();
  const { calc } = plan;
  if (!calc.parts.length) return <EmptyState title="Sin piezas">Corrija los errores del módulo para generar el despiece.</EmptyState>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Stat label="Piezas totales" value={<span data-testid="stat-pieces">{calc.totals.panelCount}</span>} />
        <Stat label="Modelos de corte" value={calc.totals.partModels} />
        <Stat label="Área de tablero" value={`${calc.totals.panelAreaM2} m²`} />
        <Stat label="Peso de tableros" value={`${Math.round(calc.modules.reduce((s, m) => s + m.weightKg, 0) * 10) / 10} kg`} />
        {calc.edgeBands.map((e) => <Stat key={e.edgeBandId} label={L.edgeBand(e.edgeBandId).name} value={`${(e.netLengthMm / 1000).toFixed(2)} m neto · ${(e.purchaseLengthMm / 1000).toFixed(2)} m compra`} />)}
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table data-testid="parts-table">
          <thead><tr><th>ID</th><th>Pieza</th><th className="num">Cant.</th><th className="num">Final largo</th><th className="num">Final ancho</th><th className="num">Esp.</th><th className="num">Corte largo</th><th className="num">Corte ancho</th><th>Veta</th><th>L1</th><th>L2</th><th>A1</th><th>A2</th><th>Material</th><th>Acabado</th><th>Estado</th><th className="num">Mec.</th><th>Observaciones</th></tr></thead>
          <tbody>
            {calc.parts.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p.id === selected ? null : p.id)} className={`cursor-pointer ${p.id === selected ? 'bg-[#2b4252]' : 'hover:bg-[#1f2d39]'}`} aria-selected={p.id === selected}>
                <td className="font-mono text-[11px]">{t(p.id)}</td><td>{p.name}</td><td className="num">{p.quantity}</td>
                <td className="num">{p.lengthMm}</td><td className="num">{p.widthMm}</td><td className="num">{p.thicknessMm}</td><td className="num font-semibold">{p.cutLengthMm}</td><td className="num font-semibold">{p.cutWidthMm}</td><td>{p.grainAxis === 'length' ? 'Largo' : p.grainAxis === 'width' ? 'Ancho' : '—'}</td>
                {(['L1', 'L2', 'A1', 'A2'] as const).map((e) => <td key={e}>{p.edgeBand[e] ? '●' : '○'}</td>)}
                <td>{L.material(p.materialId).name}</td><td>{L.finish(p.finishId).name}</td>
                <td><Badge tone={vTone(p.validationStatus)}>{vLabel[p.validationStatus]}</Badge></td>
                <td className="num">{p.machiningOperationIds.length}</td>
                <td className="max-w-[260px] whitespace-normal text-[11px] text-muted">{t(p.notes.join(' · '))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Hint>Medida final = medida armada con tapacanto. Medida de corte = la que se corta en la seccionadora: final − espesor de canto en cada arista canteada (+ repasado configurado en Calidad). L1/L2 = aristas del largo (reducen el ancho); A1/A2 = aristas del ancho (reducen el largo); ● con canto.</Hint>
    </div>
  );
}

export function CutTab({ plan, project, onCut }: { plan: ManufacturingPlan; project: Project; onCut: (c: Project['cut']) => void }) {
  const { t, lang } = useLang();
  const svg = useMemo(() => cutPlanSvg(plan.nesting, plan.calc.parts, { title: project.name, lang }), [plan.nesting, plan.calc.parts, project.name, lang]);
  const total = plan.nesting.reduce((s, n) => s + (n.sheetsRequired ?? n.areaEstimate.sheetsEstimated), 0);
  const unplaced = plan.nesting.flatMap((n) => n.layout?.unplaced ?? []);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          <NumberInput label="Kerf (disco)" suffix="mm" value={project.cut.kerfMm} min={0} max={10} step={0.1} onChange={(v) => onCut({ ...project.cut, kerfMm: v })} />
          <NumberInput label="Escuadrado por lado" suffix="mm" value={project.cut.trimMarginMm} min={0} max={50} onChange={(v) => onCut({ ...project.cut, trimMarginMm: v })} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {plan.nesting.map((n) => <Badge key={n.materialId} tone={n.sheetsRequired !== null ? 'ok' : 'warn'}>{n.materialName}: {n.sheetsRequired ?? `~${n.areaEstimate.sheetsEstimated}`}</Badge>)}
        </div>
        <Button variant="secondary" className="ml-auto" onClick={() => saveBlob(svg, 'image/svg+xml', `${project.id}-plan-de-corte.svg`)} data-testid="download-cut-plan">Descargar plan</Button>
      </div>
      {unplaced.length ? <Alert tone="err">Sin acomodo: {t(unplaced.map((u) => `${u.partId}#${u.instance} (${u.reason})`).join('; '))}</Alert> : null}
      <div className="overflow-hidden rounded-xl bg-white" data-testid="cut-plan" aria-label={`Plan de corte: ${total} tableros`} dangerouslySetInnerHTML={{ __html: svg }} />
      <Hint>Todos los tableros en un solo plan. Cada material va en su propio tablero porque el espesor es distinto; si el proyecto necesita otro tablero, aparece abajo. Optimizador guillotina con kerf, escuadrado y veta: validar en la seccionadora del taller.</Hint>
    </div>
  );
}

export function HardwareTab({ plan }: { plan: ManufacturingPlan }) {
  const { t, lang } = useLang();
  const { calc, steel } = plan;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2"><Alert tone="warn">Cantidades orientativas: confirmar con la ficha de cada herraje.</Alert><Hint>Bisagras, correderas, conectores y anclajes requieren SKU con ficha técnica para quedar verificados; nunca se perfora con cotas genéricas.</Hint></div>
      <div className="max-h-[420px] overflow-auto">
        <table data-testid="hardware-table">
          <thead><tr><th>Módulo</th><th>Tipo</th><th>Descripción</th><th className="num">Cant.</th><th>Unidad</th><th>Regla</th><th>Estado</th></tr></thead>
          <tbody>{calc.hardware.map((h) => (
            <tr key={h.id}><td>{h.moduleId}</td><td>{hwCategoryLabel(h.category, lang)}</td><td>{h.description}</td><td className="num">{h.quantity}</td><td>{h.unit}</td><td className="max-w-[320px] whitespace-normal text-[11px] text-muted">{t(h.basis)}</td><td><Badge tone={vTone(h.validationStatus)}>{vLabel[h.validationStatus]}</Badge></td></tr>
          ))}</tbody>
        </table>
      </div>
      <h3 className="font-semibold">Herrería</h3>
      {steel.length === 0 ? <p className="text-[12.5px] text-muted">Sin herrería. Active «Bastidor PTR» en la base o la estructura de escritorio.</p> : (
        <>
          <Alert tone="err">Herrería estructural: requiere validación de cargas, soldadura y anclajes por responsable estructural. La liberación queda bloqueada sin evidencia.</Alert>
          {steel.map((s) => (
            <div key={s.profileId} className="rounded-xl border border-line p-3 text-[12.5px]">
              <p className="font-semibold">{s.profileName}: {s.layout.bars.length} barra(s) de {s.layout.barLengthMm / 1000} m · corte total {(s.layout.totalCutLengthMm / 1000).toFixed(2)} m · masa {s.massKg === null ? 'no calculada (kg/m pendiente de ficha)' : `${s.massKg} kg`}</p>
              <ul className="mt-1 list-disc pl-5">{s.layout.bars.map((b) => <li key={b.index}>Barra {b.index}: {b.cuts.map((c) => `${c.label} ${c.lengthMm}`).join(' + ')} mm · sobrante {b.remainderMm} mm</li>)}</ul>
            </div>
          ))}
          <table>
            <thead><tr><th>Módulo</th><th>Pieza</th><th>Sección</th><th className="num">Largo (mm)</th><th className="num">Cant.</th><th>Acabado</th></tr></thead>
            <tbody>{calc.steel.flatMap((r) => r.pieces.map((p) => <tr key={p.id}><td>{r.moduleId}</td><td>{p.label}</td><td>{r.sectionSpec}</td><td className="num">{p.lengthMm}</td><td className="num">{p.count}</td><td>{lang === 'en' ? r.finish : STEEL_FINISH_ES[r.finish] ?? r.finish}</td></tr>))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function MachiningTab({ plan }: { plan: ManufacturingPlan }) {
  const { t, lang } = useLang();
  const ops = plan.calc.machining;
  const qty = new Map(plan.calc.parts.map((p) => [p.id, p.quantity]));
  const pending = ops.filter((o) => o.validationStatus !== 'verified').reduce((n, o) => n + (qty.get(o.partId) ?? 1), 0);
  const byPattern: Record<string, number> = {};
  for (const o of ops) byPattern[o.patternId] = (byPattern[o.patternId] ?? 0) + (qty.get(o.partId) ?? 1);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(byPattern).map(([id, n]) => <BigStat key={id} value={n} label={patternLabel(id, lang)} />)}
        <BigStat value={pending} label="pendientes de ficha" tone={pending ? 'warn' : 'ok'} />
      </div>
      <More summary={`Lista de operaciones · ${ops.length}`}>
      <div className="max-h-[420px] overflow-auto">
        <table>
          <thead><tr><th>ID</th><th>Pieza</th><th>Patrón</th><th className="num">X</th><th className="num">Y</th><th className="num">Ø</th><th className="num">Prof.</th><th>Estado</th><th>Descripción</th></tr></thead>
          <tbody>{ops.map((o) => (
            <tr key={o.id}><td className="font-mono text-[11px]">{t(o.id)}</td><td>{t(o.partId)}</td><td>{patternLabel(o.patternId, lang)}</td><td className="num">{o.xMm ?? '—'}</td><td className="num">{o.yMm ?? '—'}</td><td className="num">{o.diameterMm ?? '—'}</td><td className="num">{o.depthMm ?? '—'}</td><td><Badge tone={vTone(o.validationStatus)}>{vLabel[o.validationStatus]}</Badge></td><td className="text-[11px] text-muted">{t(o.description)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      </More>
      <Hint>Sin ficha técnica del herraje no hay coordenadas: no perfores esas operaciones. No se generan programas CNC.</Hint>
    </div>
  );
}

export function AssemblyTab({ plan, project }: { plan: ManufacturingPlan; project: Project }) {
  const { t, lang } = useLang();
  const code = useMemo(() => mermaidDiagram(project, plan.calc, lang), [project, plan.calc, lang]);
  const guide = useMemo(() => assemblyGuide(project, plan.calc, DEFAULT_CATALOG, lang), [project, plan.calc, lang]);
  const [copied, setCopied] = useState(false);
  const multi = project.modules.length > 1;
  return (
    <div className="grid gap-4" data-testid="assembly-guide">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted"><span className="h-3 w-3 rounded-sm bg-[#eba24f]" />Pieza que se coloca en el paso</span>
        <Button variant="secondary" className="ml-auto" onClick={() => window.print()} data-testid="print-guide">Imprimir instructivo</Button>
      </div>
      {project.modules.map((m) => {
        const steps = guide.filter((g) => g.moduleId === m.id);
        if (!steps.length) return null;
        return (
          <section key={m.id} className="grid gap-2">
            {multi && <h3 className="text-[15px] font-bold">{m.id} · {m.label}</h3>}
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {steps.map((st) => (
                <li key={st.number} className="flex break-inside-avoid flex-col overflow-hidden rounded-xl border border-line bg-panel-2" data-testid="assembly-step">
                  <div className="flex items-center gap-2 px-3 pt-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d9480f] text-[15px] font-extrabold text-white">{st.number}</span>
                    <h4 className="text-[14.5px] font-bold leading-tight">{st.title}</h4>
                  </div>
                  <div className="m-2 overflow-hidden rounded-lg bg-white [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: st.svg }} />
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                    {st.hardware.map((h) => <span key={h} className="rounded-full bg-[#1d3140] px-2 py-0.5 text-[12px] font-semibold text-[#cfeff7]">{h}</span>)}
                    {st.tip && <p className="w-full text-[12px] text-warn">{st.tip}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <More summary="Pasos en texto (detalle técnico)">
        <div className="grid gap-3">
          {project.modules.map((m) => (
            <section key={m.id}>
              <h3 className="mb-1 font-semibold">{m.id} · {m.label}</h3>
              <ol className="list-decimal space-y-1 pl-6 text-[13px]">
                {assemblySteps(m, plan.calc).map((s) => (
                  <li key={s.id} className="break-words"><span className="font-semibold">{s.title}</span>{s.pending && <> <Badge tone="warn">pendiente de validación</Badge></>} — <span className="text-muted">{t(s.detail)}</span></li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </More>
      <More summary="Diagrama de dependencias (Mermaid)">
        <div className="mb-1 flex justify-end"><Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copiado' : 'Copiar Mermaid'}</Button></div>
        <pre data-testid="mermaid-code" className="max-h-[360px] overflow-auto">{code}</pre>
      </More>
    </div>
  );
}
