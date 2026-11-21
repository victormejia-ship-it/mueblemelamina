import { catalogLookup, type Catalog } from '../catalog';
import { QC_CHECKLIST } from '../engine/quality';
import type { ManufacturingPlan } from '../plan';
import type { Project } from '../types';
import { EQUIPMENT, STATIONS, type EquipmentItem, type StationId } from './equipment';

export type NeedLevel = 'esencial' | 'recomendado' | 'opcional';

export interface RouteMetric { label: string; value: string }

export interface RouteStation {
  id: StationId;
  /** Número de paso en la ruta (sólo estaciones incluidas). */
  number: number;
  name: string;
  goal: string;
  input: string;
  output: string;
  equipmentIds: string[];
  metrics: RouteMetric[];
  /** 1–3 cifras clave en pocas palabras (para ver de un vistazo). */
  highlights: string[];
  /** Avisos que el operador debe ver en esa estación. */
  alerts: string[];
  /** Puede hacerse en paralelo con la carpintería. */
  parallel: boolean;
}

export interface EquipmentNeed {
  item: EquipmentItem;
  need: NeedLevel;
  /** Por qué se necesita en este proyecto. */
  reason: string;
  /** Ajustes con los valores de este proyecto. */
  projectSettings: string[];
}

export interface WorkshopRoute {
  stations: RouteStation[];
  equipment: EquipmentNeed[];
}

const fmt = (n: number, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d);

/** Ruta de taller del proyecto: estaciones en orden con sus cifras y el equipo necesario. Determinista. */
export function workshopRoute(project: Project, plan: ManufacturingPlan, catalog: Catalog): WorkshopRoute {
  const L = catalogLookup(catalog);
  const { calc } = plan;
  const hwQty = (pred: (c: string, key: string) => boolean) => calc.hardware.filter((h) => pred(h.category, h.productKey)).reduce((s, h) => s + h.quantity, 0);
  // Las operaciones se registran por modelo de pieza: se multiplican por la cantidad de piezas de ese modelo.
  const qtyOf = new Map(calc.parts.map((p) => [p.id, p.quantity]));
  const countOps = (list: typeof calc.machining) => list.reduce((s, o) => s + (qtyOf.get(o.partId) ?? 1), 0);
  const ops = (pattern: string) => countOps(calc.machining.filter((o) => o.patternId === pattern));
  const totalOps = countOps(calc.machining);
  const issues = (code: string) => calc.issues.filter((i) => i.code === code);

  const sheets = plan.nesting.map((n) => `${n.materialName}: ${n.sheetsRequired ?? `~${n.areaEstimate.sheetsEstimated} (sin confirmar)`}`);
  const thicknesses = [...new Set(calc.parts.map((p) => p.thicknessMm))].sort((a, b) => b - a);
  const bands = calc.edgeBands.map((e) => ({ eb: L.edgeBand(e.edgeBandId), e }));
  const pendingOps = countOps(calc.machining.filter((o) => o.validationStatus !== 'verified'));
  const cups = ops('hinge-cup-35');
  const cams = ops('cam-minifix');
  const pins = ops('shelf-pin-line-32');
  const slideOps = ops('slide-mount');
  const ledGrooves = ops('led-groove-router');
  const ledM = calc.ledRuns.reduce((t, r) => t + r.lengthMm, 0) / 1000;
  const ledDriver = calc.hardware.filter((h) => h.category === 'led_driver');
  const powerHoles = ops('power-outlet') + ops('power-grommet');
  const fx = calc.modules.flatMap((m) => m.fixtures ?? []);
  const nOutlets = fx.filter((f) => f.kind === 'outlet').length, nGrommets = fx.filter((f) => f.kind === 'grommet').length;
  const hasPower = fx.some((f) => f.kind === 'outlet' || f.kind === 'cable_exit' || f.kind === 'bulb');
  const hinges = calc.hardware.filter((h) => h.category === 'hinge');
  const hingeTotal = hinges.reduce((s, h) => s + h.quantity, 0);
  const halfHinges = hinges.filter((h) => h.productKey === 'hw:hinge_half_overlay_110').reduce((s, h) => s + h.quantity, 0);
  const slides = hwQty((c) => c === 'drawer_slide');
  const handles = hwQty((c) => c === 'handle');
  const anchors = hwQty((c) => c === 'wall_anchor');
  const levelers = hwQty((c) => c === 'leveler');
  const fronts = calc.parts.filter((p) => p.role === 'front').reduce((s, p) => s + p.quantity, 0);
  const hasSteel = plan.steel.length > 0;
  const smallForEdgebander = issues('PART_TOO_SMALL_FOR_EDGEBANDER').length;
  const checks = calc.modules.flatMap((m) => m.checks);
  const totalWeight = calc.modules.reduce((s, m) => s + m.weightKg, 0);
  const heavy = calc.modules.filter((m) => m.weightKg > 25);
  const wallModules = project.modules.filter((m) => m.mount === 'wall').length;
  const mf = project.manufacturing;

  const totalSheets = plan.nesting.reduce((s, n) => s + (n.sheetsRequired ?? n.areaEstimate.sheetsEstimated), 0);
  const edgeM = bands.reduce((s, b) => s + b.e.purchaseLengthMm, 0) / 1000;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const hl: Record<StationId, string[]> = {
    preparacion: [plural(project.modules.length, 'módulo', 'módulos'), plural(thicknesses.length, 'espesor', 'espesores')],
    corte: [plural(calc.totals.panelCount, 'pieza', 'piezas'), plural(totalSheets, 'tablero', 'tableros')],
    canteado: [`${fmt(edgeM, 1)} m de canto`, plural(bands.reduce((s, b) => s + b.e.segments, 0), 'arista', 'aristas')],
    mecanizado: [ledGrooves ? plural(ledGrooves, 'ranura LED', 'ranuras LED') : '', cups ? plural(cups, 'cazoleta', 'cazoletas') : '', cams ? plural(cams, 'excéntrico', 'excéntricos') : '', pins ? plural(pins, 'soporte', 'soportes') : ''].filter(Boolean).slice(0, 3),
    armado: [plural(project.modules.length, 'caja', 'cajas'), `diagonal ±${project.inspection.diagonalToleranceMm} mm`],
    herreria: plan.steel.map((s) => plural(s.layout.bars.length, 'barra', 'barras')).slice(0, 2),
    frentes: [hingeTotal ? plural(hingeTotal, 'bisagra', 'bisagras') : '', slides ? plural(slides, 'corredera', 'correderas') : '', handles ? plural(handles, 'jaladera', 'jaladeras') : ''].filter(Boolean),
    calidad: [`${checks.filter((c) => c.status === 'ok').length} ✓`, `${checks.filter((c) => c.status === 'warning').length + checks.filter((c) => c.status === 'error').length} por revisar`],
    empaque: [`${fmt(totalWeight, 0)} kg`, heavy.length ? `${heavy.length} pesados` : 'sin pesados'],
    instalacion: [anchors ? plural(anchors, 'anclaje', 'anclajes') : '', levelers ? plural(levelers, 'pata', 'patas') : ''].filter(Boolean),
  };
  const stationData: Record<StationId, { include: boolean; equipment: string[]; metrics: RouteMetric[]; alerts: string[]; parallel?: boolean }> = {
    preparacion: {
      include: true, equipment: ['flexometro', 'calibrador', 'epp'],
      metrics: [
        { label: 'Módulos', value: String(project.modules.length) },
        { label: 'Espesores a medir', value: thicknesses.map((t) => `${t} mm`).join(', ') || '—' },
        { label: 'Tableros', value: sheets.join(' · ') || '—' },
      ],
      alerts: calc.issues.some((i) => i.code === 'THICKNESS_MATERIAL_MISMATCH') ? ['Hay módulos con espesor distinto al nominal: confirmar con calibrador.'] : [],
    },
    corte: {
      include: calc.parts.length > 0, equipment: ['seccionadora', 'escuadra'],
      metrics: [
        { label: 'Piezas a cortar', value: `${calc.totals.panelCount} (${calc.totals.partModels} modelos)` },
        { label: 'Kerf / escuadrado', value: `${project.cut.kerfMm} mm / ${project.cut.trimMarginMm} mm por lado` },
        { label: 'Medida', value: mf.edgeCompensation ? 'Cortar a MEDIDA DE CORTE (ya descuenta canto)' : 'Corte = medida final (sin compensación)' },
      ],
      alerts: issues('PART_EXCEEDS_SHEET').map((i) => i.message),
    },
    canteado: {
      include: bands.length > 0, equipment: ['canteadora', 'refilador-manual'],
      metrics: [
        ...bands.map(({ eb, e }) => ({ label: eb.name, value: `${e.segments} aristas · ${fmt(e.netLengthMm / 1000)} m neto · ${fmt(e.purchaseLengthMm / 1000)} m compra` })),
        { label: 'Repasado de canteadora', value: `${mf.premillMm} mm por arista` },
      ],
      alerts: smallForEdgebander ? [`${smallForEdgebander} pieza(s) pequeñas para la canteadora: cantear a mano o cortar sobremedida.`] : [],
    },
    mecanizado: {
      include: calc.machining.length > 0, equipment: ['taladro-banco', ...(pins ? ['plantilla-system32'] : []), ...(ledGrooves ? ['router'] : []), ...(powerHoles ? ['sierra-copa'] : [])],
      metrics: [
        { label: 'Barrenos / operaciones', value: String(totalOps) },
        ...(cups ? [{ label: 'Cazoletas Ø35', value: String(cups) }] : []),
        ...(cams ? [{ label: 'Excéntricos', value: String(cams) }] : []),
        ...(pins ? [{ label: 'Soportes de entrepaño', value: String(pins) }] : []),
        ...(slideOps ? [{ label: 'Fijación de correderas', value: String(slideOps) }] : []),
        ...(ledGrooves ? [{ label: 'Ranuras LED (router)', value: `${ledGrooves} · ${fmt(ledM, 2)} m + canal de cable` }] : []),
        ...(powerHoles ? [{ label: 'Barrenos Ø60 (contactos / pasacables)', value: String(powerHoles) }] : []),
      ],
      alerts: pendingOps ? [`${pendingOps} operación(es) sin ficha técnica: NO perforar hasta capturar el patrón del herraje.`] : [],
    },
    armado: {
      include: calc.parts.length > 0, equipment: ['atornillador', 'prensas', 'medidor-diagonales', 'escuadra'],
      metrics: [
        { label: 'Cajas', value: String(project.modules.length) },
        { label: 'Conectores', value: `${hwQty((c) => c === 'cam_connector')} excéntricos · ${hwQty((c) => c === 'dowel')} taquetes` },
        ...calc.modules.filter((m) => m.theoreticalDiagonalMm).map((m) => ({ label: `Diagonal teórica ${m.moduleId}`, value: `${m.theoreticalDiagonalMm} mm` })),
      ],
      alerts: [],
    },
    herreria: {
      include: hasSteel, parallel: true, equipment: ['tronzadora', 'soldadora', 'pintura-metal'],
      metrics: plan.steel.map((s) => ({ label: s.profileName, value: `${s.layout.bars.length} barra(s) · ${s.layout.bars.reduce((n, b) => n + b.cuts.length, 0)} piezas · ${fmt(s.layout.totalCutLengthMm / 1000)} m` })),
      alerts: hasSteel ? ['Estructura con validación de cargas obligatoria antes de liberar.'] : [],
    },
    frentes: {
      include: fronts > 0 || hingeTotal + slides + handles > 0, equipment: ['plantillas-herrajes', 'atornillador'],
      metrics: [
        ...(hingeTotal ? [{ label: 'Bisagras', value: `${hingeTotal}${halfHinges ? ` (${halfHinges} de semi-solape)` : ''}` }] : []),
        ...(slides ? [{ label: 'Correderas', value: `${slides} juego(s)` }] : []),
        ...(handles ? [{ label: 'Jaladeras', value: String(handles) }] : []),
        { label: 'Holguras', value: [...new Set(project.modules.filter((m) => m.front !== 'open').map((m) => `${m.revealMm} mm perimetral / ${m.frontGapMm} mm entre frentes`))].join(' · ') || '—' },
      ],
      alerts: calc.hardware.some((h) => ['hinge', 'drawer_slide'].includes(h.category) && h.validationStatus !== 'verified') ? ['Bisagras/correderas genéricas: confirmar modelo y ficha antes de comprar.'] : [],
    },
    calidad: {
      include: true, equipment: ['lampara-inspeccion', 'escuadra', 'medidor-diagonales', 'calibrador'],
      metrics: [
        { label: 'Verificación dimensional', value: `${checks.filter((c) => c.status === 'ok').length} cumplen · ${checks.filter((c) => c.status === 'warning').length} revisar · ${checks.filter((c) => c.status === 'error').length} no cumplen` },
        { label: 'Checklist de inspección', value: `${QC_CHECKLIST.filter((c) => project.inspection.checklist[c.id]).length} de ${QC_CHECKLIST.length}` },
      ],
      alerts: calc.issues.filter((i) => i.severity === 'error').length ? [`${calc.issues.filter((i) => i.severity === 'error').length} error(es) bloqueantes en el proyecto.`] : [],
    },
    empaque: {
      include: true, equipment: ['empaque'],
      metrics: [
        { label: 'Peso total de tableros', value: `${fmt(totalWeight, 1)} kg` },
        ...calc.modules.map((m) => ({ label: `Peso ${m.moduleId}`, value: `${fmt(m.weightKg, 1)} kg${m.weightKg > 25 ? ' · 2 personas' : ''}` })),
      ],
      alerts: heavy.length ? [`${heavy.length} módulo(s) de más de 25 kg: maniobra entre dos personas.`] : [],
    },
    instalacion: {
      include: true, equipment: ['nivel', 'rotomartillo', 'atornillador'],
      metrics: [
        ...(anchors ? [{ label: 'Anclajes / colgadores', value: String(anchors) }] : []),
        ...(levelers ? [{ label: 'Patas niveladoras', value: String(levelers) }] : []),
        ...(wallModules ? [{ label: 'Módulos a muro', value: String(wallModules) }] : []),
        ...(ledDriver.length ? [{ label: 'Fuente LED', value: ledDriver.map((d) => `${d.quantity} × ${d.description}`).join(' · ') }] : []),
        ...(nOutlets + nGrommets ? [{ label: 'Conexión eléctrica', value: `${nOutlets} contacto(s) · ${nGrommets} pasacables` }] : []),
      ],
      alerts: [...(anchors ? ['Elegir taquete según el muro y validar la carga del anclaje.'] : []), ...(ledDriver.length ? ['Fuente LED: conexión a 127 V por electricista; dejarla ventilada y accesible.'] : []), ...(hasPower ? ['Conexión eléctrica: la hace un electricista, con tierra física.'] : [])],
    },
  };

  let num = 0;
  const stations: RouteStation[] = STATIONS.filter((s) => stationData[s.id].include).map((s) => {
    const d = stationData[s.id];
    return { ...s, number: ++num, equipmentIds: d.equipment, metrics: d.metrics, highlights: hl[s.id], alerts: d.alerts, parallel: !!d.parallel };
  });

  // Equipo necesario
  const need = (id: string, level: NeedLevel, reason: string, settings: string[] = []): EquipmentNeed => ({ item: EQUIPMENT.find((e) => e.id === id)!, need: level, reason, projectSettings: settings });
  const equipment: EquipmentNeed[] = [
    need('epp', 'esencial', 'Todas las estaciones'),
    need('flexometro', 'esencial', 'Medición de obra y piezas'),
    need('calibrador', 'esencial', 'Espesor real de tablero y canto', [`Espesores del proyecto: ${thicknesses.join(', ')} mm`]),
    need('escuadra', 'esencial', 'Escuadra de piezas y cajas'),
    need('seccionadora', 'esencial', `${calc.totals.panelCount} piezas en ${plan.nesting.reduce((s, n) => s + (n.sheetsRequired ?? 0), 0)} tablero(s)`, [
      `Kerf ${project.cut.kerfMm} mm · escuadrado ${project.cut.trimMarginMm} mm por lado`, ...sheets,
      mf.edgeCompensation ? 'Cortar a medida de corte (descuenta canto)' : 'Sin compensación de canto',
    ]),
    ...(bands.length ? [need('canteadora', 'esencial', `${bands.reduce((s, b) => s + b.e.segments, 0)} aristas canteadas`, bands.map(({ eb, e }) => `${eb.name}: ${fmt(e.purchaseLengthMm / 1000)} m de compra`).concat([`Repasado ${mf.premillMm} mm`])),
      need('refilador-manual', smallForEdgebander ? 'recomendado' : 'opcional', smallForEdgebander ? `${smallForEdgebander} pieza(s) pequeñas para máquina` : 'Reparaciones')] : []),
    ...(calc.machining.length ? [need('taladro-banco', 'esencial', `${totalOps} operaciones de perforación`, [...(cups ? [`${cups} cazoletas Ø35`] : []), ...(cams ? [`${cams} excéntricos`] : []), ...(pendingOps ? [`${pendingOps} pendientes de ficha: no perforar`] : [])])] : []),
    ...(pins ? [need('plantilla-system32', 'esencial', `${pins} barrenos para soportes de entrepaño`)] : []),
    ...(ledGrooves ? [need('router', 'esencial', `${plural(ledGrooves, 'ranura LED', 'ranuras LED')} (${fmt(ledM, 2)} m)`, [...new Set(calc.ledRuns.map((r) => `Ranura ${r.grooveWidthMm} × ${r.grooveDepthMm} mm · ${r.face}`))].concat(['Pasadas de máx. 3 mm de profundidad']))] : []),
    need('atornillador', 'esencial', 'Armado y herrajes'),
    need('prensas', 'esencial', 'Armado a escuadra'),
    need('medidor-diagonales', 'esencial', 'Escuadra de caja', calc.modules.filter((m) => m.theoreticalDiagonalMm).map((m) => `${m.moduleId}: ${m.theoreticalDiagonalMm} mm teórica`)),
    ...(hingeTotal + slides + handles ? [need('plantillas-herrajes', hingeTotal + slides ? 'esencial' : 'recomendado', [hingeTotal ? `${hingeTotal} bisagras` : '', slides ? `${slides} juegos de correderas` : '', handles ? `${handles} jaladeras` : ''].filter(Boolean).join(' · '),
      [...new Set(project.modules.filter((m) => m.front !== 'open').map((m) => `${m.id}: holgura ${m.revealMm} / ${m.frontGapMm} mm`))].concat(halfHinges ? [`${halfHinges} bisagras de semi-solape en hojas sobre divisor`] : []))] : []),
    ...(hasSteel ? [
      need('tronzadora', 'esencial', 'Corte de PTR', plan.steel.map((s) => `${s.profileName}: ${s.layout.bars.length} barra(s) de ${s.layout.barLengthMm / 1000} m`)),
      need('soldadora', 'esencial', 'Bastidor de PTR (validación estructural obligatoria)'),
      need('pintura-metal', 'esencial', 'Protección anticorrosiva del bastidor'),
    ] : []),
    need('lampara-inspeccion', 'recomendado', 'Inspección final de frentes y cantos'),
    need('empaque', 'esencial', `${fmt(totalWeight, 1)} kg de tableros`, heavy.map((m) => `${m.moduleId}: ${fmt(m.weightKg, 1)} kg (2 personas)`)),
    ...(powerHoles ? [need('sierra-copa', 'esencial', `${powerHoles} barreno(s) Ø60 para contactos y pasacables`)] : []),
    ...(hasPower ? [need('probador-electrico', 'esencial', 'Probar contactos y luces al conectar')] : []),
    need('nivel', 'esencial', 'Instalación a nivel y plomo'),
    need('rotomartillo', anchors ? 'esencial' : 'recomendado', anchors ? `${anchors} anclajes/colgadores a muro` : 'Fijaciones en obra'),
  ];
  return { stations, equipment };
}
