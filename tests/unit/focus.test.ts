import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, EQUIPMENT, STATIONS, calculateProject, createProject, equipmentFocus, stationFocus } from '@ms/domain';
import { buildScene, sceneToSvg } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const p = createProject({ id: 'f', name: 'Foco', familyId: 'kitchen_base', now: '2026-01-01T00:00:00.000Z' }, cat);
const calc = calculateProject(p, cat);

describe('enfoque del equipo en el modelo', () => {
  it('cada equipo da un enfoque con ids de piezas existentes', () => {
    const ids = new Set([...calc.parts.map((x) => x.id), ...calc.steel.map((s) => s.id)]);
    for (const e of EQUIPMENT) {
      const f = equipmentFocus(e.id, calc);
      expect(f.note.length, e.id).toBeGreaterThan(0);
      for (const id of f.partIds) expect(ids.has(id), `${e.id}:${id}`).toBe(true);
      if (!f.empty) expect(f.partIds.length, e.id).toBeGreaterThan(0);
    }
  });
  it('canteadora resalta sólo piezas con canto y dibuja aristas', () => {
    const f = equipmentFocus('canteadora', calc);
    expect(f.edges).toBe(true);
    for (const id of f.partIds) expect(Object.keys(calc.parts.find((x) => x.id === id)!.edgeBand).length).toBeGreaterThan(0);
    const scene = buildScene(p, calc, cat, { view: 'iso', exploded: false, showIds: false, hideFronts: false, focus: f });
    expect(scene.lines.filter((l) => l.kind === 'edge').length).toBeGreaterThan(0);
    expect(scene.polygons.some((x) => x.dim)).toBe(true);
    expect(sceneToSvg(scene)).toContain('#ff9f43');
  });
  it('taladro etiqueta cazoletas por pieza a partir del maquinado', () => {
    const f = equipmentFocus('taladro-banco', calc);
    const cups = calc.machining.filter((o) => o.patternId === 'hinge-cup-35');
    if (cups.length) expect(Object.values(f.labels).join(' ')).toMatch(/cazoleta/);
    expect(f.partIds.every((id) => calc.machining.some((o) => o.partId === id))).toBe(true);
  });
  it('medidor de diagonales dibuja diagonales con su medida teórica', () => {
    const scene = buildScene(p, calc, cat, { view: 'iso', exploded: false, showIds: false, hideFronts: false, focus: equipmentFocus('medidor-diagonales', calc) });
    expect(scene.lines.filter((l) => l.kind === 'diag').length).toBeGreaterThanOrEqual(2);
    expect(scene.labels.some((l) => /diagonal \d+/.test(l.text))).toBe(true);
  });
  it('herrería vacía en un mueble sin PTR; estación une enfoques', () => {
    expect(equipmentFocus('soldadora', calc).empty).toBe(true);
    const st = STATIONS.find((s) => s.id === 'canteado')!;
    const f = stationFocus(st.id, EQUIPMENT.filter((e) => e.station === st.id).map((e) => e.id), calc);
    expect(f.empty).toBe(false);
    expect(f.edges).toBe(true);
  });
});
