'use client';
import { useMemo, type ReactNode } from 'react';
import { DEFAULT_CATALOG, calculateProject, createProject } from '@ms/domain';
import { WorkshopModelProvider } from './WorkshopViews';

/** Modelo de ejemplo (base de cocina) para la guía general del taller. */
export function SampleModelProvider({ children }: { children: ReactNode }) {
  const { project, calc } = useMemo(() => {
    const project = createProject({ id: 'ejemplo-taller', name: 'Ejemplo: base de cocina', familyId: 'kitchen_base', now: '2026-01-01T00:00:00.000Z' }, DEFAULT_CATALOG);
    return { project, calc: calculateProject(project, DEFAULT_CATALOG) };
  }, []);
  return <WorkshopModelProvider project={project} calc={calc}>{children}</WorkshopModelProvider>;
}
