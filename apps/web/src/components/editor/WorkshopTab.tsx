'use client';
import { useMemo } from 'react';
import { DEFAULT_CATALOG, workshopRoute, type ManufacturingPlan, type Project } from '@ms/domain';
import { routeDiagramSvg } from '@ms/geometry';
import { toolsCsv } from '@ms/export';
import { saveBlob } from '@/lib/data/exports';
import { Alert, Button, Panel } from '../ui';
import { EquipmentCard, RouteFlow, ToolTable } from '../workshop/WorkshopViews';

/** Ruta de taller del proyecto: estaciones en orden, lista de herramientas y ficha de cada equipo. */
export function WorkshopTab({ plan, project }: { plan: ManufacturingPlan; project: Project }) {
  const route = useMemo(() => workshopRoute(project, plan, DEFAULT_CATALOG), [project, plan]);
  const essential = route.equipment.filter((e) => e.need === 'esencial').length;
  return (
    <div className="grid gap-4" data-testid="workshop-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px]"><strong>{route.stations.length} estaciones</strong> en orden y <strong>{essential} equipos esenciales</strong> para fabricar este proyecto. Las cifras salen del cálculo actual.</p>
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="secondary" onClick={() => saveBlob(routeDiagramSvg(route, project.name), 'image/svg+xml', `${project.id}-ruta-de-taller.svg`)} data-testid="download-route">Descargar diagrama (SVG)</Button>
          <Button variant="secondary" onClick={() => saveBlob(toolsCsv(route, ';'), 'text/csv;charset=utf-8', `${project.id}-herramientas.csv`)}>Lista de herramientas (CSV)</Button>
        </div>
      </div>
      <Alert tone="info">Recorra las estaciones de arriba abajo. Toque un equipo para ver su procedimiento paso a paso, los ajustes con los valores de este proyecto, la seguridad y qué revisar al terminar.</Alert>
      <Panel title="1 · Ruta de fabricación"><RouteFlow stations={route.stations} /></Panel>
      <Panel title="2 · Herramientas y equipo"><ToolTable needs={route.equipment} /></Panel>
      <Panel title="3 · Ficha de cada equipo">
        <div className="grid gap-3">{route.equipment.map((n) => <EquipmentCard key={n.item.id} item={n.item} need={n} />)}</div>
      </Panel>
    </div>
  );
}
