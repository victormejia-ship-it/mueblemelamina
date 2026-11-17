import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, ENGINE_DEFAULTS, calculateProject, createProject, parseProject, type ModuleSpec } from '@ms/domain';
import { buildScene } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const NOW = '2026-11-17T00:00:00.000Z';
const calc = (family: string, patch: Partial<ModuleSpec> = {}) => {
  const p = createProject({ id: 'd', name: 'Cajones', familyId: family, now: NOW }, cat);
  Object.assign(p.modules[0]!, patch);
  return { p, c: calculateProject(p, cat) };
};
const fronts = (c: ReturnType<typeof calc>['c']) => c.parts.filter((x) => x.code.startsWith('DRAWER_FRONT')).flatMap((x) => x.placements.map((pl) => ({ code: x.code, h: x.widthMm, z0: pl.z0 })));

describe('cajones', () => {
  it('cómoda graduada: más chicos arriba, alturas enteras y la columna cuadra', () => {
    const { p, c } = calc('dresser');
    const f = fronts(c).sort((a, b) => a.z0 - b.z0);
    expect(f).toHaveLength(4);
    for (let i = 1; i < f.length; i++) expect(f[i]!.h).toBeLessThan(f[i - 1]!.h);
    const m = p.modules[0]!;
    const sum = f.reduce((s, x) => s + x.h, 0) + 3 * m.frontGapMm;
    expect(sum).toBeCloseTo(m.heightMm - 2 * m.revealMm, 1);
    // Cada alto tiene su caja: 4 juegos de costados, frente/trasera y fondo
    expect(c.parts.filter((x) => x.code.startsWith('DRAWER_SIDE')).reduce((s, x) => s + x.quantity, 0)).toBe(8);
    expect(c.parts.filter((x) => x.code.startsWith('DRAWER_BOTTOM')).reduce((s, x) => s + x.quantity, 0)).toBe(4);
    expect(c.issues.some((i) => i.severity === 'error')).toBe(false);
    expect(c.modules[0]!.checks.filter((k) => k.status === 'error')).toEqual([]);
  });

  it('cajón arriba + puertas: travesaño, entrepaño bajo el travesaño y alto cubierto', () => {
    const { p, c } = calc('kitchen_base_drawer');
    const m = p.modules[0]!;
    const drawer = c.parts.find((x) => x.code === 'DRAWER_FRONT')!;
    const door = c.parts.find((x) => x.code === 'DOOR')!;
    const rail = c.parts.find((x) => x.code === 'DRAWER_RAIL')!;
    const shelf = c.parts.find((x) => x.code === 'SHELF')!;
    expect(drawer.widthMm).toBe(ENGINE_DEFAULTS.topDrawerFrontMm);
    expect(drawer.placements[0]!.z0).toBeGreaterThan(door.placements[0]!.z1);
    expect(rail.placements[0]!.z1).toBeLessThanOrEqual(drawer.placements[0]!.z0 + m.thicknessMm);
    expect(shelf.placements[0]!.z1).toBeLessThanOrEqual(rail.placements[0]!.z0);
    // La caja del cajón queda encima del travesaño
    const box = c.parts.find((x) => x.code === 'DRAWER_BOTTOM')!;
    expect(box.placements[0]!.z0).toBeGreaterThanOrEqual(rail.placements[0]!.z1);
    expect(door.lengthMm + drawer.widthMm + m.frontGapMm).toBeCloseTo(m.heightMm - 2 * m.revealMm, 1);
    expect(c.issues.some((i) => i.severity === 'error')).toBe(false);
    expect(c.hardware.some((h) => h.category === 'hinge')).toBe(true);
    expect(c.hardware.some((h) => h.category === 'drawer_slide')).toBe(true);
  });

  it('cajón flotante: a muro, sin base y con su caja', () => {
    const { p, c } = calc('floating_drawer');
    expect(p.modules[0]!.mount).toBe('wall');
    expect(p.modules[0]!.baseType).toBe('none');
    expect(c.parts.some((x) => x.code === 'DRAWER_SIDE')).toBe(true);
    expect(c.issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('proyectos guardados sin «drawerLayout» se abren con cajones iguales', () => {
    const { p } = calc('dresser');
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.modules[0].drawerLayout;
    expect(parseProject(raw).modules[0]!.drawerLayout).toBe('equal');
  });
});

describe('etiquetas de ID', () => {
  it('no se enciman y no etiquetan piezas tapadas', () => {
    const { p, c } = calc('dresser');
    const scene = buildScene(p, c, cat, { view: 'iso', exploded: false, showIds: true, hideFronts: false });
    const ids = scene.labels.filter((l) => l.kind === 'id');
    expect(ids.length).toBeGreaterThan(3);
    // Los costados de caja de cajón quedan detrás de los frentes: no se etiquetan
    expect(ids.some((l) => l.text.startsWith('DRAWER_SIDE'))).toBe(false);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!, b = ids[j]!;
      const overlapX = Math.abs(a.x - b.x) < (a.text.length + b.text.length) * 3.05 + 6;
      const overlapY = Math.abs(a.y - b.y) < 14;
      expect(overlapX && overlapY, `${a.text} / ${b.text}`).toBe(false);
    }
    // Sin frentes, las cajas de cajón sí aparecen
    const open = buildScene(p, c, cat, { view: 'iso', exploded: false, showIds: true, hideFronts: true });
    expect(open.labels.some((l) => l.kind === 'id' && l.text.startsWith('DRAWER'))).toBe(true);
  });
});
