import { DEFAULT_CATALOG, workshopRoute } from '@ms/domain';
import { routeDiagramSvg } from '@ms/geometry';
import { buildPdf, checksCsv, toolsCsv, cutMapsSvg, hardwareCsv, partsCsv, projectJson, projectMermaid, projectSvg, quoteCsv, type CsvSeparator } from '@ms/export';
import { getSession } from '@/server/auth';
import { BadRequest, handle, readJson } from '@/server/http';
import { loadPlan } from '@/server/service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ format: string }> };

const FORMATS = ['json', 'parts-csv', 'quote-csv', 'hardware-csv', 'checks-csv', 'tools-csv', 'route-svg', 'svg', 'cut-svg', 'mermaid', 'pdf'] as const;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  const { format } = await ctx.params;
  if (!(FORMATS as readonly string[]).includes(format)) throw new BadRequest(`Formato no soportado: ${format}. DXF/DWG no están implementados.`);
  const body = (await readJson(req)) as { projectId?: string; revisionId?: string; separator?: CsvSeparator; sheet?: number; view?: 'iso' | 'front' | 'side' | 'top'; exploded?: boolean };
  if (!body.projectId) throw new BadRequest('projectId requerido');
  const { project, plan, generatedAt } = await loadPlan(s, body.projectId, body.revisionId);
  const sep: CsvSeparator = body.separator === ';' ? ';' : ',';
  const base = `${project.id}${body.revisionId ? `-${body.revisionId}` : ''}`;
  const file = (data: BodyInit, type: string, name: string) => new Response(data, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
  switch (format as (typeof FORMATS)[number]) {
    case 'json': return file(projectJson(project, plan, generatedAt), 'application/json; charset=utf-8', `${base}.json`);
    case 'parts-csv': return file(partsCsv(plan, DEFAULT_CATALOG, sep), 'text/csv; charset=utf-8', `${base}-despiece.csv`);
    case 'quote-csv': return file(quoteCsv(plan, sep), 'text/csv; charset=utf-8', `${base}-cotizacion.csv`);
    case 'hardware-csv': return file(hardwareCsv(plan, sep), 'text/csv; charset=utf-8', `${base}-herrajes.csv`);
    case 'tools-csv': return file(toolsCsv(workshopRoute(project, plan, DEFAULT_CATALOG), sep), 'text/csv; charset=utf-8', `${base}-herramientas.csv`);
    case 'route-svg': return file(routeDiagramSvg(workshopRoute(project, plan, DEFAULT_CATALOG), project.name), 'image/svg+xml', `${base}-ruta-de-taller.svg`);
    case 'checks-csv': return file(checksCsv(plan, sep), 'text/csv; charset=utf-8', `${base}-verificacion.csv`);
    case 'svg': return file(projectSvg(project, plan, DEFAULT_CATALOG, { view: body.view ?? 'iso', exploded: !!body.exploded, showIds: !!body.exploded }), 'image/svg+xml', `${base}-${body.view ?? 'iso'}.svg`);
    case 'cut-svg': {
      const maps = cutMapsSvg(plan);
      const i = Math.max(0, Math.min(maps.length - 1, (body.sheet ?? 1) - 1));
      if (!maps.length) throw new BadRequest('No hay acomodo de corte disponible');
      return file(maps[i]!, 'image/svg+xml', `${base}-corte-${i + 1}.svg`);
    }
    case 'mermaid': return file(projectMermaid(project, plan), 'text/plain; charset=utf-8', `${base}-armado.mmd`);
    case 'pdf': return file(Buffer.from(await buildPdf(project, plan, DEFAULT_CATALOG, generatedAt)), 'application/pdf', `${base}-expediente.pdf`);
  }
});
