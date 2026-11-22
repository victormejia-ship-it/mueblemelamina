import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, FAMILIES, calculateProject, createProject, marketEstimate, parseProject, planProject } from '@ms/domain';
import { assemblyGuide, buildScene } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const NOW = '2026-11-22T00:00:00.000Z';
const make = (family: string) => {
  const p = createProject({ id: 'f', name: 'Abatible', familyId: family, now: NOW }, cat);
  return { p, c: calculateProject(p, cat) };
};

describe('muebles abatibles (ahorra espacio)', () => {
  it('escritorio, cama y mesa abatibles en la categoría «Ahorra espacio», sin errores', () => {
    for (const id of ['fold_desk', 'fold_bed', 'fold_table']) {
      expect(FAMILIES.find((f) => f.id === id)?.category, id).toBe('space');
      const { c } = make(id);
      expect(c.issues.filter((i) => i.severity === 'error'), id).toEqual([]);
      expect(c.modules[0]!.checks.filter((k) => k.status === 'error'), id).toEqual([]);
      expect(c.parts.filter((x) => x.code === 'FOLD_LEAF').length, id).toBe(1);
    }
  });

  it('cerrado ocupa poco; abierto: escritorio a ~75 cm y mesa a ~74 cm del piso', () => {
    const desk = make('fold_desk').c.modules[0]!.fold!;
    expect(desk.closedDepthMm).toBe(300);
    expect(desk.openDepthMm).toBeGreaterThan(900);
    expect(desk.surfaceHeightMm).toBeGreaterThanOrEqual(730);
    expect(desk.surfaceHeightMm).toBeLessThanOrEqual(770);
    const table = make('fold_table').c.modules[0]!.fold!;
    expect(table.closedDepthMm).toBe(140);
    expect(table.surfaceHeightMm).toBeGreaterThanOrEqual(720);
    expect(table.surfaceHeightMm).toBeLessThanOrEqual(760);
  });

  it('cama: sin divisores, base ≥ 1.95 m, mecanismo de pistones, patas y anclaje obligatorio', () => {
    const { c } = make('fold_bed');
    expect(c.parts.some((x) => x.code === 'DIVIDER')).toBe(false);
    const leaf = c.parts.find((x) => x.code === 'FOLD_LEAF')!;
    expect(leaf.widthMm).toBeGreaterThanOrEqual(1950);
    expect(c.hardware.some((h) => h.productKey === 'hw:bed_mechanism')).toBe(true);
    expect(c.hardware.find((h) => h.productKey === 'hw:bed_leg')!.quantity).toBe(2);
    expect(c.issues.some((i) => i.code === 'FOLD_BED_VALIDATION' && i.severity === 'blocker')).toBe(true);
    expect(c.issues.some((i) => i.code === 'ANTITIP_REQUIRED')).toBe(true);
  });

  it('escritorio: bisagras inferiores, compases y cierre magnético', () => {
    const { c } = make('fold_desk');
    expect(c.hardware.find((h) => h.productKey === 'hw:fold_hinge')!.quantity).toBe(3);
    expect(c.hardware.find((h) => h.productKey === 'hw:lid_stay')!.quantity).toBe(2);
    expect(c.hardware.some((h) => h.productKey === 'hw:magnet_catch')).toBe(true);
  });

  it('planos: silueta punteada de cómo queda abierto; instructivo y precio', () => {
    const { p, c } = make('fold_desk');
    const scene = buildScene(p, c, cat, { view: 'iso', exploded: false, showIds: false, hideFronts: false });
    expect(scene.lines.filter((l) => l.kind === 'open')).toHaveLength(4);
    expect(scene.labels.some((l) => /^Abierto: \d+ cm del muro$/.test(l.text))).toBe(true);
    expect(assemblyGuide(p, c).map((s) => s.title)).toContain('Coloca el frente abatible');
    const e = marketEstimate(p, planProject(p, cat, [], '2026-11-22', NOW), cat);
    expect(e.labor.some((l) => l.id === 'abatible')).toBe(true);
    expect(e.market!.breakdown.some((b) => /Escritorio abatible/.test(b.label))).toBe(true);
    expect(e.materials.some((m) => m.key === 'hw:lid_stay' && m.source === 'referencia')).toBe(true);
  });

  it('cualquier mueble puede usar frente abatible; proyectos viejos se abren con «escritorio»', () => {
    const p = createProject({ id: 'b', name: 'Librero', familyId: 'bookcase', now: NOW }, cat);
    p.modules[0]!.front = 'fold_down';
    p.modules[0]!.widthMm = 900;
    expect(calculateProject(p, cat).parts.some((x) => x.code === 'FOLD_LEAF')).toBe(true);
    const raw = JSON.parse(JSON.stringify(createProject({ id: 'o', name: 'x', familyId: 'kitchen_base', now: NOW }, cat)));
    delete raw.modules[0].foldKind;
    expect(parseProject(raw).modules[0]!.foldKind).toBe('desk');
  });
});
