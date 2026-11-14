import type { EdgeBandDefinition, FinishDefinition, MaterialDefinition, SteelProfile } from '../types';

/**
 * Formatos de tablero "ejemplo" (1220×2440): validar por SKU con el proveedor.
 * Densidad y módulo de elasticidad: valores TÍPICOS conservadores para estimar peso y flecha;
 * sustituir por los de la ficha técnica del tablero comprado. kdef según Eurocódigo 5 (clase de servicio 1):
 * aglomerado/MDF 2.25, contrachapado 0.8, madera maciza 0.6.
 * Los precios NO viven aquí: se obtienen de ofertas con fuente y fecha (ver pricing).
 */
export const MATERIALS: MaterialDefinition[] = [
  { id: 'mel18', name: 'Melamina 18 mm', kind: 'board', thicknessMm: 18, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mel18', densityKgM3: 650, elasticModulusMPa: 2800, creepKdef: 2.25, notes: 'Formato comercial ejemplo; validar por SKU.' },
  { id: 'mel15', name: 'Melamina 15 mm', kind: 'board', thicknessMm: 15, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mel15', densityKgM3: 660, elasticModulusMPa: 2800, creepKdef: 2.25},
  { id: 'mel16', name: 'Melamina 16 mm (cajones)', kind: 'board', thicknessMm: 16, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mel16', densityKgM3: 660, elasticModulusMPa: 2800, creepKdef: 2.25},
  { id: 'mdf18', name: 'MDF laminado 18 mm', kind: 'board', thicknessMm: 18, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mdf18', densityKgM3: 750, elasticModulusMPa: 3000, creepKdef: 2.25},
  { id: 'lam18', name: 'Tablero laminado alta presión 18 mm', kind: 'board', thicknessMm: 18, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:lam18', densityKgM3: 700, elasticModulusMPa: 2800, creepKdef: 2.25},
  { id: 'ply18', name: 'Contrachapado 18 mm', kind: 'board', thicknessMm: 18, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:ply18', densityKgM3: 600, elasticModulusMPa: 6000, creepKdef: 0.8},
  { id: 'mel18rh', name: 'Melamina RH (resistente a humedad) 18 mm', kind: 'board', thicknessMm: 18, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mel18rh', densityKgM3: 680, elasticModulusMPa: 2800, creepKdef: 2.25},
  { id: 'oak18', name: 'Roble macizo 18 mm', kind: 'solidwood', thicknessMm: 18, sheet: null, productKey: 'solid:oak18', densityKgM3: 700, elasticModulusMPa: 10000, creepKdef: 0.6, notes: 'Madera maciza: rediseñar uniones y permitir movimiento higroscópico; se cotiza por pie-tabla o pieza.' },
  { id: 'hdf3', name: 'HDF 3 mm (respaldo)', kind: 'back_panel', thicknessMm: 3, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:hdf3', densityKgM3: 850, elasticModulusMPa: null, creepKdef: 2.25},
  { id: 'hdf6', name: 'MDF/HDF 6 mm (respaldo / fondo cajón)', kind: 'back_panel', thicknessMm: 6, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:hdf6', densityKgM3: 800, elasticModulusMPa: null, creepKdef: 2.25},
  { id: 'mel9', name: 'Melamina 9 mm (respaldo rígido)', kind: 'back_panel', thicknessMm: 9, sheet: { lengthMm: 2440, widthMm: 1220 }, productKey: 'board:mel9', densityKgM3: 680, elasticModulusMPa: null, creepKdef: 2.25},
];

export const FINISHES: FinishDefinition[] = [
  { id: 'grafito', name: 'Gris grafito', hasGrain: false, colors: { top: '#586473', front: '#414d59', side: '#293540' } },
  { id: 'gris', name: 'Gris claro', hasGrain: false, colors: { top: '#c0cbd1', front: '#a3abb0', side: '#7c8b95' } },
  { id: 'blanco', name: 'Blanco', hasGrain: false, colors: { top: '#f4f6f7', front: '#dfe4e7', side: '#b9c2c8' } },
  { id: 'roble', name: 'Roble natural (veta)', hasGrain: true, colors: { top: '#ccac79', front: '#a78254', side: '#80613e' } },
  { id: 'nogal', name: 'Nogal (veta)', hasGrain: true, colors: { top: '#8a6446', front: '#6c4b33', side: '#4f3524' } },
  { id: 'negro', name: 'Negro mate', hasGrain: false, colors: { top: '#525961', front: '#34383c', side: '#1b242e' } },
];

export const EDGE_BANDS: EdgeBandDefinition[] = [
  { id: 'pvc19x045', name: 'Canto PVC 19 × 0.45 mm', widthMm: 19, thicknessMm: 0.45, productKey: 'edge:pvc19x045' },
  { id: 'pvc22x1', name: 'Canto PVC 22 × 1 mm', widthMm: 22, thicknessMm: 1, productKey: 'edge:pvc22x1' },
  { id: 'pvc22x2', name: 'Canto PVC 22 × 2 mm', widthMm: 22, thicknessMm: 2, productKey: 'edge:pvc22x2' },
];

export const STEEL_PROFILES: SteelProfile[] = [
  { id: 'ptr1x1c14', name: 'PTR 1" × 1" cal. 14', shape: 'PTR', sectionSpec: '25.4 × 25.4 mm, calibre 14', barLengthMm: 6100, kgPerM: null, productKey: 'steel:ptr1x1c14' },
  { id: 'ptr1.5x1.5c14', name: 'PTR 1½" × 1½" cal. 14', shape: 'PTR', sectionSpec: '38.1 × 38.1 mm, calibre 14', barLengthMm: 6100, kgPerM: null, productKey: 'steel:ptr1.5x1.5c14' },
  { id: 'ptr2x1c14', name: 'PTR 2" × 1" cal. 14', shape: 'PTR', sectionSpec: '50.8 × 25.4 mm, calibre 14', barLengthMm: 6100, kgPerM: null, productKey: 'steel:ptr2x1c14' },
];
