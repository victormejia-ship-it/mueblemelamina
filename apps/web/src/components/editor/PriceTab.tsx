'use client';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CATALOG, MARKET_REFERENCE_DATE, MARKET_REGION, defaultMarket, marketEstimate, type ManufacturingPlan, type MarketSettings, type PriceTier, type PricingSettings, type Project } from '@ms/domain';
import { BadgeDollarSign, Check, CircleCheck, ClipboardCopy, Lightbulb, Package, TrendingUp, TriangleAlert, Wallet } from 'lucide-react';
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

/** Captura del costo de insumos: el único dato que se pide para llegar al precio. */
function InputCost({ settings, estimatedCents, onChange, disabled }: { settings: MarketSettings; estimatedCents: number; onChange: (p: Partial<MarketSettings>) => void; disabled?: boolean }) {
  const [text, setText] = useState(settings.inputCostCents === null ? '' : String(settings.inputCostCents / 100));
  useEffect(() => {
    setText((t) => {
      const cur = t.trim() === '' ? null : Math.round(Number(t.replace(/[$,\s]/g, '')) * 100);
      return cur === settings.inputCostCents ? t : settings.inputCostCents === null ? '' : String(settings.inputCostCents / 100);
    });
  }, [settings.inputCostCents]);
  return (
    <section className="rounded-2xl border border-[#3c6074] bg-[#13283a] p-3.5" aria-labelledby="input-cost-title">
      <div className="flex flex-wrap items-center gap-2">
        <Package aria-hidden className="h-5 w-5 text-[#5fd4ef]" />
        <h2 id="input-cost-title" className="text-[15px] font-bold">Costo de tus insumos</h2>
        <Hint label="¿Qué incluir?">Todo lo que compras para este mueble: tableros, canto, herrajes, jaladeras, LED, tornillería. Lo demás (mano de obra, renta, luz, herramienta, flete, comisiones, imprevistos y utilidad) lo calcula la app.</Hint>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[12px] font-semibold text-[#aebdcc]">
          Total en pesos
          <span className="flex items-center gap-1 rounded-xl border border-[#4b6a7d] bg-[#0d1b26] px-3 focus-within:border-accent">
            <span className="text-[20px] font-bold text-muted">$</span>
            <input data-testid="input-cost" inputMode="decimal" placeholder={String(Math.round(estimatedCents / 100))} disabled={disabled}
              className="!w-40 !border-0 !bg-transparent !px-0 !py-2 text-[22px] font-extrabold !outline-none"
              value={text}
              onChange={(ev) => {
                setText(ev.target.value);
                const raw = ev.target.value.replace(/[$,\s]/g, '');
                if (raw === '') onChange({ inputCostCents: null });
                else { const v = Number(raw); if (Number.isFinite(v) && v >= 0) onChange({ inputCostCents: Math.round(v * 100) }); }
              }} />
          </span>
        </label>
        <label className="flex items-center gap-2 pb-2 text-[13px]"><input type="checkbox" className="!w-auto" checked={settings.inputCostIncludesTax} disabled={disabled} onChange={(ev) => onChange({ inputCostIncludesTax: ev.target.checked })} data-testid="input-cost-tax" />Incluye IVA</label>
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        {settings.inputCostCents === null
          ? <>Sin capturar: se usa lo que estima el despiece, <b className="text-[#e5edf3]">{mxn(estimatedCents)}</b> sin IVA.</>
          : <>El despiece estima {mxn(estimatedCents)} sin IVA. <button type="button" className="font-semibold text-[#bce8f2] underline" onClick={() => onChange({ inputCostCents: null })} disabled={disabled}>Usar la estimación</button></>}
      </p>
    </section>
  );
}

/** Precio de venta saludable a partir del costo de insumos, comparado con Monterrey. */
export function PriceTab({ plan, project, onPricing, readOnly }: { plan: ManufacturingPlan; project: Project; onPricing: (p: PricingSettings) => void; readOnly?: boolean }) {
  const settings = project.pricing.market ?? defaultMarket();
  const e = useMemo(() => marketEstimate(project, plan, DEFAULT_CATALOG, settings), [project, plan, settings]);
  const [chosen, setChosen] = useState<PriceTier['id'] | null>(null);
  const [copied, setCopied] = useState(false);
  const tier = e.tiers.find((x) => x.id === (chosen ?? e.recommended))!;
  const setM = (patch: Partial<MarketSettings>) => onPricing({ ...project.pricing, market: { ...settings, ...patch } });
  const t = e.totals;
  const tax = project.pricing.taxRatePct;

  // Cómo se forma el precio del nivel elegido (cada renglón como % del precio)
  const steps = [
    { label: 'Insumos', v: t.materialsCents, color: '#4fb3c9', note: e.inputSource === 'capturado' ? 'lo que capturaste' : 'estimado del despiece' },
    { label: 'Consumibles', v: t.consumablesCents, color: '#7fc8a9', note: `${settings.consumablesPct} % de insumos: pegamento, lija, tornillería menor` },
    { label: 'Mano de obra', v: t.laborCents, color: '#e0b45a', note: `${e.labor.reduce((s, l) => s + l.hours, 0).toFixed(1)} h de taller e instalación` },
    { label: 'Flete', v: t.transportCents, color: '#b38ad6', note: 'viajes a obra' },
    { label: 'Indirectos', v: t.overheadCents, color: '#8a9bab', note: `${settings.overheadPct} %: renta, luz, herramienta, vehículo` },
    { label: 'Imprevistos y garantía', v: t.contingencyCents, color: '#d9826b', note: `${settings.contingencyPct} %` },
    { label: 'Venta y cobro', v: tier.salesCents, color: '#c9a3e8', note: `${settings.salesCostPct + settings.paymentFeePct} % del precio: comisión, publicidad, terminal` },
    { label: 'Utilidad neta', v: tier.netProfitCents, color: '#56c28a', note: `${tier.netMarginPct} % del precio (antes de ISR)` },
  ];

  // Escala de la barra de mercado
  const lo = Math.min(t.costCents, e.market?.lowCents ?? t.costCents, ...e.tiers.map((x) => x.beforeTaxCents)) * 0.92;
  const hi = Math.max(e.market?.highCents ?? 0, ...e.tiers.map((x) => x.beforeTaxCents)) * 1.05;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;

  function proposal() {
    const led = tier.withoutLedBeforeTaxCents !== null;
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
      <InputCost settings={settings} estimatedCents={t.estimatedMaterialsCents} onChange={setM} disabled={readOnly} />

      <div className="flex flex-wrap items-center gap-2">
        <BigStat icon={<BadgeDollarSign className="h-5 w-5" />} value={<span data-testid="price-recommended">{mxn(tier.beforeTaxCents)}</span>} label={`precio ${tier.label.toLowerCase()} + IVA`} tone="ok" />
        <BigStat icon={<Wallet className="h-5 w-5" />} value={mxn(tier.totalCents)} label="total con IVA" />
        <BigStat icon={<TrendingUp className="h-5 w-5" />} value={mxn(tier.netProfitCents)} label={`utilidad neta (${tier.netMarginPct} %)`} tone="info" />
        {tier.inputMultiplier !== null && <BigStat value={`${tier.inputMultiplier} ×`} label="sobre insumos" />}
        <Button className="ml-auto" variant="secondary" onClick={proposal} data-testid="copy-proposal">{copied ? <Check aria-hidden className="mr-1 inline h-4 w-4" /> : <ClipboardCopy aria-hidden className="mr-1 inline h-4 w-4" />}{copied ? 'Copiada' : 'Copiar propuesta'}</Button>
      </div>

      {/* Niveles de precio */}
      <section>
        <div className="mb-2 flex items-center gap-2"><h2 className="text-[16px] font-bold">Precio de venta</h2><Hint>Mismo costo, distinta utilidad neta: Mínimo (piso, no vender debajo), Saludable (lo recomendado para un taller sano) y Premium. Cada uno se compara con el rango de Monterrey para este tipo de mueble.</Hint></div>
        <div role="radiogroup" aria-label="Nivel de precio" className="grid gap-2 sm:grid-cols-3">
          {e.tiers.map((x) => {
            const sel = x.id === tier.id;
            return (
              <button key={x.id} type="button" role="radio" aria-checked={sel} onClick={() => setChosen(x.id)} data-testid={`tier-${x.id}`}
                className={`grid gap-1 rounded-xl border p-3 text-left transition ${sel ? 'border-accent bg-[#173342] ring-2 ring-accent/40' : 'border-line bg-panel-2 hover:border-[#4b6a7d]'}`}>
                <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold">{x.label}<span className="text-[12px] font-semibold text-muted">utilidad {x.netMarginPct} %</span>{x.id === e.recommended && <Badge tone="ok">Recomendado</Badge>}</span>
                <span className="text-[22px] font-extrabold leading-tight">{mxn(x.beforeTaxCents)}<span className="ml-1 text-[12px] font-semibold text-muted">+ IVA</span></span>
                <span className="text-[12.5px] text-muted">Con IVA <b className="text-[#e5edf3]">{mxn(x.totalCents)}</b>{x.perLinearMCents !== null && <> · {mxn(x.perLinearMCents)}/m</>}</span>
                {x.withoutLedBeforeTaxCents !== null && <span className="text-[12px] text-[#ffe27a]">Sin LED: {mxn(x.withoutLedBeforeTaxCents)} + IVA</span>}
                <span><Badge tone={POS[x.position].tone}>{POS[x.position].label}</Badge></span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cómo se forma el precio */}
      <section data-testid="price-breakdown">
        <h3 className="mb-1.5 text-[13px] font-bold">Cómo se forma el precio {tier.label.toLowerCase()}</h3>
        <div className="flex h-5 w-full overflow-hidden rounded-full" aria-hidden>
          {steps.map((s) => s.v > 0 && <span key={s.label} style={{ width: `${(s.v / tier.beforeTaxCents) * 100}%`, background: s.color }} title={`${s.label}: ${mxn(s.v)}`} />)}
        </div>
        <ol className="mt-2 grid gap-1 text-[12.5px]">
          {steps.map((s, i) => (
            <li key={s.label} className="grid grid-cols-[14px_1fr_auto_44px] items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span><b>{i === 0 ? '' : '+ '}{s.label}</b> <span className="text-muted">· {s.note}</span></span>
              <b className="text-right">{mxn(s.v)}</b>
              <span className="text-right text-muted">{tier.beforeTaxCents ? Math.round((s.v / tier.beforeTaxCents) * 100) : 0} %</span>
            </li>
          ))}
          <li className="grid grid-cols-[14px_1fr_auto_44px] items-center gap-2 border-t border-line pt-1 text-[13.5px]">
            <span /><b>= Precio sin IVA</b><b className="text-right text-[#9fe0bd]">{mxn(tier.beforeTaxCents)}</b><span className="text-right text-muted">100 %</span>
          </li>
          <li className="grid grid-cols-[14px_1fr_auto_44px] items-center gap-2 text-muted">
            <span /><span>+ IVA {tax} % → total al cliente</span><span className="text-right font-semibold text-[#e5edf3]">{mxn(tier.totalCents)}</span><span />
          </li>
        </ol>
        {t.ledCents > 0 && <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#ffe27a]"><Lightbulb aria-hidden className="h-3.5 w-3.5" />LED (material + mano de obra): {mxn(t.ledCents)} en {e.ledM} m</p>}
      </section>

      {/* Salud del precio recomendado */}
      <section data-testid="price-health">
        <h3 className="mb-1.5 text-[13px] font-bold">¿Es un precio sano? <span className="font-normal text-muted">(precio {e.tiers.find((x) => x.id === e.recommended)!.label.toLowerCase()})</span></h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {e.health.map((h) => (
            <li key={h.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] ${h.ok ? 'bg-ok-bg' : 'bg-warn-bg'}`}>
              {h.ok ? <CircleCheck aria-hidden className="mt-[1px] h-4 w-4 shrink-0 text-ok" /> : <TriangleAlert aria-hidden className="mt-[1px] h-4 w-4 shrink-0 text-warn" />}
              <span><b>{h.label}.</b> <span className="text-muted">{h.detail}</span></span>
            </li>
          ))}
        </ul>
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
              <span key={x.id} className={`absolute top-0 -translate-x-1/2 text-[11px] font-bold ${x.id === tier.id ? 'text-accent' : 'text-muted'}`} style={{ left: pct(x.beforeTaxCents) }} title={x.label}>▼</span>
            ))}
          </div>
          <div className="flex justify-between text-[12px] text-muted"><span>{mxn(e.market.lowCents)}</span><span className="font-semibold text-[#9fe0bd]">rango de mercado</span><span>{mxn(e.market.highCents)}</span></div>
          <ul className="mt-1 flex flex-wrap gap-1.5 text-[11.5px] text-muted">
            {e.market.breakdown.map((g) => <li key={g.label} className="rounded-full bg-[#1d3140] px-2 py-0.5">{g.label}: {g.linearM} {g.label.includes('pieza') ? 'pza' : 'm'} · {mxn(g.lowCents)}–{mxn(g.highCents)}</li>)}
          </ul>
        </section>
      )}

      <ul className="grid gap-1.5" aria-label="Recomendaciones">
        {e.advice.map((a) => <li key={a} className="rounded-lg bg-[#162a36] px-3 py-1.5 text-[12.5px]">{a}</li>)}
        {e.inputSource === 'estimado' && e.unpriced.length > 0 && <li className="rounded-lg bg-err-bg px-3 py-1.5 text-[12.5px] text-err">Sin precio en la estimación: {e.unpriced.join(', ')}</li>}
      </ul>

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

      <More summary={<>Detalle estimado de insumos <span className="text-[12px] font-normal text-muted">{mxn(t.estimatedMaterialsCents)} · sirve para revisar que tu lista esté completa</span></>} testId="price-materials">
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
        <p className="mt-2 text-[11.5px] text-muted">Si capturaste el costo de tus insumos arriba, el precio usa ese total; esta lista sólo sirve para comparar. Prioridad de la estimación: oferta de proveedor → precio capturado aquí → referencia de Monterrey.</p>
      </More>

      <More summary="Ajustes del negocio" testId="price-settings">
        <fieldset disabled={readOnly} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(['Mínimo', 'Saludable', 'Premium'] as const).map((label, i) => (
            <NumberInput key={label} label={`Utilidad ${label.toLowerCase()}`} suffix="%" value={settings.netMarginsPct[i]!} min={0} max={60} testId={`market-margin-${i}`}
              onChange={(v) => { const next = [...settings.netMarginsPct] as [number, number, number]; next[i] = Math.min(60, Math.max(0, v)); setM({ netMarginsPct: next }); }} />
          ))}
          <NumberInput label="Día de oficial" suffix="$" value={settings.laborDayCents / 100} min={0} onChange={(v) => setM({ laborDayCents: Math.round(v * 100) })} hint="Con prestaciones" testId="market-labor" />
          <NumberInput label="Día de ayudante" suffix="$" value={settings.helperDayCents / 100} min={0} onChange={(v) => setM({ helperDayCents: Math.round(v * 100) })} />
          <NumberInput label="Indirectos" suffix="%" value={settings.overheadPct} min={0} max={200} onChange={(v) => setM({ overheadPct: v })} hint="Renta, luz, herramienta, vehículo" />
          <NumberInput label="Consumibles" suffix="%" value={settings.consumablesPct} min={0} max={100} onChange={(v) => setM({ consumablesPct: v })} hint="Sobre insumos" />
          <NumberInput label="Imprevistos" suffix="%" value={settings.contingencyPct} min={0} max={100} onChange={(v) => setM({ contingencyPct: v })} hint="Garantía y retrabajos" />
          <NumberInput label="Venta" suffix="%" value={settings.salesCostPct} min={0} max={50} onChange={(v) => setM({ salesCostPct: v })} hint="Comisión, publicidad, visitas" />
          <NumberInput label="Cobro" suffix="%" value={settings.paymentFeePct} min={0} max={20} onChange={(v) => setM({ paymentFeePct: v })} hint="Terminal, transferencias" />
          <NumberInput label="Flete por viaje" suffix="$" value={settings.transportTripCents / 100} min={0} onChange={(v) => setM({ transportTripCents: Math.round(v * 100) })} />
          <NumberInput label="Viajes (0 = auto)" value={settings.trips ?? 0} min={0} max={100} onChange={(v) => setM({ trips: v > 0 ? Math.round(v) : null })} />
          <label className="col-span-2 flex items-center gap-2 text-[13px] sm:col-span-3"><input type="checkbox" className="!w-auto" checked={settings.includeInstallation} onChange={(ev) => setM({ includeInstallation: ev.target.checked })} />Incluir instalación en obra</label>
        </fieldset>
        <p className="mt-2 text-[11.5px] text-muted">Valores de un taller sano en {MARKET_REGION}: utilidad neta 15–25 %, indirectos 15–25 %, imprevistos 5 %. Ajústalos a tus números reales.</p>
      </More>
      <p className="text-[11.5px] text-muted">Rangos de mercado y precios de referencia: {MARKET_REGION}, {MARKET_REFERENCE_DATE}, sin IVA. Son un punto de partida; confirma con tus proveedores.</p>
    </div>
  );
}
