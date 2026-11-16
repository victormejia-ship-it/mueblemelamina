import { catalogLookup, type Catalog } from '../catalog';
import type { ManufacturingPlan } from '../plan';
import type { Cents, Project } from '../types';

/**
 * Costeo y precio de venta con referencias de mercado de Monterrey, N.L.
 *
 * Los precios de referencia son estimaciones de mercado (MXN sin IVA, nov-2026) para arrancar el costeo:
 * NO sustituyen una cotización. Siempre que haya una oferta de proveedor con precio, se usa esa.
 * Todo es editable por proyecto (precio unitario, salarios, indirectos y márgenes).
 */
export const MARKET_REGION = 'Monterrey, N.L. (zona metropolitana)';
export const MARKET_REFERENCE_DATE = '2026-11';

export interface MarketRef { unitCents: Cents; lowCents: Cents; highCents: Cents; unit: string; note?: string }

const ref = (typ: number, low: number, high: number, unit: string, note?: string): MarketRef => ({ unitCents: typ * 100, lowCents: low * 100, highCents: high * 100, unit, ...(note ? { note } : {}) });

/** Precios de referencia por clave de producto (MXN sin IVA). */
export const MARKET_REFERENCE_MTY: Record<string, MarketRef> = {
  'board:mel18': ref(850, 720, 1000, 'hoja', 'Melamina 18 mm 1.22 × 2.44 m, color sólido. Maderados y texturas: +15 a 30 %.'),
  'board:mel15': ref(760, 650, 900, 'hoja'),
  'board:mel16': ref(800, 680, 950, 'hoja'),
  'board:mel18rh': ref(1180, 1000, 1400, 'hoja', 'Resistente a humedad (baños, tarjas).'),
  'board:mdf18': ref(820, 700, 980, 'hoja'),
  'board:lam18': ref(1450, 1200, 1800, 'hoja'),
  'board:ply18': ref(1250, 1000, 1550, 'hoja'),
  'solid:oak18': ref(1900, 1500, 2600, 'm²', 'Madera maciza: cotizar siempre.'),
  'board:hdf3': ref(240, 190, 300, 'hoja'),
  'board:hdf6': ref(390, 320, 470, 'hoja'),
  'board:mel9': ref(580, 480, 680, 'hoja'),
  'edge:pvc19x045': ref(3.5, 2.5, 5, 'm'),
  'edge:pvc22x1': ref(7, 5, 9, 'm'),
  'edge:pvc22x2': ref(11, 8, 14, 'm'),
  'steel:ptr1x1c14': ref(58, 48, 70, 'm', 'Barra de 6.1 m.'),
  'steel:ptr1.5x1.5c14': ref(82, 70, 98, 'm'),
  'steel:ptr2x1c14': ref(88, 74, 105, 'm'),
  'hw:hinge_overlay_110': ref(38, 25, 60, 'pza', 'Bisagra cierre suave genérica. Marcas europeas: $110–$180.'),
  'hw:hinge_half_overlay_110': ref(40, 27, 62, 'pza'),
  'hw:samet:SAM1010041150': ref(85, 70, 110, 'pza'),
  'hw:slide_telescopic': ref(130, 95, 180, 'juego', 'Telescópica 45 cm. Cierre suave: $250–$380.'),
  'hw:samet:SAM11662153004': ref(260, 220, 320, 'juego'),
  'hw:samet:SAM127240533': ref(520, 440, 640, 'juego'),
  'hw:cam_minifix15': ref(5, 3.5, 7, 'juego'),
  'hw:dowel8x35': ref(0.6, 0.4, 0.9, 'pza'),
  'hw:screw4x40': ref(0.7, 0.5, 1, 'pza'),
  'hw:spax:SP044015': ref(1.3, 1, 1.8, 'pza'),
  'hw:shelf_pin5': ref(0.9, 0.6, 1.5, 'pza'),
  'hw:handle_generic': ref(48, 25, 120, 'pza', 'Jaladera de barra 128 mm. Perfil gola o diseño: cotizar.'),
  'hw:leveler100': ref(18, 12, 28, 'pza'),
  'hw:plinth_clip': ref(6, 4, 9, 'pza'),
  'hw:antitip_anchor': ref(35, 25, 50, 'juego'),
  'hw:cabinet_hanger': ref(60, 40, 90, 'pza'),
  'hw:hanging_rail_oval': ref(95, 75, 130, 'm'),
  'hw:hanging_rail_support': ref(18, 12, 28, 'pza'),
  'hw:led_strip_cob12v': ref(75, 55, 110, 'm', 'Rollo de 5 m ≈ $300–$500.'),
  'hw:led_strip_smd12v': ref(35, 22, 55, 'm'),
  'hw:led_profile_embed17': ref(65, 42, 95, 'm', 'Perfil con difusor, tapas y grapas.'),
  'hw:led_profile_embed12': ref(55, 38, 80, 'm'),
  'hw:led_driver12v_30w': ref(160, 120, 220, 'pza'),
  'hw:led_driver12v_60w': ref(230, 170, 300, 'pza'),
  'hw:led_driver12v_100w': ref(330, 250, 430, 'pza'),
  'hw:led_driver12v_150w': ref(430, 330, 560, 'pza'),
  'hw:led_driver12v_200w': ref(520, 400, 680, 'pza'),
  'hw:led_sensor_door': ref(110, 80, 160, 'pza'),
  'hw:led_sensor_hand': ref(140, 100, 200, 'pza'),
  'hw:led_sensor_touch': ref(160, 110, 230, 'pza'),
  'hw:led_cable2x20': ref(9, 6, 14, 'm'),
};

/** Rango de precio de venta en Monterrey por metro lineal de frente (MXN sin IVA, instalado, melamina, sin cubierta ni electrodomésticos). */
export const MARKET_RANGES_MTY: Record<string, { label: string; lowCents: Cents; highCents: Cents }> = {
  base: { label: 'Gabinete bajo de cocina', lowCents: 550000, highCents: 950000 },
  aereo: { label: 'Gabinete aéreo', lowCents: 400000, highCents: 700000 },
  alacena: { label: 'Alacena / columna', lowCents: 900000, highCents: 1500000 },
  closet: { label: 'Clóset (hasta 2.4 m de alto)', lowCents: 700000, highCents: 1200000 },
  vestidor: { label: 'Vestidor', lowCents: 800000, highCents: 1400000 },
  cajonera: { label: 'Cómoda / cajonera', lowCents: 650000, highCents: 1100000 },
  buro: { label: 'Buró (por pieza)', lowCents: 180000, highCents: 380000 },
  escritorio: { label: 'Escritorio', lowCents: 380000, highCents: 750000 },
  tv: { label: 'Mueble de TV', lowCents: 500000, highCents: 900000 },
  librero: { label: 'Librero / zapatera / exhibidor', lowCents: 500000, highCents: 900000 },
  bano: { label: 'Gabinete de baño', lowCents: 600000, highCents: 1000000 },
  led: { label: 'LED empotrado instalado (por metro)', lowCents: 90000, highCents: 150000 },
};

const FAMILY_RANGE: Record<string, keyof typeof MARKET_RANGES_MTY> = {
  kitchen_base: 'base', kitchen_wall: 'aereo', pantry: 'alacena', kitchen_island: 'base', wardrobe: 'closet', walkin: 'vestidor',
  dresser: 'cajonera', nightstand: 'buro', desk: 'escritorio', credenza: 'base', filing_cabinet: 'cajonera', tv_console: 'tv',
  bookcase: 'librero', bath_vanity: 'bano', laundry: 'base', shoe_cabinet: 'librero', display: 'librero', counter: 'base', custom: 'base',
};

export interface MarketSettings {
  /** Día de oficial carpintero con carga social (MXN centavos). */
  laborDayCents: Cents;
  /** Día de ayudante con carga social. */
  helperDayCents: Cents;
  /** Gastos indirectos del taller (renta, luz, herramienta, vehículo, administración) sobre costo directo. */
  overheadPct: number;
  /** Consumibles sobre materiales (pegamento, lija, tornillería menor, discos, cinta). */
  consumablesPct: number;
  /** Imprevistos y garantía. */
  contingencyPct: number;
  /** Flete por viaje dentro del área metropolitana. */
  transportTripCents: Cents;
  /** Viajes; null = automático (1 por cada 6 módulos). */
  trips: number | null;
  includeInstallation: boolean;
  /** Márgenes sobre venta de los tres niveles de precio. */
  tierMarginsPct: [number, number, number];
  /** Precio unitario capturado por el usuario (sin IVA), por clave de producto. */
  priceOverrides: Record<string, Cents>;
}

export const DEFAULT_MARKET: MarketSettings = {
  laborDayCents: 100000,
  helperDayCents: 60000,
  overheadPct: 18,
  consumablesPct: 5,
  contingencyPct: 5,
  transportTripCents: 90000,
  trips: null,
  includeInstallation: true,
  tierMarginsPct: [28, 38, 48],
  priceOverrides: {},
};

export type CostSource = 'proveedor' | 'capturado' | 'referencia' | 'sin_precio';

export interface MarketMaterialLine {
  key: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCents: Cents | null;
  totalCents: Cents;
  source: CostSource;
  lowCents: Cents | null;
  highCents: Cents | null;
  note?: string;
}

export interface LaborLine { id: string; label: string; hours: number; crew: 'oficial' | 'oficial+ayudante'; cents: Cents; basis: string }

export interface PriceTier {
  id: 'competitivo' | 'mercado' | 'premium'; label: string; marginPct: number;
  beforeTaxCents: Cents; taxCents: Cents; totalCents: Cents; perLinearMCents: Cents | null;
  position: 'debajo' | 'dentro' | 'arriba' | 'sin_referencia';
  /** Mismo nivel sin la opción LED (sin IVA); null si el proyecto no lleva LED. */
  withoutLedBeforeTaxCents: Cents | null;
}

export interface MarketEstimate {
  region: string;
  referenceDate: string;
  materials: MarketMaterialLine[];
  labor: LaborLine[];
  totals: {
    materialsCents: Cents; consumablesCents: Cents; laborCents: Cents; transportCents: Cents;
    directCents: Cents; overheadCents: Cents; contingencyCents: Cents; costCents: Cents;
    /** Parte del costo que es LED (material + mano de obra), para mostrarla por separado. */
    ledCents: Cents;
  };
  linearM: number;
  ledM: number;
  /** Rango de mercado para este proyecto (sin IVA). */
  market: { lowCents: Cents; highCents: Cents; breakdown: { label: string; linearM: number; lowCents: Cents; highCents: Cents }[] } | null;
  tiers: PriceTier[];
  recommended: PriceTier['id'];
  advice: string[];
  /** Material sin precio de proveedor ni referencia (no se suma: completar). */
  unpriced: string[];
  /** Porcentaje del costo de materiales que viene de referencias (no de proveedor). */
  referenceSharePct: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const hrs = (min: number) => r2(min / 60);

/** Costeo completo y precio sugerido. Determinista. */
export function marketEstimate(project: Project, plan: ManufacturingPlan, catalog: Catalog, settings: MarketSettings = project.pricing.market ?? DEFAULT_MARKET): MarketEstimate {
  const L = catalogLookup(catalog);
  const { calc, quote } = plan;
  const taxPct = project.pricing.taxRatePct;

  // --- Materiales: oferta de proveedor > precio capturado > referencia de mercado
  const grainShare = (() => {
    let all = 0, grain = 0;
    for (const p of calc.parts) {
      const a = (p.lengthMm * p.widthMm * p.quantity) / 1e6;
      all += a;
      if (L.finish(p.finishId).hasGrain) grain += a;
    }
    return all ? grain / all : 0;
  })();
  const materials: MarketMaterialLine[] = [];
  const unpriced: string[] = [];
  for (const l of quote.lines.filter((x) => x.category !== 'service')) {
    const qty = l.purchaseQuantity && l.unitNetCents !== null ? l.purchaseQuantity : l.requiredQuantity;
    const refp = MARKET_REFERENCE_MTY[l.key];
    const override = settings.priceOverrides[l.key];
    let unit: Cents | null = null, total = 0, source: CostSource = 'sin_precio';
    if (l.lineNetCents !== null && (l.status === 'PRICED' || l.status === 'ESTIMATED')) {
      unit = l.unitNetCents; total = l.lineNetCents; source = 'proveedor';
    } else if (override !== undefined) {
      unit = override; source = 'capturado';
      total = l.requiredUnit === 'hoja' ? override * Math.ceil(l.requiredQuantity - 1e-9) : Math.round(override * l.requiredQuantity);
    } else if (refp) {
      // Maderados/texturas cuestan más: se ajusta la referencia de tablero por la proporción de área con veta.
      const factor = l.category === 'board' ? 1 + 0.2 * grainShare : 1;
      unit = Math.round(refp.unitCents * factor);
      total = l.requiredUnit === 'hoja' ? unit * Math.ceil(l.requiredQuantity - 1e-9) : Math.round(unit * l.requiredQuantity);
      source = 'referencia';
    } else {
      unpriced.push(l.description);
    }
    materials.push({
      key: l.key, category: l.category, description: l.description, quantity: l.requiredUnit === 'hoja' ? Math.ceil(qty - 1e-9) : r2(l.requiredQuantity), unit: l.requiredUnit,
      unitCents: unit, totalCents: total, source, lowCents: refp?.lowCents ?? null, highCents: refp?.highCents ?? null, ...(refp?.note ? { note: refp.note } : {}),
    });
  }
  const materialsCents = materials.reduce((s, m) => s + m.totalCents, 0);
  const refCents = materials.filter((m) => m.source === 'referencia').reduce((s, m) => s + m.totalCents, 0);
  const consumablesCents = Math.round(materialsCents * settings.consumablesPct / 100);

  // --- Mano de obra por proceso (minutos de taller típicos; editable vía salario)
  const qtyOf = new Map(calc.parts.map((p) => [p.id, p.quantity]));
  const countOps = (pred: (p: string) => boolean) => calc.machining.filter((o) => pred(o.patternId)).reduce((s, o) => s + (qtyOf.get(o.partId) ?? 1), 0);
  const pieces = calc.totals.panelCount;
  const sheets = plan.nesting.reduce((s, n) => s + (n.sheetsRequired ?? n.areaEstimate.sheetsEstimated), 0);
  const edgeM = calc.edgeBands.reduce((s, e) => s + e.netLengthMm, 0) / 1000;
  const edgeSegs = calc.edgeBands.reduce((s, e) => s + e.segments, 0);
  const holes = countOps((p) => !p.startsWith('led-'));
  const ledRuns = calc.ledRuns.length;
  const ledM = calc.ledRuns.reduce((s, r) => s + r.lengthMm, 0) / 1000;
  const doors = calc.parts.filter((p) => p.role === 'front' && p.code.startsWith('DOOR')).reduce((s, p) => s + p.quantity, 0);
  const drawers = calc.parts.filter((p) => p.code === 'DRAWER_FRONT').reduce((s, p) => s + p.quantity, 0);
  const modules = project.modules.length;
  const wallOrTall = project.modules.filter((m) => m.mount === 'wall' || m.heightMm > 1500).length;
  const steelFrames = calc.steel.length;
  const drivers = calc.hardware.filter((h) => h.category === 'led_driver').reduce((s, h) => s + h.quantity, 0);
  const ledModules = new Set(calc.ledRuns.map((r) => r.moduleId)).size;

  const dayO = settings.laborDayCents, dayH = settings.helperDayCents;
  const perHour = (crew: LaborLine['crew']) => (crew === 'oficial' ? dayO : dayO + dayH) / 8;
  const labor: LaborLine[] = [];
  const add = (id: string, label: string, minutes: number, crew: LaborLine['crew'], basis: string) => {
    if (minutes <= 0) return;
    const h = hrs(minutes);
    labor.push({ id, label, hours: h, crew, cents: Math.round(h * perHour(crew)), basis });
  };
  add('corte', 'Corte de tableros', pieces * 4 + sheets * 10, 'oficial', `${pieces} piezas × 4 min + ${sheets} tableros × 10 min`);
  add('canteado', 'Canteado', edgeM * 1.2 + edgeSegs * 1, 'oficial', `${r2(edgeM)} m × 1.2 min + ${edgeSegs} aristas × 1 min`);
  add('perforacion', 'Perforación', holes * 0.6, 'oficial', `${holes} barrenos × 0.6 min`);
  add('router', 'Ranuras LED con router', ledRuns * 6 + ledM * 4, 'oficial', `${ledRuns} tramos × 6 min + ${r2(ledM)} m × 4 min`);
  add('armado', 'Armado y herrajes', modules * 45 + doors * 8 + drawers * 12, 'oficial+ayudante', `${modules} cajas × 45 min + ${doors} puertas × 8 + ${drawers} cajones × 12`);
  add('herreria', 'Herrería (corte, soldadura, pintura)', steelFrames * 90, 'oficial', `${steelFrames} bastidor(es) × 90 min`);
  add('led', 'Armado eléctrico LED', ledRuns * 20 + drivers * 30, 'oficial', `${ledRuns} tramos × 20 min + ${drivers} fuente(s) × 30 min`);
  add('empaque', 'Empaque', modules * 10, 'oficial+ayudante', `${modules} módulos × 10 min`);
  if (settings.includeInstallation) add('instalacion', 'Instalación en obra', (modules - wallOrTall) * 60 + wallOrTall * 75 + ledModules * 20, 'oficial+ayudante', `${modules - wallOrTall} × 60 min + ${wallOrTall} aéreos/altos × 75 min + ${ledModules} con LED × 20 min`);
  const laborCents = labor.reduce((s, l) => s + l.cents, 0);
  const trips = settings.trips ?? Math.max(1, Math.ceil(modules / 6));
  const transportCents = trips * settings.transportTripCents;

  const directCents = materialsCents + consumablesCents + laborCents + transportCents;
  const overheadCents = Math.round(directCents * settings.overheadPct / 100);
  const contingencyCents = Math.round((directCents + overheadCents) * settings.contingencyPct / 100);
  const costCents = directCents + overheadCents + contingencyCents;
  const ledMat = materials.filter((m) => m.key.startsWith('hw:led_')).reduce((s, m) => s + m.totalCents, 0);
  const ledLab = labor.filter((l) => l.id === 'router' || l.id === 'led').reduce((s, l) => s + l.cents, 0);

  // --- Rango de mercado del proyecto (por metro lineal de frente de cada módulo)
  const groups = new Map<string, { label: string; linearM: number; lowCents: number; highCents: number }>();
  for (const m of project.modules) {
    const k = FAMILY_RANGE[m.familyId] ?? 'base';
    const r = MARKET_RANGES_MTY[k]!;
    const units = k === 'buro' ? 1 : m.widthMm / 1000;
    const g = groups.get(k) ?? { label: r.label, linearM: 0, lowCents: 0, highCents: 0 };
    g.linearM = r2(g.linearM + units);
    g.lowCents += Math.round(r.lowCents * units);
    g.highCents += Math.round(r.highCents * units);
    groups.set(k, g);
  }
  if (ledM > 0) {
    const r = MARKET_RANGES_MTY.led!;
    groups.set('led', { label: r.label, linearM: r2(ledM), lowCents: Math.round(r.lowCents * ledM), highCents: Math.round(r.highCents * ledM) });
  }
  const breakdown = [...groups.values()];
  const market = breakdown.length ? { lowCents: breakdown.reduce((s, g) => s + g.lowCents, 0), highCents: breakdown.reduce((s, g) => s + g.highCents, 0), breakdown } : null;
  const linearM = r2(project.modules.reduce((s, m) => s + m.widthMm, 0) / 1000);

  const labels: Record<PriceTier['id'], string> = { competitivo: 'Competitivo', mercado: 'Mercado', premium: 'Premium' };
  const ids: PriceTier['id'][] = ['competitivo', 'mercado', 'premium'];
  const ledCost = Math.round((ledMat + ledLab) * (1 + settings.overheadPct / 100) * (1 + settings.contingencyPct / 100));
  const tiers: PriceTier[] = ids.map((id, i) => {
    const marginPct = Math.min(90, Math.max(0, settings.tierMarginsPct[i] ?? 35));
    const before = Math.round(costCents / (1 - marginPct / 100) / 100) * 100; // redondeo a pesos
    const tax = Math.round(before * taxPct / 100);
    const position: PriceTier['position'] = !market ? 'sin_referencia' : before < market.lowCents ? 'debajo' : before > market.highCents ? 'arriba' : 'dentro';
    const withoutLed = ledM > 0 ? Math.round((costCents - ledCost) / (1 - marginPct / 100) / 100) * 100 : null;
    return { id, label: labels[id], marginPct, beforeTaxCents: before, taxCents: tax, totalCents: before + tax, perLinearMCents: linearM > 0 ? Math.round(before / linearM) : null, position, withoutLedBeforeTaxCents: withoutLed };
  });

  // --- Recomendación
  const advice: string[] = [];
  let recommended: PriceTier['id'] = 'mercado';
  const mid = tiers[1]!;
  if (market) {
    if (mid.position === 'arriba') {
      const fit = tiers.find((t) => t.position === 'dentro');
      recommended = fit?.id ?? 'competitivo';
      advice.push(fit ? `El precio de mercado queda arriba del rango de Monterrey; se recomienda «${fit.label}».` : 'Incluso el precio competitivo queda arriba del rango: revisar costos (material, horas o indirectos) o justificar con acabados y herrajes superiores.');
    } else if (mid.position === 'debajo') {
      const fit = [...tiers].reverse().find((t) => t.position !== 'arriba');
      recommended = fit?.id ?? 'premium';
      advice.push(`Tu costo permite cobrar más: el rango de mercado empieza en ${Math.round(market.lowCents / 100).toLocaleString('es-MX')} MXN sin IVA. Se recomienda «${labels[recommended]}».`);
    } else {
      advice.push('El precio de mercado cae dentro del rango de Monterrey para este tipo de mueble.');
    }
  }
  if (mid.marginPct < 30) advice.push('Margen menor a 30 %: en carpintería a medida suele no cubrir retrabajos y garantías.');
  if (refCents > materialsCents * 0.5) advice.push('Más de la mitad del material usa precios de referencia: captura ofertas reales de tus proveedores antes de cerrar.');
  if (ledM > 0) advice.push(`LED empotrado: ${r2(ledM)} m. Ofrecerlo como opción separada ayuda a cerrar la venta (el cliente ve el precio con y sin LED).`);
  advice.push('Anticipo sugerido: 60 % para comprar material; 40 % contra entrega e instalación.');

  return {
    region: MARKET_REGION, referenceDate: MARKET_REFERENCE_DATE, materials, labor,
    totals: { materialsCents, consumablesCents, laborCents, transportCents, directCents, overheadCents, contingencyCents, costCents, ledCents: ledMat + ledLab },
    linearM, ledM: r2(ledM), market, tiers, recommended, advice, unpriced,
    referenceSharePct: materialsCents ? Math.round((refCents / materialsCents) * 100) : 0,
  };
}
