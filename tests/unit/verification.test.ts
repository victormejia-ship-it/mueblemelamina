import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG, DEFAULT_MANUFACTURING, FAMILIES, calculateModule, calculateProject, createModule, createProject, cutDimensions, nestParts, panelWeightKg, parseProject, shelfSag,
  type ModuleSpec,
} from '@ms/domain';

const cat = DEFAULT_CATALOG;
const NOW = '2026-01-01T00:00:00.000Z';
const base = (o: Partial<ModuleSpec> = {}): ModuleSpec => ({ ...createModule('kitchen_base', cat, 'M01'), front: 'doors', ...o });
const part = (r: ReturnType<typeof calculateModule>, code: string) => r.parts.find((p) => p.code === code)!;
const check = (r: ReturnType<typeof calculateModule>, label: RegExp) => r.checks.find((c) => label.test(c.label))!;

describe('medidas de corte con compensación de canto', () => {
  it('caso calculado a mano: gabinete bajo 800×720×580, melamina 18, HDF 3, canto 0.45', () => {
    const r = calculateModule(base(), cat);
    expect(r.carcassDepthMm).toBe(559); // 580 − 3 − 18
    expect([part(r, 'SIDE').lengthMm, part(r, 'SIDE').widthMm, part(r, 'SIDE').cutWidthMm]).toEqual([720, 559, 558.55]);
    expect([part(r, 'HORIZONTAL').lengthMm, part(r, 'HORIZONTAL').cutLengthMm, part(r, 'HORIZONTAL').cutWidthMm]).toEqual([764, 764, 558.55]);
    const door = part(r, 'DOOR');
    expect([door.lengthMm, door.widthMm, door.cutLengthMm, door.cutWidthMm]).toEqual([716, 396.5, 715.1, 395.6]);
    expect([part(r, 'BACK').cutLengthMm, part(r, 'BACK').cutWidthMm]).toEqual([720, 800]);
    expect([part(r, 'SHELF').lengthMm, part(r, 'SHELF').widthMm]).toEqual([762, 554]);
  });

  it('L1/L2 reducen el ancho, A1/A2 el largo; repasado suma', () => {
    const s = { edgeCompensation: true, premillMm: 0 };
    expect(cutDimensions(700, 400, ['L1'], 2, s)).toEqual({ cutLengthMm: 700, cutWidthMm: 398 });
    expect(cutDimensions(700, 400, ['A1', 'A2'], 2, s)).toEqual({ cutLengthMm: 696, cutWidthMm: 400 });
    expect(cutDimensions(700, 400, ['L1', 'L2', 'A1', 'A2'], 2, { edgeCompensation: true, premillMm: 0.5 })).toEqual({ cutLengthMm: 697, cutWidthMm: 397 });
    expect(cutDimensions(700, 400, ['L1', 'L2', 'A1', 'A2'], 2, { edgeCompensation: false, premillMm: 0 })).toEqual({ cutLengthMm: 700, cutWidthMm: 400 });
  });

  it('canto de 2 mm: la puerta se corta 4 mm menor por lado y el armado conserva la medida', () => {
    const r = calculateModule(base({ edgeBandId: 'pvc22x2' }), cat);
    const d = part(r, 'DOOR');
    expect([d.cutLengthMm, d.cutWidthMm]).toEqual([712, 392.5]);
    expect(check(r, /^Ancho exterior/).status).toBe('ok');
  });

  it('sin compensación con canto grueso se advierte', () => {
    const r = calculateModule(base({ edgeBandId: 'pvc22x2' }), cat, 0, { ...DEFAULT_MANUFACTURING, edgeCompensation: false });
    expect(part(r, 'DOOR').cutWidthMm).toBe(396.5);
    expect(r.issues.map((i) => i.code)).toContain('EDGE_COMPENSATION_OFF');
  });

  it('el acomodo de corte usa la medida de corte', () => {
    const r = calculateModule(base({ edgeBandId: 'pvc22x2' }), cat);
    const n = nestParts(r.parts, cat, { kerfMm: 4, trimMarginMm: 10 }).find((x) => x.materialId === 'mel18')!;
    const placed = n.layout!.sheets.flatMap((s) => s.placements).filter((p) => p.partId === 'M01-DOOR');
    expect(placed.every((p) => [p.w, p.h].sort().join() === [712, 392.5].sort().join())).toBe(true);
  });
});

describe('verificación dimensional de todo el catálogo', () => {
  it('todas las familias y frentes cierran en medidas, sin piezas flotantes ni desajustes', () => {
    for (const f of FAMILIES) {
      for (const front of ['open', 'doors', 'drawers'] as const) {
        const r = calculateModule({ ...createModule(f.id, cat, 'X'), front, drawerCount: 3, slideProductId: 'slide-generic-telescopic' }, cat);
        expect(r.issues.filter((i) => i.severity === 'error'), `${f.id}/${front}`).toEqual([]);
        const bad = r.checks.filter((c) => c.status === 'error' || c.status === 'warning').map((c) => `${c.label}: ${c.actual}`);
        expect(bad, `${f.id}/${front}`).toEqual([]);
        expect(r.checks.filter((c) => c.category === 'cierre').length, `${f.id}/${front}`).toBeGreaterThanOrEqual(4);
        expect(r.weightKg).toBeGreaterThan(0);
      }
    }
  });

  it('con bastidor de PTR (escritorio y base) la altura cierra como pata + tablero', () => {
    const desk = calculateModule({ ...createModule('desk', cat, 'D'), steel: { enabled: true, profileId: 'ptr1x1c14', legHeightMm: 0, finish: 'powder_coating' } }, cat);
    expect(desk.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(check(desk, /Alto total con bastidor/).actual).toBe('732 + 18 = 750 mm');
    const box = calculateModule(base({ baseType: 'steel_frame', baseHeightMm: 150 }), cat);
    expect(box.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(check(box, /Alto total con bastidor/).status).toBe('ok');
  });

  it('respaldo mayor al tablero se divide con juntas sobre divisores (o con listón si no hay divisor)', () => {
    const r = calculateModule(createModule('walkin', cat, 'W'), cat);
    const backs = r.parts.filter((p) => p.role === 'back').flatMap((p) => p.placements).sort((a, b) => a.x0 - b.x0);
    const dividers = part(r, 'DIVIDER').placements.map((b) => (b.x0 + b.x1) / 2);
    // Mínimo de piezas, cada junta sobre el centro de un divisor y cada pieza dentro del tablero útil (1200 mm)
    expect(backs.length).toBe(2);
    for (const b of backs.slice(1)) expect(dividers).toContain(b.x0);
    for (const b of backs) expect(b.x1 - b.x0).toBeLessThanOrEqual(1200);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const noDiv = calculateModule({ ...createModule('walkin', cat, 'W'), dividerCount: 0, shelvesPerBay: 0 }, cat);
    expect(noDiv.issues.map((i) => i.code)).toContain('BACK_JOINT_UNSUPPORTED');
    expect(noDiv.issues.map((i) => i.code)).not.toContain('PART_EXCEEDS_SHEET');
  });

  it('el peso es la suma de volumen × densidad', () => {
    const r = calculateModule(base(), cat);
    const sum = r.parts.reduce((s, p) => s + p.quantity * panelWeightKg(p.lengthMm, p.widthMm, p.thicknessMm, cat.materials.find((m) => m.id === p.materialId)!.densityKgM3), 0);
    expect(r.weightKg).toBeCloseTo(sum, 1);
    expect(r.weightKg).toBeCloseTo(32.46, 1);
  });
});

describe('flecha de entrepaños', () => {
  it('fórmula de viga simplemente apoyada con peso propio y fluencia', () => {
    const mel = cat.materials.find((m) => m.id === 'mel18')!;
    const s = shelfSag({ spanMm: 764, depthMm: 554, thicknessMm: 18, loadKgM2: 30, material: mel, limitRatio: 200 })!;
    expect(s.instantMm).toBeCloseTo(1.33, 1);
    expect(s.finalMm).toBeCloseTo(3.47, 1);
    expect(s.limitMm).toBeCloseTo(3.82, 2);
    expect(s.ok).toBe(true);
    expect(shelfSag({ spanMm: 764, depthMm: 554, thicknessMm: 3, loadKgM2: 30, material: cat.materials.find((m) => m.id === 'hdf3')!, limitRatio: 200 })).toBeNull();
  });

  it('librero de 900 con libros agrega divisor automático; forzado sin divisor advierte', () => {
    const auto = calculateModule(createModule('bookcase', cat, 'B'), cat);
    expect(part(auto, 'DIVIDER').quantity).toBe(1);
    const forced = calculateModule({ ...createModule('bookcase', cat, 'B'), dividerCount: 0 }, cat);
    expect(forced.issues.map((i) => i.code)).toContain('SHELF_SAG_EXCEEDED');
    expect(check(forced, /^Flecha de entrepaño/).status).toBe('warning');
  });

  it('la carga del módulo cambia el resultado', () => {
    const light = calculateModule(base({ shelfLoadKgM2: 10 }), cat);
    const heavy = calculateModule(base({ shelfLoadKgM2: 120 }), cat);
    expect(light.parts.find((p) => p.code === 'DIVIDER')).toBeUndefined();
    expect(part(heavy, 'DIVIDER').quantity).toBeGreaterThanOrEqual(1);
  });

  it('contrachapado (más rígido) necesita menos divisores que melamina', () => {
    const mel = calculateModule({ ...createModule('bookcase', cat, 'B'), widthMm: 1600 }, cat);
    const ply = calculateModule({ ...createModule('bookcase', cat, 'B'), widthMm: 1600, materialId: 'ply18' }, cat);
    expect(part(ply, 'DIVIDER').quantity).toBeLessThan(part(mel, 'DIVIDER').quantity);
  });
});

describe('frentes y herrajes', () => {
  it('puertas repartidas por hueco con juntas centradas sobre divisores', () => {
    const r = calculateModule({ ...createModule('walkin', cat, 'W'), front: 'doors' }, cat);
    const dividers = part(r, 'DIVIDER').placements.map((b) => (b.x0 + b.x1) / 2);
    const leaves = r.parts.filter((p) => p.code.startsWith('DOOR')).flatMap((p) => p.placements).sort((a, b) => a.x0 - b.x0);
    const joints = leaves.slice(1).map((d, i) => (leaves[i]!.x1 + d.x0) / 2);
    expect(joints).toEqual(dividers);
    expect(check(r, /Juntas de hojas centradas/).status).toBe('ok');
    const half = r.hardware.find((h) => h.productKey === 'hw:hinge_half_overlay_110')!;
    expect(half.quantity).toBe(5); // hoja central × 5 bisagras (alto 2196 mm)
  });

  it('número de hojas no múltiplo de huecos se advierte', () => {
    const r = calculateModule({ ...createModule('credenza', cat, 'C'), front: 'doors', doorCount: 3 }, cat);
    expect(r.issues.map((i) => i.code)).toContain('DOOR_DIVIDER_MISALIGNED');
    expect(check(r, /Juntas de hojas centradas/).status).toBe('warning');
  });

  it('holgura mayor o igual al espesor deja la abertura descubierta', () => {
    const r = calculateModule(base({ revealMm: 18 }), cat);
    expect(r.issues.map((i) => i.code)).toContain('FRONT_COVERAGE');
    expect(r.fabricable).toBe(false);
  });

  it('puerta fuera del rango de espesor de la bisagra', () => {
    const r = calculateModule(base({ thicknessMm: 25, materialId: 'mel18', edgeBandId: 'pvc22x1' }), cat);
    expect(r.issues.map((i) => i.code)).toContain('HINGE_DOOR_THICKNESS');
  });

  it('pata niveladora fuera de su rango de ajuste', () => {
    const r = calculateModule(base({ baseType: 'levelers', baseHeightMm: 50 }), cat);
    expect(r.issues.map((i) => i.code)).toContain('LEVELER_RANGE');
  });
});

describe('cantos, espesores y tamaños de taller', () => {
  it('canto más angosto que el tablero es error', () => {
    const r = calculateModule(base({ thicknessMm: 25 }), cat);
    expect(r.issues.map((i) => i.code)).toContain('EDGE_BAND_TOO_NARROW');
    expect(r.fabricable).toBe(false);
  });

  it('pieza demasiado angosta para cortar o cantear', () => {
    const r = calculateModule({ ...createModule('bookcase', cat, 'B'), baseHeightMm: 25 }, cat);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('PART_TOO_NARROW');
    expect(codes).toContain('PART_TOO_SMALL_FOR_EDGEBANDER');
  });

  it('proyecto guardado antes de estos campos se abre con valores por defecto', () => {
    const p = createProject({ id: 'p', name: 'x', familyId: 'kitchen_base', now: NOW }, cat) as unknown as Record<string, unknown>;
    const { manufacturing: _m, ...old } = p;
    const oldModules = (old.modules as Record<string, unknown>[]).map(({ shelfLoadKgM2: _s, ...m }) => m);
    const parsed = parseProject({ ...old, modules: oldModules });
    expect(parsed.manufacturing).toEqual(DEFAULT_MANUFACTURING);
    expect(parsed.modules[0]!.shelfLoadKgM2).toBeNull();
    expect(calculateProject(parsed, cat).modules[0]!.checks.length).toBeGreaterThan(5);
  });
});

describe('exportaciones con medidas de corte y verificación', async () => {
  const { partsCsv, checksCsv } = await import('@ms/export');
  const { parseCsv, planProject } = await import('@ms/domain');
  it('el CSV de despiece trae medida final y de corte; el de verificación, cada comprobación', () => {
    const p = createProject({ id: 'p', name: 'x', familyId: 'kitchen_base', now: NOW }, cat);
    p.modules[0] = base({ edgeBandId: 'pvc22x2' });
    const plan = planProject(p, cat, [], '2026-01-01', NOW);
    const rows = parseCsv(partsCsv(plan, cat));
    const h = rows[0]!;
    const door = rows.find((r) => r[0] === 'M01-DOOR')!;
    expect(door[h.indexOf('Ancho final (mm)')]).toBe('396.5');
    expect(door[h.indexOf('Ancho de corte (mm)')]).toBe('392.5');
    const checks = parseCsv(checksCsv(plan));
    expect(checks.length - 1).toBe(plan.calc.modules[0]!.checks.length);
    expect(checks.some((r) => r[3] === 'Ancho exterior' && r[6] === 'Cumple')).toBe(true);
  });
});
