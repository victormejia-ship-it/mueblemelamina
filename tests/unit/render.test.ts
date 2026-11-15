import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, calculateProject, createProject } from '@ms/domain';
import { renderModel } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const p = createProject({ id: 'r', name: 'Render', familyId: 'kitchen_base', now: '2026-01-01T00:00:00.000Z' }, cat);
const calc = calculateProject(p, cat);

describe('modelo para render', () => {
  it('incluye cada colocación de pieza y una jaladera por frente', () => {
    const rm = renderModel(p, calc, cat);
    const placements = calc.parts.reduce((s, x) => s + x.placements.length, 0);
    const fronts = calc.parts.filter((x) => x.role === 'front').reduce((s, x) => s + x.placements.length, 0);
    expect(rm.boxes.filter((b) => b.role !== 'handle' && b.role !== 'steel')).toHaveLength(placements);
    expect(rm.boxes.filter((b) => b.role === 'handle')).toHaveLength(fronts);
    // La jaladera queda delante del frente y dentro de su ancho y alto
    for (const h of rm.boxes.filter((b) => b.role === 'handle')) {
      const door = rm.boxes.find((b) => b.key === h.key.replace(/-jaladera$/, ''))!;
      expect(h.b.y1).toBeCloseTo(door.b.y0);
      expect(h.b.x0).toBeGreaterThanOrEqual(door.b.x0);
      expect(h.b.x1).toBeLessThanOrEqual(door.b.x1);
      expect(h.b.z0).toBeGreaterThanOrEqual(door.b.z0);
      expect(h.b.z1).toBeLessThanOrEqual(door.b.z1);
    }
  });
  it('en pares, las jaladeras quedan hacia el centro', () => {
    const hs = renderModel(p, calc, cat).boxes.filter((b) => b.role === 'handle' && b.key.includes('DOOR'));
    if (hs.length === 2) {
      const [a, b] = hs.sort((x, y) => x.b.x0 - y.b.x0);
      expect(b!.b.x0 - a!.b.x1).toBeLessThan(200);
    }
  });
  it('acabado con veta: dirección de veta según el largo de la pieza', () => {
    const rm = renderModel(p, calc, cat, 'roble');
    const side = rm.boxes.find((b) => b.key.includes('SIDE'))!;
    expect(side.material.grain).toBe(true);
    expect(side.grainDir).toBe('z');
    expect(rm.boxes.find((b) => b.role === 'back')!.material.grain).toBe(false);
    expect(renderModel(p, calc, cat, 'blanco').boxes.every((b) => b.grainDir === null)).toBe(true);
  });
});

describe('render de aéreos', () => {
  it('el gabinete aéreo se eleva a la altura de referencia', () => {
    const w = createProject({ id: 'w', name: 'Aéreo', familyId: 'kitchen_wall', now: '2026-01-01T00:00:00.000Z' }, cat);
    const rm = renderModel(w, calculateProject(w, cat), cat);
    expect(rm.wallMounted).toBe(true);
    expect(Math.min(...rm.boxes.map((b) => b.b.z0))).toBeGreaterThanOrEqual(1450);
  });
});
