import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG, DEFAULT_MARKET, LED_DEFAULTS, calculateProject, createModule, createProject, equipmentFocus, marketEstimate, parseProject, planProject, workshopRoute,
  type LedPlacement, type Project,
} from '@ms/domain';
import { buildScene, renderModel } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const NOW = '2026-11-16T00:00:00.000Z';
function proj(family: string, placement: LedPlacement, extra: Partial<Project['modules'][number]> = {}): Project {
  const p = createProject({ id: 'p', name: 'LED', familyId: family, now: NOW }, cat);
  p.modules[0] = { ...p.modules[0]!, ...extra, led: { ...p.modules[0]!.led, placement } };
  return p;
}

describe('LED empotrado con router', () => {
  it('aéreo: sólo el piso lleva ranura; piezas y cantidades siguen cuadrando', () => {
    const p = proj('kitchen_wall', 'under_cabinet');
    const base = calculateProject(proj('kitchen_wall', 'none'), cat);
    const c = calculateProject(p, cat);
    expect(c.ledRuns).toHaveLength(1);
    const bottom = c.parts.find((x) => x.code === 'BOTTOM_LED')!;
    expect(bottom.quantity).toBe(1);
    expect(c.parts.find((x) => x.code === 'HORIZONTAL')!.quantity).toBe(1);
    expect(c.totals.panelCount).toBe(base.totals.panelCount);
    // La ranura va en la cara de abajo del piso, a 40 mm del frente, con 15 mm libres en cada extremo
    const r = c.ledRuns[0]!;
    const pl = bottom.placements[0]!;
    expect(r.a[2]).toBe(pl.z0);
    expect(r.a[1]).toBe(pl.y0 + LED_DEFAULTS.horizontalAxisFromFrontMm);
    expect(r.lengthMm).toBeCloseTo(bottom.lengthMm - 30, 1);
    // Operaciones de router en la pieza (ranura + canal de cable) y conserva las perforaciones del modelo original
    const ops = c.machining.filter((o) => o.partId === bottom.id);
    expect(ops.some((o) => o.patternId === 'led-groove-router' && o.groove && o.depthMm === 8)).toBe(true);
    expect(ops.some((o) => o.patternId === 'led-cable-channel')).toBe(true);
    expect(ops.filter((o) => !o.patternId.startsWith('led-')).length).toBe(c.machining.filter((o) => o.partId === `${p.modules[0]!.id}-HORIZONTAL`).length);
    expect(c.issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('materiales: tira, perfil, cable y una fuente con margen', () => {
    const c = calculateProject(proj('bookcase', 'shelves'), cat);
    const m = c.ledRuns.reduce((s, r) => s + r.lengthMm, 0) / 1000;
    const strip = c.hardware.find((h) => h.category === 'led_strip')!;
    expect(strip.quantity).toBeCloseTo(m * 1.05, 1);
    const driver = c.hardware.find((h) => h.category === 'led_driver')!;
    expect(driver.moduleId).toBe('PROYECTO');
    const watts = Number(driver.productId!.match(/(\d+)$/)![1]) * driver.quantity;
    expect(watts).toBeGreaterThanOrEqual(strip.quantity * 10 * 1.25);
    expect(c.issues.some((i) => i.code === 'LED_SHELF_FIXED')).toBe(true);
  });

  it('ranura demasiado profunda para el tablero es error', () => {
    const p = proj('kitchen_wall', 'under_cabinet', { materialId: 'mel9', thicknessMm: 9 });
    const c = calculateProject(p, cat);
    expect(c.issues.some((i) => i.code === 'LED_GROOVE_TOO_DEEP' && i.severity === 'error')).toBe(true);
  });

  it('costados: tramo vertical en la cara interior de cada costado', () => {
    const c = calculateProject(proj('wardrobe', 'sides'), cat);
    expect(c.ledRuns).toHaveLength(2);
    const [l, r] = [...c.ledRuns].sort((a, b) => a.a[0] - b.a[0]);
    expect(l!.lightDir[0]).toBe(1);
    expect(r!.lightDir[0]).toBe(-1);
    expect(l!.a[2]).toBeLessThan(l!.b[2]);
  });

  it('el router aparece en taller, en el modelo y en el render', () => {
    const p = proj('kitchen_wall', 'under_cabinet');
    const plan = planProject(p, cat, [], '2026-11-16', NOW);
    const route = workshopRoute(p, plan, cat);
    expect(route.equipment.find((e) => e.item.id === 'router')?.need).toBe('esencial');
    expect(route.stations.find((s) => s.id === 'mecanizado')!.equipmentIds).toContain('router');
    const f = equipmentFocus('router', plan.calc);
    expect(f.led && !f.empty).toBe(true);
    const scene = buildScene(p, plan.calc, cat, { view: 'iso', exploded: false, showIds: false, hideFronts: false, focus: f });
    expect(scene.lines.filter((l) => l.kind === 'led')).toHaveLength(1);
    const rm = renderModel(p, plan.calc, cat);
    const led = rm.boxes.find((b) => b.material.kind === 'led')!;
    expect(led.b.z0).toBeGreaterThanOrEqual(1450 - 1);
    expect(equipmentFocus('router', calculateProject(proj('kitchen_wall', 'none'), cat)).empty).toBe(true);
  });

  it('proyectos guardados antes del LED y del costeo se abren con valores por defecto', () => {
    const p = proj('kitchen_base', 'none') as unknown as Record<string, unknown>;
    const legacy = JSON.parse(JSON.stringify(p));
    delete legacy.modules[0].led;
    delete legacy.pricing.market;
    const parsed = parseProject(legacy);
    expect(parsed.modules[0]!.led.placement).toBe('none');
    expect(parsed.pricing.market.laborDayCents).toBe(DEFAULT_MARKET.laborDayCents);
  });
});

describe('costeo y precio de venta (Monterrey)', () => {
  const kitchen = () => {
    const p = createProject({ id: 'k', name: 'Cocina', familyId: 'kitchen_base', now: NOW }, cat);
    p.modules.push(createModule('kitchen_base', cat, 'M02'));
    const w = createModule('kitchen_wall', cat, 'W01');
    w.led = { ...w.led, placement: 'under_cabinet', sensor: 'hand' };
    p.modules.push(w);
    return p;
  };

  it('suma material + consumibles + mano de obra + flete + indirectos + imprevistos', () => {
    const p = kitchen();
    const e = marketEstimate(p, planProject(p, cat, [], '2026-11-16', NOW), cat);
    const t = e.totals;
    expect(t.materialsCents).toBe(e.materials.reduce((s, m) => s + m.totalCents, 0));
    expect(t.laborCents).toBe(e.labor.reduce((s, l) => s + l.cents, 0));
    expect(t.directCents).toBe(t.materialsCents + t.consumablesCents + t.laborCents + t.transportCents);
    expect(t.costCents).toBe(t.directCents + t.overheadCents + t.contingencyCents);
    expect(e.unpriced).toEqual([]);
    expect(e.labor.some((l) => l.id === 'router')).toBe(true);
    expect(e.materials.some((m) => m.key === 'hw:led_strip_cob12v' && m.source === 'referencia')).toBe(true);
  });

  it('niveles de precio: utilidad neta después de venta y cobro, IVA y opción sin LED', () => {
    const p = kitchen();
    const e = marketEstimate(p, planProject(p, cat, [], '2026-11-16', NOW), cat);
    const [a, b, c] = e.tiers;
    expect(e.tiers.map((x) => x.id)).toEqual(['minimo', 'saludable', 'premium']);
    expect(a!.beforeTaxCents).toBeLessThan(b!.beforeTaxCents);
    expect(b!.beforeTaxCents).toBeLessThan(c!.beforeTaxCents);
    // Precio − costo − venta/cobro = utilidad neta ≈ % objetivo del precio (redondeo a pesos)
    expect(b!.netProfitCents).toBe(b!.beforeTaxCents - e.totals.costCents - b!.salesCents);
    expect(b!.netProfitCents / b!.beforeTaxCents).toBeCloseTo(0.18, 2);
    expect(b!.salesCents).toBe(Math.round(b!.beforeTaxCents * 0.07));
    expect(e.recommended).toBe('saludable');
    expect(e.health.find((h) => h.id === 'utilidad')!.ok).toBe(true);
    expect(b!.taxCents).toBe(Math.round(b!.beforeTaxCents * 0.16));
    expect(b!.withoutLedBeforeTaxCents!).toBeLessThan(b!.beforeTaxCents);
    expect(e.market!.lowCents).toBeLessThan(e.market!.highCents);
  });

  it('precio capturado y oferta de proveedor tienen prioridad sobre la referencia', () => {
    const p = kitchen();
    p.pricing.market.priceOverrides['board:mel18'] = 99900;
    const e = marketEstimate(p, planProject(p, cat, [], '2026-11-16', NOW), cat);
    const board = e.materials.find((m) => m.key === 'board:mel18')!;
    expect(board.source).toBe('capturado');
    expect(board.totalCents).toBe(99900 * board.quantity);
  });

  it('recomienda bajar de nivel si el precio queda arriba del mercado', () => {
    const p = kitchen();
    p.pricing.market.laborDayCents = 600000; // salario irreal: precio muy alto
    const e = marketEstimate(p, planProject(p, cat, [], '2026-11-16', NOW), cat);
    expect(e.tiers[1]!.position).toBe('arriba');
    expect(e.recommended).toBe('minimo');
  });

  it('parte del costo de insumos que captura el usuario (con o sin IVA)', () => {
    const p = kitchen();
    const plan = planProject(p, cat, [], '2026-11-16', NOW);
    p.pricing.market.inputCostCents = 1_160_000;
    const sinIva = marketEstimate(p, plan, cat);
    expect(sinIva.inputSource).toBe('capturado');
    expect(sinIva.totals.materialsCents).toBe(1_160_000);
    p.pricing.market.inputCostIncludesTax = true;
    const conIva = marketEstimate(p, plan, cat);
    expect(conIva.totals.materialsCents).toBe(1_000_000);
    expect(conIva.tiers[1]!.beforeTaxCents).toBeLessThan(sinIva.tiers[1]!.beforeTaxCents);
    // Un taller sano cobra al menos ~2 veces sus insumos y el anticipo alcanza para comprarlos
    expect(conIva.tiers[1]!.inputMultiplier!).toBeGreaterThanOrEqual(2);
    expect(conIva.health.find((h) => h.id === 'anticipo')!.ok).toBe(true);
  });
});
