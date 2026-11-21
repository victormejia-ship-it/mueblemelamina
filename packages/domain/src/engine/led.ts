import type { CatalogLookup } from '../catalog';
import type { Box3, EdgeName, HardwareRequirement, LedRun, ModuleSpec, PanelPart } from '../types';
import { r2, type ModuleBuilder } from './helpers';

/** Parámetros de la ranura LED (convenciones de taller; ajustables). */
export const LED_DEFAULTS = {
  /** Distancia del canto frontal al eje de la ranura en horizontales (luz hacia la cubierta o el interior). */
  horizontalAxisFromFrontMm: 40,
  /** En entrepaños, un poco más al frente para iluminar el entrepaño de abajo. */
  shelfAxisFromFrontMm: 30,
  /** En costados (tira vertical), eje a esta distancia del canto frontal. */
  sideAxisFromFrontMm: 40,
  /** Se deja este margen en cada extremo de la ranura (tapas del perfil y cable). */
  endMarginMm: 15,
  /** Material mínimo que debe quedar debajo de la ranura. */
  minRemainingMm: 6,
  /** Canal para cable del extremo de la ranura al canto trasero. */
  cableChannelMm: 6,
  /** Margen de compra de tira y perfil. */
  stripWastePct: 5,
  profileWastePct: 10,
  /** Cable de cada módulo hasta la fuente (m). */
  cableToDriverM: 1.5,
  /** La fuente se elige con este margen sobre la potencia de las tiras. */
  driverHeadroom: 1.25,
};

const LED_LABEL: Record<Exclude<ModuleSpec['led']['placement'], 'none'>, string> = {
  under_cabinet: 'bajo el mueble',
  shelves: 'bajo cada entrepaño',
  sides: 'en los costados (vertical)',
  top_inside: 'bajo la tapa (interior)',
};

/** Separa una colocación de una pieza en su propio modelo de corte (p. ej. sólo el piso lleva ranura). */
export function splitPlacement(b: ModuleBuilder, part: PanelPart, placement: Box3, code: string, name: string): PanelPart {
  if (part.placements.length === 1) return part;
  part.placements = part.placements.filter((p) => p !== placement);
  part.quantity = part.placements.length;
  const twin = b.part({
    code, name, role: part.role, lengthMm: part.lengthMm, widthMm: part.widthMm, thicknessMm: part.thicknessMm, grainAxis: part.grainAxis,
    edges: Object.keys(part.edgeBand) as EdgeName[], materialId: part.materialId, placements: [placement], notes: [...part.notes], validationStatus: part.validationStatus,
  });
  // La pieza separada conserva las perforaciones del modelo original.
  for (const o of b.machining.filter((x) => x.partId === part.id)) {
    const { id: _id, ...rest } = o;
    void _id;
    b.pushOp({ ...rest, partId: twin.id }, twin);
  }
  return twin;
}

interface Target { part: PanelPart; placements: Box3[]; axis: 'x' | 'z'; face: string; zFace?: 'bottom'; axisFromFront: number }

/**
 * LED empotrado: decide en qué piezas va la ranura de router, genera las operaciones (ranura + canal de cable),
 * los tramos para dibujar/renderizar y los materiales (tira, perfil, sensor, cable). La fuente se calcula por proyecto.
 */
export function applyLed(spec: ModuleSpec, L: CatalogLookup, b: ModuleBuilder): LedRun[] {
  const led = spec.led;
  if (!led || led.placement === 'none') return [];
  const strip = L.maybeHardware(led.stripProductId) ?? L.hardware('led-strip-cob-12v');
  const profile = L.maybeHardware(led.profileProductId) ?? L.hardware('led-profile-embed-17');
  const gw = profile.params?.grooveWidthMm ?? 17, gd = profile.params?.grooveDepthMm ?? 8;

  const horizontals = b.parts.filter((p) => p.code === 'HORIZONTAL');
  const byZ = horizontals.flatMap((p) => p.placements.map((pl) => ({ p, pl }))).sort((x, y) => x.pl.z0 - y.pl.z0);
  const targets: Target[] = [];
  if (led.placement === 'under_cabinet' || led.placement === 'top_inside') {
    const pick = led.placement === 'under_cabinet' ? byZ[0] : byZ.at(-1);
    if (pick) {
      const part = splitPlacement(b, pick.p, pick.pl, led.placement === 'under_cabinet' ? 'BOTTOM_LED' : 'TOP_LED', led.placement === 'under_cabinet' ? 'Piso con ranura LED (cara de abajo)' : 'Tapa con ranura LED (cara interior)');
      targets.push({ part, placements: [pick.pl], axis: 'x', zFace: 'bottom', face: led.placement === 'under_cabinet' ? 'cara inferior (exterior, hacia la cubierta)' : 'cara inferior (interior)', axisFromFront: LED_DEFAULTS.horizontalAxisFromFrontMm });
    }
  } else if (led.placement === 'shelves') {
    const shelf = b.parts.find((p) => p.code === 'SHELF');
    if (shelf) {
      targets.push({ part: shelf, placements: shelf.placements, axis: 'x', zFace: 'bottom', face: 'cara inferior del entrepaño', axisFromFront: LED_DEFAULTS.shelfAxisFromFrontMm });
      b.issue({ code: 'LED_SHELF_FIXED', severity: 'warning', partId: shelf.id, message: 'Entrepaños con LED: dejarlos fijos (excéntrico o tornillo) o usar soportes con contacto eléctrico; el cable no permite moverlos libremente.' });
    }
  } else if (led.placement === 'sides') {
    const side = b.parts.find((p) => p.code === 'SIDE');
    if (side) targets.push({ part: side, placements: side.placements, axis: 'z', face: 'cara interior del costado', axisFromFront: LED_DEFAULTS.sideAxisFromFrontMm });
  }
  if (!targets.length) {
    b.issue({ code: 'LED_PLACEMENT_UNAVAILABLE', severity: 'warning', message: `No hay piezas para colocar LED ${LED_LABEL[led.placement]} en este módulo; elija otra ubicación.` });
    return [];
  }
  if (led.placement === 'under_cabinet' && spec.mount === 'floor') {
    b.issue({ code: 'LED_UNDER_FLOOR_UNIT', severity: 'warning', message: 'LED bajo el piso de un mueble de piso: sólo ilumina el zoclo o el piso. Para iluminar la cubierta, colóquelo en los aéreos.' });
  }

  const runs: LedRun[] = [];
  let totalMm = 0;
  for (const t of targets) {
    const runLen = r2((t.axis === 'x' ? t.part.lengthMm : t.part.lengthMm) - 2 * LED_DEFAULTS.endMarginMm);
    if (gd > t.part.thicknessMm - LED_DEFAULTS.minRemainingMm) {
      b.issue({ code: 'LED_GROOVE_TOO_DEEP', severity: 'error', partId: t.part.id, message: `${t.part.id}: ranura LED de ${gd} mm deja menos de ${LED_DEFAULTS.minRemainingMm} mm en tablero de ${t.part.thicknessMm} mm. Use un perfil más delgado o de sobreponer.` });
    }
    if (t.axisFromFront + gw / 2 > t.part.widthMm - 20) {
      b.issue({ code: 'LED_GROOVE_OUTSIDE', severity: 'error', partId: t.part.id, message: `${t.part.id}: la ranura LED no cabe en el ancho de la pieza (${t.part.widthMm} mm).` });
    }
    const status = profile.validationStatus === 'verified' ? 'verified' : 'pending_validation';
    b.pushOp({
      partId: t.part.id, patternId: 'led-groove-router', hardwareProductId: profile.id,
      xMm: LED_DEFAULTS.endMarginMm, yMm: t.axisFromFront, zMm: 0, diameterMm: null, depthMm: gd,
      technicalDatasheetUrl: profile.technicalDatasheetUrl, validationStatus: status,
      groove: { lengthMm: runLen, widthMm: gw },
      description: `Ranura LED con router ${gw} × ${gd} mm, ${t.face}: eje a ${t.axisFromFront} mm del canto frontal, de ${LED_DEFAULTS.endMarginMm} a ${r2(t.part.lengthMm - LED_DEFAULTS.endMarginMm)} mm (largo ${runLen} mm). Confirmar medida con el perfil comprado.`,
    }, t.part);
    const toBack = r2(t.part.widthMm - t.axisFromFront - gw / 2);
    b.pushOp({
      partId: t.part.id, patternId: 'led-cable-channel', hardwareProductId: strip.id,
      xMm: LED_DEFAULTS.endMarginMm, yMm: r2(t.axisFromFront + gw / 2), zMm: 0, diameterMm: null, depthMm: LED_DEFAULTS.cableChannelMm,
      technicalDatasheetUrl: null, validationStatus: status,
      groove: { lengthMm: toBack, widthMm: LED_DEFAULTS.cableChannelMm },
      description: `Canal para cable ${LED_DEFAULTS.cableChannelMm} × ${LED_DEFAULTS.cableChannelMm} mm del extremo de la ranura al canto trasero (${toBack} mm), misma cara; salida por barreno Ø10 mm en el respaldo.`,
    }, t.part);
    t.placements.forEach((pl, i) => {
      const yAxis = pl.y0 + t.axisFromFront;
      let a: [number, number, number], c: [number, number, number], dir: [number, number, number];
      if (t.axis === 'x') {
        const z = pl.z0;
        a = [pl.x0 + LED_DEFAULTS.endMarginMm, yAxis, z]; c = [pl.x1 - LED_DEFAULTS.endMarginMm, yAxis, z]; dir = [0, 0, -1];
      } else {
        const inner = pl.x0 < spec.widthMm / 2 ? pl.x1 : pl.x0;
        a = [inner, yAxis, pl.z0 + LED_DEFAULTS.endMarginMm]; c = [inner, yAxis, pl.z1 - LED_DEFAULTS.endMarginMm]; dir = [pl.x0 < spec.widthMm / 2 ? 1 : -1, 0, 0];
      }
      runs.push({ id: `${t.part.id}-LED${i + 1}`, moduleId: spec.id, partId: t.part.id, a: a.map(r2) as [number, number, number], b: c.map(r2) as [number, number, number], lengthMm: runLen, grooveWidthMm: gw, grooveDepthMm: gd, face: t.face, lightDir: dir });
      totalMm += runLen;
    });
  }

  const m = totalMm / 1000;
  const watts = m * (strip.params?.ledWattsPerM ?? 10);
  b.hw({ category: 'led_strip', productId: strip.id, productKey: strip.productKey, description: strip.name, quantity: r2(m * (1 + LED_DEFAULTS.stripWastePct / 100)), unit: 'm', basis: `${runs.length} tramo(s), ${r2(m)} m + ${LED_DEFAULTS.stripWastePct} % (${r2(watts)} W)`, validationStatus: strip.validationStatus });
  b.hw({ category: 'led_profile', productId: profile.id, productKey: profile.productKey, description: profile.name, quantity: r2(m * (1 + LED_DEFAULTS.profileWastePct / 100)), unit: 'm', basis: `${r2(m)} m de ranura + ${LED_DEFAULTS.profileWastePct} % de corte`, validationStatus: profile.validationStatus });
  if (led.sensor !== 'none') {
    const sensor = L.hardware(`led-sensor-${led.sensor}`);
    b.hw({ category: 'led_sensor', productId: sensor.id, productKey: sensor.productKey, description: sensor.name, quantity: 1, unit: sensor.unit, basis: '1 por módulo', validationStatus: sensor.validationStatus });
  }
  const cable = L.hardware('led-cable-2x20');
  b.hw({ category: 'led_cable', productId: cable.id, productKey: cable.productKey, description: cable.name, quantity: r2(runs.length * 0.6 + LED_DEFAULTS.cableToDriverM), unit: 'm', basis: `${runs.length} × 0.6 m por tramo + ${LED_DEFAULTS.cableToDriverM} m a la fuente`, validationStatus: cable.validationStatus });
  return runs;
}

/** Fuente(s) LED para todo el proyecto, según la potencia total de las tiras (con margen). */
export function ledDrivers(hardware: HardwareRequirement[], L: CatalogLookup): HardwareRequirement[] {
  let watts = 0;
  for (const h of hardware.filter((x) => x.category === 'led_strip')) watts += h.quantity * (L.maybeHardware(h.productId)?.params?.ledWattsPerM ?? 10);
  if (watts <= 0) return [];
  const need = watts * LED_DEFAULTS.driverHeadroom;
  const sizes = [30, 60, 100, 150, 200];
  const big = 200;
  const count = need > big ? Math.ceil(need / big) : 1;
  const size = need > big ? big : sizes.find((s) => s >= need)!;
  const d = L.hardware(`led-driver-12v-${size}`);
  return [{
    id: 'PROYECTO-HW-LED', moduleId: 'PROYECTO', category: 'led_driver', productId: d.id, productKey: d.productKey, description: d.name, quantity: count, unit: d.unit,
    basis: `${r2(watts)} W de tira × ${LED_DEFAULTS.driverHeadroom} = ${r2(need)} W → ${count} × ${size} W. Ubicar ventilada y accesible (sobre aéreos o detrás del zoclo).`,
    validationStatus: d.validationStatus,
  }];
}
