import type { CatalogLookup } from '../catalog';
import type { Box3, CheckCategory, CheckStatus, DimensionCheck, EdgeName, Issue, ManufacturingSettings, ModuleSpec, PanelPart } from '../types';
import { r2 } from './helpers';
import { panelWeightKg } from './structural';

export interface VerifyInput {
  spec: ModuleSpec;
  L: CatalogLookup;
  parts: PanelPart[];
  settings: ManufacturingSettings;
  /** Envolvente exterior esperada del módulo (coordenadas del módulo). */
  expected: Box3;
  /** Holgura lateral por lado de la corredera (mm), si hay cajas de cajón. */
  slideClearanceMm: number;
  /** Bisagras por puerta (si hay puertas). */
  hingesPerDoor: number | null;
  /** Hojas que giran sobre divisor (con bisagra de semi-solape asignada). */
  halfOverlayLeaves: number;
}

export interface VerifyResult {
  checks: DimensionCheck[];
  issues: Omit<Issue, 'moduleId'>[];
  weightKg: number;
}

const EPS = 0.05;

/**
 * Verificación dimensional independiente del modo en que se construyeron las piezas:
 * reconstruye el mueble a partir de las posiciones y comprueba cierre de medidas, apoyos,
 * cantos, espesores, tamaños mínimos de taller, cobertura de frentes, herrajes y peso.
 */
export function verifyModule(v: VerifyInput): VerifyResult {
  const { spec, L, parts, settings } = v;
  const checks: DimensionCheck[] = [];
  const issues: Omit<Issue, 'moduleId'>[] = [];
  let n = 0;
  const add = (category: CheckCategory, label: string, expected: string, actual: string, status: CheckStatus, partId?: string) => {
    checks.push({ id: `${spec.id}-CHK-${String(++n).padStart(3, '0')}`, moduleId: spec.id, category, label, expected, actual, status, ...(partId ? { partId } : {}) });
  };
  const fail = (code: string, severity: Issue['severity'], message: string, partId?: string) => issues.push({ code, severity, message, ...(partId ? { partId } : {}) });

  const all = parts.flatMap((p) => p.placements.map((b, i) => ({ key: `${p.id}#${i + 1}`, part: p, b })));

  // 1) Cierre de medidas exteriores
  if (all.length) {
    const act = {
      x0: Math.min(...all.map((x) => x.b.x0)), x1: Math.max(...all.map((x) => x.b.x1)),
      y0: Math.min(...all.map((x) => x.b.y0)), y1: Math.max(...all.map((x) => x.b.y1)),
      z0: Math.min(...all.map((x) => x.b.z0)), z1: Math.max(...all.map((x) => x.b.z1)),
    };
    const e = v.expected;
    const axes: [string, number, number, number, number][] = [
      ['Ancho exterior', e.x0, e.x1, act.x0, act.x1],
      ['Fondo exterior', e.y0, e.y1, act.y0, act.y1],
      ['Alto exterior (con base de tablero)', e.z0, e.z1, act.z0, act.z1],
    ];
    for (const [label, a0, a1, b0, b1] of axes) {
      const ok = Math.abs(a0 - b0) <= EPS && Math.abs(a1 - b1) <= EPS;
      add('cierre', label, `${r2(a1 - a0)} mm (${r2(a0)}→${r2(a1)})`, `${r2(b1 - b0)} mm (${r2(b0)}→${r2(b1)})`, ok ? 'ok' : 'error');
      if (!ok) fail('EXTERIOR_DIMENSION_MISMATCH', 'error', `${label}: las piezas suman ${r2(b1 - b0)} mm y se pidió ${r2(a1 - a0)} mm.`);
    }
  }

  // 2) Cada posición corresponde a las medidas finales de su pieza
  let mismatched = 0;
  for (const x of all) {
    const dims = [x.b.x1 - x.b.x0, x.b.y1 - x.b.y0, x.b.z1 - x.b.z0].sort((a, b) => a - b);
    const exp = [x.part.lengthMm, x.part.widthMm, x.part.thicknessMm].sort((a, b) => a - b);
    if (dims.some((d, k) => Math.abs(d - exp[k]!) > 0.02)) {
      mismatched++;
      fail('PLACEMENT_SIZE_MISMATCH', 'error', `${x.key}: la posición no coincide con la medida de la pieza.`, x.part.id);
    }
  }
  add('cierre', 'Posiciones 3D = medidas del despiece', `${all.length} de ${all.length}`, `${all.length - mismatched} de ${all.length}`, mismatched ? 'error' : 'ok');

  // 3) Apoyos: grafo de contacto entre piezas (ninguna pieza flotando)
  if (all.length > 1) {
    const tol = settings.contactToleranceMm;
    const touching = (a: (typeof all)[number], b: (typeof all)[number]) => {
      const gaps = [Math.max(a.b.x0 - b.b.x1, b.b.x0 - a.b.x1), Math.max(a.b.y0 - b.b.y1, b.b.y0 - a.b.y1), Math.max(a.b.z0 - b.b.z1, b.b.z0 - a.b.z1)];
      const overlapping = gaps.filter((g) => g < -0.5).length;
      if (overlapping !== 2) return false;
      const gap = gaps.find((g) => g >= -0.5)!;
      const boxToCarcass = (a.part.role === 'drawer_box') !== (b.part.role === 'drawer_box') && (['carcass', 'divider'].includes(a.part.role) || ['carcass', 'divider'].includes(b.part.role));
      return gap >= -0.01 && gap <= tol + (boxToCarcass ? v.slideClearanceMm : 0);
    };
    const rootIdx = Math.max(0, all.findIndex((x) => x.part.role === 'carcass' || x.part.role === 'desk'));
    const seen = new Set<number>([rootIdx]);
    const queue = [rootIdx];
    while (queue.length) {
      const i = queue.shift()!;
      for (let j = 0; j < all.length; j++) {
        if (!seen.has(j) && touching(all[i]!, all[j]!)) { seen.add(j); queue.push(j); }
      }
    }
    const floating = all.filter((_, i) => !seen.has(i));
    add('apoyo', 'Piezas apoyadas o unidas a otra', `${all.length} de ${all.length}`, `${all.length - floating.length} de ${all.length}`, floating.length ? 'error' : 'ok');
    for (const f of floating) fail('PART_UNSUPPORTED', 'error', `${f.key} no toca ninguna otra pieza (tolerancia ${tol} mm): revise posiciones u holguras.`, f.part.id);
  }

  // 4) Cantos: ancho del canto vs. espesor del tablero
  for (const p of parts) {
    const bands = [...new Set(Object.values(p.edgeBand).filter(Boolean))] as string[];
    for (const id of bands) {
      const eb = L.edgeBand(id);
      const spare = eb.widthMm - p.thicknessMm;
      const status: CheckStatus = spare < 0 ? 'error' : spare < 1 ? 'warning' : 'ok';
      if (status !== 'ok' || p === parts.find((q) => Object.values(q.edgeBand).includes(id))) {
        add('canto', `${eb.name} sobre ${p.code}`, `ancho ≥ ${r2(p.thicknessMm + 1)} mm (espesor + 1 de refilado)`, `${eb.widthMm} mm`, status, p.id);
      }
      if (status === 'error') fail('EDGE_BAND_TOO_NARROW', 'error', `${p.id}: canto de ${eb.widthMm} mm no cubre el tablero de ${p.thicknessMm} mm.`, p.id);
      if (status === 'warning') fail('EDGE_BAND_NO_TRIM_ALLOWANCE', 'warning', `${p.id}: canto de ${eb.widthMm} mm sin excedente para refilar en tablero de ${p.thicknessMm} mm.`, p.id);
    }
  }
  const sample = parts.find((p) => Object.keys(p.edgeBand).length);
  if (sample) {
    const eb = L.edgeBand(Object.values(sample.edgeBand)[0]!);
    add('canto', 'Compensación de canto en medida de corte', settings.edgeCompensation ? `final − ${eb.thicknessMm} mm por arista canteada${settings.premillMm ? ` + ${settings.premillMm} mm de repasado` : ''}` : 'sin compensación',
      `${sample.code}: final ${sample.lengthMm}×${sample.widthMm} → corte ${sample.cutLengthMm}×${sample.cutWidthMm}`, settings.edgeCompensation || eb.thicknessMm < 0.5 ? 'ok' : 'warning', sample.id);
    if (!settings.edgeCompensation && eb.thicknessMm >= 0.5) fail('EDGE_COMPENSATION_OFF', 'warning', `Compensación de canto desactivada con canto de ${eb.thicknessMm} mm: las piezas canteadas quedarán ${eb.thicknessMm} mm más grandes por arista.`);
  }

  // 5) Espesor de pieza vs. material
  for (const p of parts) {
    const m = L.material(p.materialId);
    if (Math.abs(m.thicknessMm - p.thicknessMm) > 0.01) {
      add('espesor', `Espesor de ${p.code}`, `${m.thicknessMm} mm (${m.name})`, `${p.thicknessMm} mm`, 'warning', p.id);
    }
  }
  if (!parts.some((p) => Math.abs(L.material(p.materialId).thicknessMm - p.thicknessMm) > 0.01) && parts.length) {
    add('espesor', 'Espesores de pieza = espesor nominal del material', 'todas', 'todas', 'ok');
  }

  // 6) Tamaños mínimos de taller (corte y canteado)
  let sizeIssues = 0;
  for (const p of parts) {
    const minCut = Math.min(p.cutLengthMm, p.cutWidthMm);
    if (minCut < settings.minPartWidthMm) {
      sizeIssues++;
      add('tamaño', `Ancho mínimo de corte · ${p.code}`, `≥ ${settings.minPartWidthMm} mm`, `${minCut} mm`, 'warning', p.id);
      fail('PART_TOO_NARROW', 'warning', `${p.id}: ${minCut} mm es menor que el mínimo de corte seguro del taller (${settings.minPartWidthMm} mm).`, p.id);
    }
    const edges = Object.keys(p.edgeBand) as EdgeName[];
    const lengthwise = edges.some((e) => e === 'L1' || e === 'L2');
    const crosswise = edges.some((e) => e === 'A1' || e === 'A2');
    const tooSmall = (lengthwise && (p.cutWidthMm < settings.minEdgebandWidthMm || p.lengthMm < settings.minEdgebandLengthMm))
      || (crosswise && (p.cutLengthMm < settings.minEdgebandWidthMm || p.widthMm < settings.minEdgebandLengthMm));
    if (tooSmall) {
      sizeIssues++;
      add('tamaño', `Canteable en máquina · ${p.code}`, `transversal ≥ ${settings.minEdgebandWidthMm} mm y arista ≥ ${settings.minEdgebandLengthMm} mm`, `${p.cutLengthMm} × ${p.cutWidthMm} mm`, 'warning', p.id);
      fail('PART_TOO_SMALL_FOR_EDGEBANDER', 'warning', `${p.id} (${p.cutLengthMm} × ${p.cutWidthMm} mm) es pequeña para la canteadora: cantear a mano o cortar sobremedida.`, p.id);
    }
  }
  if (!sizeIssues && parts.length) add('tamaño', 'Tamaños mínimos de corte y canteado', `≥ ${settings.minPartWidthMm} mm / ≥ ${settings.minEdgebandWidthMm} mm`, 'todas las piezas cumplen', 'ok');

  // 7) Frentes: cubren la abertura de la caja
  const fronts = parts.filter((p) => p.role === 'front');
  if (fronts.length) {
    const T = spec.thicknessMm;
    const ok = spec.revealMm < T;
    add('frentes', 'Holgura perimetral menor al espesor del costado', `< ${T} mm`, `${spec.revealMm} mm`, ok ? 'ok' : 'error');
    if (!ok) fail('FRONT_COVERAGE', 'error', `Holgura perimetral de ${spec.revealMm} mm ≥ espesor del costado (${T} mm): el frente no cubre la abertura.`);
    const totalW = (spec.widthMm - 2 * spec.revealMm);
    const doorParts = parts.filter((p) => p.code === 'DOOR' || p.code.startsWith('DOOR_'));
    if (doorParts.length) {
      const leaves = doorParts.flatMap((p) => p.placements).sort((a, b) => a.x0 - b.x0);
      const sum = r2(doorParts.reduce((acc, p) => acc + p.quantity * p.widthMm, 0) + (leaves.length - 1) * spec.frontGapMm);
      add('frentes', 'Hojas + juntas = ancho cubierto', `${r2(totalW)} mm`, `${sum} mm`, Math.abs(sum - totalW) <= EPS ? 'ok' : 'error');
      // Cada divisor debe quedar detrás de una junta entre hojas (si no, una hoja lo cruza).
      const divider = parts.find((p) => p.code === 'DIVIDER');
      if (divider) {
        const joints = leaves.slice(1).map((d, i) => (leaves[i]!.x1 + d.x0) / 2);
        const offsets = divider.placements.map((d) => Math.min(...joints.map((j) => Math.abs(j - (d.x0 + d.x1) / 2)), Infinity));
        const worst = r2(Math.max(...offsets));
        const ok = worst <= EPS;
        add('frentes', 'Juntas de hojas centradas sobre divisores', 'desfase 0 mm', Number.isFinite(worst) ? `${worst} mm` : 'sin junta', ok ? 'ok' : 'warning', doorParts[0]!.id);
      }
    }
    const drawerFronts = parts.filter((p) => p.code.startsWith('DRAWER_FRONT'));
    if (drawerFronts.length) {
      const totalH = spec.heightMm - 2 * spec.revealMm;
      // En «cajón + puertas» la puerta completa la columna de frentes.
      const doorH = spec.front === 'drawer_doors' ? (doorParts[0]?.lengthMm ?? 0) : 0;
      const count = drawerFronts.reduce((a, p) => a + p.quantity, 0) + (doorH ? 1 : 0);
      const sum = r2(drawerFronts.reduce((a, p) => a + p.quantity * p.widthMm, 0) + doorH + (count - 1) * spec.frontGapMm);
      add('frentes', doorH ? 'Cajones + puerta + juntas = alto cubierto' : 'Frentes de cajón + juntas = alto cubierto', `${r2(totalH)} mm`, `${sum} mm`, Math.abs(sum - totalH) <= EPS ? 'ok' : 'error');
    }
  }

  // 8) Herrajes: bisagras (espesor y peso de puerta) y patas niveladoras
  const door = parts.filter((p) => p.code === 'DOOR' || p.code.startsWith('DOOR_')).sort((a, b) => b.widthMm - a.widthMm)[0];
  if (door) {
    const hinge = L.maybeHardware(spec.hingeProductId) ?? L.hardware('hinge-generic-110');
    const range = hinge.params?.doorThicknessRangeMm;
    if (range) {
      const ok = door.thicknessMm >= range[0] && door.thicknessMm <= range[1];
      add('herraje', `Espesor de puerta admitido por ${hinge.name}`, `${range[0]}–${range[1]} mm`, `${door.thicknessMm} mm`, ok ? 'ok' : 'warning', door.id);
      if (!ok) fail('HINGE_DOOR_THICKNESS', 'warning', `Puerta de ${door.thicknessMm} mm fuera del rango ${range[0]}–${range[1]} mm de la bisagra seleccionada.`, door.id);
    }
    const m = L.material(door.materialId);
    const kg = r2(panelWeightKg(door.lengthMm, door.widthMm, door.thicknessMm, m.densityKgM3));
    const hpd = v.hingesPerDoor ?? 0;
    const cap = hinge.params?.maxDoorWeightKgPerHinge;
    if (cap && hpd) {
      const ok = kg <= cap * hpd;
      add('herraje', 'Peso de puerta vs. capacidad de bisagras', `≤ ${r2(cap * hpd)} kg (${hpd} × ${cap} kg)`, `${kg} kg`, ok ? 'ok' : 'error', door.id);
      if (!ok) fail('HINGE_OVERLOAD', 'error', `Puerta de ${kg} kg excede ${hpd} bisagras de ${cap} kg.`, door.id);
    } else {
      add('herraje', 'Peso estimado por puerta', `verificar en tabla del fabricante con ${hpd} bisagras`, `${kg} kg (${door.lengthMm}×${door.widthMm}×${door.thicknessMm} mm)`, 'info', door.id);
    }
    if (v.halfOverlayLeaves > 0) {
      add('herraje', 'Hojas que giran sobre divisores', 'bisagra de semi-solape (acodada)', `${v.halfOverlayLeaves} hoja(s) con bisagra de semi-solape asignada`, 'ok', door.id);
    }
  }
  if (spec.baseType === 'levelers' && spec.baseHeightMm > 0) {
    const lev = L.hardware('leveler-100');
    const range = lev.params?.heightRangeMm;
    if (range) {
      const ok = spec.baseHeightMm >= range[0] && spec.baseHeightMm <= range[1];
      add('herraje', `Altura de base dentro del ajuste de ${lev.name}`, `${range[0]}–${range[1]} mm`, `${spec.baseHeightMm} mm`, ok ? 'ok' : 'warning');
      if (!ok) fail('LEVELER_RANGE', 'warning', `Altura de base ${spec.baseHeightMm} mm fuera del ajuste de la pata (${range[0]}–${range[1]} mm): cambie la altura o la pata.`);
    }
  }

  // 9) Peso estimado
  const weightKg = r2(parts.reduce((s, p) => s + p.quantity * panelWeightKg(p.lengthMm, p.widthMm, p.thicknessMm, L.material(p.materialId).densityKgM3), 0));
  add('peso', 'Peso estimado de tableros (sin herrajes ni contenido)', 'densidades típicas por material', `${weightKg} kg`, 'info');

  return { checks, issues, weightKg };
}
