'use client';
import { DEFAULT_CATALOG, localizeIds, planProject, workshopRoute, type Project, type SupplierOffer } from '@ms/domain';
import type { ExportFormat, ExportOptions } from './types';

export function saveBlob(data: BlobPart, type: string, name: string): string {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

/** Exportación en el navegador (modo Firebase: no hay servidor). Mismas funciones que la API. */
export async function exportInBrowser(project: Project, offers: SupplierOffer[], format: ExportFormat, opts: ExportOptions): Promise<string> {
  const ex = await import('@ms/export');
  const generatedAt = new Date().toISOString();
  const plan = planProject(project, DEFAULT_CATALOG, offers, generatedAt.slice(0, 10), generatedAt);
  const sep = opts.separator === ';' ? ';' : ',';
  const base = `${project.id}${opts.revisionId ? `-${opts.revisionId}` : ''}`;
  const lang = opts.lang ?? 'es';
  const loc = (s: string) => localizeIds(s, lang);
  switch (format) {
    case 'json': return saveBlob(ex.projectJson(project, plan, generatedAt), 'application/json;charset=utf-8', `${base}.json`);
    case 'parts-csv': return saveBlob(ex.partsCsv(plan, DEFAULT_CATALOG, sep, lang), 'text/csv;charset=utf-8', `${base}-despiece.csv`);
    case 'quote-csv': return saveBlob(ex.quoteCsv(plan, sep, lang), 'text/csv;charset=utf-8', `${base}-cotizacion.csv`);
    case 'hardware-csv': return saveBlob(ex.hardwareCsv(plan, sep, lang), 'text/csv;charset=utf-8', `${base}-herrajes.csv`);
    case 'tools-csv': return saveBlob(loc(ex.toolsCsv(workshopRoute(project, plan, DEFAULT_CATALOG), sep)), 'text/csv;charset=utf-8', `${base}-herramientas.csv`);
    case 'route-svg': { const g = await import('@ms/geometry'); return saveBlob(loc(g.routeDiagramSvg(workshopRoute(project, plan, DEFAULT_CATALOG), project.name)), 'image/svg+xml', `${base}-ruta-de-taller.svg`); }
    case 'checks-csv': return saveBlob(ex.checksCsv(plan, sep, lang), 'text/csv;charset=utf-8', `${base}-verificacion.csv`);
    case 'svg': return saveBlob(ex.projectSvg(project, plan, DEFAULT_CATALOG, { view: opts.view ?? 'iso', exploded: !!opts.exploded, showIds: !!opts.exploded, lang }), 'image/svg+xml', `${base}-${opts.view ?? 'iso'}.svg`);
    case 'cut-svg': {
      const maps = ex.cutMapsSvg(plan, lang);
      if (!maps.length) throw new Error('No hay acomodo de corte disponible');
      const i = Math.max(0, Math.min(maps.length - 1, (opts.sheet ?? 1) - 1));
      return saveBlob(maps[i]!, 'image/svg+xml', `${base}-corte-${i + 1}.svg`);
    }
    case 'mermaid': return saveBlob(ex.projectMermaid(project, plan, lang), 'text/plain;charset=utf-8', `${base}-armado.mmd`);
    case 'pdf': {
      const bytes = await ex.buildPdf(project, plan, DEFAULT_CATALOG, generatedAt, lang);
      return saveBlob(bytes as BlobPart, 'application/pdf', `${base}-expediente.pdf`);
    }
  }
}
