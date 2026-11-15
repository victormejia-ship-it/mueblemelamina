import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, EQUIPMENT, STATIONS, createModule, createProject, parseCsv, planProject, workshopRoute, type ModuleSpec } from '@ms/domain';
import { routeDiagramSvg } from '@ms/geometry';
import { buildPdf, toolsCsv } from '@ms/export';

const cat = DEFAULT_CATALOG;
const NOW = '2026-01-01T00:00:00.000Z';
function route(mods: ModuleSpec[]) {
  const p = createProject({ id: 'p', name: 'Cocina <prueba> & "taller"', familyId: 'kitchen_base', now: NOW }, cat);
  p.modules = mods;
  const plan = planProject(p, cat, [], '2026-01-01', NOW);
  return { p, plan, r: workshopRoute(p, plan, cat) };
}
const ids = (r: ReturnType<typeof route>['r']) => r.stations.map((s) => s.id);
const needOf = (r: ReturnType<typeof route>['r'], id: string) => r.equipment.find((e) => e.item.id === id)?.need;

describe('catálogo de equipo', () => {
  it('cada equipo es completo y pertenece a una estación existente', () => {
    for (const e of EQUIPMENT) {
      expect(STATIONS.some((s) => s.id === e.station), e.id).toBe(true);
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.safety.length, e.id).toBeGreaterThan(0);
      expect(e.qualityChecks.length, e.id).toBeGreaterThan(0);
    }
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
    for (const s of STATIONS) expect(EQUIPMENT.some((e) => e.station === s.id), s.id).toBe(true);
  });
});

describe('ruta de taller por proyecto', () => {
  it('gabinete con puertas: estaciones, cifras y equipo coinciden con el cálculo', () => {
    const { r, plan } = route([{ ...createModule('kitchen_base', cat, 'M01'), front: 'doors' }]);
    expect(ids(r)).toEqual(['preparacion', 'corte', 'canteado', 'mecanizado', 'armado', 'frentes', 'calidad', 'empaque', 'instalacion']);
    expect(r.stations.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const s of r.stations) for (const id of s.equipmentIds) expect(EQUIPMENT.some((e) => e.id === id), id).toBe(true);
    const corte = r.stations.find((s) => s.id === 'corte')!;
    expect(corte.metrics[0]!.value).toBe(`${plan.calc.totals.panelCount} (${plan.calc.totals.partModels} modelos)`);
    const mec = r.stations.find((s) => s.id === 'mecanizado')!;
    // Una cazoleta por bisagra: operaciones por modelo × cantidad de piezas del modelo
    const hinges = plan.calc.hardware.filter((h) => h.category === 'hinge').reduce((n, h) => n + h.quantity, 0);
    expect(mec.metrics.find((m) => m.label === 'Cazoletas Ø35')!.value).toBe(String(hinges));
    expect(mec.alerts[0]).toMatch(/NO perforar/);
    expect(r.stations.find((s) => s.id === 'frentes')!.metrics[0]!.value).toBe('4');
    expect(needOf(r, 'canteadora')).toBe('esencial');
    expect(needOf(r, 'tronzadora')).toBeUndefined();
    expect(needOf(r, 'medidor-diagonales')).toBe('esencial');
    expect(r.equipment.find((e) => e.item.id === 'medidor-diagonales')!.projectSettings[0]).toBe(`M01: ${plan.calc.modules[0]!.theoreticalDiagonalMm} mm teórica`);
  });

  it('escritorio con PTR agrega herrería en paralelo y su equipo', () => {
    const { r } = route([{ ...createModule('desk', cat, 'D'), steel: { enabled: true, profileId: 'ptr1x1c14', legHeightMm: 0, finish: 'powder_coating' } }]);
    const h = r.stations.find((s) => s.id === 'herreria')!;
    expect(h.parallel).toBe(true);
    expect(h.alerts[0]).toMatch(/validación de cargas/);
    expect(needOf(r, 'tronzadora')).toBe('esencial');
    expect(needOf(r, 'soldadora')).toBe('esencial');
  });

  it('sin cantos no hay canteado; módulo a muro exige rotomartillo; módulos pesados piden dos personas', () => {
    const { r } = route([{ ...createModule('kitchen_wall', cat, 'A'), edgePolicy: 'none' }, { ...createModule('wardrobe', cat, 'C'), edgePolicy: 'none' }]);
    expect(ids(r)).not.toContain('canteado');
    expect(needOf(r, 'canteadora')).toBeUndefined();
    expect(needOf(r, 'rotomartillo')).toBe('esencial');
    expect(r.stations.find((s) => s.id === 'empaque')!.alerts[0]).toMatch(/dos personas/);
  });
});

describe('diagramas y exportaciones de taller', () => {
  it('SVG de la ruta: válido, escapado y con cada estación', () => {
    const { r, p } = route([{ ...createModule('kitchen_base', cat, 'M01'), front: 'doors' }]);
    const svg = routeDiagramSvg(r, p.name);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('&lt;prueba&gt; &amp; &quot;taller&quot;');
    for (const s of r.stations) expect(svg).toContain(s.name);
    expect(svg.match(/marker-end/g)!.length).toBe(r.stations.length - 1);
  });

  it('CSV de herramientas y PDF con la ruta', async () => {
    const { r, p, plan } = route([{ ...createModule('kitchen_base', cat, 'M01'), front: 'doors' }]);
    const rows = parseCsv(toolsCsv(r, ';'));
    expect(rows.length - 1).toBe(r.equipment.length);
    expect(rows[1]![1]).toBe(r.equipment[0]!.item.name);
    const pdf = await buildPdf(p, plan, cat, NOW);
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
