import type { Metadata } from 'next';
import { EQUIPMENT, STATIONS } from '@ms/domain';
import { Hint } from '@/components/ui';
import { EquipmentCard, RouteFlow } from '@/components/workshop/WorkshopViews';
import { SampleModelProvider } from '@/components/workshop/SampleModel';

export const metadata: Metadata = { title: 'Taller' };

/** Guía general del taller: proceso y fichas de equipo (sin proyecto abierto). */
export default function TallerPage() {
  const stations = STATIONS.map((s, i) => ({ ...s, number: i + 1, equipmentIds: EQUIPMENT.filter((e) => e.station === s.id || (s.id === 'calidad' && ['escuadra', 'medidor-diagonales'].includes(e.id))).map((e) => e.id), parallel: s.id === 'herreria' }));
  return (
    <SampleModelProvider>
    <div className="mx-auto grid max-w-5xl gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold">Taller</h1>
        <Hint label="Qué es">Proceso general para muebles de tablero. Dentro de cada proyecto, la pestaña «Taller» muestra esta ruta con las cifras reales y el equipo que ese proyecto necesita. «Ver en el modelo» usa aquí una base de cocina de ejemplo.</Hint>
      </div>
      <section><h2 className="mb-2 text-[16px] font-bold">Ruta</h2><RouteFlow stations={stations} /></section>
      <section>
        <h2 className="mb-2 text-[16px] font-bold">Equipo</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{EQUIPMENT.map((e) => <EquipmentCard key={e.id} item={e} />)}</div>
      </section>
    </div>
    </SampleModelProvider>
  );
}
