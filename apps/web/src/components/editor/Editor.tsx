'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CATALOG, createModule, nextModuleId, planProject,
  type ModuleSpec, type PricingSettings, type Project, type ProjectRevisionRecord, type SupplierOffer,
} from '@ms/domain';
import { errorMessage } from '@/lib/api';
import { getDataClient } from '@/lib/data';
import { Alert, Button, Panel, releaseLabel } from '../ui';
import { ModuleForm, ModuleList } from './ModulePanel';
import { Viewer } from './Viewer';
import { AssemblyTab, CutTab, HardwareTab, MachiningTab, PartsTab } from './ProductionTabs';
import { ExportTab, HistoryTab, OffersTab, QualityTab, QuoteTab } from './CommercialTabs';
import { WorkshopTab } from './WorkshopTab';
import { PriceTab } from './PriceTab';
import { ArrowLeft, BadgeDollarSign, Box, Calculator, Check, CloudOff, Download, Drill, Factory, Hammer, History, List, LoaderCircle, Scissors, ShieldCheck, Store, Wrench } from 'lucide-react';
import { QuickDims } from './QuickDims';
import { useLang } from '@/lib/lang';

const TABS = [
  { id: 'model', label: 'Modelo', icon: Box },
  { id: 'parts', label: 'Despiece', icon: List },
  { id: 'cut', label: 'Corte', icon: Scissors },
  { id: 'hardware', label: 'Herrajes', icon: Wrench },
  { id: 'machining', label: 'Perforación', icon: Drill },
  { id: 'assembly', label: 'Montaje', icon: Hammer },
  { id: 'workshop', label: 'Taller', icon: Factory },
  { id: 'offers', label: 'Proveedores', icon: Store },
  { id: 'quote', label: 'Presupuesto', icon: Calculator },
  { id: 'price', label: 'Precio de venta', icon: BadgeDollarSign },
  { id: 'qc', label: 'Calidad', icon: ShieldCheck },
  { id: 'export', label: 'Exportar', icon: Download },
  { id: 'history', label: 'Historial', icon: History },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function Editor({ initial }: { initial: Project }) {
  const { t } = useLang();
  const [project, setProject] = useState<Project>(initial);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [tab, setTab] = useState<TabId>('model');
  const [selectedModule, setSelectedModule] = useState<string | null>(initial.modules[0]?.id ?? null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Omit<ProjectRevisionRecord, 'snapshot'>[] | null>(null);
  const [viewing, setViewing] = useState<{ id: string; number: number; draft: Project } | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const readOnly = viewing !== null;

  useEffect(() => { getDataClient().then((c) => c.listOffers()).then(setOffers).catch((e) => setError(errorMessage(e))); }, []);
  const loadRevisions = useCallback(() => {
    getDataClient().then((c) => c.listRevisions(initial.id)).then(setRevisions).catch((e) => setError(errorMessage(e)));
  }, [initial.id]);
  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  const { plan, calcError } = useMemo(() => {
    try {
      return { plan: planProject(project, DEFAULT_CATALOG, offers, today, 'vista-previa'), calcError: null };
    } catch (e) { return { plan: null, calcError: errorMessage(e) }; }
  }, [project, offers, today]);

  // Contador de cambios: permite guardar en segundo plano sin perder lo que se edita mientras tanto.
  const version = useRef(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const update = useCallback((p: Project) => {
    if (readOnly) return;
    version.current++;
    setProject(p);
    setDirty(true);
    setNotice(null);
    setSaveFailed(false);
  }, [readOnly]);
  const updateModule = (m: ModuleSpec) => update({ ...project, modules: project.modules.map((x) => (x.id === m.id ? m : x)) });
  const updatePricing = (pr: PricingSettings) => update({ ...project, pricing: pr });

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return false;
    const v = version.current;
    setSaving(true); setError(null);
    try {
      const saved = await (await getDataClient()).saveProject(project, savedAt);
      setSavedAt(saved.updatedAt);
      if (version.current === v) { setProject(saved); setDirty(false); }
      else setProject((cur) => ({ ...cur, updatedAt: saved.updatedAt })); // hubo cambios durante el guardado: se guardan después
      return true;
    } catch (e) { setError(`No se guardó: ${errorMessage(e)}`); setSaveFailed(true); return false; } finally { setSaving(false); }
  }, [project, savedAt, readOnly]);

  // Guardado automático 1.2 s después del último cambio (se detiene si falla, hasta el siguiente cambio).
  useEffect(() => {
    if (!dirty || readOnly || saving || saveFailed) return;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
  }, [project, dirty, readOnly, saving, saveFailed, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); };
  }, [save, dirty]);

  async function openRevision(id: string) {
    try {
      const revision = await (await getDataClient()).getRevision(project.id, id);
      if (!revision) throw new Error('Revisión no encontrada');
      setViewing({ id, number: revision.number, draft: project });
      setProject(revision.snapshot);
      setSelectedModule(revision.snapshot.modules[0]?.id ?? null);
      setTab('model');
    } catch (e) { setError(errorMessage(e)); }
  }
  function closeRevision(restore: boolean) {
    if (!viewing) return;
    if (restore) { setProject({ ...project, updatedAt: viewing.draft.updatedAt }); setDirty(true); setNotice(`Revisión ${viewing.number} restaurada como borrador: guarde para confirmar.`); }
    else setProject(viewing.draft);
    setViewing(null);
  }

  const mod = project.modules.find((m) => m.id === selectedModule) ?? project.modules[0] ?? null;
  /** Punto de estado en pestañas: Calidad (liberación) y Presupuesto (cotización). */
  const dot = (id: string) => {
    if (!plan) return null;
    const tone = id === 'qc' ? (plan.calc.releaseStatus === 'NO_FABRICABLE' ? 'bg-err' : plan.calc.releaseStatus === 'LIBERADO_CON_APROBACION' ? 'bg-ok' : 'bg-warn')
      : id === 'quote' ? (plan.quote.completeness === 'COMPLETO' ? 'bg-ok' : 'bg-warn') : null;
    const label = id === 'qc' ? releaseLabel[plan.calc.releaseStatus] : id === 'quote' ? `Cotización ${plan.quote.completeness.toLowerCase()}` : '';
    return tone ? <span className={`h-2 w-2 rounded-full ${tone}`} title={label} aria-label={label} role="img" /> : null;
  };
  const calc = plan?.calc;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Link href="/proyectos" aria-label="Mis proyectos" title="Mis proyectos" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#22313e]"><ArrowLeft className="h-5 w-5" /></Link>
        <input data-testid="project-name" aria-label="Nombre del proyecto" className="!w-auto min-w-0 flex-1 !border-transparent !bg-transparent !px-1 text-[18px] font-bold hover:!border-line focus:!border-accent sm:max-w-md" value={project.name} maxLength={160} onChange={(e) => update({ ...project, name: e.target.value })} disabled={readOnly} />
        <span aria-live="polite" data-testid="save-state" className={`flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold ${saveFailed ? 'bg-err-bg text-err' : dirty || saving ? 'text-muted' : 'text-ok'}`}>
          {readOnly ? 'Solo lectura' : saveFailed ? <><CloudOff aria-hidden className="h-3.5 w-3.5" />No guardado</> : saving || dirty ? <><LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" />Guardando…</> : <><Check aria-hidden className="h-3.5 w-3.5" />Guardado</>}
        </span>
        {saveFailed && <Button onClick={save} data-testid="save">Reintentar</Button>}
        {!saveFailed && <button type="button" onClick={save} disabled={saving || !dirty || readOnly} data-testid="save" className="sr-only">Guardar</button>}
        <details className="relative w-full sm:w-auto">
          <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-[#bce8f2] [&::-webkit-details-marker]:hidden">{project.customer || project.site ? `${project.customer}${project.customer && project.site ? ' · ' : ''}${project.site}` : '+ Cliente y obra'}</summary>
          <div className="mt-2 grid gap-2 sm:absolute sm:z-20 sm:w-80 sm:rounded-xl sm:border sm:border-line sm:bg-panel sm:p-3">
            <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Cliente<input value={project.customer} maxLength={160} onChange={(e) => update({ ...project, customer: e.target.value })} disabled={readOnly} /></label>
            <label className="grid gap-1 text-[11.5px] font-semibold text-[#aebdcc]">Obra<input value={project.site} maxLength={240} onChange={(e) => update({ ...project, site: e.target.value })} disabled={readOnly} /></label>
          </div>
        </details>
      </div>
      {viewing && (
        <Alert tone="info">
          Viendo la revisión {viewing.number} (congelada, solo lectura).{' '}
          <Button variant="secondary" onClick={() => closeRevision(false)}>Volver al borrador</Button>{' '}
          <Button variant="secondary" onClick={() => closeRevision(true)}>Restaurar como borrador</Button>
        </Alert>
      )}
      {error && <Alert tone="err">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}
      {calcError && <Alert tone="err">Error de cálculo: {calcError}</Alert>}

      <div className="grid gap-3 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="order-2 grid content-start gap-3 no-print lg:order-1">
          <Panel title="Módulos">
            <fieldset disabled={readOnly}>
              <ModuleList modules={project.modules} results={calc?.modules ?? []} selected={mod?.id ?? null} onSelect={setSelectedModule}
                onAdd={(fid) => { const id = nextModuleId(project); update({ ...project, modules: [...project.modules, createModule(fid, DEFAULT_CATALOG, id)] }); setSelectedModule(id); }}
                onRemove={(id) => { const rest = project.modules.filter((m) => m.id !== id); update({ ...project, modules: rest }); setSelectedModule(rest[0]?.id ?? null); }}
                onDuplicate={(id) => { const src = project.modules.find((m) => m.id === id)!; const nid = nextModuleId(project); update({ ...project, modules: [...project.modules, { ...structuredClone(src), id: nid, label: `${src.label} (copia)` }] }); setSelectedModule(nid); }}
                onMove={(id, dir) => { const i = project.modules.findIndex((m) => m.id === id); const j = i + dir; if (j < 0 || j >= project.modules.length) return; const arr = [...project.modules]; [arr[i], arr[j]] = [arr[j]!, arr[i]!]; update({ ...project, modules: arr }); }}
              />
            </fieldset>
          </Panel>
          {mod && <Panel title={`Configurar ${mod.id}`}><fieldset disabled={readOnly}><ModuleForm key={mod.id} m={mod} onChange={updateModule} /></fieldset></Panel>}
        </aside>

        <Panel className="order-1 min-w-0 lg:order-2">
          <div role="tablist" aria-label="Secciones del proyecto" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 no-print lg:flex-wrap lg:overflow-visible">
            {TABS.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${tab === t.id ? 'bg-accent text-accent-ink' : 'bg-[#253541] text-[#e5edf3] hover:bg-[#2d4150]'}`}><t.icon aria-hidden className="h-4 w-4" />{t.label}{dot(t.id)}</button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {!plan || !calc ? <Alert tone="err">No hay cálculo disponible.</Alert> : (
              <>
                {tab === 'model' && (
                  <div className="grid gap-3">
                    {mod && <QuickDims modules={project.modules} selected={mod.id} onSelect={setSelectedModule} onChange={updateModule} disabled={readOnly} />}
                    <div className="flex flex-wrap gap-1.5 text-[12.5px]">
                      <span className="rounded-full bg-panel-2 px-2.5 py-1"><strong>{calc.totals.panelCount}</strong> piezas</span>
                      {plan.nesting.map((n) => <span key={n.materialId} className="rounded-full bg-panel-2 px-2.5 py-1"><strong>{n.sheetsRequired ?? '?'}</strong> tablero{n.sheetsRequired === 1 ? '' : 's'} {n.thicknessMm} mm</span>)}
                      <span className="rounded-full bg-panel-2 px-2.5 py-1"><strong>{Math.round(calc.modules.reduce((s, m) => s + m.weightKg, 0))}</strong> kg</span>
                      {(() => { const all = calc.modules.flatMap((m) => m.checks); const e = all.filter((c) => c.status === 'error').length; const w = all.filter((c) => c.status === 'warning').length; return (
                        <button type="button" onClick={() => setTab('qc')} data-testid="checks-summary" className={`rounded-full px-2.5 py-1 font-semibold ${e ? 'bg-err-bg text-err' : w ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'}`}>{e ? `${e} error(es)` : w ? `${w} aviso(s)` : 'Todo cuadra'}</button>
                      ); })()}
                    </div>
                    {calc.issues.filter((i) => i.severity === 'error').map((i, k) => <Alert key={k} tone="err">{i.moduleId ? `${i.moduleId}: ` : ''}{t(i.message)}</Alert>)}
                    <Viewer project={project} calc={calc} selected={selectedPart} onSelect={setSelectedPart} />
                  </div>
                )}
                {tab === 'parts' && <PartsTab plan={plan} selected={selectedPart} onSelect={setSelectedPart} />}
                {tab === 'cut' && <CutTab plan={plan} project={project} onCut={(c) => update({ ...project, cut: c })} />}
                {tab === 'hardware' && <HardwareTab plan={plan} />}
                {tab === 'machining' && <MachiningTab plan={plan} />}
                {tab === 'assembly' && <AssemblyTab plan={plan} project={project} />}
                {tab === 'workshop' && <WorkshopTab plan={plan} project={project} />}
                {tab === 'offers' && <OffersTab plan={plan} project={project} offers={offers} today={today} onPricing={updatePricing} />}
                {tab === 'quote' && <QuoteTab plan={plan} project={project} onPricing={updatePricing} saved={!dirty && !readOnly} />}
                {tab === 'price' && <PriceTab plan={plan} project={project} onPricing={updatePricing} readOnly={readOnly} />}
                {tab === 'qc' && <QualityTab plan={plan} project={project} onProject={update} />}
                {tab === 'export' && <ExportTab project={project} dirty={dirty} onSave={save} revisionId={viewing?.id ?? null} />}
                {tab === 'history' && (
                  <HistoryTab revisions={revisions} saved={!dirty && !readOnly} onOpen={openRevision} onRefresh={loadRevisions}
                    onCreate={async (note) => {
                      try { await (await getDataClient()).createRevision(project.id, note); setNotice('Revisión congelada.'); loadRevisions(); } catch (e) { setError(errorMessage(e)); }
                    }} />
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
