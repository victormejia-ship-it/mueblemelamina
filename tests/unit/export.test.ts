import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, createModule, createProject, localizeIds, parseCsv, planProject } from '@ms/domain';
import { buildScene, paintOrder } from '@ms/geometry';
import { buildPdf, cutMapsSvg, hardwareCsv, partsCsv, projectJson, projectMermaid, projectSvg, quoteCsv } from '@ms/export';

const cat = DEFAULT_CATALOG;
const NOW = '2026-01-01T00:00:00.000Z';

function plan() {
  const p = createProject({ id: 'p1', name: 'Cocina "Prueba"', familyId: 'kitchen_base', now: NOW }, cat);
  p.modules.push({ ...createModule('wardrobe', cat, 'M02'), label: 'Clóset, recámara' });
  p.modules.push({ ...createModule('desk', cat, 'M03'), steel: { enabled: true, profileId: 'ptr1x1c14', legHeightMm: 0, finish: 'powder_coating' } });
  return { p, plan: planProject(p, cat, [], '2026-01-01', NOW) };
}

describe('exportaciones', () => {
  it('CSV con BOM UTF-8 y mismos datos que el JSON', () => {
    const { p, plan: pl } = plan();
    const csv = partsCsv(pl, cat, ',', 'en');
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = parseCsv(csv);
    const json = JSON.parse(projectJson(p, pl, NOW));
    expect(rows.length - 1).toBe(json.calculation.parts.length);
    for (const part of json.calculation.parts) {
      const row = rows.find((r) => r[0] === part.id)!;
      expect(Number(row[4])).toBe(part.quantity);
      expect(Number(row[5])).toBe(part.lengthMm);
      expect(Number(row[6])).toBe(part.widthMm);
    }
  });

  it('CSV con ; usa coma decimal y respeta comillas', () => {
    const { plan: pl } = plan();
    const csv = partsCsv(pl, cat, ';');
    const rows = parseCsv(csv);
    expect(rows[0]![0]).toBe('ID');
    const door = rows.find((r) => r[0] === 'M01-PUERTA')!;
    expect(door[6]).toBe('396,5');
  });

  it('cotización CSV marca pendientes; herrajes incluyen herrería', () => {
    const { plan: pl } = plan();
    expect(quoteCsv(pl)).toMatch(/INCOMPLETO/);
    expect(quoteCsv(pl)).toMatch(/PENDIENTE/);
    expect(hardwareCsv(pl)).toMatch(/requiere validación de cargas/);
  });

  it('SVG con viewBox, título, cotas en mm e IDs de pieza del BOM', () => {
    const { p, plan: pl } = plan();
    const svg = projectSvg(p, pl, cat, { showIds: true });
    expect(svg).toMatch(/viewBox="0 0 900 640"/);
    expect(svg).toMatch(/mm · ANCHO/);
    expect(svg).toContain('&quot;Prueba&quot;');
    const ids = new Set([...svg.matchAll(/data-part-id="([^"]+)"/g)].map((m) => m[1]));
    for (const part of pl.calc.parts) expect(ids.has(localizeIds(part.id)), part.id).toBe(true);
    const en = projectSvg(p, pl, cat, { showIds: true, lang: 'en' });
    for (const part of pl.calc.parts) expect(en.includes(`data-part-id="${part.id}"`), part.id).toBe(true);
  });

  it('todas las vistas y despiece separado generan escena válida', () => {
    const { p, plan: pl } = plan();
    for (const view of ['iso', 'front', 'side', 'top'] as const) {
      const s = buildScene(p, pl.calc, cat, { view, exploded: view === 'iso', showIds: true, hideFronts: false });
      expect(s.polygons.length).toBeGreaterThan(0);
      for (const poly of s.polygons) for (const [x, y] of poly.points) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(900);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(640);
      }
    }
  });

  it('orden del pintor: pieza trasera antes que la frontal', () => {
    const back = { key: 'b', partId: 'b', moduleId: 'm', role: 'back', b: { x0: 0, x1: 100, y0: 90, y1: 100, z0: 0, z1: 100 } };
    const front = { key: 'f', partId: 'f', moduleId: 'm', role: 'front', b: { x0: 0, x1: 100, y0: 0, y1: 10, z0: 0, z1: 100 } };
    expect(paintOrder('iso', [front, back]).map((s) => s.key)).toEqual(['b', 'f']);
  });

  it('mapas de corte y Mermaid', () => {
    const { p, plan: pl } = plan();
    const maps = cutMapsSvg(pl);
    expect(maps.length).toBe(pl.nesting.reduce((n, x) => n + (x.layout?.sheets.length ?? 0), 0));
    expect(maps[0]).toMatch(/acomodo factible/);
    expect(cutMapsSvg(pl, 'en')[0]).toMatch(/layout_factible/);
    const mm = projectMermaid(p, pl);
    expect(mm.startsWith('flowchart TD')).toBe(true);
    expect(mm).toContain('M01_S13');
    expect(mm).toContain('M01_COSTADO');
    expect(mm).not.toMatch(/M01_SIDE\b/);
    expect(projectMermaid(p, pl, 'en')).toContain('M01_SIDE');
  });

  it('PDF de fabricación', async () => {
    const { p, plan: pl } = plan();
    const bytes = await buildPdf(p, pl, cat, NOW);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
  });
});

describe('miniaturas del catálogo', () => {
  it('cada familia genera una miniatura sin textos ni fondo, adaptable', async () => {
    const { FAMILIES, calculateProject } = await import('@ms/domain');
    const { thumbnailSvg } = await import('@ms/geometry');
    for (const f of FAMILIES) {
      const p = createProject({ id: 't', name: f.name, familyId: f.id, now: NOW }, cat);
      const svg = thumbnailSvg(p, calculateProject(p, cat), cat);
      expect(svg, f.id).toMatch(/^<svg[^>]+width="100%" height="100%"/);
      expect(svg, f.id).not.toMatch(/<text|<rect width="100%"/);
      expect((svg.match(/<polygon/g) ?? []).length, f.id).toBeGreaterThan(5);
      expect(svg.length, f.id).toBeLessThan(40000);
    }
  });
});

describe('todo en español', () => {
  it('códigos de pieza traducidos sin tocar los códigos de aviso', async () => {
    const { localizeIds: loc, partCodeLabel } = await import('@ms/domain');
    expect(loc('M01-DRAWER_SIDE_2')).toBe('M01-COSTADO_CAJON_2');
    expect(loc('M01-SIDE-M001')).toBe('M01-COSTADO-M001');
    expect(loc('DRAWER_SLIDE_GENERIC · BACK_JOINT_UNSUPPORTED')).toBe('DRAWER_SLIDE_GENERIC · BACK_JOINT_UNSUPPORTED');
    expect(partCodeLabel('DOOR_2')).toBe('PUERTA_2');
    expect(partCodeLabel('DOOR_2', 'en')).toBe('DOOR_2');
    expect(loc('M01-SIDE', 'en')).toBe('M01-SIDE');
  });

  it('las exportaciones salen sin códigos en inglés', () => {
    const p = createProject({ id: 'es', name: 'Español', familyId: 'kitchen_base_drawer', now: NOW }, cat);
    const pl = planProject(p, cat, [], '2026-01-01', NOW);
    const english = /\b(SIDE|HORIZONTAL|BACK|SHELF|DOOR|DRAWER_[A-Z]+|PLINTH_[A-Z]+)\b/;
    for (const out of [partsCsv(pl, cat), hardwareCsv(pl), quoteCsv(pl), projectMermaid(p, pl), projectSvg(p, pl, cat, { showIds: true }), ...cutMapsSvg(pl)]) {
      expect(out).not.toMatch(english);
    }
    const hw = parseCsv(hardwareCsv(pl));
    expect(hw.slice(1).every((r) => !/^(hinge|drawer_slide|handle|cam_connector)$/.test(r[2]!))).toBe(true);
    expect(hw.some((r) => r[2] === 'Bisagra')).toBe(true);
  });
});
