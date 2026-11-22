import { catalogLookup, type Catalog, type CatalogLookup } from '../catalog';
import { DEFAULT_MANUFACTURING } from '../project/factory';
import type { Box3, DimensionCheck, EdgeName, FamilyDefinition, ManufacturingSettings, MaterialDefinition, ModuleResult, ModuleSpec, SteelRequirement } from '../types';
import { box, ModuleBuilder, overlapVolume, r2 } from './helpers';
import { applyLed } from './led';
import { applyFixtures } from './fixtures';
import { shelfSag } from './structural';
import { verifyModule } from './verify';

/** Parámetros constructivos configurables del motor (no son normas universales). */
export const ENGINE_DEFAULTS = {
  maxDoorWidthMm: 600,
  shelfSideClearanceMm: 2,
  shelfBackClearanceMm: 5,
  drawerRearClearanceMm: 10,
  drawerBoxHeightDeductionMm: 40,
  drawerBottomThicknessMm: 6,
  hatShelfGapMm: 350,
  railBelowShelfMm: 50,
  plinthSetbackMm: 40,
  tallUnitAntiTipMm: 1200,
  drawerUnitAntiTipMm: 600,
  backScrewSpacingMm: 150,
  deskMaxModestyMm: 280,
  deskMinKneeClearanceMm: 620,
  deskMinLegroomWidthMm: 600,
  /** Alto del frente de cada cajón superior en «cajón + puertas». */
  topDrawerFrontMm: 160,
  /** Alto mínimo de puerta bajo los cajones. */
  minDoorUnderDrawerMm: 200,
  /** En cajones graduados, cada cajón hacia abajo es esta fracción más alto que el de arriba. */
  graduatedStep: 0.25,
};

export interface FrontZone { z0: number; h: number }

/**
 * Reparto vertical de frentes: cajones (iguales o graduados) y, en «cajón + puertas», la zona de puertas
 * y el travesaño fijo que separa ambas. Alturas exactas: frentes + juntas = alto − 2 holguras.
 */
export function frontLayout(spec: ModuleSpec, zb: number): { drawers: FrontZone[]; door: FrontZone | null; railZ: number | null } {
  const r = spec.revealMm, g = spec.frontGapMm;
  const avail = spec.heightMm - 2 * r;
  if (spec.front === 'drawer_doors') {
    const n = Math.min(3, Math.max(1, Math.round(spec.drawerCount || 1)));
    const fh = ENGINE_DEFAULTS.topDrawerFrontMm;
    const dh = r2(avail - n * (fh + g));
    if (dh < ENGINE_DEFAULTS.minDoorUnderDrawerMm) throw new ModuleInputError('DOOR_UNDER_DRAWER_TOO_LOW', `Quedan ${dh} mm para puertas bajo ${n} cajón(es) de ${fh} mm: aumente el alto o quite cajones.`);
    const door = { z0: zb + r, h: dh };
    const drawers = Array.from({ length: n }, (_, i) => ({ z0: r2(zb + r + dh + g + i * (fh + g)), h: fh }));
    return { drawers, door, railZ: r2(zb + r + dh + g / 2) };
  }
  if (spec.front !== 'drawers') return { drawers: [], door: spec.front === 'doors' ? { z0: zb + r, h: avail } : null, railZ: null };
  const n = Math.max(1, Math.round(spec.drawerCount));
  const free = avail - (n - 1) * g;
  // i = 0 es el de abajo (el más alto si son graduados).
  const w = Array.from({ length: n }, (_, i) => (spec.drawerLayout === 'graduated' ? 1 + ENGINE_DEFAULTS.graduatedStep * (n - 1 - i) : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  // Graduados: milímetros enteros (más fácil de cortar y medir); el de arriba absorbe el residuo.
  const hs = w.map((x) => (spec.drawerLayout === 'graduated' ? Math.round((free * x) / sum) : r2((free * x) / sum)));
  hs[n - 1] = r2(free - hs.slice(0, -1).reduce((a, b) => a + b, 0));
  let z = zb + r;
  const drawers = hs.map((h) => { const f = { z0: r2(z), h }; z += h + g; return f; });
  return { drawers, door: null, railZ: null };
}

export class ModuleInputError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** Calcula piezas, herrajes, mecanizados, herrería e incidencias de un módulo. Función pura. */
export function calculateModule(spec: ModuleSpec, catalog: Catalog, offsetXMm = 0, settings: ManufacturingSettings = DEFAULT_MANUFACTURING): ModuleResult {
  const L = catalogLookup(catalog);
  const family = L.family(spec.familyId);
  const material = L.material(spec.materialId);
  const edgeBandId = spec.edgePolicy === 'none' ? null : spec.edgeBandId;
  const b = new ModuleBuilder(spec.id, spec.finishId, edgeBandId, edgeBandId ? L.edgeBand(edgeBandId).thicknessMm : 0, settings);
  const result = (fabricable: boolean, extra: Partial<ModuleResult> = {}): ModuleResult => ({
    moduleId: spec.id, offsetXMm, offsetYMm: 0, fabricable,
    parts: b.parts, hardware: b.hardware, machining: b.machining, steel: [], issues: b.issues,
    theoreticalDiagonalMm: null, carcassDepthMm: null, overallHeightMm: spec.heightMm, checks: [], weightKg: 0, ledRuns: [], fixtures: [], ...extra,
  });

  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const nums = { W, H, D, T, baseHeight: spec.baseHeightMm, reveal: spec.revealMm, gap: spec.frontGapMm };
  for (const [k, v] of Object.entries(nums)) {
    if (!Number.isFinite(v) || v < 0 || (['W', 'H', 'D', 'T'].includes(k) && v === 0)) {
      b.issue({ code: 'INVALID_NUMBER', severity: 'error', message: `Valor inválido para ${k}: ${v}. Todas las medidas deben ser números positivos en mm.` });
      return result(false);
    }
  }
  if (W <= 2 * T) {
    b.issue({ code: 'WIDTH_BELOW_DOUBLE_THICKNESS', severity: 'error', message: `Ancho ${W} mm ≤ 2 × espesor (${2 * T} mm): no existe plan fabricable.` });
    return result(false);
  }
  if (H <= 2 * T) {
    b.issue({ code: 'HEIGHT_BELOW_DOUBLE_THICKNESS', severity: 'error', message: `Alto ${H} mm ≤ 2 × espesor (${2 * T} mm): no existe plan fabricable.` });
    return result(false);
  }
  if (material.thicknessMm !== T) {
    b.issue({ code: 'THICKNESS_MATERIAL_MISMATCH', severity: 'warning', message: `El espesor de cálculo (${T} mm) difiere del nominal del material ${material.name} (${material.thicknessMm} mm). Medir espesor real.` });
  }
  if (material.kind === 'solidwood') {
    b.issue({ code: 'SOLID_WOOD_REVIEW', severity: 'blocker', message: 'Madera maciza: medidas orientativas; rediseñar uniones y permitir movimiento higroscópico antes de liberar.' });
  }
  familyIssues(family, b);
  if (spec.edgePolicy === 'none') {
    b.issue({ code: 'EDGE_VISIBLE_UNBANDED', severity: 'warning', message: 'Política sin tapacanto: los cantos visibles quedarán expuestos (riesgo de humedad y despostillado).' });
  }

  const ctx: Ctx = { spec, catalog, L, family, material, b, settings, structuralChecks: [], expected: null, hingesPerDoor: null, halfOverlayLeaves: 0 };
  let extra: Partial<ModuleResult>;
  try {
    extra = family.geometryStrategy === 'desk' ? buildDesk(ctx) : buildBox(ctx);
  } catch (e) {
    if (e instanceof ModuleInputError) {
      b.issue({ code: e.code, severity: 'error', message: e.message });
      return result(false);
    }
    throw e;
  }

  const ledRuns = applyLed(spec, L, b);
  const fixtures = applyFixtures(spec, L, b, ledRuns);
  checkSheetFit(ctx);
  checkCollisions(b);
  const v = verifyModule({
    spec, L, parts: b.parts, settings,
    expected: ctx.expected ?? { x0: 0, x1: spec.widthMm, y0: 0, y1: spec.depthMm, z0: 0, z1: spec.heightMm },
    slideClearanceMm: L.maybeHardware(spec.slideProductId)?.params?.sideClearancePerSideMm ?? 0,
    hingesPerDoor: ctx.hingesPerDoor,
    halfOverlayLeaves: ctx.halfOverlayLeaves,
  });
  for (const i of v.issues) b.issue(i);
  const fabricable = !b.issues.some((i) => i.severity === 'error');
  return result(fabricable, { ...extra, checks: [...ctx.structuralChecks, ...v.checks], weightKg: v.weightKg, ledRuns, fixtures });
}

interface Ctx {
  spec: ModuleSpec;
  catalog: Catalog;
  L: CatalogLookup;
  family: FamilyDefinition;
  material: MaterialDefinition;
  b: ModuleBuilder;
  settings: ManufacturingSettings;
  /** Verificaciones de flecha calculadas durante la construcción. */
  structuralChecks: DimensionCheck[];
  /** Envolvente exterior esperada (para la verificación de cierre). */
  expected: Box3 | null;
  hingesPerDoor: number | null;
  halfOverlayLeaves: number;
}

/** Verifica que pata de PTR + elemento de tablero sumen la altura total pedida. */
function steelHeightCheck(ctx: Ctx, legMm: number, what: string, panelMm: number, totalMm: number) {
  const sum = r2(legMm + panelMm);
  ctx.structuralChecks.push({
    id: `${ctx.spec.id}-STH`, moduleId: ctx.spec.id, category: 'cierre', label: `Alto total con bastidor PTR (pata + ${what})`,
    expected: `${r2(totalMm)} mm`, actual: `${r2(legMm)} + ${r2(panelMm)} = ${sum} mm`, status: Math.abs(sum - totalMm) <= 0.05 ? 'ok' : 'error',
  });
}

/** Carga de diseño del módulo (kg/m²): la del módulo o la de su familia. */
function designLoad(ctx: Ctx): number {
  return ctx.spec.shelfLoadKgM2 ?? ctx.family.defaults.shelfLoadKgM2;
}

/** Registra la verificación de flecha de un elemento horizontal; devuelve si cumple. */
function sagCheck(ctx: Ctx, label: string, spanMm: number, depthMm: number, partId?: string): boolean {
  const load = designLoad(ctx);
  const res = shelfSag({ spanMm, depthMm, thicknessMm: ctx.spec.thicknessMm, loadKgM2: load, material: ctx.material, limitRatio: ctx.settings.sagLimitRatio });
  if (!res) return true;
  ctx.structuralChecks.push({
    id: `${ctx.spec.id}-SAG-${ctx.structuralChecks.length + 1}`, moduleId: ctx.spec.id, category: 'flecha', label: `${label} (claro ${r2(spanMm)} × fondo ${r2(depthMm)} mm, ${load} kg/m²)`,
    expected: `≤ ${res.limitMm} mm (claro/${ctx.settings.sagLimitRatio})`, actual: `${res.finalMm} mm a largo plazo (${res.instantMm} mm inmediata)`, status: res.ok ? 'ok' : 'warning', ...(partId ? { partId } : {}),
  });
  if (!res.ok) {
    ctx.b.issue({
      code: 'SHELF_SAG_EXCEEDED', severity: 'warning', ...(partId ? { partId } : {}),
      message: `${label}: flecha estimada ${res.finalMm} mm a largo plazo con ${load} kg/m² supera ${res.limitMm} mm (claro/${ctx.settings.sagLimitRatio}). Agregue divisor, reduzca el claro, use tablero más grueso o rigidice con un larguero.`,
    });
  }
  return res.ok;
}

function familyIssues(family: FamilyDefinition, b: ModuleBuilder) {
  if (family.status === 'template_requires_engine_validation') {
    b.issue({ code: 'TEMPLATE_REQUIRES_ENGINE_VALIDATION', severity: 'blocker', message: `${family.name}: plantilla aproximada con el motor de caja genérico; requiere motor/reglas específicas y revisión de ingeniería.` });
  } else if (family.status === 'configurable_base_template') {
    b.issue({ code: 'TEMPLATE_GENERIC_RULES', severity: 'info', message: `${family.name}: plantilla configurable sobre el motor de caja genérico; reglas propias de la familia por validar.` });
  }
  for (const rule of family.pendingRules) b.issue({ code: 'FAMILY_RULE_PENDING', severity: 'warning', message: `${family.name}: ${rule}` });
}

/** Conectores por unión según profundidad (orientativo, editable). */
function connectorsPerJoint(depth: number): number {
  return depth <= 400 ? 2 : depth <= 700 ? 3 : 4;
}

function joineryHardware(ctx: Ctx, joints: number, depth: number, targetParts: { partId: string; joints: number }[]) {
  const { spec, L, b } = ctx;
  const k = connectorsPerJoint(depth);
  const n = joints * k;
  const basis = `${joints} uniones × ${k} conectores (profundidad ${r2(depth)} mm); cantidad orientativa`;
  const cam = L.hardware('cam-minifix15');
  const dowel = L.hardware('dowel-8x35');
  const screw = L.hardware('screw-4x40');
  if (spec.joinery === 'cam' || spec.joinery === 'mixed') {
    b.hw({ category: 'cam_connector', productId: cam.id, productKey: cam.productKey, description: cam.name, quantity: n, unit: cam.unit, basis, validationStatus: cam.validationStatus });
    const pattern = L.pattern(cam.machiningPatternId!);
    for (const t of targetParts) {
      const part = b.parts.find((p) => p.id === t.partId);
      if (part) b.machine(pattern, part, (t.joints * k) / part.quantity, 'Excéntrico + perno', cam.id);
    }
  }
  if (spec.joinery === 'dowel' || spec.joinery === 'mixed' || spec.joinery === 'cam') {
    b.hw({ category: 'dowel', productId: dowel.id, productKey: dowel.productKey, description: dowel.name, quantity: n, unit: dowel.unit, basis: `${basis}; taquete de alineación`, validationStatus: dowel.validationStatus });
  }
  if (spec.joinery === 'screw') {
    b.hw({ category: 'screw', productId: screw.id, productKey: screw.productKey, description: screw.name, quantity: n, unit: screw.unit, basis, validationStatus: screw.validationStatus });
  }
}

function edgesFor(spec: ModuleSpec, kind: 'carcass_front' | 'front' | 'shelf' | 'back' | 'side'): EdgeName[] {
  if (spec.edgePolicy === 'none') return [];
  switch (kind) {
    case 'front': return ['L1', 'L2', 'A1', 'A2'];
    case 'back': return [];
    case 'shelf': return spec.backMaterialId ? ['L1'] : ['L1', 'L2'];
    case 'side': {
      const e: EdgeName[] = ['L1'];
      if (spec.edgePolicy === 'all_visible') {
        if (spec.construction === 'top_bottom_between_sides') e.push('A2');
        if (spec.mount === 'wall' && spec.construction === 'top_bottom_between_sides') e.push('A1');
        if (!spec.backMaterialId) e.push('L2');
      }
      return e;
    }
    case 'carcass_front': {
      const e: EdgeName[] = ['L1'];
      if (spec.edgePolicy === 'all_visible' && spec.construction === 'sides_between_top_bottom') e.push('A1', 'A2');
      return e;
    }
  }
}

// ---------------------------------------------------------------------------
// Caja genérica (gabinetes, alacenas, clósets, libreros, etc.)
// ---------------------------------------------------------------------------

function buildBox(ctx: Ctx): Partial<ModuleResult> {
  const { spec, L, b, material, family } = ctx;
  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const isWardrobe = family.geometryStrategy === 'wardrobe';
  const backMat = spec.backMaterialId ? L.material(spec.backMaterialId) : null;
  const B = backMat?.thicknessMm ?? 0;
  const frontT = spec.front === 'open' ? 0 : T;
  const cd = D - B - frontT;
  if (cd < 100) throw new ModuleInputError('DEPTH_INSUFFICIENT', `Profundidad de caja ${r2(cd)} mm (fondo ${D} − respaldo ${B} − frente ${frontT}) insuficiente para fabricar.`);

  const baseH = spec.baseType === 'none' ? 0 : spec.baseHeightMm;
  const zb = baseH;
  const y0 = frontT, y1 = frontT + cd;
  const IW = W - 2 * T;
  const IH = H - 2 * T;
  const iz0 = zb + T, iz1 = zb + H - T;
  const grain = 'length' as const;

  // Costados y horizontales
  if (spec.construction === 'top_bottom_between_sides') {
    b.part({ code: 'SIDE', name: 'Costado (izq./der.)', role: 'carcass', lengthMm: H, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side'), materialId: material.id,
      placements: [box(0, T, y0, y1, zb, zb + H), box(W - T, W, y0, y1, zb, zb + H)] });
    b.part({ code: 'HORIZONTAL', name: 'Tapa y piso (entre costados)', role: 'carcass', lengthMm: IW, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'carcass_front'), materialId: material.id,
      placements: [box(T, W - T, y0, y1, zb, zb + T), box(T, W - T, y0, y1, zb + H - T, zb + H)] });
  } else {
    b.part({ code: 'HORIZONTAL', name: 'Tapa y piso (sobre costados)', role: 'carcass', lengthMm: W, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'carcass_front'), materialId: material.id,
      placements: [box(0, W, y0, y1, zb, zb + T), box(0, W, y0, y1, zb + H - T, zb + H)] });
    b.part({ code: 'SIDE', name: 'Costado (entre tapa y piso)', role: 'carcass', lengthMm: IH, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side'), materialId: material.id,
      placements: [box(0, T, y0, y1, iz0, iz1), box(W - T, W, y0, y1, iz0, iz1)] });
  }

  // Divisores: automáticos según la flecha calculada de entrepaños (o del piso si no hay entrepaños y no hay zoclo que lo apoye)
  const shelfDepthForSag = cd - ENGINE_DEFAULTS.shelfBackClearanceMm;
  const layout = frontLayout(spec, zb);
  // En «cajón + puertas» los entrepaños quedan bajo el travesaño fijo.
  const shelfTop = layout.railZ !== null ? r2(layout.railZ - T / 2) : iz1;
  const hasShelves = spec.front !== 'drawers' && spec.shelvesPerBay > 0;
  const bottomSpans = spec.front !== 'drawers' && (spec.baseType === 'none' || spec.baseType === 'levelers');
  const sagOk = (span: number) => {
    const r = shelfSag({ spanMm: span, depthMm: hasShelves ? shelfDepthForSag : cd, thicknessMm: T, loadKgM2: designLoad(ctx), material, limitRatio: ctx.settings.sagLimitRatio });
    return !r || r.ok;
  };
  let autoDividers = 0;
  if (hasShelves || bottomSpans) {
    while (autoDividers < 8 && !sagOk((IW - autoDividers * T) / (autoDividers + 1)) && (IW - (autoDividers + 1) * T) / (autoDividers + 2) >= 250) autoDividers++;
  }
  let dividers = spec.dividerCount ?? autoDividers;
  // Cajones a todo el ancho: sin divisores. En «cajón + puertas» los divisores llegan sólo hasta el travesaño.
  // Cama abatible: la base entra completa en el mueble, sin divisores.
  if (spec.front === 'fold_down' && spec.foldKind === 'bed') dividers = 0;
  if (spec.front === 'drawers' && dividers > 0) {
    if (spec.dividerCount) b.issue({ code: 'DRAWERS_WITH_DIVIDERS', severity: 'warning', message: 'Los frentes de cajón ocupan todo el ancho: se omiten divisores. Divida en módulos si se requieren columnas.' });
    dividers = 0;
  }
  const bays = dividers + 1;
  const bayW = (IW - dividers * T) / bays;
  if (bayW < 100) throw new ModuleInputError('BAY_TOO_NARROW', `Hueco interior de ${r2(bayW)} mm: demasiados divisores para el ancho.`);
  const bayX0 = (i: number) => T + i * (bayW + T);
  if (dividers > 0) {
    b.part({ code: 'DIVIDER', name: layout.railZ !== null ? 'Divisor vertical (hasta el travesaño)' : 'Divisor vertical', role: 'divider', lengthMm: r2(shelfTop - iz0), widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side').slice(0, 1), materialId: material.id,
      placements: Array.from({ length: dividers }, (_, i) => box(bayX0(i) + bayW, bayX0(i) + bayW + T, y0, y1, iz0, shelfTop)),
      notes: spec.dividerCount === null ? [`Divisores automáticos: mínimo necesario para que la flecha calculada cumpla claro/${ctx.settings.sagLimitRatio} con ${designLoad(ctx)} kg/m².`] : [] });
  }

  // Respaldo sobrepuesto (dividido en piezas que quepan en el tablero, con juntas sobre divisores)
  if (backMat) {
    const segs = backSegments(ctx, backMat, dividers, bayX0, bayW);
    const groups = new Map<number, [number, number][]>();
    for (const sg of segs) {
      const w = r2(sg[1] - sg[0]);
      const key = [...groups.keys()].find((x) => Math.abs(x - w) < 0.02) ?? w;
      groups.set(key, [...(groups.get(key) ?? []), sg]);
    }
    let gi = 0;
    for (const [w, list] of groups) {
      b.part({ code: gi === 0 ? 'BACK' : `BACK_${gi + 1}`, name: segs.length > 1 ? `Respaldo sobrepuesto ${backMat.name} (sección)` : `Respaldo sobrepuesto ${backMat.name}`, role: 'back', lengthMm: H, widthMm: w, thicknessMm: B, grainAxis: 'none', edges: [], materialId: backMat.id,
        placements: list.map(([a, c]) => box(a, c, y1, y1 + B, zb, zb + H)),
        notes: [segs.length > 1 ? `Respaldo en ${segs.length} secciones por tamaño de tablero; juntas sobre divisor o listón.` : 'Sobrepuesto en cara posterior; fija la escuadra de la caja.'] });
      gi++;
    }
    const perimeter = 2 * (W + H) + (segs.length - 1) * 2 * H;
    const screws = Math.ceil(perimeter / ENGINE_DEFAULTS.backScrewSpacingMm);
    const spax = L.hardware('screw-spax-4x15');
    b.hw({ category: 'screw', productId: spax.id, productKey: spax.productKey, description: `${spax.name} — fijación de respaldo`, quantity: screws, unit: spax.unit, basis: `perímetro + juntas ${perimeter} mm / ${ENGINE_DEFAULTS.backScrewSpacingMm} mm de paso (orientativo)`, validationStatus: 'pending_validation' });
  } else {
    b.issue({ code: 'NO_BACK_PANEL', severity: 'warning', message: 'Sin respaldo: la caja requiere otro medio de rigidización/escuadra (travesaños, fijación a muro).' });
  }

  // Unión de caja: 4 uniones + 2 por divisor
  const joints = 4 + dividers * 2;
  const horizontalId = `${spec.id}-HORIZONTAL`;
  joineryHardware(ctx, joints, cd, [{ partId: horizontalId, joints: 4 }, ...(dividers ? [{ partId: `${spec.id}-DIVIDER`, joints: dividers * 2 }] : [])]);

  // Entrepaños / clóset
  const shelfLen = bayW - ENGINE_DEFAULTS.shelfSideClearanceMm;
  const shelfDepth = cd - ENGINE_DEFAULTS.shelfBackClearanceMm;
  const shelfPlacements: ReturnType<typeof box>[] = [];
  const shelfPin = L.hardware('shelf-pin-5');
  const railSegments: number[] = [];
  const sc = ENGINE_DEFAULTS.shelfSideClearanceMm / 2;
  if (spec.front !== 'drawers') {
    if (isWardrobe) {
      const tower = bays >= 2 && spec.shelvesPerBay > 1 ? bays - 1 : -1;
      for (let i = 0; i < bays; i++) {
        const x0 = bayX0(i) + sc, x1 = bayX0(i) + bayW - sc;
        if (i === tower) {
          for (const z of evenZ(iz0, shelfTop, spec.shelvesPerBay, T)) shelfPlacements.push(box(x0, x1, y0, y0 + shelfDepth, z, z + T));
          continue;
        }
        let railZ = iz1 - 60;
        const hatZ = iz1 - ENGINE_DEFAULTS.hatShelfGapMm - T;
        if (spec.shelvesPerBay >= 1 && hatZ < iz0 + 300) {
          b.issue({ code: 'HAT_SHELF_SKIPPED', severity: 'warning', message: `Hueco ${i + 1}: alto insuficiente para maletero a ${ENGINE_DEFAULTS.hatShelfGapMm} mm de la tapa.` });
        } else if (spec.shelvesPerBay >= 1) {
          const z = hatZ;
          shelfPlacements.push(box(x0, x1, y0, y0 + shelfDepth, z, z + T));
          railZ = z - ENGINE_DEFAULTS.railBelowShelfMm;
        }
        railSegments.push(bayW);
        if (railZ - zb < 1000) b.issue({ code: 'HANGING_HEIGHT_LOW', severity: 'warning', message: `Hueco ${i + 1}: tubo de colgar a ${r2(railZ)} mm del piso; ropa larga requiere ≥1600 mm, camisas ≥1000 mm.` });
      }
    } else {
      for (let i = 0; i < bays; i++) {
        for (const z of evenZ(iz0, shelfTop, spec.shelvesPerBay, T)) shelfPlacements.push(box(bayX0(i) + sc, bayX0(i) + bayW - sc, y0, y0 + shelfDepth, z, z + T));
      }
    }
  }
  if (shelfPlacements.length) {
    sagCheck(ctx, 'Flecha de entrepaño', bayW, shelfDepth, `${spec.id}-SHELF`);
  } else if (bottomSpans) {
    sagCheck(ctx, 'Flecha del piso (sin zoclo que lo apoye)', bayW, cd, `${spec.id}-HORIZONTAL`);
  }
  if (shelfPlacements.length) {
    const shelf = b.part({ code: 'SHELF', name: 'Entrepaño móvil', role: 'shelf', lengthMm: shelfLen, widthMm: shelfDepth, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'shelf'), materialId: material.id,
      placements: shelfPlacements, notes: [`Holgura ${ENGINE_DEFAULTS.shelfSideClearanceMm} mm en ancho y ${ENGINE_DEFAULTS.shelfBackClearanceMm} mm en fondo (nominal).`] });
    b.hw({ category: 'shelf_pin', productId: shelfPin.id, productKey: shelfPin.productKey, description: shelfPin.name, quantity: shelf.quantity * 4, unit: shelfPin.unit, basis: `${shelf.quantity} entrepaños × 4 soportes`, validationStatus: shelfPin.validationStatus });
    const side = b.parts.find((p) => p.code === 'SIDE')!;
    // Por costado: 2 barrenos por cada entrepaño del hueco adyacente (aplica a cada unidad del modelo).
    b.machine(L.pattern('shelf-pin-line-32'), side, 2 * Math.max(1, Math.round(shelf.quantity / bays)), 'Barreno para soporte de entrepaño', shelfPin.id);
  }
  if (railSegments.length) {
    const rail = L.hardware('hanging-rail-oval');
    const sup = L.hardware('hanging-rail-support');
    const total = railSegments.reduce((s, x) => s + x - 2, 0);
    b.hw({ category: 'hanging_rail', productId: rail.id, productKey: rail.productKey, description: rail.name, quantity: r2(total / 1000), unit: 'm', basis: `${railSegments.length} tramos de (hueco − 2 mm)`, validationStatus: rail.validationStatus });
    b.hw({ category: 'hanging_rail_support', productId: sup.id, productKey: sup.productKey, description: sup.name, quantity: railSegments.length * 2, unit: sup.unit, basis: '2 soportes por tramo', validationStatus: sup.validationStatus });
  }

  // Frentes
  if (layout.railZ !== null) {
    const rz = layout.railZ - T / 2;
    b.part({ code: 'DRAWER_RAIL', name: 'Travesaño fijo bajo cajón', role: 'carcass', lengthMm: IW, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'carcass_front'), materialId: material.id,
      placements: [box(T, W - T, y0, y1, r2(rz), r2(rz + T))], notes: ['Separa el cajón de las puertas; fijar con excéntrico o tornillo a ambos costados.'] });
  }
  if (layout.door) buildDoors(ctx, zb, dividers, layout.door);
  const fold = spec.front === 'fold_down' ? buildFold(ctx, zb, cd) : null;
  if (layout.drawers.length) buildDrawers(ctx, cd, y0, layout.drawers);

  // Base / zoclo / herrería
  const steel: SteelRequirement[] = [];
  buildBase(ctx, cd, y0, steel);

  // Montaje y antivuelco
  mountingHardware(ctx);

  ctx.expected = { x0: 0, x1: W, y0: 0, y1: D, z0: spec.baseType === 'plinth' && baseH > 0 ? 0 : zb, z1: zb + H };

  return {
    theoreticalDiagonalMm: r2(Math.hypot(W, H)),
    carcassDepthMm: r2(cd),
    overallHeightMm: H + baseH,
    steel,
    fold,
  };
}

/**
 * Frente abatible: un solo panel con bisagras en el canto inferior que baja hasta quedar horizontal.
 * Escritorio → compases; mesa → escuadras abatibles; cama → mecanismo de pistones y patas abatibles.
 */
function buildFold(ctx: Ctx, zb: number, cd: number): NonNullable<ModuleResult['fold']> {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const r = spec.revealMm;
  const lh = H - 2 * r, lw = W - 2 * r;
  const kind = spec.foldKind ?? 'desk';
  const names = { desk: 'Frente abatible (cubierta de escritorio)', bed: 'Base de cama abatible', table: 'Cubierta de mesa abatible' } as const;
  const leaf = b.part({ code: 'FOLD_LEAF', name: names[kind], role: 'front', lengthMm: lw, widthMm: lh, thicknessMm: T, grainAxis: 'length', edges: edgesFor(spec, 'front'), materialId: material.id,
    placements: [box(r, W - r, 0, T, zb + r, zb + r + lh)],
    notes: kind === 'bed' ? ['Reforzar con bastidor o listones según el mecanismo; colchón máx. 20 cm.'] : ['Abierto queda horizontal sobre el eje inferior.'],
    validationStatus: 'pending_validation' });
  const hw = (id: string, quantity: number, basis: string) => { const h = L.hardware(id); b.hw({ category: h.category, productId: h.id, productKey: h.productKey, description: h.name, quantity, unit: h.unit, basis, validationStatus: h.validationStatus }); };
  const kg = r2((lw * lh * T * 1e-9) * material.densityKgM3);
  if (kind === 'bed') {
    hw('bed-mechanism', 1, `Para base de ${lw} × ${lh} mm (${kg} kg + colchón)`);
    hw('bed-leg', 2, '2 patas al pie de la cama');
    hw('mattress-strap', 2, 'Sujetan el colchón al cerrar');
    b.issue({ code: 'FOLD_BED_VALIDATION', severity: 'blocker', message: 'Cama abatible: el mecanismo debe estar certificado para el peso de la base y el colchón, y el mueble anclado a muro estructural.' });
    if (lh < 1950) b.issue({ code: 'FOLD_BED_SHORT', severity: 'warning', partId: leaf.id, message: `Base de ${r2(lh)} mm: para colchón de 190 cm se recomiendan ≥ 1950 mm de alto de mueble útil.` });
  } else {
    hw('fold-hinge', W > 800 ? 3 : 2, `${W > 800 ? 3 : 2} bisagras en el canto inferior`);
    if (kind === 'desk') hw('lid-stay', 2, 'Un compás por lado');
    else hw('fold-bracket', W > 1000 ? 2 : 1, 'Escuadras abatibles bajo la cubierta');
    hw('magnet-catch', 2, 'Mantiene cerrado el frente');
    const h = L.maybeHardware(spec.handleProductId) ?? L.hardware('handle-generic');
    b.hw({ category: 'handle', productId: h.id, productKey: h.productKey, description: h.name, quantity: 1, unit: h.unit, basis: '1 por frente', validationStatus: h.validationStatus });
    b.issue({ code: 'FOLD_LOAD', severity: 'warning', partId: leaf.id, message: `Frente abatible de ${kg} kg: elegir ${kind === 'desk' ? 'compases' : 'escuadras'} para ese peso + 15 kg de uso; no subirse ni sentarse.` });
    if (lh > 900) b.issue({ code: 'FOLD_TOO_DEEP', severity: 'warning', partId: leaf.id, message: `Abierto sobresale ${r2(lh)} mm: más de 90 cm es incómodo y carga mucho las bisagras.` });
  }
  const pivot = zb + r;
  const elev = spec.mount === 'wall' ? spec.elevationMm ?? 0 : 0;
  void cd;
  return { kind, closedDepthMm: D, openDepthMm: r2(D + lh), surfaceHeightMm: r2(kind === 'bed' ? 350 : elev + pivot + T), leafPartId: leaf.id };
}

/**
 * Secciones del respaldo [x0, x1]. Si el respaldo completo no cabe en el tablero (con 10 mm de escuadrado
 * por lado), se divide con juntas centradas sobre divisores; si no hay divisor útil, en partes iguales
 * con aviso de listón de apoyo.
 */
function backSegments(ctx: Ctx, backMat: MaterialDefinition, dividers: number, bayX0: (i: number) => number, bayW: number): [number, number][] {
  const { widthMm: W, heightMm: H, thicknessMm: T } = ctx.spec;
  if (!backMat.sheet) return [[0, W]];
  const sl = backMat.sheet.lengthMm - 20, sw = backMat.sheet.widthMm - 20;
  const maxW = H <= sw ? sl : H <= sl ? sw : 0;
  if (maxW === 0 || W <= maxW) return [[0, W]];
  const centers = Array.from({ length: dividers }, (_, i) => bayX0(i) + bayW + T / 2);
  const cuts: number[] = [];
  let start = 0;
  let unsupported = 0;
  while (W - start > maxW) {
    const options = centers.filter((c) => c > start + 1 && c - start <= maxW);
    if (options.length) {
      start = options[options.length - 1]!;
    } else {
      const remaining = W - start;
      const k = Math.ceil(remaining / maxW);
      start = start + remaining / k;
      unsupported++;
    }
    cuts.push(start);
  }
  if (unsupported) {
    ctx.b.issue({ code: 'BACK_JOINT_UNSUPPORTED', severity: 'warning', message: `Respaldo dividido en ${cuts.length + 1} secciones por tamaño de tablero; ${unsupported} junta(s) sin divisor detrás: agregar listón vertical de apoyo.` });
  }
  const edges = [0, ...cuts, W];
  return edges.slice(1).map((x, i) => [edges[i]!, x] as [number, number]);
}

/** Posiciones Z equiespaciadas para n entrepaños de espesor t entre z0 y z1. */
export function evenZ(z0: number, z1: number, n: number, t: number): number[] {
  if (n <= 0) return [];
  const free = (z1 - z0 - n * t) / (n + 1);
  return Array.from({ length: n }, (_, i) => r2(z0 + free * (i + 1) + t * i));
}

function buildDoors(ctx: Ctx, zb: number, dividers: number, zone: FrontZone) {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, heightMm: H, thicknessMm: T } = spec;
  const r = spec.revealMm, g = spec.frontGapMm;
  // Automático: hojas repartidas por hueco para que las juntas caigan sobre los divisores.
  const bays = dividers + 1;
  const n = spec.doorCount ?? bays * Math.max(1, Math.ceil(W / bays / ENGINE_DEFAULTS.maxDoorWidthMm));
  void H;
  const dh = zone.h;
  // Tramos a cubrir: si las hojas son múltiplo de los huecos, cada tramo va de junta a junta,
  // con la junta centrada sobre el divisor (las hojas extremas cubren además el costado).
  const segments: [number, number, number][] = [];
  if (dividers > 0 && n % bays === 0) {
    const IW = W - 2 * T;
    const bayW = (IW - dividers * T) / bays;
    const centers = Array.from({ length: dividers }, (_, i) => T + (i + 1) * bayW + i * T + T / 2);
    const edges = [r - g / 2, ...centers, W - r + g / 2];
    for (let i = 0; i < bays; i++) segments.push([edges[i]! + g / 2, edges[i + 1]! - g / 2, n / bays]);
  } else {
    segments.push([r, W - r, n]);
  }
  const doors: { x0: number; x1: number }[] = [];
  for (const [a, c, k] of segments) {
    const w = (c - a - (k - 1) * g) / k;
    for (let j = 0; j < k; j++) doors.push({ x0: a + j * (w + g), x1: a + j * (w + g) + w });
  }
  if (Math.min(...doors.map((d) => d.x1 - d.x0)) < 100) throw new ModuleInputError('DOOR_TOO_NARROW', `Puertas de ${r2(Math.min(...doors.map((d) => d.x1 - d.x0)))} mm: reduzca el número de hojas.`);
  // Agrupar hojas de igual ancho en un mismo modelo de corte (DOOR, DOOR_2, …)
  const groups = new Map<number, { x0: number; x1: number }[]>();
  for (const d of doors) {
    const w = r2(d.x1 - d.x0);
    const key = [...groups.keys()].find((x) => Math.abs(x - w) < 0.02) ?? w;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  let door!: ReturnType<typeof b.part>;
  let gi = 0;
  for (const [dw, list] of groups) {
    const part = b.part({ code: gi === 0 ? 'DOOR' : `DOOR_${gi + 1}`, name: n === 1 ? 'Puerta sobrepuesta' : groups.size > 1 ? `Puerta sobrepuesta (hoja ${gi === 0 ? 'tipo A' : `tipo ${String.fromCharCode(65 + gi)}`})` : 'Puerta sobrepuesta (hoja)',
      role: 'front', lengthMm: dh, widthMm: dw, thicknessMm: T, grainAxis: 'length', edges: edgesFor(spec, 'front'), materialId: material.id,
      placements: list.map((d) => box(d.x0, d.x1, 0, T, zone.z0, zone.z0 + dh)),
      notes: [`Holgura perimetral ${r} mm y ${g} mm entre hojas${dividers ? '; juntas centradas sobre divisores' : ''}. Verificar solape con la bisagra elegida.`], validationStatus: 'pending_validation' });
    if (gi === 0) door = part;
    if (dw > ENGINE_DEFAULTS.maxDoorWidthMm) b.issue({ code: 'DOOR_TOO_WIDE', severity: 'warning', partId: part.id, message: `Puerta de ${r2(dw)} mm de ancho: verificar pandeo, peso y apertura segura.` });
    gi++;
  }
  if (dividers > 0 && n % bays !== 0) b.issue({ code: 'DOOR_DIVIDER_MISALIGNED', severity: 'warning', partId: door.id, message: `${n} puertas con ${dividers} divisor(es): hay hojas que cruzan un divisor y juntas sobre huecos abiertos. Use un múltiplo de ${bays} hojas.` });

  const hinge = L.maybeHardware(spec.hingeProductId) ?? L.hardware('hinge-generic-110');
  const rules = L.hingeRulesFor(hinge);
  const rule = rules.find((x) => dh <= x.maxDoorHeightMm);
  if (!rule) throw new ModuleInputError('DOOR_TOO_TALL', `Puerta de ${r2(dh)} mm excede la tabla de bisagras disponible (${rules.at(-1)?.maxDoorHeightMm ?? 0} mm).`);
  // Hojas que giran sobre un divisor compartido con otra hoja: requieren bisagra de semi-solape.
  const perBay = segments.length > 1 ? n / bays : 0;
  const halfLeaves = perBay >= 2 ? 2 * dividers : perBay === 1 ? Math.max(0, bays - 2) : 0;
  ctx.halfOverlayLeaves = halfLeaves;
  const basis = (k: number) => `${k} puertas × ${rule.hingesPerDoor} (alto ${r2(dh)} mm ≤ ${rule.maxDoorHeightMm}; tabla ${hinge.params?.hingeRules ? 'del producto' : 'orientativa'})`;
  b.hw({ category: 'hinge', productId: hinge.id, productKey: hinge.productKey, description: hinge.name, quantity: (n - halfLeaves) * rule.hingesPerDoor, unit: hinge.unit,
    basis: basis(n - halfLeaves), validationStatus: hinge.technicalDatasheetUrl ? hinge.validationStatus : 'pending_validation' });
  if (halfLeaves > 0) {
    const half = L.hardware('hinge-generic-110-half');
    b.hw({ category: 'hinge', productId: half.id, productKey: half.productKey, description: half.name, quantity: halfLeaves * rule.hingesPerDoor, unit: half.unit,
      basis: `${basis(halfLeaves)}; hojas que giran sobre divisor`, validationStatus: 'pending_validation' });
  }
  ctx.hingesPerDoor = rule.hingesPerDoor;
  b.issue({ code: 'HINGE_PENDING_VALIDATION', severity: 'warning', message: `Bisagras (${hinge.name}): cantidad y cazoleta pendientes de validar con ficha técnica del fabricante.` });
  if (hinge.machiningPatternId) for (const d of b.parts.filter((p) => p.code === 'DOOR' || p.code.startsWith('DOOR_'))) b.machine(L.pattern(hinge.machiningPatternId), d, rule.hingesPerDoor, 'Cazoleta de bisagra', hinge.id);
  handles(ctx, n);
}

function handles(ctx: Ctx, n: number) {
  const h = ctx.L.maybeHardware(ctx.spec.handleProductId) ?? ctx.L.hardware('handle-generic');
  ctx.b.hw({ category: 'handle', productId: h.id, productKey: h.productKey, description: h.name, quantity: n, unit: h.unit, basis: '1 por frente', validationStatus: h.validationStatus });
}

function buildDrawers(ctx: Ctx, cd: number, y0: number, zones: FrontZone[]) {
  const { spec, L, b, material, catalog } = ctx;
  const { widthMm: W, thicknessMm: T } = spec;
  const n = zones.length;
  const r = spec.revealMm;
  if (Math.min(...zones.map((z) => z.h)) < 80) throw new ModuleInputError('DRAWER_FRONT_TOO_LOW', `Frentes de cajón de ${r2(Math.min(...zones.map((z) => z.h)))} mm: demasiados cajones para el alto.`);
  // Frentes de igual alto comparten modelo de corte (DRAWER_FRONT, DRAWER_FRONT_2, …).
  const groups: { h: number; zones: FrontZone[] }[] = [];
  for (const z of zones) {
    const g = groups.find((x) => Math.abs(x.h - z.h) < 0.02);
    if (g) g.zones.push(z); else groups.push({ h: z.h, zones: [z] });
  }
  const sfx = (gi: number) => (gi === 0 ? '' : `_${gi + 1}`);
  groups.forEach((g, gi) => {
    b.part({ code: `DRAWER_FRONT${sfx(gi)}`, name: groups.length > 1 ? `Frente de cajón sobrepuesto (${r2(g.h)} mm)` : 'Frente de cajón sobrepuesto', role: 'front', lengthMm: W - 2 * r, widthMm: g.h, thicknessMm: T, grainAxis: 'length', edges: edgesFor(spec, 'front'), materialId: material.id,
      placements: g.zones.map((z) => box(r, W - r, 0, T, z.z0, z.z0 + z.h)), validationStatus: 'pending_validation' });
  });
  handles(ctx, n);

  // Sin corredera elegida se usa la genérica (valores típicos) para que las cajas siempre se calculen.
  const chosen = L.maybeHardware(spec.slideProductId);
  const slide = chosen ?? L.hardware('slide-generic-telescopic');
  if (!chosen) b.issue({ code: 'DRAWER_SLIDE_GENERIC', severity: 'warning', message: `Sin corredera elegida: cajas de cajón calculadas con «${slide.name}». Confirme la corredera real antes de cortar las cajas.` });
  b.hw({ category: 'drawer_slide', productId: slide.id, productKey: slide.productKey, description: slide.name, quantity: n, unit: slide.unit, basis: '1 juego por cajón', validationStatus: slide.validationStatus });
  const clearance = slide.params?.sideClearancePerSideMm;
  const lengths = slide.params?.nominalLengthsMm ?? [];
  if (clearance === undefined || lengths.length === 0) {
    b.issue({ code: 'DRAWER_SLIDE_PARAMS_MISSING', severity: 'blocker', message: `${slide.name}: faltan holgura lateral y/o largos nominales de la ficha técnica. Caja de cajón no calculada.` });
    return;
  }
  const maxLen = cd - ENGINE_DEFAULTS.drawerRearClearanceMm;
  const len = [...lengths].sort((a, c) => c - a).find((x) => x <= maxLen);
  if (len === undefined) throw new ModuleInputError('DRAWER_DEPTH_INSUFFICIENT', `Profundidad útil ${r2(maxLen)} mm menor que la corredera más corta (${Math.min(...lengths)} mm).`);
  const boxT = slide.params?.drawerBoxThicknessMm ?? 15;
  const boxMat = catalog.materials.find((m) => m.kind === 'board' && m.thicknessMm === boxT);
  if (!boxMat) throw new ModuleInputError('DRAWER_BOX_MATERIAL_MISSING', `No hay tablero de ${boxT} mm en catálogo para la caja de cajón.`);
  const bottomMat = catalog.materials.find((m) => m.kind === 'back_panel' && m.thicknessMm === ENGINE_DEFAULTS.drawerBottomThicknessMm) ?? null;
  const bt = bottomMat?.thicknessMm ?? ENGINE_DEFAULTS.drawerBottomThicknessMm;
  const bw = W - 2 * T - 2 * clearance;
  // Margen vertical entre frente y caja: deducción configurada o lo necesario para librar tapa, piso o travesaño.
  const margin = Math.max(ENGINE_DEFAULTS.drawerBoxHeightDeductionMm / 2, T - r + 2);
  const xs0 = T + clearance, xs1 = W - T - clearance;
  if (bw > 1000) b.issue({ code: 'DRAWER_TOO_WIDE', severity: 'warning', message: `Caja de cajón de ${r2(bw)} mm de ancho: puede flexionarse y trabarse. Considere dividir en dos módulos.` });
  const note = [`Calculada con ${slide.name}: holgura ${clearance} mm/lado, largo ${len} mm. Validar con ficha técnica.`];
  groups.forEach((g, gi) => {
    const bh = Math.min(g.h - 2 * margin, 250);
    if (bw < 100 || bh < 60) throw new ModuleInputError('DRAWER_BOX_TOO_SMALL', `Caja de cajón ${r2(bw)} × ${r2(bh)} mm demasiado pequeña.`);
    const sides: ReturnType<typeof box>[] = [], fbs: ReturnType<typeof box>[] = [], bottoms: ReturnType<typeof box>[] = [];
    for (const f of g.zones) {
      const z0 = r2(f.z0 + (g.h - bh) / 2);
      const z1 = z0 + bh;
      bottoms.push(box(xs0, xs1, y0, y0 + len, z0, z0 + bt));
      sides.push(box(xs0, xs0 + boxT, y0, y0 + len, z0 + bt, z1), box(xs1 - boxT, xs1, y0, y0 + len, z0 + bt, z1));
      fbs.push(box(xs0 + boxT, xs1 - boxT, y0, y0 + boxT, z0 + bt, z1), box(xs0 + boxT, xs1 - boxT, y0 + len - boxT, y0 + len, z0 + bt, z1));
    }
    const tag = groups.length > 1 ? ` (frente ${r2(g.h)} mm)` : '';
    b.part({ code: `DRAWER_SIDE${sfx(gi)}`, name: `Costado de caja de cajón${tag}`, role: 'drawer_box', lengthMm: len, widthMm: r2(bh - bt), thicknessMm: boxT, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: boxMat.id, placements: sides, notes: note, validationStatus: 'pending_validation' });
    b.part({ code: `DRAWER_FB${sfx(gi)}`, name: `Frente/trasera de caja de cajón${tag}`, role: 'drawer_box', lengthMm: bw - 2 * boxT, widthMm: r2(bh - bt), thicknessMm: boxT, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: boxMat.id, placements: fbs, notes: note, validationStatus: 'pending_validation' });
    b.part({ code: `DRAWER_BOTTOM${sfx(gi)}`, name: `Fondo de cajón sobrepuesto${tag}`, role: 'drawer_box', lengthMm: len, widthMm: bw, thicknessMm: bt, grainAxis: 'none', edges: [], materialId: bottomMat?.id ?? 'hdf6', placements: bottoms, notes: note, validationStatus: 'pending_validation' });
  });
  const side = b.parts.find((p) => p.code === 'SIDE')!;
  if (slide.machiningPatternId) b.machine(L.pattern(slide.machiningPatternId), side, n, 'Fijación de corredera', slide.id);
  b.issue({ code: 'DRAWER_BOX_PENDING_VALIDATION', severity: 'warning', message: 'Cajas de cajón calculadas con parámetros de corredera no verificados con ficha técnica.' });
}

function buildBase(ctx: Ctx, cd: number, y0: number, steel: SteelRequirement[]) {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, thicknessMm: T } = spec;
  const h = spec.baseHeightMm;
  if (spec.baseType === 'none' || h <= 0) {
    if (spec.baseType !== 'none') b.issue({ code: 'BASE_HEIGHT_ZERO', severity: 'warning', message: 'Base seleccionada con altura 0 mm: se ignora.' });
    return;
  }
  if (spec.mount === 'wall') b.issue({ code: 'BASE_ON_WALL_UNIT', severity: 'warning', message: 'Módulo a muro con base/patas: confirmar si se apoya en piso.' });
  if (spec.baseType === 'levelers') {
    const lev = L.hardware('leveler-100');
    const count = W <= 1000 ? 4 : 6;
    b.hw({ category: 'leveler', productId: lev.id, productKey: lev.productKey, description: lev.name, quantity: count, unit: lev.unit, basis: `${count} por ancho ${W} mm (orientativo)`, validationStatus: lev.validationStatus });
    b.issue({ code: 'PLINTH_NOT_INCLUDED', severity: 'info', message: 'Patas niveladoras: zoclo frontal con clips no incluido en el despiece.' });
  }
  if (spec.baseType === 'plinth') {
    const s = ENGINE_DEFAULTS.plinthSetbackMm;
    const fy0 = y0 + s;
    const by1 = y0 + cd;
    const crossLen = by1 - fy0 - 2 * T;
    if (crossLen < 50) throw new ModuleInputError('PLINTH_TOO_SHALLOW', 'Profundidad insuficiente para el bastidor de zoclo.');
    b.part({ code: 'PLINTH_RAIL', name: 'Zoclo frontal / trasero', role: 'plinth', lengthMm: W, widthMm: h, thicknessMm: T, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: material.id,
      placements: [box(0, W, fy0, fy0 + T, 0, h), box(0, W, by1 - T, by1, 0, h)], notes: [`Zoclo remetido ${s} mm.`] });
    b.part({ code: 'PLINTH_CROSS', name: 'Travesaño de zoclo', role: 'plinth', lengthMm: crossLen, widthMm: h, thicknessMm: T, grainAxis: 'length', edges: [], materialId: material.id,
      placements: [box(0, T, fy0 + T, by1 - T, 0, h), box(W - T, W, fy0 + T, by1 - T, 0, h)] });
  }
  if (spec.baseType === 'steel_frame') {
    const profile = L.steelProfile(spec.steel.profileId);
    const sec = parseFloat(profile.sectionSpec) || 25.4;
    steel.push({
      id: `${spec.id}-STEEL-BASE`, moduleId: spec.id, profileId: profile.id, shape: profile.shape, sectionSpec: profile.sectionSpec, finish: spec.steel.finish, loadValidationRequired: true,
      pieces: [
        { id: `${spec.id}-ST-LEG`, label: 'Pata', lengthMm: r2(h), count: 4 },
        { id: `${spec.id}-ST-RAIL-W`, label: 'Larguero frontal/trasero', lengthMm: r2(W - 2 * sec), count: 2 },
        { id: `${spec.id}-ST-RAIL-D`, label: 'Travesaño lateral', lengthMm: r2(cd - 2 * sec), count: 2 },
      ],
    });
    steelHeightCheck(ctx, h, 'caja', spec.heightMm, h + spec.heightMm);
    b.issue({ code: 'STEEL_LOAD_VALIDATION_REQUIRED', severity: 'blocker', message: `Bastidor de ${profile.name}: requiere validación de cargas, soldadura y anclaje por responsable estructural.` });
  }
}

function mountingHardware(ctx: Ctx) {
  const { spec, L, b, family } = ctx;
  const W = spec.widthMm;
  if (spec.mount === 'wall') {
    const hanger = L.hardware('cabinet-hanger');
    const n = W > 900 ? 4 : 2;
    b.hw({ category: 'wall_anchor', productId: hanger.id, productKey: hanger.productKey, description: hanger.name, quantity: n, unit: hanger.unit, basis: `${n} colgadores por ancho ${W} mm (orientativo)`, validationStatus: 'pending_validation' });
    b.issue({ code: 'WALL_MOUNT_VALIDATION', severity: 'blocker', message: 'Módulo colgado a muro: validar carga, tipo de muro, taquetes y colgadores con ficha técnica antes de liberar.' });
    return;
  }
  const tall = spec.heightMm + (spec.baseType === 'none' ? 0 : spec.baseHeightMm) >= ENGINE_DEFAULTS.tallUnitAntiTipMm;
  const drawerUnit = spec.front === 'drawers' && spec.heightMm >= ENGINE_DEFAULTS.drawerUnitAntiTipMm;
  if (tall || drawerUnit || family.geometryStrategy === 'wardrobe') {
    const a = L.hardware('wall-anchor-antitip');
    const n = W > 900 ? 2 : 1;
    b.hw({ category: 'wall_anchor', productId: a.id, productKey: a.productKey, description: a.name, quantity: n, unit: a.unit, basis: tall ? 'mueble alto' : 'mueble con cajones (riesgo de vuelco)', validationStatus: 'pending_validation' });
    b.issue({ code: 'ANTITIP_REQUIRED', severity: 'blocker', message: 'Riesgo de vuelco: instalar anclaje antivuelco a muro validado según tipo de muro.' });
  }
}

// ---------------------------------------------------------------------------
// Escritorio
// ---------------------------------------------------------------------------

function buildDesk(ctx: Ctx): Partial<ModuleResult> {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const all: EdgeName[] = spec.edgePolicy === 'none' ? [] : ['L1', 'L2', 'A1', 'A2'];
  if (spec.front !== 'open') b.issue({ code: 'DESK_FRONT_IGNORED', severity: 'info', message: 'Escritorio: frentes de puerta/cajón no se modelan en esta versión (use un módulo de cajonera aparte).' });
  b.part({ code: 'DESK_TOP', name: 'Cubierta de escritorio', role: 'desk', lengthMm: W, widthMm: D, thicknessMm: T, grainAxis: 'length', edges: all, materialId: material.id,
    placements: [box(0, W, 0, D, H - T, H)] });
  const steel: SteelRequirement[] = [];
  const legH = H - T;
  if (legH < ENGINE_DEFAULTS.deskMinKneeClearanceMm) b.issue({ code: 'DESK_KNEE_CLEARANCE', severity: 'warning', message: `Altura libre bajo cubierta ${r2(legH)} mm < ${ENGINE_DEFAULTS.deskMinKneeClearanceMm} mm recomendados.` });

  if (spec.steel.enabled) {
    const profile = L.steelProfile(spec.steel.profileId);
    const sec = parseFloat(profile.sectionSpec) || 25.4;
    steel.push({
      id: `${spec.id}-STEEL-DESK`, moduleId: spec.id, profileId: profile.id, shape: profile.shape, sectionSpec: profile.sectionSpec, finish: spec.steel.finish, loadValidationRequired: true,
      pieces: [
        { id: `${spec.id}-ST-LEG`, label: 'Pata', lengthMm: r2(legH), count: 4 },
        { id: `${spec.id}-ST-RAIL-W`, label: 'Larguero bajo cubierta', lengthMm: r2(W - 100 - 2 * sec), count: 2 },
        { id: `${spec.id}-ST-RAIL-D`, label: 'Travesaño lateral', lengthMm: r2(D - 100 - 2 * sec), count: 2 },
      ],
    });
    b.issue({ code: 'STEEL_LOAD_VALIDATION_REQUIRED', severity: 'blocker', message: `Bastidor de ${profile.name}: validar cargas, rigidez lateral, soldadura y nivelación con responsable estructural.` });
    const screw = L.hardware('screw-4x40');
    b.hw({ category: 'screw', productId: screw.id, productKey: screw.productKey, description: `${screw.name} — fijación cubierta a bastidor`, quantity: 8, unit: screw.unit, basis: '8 puntos orientativos', validationStatus: 'pending_validation' });
  } else {
    const sideEdges: EdgeName[] = spec.edgePolicy === 'none' ? [] : spec.edgePolicy === 'all_visible' ? ['L1', 'L2', 'A1'] : ['L1'];
    b.part({ code: 'DESK_SIDE', name: 'Costado tipo panel (pata)', role: 'desk', lengthMm: legH, widthMm: D, thicknessMm: T, grainAxis: 'length', edges: sideEdges, materialId: material.id,
      placements: [box(0, T, 0, D, 0, legH), box(W - T, W, 0, D, 0, legH)] });
    const mh = Math.min(ENGINE_DEFAULTS.deskMaxModestyMm, legH - 120);
    const span = W - 2 * T;
    if (span < ENGINE_DEFAULTS.deskMinLegroomWidthMm) b.issue({ code: 'DESK_LEGROOM_WIDTH', severity: 'warning', message: `Ancho libre entre costados ${r2(span)} mm < ${ENGINE_DEFAULTS.deskMinLegroomWidthMm} mm.` });
    let joints = 2;
    if (mh > 60) {
      b.part({ code: 'DESK_MODESTY', name: 'Faldón posterior', role: 'desk', lengthMm: span, widthMm: mh, thicknessMm: T, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: material.id,
        placements: [box(T, W - T, D - 20 - T, D - 20, legH - mh, legH)], notes: ['Remetido 20 mm del fondo; rigidiza los costados.'] });
      joints += 2;
    } else {
      b.issue({ code: 'DESK_NO_MODESTY', severity: 'warning', message: 'Sin faldón: rigidez lateral insuficiente; agregar larguero o escuadras.' });
    }
    joineryHardware(ctx, joints, D, [{ partId: `${spec.id}-DESK_SIDE`, joints }]);
  }
  const hasModesty = b.parts.some((p) => p.code === 'DESK_MODESTY');
  if (!spec.steel.enabled && !hasModesty) {
    sagCheck(ctx, 'Flecha de cubierta entre costados', W - 2 * T, D, `${spec.id}-DESK_TOP`);
  } else {
    ctx.structuralChecks.push({
      id: `${spec.id}-SAG-1`, moduleId: spec.id, category: 'flecha', label: 'Cubierta de escritorio',
      expected: 'apoyo continuo', actual: spec.steel.enabled ? 'apoyada en largueros de PTR (validar bastidor)' : 'apoyada en el faldón trasero; borde frontal sin apoyo: verificar con carga puntual', status: 'info', partId: `${spec.id}-DESK_TOP`,
    });
  }
  b.issue({ code: 'DESK_RIGIDITY_REVIEW', severity: 'info', message: 'Verificar rigidez y flecha de la cubierta para la carga prevista.' });
  // Con bastidor de PTR sólo la cubierta es tablero: la altura se verifica como pata + cubierta.
  ctx.expected = { x0: 0, x1: W, y0: 0, y1: D, z0: spec.steel.enabled ? H - T : 0, z1: H };
  if (spec.steel.enabled) steelHeightCheck(ctx, legH, 'cubierta', T, H);
  return { theoreticalDiagonalMm: r2(Math.hypot(W, H)), carcassDepthMm: D, overallHeightMm: H, steel };
}

// ---------------------------------------------------------------------------
// Validaciones geométricas
// ---------------------------------------------------------------------------

function checkSheetFit(ctx: Ctx) {
  const { L, b, spec } = ctx;
  const finish = L.finish(spec.finishId);
  for (const p of b.parts) {
    const m = L.material(p.materialId);
    if (!m.sheet) continue;
    const { lengthMm: SL, widthMm: SW } = m.sheet;
    const canRotate = p.grainAxis === 'none' || !finish.hasGrain;
    const fits = (p.cutLengthMm <= SL && p.cutWidthMm <= SW) || (canRotate && p.cutLengthMm <= SW && p.cutWidthMm <= SL);
    if (!fits) b.issue({ code: 'PART_EXCEEDS_SHEET', severity: 'error', partId: p.id, message: `${p.id} (corte ${p.cutLengthMm} × ${p.cutWidthMm} mm) no cabe en el tablero ${SL} × ${SW} mm${canRotate ? '' : ' respetando la veta'}. Dividir en módulos o usar formato mayor.` });
  }
}

function checkCollisions(b: ModuleBuilder) {
  const all = b.parts.flatMap((p) => p.placements.map((pl, i) => ({ id: `${p.id}#${i + 1}`, partId: p.id, pl })));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const v = overlapVolume(all[i]!.pl, all[j]!.pl);
      if (v > 0) b.issue({ code: 'COLLISION', severity: 'error', partId: all[i]!.partId, message: `Interferencia geométrica entre ${all[i]!.id} y ${all[j]!.id} (${r2(v / 1000)} cm³).` });
    }
  }
}
