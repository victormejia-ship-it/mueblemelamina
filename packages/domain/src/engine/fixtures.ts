import type { CatalogLookup } from '../catalog';
import type { Box3, Fixture, LedRun, ModuleSpec, PanelPart } from '../types';
import { box, r2, type ModuleBuilder } from './helpers';
import { splitPlacement } from './led';

/** Convenciones de taller para patas, espejo y conexión eléctrica (ajustables). */
export const FIXTURE_DEFAULTS = {
  legSizeMm: 40,
  legInsetMm: 40,
  /** A partir de este ancho se agrega un par de patas al centro. */
  legMiddlePairFromMm: 1200,
  mirrorThicknessMm: 4,
  /** Separación de los focos Hollywood (centro a centro). */
  bulbPitchMm: 220,
  /** Diámetro de corte para contacto de mueble y pasacables (broca sierra copa). */
  holeDiameterMm: 60,
  /** Salida de cable por el respaldo. */
  cableExitDiameterMm: 35,
  /** Distancia del canto trasero al centro de los barrenos en la tapa. */
  holeFromBackMm: 70,
  /** Si la tapa queda más alta que esto, los contactos van en el costado (a la mano). */
  maxReachableTopMm: 1300,
  /** Altura del contacto en costado cuando la tapa no es alcanzable. */
  sideOutletHeightMm: 1100,
  /** Cable a la pared por cada conexión (m). */
  cableToWallM: 2,
};

const bbox = (bs: Box3[]): Box3 => bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }));

/**
 * Patas, espejo y conexión eléctrica de un módulo. Genera herrajes, perforaciones (sierra copa) y los accesorios
 * que se dibujan en el modelo y el render. Se ejecuta después de armar las piezas y el LED.
 */
export function applyFixtures(spec: ModuleSpec, L: CatalogLookup, b: ModuleBuilder, ledRuns: LedRun[]): Fixture[] {
  const fx: Fixture[] = [];
  const caja = b.parts.filter((p) => ['carcass', 'desk'].includes(p.role));
  if (!caja.length) return fx;
  const all = bbox(caja.flatMap((p) => p.placements));
  const D = FIXTURE_DEFAULTS;

  // --- Patas de madera
  if (spec.baseType === 'legs' && spec.baseHeightMm > 0) {
    const h = spec.baseHeightMm, s = D.legSizeMm, i = D.legInsetMm;
    const xs = [all.x0 + i, all.x1 - i - s, ...(spec.widthMm >= D.legMiddlePairFromMm ? [(all.x0 + all.x1 - s) / 2] : [])];
    const ys = [all.y0 + i, all.y1 - i - s];
    let k = 0;
    for (const x of xs) for (const y of ys) fx.push({ id: `${spec.id}-FX-LEG${++k}`, moduleId: spec.id, kind: 'leg', b: box(r2(x), r2(x + s), r2(y), r2(y + s), 0, h), label: 'Pata' });
    const leg = L.hardware('wood-leg');
    b.hw({ category: 'leg', productId: leg.id, productKey: leg.productKey, description: `${leg.name} (${h} mm)`, quantity: k, unit: leg.unit, basis: `${k} patas de ${h} mm`, validationStatus: leg.validationStatus });
    if (spec.mount === 'wall') b.issue({ code: 'LEGS_ON_WALL_UNIT', severity: 'warning', message: 'Módulo a muro con patas: confirme si se apoya en piso.' });
  }

  // --- Espejo
  const m = spec.mirror;
  if (m?.enabled && m.widthMm > 0 && m.heightMm > 0) {
    const cx = (all.x0 + all.x1) / 2;
    const z0 = all.z1 + m.gapMm;
    const wall = all.y1; // contra el muro, detrás de la cubierta
    // Con luz trasera el espejo se separa 25 mm del muro para que la luz salga por las orillas.
    const yb = m.light === 'backlit' ? wall - 25 : wall;
    const t = D.mirrorThicknessMm;
    const mb = box(r2(cx - m.widthMm / 2), r2(cx + m.widthMm / 2), r2(yb - t), yb, r2(z0), r2(z0 + m.heightMm));
    fx.push({ id: `${spec.id}-FX-MIRROR`, moduleId: spec.id, kind: 'mirror', b: mb, label: `Espejo ${m.widthMm} × ${m.heightMm}` });
    const glass = L.hardware('mirror-4mm'), fix = L.hardware('mirror-fix');
    b.hw({ category: 'mirror', productId: glass.id, productKey: glass.productKey, description: `${glass.name} ${m.widthMm} × ${m.heightMm} mm`, quantity: r2((m.widthMm * m.heightMm) / 1e6), unit: 'm²', basis: `${m.widthMm} × ${m.heightMm} mm`, validationStatus: glass.validationStatus });
    b.hw({ category: 'mirror', productId: fix.id, productKey: fix.productKey, description: fix.name, quantity: 1, unit: fix.unit, basis: '1 por espejo', validationStatus: fix.validationStatus });
    if (m.light === 'backlit') {
      const strip = L.hardware('led-strip-cob-12v');
      const per = 2 * (m.widthMm + m.heightMm) - 160;
      b.hw({ category: 'led_strip', productId: strip.id, productKey: strip.productKey, description: `${strip.name} (detrás del espejo)`, quantity: r2((per / 1000) * 1.05), unit: 'm', basis: 'Perímetro del espejo − 8 cm por lado, con separadores de 25 mm', validationStatus: strip.validationStatus });
      // Halo en el muro: un poco más grande que el espejo (es lo que se ve encendido).
      const g = 30;
      fx.push({ id: `${spec.id}-FX-GLOW`, moduleId: spec.id, kind: 'mirror_glow', b: box(r2(mb.x0 - g), r2(mb.x1 + g), r2(wall - 2), wall, r2(mb.z0 - g), r2(mb.z1 + g)), label: 'LED detrás del espejo' });
    }
    if (m.light === 'hollywood') {
      const bulb = L.hardware('bulb-g45');
      const sideN = Math.max(2, Math.floor(m.heightMm / D.bulbPitchMm));
      const topN = Math.max(2, Math.floor(m.widthMm / D.bulbPitchMm));
      const r = 22;
      let k = 0;
      const add = (x: number, z: number) => fx.push({ id: `${spec.id}-FX-BULB${++k}`, moduleId: spec.id, kind: 'bulb', b: box(r2(x - r), r2(x + r), r2(yb - t - 2 * r), r2(yb - t), r2(z - r), r2(z + r)), label: 'Foco' });
      for (let j = 0; j < sideN; j++) { const z = mb.z0 + ((j + 0.5) * m.heightMm) / sideN; add(mb.x0 + 35, z); add(mb.x1 - 35, z); }
      for (let j = 1; j < topN - 1; j++) add(mb.x0 + (j * m.widthMm) / (topN - 1), mb.z1 - 35);
      b.hw({ category: 'mirror', productId: bulb.id, productKey: bulb.productKey, description: bulb.name, quantity: k, unit: bulb.unit, basis: `${sideN} por lado + ${Math.max(0, topN - 2)} arriba`, validationStatus: bulb.validationStatus });
      const sw = L.hardware('power-switch');
      b.hw({ category: 'power', productId: sw.id, productKey: sw.productKey, description: sw.name, quantity: 1, unit: sw.unit, basis: 'Encendido de los focos', validationStatus: sw.validationStatus });
    }
  }

  // --- Conexión eléctrica: contactos, pasacables y salida de cable
  const p = spec.power ?? { outlets: 0, usb: false, grommets: 0 };
  const lights = ledRuns.length > 0 || (m?.enabled && m.light !== 'none');
  const holes = p.outlets + p.grommets;
  if (!holes && !lights) return fx;
  const status = 'pending_validation' as const;
  const dia = D.holeDiameterMm;
  if (holes) {
    // Tapa alcanzable: barrenos en la tapa, cerca del canto trasero. Si no, en el costado derecho a la mano.
    const tops = b.parts.filter((q) => ['HORIZONTAL', 'TOP_LED', 'DESK_TOP'].includes(q.code))
      .flatMap((q) => q.placements.map((pl) => ({ q, pl }))).sort((a, c) => c.pl.z1 - a.pl.z1);
    const top = tops[0];
    const onTop = !!top && top.pl.z1 + (spec.mount === 'wall' ? (spec.elevationMm ?? 0) : 0) <= D.maxReachableTopMm;
    let target: PanelPart | null = null, pl: Box3 | null = null;
    if (onTop && top) {
      pl = top.pl;
      target = splitPlacement(b, top.q, top.pl, 'TOP_POWER', 'Tapa con contactos / pasacables');
    } else {
      const side = b.parts.find((q) => q.code === 'SIDE' || q.code === 'DESK_SIDE');
      const right = side?.placements.slice().sort((a, c) => c.x0 - a.x0)[0];
      if (side && right) { pl = right; target = splitPlacement(b, side, right, 'SIDE_POWER', 'Costado con contactos'); }
    }
    if (target && pl) {
      const n = holes;
      for (let i = 0; i < n; i++) {
        const isOutlet = i < p.outlets;
        const kind = isOutlet ? 'outlet' : 'grommet';
        let fb: Box3, u: number, v: number;
        if (onTop) {
          const step = Math.min(160, (pl.x1 - pl.x0 - 2 * dia) / Math.max(1, n));
          const x = pl.x1 - 80 - i * step;
          const y = pl.y1 - D.holeFromBackMm;
          fb = box(r2(x - dia / 2), r2(x + dia / 2), r2(y - dia / 2), r2(y + dia / 2), pl.z1, r2(pl.z1 + 4));
          u = r2(x - pl.x0); v = r2(y - pl.y0);
        } else {
          const z = Math.min(pl.z1 - 100, D.sideOutletHeightMm - (spec.mount === 'wall' ? (spec.elevationMm ?? 0) : 0)) - i * 110;
          const y = pl.y1 - D.holeFromBackMm;
          fb = box(r2(pl.x0 - 4), pl.x0, r2(y - dia / 2), r2(y + dia / 2), r2(z - dia / 2), r2(z + dia / 2));
          u = r2(z - pl.z0); v = r2(y - pl.y0);
        }
        fx.push({ id: `${spec.id}-FX-${kind.toUpperCase()}${i + 1}`, moduleId: spec.id, kind, b: fb, label: isOutlet ? (p.usb && i === 0 ? 'Contacto USB' : 'Contacto') : 'Pasacables' });
        b.pushOp({
          partId: target.id, patternId: isOutlet ? 'power-outlet' : 'power-grommet', xMm: u, yMm: v, zMm: 0, diameterMm: dia, depthMm: target.thicknessMm,
          technicalDatasheetUrl: null, validationStatus: status,
          description: `${isOutlet ? 'Contacto de mueble' : 'Pasacables'}: barreno pasado Ø${dia} mm con sierra copa, a ${v} mm del canto frontal y ${u} mm del extremo. Confirmar Ø con el producto comprado.`,
        }, target);
      }
      if (p.outlets) {
        const o = L.hardware(p.usb ? 'power-outlet-usb' : 'power-outlet');
        if (p.usb) b.hw({ category: 'power', productId: o.id, productKey: o.productKey, description: o.name, quantity: 1, unit: o.unit, basis: 'Contacto con USB', validationStatus: o.validationStatus });
        const plain = p.usb ? p.outlets - 1 : p.outlets;
        if (plain > 0) { const q = L.hardware('power-outlet'); b.hw({ category: 'power', productId: q.id, productKey: q.productKey, description: q.name, quantity: plain, unit: q.unit, basis: 'Contactos del mueble', validationStatus: q.validationStatus }); }
      }
      if (p.grommets) { const g = L.hardware('grommet-60'); b.hw({ category: 'power', productId: g.id, productKey: g.productKey, description: g.name, quantity: p.grommets, unit: g.unit, basis: 'Paso de cables', validationStatus: g.validationStatus }); }
    }
  }
  // Salida del cable por el respaldo (contactos o luces)
  if (p.outlets || lights) {
    const back = b.parts.find((q) => q.code === 'BACK' || q.code.startsWith('BACK_'));
    const bp = back?.placements.slice().sort((a, c) => c.x1 - a.x1)[0];
    if (back && bp) {
      const x = bp.x1 - 100, z = bp.z0 + 80;
      fx.push({ id: `${spec.id}-FX-EXIT`, moduleId: spec.id, kind: 'cable_exit', b: box(r2(x - 17), r2(x + 17), bp.y1, r2(bp.y1 + 2), r2(z - 17), r2(z + 17)), label: 'Salida de cable' });
      b.pushOp({ partId: back.id, patternId: 'power-cable-exit', xMm: r2(z - bp.z0), yMm: r2(x - bp.x0), zMm: 0, diameterMm: D.cableExitDiameterMm, depthMm: back.thicknessMm, technicalDatasheetUrl: null, validationStatus: status,
        description: `Salida de cable: barreno pasado Ø${D.cableExitDiameterMm} mm en el respaldo, abajo a la derecha.` }, back);
    }
    const c = L.hardware('power-cable');
    b.hw({ category: 'power', productId: c.id, productKey: c.productKey, description: c.name, quantity: r2(D.cableToWallM + spec.heightMm / 1000), unit: 'm', basis: `${D.cableToWallM} m al contacto de pared + alto del mueble`, validationStatus: c.validationStatus });
    b.issue({ code: 'POWER_ELECTRICIAN', severity: 'warning', message: 'Conexión a 127 V: la hace un electricista, con contacto aterrizado y cable sin tensión dentro del mueble.' });
  }
  return fx;
}
