/**
 * Proyección SVG paramétrica. Traduce las posiciones (placements) del BOM a polígonos 2D.
 * Nunca altera el BOM: cada polígono proviene de una pieza con su ID.
 * Es un esquema axonométrico/ortogonal 2D, NO un modelo CAD 3D ni un plano CNC.
 */
import { catalogLookup, partCodeLabel, type Box3, type CodeLang, type Catalog, type ModelFocus, type PanelPart, type Project, type ProjectCalculation } from '@ms/domain';

export type ViewKind = 'iso' | 'front' | 'side' | 'top';

export interface SceneOptions {
  view: ViewKind;
  exploded: boolean;
  explodeMm?: number;
  showIds: boolean;
  hideFronts: boolean;
  selectedPartId?: string | null;
  width?: number;
  height?: number;
  title?: string;
  /** Miniatura: sin cotas, títulos ni etiquetas y con márgenes mínimos. */
  minimal?: boolean;
  /** Sin título ni subtítulo (cuando la interfaz ya los muestra). */
  noTitle?: boolean;
  /** Enfoque de una herramienta: resalta piezas, cantos y diagonales y atenúa el resto. */
  focus?: Pick<ModelFocus, 'partIds' | 'edges' | 'diagonals' | 'labels' | 'led'> | null;
  /** Idioma de los códigos de pieza en las etiquetas (español por defecto). */
  lang?: CodeLang;
  /**
   * Paso de armado: muestra sólo `show` (ya colocadas) y `add` (las que se colocan en este paso, resaltadas y
   * desplazadas según `shift` con una flecha hacia su lugar). Cada entrada es una clave de colocación (ID#n) o un ID de pieza.
   * El encuadre es el del módulo completo para que todos los pasos tengan la misma escala.
   */
  assembly?: { show: string[]; add: string[]; shift?: Record<string, [number, number, number]> };
}

export type Pt = [number, number];

export interface ScenePolygon {
  key: string;
  partId: string;
  moduleId: string;
  role: string;
  points: Pt[];
  fill: string;
  stroke: string;
  selected: boolean;
  /** Atenuado (fuera del enfoque de la herramienta). */
  dim?: boolean;
  /** Pieza que se coloca en el paso de armado actual. */
  adding?: boolean;
}
export interface SceneLine { x1: number; y1: number; x2: number; y2: number; kind: 'dim' | 'ext' | 'edge' | 'diag' | 'led' | 'arrow' }
export interface SceneLabel { x: number; y: number; text: string; kind: 'dim' | 'id' | 'title' | 'subtitle' | 'focus'; anchor: 'start' | 'middle' | 'end' }

export interface Scene {
  width: number;
  height: number;
  polygons: ScenePolygon[];
  lines: SceneLine[];
  labels: SceneLabel[];
  ariaLabel: string;
}

interface Solid { key: string; partId: string; moduleId: string; role: string; b: Box3 }

const C30 = Math.cos(Math.PI / 6);

function project3(view: ViewKind, x: number, y: number, z: number): Pt {
  switch (view) {
    case 'iso': return [(x + y) * C30, (x - y) * 0.5 - z];
    case 'front': return [x, -z];
    case 'side': return [y, -z];
    case 'top': return [x, -y];
  }
}

function faces(view: ViewKind, b: Box3): { pts: [number, number, number][]; face: 'top' | 'front' | 'side' }[] {
  const { x0, x1, y0, y1, z0, z1 } = b;
  if (view === 'front') return [{ face: 'front', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] }];
  if (view === 'side') return [{ face: 'side', pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] }];
  if (view === 'top') return [{ face: 'top', pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] }];
  return [
    { face: 'front', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { face: 'side', pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { face: 'top', pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
  ];
}

/** A está detrás de B (se dibuja antes) para la cámara de la vista. */
function behind(view: ViewKind, a: Box3, b: Box3): boolean {
  const e = 1e-6;
  switch (view) {
    case 'iso': return a.x1 <= b.x0 + e || a.y0 >= b.y1 - e || a.z1 <= b.z0 + e;
    case 'front': return a.y0 >= b.y1 - e;
    case 'side': return a.x1 <= b.x0 + e;
    case 'top': return a.z1 <= b.z0 + e;
  }
}

const depthKey = (view: ViewKind, b: Box3) => {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
  return view === 'iso' ? cx - cy + cz : view === 'front' ? -cy : view === 'side' ? cx : cz;
};

/** Orden del pintor por relaciones de separación entre cajas (topológico, determinista). */
export function paintOrder(view: ViewKind, solids: Solid[]): Solid[] {
  const n = solids.length;
  const indeg = new Array<number>(n).fill(0);
  const out: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ab = behind(view, solids[i]!.b, solids[j]!.b);
      const ba = behind(view, solids[j]!.b, solids[i]!.b);
      if (ab && !ba) { out[i]!.push(j); indeg[j]!++; }
      else if (ba && !ab) { out[j]!.push(i); indeg[i]!++; }
    }
  }
  const order: Solid[] = [];
  const done = new Array<boolean>(n).fill(false);
  const keyOf = (i: number) => depthKey(view, solids[i]!.b);
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || keyOf(i) < keyOf(pick))) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || keyOf(i) < keyOf(pick))) pick = i; // ciclo: desempate
    done[pick] = true;
    order.push(solids[pick]!);
    for (const j of out[pick]!) indeg[j]!--;
  }
  return order;
}

function explodeBox(b: Box3, center: { x: number; y: number; z: number }, d: number): Box3 {
  const ext = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0];
  const axis = ext.indexOf(Math.min(...ext));
  const c = [(b.x0 + b.x1) / 2 - center.x, (b.y0 + b.y1) / 2 - center.y, (b.z0 + b.z1) / 2 - center.z];
  const s = Math.sign(c[axis]!) || 1;
  const off = [0, 0, 0];
  off[axis] = s * d;
  return { x0: b.x0 + off[0]!, x1: b.x1 + off[0]!, y0: b.y0 + off[1]!, y1: b.y1 + off[1]!, z0: b.z0 + off[2]!, z1: b.z1 + off[2]! };
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function colorsFor(part: { role: string } | null, finish: { top: string; front: string; side: string }) {
  switch (part?.role) {
    case 'back': return { top: '#b9a17f', front: '#a38b69', side: '#8a7454' };
    case 'drawer_box': return { top: '#e2cfa6', front: '#cdb78c', side: '#b09a70' };
    case 'plinth': return { top: shade(finish.top, -0.25), front: shade(finish.front, -0.25), side: shade(finish.side, -0.25) };
    case 'front': return { top: shade(finish.top, 0.08), front: shade(finish.front, 0.08), side: shade(finish.side, 0.08) };
    case 'steel': return { top: '#7d8a95', front: '#5f6b75', side: '#46515a' };
    case 'fx_leg': return { top: '#d8b98f', front: '#c49a6c', side: '#a57b4f' };
    case 'fx_mirror': return { top: '#e6f1f5', front: '#cfe3ea', side: '#a9c3cc' };
    case 'fx_bulb': return { top: '#fff7d6', front: '#ffefb0', side: '#f2d98a' };
    case 'fx_outlet': return { top: '#ffd84d', front: '#ffd84d', side: '#e0b62f' };
    case 'fx_grommet': return { top: '#2b2f33', front: '#2b2f33', side: '#1b1e21' };
    default: return finish;
  }
}

/** Sólidos de herrería esquemáticos derivados de las piezas de acero (no CAD). */
function steelSolids(project: Project, calc: ProjectCalculation): Solid[] {
  const out: Solid[] = [];
  for (const m of calc.modules) {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    if (!spec) continue;
    for (const req of m.steel) {
      const sec = parseFloat(req.sectionSpec) || 25.4;
      const leg = req.pieces.find((p) => p.label === 'Pata');
      if (!leg) continue;
      const desk = req.id.endsWith('STEEL-DESK');
      const inset = desk ? 50 : 0;
      const W = spec.widthMm, D = desk ? spec.depthMm : (m.carcassDepthMm ?? spec.depthMm);
      const y0 = desk ? 0 : (spec.front === 'open' ? 0 : spec.thicknessMm);
      const xs = [inset, W - inset - sec], ys = [y0 + inset, y0 + D - inset - sec];
      let k = 0;
      for (const x of xs) for (const y of ys) out.push({ key: `${req.id}-L${++k}`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: x, x1: x + sec, y0: y, y1: y + sec, z0: 0, z1: leg.lengthMm } });
      const zt = leg.lengthMm;
      out.push({ key: `${req.id}-RF`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: inset + sec, x1: W - inset - sec, y0: ys[0]!, y1: ys[0]! + sec, z0: zt - sec, z1: zt } });
      out.push({ key: `${req.id}-RB`, partId: req.id, moduleId: m.moduleId, role: 'steel', b: { x0: inset + sec, x1: W - inset - sec, y0: ys[1]!, y1: ys[1]! + sec, z0: zt - sec, z1: zt } });
    }
  }
  return out;
}

function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polyArea = (pts: Pt[]) => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]!; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/**
 * Etiquetas de ID legibles: una por pieza visible, sobre su cara más grande que se ve.
 * Se omiten las piezas tapadas por otras (p. ej. costados detrás de los frentes) y las que se encimarían con otra etiqueta.
 */
function idLabels(ordered: Solid[], polys: { key: string; pts: Pt[] }[], partsById: Map<string, PanelPart>, taken: SceneLabel[], lang: CodeLang): SceneLabel[] {
  const out: SceneLabel[] = [];
  const box = (x: number, y: number, text: string) => { const w = text.length * 6.1 + 6; return { x0: x - w / 2, x1: x + w / 2, y0: y - 9, y1: y + 5 }; };
  const boxes = taken.map((l) => box(l.x, l.y, l.text));
  const idx = new Map<string, number[]>();
  polys.forEach((p, i) => idx.set(p.key, [...(idx.get(p.key) ?? []), i]));
  const seenSteel = new Set<string>();
  // Del frente hacia atrás: lo visible se etiqueta primero.
  for (let k = ordered.length - 1; k >= 0; k--) {
    const s = ordered[k]!;
    if (s.role.startsWith('fx_')) continue;
    if (s.role === 'steel') { if (seenSteel.has(s.partId)) continue; seenSteel.add(s.partId); }
    const own = (idx.get(s.key) ?? []).map((i) => ({ i, a: polyArea(polys[i]!.pts) })).sort((a, b) => b.a - a.a);
    const part = partsById.get(s.partId);
    const text = part ? `${partCodeLabel(part.code, lang)}${part.quantity > 1 ? `·${s.key.split('#')[1]}` : ''}` : 'PTR';
    for (const { i, a } of own) {
      const pts = polys[i]!.pts;
      // Caras delgadas (cantos): grosor ≈ 2·área/perímetro; si no cabe el texto, no llevan etiqueta.
      const per = pts.reduce((t, p, k) => { const q = pts[(k + 1) % pts.length]!; return t + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
      if (a < 600 || (2 * a) / per < 12) continue;
      const c: Pt = [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
      const hidden = polys.some((q, j) => j > i && q.key !== s.key && inPoly(c, q.pts));
      if (hidden) continue;
      const bb = box(c[0], c[1], text);
      if (boxes.some((o) => bb.x0 < o.x1 && bb.x1 > o.x0 && bb.y0 < o.y1 && bb.y1 > o.y0)) continue;
      boxes.push(bb);
      out.push({ x: Math.round(c[0] * 10) / 10, y: Math.round((c[1] + 3) * 10) / 10, text, kind: 'id', anchor: 'middle' });
      break;
    }
  }
  return out;
}

export function buildScene(project: Project, calc: ProjectCalculation, catalog: Catalog, opts: SceneOptions): Scene {
  const L = catalogLookup(catalog);
  const width = opts.width ?? 900, height = opts.height ?? 640;
  const view = opts.view;
  const partsById = new Map<string, PanelPart>(calc.parts.map((p) => [p.id, p]));
  // Muebles a muro con altura capturada (p. ej. peinador flotante): se dibujan a su altura real.
  const zl = (moduleId: string) => { const sp = project.modules.find((x) => x.id === moduleId); return sp?.mount === 'wall' ? sp.elevationMm ?? 0 : 0; };
  const solids: Solid[] = [];
  calc.modules.forEach((m, mi) => {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    const parts = m.parts.filter((p) => !(opts.hideFronts && p.role === 'front'));
    const all = m.parts.flatMap((p) => p.placements);
    const center = all.length
      ? { x: (Math.min(...all.map((b) => b.x0)) + Math.max(...all.map((b) => b.x1))) / 2, y: (Math.min(...all.map((b) => b.y0)) + Math.max(...all.map((b) => b.y1))) / 2, z: (Math.min(...all.map((b) => b.z0)) + Math.max(...all.map((b) => b.z1))) / 2 }
      : { x: 0, y: 0, z: 0 };
    const d = opts.exploded ? (opts.explodeMm ?? Math.max(60, (spec?.widthMm ?? 800) * 0.12)) : 0;
    // En despiece separado los módulos también se separan entre sí para no encimarse.
    const dx = m.offsetXMm + (opts.exploded ? mi * 2.5 * (opts.explodeMm ?? 120) : 0);
    for (const p of parts) {
      p.placements.forEach((pl, i) => {
        const b0 = opts.exploded ? explodeBox(pl, center, d) : pl;
        const b = { x0: b0.x0 + dx, x1: b0.x1 + dx, y0: b0.y0 + m.offsetYMm, y1: b0.y1 + m.offsetYMm, z0: b0.z0 + zl(m.moduleId), z1: b0.z1 + zl(m.moduleId) };
        solids.push({ key: `${p.id}#${i + 1}`, partId: p.id, moduleId: m.moduleId, role: p.role, b });
      });
    }
  });
  for (const s of steelSolids(project, calc)) {
    const m = calc.modules.find((x) => x.moduleId === s.moduleId)!;
    solids.push({ ...s, b: { ...s.b, x0: s.b.x0 + m.offsetXMm, x1: s.b.x1 + m.offsetXMm, y0: s.b.y0 + m.offsetYMm, y1: s.b.y1 + m.offsetYMm } });
  }
  // Patas, espejo, focos y puntos eléctricos (no son tablero; en despiece separado no se dibujan)
  if (!opts.exploded) {
    for (const m of calc.modules) for (const f of m.fixtures ?? []) {
      if (f.kind === 'cable_exit' || f.kind === 'mirror_glow') continue;
      solids.push({ key: f.id, partId: f.id, moduleId: m.moduleId, role: `fx_${f.kind}`, b: { ...f.b, x0: f.b.x0 + m.offsetXMm, x1: f.b.x1 + m.offsetXMm, y0: f.b.y0 + m.offsetYMm, y1: f.b.y1 + m.offsetYMm, z0: f.b.z0 + zl(m.moduleId), z1: f.b.z1 + zl(m.moduleId) } });
    }
  }

  // Paso de armado: filtrar, desplazar lo que se agrega y preparar flechas
  const asm = opts.assembly ?? null;
  const addingKeys = new Set<string>();
  let frameSolids: Solid[] | null = null;
  const arrows3: { a: [number, number, number]; b: [number, number, number] }[] = [];
  if (asm) {
    const has = (list: string[], sl: Solid) => list.includes(sl.key) || list.includes(sl.partId);
    const keep = solids.filter((sl) => has(asm.show, sl) || has(asm.add, sl));
    const mods = new Set(keep.map((sl) => sl.moduleId));
    frameSolids = solids.filter((sl) => mods.has(sl.moduleId));
    solids.length = 0;
    const groups = new Map<string, { d: [number, number, number]; boxes: Box3[] }>();
    for (const sl of keep) {
      if (!has(asm.add, sl)) { solids.push(sl); continue; }
      addingKeys.add(sl.key);
      const d = asm.shift?.[sl.key] ?? asm.shift?.[sl.partId] ?? [0, 0, 0];
      const b = { x0: sl.b.x0 + d[0], x1: sl.b.x1 + d[0], y0: sl.b.y0 + d[1], y1: sl.b.y1 + d[1], z0: sl.b.z0 + d[2], z1: sl.b.z1 + d[2] };
      solids.push({ ...sl, b });
      if (d[0] || d[1] || d[2]) {
        // Una flecha por grupo de piezas que se mueven igual (al centro del grupo).
        const k = d.join(',');
        const g = groups.get(k) ?? { d, boxes: [] as Box3[] };
        g.boxes.push(sl.b);
        groups.set(k, g);
      }
    }
    for (const g of groups.values()) {
      const bb = g.boxes.reduce((a, x) => ({ x0: Math.min(a.x0, x.x0), x1: Math.max(a.x1, x.x1), y0: Math.min(a.y0, x.y0), y1: Math.max(a.y1, x.y1), z0: Math.min(a.z0, x.z0), z1: Math.max(a.z1, x.z1) }));
      const to: [number, number, number] = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2];
      const from: [number, number, number] = [to[0] + g.d[0], to[1] + g.d[1], to[2] + g.d[2]];
      arrows3.push({ a: from, b: [from[0] - g.d[0] * 0.8, from[1] - g.d[1] * 0.8, from[2] - g.d[2] * 0.8] });
    }
  }

  // Extensión total para cotas (sin explosión)
  const real = calc.modules.flatMap((m) => m.parts.flatMap((p) => p.placements.map((b) => ({ ...b, x0: b.x0 + m.offsetXMm, x1: b.x1 + m.offsetXMm, y0: b.y0 + m.offsetYMm, y1: b.y1 + m.offsetYMm, z0: b.z0 + zl(m.moduleId), z1: b.z1 + zl(m.moduleId) }))));
  const ext = real.length
    ? { x0: Math.min(...real.map((b) => b.x0)), x1: Math.max(...real.map((b) => b.x1)), y0: Math.min(...real.map((b) => b.y0)), y1: Math.max(...real.map((b) => b.y1)), z0: Math.min(0, ...real.map((b) => b.z0)), z1: Math.max(...real.map((b) => b.z1)) }
    : { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
  const span = Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0, ext.z1 - ext.z0, 1);
  const off = span * 0.09;

  type RawLine = { a: [number, number, number]; b: [number, number, number]; text: string };
  const dims: RawLine[] = [];
  const W = Math.round((ext.x1 - ext.x0) * 10) / 10, D = Math.round((ext.y1 - ext.y0) * 10) / 10, H = Math.round((ext.z1 - ext.z0) * 10) / 10;
  if (!opts.minimal && (view === 'iso' || view === 'front' || view === 'top')) dims.push({ a: [ext.x0, ext.y0 - off, ext.z0], b: [ext.x1, ext.y0 - off, ext.z0], text: `${W} mm · ANCHO` });
  if (view === 'iso' || view === 'front') dims.push({ a: [ext.x0 - off, ext.y0, ext.z0], b: [ext.x0 - off, ext.y0, ext.z1], text: `${H} mm · ALTO` });
  if (view === 'side') dims.push({ a: [ext.x1, ext.y0 - off, ext.z0], b: [ext.x1, ext.y0 - off, ext.z1], text: `${H} mm · ALTO` });
  if (view === 'iso') dims.push({ a: [ext.x1 + off, ext.y0, ext.z0], b: [ext.x1 + off, ext.y1, ext.z0], text: `${D} mm · FONDO` });
  if (view === 'side') dims.push({ a: [ext.x1, ext.y0, ext.z0 - off], b: [ext.x1, ext.y1, ext.z0 - off], text: `${D} mm · FONDO` });
  if (view === 'top') dims.push({ a: [ext.x1 + off, ext.y0, ext.z1], b: [ext.x1 + off, ext.y1, ext.z1], text: `${D} mm · FONDO` });
  // Cotas por módulo sólo en vista frontal (en isométrico se enciman con la cota total).
  if (calc.modules.length > 1 && !opts.exploded && view === 'front') {
    for (const m of calc.modules) {
      const spec = project.modules.find((s) => s.id === m.moduleId);
      if (!spec) continue;
      const z = ext.z1 + off * 0.5;
      dims.push({ a: [m.offsetXMm, ext.y0 - off * 0.5, z], b: [m.offsetXMm + spec.widthMm, ext.y0 - off * 0.5, z], text: `${spec.id} ${spec.widthMm}` });
    }
  }

  if (opts.minimal) dims.length = 0;

  // Enfoque de herramienta: cantos de piezas resaltadas y diagonales del frente de cada caja (coordenadas 3D)
  const focus = opts.focus ?? null;
  const focusSet = new Set(focus?.partIds ?? []);
  const extra3: { a: [number, number, number]; b: [number, number, number]; kind: 'edge' | 'diag' | 'led' }[] = [];
  // Ranuras LED (router): siempre visibles en el modelo armado para saber dónde se fresa.
  if (!opts.exploded && !opts.minimal) {
    for (const r of calc.ledRuns) {
      const m = calc.modules.find((x) => x.moduleId === r.moduleId);
      if (!m) continue;
      const mv = (p: [number, number, number]): [number, number, number] => [p[0] + m.offsetXMm, p[1] + m.offsetYMm, p[2] + zl(m.moduleId)];
      extra3.push({ a: mv(r.a), b: mv(r.b), kind: 'led' });
    }
  }
  const extraLabels3: { p: [number, number, number]; text: string }[] = [];
  if (focus) {
    for (const sld of solids) {
      const part = partsById.get(sld.partId);
      if (!part || !focusSet.has(part.id)) continue;
      if (focus.edges) {
        const b = sld.b;
        const ext3 = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0];
        const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
        const used = new Set<number>();
        const axisOf = (v: number) => { const i = ext3.findIndex((e, k) => !used.has(k) && Math.abs(e - v) < 0.05); if (i >= 0) used.add(i); return i; };
        const la = axisOf(part.lengthMm), wa = axisOf(part.widthMm);
        const ta = [0, 1, 2].find((k) => !used.has(k));
        if (la >= 0 && wa >= 0 && ta !== undefined) {
          const mid = (lo[ta]! + hi[ta]!) / 2;
          const pt = (l: number, w: number): [number, number, number] => { const v = [0, 0, 0]; v[la] = l; v[wa] = w; v[ta] = mid; return v as [number, number, number]; };
          for (const e of Object.keys(part.edgeBand)) {
            if (e === 'L1' || e === 'L2') { const w = e === 'L1' ? lo[wa]! : hi[wa]!; extra3.push({ a: pt(lo[la]!, w), b: pt(hi[la]!, w), kind: 'edge' }); }
            else { const l = e === 'A1' ? lo[la]! : hi[la]!; extra3.push({ a: pt(l, lo[wa]!), b: pt(l, hi[wa]!), kind: 'edge' }); }
          }
        }
      }
      const label = focus.labels[part.id];
      if (label && sld.key.endsWith('#1')) extraLabels3.push({ p: [(sld.b.x0 + sld.b.x1) / 2, view === 'front' ? sld.b.y0 : (sld.b.y0 + sld.b.y1) / 2, (sld.b.z0 + sld.b.z1) / 2], text: label });
    }
    if (focus.diagonals) {
      for (const m of calc.modules) {
        const boxes = solids.filter((x) => x.moduleId === m.moduleId && x.role === 'carcass').map((x) => x.b);
        if (!boxes.length || !m.theoreticalDiagonalMm) continue;
        const x0 = Math.min(...boxes.map((b) => b.x0)), x1 = Math.max(...boxes.map((b) => b.x1));
        const z0 = Math.min(...boxes.map((b) => b.z0)), z1 = Math.max(...boxes.map((b) => b.z1));
        const y = Math.min(...boxes.map((b) => b.y0));
        extra3.push({ a: [x0, y, z0], b: [x1, y, z1], kind: 'diag' }, { a: [x1, y, z0], b: [x0, y, z1], kind: 'diag' });
        extraLabels3.push({ p: [(x0 + x1) / 2, y, (z0 + z1) / 2], text: `diagonal ${Math.round(m.theoreticalDiagonalMm)} mm` });
      }
    }
  }

  // Proyección y ajuste al viewBox
  const ordered = paintOrder(view, solids);
  const rawPolys: { s: Solid; face: 'top' | 'front' | 'side'; pts: Pt[] }[] = [];
  for (const s of ordered) for (const f of faces(view, s.b)) rawPolys.push({ s, face: f.face, pts: f.pts.map(([x, y, z]) => project3(view, x, y, z)) });
  const rawDims = dims.map((d) => ({ ...d, pa: project3(view, ...d.a), pb: project3(view, ...d.b) }));
  let allPts = [...rawPolys.flatMap((p) => p.pts), ...rawDims.flatMap((d) => [d.pa, d.pb])];
  if (frameSolids?.length) {
    // Encuadre fijo para todos los pasos: caja del módulo ampliada por el desplazamiento máximo.
    const pad = 320;
    const bb = frameSolids.reduce((a, x) => ({ x0: Math.min(a.x0, x.b.x0), x1: Math.max(a.x1, x.b.x1), y0: Math.min(a.y0, x.b.y0), y1: Math.max(a.y1, x.b.y1), z0: Math.min(a.z0, x.b.z0), z1: Math.max(a.z1, x.b.z1) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity });
    allPts = [];
    for (const x of [bb.x0 - pad, bb.x1 + pad]) for (const y of [bb.y0 - pad, bb.y1 + pad]) for (const z of [bb.z0 - pad * 0.6, bb.z1 + pad * 0.6]) allPts.push(project3(view, x, y, z));
  }
  const minX = Math.min(...allPts.map((p) => p[0])), maxX = Math.max(...allPts.map((p) => p[0]));
  const minY = Math.min(...allPts.map((p) => p[1])), maxY = Math.max(...allPts.map((p) => p[1]));
  const margin = opts.minimal ? 6 : 70, top = opts.minimal ? 6 : opts.noTitle ? 36 : 80;
  const sc = Math.min((width - 2 * margin) / Math.max(maxX - minX, 1), (height - top - margin) / Math.max(maxY - minY, 1));
  const ox = margin + ((width - 2 * margin) - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = top + ((height - top - margin) - (maxY - minY) * sc) / 2 - minY * sc;
  const T = (p: Pt): Pt => [Math.round((ox + p[0] * sc) * 10) / 10, Math.round((oy + p[1] * sc) * 10) / 10];

  const polygons: ScenePolygon[] = rawPolys.map(({ s, face, pts }) => {
    const part = partsById.get(s.partId) ?? null;
    const finish = L.finish(part?.finishId ?? project.modules.find((m) => m.id === s.moduleId)?.finishId ?? 'grafito');
    const c = colorsFor(part ?? { role: s.role }, finish.colors);
    const selected = opts.selectedPartId === s.partId;
    const inFocus = !focus || focusSet.has(s.partId);
    if (addingKeys.has(s.key)) {
      const a = { top: '#f7c98b', front: '#eba24f', side: '#c97a2a' };
      return { key: `${s.key}-${face}`, partId: s.partId, moduleId: s.moduleId, role: s.role, points: pts.map(T), fill: a[face], stroke: '#8a4a0a', selected: false, adding: true };
    }
    return {
      key: `${s.key}-${face}`, partId: s.partId, moduleId: s.moduleId, role: s.role, points: pts.map(T),
      fill: selected ? shade(c[face], 0.35) : focus && inFocus ? shade(c[face], 0.12) : c[face],
      stroke: selected ? '#ffbe3d' : focus && inFocus ? '#5fd4ef' : '#90a7b8', selected, dim: !inFocus,
    };
  });

  const lines: SceneLine[] = [];
  const labels: SceneLabel[] = [];
  for (const d of rawDims) {
    const a = T(d.pa), b = T(d.pb);
    lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], kind: 'dim' });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const vertical = Math.abs(a[0] - b[0]) < Math.abs(a[1] - b[1]) * 0.3;
    labels.push({ x: vertical ? mx - 10 : mx, y: vertical ? my : my - 10, text: d.text, kind: 'dim', anchor: vertical ? 'end' : 'middle' });
  }
  for (const e of extra3) {
    const a = T(project3(view, ...e.a)), b = T(project3(view, ...e.b));
    lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], kind: e.kind });
  }
  for (const e of arrows3) {
    const a = T(project3(view, ...e.a)), b = T(project3(view, ...e.b));
    lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], kind: 'arrow' });
  }
  for (const l of extraLabels3) {
    const p = T(project3(view, ...l.p));
    labels.push({ x: p[0], y: p[1], text: l.text, kind: 'focus', anchor: 'middle' });
  }
  if (opts.showIds) labels.push(...idLabels(ordered, rawPolys.map((r) => ({ key: r.s.key, pts: r.pts.map(T) })), partsById, [...labels], opts.lang ?? 'es'));
  if (!opts.minimal && !opts.noTitle) labels.unshift(
    { x: 24, y: 34, text: opts.title ?? project.name, kind: 'title', anchor: 'start' },
    { x: 24, y: 56, text: `${({ iso: 'Isométrico', front: 'Vista frontal', side: 'Vista lateral derecha', top: 'Planta' } as const)[view]} esquemático · cotas en mm${opts.exploded ? ' · despiece separado' : ''}`, kind: 'subtitle', anchor: 'start' },
  );
  return { width, height, polygons, lines, labels, ariaLabel: `${project.name}: vista ${view} acotada en milímetros` };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** SVG autónomo (exportación). El editor React usa la misma escena. */
export function sceneToSvg(scene: Scene, theme: 'dark' | 'light' | 'transparent' = 'dark'): string {
  const bg = theme === 'dark' ? '#14202a' : '#ffffff';
  const dim = theme === 'dark' ? '#ffbe66' : '#b25e00';
  const txt = theme === 'dark' ? '#e8edf4' : '#1b2630';
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}" role="img" aria-label="${esc(scene.ariaLabel)}" font-family="Inter, system-ui, sans-serif">`);
  parts.push(`<title>${esc(scene.ariaLabel)}</title>`);
  parts.push(`<defs><marker id="ms-push" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="7" refY="7" orient="auto"><path d="M0,1 L14,7 L0,13 z" fill="#d9480f"/></marker></defs>`);
  parts.push(`<defs><marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="none" stroke="${dim}" stroke-width="1.2"/></marker></defs>`);
  if (theme !== 'transparent') parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);
  for (const p of scene.polygons) parts.push(`<polygon data-part-id="${esc(p.partId)}" points="${p.points.map((x) => x.join(',')).join(' ')}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.selected ? 2.4 : 1}" stroke-linejoin="round"${p.dim ? ' opacity="0.18"' : ''}/>`);
  for (const l of scene.lines) {
    if (l.kind === 'edge') parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#ff9f43" stroke-width="3" stroke-linecap="round"/>`);
    else if (l.kind === 'diag') parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#5fd4ef" stroke-width="2" stroke-dasharray="8 5"/>`);
    else if (l.kind === 'arrow') parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#d9480f" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 5" marker-end="url(#ms-push)"/>`);
    else if (l.kind === 'led') parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#ffd84d" stroke-width="3.5" stroke-linecap="round"/>`);
    else parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${dim}" stroke-width="1.3" marker-start="url(#ms-arrow)" marker-end="url(#ms-arrow)"/>`);
  }
  for (const t of scene.labels) {
    const style = t.kind === 'focus' ? `font-size="12" font-weight="700" fill="#ffffff" stroke="#0b1218" stroke-width="3.5" paint-order="stroke"` : t.kind === 'title' ? `font-size="18" fill="${txt}" font-weight="700"` : t.kind === 'subtitle' ? `font-size="12" fill="${txt}" opacity="0.75"` : t.kind === 'dim' ? `font-size="14" font-weight="700" fill="${dim}" stroke="${bg}" stroke-width="3.5" paint-order="stroke"` : `font-size="10.5" fill="#ffffff" stroke="#0b1218" stroke-width="3" paint-order="stroke"`;
    parts.push(`<text x="${t.x}" y="${t.y}" text-anchor="${t.anchor}" ${style}>${esc(t.text)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Mapa de corte (SVG) a partir del acomodo del optimizador
// ---------------------------------------------------------------------------

export interface CutSheetInput {
  materialName: string;
  sheet: { lengthMm: number; widthMm: number; trimMarginMm: number };
  index: number;
  utilization: number;
  placements: { partId: string; label: string; instance: number; x: number; y: number; w: number; h: number; rotated: boolean }[];
}

export function cutSheetSvg(s: CutSheetInput, width = 820, fluid = false): string {
  const sc = (width - 40) / s.sheet.lengthMm;
  const h = s.sheet.widthMm * sc + 70;
  const out: string[] = [];
  const size = fluid ? 'width="100%" style="display:block;height:auto"' : `width="${width}" height="${Math.round(h)}"`;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${Math.round(h)}" ${size} role="img" aria-label="Mapa de corte ${esc(s.materialName)} tablero ${s.index}" font-family="Inter, system-ui, sans-serif">`);
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  out.push(`<text x="20" y="22" font-size="14" font-weight="700" fill="#1b2630">${esc(s.materialName)} · Tablero ${s.index} · ${s.sheet.lengthMm} × ${s.sheet.widthMm} mm · aprovechamiento ${(s.utilization * 100).toFixed(1)} %</text>`);
  out.push(`<text x="20" y="40" font-size="11" fill="#55636f">Acomodo guillotina (layout_factible). Medidas en mm. La veta del tablero corre a lo largo (horizontal). ↻ = pieza girada.</text>`);
  const X = (v: number) => 20 + v * sc, Y = (v: number) => 50 + v * sc;
  out.push(`<rect x="20" y="50" width="${(s.sheet.lengthMm * sc).toFixed(1)}" height="${(s.sheet.widthMm * sc).toFixed(1)}" fill="#f3efe6" stroke="#6b5b45"/>`);
  for (const p of s.placements) {
    out.push(`<rect data-part-id="${esc(p.partId)}" x="${X(p.x).toFixed(1)}" y="${Y(p.y).toFixed(1)}" width="${(p.w * sc).toFixed(1)}" height="${(p.h * sc).toFixed(1)}" fill="#cfe6ee" stroke="#2f6f86" stroke-width="0.8"/>`);
    const fs = Math.max(6, Math.min(11, p.h * sc * 0.28, (p.w * sc) / 9));
    out.push(`<text x="${X(p.x + p.w / 2).toFixed(1)}" y="${Y(p.y + p.h / 2).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#0f2f3a">${esc(`${p.label}${p.rotated ? ' ↻' : ''} ${p.w}×${p.h}`)}</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
export * from './workshop';
export * from './render';
export * from './cutplan';
export * from './assembly';


/**
 * Miniatura isométrica de un proyecto (para tarjetas de catálogo): SVG sin fondo, cotas ni textos,
 * con tamaño adaptable (width="100%").
 */
export function thumbnailSvg(project: Project, calc: ProjectCalculation, catalog: Catalog, width = 320, height = 240): string {
  const scene = buildScene(project, calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, minimal: true, width, height });
  return sceneToSvg(scene, 'transparent')
    .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"')
    .replace(/ stroke="#90a7b8" stroke-width="1"/g, ' stroke="#9fb6c3" stroke-width="0.8"');
}
