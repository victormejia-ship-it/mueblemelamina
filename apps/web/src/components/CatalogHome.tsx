'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bath, BedDouble, Briefcase, CookingPot, LayoutGrid, LoaderCircle, Search, Shapes, Sofa, Store, WashingMachine, X, type LucideIcon,
} from 'lucide-react';
import type { ProjectSummary } from '@ms/domain';
import { errorMessage } from '@/lib/api';
import { getDataClient } from '@/lib/data';
import { Alert } from './ui';

export interface CatalogItem { id: string; name: string; category: string; categoryLabel: string; status: string; dims: string; svg: string }

const CAT_ICON: Record<string, LucideIcon> = {
  kitchen: CookingPot, bedroom: BedDouble, office: Briefcase, living: Sofa, bath: Bath, service: WashingMachine, commercial: Store, custom: Shapes,
};

/** Portada: elegir un mueble y empezar a diseñar con un toque. */
export function CatalogHome({ items, categories }: { items: CatalogItem[]; categories: { id: string; label: string }[] }) {
  const router = useRouter();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    getDataClient().then((c) => c.listProjects()).then((p) => setRecent(p.slice(0, 4))).catch(() => setRecent([]));
  }, []);

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = useMemo(() => items.filter((i) => (!cat || i.category === cat) && (!q || norm(`${i.name} ${i.categoryLabel}`).includes(norm(q)))), [items, cat, q]);

  async function start(item: CatalogItem) {
    if (busy) return;
    setBusy(item.id); setError(null);
    try {
      const date = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      const project = await (await getDataClient()).createProject({ name: `${item.name} · ${date}`, familyId: item.id });
      router.push(`/editor?id=${encodeURIComponent(project.id)}`);
    } catch (e) { setError(errorMessage(e)); setBusy(null); }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_10%_0%,#1f4a5a_0%,#16222c_55%,#121a22_100%)] px-4 py-4 sm:px-8 sm:py-8">
        <h1 className="text-[22px] font-extrabold leading-tight sm:text-[32px]">¿Qué vamos a fabricar?</h1>
        <div className="mt-3 flex max-w-xl items-center gap-2 rounded-xl border border-[#3c6074] bg-[#0f1821]/80 px-3 focus-within:outline focus-within:outline-2 focus-within:outline-accent">
          <Search aria-hidden className="h-5 w-5 text-muted" />
          <input aria-label="Buscar mueble" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: cocina, clóset, librero…" className="!border-0 !bg-transparent !px-0 !py-3 text-[15px] !outline-none" data-testid="catalog-search" />
          {q && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQ('')} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>}
        </div>
      </section>

      {recent && recent.length > 0 && (
        <section aria-label="Continuar" className="grid gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Continuar</h2>
            <Link href="/proyectos" className="text-[13px] font-semibold text-[#bce8f2] hover:underline">Mis proyectos →</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((p) => (
              <Link key={p.id} href={`/editor?id=${encodeURIComponent(p.id)}`} className="group flex min-w-[220px] items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5 transition hover:border-accent">
                <span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span><span className="text-[12px] text-muted">{p.moduleCount} módulo(s)</span></span>
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-accent transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Categorías" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[{ id: '', label: 'Todos' }, ...categories].map((c) => {
          const Icon = c.id ? CAT_ICON[c.id] ?? Shapes : LayoutGrid;
          const count = c.id ? items.filter((i) => i.category === c.id).length : items.length;
          const active = cat === c.id;
          return (
            <button key={c.id || 'all'} type="button" aria-pressed={active} onClick={() => setCat(c.id)} data-testid={`cat-${c.id || 'all'}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel-2 hover:border-[#5fb3c9]'}`}>
              <Icon aria-hidden className="h-4 w-4" />{c.label}<span className={`text-[11px] ${active ? 'opacity-80' : 'text-muted'}`}>{count}</span>
            </button>
          );
        })}
      </nav>

      {error && <Alert tone="err">{error}</Alert>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Catálogo de muebles" data-testid="catalog-grid">
        {shown.map((item, i) => (
          <li key={item.id} className="ms-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
            <button type="button" onClick={() => start(item)} disabled={!!busy} data-testid={`family-${item.id}`} aria-label={`Diseñar ${item.name}`}
              className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-panel text-left transition duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-[0_10px_30px_-12px_rgba(74,178,202,0.55)] focus-visible:-translate-y-1 disabled:cursor-wait">
              <span className="relative block aspect-[4/3] bg-[radial-gradient(ellipse_at_50%_35%,#2c4352,#15212b_75%)] p-2">
                <span className="block h-full w-full transition duration-300 group-hover:scale-[1.04]" dangerouslySetInnerHTML={{ __html: item.svg }} />
                {item.status === 'verified_vertical' && <span className="absolute left-2 top-2 rounded-full bg-ok-bg px-2 py-0.5 text-[10.5px] font-bold text-ok">✓ Verificado</span>}
                {item.status === 'template_requires_engine_validation' && <span className="absolute left-2 top-2 rounded-full bg-warn-bg px-2 py-0.5 text-[10.5px] font-bold text-warn">Beta</span>}
                {busy === item.id && <span className="absolute inset-0 flex items-center justify-center bg-[#0b1218]/60"><LoaderCircle aria-label="Creando" className="h-8 w-8 animate-spin text-accent" /></span>}
              </span>
              <span className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
                <span className="font-bold leading-tight">{item.name}</span>
                <span className="text-[12px] text-muted">{item.dims} mm</span>
              </span>
              <span aria-hidden className="absolute bottom-2.5 right-3 flex h-7 w-7 translate-x-1 items-center justify-center rounded-full bg-accent text-accent-ink opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="py-10 text-center text-muted">Sin resultados para «{q}». <button type="button" className="font-semibold text-[#bce8f2] underline" onClick={() => { setQ(''); setCat(''); }}>Ver todo</button></p>
      )}
    </div>
  );
}
