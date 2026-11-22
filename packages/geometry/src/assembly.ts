import { DEFAULT_CATALOG, localizeIds, type Catalog, type CodeLang, type HardwareRequirement, type PanelPart, type Project, type ProjectCalculation } from '@ms/domain';
import { buildScene, sceneToSvg } from './index';

/** Un paso del instructivo ilustrado: dibujo + título corto + herrajes del paso. */
export interface AssemblyStep {
  moduleId: string;
  number: number;
  title: string;
  /** Una línea, sólo si aporta (p. ej. medir diagonales). */
  tip: string | null;
  /** Herrajes que se usan en este paso (p. ej. «8 excéntricos»). */
  hardware: string[];
  /** Piezas que se colocan en este paso (códigos visibles). */
  pieces: string[];
  svg: string;
}

type Shift = [number, number, number];
const D = 300; // desplazamiento de la pieza que entra (mm)
/** Nombres cortos del herraje de frentes abatibles. */
const FOLD_HW: Record<string, string> = {
  'hw:fold_hinge': 'bisagras', 'hw:lid_stay': 'compases', 'hw:fold_bracket': 'pares de escuadras',
  'hw:bed_mechanism': 'mecanismo de pistones', 'hw:bed_leg': 'patas abatibles', 'hw:mattress_strap': 'correas',
};

const qty = (hw: HardwareRequirement[], cats: string[], label: (n: number) => string) => {
  const n = Math.round(hw.filter((h) => cats.includes(h.category)).reduce((s, h) => s + h.quantity, 0));
  return n > 0 ? [label(n)] : [];
};
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Instructivo de armado con ilustraciones: en cada paso se ve lo que ya está armado y, en naranja, las piezas que
 * se colocan, separadas con una flecha hacia su lugar. Mismo encuadre en todos los pasos de un módulo.
 */
export function assemblyGuide(project: Project, calc: ProjectCalculation, catalog: Catalog = DEFAULT_CATALOG, lang: CodeLang = 'es', size = { width: 520, height: 400 }): AssemblyStep[] {
  const out: AssemblyStep[] = [];
  for (const m of calc.modules) {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    if (!spec || !m.parts.length) continue;
    const hw = calc.hardware.filter((h) => h.moduleId === m.moduleId);
    const keysOf = (p: PanelPart) => p.placements.map((_, i) => `${p.id}#${i + 1}`);
    const byCode = (pred: (code: string) => boolean) => m.parts.filter((p) => pred(p.code));
    const steelIds = m.steel.map((s) => s.id);
    const fxKeys = (kinds: string[]) => (m.fixtures ?? []).filter((f) => kinds.includes(f.kind)).map((f) => f.id);
    /** Contactos, pasacables y espejo: comunes a todos los muebles. */
    const extrasSteps = () => {
      const power = fxKeys(['outlet', 'grommet']);
      const nOut = fxKeys(['outlet']).length, nGrom = fxKeys(['grommet']).length;
      step('Coloca contactos y pasacables', power, Object.fromEntries(power.map((k) => [k, [0, 0, D * 0.7] as Shift])), {
        hardware: [...(nOut ? [pl(nOut, 'contacto', 'contactos')] : []), ...(nGrom ? [pl(nGrom, 'pasacables', 'pasacables')] : [])],
        tip: 'Conexión a 127 V por electricista, con tierra física.',
      });
      const mirror = fxKeys(['mirror', 'bulb']);
      const mspec = spec.mirror;
      step(mspec.light === 'hollywood' ? 'Cuelga el espejo y los focos' : 'Cuelga el espejo', mirror, Object.fromEntries(mirror.map((k) => [k, [0, -D, 0] as Shift])), {
        hardware: [`Espejo ${mspec.widthMm} × ${mspec.heightMm}`, ...(mspec.light === 'hollywood' ? [pl(fxKeys(['bulb']).length, 'foco', 'focos')] : []), ...(mspec.light === 'backlit' ? ['LED detrás'] : [])],
        tip: mspec.light !== 'none' ? 'Las luces se conectan antes de fijar el espejo.' : 'Nivela antes de fijar las grapas.',
      });
    };
    const shown: string[] = [];
    let n = 0;
    const step = (title: string, add: string[], shift: Record<string, Shift>, opts: { tip?: string; hardware?: string[]; pieces?: PanelPart[] } = {}) => {
      if (!add.length) return;
      const scene = buildScene(project, calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, minimal: true, width: size.width, height: size.height, lang, assembly: { show: [...shown], add, shift } });
      out.push({
        moduleId: m.moduleId, number: ++n, title, tip: opts.tip ?? null, hardware: opts.hardware ?? [],
        pieces: [...new Set((opts.pieces ?? []).map((p) => localizeIds(p.code, lang).replace(/_\d+$/, '')))],
        svg: sceneToSvg(scene, 'light'),
      });
      shown.push(...add);
    };

    if (m.parts.some((p) => p.code.startsWith('DESK_'))) {
      // Escritorio
      if (steelIds.length) step('Arma el bastidor de PTR', steelIds, Object.fromEntries(steelIds.map((id) => [id, [0, 0, -D] as Shift])), { tip: 'Soldar a escuadra; validar cargas.' });
      const sides = byCode((c) => c === 'DESK_SIDE');
      step('Coloca los costados', sides.flatMap(keysOf), Object.fromEntries(sides.flatMap(keysOf).map((k, i) => [k, [i === 0 ? -D : D, 0, 0] as Shift])), { pieces: sides, hardware: qty(hw, ['cam_connector', 'dowel'], (q) => pl(q, 'unión', 'uniones')) });
      const mod = byCode((c) => c === 'DESK_MODESTY');
      step('Coloca el faldón', mod.flatMap(keysOf), Object.fromEntries(mod.flatMap(keysOf).map((k) => [k, [0, D, 0] as Shift])), { pieces: mod, tip: 'Da rigidez: no lo omitas.' });
      const top = byCode((c) => c === 'DESK_TOP');
      step('Coloca la cubierta', top.flatMap(keysOf), Object.fromEntries(top.flatMap(keysOf).map((k) => [k, [0, 0, D] as Shift])), { pieces: top, hardware: qty(hw, ['screw'], (q) => pl(q, 'tornillo', 'tornillos')) });
      extrasSteps();
      continue;
    }

    // Caja: piso, costados, tapa…
    const horiz = m.parts.filter((p) => ['HORIZONTAL', 'BOTTOM_LED', 'TOP_LED', 'TOP_POWER'].includes(p.code)).flatMap((p) => p.placements.map((b, i) => ({ key: `${p.id}#${i + 1}`, z: b.z0, p })));
    horiz.sort((a, b) => a.z - b.z);
    const bottom = horiz[0], top = horiz.length > 1 ? horiz[horiz.length - 1] : undefined;
    const sides = byCode((c) => c === 'SIDE' || c === 'SIDE_POWER');
    const sideKeys = sides.flatMap(keysOf);
    if (bottom) shown.push(bottom.key);
    step('Une los costados al piso', sideKeys, Object.fromEntries(sides.flatMap((p) => p.placements.map((b, i) => [`${p.id}#${i + 1}`, [b.x0 < spec.widthMm / 2 ? -D : D, 0, 0] as Shift]))), {
      pieces: [...sides, ...(bottom ? [bottom.p] : [])], hardware: qty(hw, ['cam_connector'], (q) => pl(q, 'excéntrico', 'excéntricos')).concat(qty(hw, ['dowel'], (q) => pl(q, 'taquete', 'taquetes'))),
      tip: 'Siempre con el canto frontal hacia ti.',
    });
    if (top) step('Coloca la tapa', [top.key], { [top.key]: [0, 0, D] }, { pieces: [top.p] });
    const div = byCode((c) => c === 'DIVIDER');
    step('Mete los divisores', div.flatMap(keysOf), Object.fromEntries(div.flatMap(keysOf).map((k) => [k, [0, -D, 0] as Shift])), { pieces: div });
    const rail = byCode((c) => c === 'DRAWER_RAIL');
    step('Fija el travesaño', rail.flatMap(keysOf), Object.fromEntries(rail.flatMap(keysOf).map((k) => [k, [0, -D, 0] as Shift])), { pieces: rail });
    const backs = byCode((c) => c === 'BACK' || c.startsWith('BACK_'));
    step('Escuadra y fija el respaldo', backs.flatMap(keysOf), Object.fromEntries(backs.flatMap(keysOf).map((k) => [k, [0, D, 0] as Shift])), {
      pieces: backs, hardware: qty(hw, ['screw'], (q) => pl(q, 'tornillo', 'tornillos')),
      tip: m.theoreticalDiagonalMm ? `Antes de fijar: las dos diagonales deben medir ${Math.round(m.theoreticalDiagonalMm)} mm.` : undefined,
    });
    const base = byCode((c) => c.startsWith('PLINTH'));
    const baseKeys = [...base.flatMap(keysOf), ...steelIds];
    step(steelIds.length ? 'Monta el bastidor' : 'Arma y fija el zoclo', baseKeys, Object.fromEntries(baseKeys.map((k) => [k, [0, 0, -D * 0.8] as Shift])), {
      pieces: base, hardware: qty(hw, ['plinth_clip'], (q) => pl(q, 'clip', 'clips')),
    });
    const legKeys = fxKeys(['leg']);
    step('Atornilla las patas', legKeys, Object.fromEntries(legKeys.map((k) => [k, [0, 0, -D * 0.8] as Shift])), {
      hardware: qty(hw, ['leg'], (q) => pl(q, 'pata', 'patas')), tip: 'Con el mueble boca abajo sobre una manta.',
    });
    const shelves = byCode((c) => c === 'SHELF');
    step('Coloca los entrepaños', shelves.flatMap(keysOf), Object.fromEntries(shelves.flatMap(keysOf).map((k) => [k, [0, -D * 1.2, 0] as Shift])), {
      pieces: shelves, hardware: qty(hw, ['shelf_pin'], (q) => pl(q, 'soporte', 'soportes')).concat(qty(hw, ['hanging_rail'], (q) => `${q} m de tubo`)),
    });
    const boxes = byCode((c) => /^DRAWER_(SIDE|FB|BOTTOM)/.test(c));
    step('Arma y mete los cajones', boxes.flatMap(keysOf), Object.fromEntries(boxes.flatMap(keysOf).map((k) => [k, [0, -D * 1.4, 0] as Shift])), {
      pieces: boxes, hardware: qty(hw, ['drawer_slide'], (q) => pl(q, 'juego de correderas', 'juegos de correderas')),
    });
    const fold = byCode((c) => c === 'FOLD_LEAF');
    step(spec.foldKind === 'bed' ? 'Monta el mecanismo y la base de cama' : 'Coloca el frente abatible', fold.flatMap(keysOf), Object.fromEntries(fold.flatMap(keysOf).map((k) => [k, [0, -D, 0] as Shift])), {
      pieces: fold, hardware: hw.filter((h) => FOLD_HW[h.productKey]).map((h) => `${Math.round(h.quantity)} ${FOLD_HW[h.productKey]}`),
      tip: spec.foldKind === 'bed' ? 'Entre dos personas; regula los pistones con la base cerrada.' : 'Ajusta los compases para que baje suave y quede horizontal.',
    });
    const fronts = byCode((c) => c.startsWith('DOOR') || c.startsWith('DRAWER_FRONT'));
    step(fronts.some((p) => p.code.startsWith('DOOR')) ? (fronts.some((p) => p.code.startsWith('DRAWER_FRONT')) ? 'Coloca puertas y frentes' : 'Coloca las puertas') : 'Coloca los frentes de cajón', fronts.flatMap(keysOf), Object.fromEntries(fronts.flatMap(keysOf).map((k) => [k, [0, -D, 0] as Shift])), {
      pieces: fronts, hardware: qty(hw, ['hinge'], (q) => pl(q, 'bisagra', 'bisagras')).concat(qty(hw, ['handle'], (q) => pl(q, 'jaladera', 'jaladeras'))),
      tip: fronts.length ? `Regula para dejar ${spec.frontGapMm} mm entre frentes.` : undefined,
    });
    extrasSteps();
    // Instalación final (sin piezas nuevas): nivelar, anclar y LED
    const install = [
      ...qty(hw, ['leveler'], (q) => pl(q, 'pata niveladora', 'patas niveladoras')),
      ...qty(hw, ['wall_anchor'], (q) => pl(q, 'anclaje', 'anclajes')),
      ...qty(hw, ['led_strip'], (q) => `${q} m de LED`),
    ];
    const scene = buildScene(project, calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, minimal: true, width: size.width, height: size.height, lang, assembly: { show: [...shown], add: [] } });
    out.push({ moduleId: m.moduleId, number: ++n, title: spec.mount === 'wall' ? 'Cuelga, nivela y ancla' : 'Nivela y ancla', tip: spec.mount === 'wall' ? 'Taquete según el muro; valida la carga.' : null, hardware: install, pieces: [], svg: sceneToSvg(scene, 'light') });
  }
  return out;
}
