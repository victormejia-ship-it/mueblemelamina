import type { ProjectCalculation } from '../types';
import { EQUIPMENT, type StationId } from './equipment';

/**
 * Qué mostrar en el modelo 3D para un equipo: piezas a resaltar, cantos, diagonales,
 * herrería y etiquetas por pieza. Sólo usa datos del cálculo: no inventa coordenadas de barrenos.
 */
export interface ModelFocus {
  partIds: string[];
  /** Dibujar las aristas con tapacanto de las piezas resaltadas. */
  edges: boolean;
  /** Dibujar las diagonales de la cara frontal de cada caja. */
  diagonals: boolean;
  /** Resaltar el bastidor de PTR. */
  steel: boolean;
  /** Etiqueta corta por pieza (p. ej. «2 cazoletas»). */
  labels: Record<string, string>;
  /** Una línea que explica lo resaltado. */
  note: string;
  /** No hay nada que mostrar en este proyecto para el equipo. */
  empty: boolean;
}

const ROLES = {
  carcass: ['carcass', 'divider', 'back', 'desk'],
  fronts: ['front', 'drawer_box'],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function equipmentFocus(equipmentId: string, calc: ProjectCalculation): ModelFocus {
  const parts = calc.parts;
  const ids = (pred: (p: (typeof parts)[number]) => boolean) => parts.filter(pred).map((p) => p.id);
  const base: ModelFocus = { partIds: [], edges: false, diagonals: false, steel: false, labels: {}, note: '', empty: false };
  const opsBy = (pattern: string) => {
    const m = new Map<string, number>();
    for (const o of calc.machining.filter((x) => x.patternId === pattern)) m.set(o.partId, (m.get(o.partId) ?? 0) + 1);
    return m;
  };
  const machiningFocus = (patterns: { id: string; one: string; many: string }[], note: string): ModelFocus => {
    const labels: Record<string, string> = {};
    for (const pt of patterns) {
      for (const [pid, n] of opsBy(pt.id)) labels[pid] = [labels[pid], `${plural(n, pt.one, pt.many)} por pieza`].filter(Boolean).join(' · ');
    }
    const partIds = Object.keys(labels);
    return { ...base, partIds, labels, note, empty: partIds.length === 0 };
  };

  switch (equipmentId) {
    case 'seccionadora': case 'escuadra': case 'calibrador': case 'flexometro':
      return { ...base, partIds: parts.map((p) => p.id), note: `${plural(calc.totals.panelCount, 'pieza', 'piezas')} a cortar y medir (cada color es una pieza del despiece).` };
    case 'canteadora': case 'refilador-manual': {
      const banded = ids((p) => Object.keys(p.edgeBand).length > 0);
      const m = calc.edgeBands.reduce((s, e) => s + e.segments, 0);
      return { ...base, partIds: banded, edges: true, note: `Líneas naranjas = aristas con canto (${plural(m, 'arista', 'aristas')}).`, empty: banded.length === 0 };
    }
    case 'taladro-banco':
      return machiningFocus(
        [{ id: 'hinge-cup-35', one: 'cazoleta', many: 'cazoletas' }, { id: 'cam-minifix', one: 'excéntrico', many: 'excéntricos' }, { id: 'slide-mount', one: 'fijación de corredera', many: 'fijaciones de corredera' }],
        'Piezas que se perforan y cuántos barrenos lleva cada una. La posición exacta sale de la ficha del herraje.',
      );
    case 'plantilla-system32':
      return machiningFocus([{ id: 'shelf-pin-line-32', one: 'barreno de soporte', many: 'barrenos de soporte' }], 'Costados con línea de barrenos para soportes de entrepaño.');
    case 'prensas': case 'atornillador':
      return { ...base, partIds: ids((p) => ROLES.carcass.includes(p.role)), note: 'Caja: costados, tapa, piso, divisores y respaldo que se unen a escuadra.' };
    case 'medidor-diagonales':
      return { ...base, partIds: ids((p) => p.role === 'carcass'), diagonals: true, note: 'Las dos diagonales del frente de la caja deben medir lo mismo (dentro de la tolerancia).' };
    case 'plantillas-herrajes': case 'lampara-inspeccion': {
      const f = ids((p) => ROLES.fronts.includes(p.role));
      return { ...base, partIds: f, note: equipmentId === 'lampara-inspeccion' ? 'Caras y cantos visibles que se inspeccionan con luz rasante.' : 'Puertas, frentes y cajones donde van bisagras, correderas y jaladeras.', empty: f.length === 0 };
    }
    case 'tronzadora': case 'soldadora': case 'pintura-metal': {
      const has = calc.steel.length > 0;
      return { ...base, steel: has, partIds: has ? calc.steel.map((s) => s.id) : [], note: 'Bastidor de PTR (esquemático).', empty: !has };
    }
    case 'nivel': {
      const b = ids((p) => p.role === 'plinth');
      return { ...base, partIds: b.length ? b : ids((p) => p.code === 'HORIZONTAL' || p.code === 'DESK_SIDE'), note: b.length ? 'Zoclo que se nivela en obra.' : 'Base de la caja: nivelar patas o apoyo.' };
    }
    case 'rotomartillo': {
      const backs = ids((p) => p.role === 'back');
      return { ...base, partIds: backs, note: 'Cara que va contra el muro, donde se colocan anclajes o colgadores.', empty: backs.length === 0 };
    }
    case 'empaque':
      return { ...base, partIds: parts.map((p) => p.id), note: 'Módulo completo: proteger esquinas y frentes.' };
    default:
      return { ...base, empty: true, note: 'Este equipo no se ubica en una pieza específica.' };
  }
}

/** Enfoque de una estación de la ruta: unión del enfoque de su equipo. */
export function stationFocus(stationId: StationId, equipmentIds: string[], calc: ProjectCalculation): ModelFocus {
  const focuses = equipmentIds.map((id) => equipmentFocus(id, calc)).filter((f) => !f.empty);
  if (!focuses.length) return { partIds: [], edges: false, diagonals: false, steel: false, labels: {}, note: 'Sin piezas específicas en esta estación.', empty: true };
  const main = EQUIPMENT.find((e) => e.station === stationId && equipmentIds.includes(e.id));
  const primary = (main && focuses[equipmentIds.indexOf(main.id)]) || focuses[0]!;
  return {
    partIds: [...new Set(focuses.flatMap((f) => f.partIds))],
    edges: focuses.some((f) => f.edges),
    diagonals: focuses.some((f) => f.diagonals),
    steel: focuses.some((f) => f.steel),
    labels: Object.assign({}, ...focuses.map((f) => f.labels)),
    note: primary.note,
    empty: false,
  };
}
