import { DEFAULT_CATALOG, type Box3, type Catalog, type Project, type ProjectCalculation } from '@ms/domain';

/** Material de una caja del render: color base y, si tiene veta, su dirección en el mundo. */
export interface RenderMaterial { color: string; grain: boolean; kind: 'board' | 'back' | 'drawer' | 'steel' | 'handle' | 'led' }
export interface RenderBox { key: string; partId: string; role: string; b: Box3; material: RenderMaterial; grainDir: 'x' | 'y' | 'z' | null; /** Tiras LED: hacia dónde ilumina (ejes del mueble). */ lightDir?: [number, number, number] }
export interface RenderModel { boxes: RenderBox[]; bounds: Box3; wallMounted: boolean }

const HANDLE_LEN = 128, HANDLE_T = 12, HANDLE_OUT = 28;
/** Altura de referencia del fondo de un gabinete aéreo (cubierta ≈ 900 mm + ≈ 550 mm de salpicadero). */
export const WALL_UNIT_BOTTOM_MM = 1450;
/** Otros muebles a muro (cajón o buró flotante, repisas): fondo a esta altura de referencia. */
export const FLOATING_BOTTOM_MM = 450;
const liftFor = (spec: { mount: string; familyId: string } | undefined) =>
  spec?.mount !== 'wall' ? 0 : spec.familyId.startsWith('kitchen') || spec.familyId === 'pantry' ? WALL_UNIT_BOTTOM_MM : FLOATING_BOTTOM_MM;

/**
 * Datos para el render 3D (coordenadas en mm: x ancho, y fondo con el frente en y=0, z alto).
 * Sale de las mismas piezas del despiece; las jaladeras son ilustrativas (posición típica, no plantilla).
 */
export function renderModel(project: Project, calc: ProjectCalculation, catalog: Catalog = DEFAULT_CATALOG, finishOverride?: string): RenderModel {
  const finishes = new Map(catalog.finishes.map((f) => [f.id, f]));
  const boxes: RenderBox[] = [];
  let wallMounted = false;
  for (const m of calc.modules) {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    if (spec?.mount === 'wall') wallMounted = true;
    const all = m.parts.flatMap((p) => p.placements);
    const midX = all.length ? (Math.min(...all.map((b) => b.x0)) + Math.max(...all.map((b) => b.x1))) / 2 : 0;
    const lift = liftFor(spec);
    const move = (b: Box3): Box3 => ({ x0: b.x0 + m.offsetXMm, x1: b.x1 + m.offsetXMm, y0: b.y0 + m.offsetYMm, y1: b.y1 + m.offsetYMm, z0: b.z0 + lift, z1: b.z1 + lift });
    for (const p of m.parts) {
      const fin = finishes.get(finishOverride ?? p.finishId) ?? catalog.finishes[0]!;
      const material: RenderMaterial =
        p.role === 'back' ? { color: '#d9d4cb', grain: false, kind: 'back' }
        : p.role === 'drawer_box' ? { color: '#e4dccb', grain: false, kind: 'drawer' }
        : { color: fin.colors.front, grain: fin.hasGrain && p.grainAxis !== 'none', kind: 'board' };
      p.placements.forEach((pl, i) => {
        const ext = { x: pl.x1 - pl.x0, y: pl.y1 - pl.y0, z: pl.z1 - pl.z0 };
        const target = p.grainAxis === 'width' ? p.widthMm : p.lengthMm;
        const grainDir = material.grain ? (['x', 'y', 'z'] as const).reduce((best, a) => Math.abs(ext[a] - target) < Math.abs(ext[best] - target) ? a : best, 'z' as 'x' | 'y' | 'z') : null;
        boxes.push({ key: `${p.id}#${i + 1}`, partId: p.id, role: p.role, b: move(pl), material, grainDir });
        // Jaladera ilustrativa
        if (p.role !== 'front' || !spec) return;
        const handle: RenderMaterial = { color: '#b8bec4', grain: false, kind: 'handle' };
        const y0 = pl.y0 - HANDLE_OUT, y1 = pl.y0;
        const w = pl.x1 - pl.x0, h = pl.z1 - pl.z0;
        let hb: Box3;
        if (p.code.startsWith('DRAWER') || w > h) {
          const len = Math.min(HANDLE_LEN + 32, w * 0.5), cx = (pl.x0 + pl.x1) / 2, cz = pl.z1 - Math.min(45, h / 2);
          hb = { x0: cx - len / 2, x1: cx + len / 2, y0, y1, z0: cz - HANDLE_T / 2, z1: cz + HANDLE_T / 2 };
        } else {
          const cxDoor = (pl.x0 + pl.x1) / 2;
          // Hoja sola: jaladera a la derecha; en pares, del lado que abre hacia el centro del módulo.
          const x = cxDoor <= midX + 1 ? pl.x1 - 40 : pl.x0 + 40;
          const high = pl.z1 > 1500 && spec.mount !== 'wall' ? pl.z0 + Math.min(1050, h / 2) : spec.mount === 'wall' ? pl.z0 + 70 + HANDLE_LEN / 2 : pl.z1 - 70 - HANDLE_LEN / 2;
          const len = Math.min(HANDLE_LEN, h * 0.4);
          hb = { x0: x - HANDLE_T / 2, x1: x + HANDLE_T / 2, y0, y1, z0: high - len / 2, z1: high + len / 2 };
        }
        boxes.push({ key: `${p.id}#${i + 1}-jaladera`, partId: p.id, role: 'handle', b: move(hb), material: handle, grainDir: null });
      });
    }
  }
  // Tiras LED: difusor al ras de la cara fresada
  for (const r of calc.ledRuns) {
    const m = calc.modules.find((x) => x.moduleId === r.moduleId);
    const spec = project.modules.find((s) => s.id === r.moduleId);
    if (!m) continue;
    const lift = liftFor(spec);
    const hw = r.grooveWidthMm / 2 - 1.5;
    const ox = m.offsetXMm, oy = m.offsetYMm;
    const vertical = r.a[2] !== r.b[2];
    const t = 0.8 * Math.sign(r.lightDir[0] || r.lightDir[2] || 1);
    const b: Box3 = vertical
      ? { x0: Math.min(r.a[0], r.a[0] + t) + ox, x1: Math.max(r.a[0], r.a[0] + t) + ox, y0: r.a[1] - hw + oy, y1: r.a[1] + hw + oy, z0: r.a[2] + lift, z1: r.b[2] + lift }
      : { x0: r.a[0] + ox, x1: r.b[0] + ox, y0: r.a[1] - hw + oy, y1: r.a[1] + hw + oy, z0: r.a[2] - 0.8 + lift, z1: r.a[2] + lift };
    boxes.push({ key: r.id, partId: r.partId, role: 'led', b, material: { color: '#ffe2a8', grain: false, kind: 'led' }, grainDir: null, lightDir: r.lightDir });
  }
  // Herrería: patas y largueros esquemáticos
  for (const m of calc.modules) {
    const spec = project.modules.find((s) => s.id === m.moduleId);
    if (!spec) continue;
    for (const req of m.steel) {
      const sec = parseFloat(req.sectionSpec) || 25.4;
      const leg = req.pieces.find((x) => x.label === 'Pata');
      if (!leg) continue;
      const desk = req.id.endsWith('STEEL-DESK');
      const inset = desk ? 50 : 0;
      const W = spec.widthMm, D = desk ? spec.depthMm : (m.carcassDepthMm ?? spec.depthMm);
      const y0 = desk ? 0 : (spec.front === 'open' ? 0 : spec.thicknessMm);
      const xs = [inset, W - inset - sec], ys = [y0 + inset, y0 + D - inset - sec];
      const steel: RenderMaterial = { color: spec.steel.finish === 'none' ? '#8e969c' : '#2b2f33', grain: false, kind: 'steel' };
      const add = (key: string, b: Box3) => boxes.push({ key, partId: req.id, role: 'steel', material: steel, grainDir: null, b: { x0: b.x0 + m.offsetXMm, x1: b.x1 + m.offsetXMm, y0: b.y0 + m.offsetYMm, y1: b.y1 + m.offsetYMm, z0: b.z0, z1: b.z1 } });
      let k = 0;
      for (const x of xs) for (const y of ys) add(`${req.id}-L${++k}`, { x0: x, x1: x + sec, y0: y, y1: y + sec, z0: 0, z1: leg.lengthMm });
      const zt = leg.lengthMm;
      add(`${req.id}-RF`, { x0: inset + sec, x1: W - inset - sec, y0: ys[0]!, y1: ys[0]! + sec, z0: zt - sec, z1: zt });
      add(`${req.id}-RB`, { x0: inset + sec, x1: W - inset - sec, y0: ys[1]!, y1: ys[1]! + sec, z0: zt - sec, z1: zt });
    }
  }
  const bs = boxes.map((x) => x.b);
  const bounds = bs.length
    ? { x0: Math.min(...bs.map((b) => b.x0)), x1: Math.max(...bs.map((b) => b.x1)), y0: Math.min(...bs.map((b) => b.y0)), y1: Math.max(...bs.map((b) => b.y1)), z0: Math.min(...bs.map((b) => b.z0)), z1: Math.max(...bs.map((b) => b.z1)) }
    : { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
  return { boxes, bounds, wallMounted };
}
