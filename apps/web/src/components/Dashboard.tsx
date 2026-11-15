'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Copy, FolderOpen, Plus, Trash2, Upload } from 'lucide-react';
import type { ProjectSummary } from '@ms/domain';
import { errorMessage } from '@/lib/api';
import { getDataClient } from '@/lib/data';
import { Alert, Badge } from './ui';

/** Mis proyectos: abrir, duplicar, borrar o importar. Crear se hace desde el catálogo. */
export function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProjects(await (await getDataClient()).listProjects()); } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function duplicate(id: string) {
    try { await (await getDataClient()).duplicateProject(id); await load(); } catch (e) { setError(errorMessage(e)); }
  }
  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}" y sus revisiones?`)) return;
    try { await (await getDataClient()).deleteProject(id); await load(); } catch (e) { setError(errorMessage(e)); }
  }
  async function importFile(file: File) {
    setError(null);
    try {
      const { project } = await (await getDataClient()).importProject(JSON.parse(await file.text()));
      router.push(`/editor?id=${encodeURIComponent(project.id)}`);
    } catch (e) { setError(`No se pudo importar: ${errorMessage(e)}`); }
  }

  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg text-[#cfdae4] hover:bg-[#22313e]';
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[22px] font-extrabold">Mis proyectos</h1>
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#496072] bg-[#2a3a49] px-3 py-2 text-[13px] font-semibold" title="Importar proyecto (JSON)">
            <Upload aria-hidden className="h-4 w-4" />Importar
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          <Link href="/" className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-bold text-accent-ink hover:brightness-110" data-testid="new-project"><Plus aria-hidden className="h-4 w-4" />Nuevo</Link>
        </div>
      </div>
      {error && <Alert tone="err">{error}</Alert>}
      {projects === null && !error && <p role="status" className="text-muted">Cargando…</p>}
      {projects?.length === 0 && (
        <Link href="/" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-14 text-center hover:border-accent">
          <FolderOpen aria-hidden className="h-10 w-10 text-muted" />
          <span className="font-semibold">Aún no hay proyectos</span>
          <span className="text-[13px] text-[#bce8f2]">Elegir un mueble del catálogo →</span>
        </Link>
      )}
      {projects && projects.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="project-list">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 pr-1.5 transition hover:border-accent">
              <Link href={`/editor?id=${encodeURIComponent(p.id)}`} className="min-w-0 flex-1 px-3 py-3">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  {p.customer && <span>{p.customer} ·</span>}{p.moduleCount} módulo(s) · {new Date(p.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  {p.revisionCount > 0 && <Badge tone="info">{p.revisionCount} rev.</Badge>}
                </span>
              </Link>
              <button type="button" className={iconBtn} onClick={() => duplicate(p.id)} aria-label={`Duplicar ${p.name}`} title="Duplicar"><Copy className="h-4 w-4" /></button>
              <button type="button" className={`${iconBtn} hover:text-err`} onClick={() => remove(p.id, p.name)} aria-label={`Eliminar ${p.name}`} title="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
