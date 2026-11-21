import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, FAMILIES, calculateProject, createProject, marketEstimate, parseProject, planProject, workshopRoute, type ModuleSpec } from '@ms/domain';
import { assemblyGuide, buildScene, renderModel } from '@ms/geometry';

const cat = DEFAULT_CATALOG;
const NOW = '2026-11-21T00:00:00.000Z';
const make = (family: string, patch: Partial<ModuleSpec> = {}) => {
  const p = createProject({ id: 'v', name: 'Peinador', familyId: family, now: NOW }, cat);
  Object.assign(p.modules[0]!, patch);
  return { p, c: calculateProject(p, cat) };
};
const VANITIES = ['vanity_floating', 'vanity_nordic', 'vanity_industrial', 'vanity_hollywood'];

describe('peinadores modernos', () => {
  it('los cuatro estilos están en el catálogo y se calculan sin errores, con cubierta a 76 cm', () => {
    for (const id of VANITIES) {
      expect(FAMILIES.some((f) => f.id === id), id).toBe(true);
      const { p, c } = make(id);
      expect(c.issues.filter((i) => i.severity === 'error'), id).toEqual([]);
      const m = p.modules[0]!;
      const base = m.mount === 'wall' ? m.elevationMm! : m.baseHeightMm;
      expect(base + m.heightMm, id).toBe(760);
      expect(c.modules[0]!.fixtures.some((f) => f.kind === 'mirror'), id).toBe(true);
      expect(c.parts.some((x) => x.code === 'DRAWER_SIDE'), id).toBe(true);
    }
  });

  it('estilos: patas de madera, PTR, luz LED trasera y focos Hollywood', () => {
    const nordic = make('vanity_nordic').c;
    expect(nordic.modules[0]!.fixtures.filter((f) => f.kind === 'leg')).toHaveLength(4);
    expect(nordic.hardware.find((h) => h.category === 'leg')!.quantity).toBe(4);
    expect(make('vanity_industrial').c.steel.length).toBe(1);
    const floating = make('vanity_floating').c;
    expect(floating.hardware.some((h) => h.category === 'led_strip')).toBe(true);
    expect(floating.hardware.some((h) => h.category === 'led_driver')).toBe(true);
    const hw = make('vanity_hollywood').c;
    const bulbs = hw.modules[0]!.fixtures.filter((f) => f.kind === 'bulb').length;
    expect(bulbs).toBeGreaterThanOrEqual(6);
    expect(hw.hardware.find((h) => h.productKey === 'hw:bulb_g45')!.quantity).toBe(bulbs);
    expect(hw.hardware.some((h) => h.productKey === 'hw:power_switch')).toBe(true);
  });

  it('el espejo queda sobre la cubierta, centrado y contra el muro', () => {
    const { p, c } = make('vanity_nordic');
    const m = p.modules[0]!;
    const mirror = c.modules[0]!.fixtures.find((f) => f.kind === 'mirror')!.b;
    const top = Math.max(...c.parts.filter((x) => x.role === 'carcass').flatMap((x) => x.placements.map((b) => b.z1)));
    expect(mirror.z0).toBeCloseTo(top + m.mirror.gapMm, 1);
    expect((mirror.x0 + mirror.x1) / 2).toBeCloseTo(m.widthMm / 2, 1);
    expect(mirror.z1 - mirror.z0).toBe(m.mirror.heightMm);
  });

  it('planos, render, instructivo y precio incluyen patas, espejo y focos', () => {
    const { p, c } = make('vanity_hollywood');
    const scene = buildScene(p, c, cat, { view: 'iso', exploded: false, showIds: false, hideFronts: false });
    expect(scene.polygons.some((x) => x.role === 'fx_mirror')).toBe(true);
    expect(scene.polygons.some((x) => x.role === 'fx_leg')).toBe(true);
    const rm = renderModel(p, c, cat);
    expect(rm.boxes.some((b) => b.material.kind === 'mirror')).toBe(true);
    expect(rm.boxes.filter((b) => b.role === 'bulb').every((b) => b.material.kind === 'led')).toBe(true);
    const g = assemblyGuide(p, c);
    expect(g.map((s) => s.title)).toEqual(expect.arrayContaining(['Atornilla las patas', 'Cuelga el espejo y los focos']));
    const plan = planProject(p, cat, [], '2026-11-21', NOW);
    const e = marketEstimate(p, plan, cat);
    expect(e.materials.some((x) => x.key === 'hw:mirror4mm' && x.source === 'referencia')).toBe(true);
    expect(e.market!.breakdown.some((b) => /Peinador/.test(b.label))).toBe(true);
    expect(e.labor.some((l) => l.id === 'espejo')).toBe(true);
  });

  it('flotante: se dibuja a su altura real', () => {
    const { p, c } = make('vanity_floating');
    const scene = buildScene(p, c, cat, { view: 'front', exploded: false, showIds: false, hideFronts: false });
    expect(scene.labels.find((l) => l.text.endsWith('ALTO'))?.text).toBe('760 mm · ALTO');
    const rm = renderModel(p, c, cat);
    expect(Math.min(...rm.boxes.filter((b) => b.role === 'carcass').map((b) => b.b.z0))).toBe(560);
  });
});

describe('validación al guardar', () => {
  it('cada mueble del catálogo crea un proyecto que pasa el validador del guardado', () => {
    for (const f of FAMILIES) expect(() => parseProject(createProject({ id: 'x', name: 'x', familyId: f.id, now: NOW }, cat)), f.id).not.toThrow();
  });
});

describe('conexión eléctrica en cualquier mueble', () => {
  it('contactos y pasacables en la tapa cuando está a la mano, con barreno Ø60 y salida de cable', () => {
    const { c } = make('tv_console');
    const fx = c.modules[0]!.fixtures;
    expect(fx.filter((f) => f.kind === 'outlet')).toHaveLength(1);
    expect(fx.filter((f) => f.kind === 'grommet')).toHaveLength(2);
    expect(fx.some((f) => f.kind === 'cable_exit')).toBe(true);
    const ops = c.machining.filter((o) => o.patternId.startsWith('power-'));
    expect(ops.filter((o) => o.patternId !== 'power-cable-exit').every((o) => o.partId.endsWith('TOP_POWER') && o.diameterMm === 60)).toBe(true);
    // Sólo la tapa lleva barrenos: el piso sigue siendo otro modelo de corte
    expect(c.parts.find((x) => x.code === 'HORIZONTAL')!.quantity).toBe(1);
    expect(c.issues.some((i) => i.code === 'POWER_ELECTRICIAN')).toBe(true);
  });

  it('muebles altos: el contacto va en el costado, a la mano', () => {
    const { c } = make('wardrobe', { power: { outlets: 1, usb: false, grommets: 0 } });
    expect(c.machining.some((o) => o.patternId === 'power-outlet' && o.partId.endsWith('SIDE_POWER'))).toBe(true);
    const outlet = c.modules[0]!.fixtures.find((f) => f.kind === 'outlet')!;
    expect(outlet.b.z0).toBeLessThan(1200);
  });

  it('con LED se agrega solo la salida de cable y el cable, aunque no haya contactos', () => {
    const { c } = make('kitchen_base', { led: { placement: 'under_cabinet', stripProductId: 'led-strip-cob-12v', profileProductId: 'led-profile-embed-17', sensor: 'none' } });
    expect(c.modules[0]!.fixtures.some((f) => f.kind === 'cable_exit')).toBe(true);
    expect(c.hardware.some((h) => h.productKey === 'hw:power_cable')).toBe(true);
  });

  it('sin luz ni contactos no se agrega nada; proyectos guardados se abren con valores por defecto', () => {
    const { p, c } = make('kitchen_base');
    expect(c.modules[0]!.fixtures).toEqual([]);
    expect(c.hardware.some((h) => h.category === 'power')).toBe(false);
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.modules[0].power; delete raw.modules[0].mirror; delete raw.modules[0].elevationMm;
    const parsed = parseProject(raw);
    expect(parsed.modules[0]!.power).toEqual({ outlets: 0, usb: false, grommets: 0 });
    expect(parsed.modules[0]!.mirror.enabled).toBe(false);
    expect(parsed.modules[0]!.elevationMm).toBeNull();
  });

  it('taller: sierra copa y probador; precio con mano de obra eléctrica', () => {
    const { p } = make('nightstand');
    const plan = planProject(p, cat, [], '2026-11-21', NOW);
    const r = workshopRoute(p, plan, cat);
    expect(r.equipment.find((e) => e.item.id === 'sierra-copa')?.need).toBe('esencial');
    expect(r.equipment.find((e) => e.item.id === 'probador-electrico')?.need).toBe('esencial');
    expect(r.stations.find((s) => s.id === 'instalacion')!.alerts.join(' ')).toMatch(/electricista/);
    expect(marketEstimate(p, plan, cat).labor.some((l) => l.id === 'electrico')).toBe(true);
  });
});
