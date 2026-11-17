/**
 * Exportaciones: JSON versionado, CSV (UTF-8 con BOM, compatible con Excel es-MX), SVG, Mermaid y PDF.
 * Todas consumen el mismo plan congelado (ManufacturingPlan) para no divergir.
 * DXF/DWG: NO implementados (no se prometen).
 */
import {
  CALC_VERSION, FAMILIES, GRAIN_ES, HW_CATEGORY_ES, QC_CHECKLIST, ROLE_ES, QUOTE_CATEGORY_ES, QUOTE_LINE_STATUS_ES, STATIONS, VALIDATION_ES, assemblySteps, catalogLookup, enumLabel, formatMXN, localizeIds, mermaidDiagram,
  type CodeLang,
  type Catalog, type ManufacturingPlan, type Project, type WorkshopRoute,
} from '@ms/domain';
import { buildScene, cutSheetSvg, sceneToSvg, type SceneOptions } from '@ms/geometry';

export { buildPdf } from './pdf';

export type CsvSeparator = ',' | ';';

export function toCsv(rows: (string | number | null | undefined)[][], sep: CsvSeparator = ','): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}

/** Número con separador decimal acorde al separador de campos (';' => coma decimal para Excel es-MX). */
const num = (n: number, sep: CsvSeparator) => (sep === ';' ? String(n).replace('.', ',') : String(n));

export function partsCsv(plan: ManufacturingPlan, catalog: Catalog, sep: CsvSeparator = ',', lang: CodeLang = 'es'): string {
  const L = catalogLookup(catalog);
  const head = ['ID', 'Módulo', 'Pieza', 'Rol', 'Cantidad', 'Largo final (mm)', 'Ancho final (mm)', 'Espesor (mm)', 'Largo de corte (mm)', 'Ancho de corte (mm)', 'Veta', 'Canto L1', 'Canto L2', 'Canto A1', 'Canto A2', 'Material', 'SKU material', 'Acabado', 'Área (m²)', 'Estado validación', 'Mecanizados', 'Observaciones'];
  const rows = plan.calc.parts.map((p) => {
    const m = L.material(p.materialId);
    return [
      p.id, p.moduleId, p.name, enumLabel(ROLE_ES, p.role, lang), p.quantity, num(p.lengthMm, sep), num(p.widthMm, sep), num(p.thicknessMm, sep), num(p.cutLengthMm, sep), num(p.cutWidthMm, sep), enumLabel(GRAIN_ES, p.grainAxis, lang),
      p.edgeBand.L1 ?? '', p.edgeBand.L2 ?? '', p.edgeBand.A1 ?? '', p.edgeBand.A2 ?? '', m.name, m.productKey, L.finish(p.finishId).name,
      num(Math.round((p.lengthMm * p.widthMm * p.quantity) / 1e4) / 100, sep), enumLabel(VALIDATION_ES, p.validationStatus, lang), p.machiningOperationIds.length, p.notes.join(' | '),
    ];
  });
  return localizeIds(toCsv([head, ...rows], sep), lang);
}

export function quoteCsv(plan: ManufacturingPlan, sep: CsvSeparator = ',', lang: CodeLang = 'es'): string {
  const q = plan.quote;
  const money = (c: number | null) => (c === null ? 'PENDIENTE' : num(c / 100, sep));
  const head = ['Clave', 'Categoría', 'Descripción', 'Cant. requerida', 'Unidad', 'Cant. compra', 'Presentación', 'Proveedor', 'SKU', 'Precio neto unitario (MXN, sin IVA)', 'Importe neto (MXN, sin IVA)', 'Estado precio', 'Estado línea', 'Fecha verificación', 'Fuente', 'Notas'];
  const rows = q.lines.filter((l) => l.status !== 'NOT_APPLICABLE').map((l) => [
    l.key, enumLabel(QUOTE_CATEGORY_ES, l.category, lang), l.description, num(l.requiredQuantity, sep), l.requiredUnit, l.purchaseQuantity ?? '', l.purchaseUnit ?? '', l.supplierId ?? '', l.sku ?? '',
    money(l.unitNetCents), money(l.lineNetCents), l.priceStatus ?? 'PENDIENTE', enumLabel(QUOTE_LINE_STATUS_ES, l.status, lang), l.verifiedAt ?? '', l.sourceUrl ?? '', l.notes.join(' | '),
  ]);
  const tail = [
    [],
    ['Costo directo neto (sin IVA)', money(q.directCostNetCents)],
    [q.mode === 'margin' ? `Precio de venta (margen ${q.marginPct} % sobre venta)` : `Precio de venta (markup ${q.markupPct} % sobre costo)`, money(q.sellBeforeTaxCents)],
    [`IVA ${q.taxRatePct} %`, money(q.taxCents)],
    ['Total', money(q.totalCents)],
    ['Estado de la cotización', q.completeness],
    ['Líneas faltantes', q.missingLines.join(' ')],
    ['Método de tableros', q.boardMethod],
    ['Versión de cálculo', q.calcVersion],
  ];
  return localizeIds(toCsv([head, ...rows, ...tail], sep), lang);
}

export function hardwareCsv(plan: ManufacturingPlan, sep: CsvSeparator = ',', lang: CodeLang = 'es'): string {
  const head = ['ID', 'Módulo', 'Categoría', 'Descripción', 'Clave producto', 'Cantidad', 'Unidad', 'Regla aplicada', 'Estado validación'];
  const rows = plan.calc.hardware.map((h) => [h.id, h.moduleId, enumLabel(HW_CATEGORY_ES, h.category, lang), h.description, h.productKey, num(h.quantity, sep), h.unit, h.basis, enumLabel(VALIDATION_ES, h.validationStatus, lang)]);
  const steel = plan.calc.steel.flatMap((s) => s.pieces.map((p) => [p.id, s.moduleId, `herrería ${s.shape}`, `${p.label} ${s.sectionSpec}`, s.profileId, p.count, `pza de ${p.lengthMm} mm`, 'geometría', s.loadValidationRequired ? 'requiere validación de cargas' : '']));
  return localizeIds(toCsv([head, ...rows, ...steel], sep), lang);
}

/** Lista de herramientas y equipo del proyecto con su estación, necesidad, ajustes, seguridad y control. */
export function toolsCsv(route: WorkshopRoute, sep: CsvSeparator = ','): string {
  const head = ['Estación', 'Equipo', 'Necesidad', 'Para qué en este proyecto', 'Ajustes del proyecto', 'Pasos', 'Seguridad (EPP)', 'Control al terminar', 'Alternativas', 'Consumibles'];
  const rows = route.equipment.map((n) => [
    STATIONS.find((s) => s.id === n.item.station)?.name ?? n.item.station, n.item.name, n.need, n.reason, n.projectSettings.join(' | '),
    n.item.steps.map((s, i) => `${i + 1}. ${s}`).join(' | '), n.item.safety.join(' | '), n.item.qualityChecks.join(' | '), n.item.alternatives.join(' | '), n.item.consumables.join(' | '),
  ]);
  return toCsv([head, ...rows], sep);
}

/** Verificación dimensional (esperado vs. calculado) por módulo. */
export function checksCsv(plan: ManufacturingPlan, sep: CsvSeparator = ',', lang: CodeLang = 'es'): string {
  const head = ['ID', 'Módulo', 'Tipo', 'Verificación', 'Esperado', 'Calculado', 'Resultado', 'Pieza'];
  const label = { ok: 'Cumple', info: 'Info', warning: 'Revisar', error: 'No cumple' } as const;
  const rows = plan.calc.modules.flatMap((m) => m.checks).map((c) => [c.id, c.moduleId, c.category, c.label, c.expected, c.actual, label[c.status], c.partId ?? '']);
  return localizeIds(toCsv([head, ...rows], sep), lang);
}

export function projectJson(project: Project, plan: ManufacturingPlan, exportedAt: string): string {
  return JSON.stringify({
    format: 'modular-studio.project+calculation',
    schemaVersion: project.schemaVersion,
    calcVersion: CALC_VERSION,
    exportedAt,
    units: { length: 'mm', currency: 'MXN', money: 'centavos enteros' },
    releaseStatus: plan.calc.releaseStatus,
    project,
    calculation: plan.calc,
    nesting: plan.nesting,
    steel: plan.steel,
    quote: plan.quote,
  }, null, 2);
}

export function projectSvg(project: Project, plan: ManufacturingPlan, catalog: Catalog, opts: Partial<SceneOptions> = {}): string {
  return localizeIds(sceneToSvg(buildScene(project, plan.calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, ...opts }), 'light'), opts.lang ?? 'es');
}

export function cutMapsSvg(plan: ManufacturingPlan, lang: CodeLang = 'es'): string[] {
  return plan.nesting.flatMap((n) => (n.layout ? n.layout.sheets.map((s) => localizeIds(cutSheetSvg({ materialName: n.materialName, sheet: n.layout!.sheet, index: s.index, utilization: s.utilization, placements: s.placements }), lang)) : []));
}

export function projectMermaid(project: Project, plan: ManufacturingPlan, lang: CodeLang = 'es'): string {
  return mermaidDiagram(project, plan.calc, lang);
}

/** Expediente en texto plano (para impresión rápida / adjunto). */
export function summaryText(project: Project, plan: ManufacturingPlan): string {
  const lines = [
    `MODULAR STUDIO — ${project.name}`,
    `Cliente: ${project.customer || '—'} · Obra: ${project.site || '—'}`,
    `Estado: ${plan.calc.releaseStatus} · Cotización: ${plan.quote.completeness} · Total ${formatMXN(plan.quote.totalCents)}`,
    '',
    ...project.modules.flatMap((m) => [`${m.id} ${m.label} (${FAMILIES.find((f) => f.id === m.familyId)?.name ?? m.familyId}) ${m.widthMm}×${m.heightMm}×${m.depthMm} mm`, ...assemblySteps(m, plan.calc).map((s) => `  ${s.id} ${s.title}${s.pending ? ' [PENDIENTE]' : ''}`)]),
    '',
    'Checklist de calidad:',
    ...QC_CHECKLIST.map((c) => `  [${project.inspection.checklist[c.id] ? 'x' : ' '}] ${c.label}`),
  ];
  return lines.join('\n');
}
