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
  'hw:wood_leg': ref(190, 120, 320, 'pza', 'Pata cónica de pino/encino con placa.'),
  'hw:mirror4mm': ref(650, 480, 900, 'm²', 'Espejo 4 mm con canto pulido, cortado en vidriería.'),
  'hw:mirror_fix': ref(70, 40, 120, 'juego'),
  'hw:bulb_g45': ref(55, 35, 90, 'pza', 'Foco LED G45 + socket.'),
  'hw:power_switch': ref(90, 60, 140, 'pza'),
  'hw:power_outlet': ref(230, 150, 350, 'pza', 'Contacto redondo para mueble Ø60.'),
  'hw:power_outlet_usb': ref(340, 240, 520, 'pza'),
  'hw:grommet60': ref(35, 20, 60, 'pza'),
  'hw:power_cable': ref(24, 16, 35, 'm', 'Uso rudo 3 × 14 AWG + clavija.'),
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
  peinador: { label: 'Peinador con espejo (por pieza)', lowCents: 650000, highCents: 1500000 },
};

const FAMILY_RANGE: Record<string, keyof typeof MARKET_RANGES_MTY> = {
  kitchen_base: 'base', kitchen_base_drawer: 'base', kitchen_wall: 'aereo', pantry: 'alacena', kitchen_island: 'base', wardrobe: 'closet', walkin: 'vestidor',
  dresser: 'cajonera', nightstand: 'buro', floating_drawer: 'buro',
  vanity_floating: 'peinador', vanity_nordic: 'peinador', vanity_industrial: 'peinador', vanity_hollywood: 'peinador', desk: 'escritorio', credenza: 'base', filing_cabinet: 'cajonera', tv_console: 'tv',
  bookcase: 'librero', bath_vanity: 'bano', laundry: 'base', shoe_cabinet: 'librero', display: 'librero', counter: 'base', custom: 'base',
};

export interface MarketSettings {
  /**
   * Costo total de insumos que captura el usuario (lo que paga por melamina, canto, herrajes, LED…).
   * null = se estima con el despiece y precios de proveedor/referencia.
   */
  inputCostCents: Cents | null;
  /** El costo de insumos capturado incluye IVA (se le quita para costear). */
  inputCostIncludesTax: boolean;
  /** Gastos de venta sobre el precio: comisión, publicidad, visitas y diseño. */
  salesCostPct: number;
  /** Costo de cobro sobre el precio (terminal, transferencias, financiamiento). */
  paymentFeePct: number;
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
  /** Utilidad neta objetivo (sobre el precio, antes de ISR) de los niveles mínimo, saludable y premium. */
  netMarginsPct: [number, number, number];
  /** Precio unitario capturado por el usuario (sin IVA), por clave de producto. */
  priceOverrides: Record<string, Cents>;
}

/**
 * Parámetros de un taller sano (pequeño/mediano, Monterrey). Base:
 * - Mano de obra pagada a salario de mercado con prestaciones (no «lo que sobre»).
 * - Indirectos 18 %: renta, luz, herramienta y su desgaste, vehículo, administración.
 * - Imprevistos 5 %: retrabajos y garantía.
 * - Venta 5 % y cobro 2 %: comisión, publicidad, visitas, terminal.
 * - Utilidad neta objetivo 18 % (antes de ISR): reinversión y colchón; 10 % es el piso, 25 % premium.
 */
export const DEFAULT_MARKET: MarketSettings = {
  inputCostCents: null,
  inputCostIncludesTax: false,
  salesCostPct: 5,
  paymentFeePct: 2,
  laborDayCents: 100000,
  helperDayCents: 60000,
  overheadPct: 18,
  consumablesPct: 3,
  contingencyPct: 5,
  transportTripCents: 90000,
  trips: null,
  includeInstallation: true,
  netMarginsPct: [10, 18, 25],
  priceOverrides: {},
};

/** Copia independiente de los valores por defecto (para proyectos nuevos y migrados). */
export const defaultMarket = (): MarketSettings => ({ ...DEFAULT_MARKET, netMarginsPct: [...DEFAULT_MARKET.netMarginsPct] as [number, number, number], priceOverrides: {} });

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
  id: 'minimo' | 'saludable' | 'premium'; label: string;
  /** Utilidad neta sobre el precio (antes de ISR). */
  netMarginPct: number;
  /** Margen bruto: (precio − costo total) / precio. */
  marginPct: number;
  netProfitCents: Cents;
  salesCents: Cents;
  /** Precio ÷ costo de insumos. */
  inputMultiplier: number | null;
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
    /** Insumos estimados por el despiece (para comparar con lo capturado). */
    estimatedMaterialsCents: Cents;
    /** Parte del costo que es LED (material + mano de obra), para mostrarla por separado. */
    ledCents: Cents;
  };
  linearM: number;
  ledM: number;
  /** Rango de mercado para este proyecto (sin IVA). */
  market: { lowCents: Cents; highCents: Cents; breakdown: { label: string; linearM: number; lowCents: Cents; highCents: Cents }[] } | null;
  tiers: PriceTier[];
  recommended: PriceTier['id'];
  /** De dónde sale el costo de insumos. */
  inputSource: 'capturado' | 'estimado';
  /** Revisión de salud del precio recomendado. */
  health: { id: string; ok: boolean; label: string; detail: string }[];
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
  const estimatedMaterialsCents = materials.reduce((s, m) => s + m.totalCents, 0);
  const inputSource: MarketEstimate['inputSource'] = settings.inputCostCents !== null && settings.inputCostCents > 0 ? 'capturado' : 'estimado';
  const materialsCents = inputSource === 'capturado'
    ? Math.round(settings.inputCostIncludesTax ? settings.inputCostCents! / (1 + taxPct / 100) : settings.inputCostCents!)
    : estimatedMaterialsCents;
  const refCents = inputSource === 'capturado' ? 0 : materials.filter((m) => m.source === 'referencia').reduce((s, m) => s + m.totalCents, 0);
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
  const drawers = calc.parts.filter((p) => p.code.startsWith('DRAWER_FRONT')).reduce((s, p) => s + p.quantity, 0);
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
  const fxAll = calc.modules.flatMap((m) => m.fixtures ?? []);
  const nLegs = fxAll.filter((f) => f.kind === 'leg').length;
  const nMirrors = fxAll.filter((f) => f.kind === 'mirror').length;
  const nBulbs = fxAll.filter((f) => f.kind === 'bulb').length;
  const nOut = fxAll.filter((f) => f.kind === 'outlet').length, nGrom = fxAll.filter((f) => f.kind === 'grommet').length, nExit = fxAll.filter((f) => f.kind === 'cable_exit').length;
  add('patas', 'Patas', nLegs * 5, 'oficial', `${nLegs} patas × 5 min`);
  add('espejo', 'Espejo e iluminación', nMirrors * 30 + nBulbs * 6, 'oficial+ayudante', `${nMirrors} espejo(s) × 30 min + ${nBulbs} focos × 6 min`);
  add('electrico', 'Conexión eléctrica', nOut * 25 + nGrom * 8 + nExit * 5, 'oficial', `${nOut} contactos × 25 min + ${nGrom} pasacables × 8 + ${nExit} salidas × 5`);
  add('empaque', 'Empaque', modules * 10, 'oficial+ayudante', `${modules} módulos × 10 min`);
  if (settings.includeInstallation) add('instalacion', 'Instalación en obra', (modules - wallOrTall) * 60 + wallOrTall * 75 + ledModules * 20, 'oficial+ayudante', `${modules - wallOrTall} × 60 min + ${wallOrTall} aéreos/altos × 75 min + ${ledModules} con LED × 20 min`);
  const laborCents = labor.reduce((s, l) => s + l.cents, 0);
  const trips = settings.trips ?? Math.max(1, Math.ceil(modules / 6));
  const transportCents = trips * settings.transportTripCents;

  const directCents = materialsCents + consumablesCents + laborCents + transportCents;
  const overheadCents = Math.round(directCents * settings.overheadPct / 100);
  const contingencyCents = Math.round((directCents + overheadCents) * settings.contingencyPct / 100);
  const costCents = directCents + overheadCents + contingencyCents;
  // Si el usuario capturó sus insumos, la parte LED se estima en la misma proporción que en el despiece.
  const ledShare = estimatedMaterialsCents ? materials.filter((m) => m.key.startsWith('hw:led_')).reduce((s, m) => s + m.totalCents, 0) / estimatedMaterialsCents : 0;
  const ledMat = Math.round(materialsCents * ledShare);
  const ledLab = labor.filter((l) => l.id === 'router' || l.id === 'led').reduce((s, l) => s + l.cents, 0);

  // --- Rango de mercado del proyecto (por metro lineal de frente de cada módulo)
  const groups = new Map<string, { label: string; linearM: number; lowCents: number; highCents: number }>();
  for (const m of project.modules) {
    const k = FAMILY_RANGE[m.familyId] ?? 'base';
    const r = MARKET_RANGES_MTY[k]!;
    const units = k === 'buro' || k === 'peinador' ? 1 : m.widthMm / 1000;
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

  const labels: Record<PriceTier['id'], string> = { minimo: 'Mínimo', saludable: 'Saludable', premium: 'Premium' };
  const ids: PriceTier['id'][] = ['minimo', 'saludable', 'premium'];
  const ledCost = Math.round((ledMat * (1 + settings.consumablesPct / 100) + ledLab) * (1 + settings.overheadPct / 100) * (1 + settings.contingencyPct / 100));
  const salesPct = settings.salesCostPct + settings.paymentFeePct;
  const priceFor = (cost: number, net: number) => Math.round(cost / (1 - Math.min(0.95, (salesPct + net) / 100)) / 100) * 100; // redondeo a pesos
  const tiers: PriceTier[] = ids.map((id, i) => {
    const net = Math.min(60, Math.max(0, settings.netMarginsPct[i] ?? 18));
    const before = priceFor(costCents, net);
    const tax = Math.round(before * taxPct / 100);
    const salesCents = Math.round(before * salesPct / 100);
    const position: PriceTier['position'] = !market ? 'sin_referencia' : before < market.lowCents ? 'debajo' : before > market.highCents ? 'arriba' : 'dentro';
    return {
      id, label: labels[id], netMarginPct: net, marginPct: before ? Math.round(((before - costCents) / before) * 1000) / 10 : 0,
      netProfitCents: before - costCents - salesCents, salesCents, inputMultiplier: materialsCents ? Math.round((before / materialsCents) * 100) / 100 : null,
      beforeTaxCents: before, taxCents: tax, totalCents: before + tax, perLinearMCents: linearM > 0 ? Math.round(before / linearM) : null, position,
      withoutLedBeforeTaxCents: ledM > 0 ? priceFor(costCents - ledCost, net) : null,
    };
  });

  // --- Recomendación: el precio saludable, salvo que el mercado diga otra cosa (nunca debajo del mínimo).
  const advice: string[] = [];
  let recommended: PriceTier['id'] = 'saludable';
  const mid = tiers[1]!;
  if (market) {
    if (mid.position === 'arriba') {
      recommended = 'minimo';
      advice.push(tiers[0]!.position === 'arriba'
        ? 'Aun con la utilidad mínima quedas arriba del mercado de Monterrey: baja costos (compra de material, horas de taller o indirectos) o justifica con herrajes y acabados superiores. No vendas debajo del mínimo.'
        : 'El precio saludable queda arriba del mercado; el mínimo sí entra. Úsalo para competir, pero revisa tus costos: con utilidad mínima hay poco colchón.');
    } else if (mid.position === 'debajo') {
      recommended = tiers[2]!.position === 'arriba' ? 'saludable' : 'premium';
      advice.push(`El mercado paga más que tu precio saludable (desde ${Math.round(market.lowCents / 100).toLocaleString('es-MX')} MXN sin IVA): ${recommended === 'premium' ? 'puedes cobrar el precio premium' : 'puedes subir hacia el rango de mercado'}.`);
    } else {
      advice.push('El precio saludable cae dentro del rango de Monterrey para este tipo de mueble.');
    }
  }
  const rec = tiers.find((t) => t.id === recommended)!;
  const deposit = Math.round(rec.totalCents * 0.6);
  const inputsWithTax = Math.round((materialsCents + consumablesCents) * (1 + taxPct / 100));
  const health: MarketEstimate['health'] = [
    { id: 'utilidad', ok: rec.netMarginPct >= 15, label: 'Utilidad neta', detail: `${rec.netMarginPct} % del precio (${Math.round(rec.netProfitCents / 100).toLocaleString('es-MX')} MXN). Sano: 15–25 %.` },
    { id: 'mano_obra', ok: true, label: 'Mano de obra pagada', detail: `${r2(labor.reduce((t, l) => t + l.hours, 0))} h a $${Math.round(settings.laborDayCents / 100)} por día de oficial (con prestaciones).` },
    { id: 'indirectos', ok: settings.overheadPct >= 12, label: 'Indirectos cubiertos', detail: `${settings.overheadPct} % para renta, luz, herramienta y vehículo. Sano: 15–25 %.` },
    { id: 'multiplicador', ok: (rec.inputMultiplier ?? 0) >= 2, label: 'Precio vs. insumos', detail: `${rec.inputMultiplier ?? '—'} × el costo de insumos. En carpintería a medida suele estar entre 2 y 3.5 ×.` },
    { id: 'anticipo', ok: deposit >= inputsWithTax, label: 'El anticipo paga el material', detail: `Anticipo 60 % = ${Math.round(deposit / 100).toLocaleString('es-MX')} MXN; insumos con IVA ≈ ${Math.round(inputsWithTax / 100).toLocaleString('es-MX')} MXN.` },
    ...(market ? [{ id: 'mercado', ok: rec.position === 'dentro', label: 'Dentro del mercado', detail: `Rango Monterrey ${Math.round(market.lowCents / 100).toLocaleString('es-MX')}–${Math.round(market.highCents / 100).toLocaleString('es-MX')} MXN sin IVA.` }] : []),
  ];
  if (inputSource === 'estimado') advice.push('Captura arriba el costo real de tus insumos para que el precio parta de lo que tú pagas (ahora se usa una estimación del despiece).');
  else if (estimatedMaterialsCents && Math.abs(materialsCents - estimatedMaterialsCents) / estimatedMaterialsCents > 0.4) advice.push(`Tus insumos difieren más de 40 % de lo que estima el despiece (${Math.round(estimatedMaterialsCents / 100).toLocaleString('es-MX')} MXN sin IVA): revisa que estén completos (tableros, canto, herrajes, LED).`);
  if (ledM > 0) advice.push(`LED empotrado: ${r2(ledM)} m. Ofrécelo como opción: el cliente ve el precio con y sin LED.`);
  advice.push('Cobra 60 % de anticipo para comprar material y 40 % contra entrega e instalación.');

  return {
    region: MARKET_REGION, referenceDate: MARKET_REFERENCE_DATE, materials, labor,
    totals: { materialsCents, consumablesCents, laborCents, transportCents, directCents, overheadCents, contingencyCents, costCents, ledCents: ledMat + ledLab, estimatedMaterialsCents },
    linearM, ledM: r2(ledM), market, tiers, recommended, inputSource, health, advice, unpriced,
    referenceSharePct: materialsCents ? Math.round((refCents / materialsCents) * 100) : 0,
  };
}
