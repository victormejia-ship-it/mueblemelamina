'use client';
import { useMemo, useState } from 'react';
import { DEFAULT_CATALOG, DEFAULT_MARKET, MARKET_REFERENCE_DATE, MARKET_REGION, marketEstimate, type ManufacturingPlan, type MarketSettings, type PriceTier, type PricingSettings, type Project } from '@ms/domain';
import { BadgeDollarSign, Check, ClipboardCopy, Lightbulb, Ruler, TrendingUp, Wallet } from 'lucide-react';
import { Badge, BigStat, Button, Hint, More, type Tone } from '../ui';
import { NumberInput } from './inputs';

const mxn = (c: number | null) => (c === null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(c / 100));
const POS: Record<PriceTier['position'], { tone: Tone; label: string }> = {
  debajo: { tone: 'warn', label: 'Debajo del mercado' },
  dentro: { tone: 'ok', label: 'Dentro del mercado' },
  arriba: { tone: 'err', label: 'Arriba del mercado' },
  sin_referencia: { tone: 'neutral', label: 'Sin referencia' },
};
const SOURCE: Record<string, { tone: Tone; label: string }> = {
  proveedor: { tone: 'ok', label: 'Proveedor' },
  capturado: { tone: 'info', label: 'Capturado' },
  referencia: { tone: 'warn', label: 'Referencia MTY' },
  sin_precio: { tone: 'err', label: 'Sin precio' },
};
const COST_COLORS = ['#4fb3c9', '#7fc8a9', '#e0b45a', '#b38ad6', '#8a9bab', '#d9826b'];

/** Costeo completo y precio de venta sugerido para Monterrey. */
export function PriceTab({ plan, project, onPricing, readOnly }: { plan: ManufacturingPlan; project: Project; onPricing: (p: PricingSettings) => void; readOnly?: boolean }) {
  const settings = project.pricing.market ?? DEFAULT_MARKET;
  const e = useMemo(() => marketEstimate(project, plan, DEFAULT_CATALOG, settings), [project, plan, settings]);
  const [chosen, setChosen] = useState<PriceTier['id'] | null>(null);
  const [copied, setCopied] = useState(false);
  const tier = e.tiers.find((t) => t.id === (chosen ?? e.recommended))!;
  const setM = (patch: Partial<MarketSettings>) => onPricing({ ...project.pricing, market: { ...settings, ...patch } });
  const t = e.totals;
  const parts = [
    { label: 'Material', v: t.materialsCents }, { label: 'Consumibles', v: t.consumablesCents }, { label: 'Mano de obra', v: t.laborCents },
    { label: 'Flete', v: t.transportCents }, { label: 'Indirectos', v: t.overheadCents }, { label: 'Imprevistos', v: t.contingencyCents },
  ];

  // Escala de la barra de mercado
  const lo = Math.min(t.costCents, e.market?.lowCents ?? t.costCents, ...e.tiers.map((x) => x.beforeTaxCents)) * 0.92;
  const hi = Math.max(e.market?.highCents ?? 0, ...e.tiers.map((x) => x.beforeTaxCents)) * 1.05;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;

  function proposal() {
    const led = tier.withoutLedBeforeTaxCents !== null;
    const tax = project.pricing.taxRatePct;
    const lines = [
      `Propuesta: ${project.name}`,
      project.customer ? `Cliente: ${project.customer}` : '',
      project.site ? `Obra: ${project.site}` : '',
      `${project.modules.length} módulo(s) · ${e.linearM} m lineales · melamina con canto PVC, herrajes${led ? ' e iluminación LED empotrada' : ''}, fabricación e instalación.`,
      '',
      `Precio: ${mxn(tier.beforeTaxCents)} + IVA (${tax} %) = ${mxn(tier.totalCents)}`,
      led ? `Opción sin LED: ${mxn(tier.withoutLedBeforeTaxCents)} + IVA = ${mxn(Math.round(tier.withoutLedBeforeTaxCents! * (1 + tax / 100)))}` : '',
      `Anticipo 60 %: ${mxn(Math.round(tier.totalCents * 0.6))} · Resto contra entrega e instalación.`,
      'No incluye cubierta, electrodomésticos, plomería ni instalación eléctrica a 127 V.',
      'Vigencia: 15 días (precios de material sujetos a cambio del proveedor).',
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '');
    void navigator.clipboard?.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  return (
    <div className="grid gap-5" data-testid="price-tab">
      <div className="flex flex-wrap items-center gap-2">
        <BigStat icon={<Wallet className="h-5 w-5" />} value={mxn(t.costCents)} label="costo total" />
        <BigStat icon={<BadgeDollarSign className="h-5 w-5" />} value={<span data-testid="price-recommended">{mxn(tier.beforeTaxCents)}</span>} label={`precio ${tier.label.toLowerCase()} + IVA`} tone="ok" />
        <BigStat icon={<TrendingUp className="h-5 w-5" />} value={mxn(tier.beforeTaxCents - t.costCents)} label={`utilidad (${tier.marginPct} %)`} tone="info" />
        {tier.perLinearMCents !== null && <BigStat icon={<Ruler className="h-5 w-5" />} value={mxn(tier.perLinearMCents)} label="por metro lineal" />}
        <Button className="ml-auto" variant="secondary" onClick={proposal} data-testid="copy-proposal">{copied ? <Check aria-hidden className="mr-1 inline h-4 w-4" /> : <ClipboardCopy aria-hidden className="mr-1 inline h-4 w-4" />}{copied ? 'Copiada' : 'Copiar propuesta'}</Button>
      </div>

      {/* Niveles de precio */}
      <section>
        <div className="mb-2 flex items-center gap-2"><h2 className="text-[16px] font-bold">Precio de venta</h2><Hint>Tres niveles con distinto margen sobre venta. Se compara cada uno con el rango de precios de Monterrey para este tipo de mueble ({MARKET_REGION}, referencia {MARKET_REFERENCE_DATE}).</Hint></div>
        <div role="radiogroup" aria-label="Nivel de precio" className="grid gap-2 sm:grid-cols-3">
          {e.tiers.map((x) => {
            const sel = x.id === tier.id;
            return (
              <button key={x.id} type="button" role="radio" aria-checked={sel} onClick={() => setChosen(x.id)} data-testid={`tier-${x.id}`}
                className={`grid gap-1 rounded-xl border p-3 text-left transition ${sel ? 'border-accent bg-[#173342] ring-2 ring-accent/40' : 'border-line bg-panel-2 hover:border-[#4b6a7d]'}`}>
                <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold">{x.label}<span className="text-[12px] font-semibold text-muted">margen {x.marginPct} %</span>{x.id === e.recommended && <Badge tone="ok">Recomendado</Badge>}</span>
                <span className="text-[22px] font-extrabold leading-tight">{mxn(x.beforeTaxCents)}<span className="ml-1 text-[12px] font-semibold text-muted">+ IVA</span></span>
                <span className="text-[12.5px] text-muted">Total con IVA <b className="text-[#e5edf3]">{mxn(x.totalCents)}</b>{x.perLinearMCents !== null && <> · {mxn(x.perLinearMCents)}/m</>}</span>
                {x.withoutLedBeforeTaxCents !== null && <span className="text-[12px] text-[#ffe27a]">Sin LED: {mxn(x.withoutLedBeforeTaxCents)} + IVA</span>}
                <span><Badge tone={POS[x.position].tone}>{POS[x.position].label}</Badge></span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Rango de mercado */}
      {e.market && (
        <section data-testid="market-bar">
          <h3 className="mb-1 text-[13px] font-bold">Mercado en Monterrey (sin IVA)</h3>
          <div className="relative h-14">
            <div className="absolute top-5 h-3 w-full rounded-full bg-[#253541]" />
            <div className="absolute top-5 h-3 rounded-full bg-[#2f7a55]" style={{ left: pct(e.market.lowCents), width: `calc(${pct(e.market.highCents)} - ${pct(e.market.lowCents)})` }} title="Rango de mercado" />
            <div className="absolute top-3 h-7 w-[3px] rounded bg-[#d9826b]" style={{ left: pct(t.costCents) }} title="Costo" />
            <span className="absolute top-10 -translate-x-1/2 text-[11px] font-semibold text-[#f0b2a3]" style={{ left: pct(t.costCents) }}>Costo</span>
            {e.tiers.map((x) => (
              <span key={x.id} className={`absolute top-0 -translate-x-1/2 text-[11px] font-bold ${x.id === tier.id ? 'text-accent' : 'text-muted'}`} style={{ left: pct(x.beforeTaxCents) }}>▼</span>
            ))}
          </div>
          <div className="flex justify-between text-[12px] text-muted"><span>{mxn(e.market.lowCents)}</span><span className="font-semibold text-[#9fe0bd]">rango de mercado</span><span>{mxn(e.market.highCents)}</span></div>
          <ul className="mt-1 flex flex-wrap gap-1.5 text-[11.5px] text-muted">
            {e.market.breakdown.map((g) => <li key={g.label} className="rounded-full bg-[#1d3140] px-2 py-0.5">{g.label}: {g.linearM} {g.label.includes('pieza') ? 'pza' : 'm'} · {mxn(g.lowCents)}–{mxn(g.highCents)}</li>)}
          </ul>
        </section>
      )}

      {/* En qué se va el dinero */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-bold">En qué se va el costo</h3>
        <div className="flex h-4 w-full overflow-hidden rounded-full" aria-hidden>
          {parts.map((p, i) => p.v > 0 && <span key={p.label} style={{ width: `${(p.v / t.costCents) * 100}%`, background: COST_COLORS[i] }} title={`${p.label}: ${mxn(p.v)}`} />)}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-3">
          {parts.map((p, i) => <li key={p.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COST_COLORS[i] }} />{p.label}<b className="ml-auto">{mxn(p.v)}</b></li>)}
        </ul>
        {t.ledCents > 0 && <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#ffe27a]"><Lightbulb aria-hidden className="h-3.5 w-3.5" />LED (material + mano de obra): {mxn(t.ledCents)} en {e.ledM} m</p>}
      </section>

      <ul className="grid gap-1.5" aria-label="Recomendaciones">
        {e.advice.map((a) => <li key={a} className="rounded-lg bg-[#162a36] px-3 py-1.5 text-[12.5px]">{a}</li>)}
        {e.unpriced.length > 0 && <li className="rounded-lg bg-err-bg px-3 py-1.5 text-[12.5px] text-err">Sin precio (no se suma): {e.unpriced.join(', ')}</li>}
      </ul>

      <More summary={<>Materiales <span className="text-[12px] font-normal text-muted">{mxn(t.materialsCents)} · {e.referenceSharePct} % con precio de referencia</span></>} testId="price-materials">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Concepto</th><th className="pr-2 text-right">Cantidad</th><th className="pr-2">Precio unitario (sin IVA)</th><th className="pr-2 text-right">Importe</th><th>Origen</th></tr></thead>
            <tbody>
              {e.materials.map((m) => (
                <tr key={m.key} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2">{m.description}{m.note && <div className="text-[11px] text-muted">{m.note}</div>}</td>
                  <td className="pr-2 text-right whitespace-nowrap">{m.quantity} {m.unit}</td>
                  <td className="pr-2">
                    {m.source === 'proveedor' ? mxn(m.unitCents) : (
                      <span className="flex items-center gap-1">
                        <span className="text-muted">$</span>
                        <input aria-label={`Precio de ${m.description}`} className="!w-24 !py-1 text-right" inputMode="decimal" disabled={readOnly}
                          defaultValue={m.unitCents === null ? '' : String(m.unitCents / 100)} key={`${m.key}-${m.unitCents}`}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value.replace(',', '.'));
                            const next = { ...settings.priceOverrides };
                            if (ev.target.value.trim() === '' || !Number.isFinite(v) || v < 0) delete next[m.key]; else next[m.key] = Math.round(v * 100);
                            setM({ priceOverrides: next });
                          }} />
                        {m.lowCents !== null && <span className="whitespace-nowrap text-[11px] text-muted">{mxn(m.lowCents)}–{mxn(m.highCents)}</span>}
                      </span>
                    )}
                  </td>
                  <td className="pr-2 text-right font-semibold">{mxn(m.totalCents)}</td>
                  <td><Badge tone={SOURCE[m.source]!.tone}>{SOURCE[m.source]!.label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-muted">Prioridad: oferta de proveedor (pestaña Proveedores) → precio capturado aquí → referencia de Monterrey. Deja el campo vacío para volver a la referencia.</p>
      </More>

      <More summary={<>Mano de obra <span className="text-[12px] font-normal text-muted">{mxn(t.laborCents)} · {e.labor.reduce((s, l) => s + l.hours, 0).toFixed(1)} h</span></>}>
        <table className="w-full text-[12.5px]">
          <tbody>
            {e.labor.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="py-1.5 pr-2">{l.label}<div className="text-[11px] text-muted">{l.basis}</div></td>
                <td className="pr-2 text-right whitespace-nowrap">{l.hours} h</td>
                <td className="pr-2 text-[11.5px] text-muted">{l.crew}</td>
                <td className="text-right font-semibold">{mxn(l.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </More>

      <More summary="Ajustes del costeo" testId="price-settings">
        <fieldset disabled={readOnly} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumberInput label="Día de oficial" suffix="$" value={settings.laborDayCents / 100} min={0} onChange={(v) => setM({ laborDayCents: Math.round(v * 100) })} hint="Con carga social" testId="market-labor" />
          <NumberInput label="Día de ayudante" suffix="$" value={settings.helperDayCents / 100} min={0} onChange={(v) => setM({ helperDayCents: Math.round(v * 100) })} />
          <NumberInput label="Indirectos" suffix="%" value={settings.overheadPct} min={0} max={200} onChange={(v) => setM({ overheadPct: v })} hint="Renta, luz, herramienta, vehículo" />
          <NumberInput label="Consumibles" suffix="%" value={settings.consumablesPct} min={0} max={100} onChange={(v) => setM({ consumablesPct: v })} hint="Sobre material" />
          <NumberInput label="Imprevistos" suffix="%" value={settings.contingencyPct} min={0} max={100} onChange={(v) => setM({ contingencyPct: v })} hint="Garantía y retrabajos" />
          <NumberInput label="Flete por viaje" suffix="$" value={settings.transportTripCents / 100} min={0} onChange={(v) => setM({ transportTripCents: Math.round(v * 100) })} />
          <NumberInput label="Viajes (0 = auto)" value={settings.trips ?? 0} min={0} max={100} onChange={(v) => setM({ trips: v > 0 ? Math.round(v) : null })} />
          {(['Competitivo', 'Mercado', 'Premium'] as const).map((label, i) => (
            <NumberInput key={label} label={`Margen ${label.toLowerCase()}`} suffix="%" value={settings.tierMarginsPct[i]!} min={0} max={95} testId={`market-margin-${i}`}
              onChange={(v) => { const next = [...settings.tierMarginsPct] as [number, number, number]; next[i] = Math.min(95, Math.max(0, v)); setM({ tierMarginsPct: next }); }} />
          ))}
          <label className="col-span-2 flex items-center gap-2 text-[13px] sm:col-span-3"><input type="checkbox" className="!w-auto" checked={settings.includeInstallation} onChange={(ev) => setM({ includeInstallation: ev.target.checked })} />Incluir instalación en obra</label>
        </fieldset>
      </More>
      <p className="text-[11.5px] text-muted">Precios de referencia de {MARKET_REGION}, {MARKET_REFERENCE_DATE}, sin IVA. Son un punto de partida: confirma con tus proveedores y ajusta salarios e indirectos a tu taller.</p>
    </div>
  );
}
