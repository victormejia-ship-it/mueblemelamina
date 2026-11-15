import { CATEGORY_LABELS, DEFAULT_CATALOG, FAMILIES, calculateProject, createProject } from '@ms/domain';
import { thumbnailSvg } from '@ms/geometry';
import { CatalogHome, type CatalogItem } from '@/components/CatalogHome';

/**
 * Portada = catálogo. Las miniaturas se generan en el servidor/compilación con el mismo motor
 * de geometría (no se calculan en el dispositivo del usuario).
 */
const THUMB_FINISH: Record<string, string> = {
  kitchen: 'blanco', bedroom: 'roble', office: 'nogal', living: 'roble', bath: 'blanco', service: 'gris', commercial: 'negro', custom: 'grafito',
};

export default function Home() {
  const items: CatalogItem[] = FAMILIES.map((f) => {
    const p = createProject({ id: 'thumb', name: f.name, familyId: f.id, now: '2026-01-01T00:00:00.000Z' }, DEFAULT_CATALOG);
    // Sólo para la miniatura: acabado por categoría para distinguir las tarjetas de un vistazo.
    p.modules[0]!.finishId = THUMB_FINISH[f.category] ?? 'grafito';
    const calc = calculateProject(p, DEFAULT_CATALOG);
    return {
      id: f.id, name: f.name, category: f.category, categoryLabel: CATEGORY_LABELS[f.category], status: f.status,
      dims: `${f.defaults.widthMm} × ${f.defaults.heightMm} × ${f.defaults.depthMm}`,
      svg: thumbnailSvg(p, calc, DEFAULT_CATALOG),
    };
  });
  return <CatalogHome items={items} categories={Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }))} />;
}
