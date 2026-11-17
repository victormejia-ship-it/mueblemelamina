import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, createModule, createProject, planProject } from '@ms/domain';
import { assemblyGuide, cutPlanSvg } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const NOW = '2026-11-17T00:00:00.000Z';

describe('plan de corte en un solo diagrama', () => {
  it('incluye todos los tableros de todos los materiales, numera piezas y marca sobrantes', () => {
    const p = createProject({ id: 'c', name: 'Cocina', familyId: 'kitchen_base', now: NOW }, cat);
    for (const id of ['M02', 'M03', 'M04']) p.modules.push(createModule('kitchen_base', cat, id));
    const plan = planProject(p, cat, [], '2026-11-17', NOW);
    const svg = cutPlanSvg(plan.nesting, plan.calc.parts, { title: 'Cocina' });
    expect(svg.match(/<svg/g)).toHaveLength(1);
    const sheets = plan.nesting.reduce((s, n) => s + (n.layout?.sheets.length ?? 0), 0);
    expect(sheets).toBeGreaterThan(1);
    expect((svg.match(/>Tablero \d+ de \d+</g) ?? []).length).toBe(sheets);
    // Una entrada de leyenda por modelo de pieza colocado
    const placed = new Set(plan.nesting.flatMap((n) => n.layout?.sheets.flatMap((s) => s.placements.map((x) => x.partId)) ?? []));
    for (const id of placed) expect(svg).toContain(`data-part-id="${id.replace('SIDE', 'COSTADO').replace('HORIZONTAL', 'TAPA_PISO').replace('BACK', 'RESPALDO').replace('SHELF', 'ENTREPAÑO').replace('DOOR', 'PUERTA')}"`);
    expect(svg).toMatch(/Sobrante/);
    expect(svg).not.toMatch(/\b(SIDE|HORIZONTAL|DOOR)\b/);
    // Sobrantes sin encimarse con piezas
    for (const n of plan.nesting) for (const s of n.layout?.sheets ?? []) for (const o of s.offcuts) for (const q of s.placements) {
      const overlap = o.x < q.x + q.w && o.x + o.w > q.x && o.y < q.y + q.h && o.y + o.h > q.y;
      expect(overlap).toBe(false);
    }
  });

  it('material que ocupa poco: sugiere retazo', () => {
    const p = createProject({ id: 'f', name: 'Flotante', familyId: 'floating_drawer', now: NOW }, cat);
    const plan = planProject(p, cat, [], '2026-11-17', NOW);
    expect(cutPlanSvg(plan.nesting, plan.calc.parts)).toMatch(/basta un retazo de \d+ × \d+ mm/);
  });
});

describe('instructivo de armado ilustrado', () => {
  it('cada paso tiene dibujo con piezas resaltadas y flecha; el último muestra el mueble completo', () => {
    const p = createProject({ id: 'a', name: 'Bajo con cajón', familyId: 'kitchen_base_drawer', now: NOW }, cat);
    const plan = planProject(p, cat, [], '2026-11-17', NOW);
    const g = assemblyGuide(p, plan.calc);
    expect(g.length).toBeGreaterThanOrEqual(6);
    expect(g.map((s) => s.number)).toEqual(g.map((_, i) => i + 1));
    for (const s of g.slice(0, -1)) {
      expect(s.svg).toContain('#eba24f'); // piezas que se colocan
      expect(s.svg).toContain('url(#ms-push)'); // flecha
    }
    const last = g.at(-1)!;
    expect(last.svg).not.toContain('#eba24f');
    // Todas las piezas aparecen en algún paso
    const shown = (last.svg.match(/data-part-id="([^"]+)"/g) ?? []).map((x) => x.slice(14, -1));
    for (const part of plan.calc.parts) expect(shown.some((x) => x === part.id), part.id).toBe(true);
    expect(g.some((s) => s.hardware.some((h) => /excéntricos/.test(h)))).toBe(true);
    expect(g.some((s) => s.tip && /diagonales/.test(s.tip))).toBe(true);
  });

  it('escritorio y proyectos de varios módulos', () => {
    const p = createProject({ id: 'd', name: 'Escritorio', familyId: 'desk', now: NOW }, cat);
    p.modules.push(createModule('dresser', cat, 'M02'));
    const g = assemblyGuide(p, planProject(p, cat, [], '2026-11-17', NOW).calc);
    expect(new Set(g.map((s) => s.moduleId))).toEqual(new Set(['M01', 'M02']));
    expect(g.filter((s) => s.moduleId === 'M01').map((s) => s.title)).toContain('Coloca la cubierta');
  });
});
