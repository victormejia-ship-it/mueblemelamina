import {
  Boxes, CircleCheck, CircleX, Drill, Ear, Flame, Footprints, Glasses, Hammer, Hand, HardHat, House, Layers, Lightbulb, Package, Ruler,
  ScanLine, Scissors, ShieldCheck, TriangleAlert, Wind, Wrench, type LucideIcon,
} from 'lucide-react';
import type { PPE, StationId } from '@ms/domain';

export const STATION_ICON: Record<StationId, LucideIcon> = {
  preparacion: Ruler, corte: Scissors, canteado: Layers, mecanizado: Drill, armado: Hammer, herreria: Flame,
  frentes: Wrench, calidad: ShieldCheck, empaque: Package, instalacion: House,
};

export const PPE_INFO: Record<PPE, { icon: LucideIcon; label: string }> = {
  gafas: { icon: Glasses, label: 'Gafas' },
  auditiva: { icon: Ear, label: 'Protección auditiva' },
  respirador: { icon: Wind, label: 'Respirador' },
  guantes: { icon: Hand, label: 'Guantes' },
  careta: { icon: HardHat, label: 'Careta de soldar' },
  calzado: { icon: Footprints, label: 'Calzado de seguridad' },
};

export { Boxes, CircleCheck, CircleX, Lightbulb, ScanLine, TriangleAlert };
