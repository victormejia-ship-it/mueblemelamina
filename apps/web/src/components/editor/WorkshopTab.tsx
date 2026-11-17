'use client';
import { useMemo } from 'react';
import { DEFAULT_CATALOG, workshopRoute, type ManufacturingPlan, type Project } from '@ms/domain';
import { routeDiagramSvg } from '@ms/geometry';
import { toolsCsv } from '@ms/export';
import { saveBlob } from '@/lib/data/exports';
import { Boxes, Download, TriangleAlert, Wrench } from 'lucide-react';
import { STATION_ICON } from '../icons';
import { useLang } from '@/lib/lang';
import { BigStat, Button, Hint } from '../ui';
import { EquipmentGrid, RouteFlow, WorkshopModelProvider } from '../workshop/WorkshopViews';

/** Taller del proyecto: ruta de fabricación y equipo, a la vista lo esencial y el detalle a un toque. */
export function WorkshopTab({ plan, project }: { plan: ManufacturingPlan; project: Project }) {
  const { t } = useLang();
  const route = useMemo(() => workshopRoute(project, plan, DEFAULT_CATALOG), [project, plan]);
  const essential = route.equipment.filter((e) => e.need === 'esencial').length;
  const alerts = route.stations.reduce((s, x) => s + x.alerts.length, 0);
  const kg = Math.round(plan.calc.modules.reduce((s, m) => s + m.weightKg, 0));
  const Ruta = STATION_ICON.corte;
  return (
    <WorkshopModelProvider project={project} calc={plan.calc}>
    <div className="grid gap-5" data-testid="workshop-tab">
      <div className="flex flex-wrap items-center gap-2">
        <BigStat icon={<Ruta className="h-5 w-5" />} value={route.stations.length} label="pasos" tone="info" />
        <BigStat icon={<Wrench className="h-5 w-5" />} value={essential} label="equipos esenciales" tone="ok" />
        <BigStat icon={<TriangleAlert className="h-5 w-5" />} value={alerts} label="avisos" tone={alerts ? 'warn' : 'ok'} />
        <BigStat icon={<Boxes className="h-5 w-5" />} value={`${kg} kg`} label="peso de tableros" />
        <div className="ml-auto flex gap-2 no-print">
          <Button variant="secondary" onClick={() => saveBlob(t(routeDiagramSvg(route, project.name)), 'image/svg+xml', `${project.id}-ruta-de-taller.svg`)} data-testid="download-route" title="Diagrama para imprimir"><Download aria-hidden className="mr-1 inline h-4 w-4" />Diagrama</Button>
          <Button variant="secondary" onClick={() => saveBlob(t(toolsCsv(route, ';')), 'text/csv;charset=utf-8', `${project.id}-herramientas.csv`)} title="Lista de herramientas"><Download aria-hidden className="mr-1 inline h-4 w-4" />Herramientas</Button>
        </div>
      </div>
      <section>
        <div className="mb-2 flex items-center gap-2"><h2 className="text-[16px] font-bold">Ruta</h2><Hint label="Cómo leerla">Se sigue de arriba abajo. Toca un paso para ver qué equipo usa, sus cifras y dónde se aplica en el modelo. Los avisos en amarillo son lo que no hay que pasar por alto.</Hint></div>
        <RouteFlow stations={route.stations} />
      </section>
      <section>
        <h2 className="mb-2 text-[16px] font-bold">Equipo</h2>
        <EquipmentGrid needs={route.equipment} />
      </section>
    </div>
    </WorkshopModelProvider>
  );
}
