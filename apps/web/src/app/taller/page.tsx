import type { Metadata } from 'next';
import { EQUIPMENT, STATIONS } from '@ms/domain';
import { Panel } from '@/components/ui';
import { EquipmentCard, RouteFlow } from '@/components/workshop/WorkshopViews';

export const metadata: Metadata = { title: 'Taller: equipo y proceso' };

/** Guía general del taller: proceso de fabricación y ficha de cada equipo (sin proyecto abierto). */
export default function TallerPage() {
  const stations = STATIONS.map((s, i) => ({ ...s, number: i + 1, equipmentIds: EQUIPMENT.filter((e) => e.station === s.id || (s.id === 'calidad' && ['escuadra', 'medidor-diagonales'].includes(e.id))).map((e) => e.id), parallel: s.id === 'herreria' }));
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <Panel title="Taller: equipo y proceso de fabricación">
        <p className="text-[13px] text-muted">Proceso general para muebles de tablero (melamina, MDF, contrachapado) con herrería ligera. Dentro de cada proyecto, la pestaña «Taller» muestra esta misma ruta con las cifras reales (piezas, tableros, metros de canto, barrenos, bisagras, pesos) y el equipo que ese proyecto necesita.</p>
      </Panel>
      <Panel title="Ruta de fabricación"><RouteFlow stations={stations} /></Panel>
      <Panel title="Ficha de cada equipo">
        <div className="grid gap-3">{EQUIPMENT.map((e) => <EquipmentCard key={e.id} item={e} />)}</div>
      </Panel>
    </div>
  );
}
