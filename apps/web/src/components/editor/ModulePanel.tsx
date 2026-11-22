'use client';
import { CATEGORY_LABELS, DEFAULT_CATALOG, FAMILIES, catalogLookup, createModule, type LedPlacement, type ModuleResult, type ModuleSpec } from '@ms/domain';
import { Badge, Button, More } from '../ui';
import { NumberInput, SelectInput, TextInput } from './inputs';

const L = catalogLookup(DEFAULT_CATALOG);
const boards = DEFAULT_CATALOG.materials.filter((m) => m.kind !== 'back_panel');
const backs = DEFAULT_CATALOG.materials.filter((m) => m.kind === 'back_panel');

export function ModuleList({ modules, results, selected, onSelect, onAdd, onRemove, onMove, onDuplicate }: {
  modules: ModuleSpec[]; results: ModuleResult[]; selected: string | null;
  onSelect: (id: string) => void; onAdd: (familyId: string) => void; onRemove: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void; onDuplicate: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5" aria-label="Módulos del proyecto">
        {modules.map((m, i) => {
          const r = results.find((x) => x.moduleId === m.id);
          const errors = r?.issues.filter((x) => x.severity === 'error').length ?? 0;
          const active = m.id === selected;
          return (
            <li key={m.id} className={`rounded-xl border px-2.5 py-2 ${active ? 'border-accent bg-[#1d3442]' : 'border-line bg-panel-2'}`}>
              <button type="button" className="w-full text-left" onClick={() => onSelect(m.id)} aria-pressed={active} data-testid={`module-${m.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.id} · {m.label}</span>
                  {errors > 0 ? <Badge tone="err">{errors} error(es)</Badge> : <Badge tone="ok">OK</Badge>}
                </div>
                <div className="text-[11.5px] text-muted">{m.widthMm} × {m.heightMm} × {m.depthMm} mm · {L.family(m.familyId).name}</div>
              </button>
              {active && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button variant="ghost" onClick={() => onMove(m.id, -1)} disabled={i === 0} aria-label="Mover a la izquierda">←</Button>
                  <Button variant="ghost" onClick={() => onMove(m.id, 1)} disabled={i === modules.length - 1} aria-label="Mover a la derecha">→</Button>
                  <Button variant="ghost" onClick={() => onDuplicate(m.id)}>Duplicar</Button>
                  <Button variant="ghost" onClick={() => onRemove(m.id)} disabled={modules.length === 1}>Quitar</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <label className="text-[11.5px] font-semibold text-[#aebdcc]" htmlFor="add-module">Agregar módulo</label>
      <select id="add-module" data-testid="add-module" value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}>
        <option value="">Elegir familia…</option>
        {[...new Set(FAMILIES.map((f) => f.category))].map((c) => (
          <optgroup key={c} label={CATEGORY_LABELS[c]}>{FAMILIES.filter((f) => f.category === c).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
}

const LED_PLACES: { value: LedPlacement; label: string }[] = [
  { value: 'none', label: 'Sin LED' },
  { value: 'under_cabinet', label: 'Bajo el mueble (ilumina la cubierta)' },
  { value: 'shelves', label: 'Bajo cada entrepaño' },
  { value: 'sides', label: 'Vertical en costados' },
  { value: 'top_inside', label: 'Bajo la tapa (interior)' },
];

export function ModuleForm({ m, onChange }: { m: ModuleSpec; onChange: (m: ModuleSpec) => void }) {
  const set = <K extends keyof ModuleSpec>(k: K, v: ModuleSpec[K]) => onChange({ ...m, [k]: v });
  const fam = L.family(m.familyId);
  const isDesk = fam.geometryStrategy === 'desk';
  const hinges = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'hinge');
  const slides = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'drawer_slide');
  const ledStrips = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'led_strip');
  const ledProfiles = DEFAULT_CATALOG.hardware.filter((h) => h.category === 'led_profile');
  const steelOn = isDesk ? m.steel.enabled : m.baseType === 'steel_frame';
  return (
    <div className="grid gap-3" aria-label={`Configuración de ${m.id}`}>
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="Nombre del módulo" value={m.label} onChange={(v) => set('label', v)} testId="mod-label" maxLength={120} />
        <SelectInput label="Familia" value={m.familyId} onChange={(v) => set('familyId', v)} options={FAMILIES.map((f) => ({ value: f.id, label: f.name }))} testId="mod-family"
hint={fam.status === 'verified_vertical' ? '✓ Verificada' : fam.status === 'configurable_base_template' ? 'Plantilla' : 'Aproximada'} />
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Medidas exteriores">
        <NumberInput label="Ancho" suffix="mm" value={m.widthMm} min={1} max={6000} onChange={(v) => set('widthMm', v)} testId="mod-width" />
        <NumberInput label="Alto" suffix="mm" value={m.heightMm} min={1} max={4000} onChange={(v) => set('heightMm', v)} testId="mod-height" />
        <NumberInput label="Fondo" suffix="mm" value={m.depthMm} min={1} max={2000} onChange={(v) => set('depthMm', v)} testId="mod-depth" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SelectInput label="Tablero" value={m.materialId} onChange={(v) => onChange({ ...m, materialId: v, thicknessMm: L.material(v).thicknessMm })} options={boards.map((b) => ({ value: b.id, label: b.name }))} testId="mod-material" />
        <SelectInput label="Acabado" value={m.finishId} onChange={(v) => set('finishId', v)} options={DEFAULT_CATALOG.finishes.map((f) => ({ value: f.id, label: f.name }))} testId="mod-finish" />
        {!isDesk && <SelectInput label="Frente" value={m.front} onChange={(v) => onChange({ ...m, front: v, drawerCount: v === 'drawers' && m.drawerCount === 0 ? 3 : v === 'drawer_doors' ? Math.min(3, Math.max(1, m.drawerCount || 1)) : m.drawerCount })} options={[{ value: 'open', label: 'Abierto' }, { value: 'doors', label: 'Puertas' }, { value: 'drawers', label: 'Cajones' }, { value: 'drawer_doors', label: 'Cajón arriba + puertas' }, { value: 'fold_down', label: 'Abatible (baja y se cierra)' }]} testId="mod-front" />}
        {!isDesk && m.front === 'fold_down' && <SelectInput label="Abierto se usa como" value={m.foldKind} onChange={(v) => set('foldKind', v)} testId="mod-fold"
          options={[{ value: 'desk', label: 'Escritorio (compases)' }, { value: 'table', label: 'Mesa o barra (escuadras)' }, { value: 'bed', label: 'Cama (pistones)' }]} />}
        {!isDesk && (m.front === 'doors' || m.front === 'drawer_doors') && <SelectInput label="Número de puertas" value={String(m.doorCount ?? 'auto')} onChange={(v) => set('doorCount', v === 'auto' ? null : Number(v))} options={[{ value: 'auto', label: 'Automático (≤600 mm)' }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))]} />}
        {!isDesk && m.front === 'drawers' && <NumberInput label="Cajones" value={m.drawerCount} min={1} max={10} onChange={(v) => set('drawerCount', Math.round(v))} testId="mod-drawers" />}
        {!isDesk && m.front === 'drawer_doors' && <SelectInput label="Cajones arriba" value={String(Math.min(3, Math.max(1, m.drawerCount || 1)))} onChange={(v) => set('drawerCount', Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} de 160 mm` }))} testId="mod-top-drawers" />}
        {!isDesk && m.front === 'drawers' && m.drawerCount > 1 && <SelectInput label="Altura de cajones" value={m.drawerLayout} onChange={(v) => set('drawerLayout', v)} options={[{ value: 'equal', label: 'Iguales' }, { value: 'graduated', label: 'Chicos arriba, altos abajo' }]} testId="mod-drawer-layout" />}
        {!isDesk && m.front !== 'drawers' && <NumberInput label={fam.geometryStrategy === 'wardrobe' ? 'Entrepaños (1 = maletero)' : 'Entrepaños por hueco'} value={m.shelvesPerBay} min={0} max={12} onChange={(v) => set('shelvesPerBay', Math.round(v))} testId="mod-shelves" />}
        {!isDesk && (m.front === 'doors' || m.front === 'drawer_doors') && <SelectInput label="Bisagra" value={m.hingeProductId ?? ''} onChange={(v) => set('hingeProductId', v || null)} options={[{ value: '', label: 'Genérica (pendiente de SKU)' }, ...hinges.map((h) => ({ value: h.id, label: h.name }))]} testId="mod-hinge" />}
        {!isDesk && (m.front === 'drawers' || m.front === 'drawer_doors') && <SelectInput label="Corredera" value={m.slideProductId ?? ''} onChange={(v) => set('slideProductId', v || null)} options={[{ value: '', label: 'Genérica (valores típicos)' }, ...slides.map((h) => ({ value: h.id, label: h.name }))]} testId="mod-slide" />}
        {!isDesk && <SelectInput label="Base" value={m.baseType} onChange={(v) => set('baseType', v)} options={[{ value: 'none', label: 'Sin base' }, { value: 'plinth', label: 'Zoclo (bastidor)' }, { value: 'levelers', label: 'Patas niveladoras' }, { value: 'legs', label: 'Patas de madera' }, { value: 'steel_frame', label: 'Bastidor PTR' }]} testId="mod-base" />}
        {!isDesk && m.mount === 'wall' && <NumberInput label="Altura del piso" suffix="mm" value={m.elevationMm ?? (m.familyId.startsWith('kitchen') ? 1450 : 450)} min={0} max={3000} onChange={(v) => set('elevationMm', v)} hint="Al fondo del mueble" testId="mod-elevation" />}
        {!isDesk && m.baseType !== 'none' && <NumberInput label="Altura de base" suffix="mm" value={m.baseHeightMm} min={0} max={1200} onChange={(v) => set('baseHeightMm', v)} />}
        {isDesk && <SelectInput label="Estructura" value={m.steel.enabled ? 'steel' : 'panel'} onChange={(v) => set('steel', { ...m.steel, enabled: v === 'steel' })} options={[{ value: 'panel', label: 'Costados tipo panel' }, { value: 'steel', label: 'Bastidor de PTR' }]} testId="mod-desk-structure" />}
      </div>
      <More summary={m.led.placement === 'none' ? 'Iluminación LED' : `Iluminación LED · ${LED_PLACES.find((x) => x.value === m.led.placement)?.label ?? ''}`}>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput label="Tira LED" value={m.led.placement} onChange={(v) => set('led', { ...m.led, placement: v })} options={LED_PLACES} testId="mod-led"
            hint={m.led.placement === 'none' ? undefined : 'Va empotrada: se fresa una ranura con router'} />
          {m.led.placement !== 'none' && <>
            <SelectInput label="Sensor / encendido" value={m.led.sensor} onChange={(v) => set('led', { ...m.led, sensor: v })} testId="mod-led-sensor"
              options={[{ value: 'none', label: 'Desde la fuente / apagador' }, { value: 'door', label: 'Al abrir la puerta' }, { value: 'hand', label: 'Sensor de mano' }, { value: 'touch', label: 'Táctil con atenuador' }]} />
            <SelectInput label="Tipo de tira" value={m.led.stripProductId} onChange={(v) => set('led', { ...m.led, stripProductId: v })} options={ledStrips.map((h) => ({ value: h.id, label: h.name }))} />
            <SelectInput label="Perfil (ranura)" value={m.led.profileProductId} onChange={(v) => set('led', { ...m.led, profileProductId: v })} options={ledProfiles.map((h) => ({ value: h.id, label: h.name }))} />
          </>}
        </div>
      </More>
      <More summary={m.mirror.enabled ? `Espejo · ${m.mirror.widthMm} × ${m.mirror.heightMm}` : 'Espejo'}>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput label="Espejo" value={m.mirror.enabled ? m.mirror.light : 'off'} testId="mod-mirror"
            onChange={(v) => set('mirror', v === 'off' ? { ...m.mirror, enabled: false } : { ...m.mirror, enabled: true, light: v })}
            options={[{ value: 'off', label: 'Sin espejo' }, { value: 'none', label: 'Espejo sencillo' }, { value: 'backlit', label: 'Con luz LED trasera' }, { value: 'hollywood', label: 'Hollywood (focos)' }]} />
          {m.mirror.enabled && <>
            <NumberInput label="Ancho" suffix="mm" value={m.mirror.widthMm} min={100} max={3000} onChange={(v) => set('mirror', { ...m.mirror, widthMm: v })} />
            <NumberInput label="Alto" suffix="mm" value={m.mirror.heightMm} min={100} max={3000} onChange={(v) => set('mirror', { ...m.mirror, heightMm: v })} />
            <NumberInput label="Separación" suffix="mm" value={m.mirror.gapMm} min={0} max={1500} onChange={(v) => set('mirror', { ...m.mirror, gapMm: v })} hint="Sobre la cubierta" />
          </>}
        </div>
      </More>
      <More summary={m.power.outlets + m.power.grommets ? `Conexión eléctrica · ${m.power.outlets} contacto(s), ${m.power.grommets} pasacables` : 'Conexión eléctrica'}>
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label="Contactos" value={m.power.outlets} min={0} max={6} onChange={(v) => set('power', { ...m.power, outlets: Math.round(v) })} testId="mod-outlets" />
          <SelectInput label="USB" value={m.power.usb ? 'si' : 'no'} onChange={(v) => set('power', { ...m.power, usb: v === 'si' })} options={[{ value: 'no', label: 'Sin USB' }, { value: 'si', label: 'Con USB' }]} />
          <NumberInput label="Pasacables" value={m.power.grommets} min={0} max={6} onChange={(v) => set('power', { ...m.power, grommets: Math.round(v) })} testId="mod-grommets" />
        </div>
      </More>
      <More summary="Cantos y respaldo">
        <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Espesor real" suffix="mm" value={m.thicknessMm} min={3} max={60} step={0.1} onChange={(v) => set('thicknessMm', v)} hint="Medir el tablero real" testId="mod-thickness" />
        <SelectInput label="Respaldo" value={m.backMaterialId ?? ''} onChange={(v) => set('backMaterialId', v || null)} options={[{ value: '', label: 'Sin respaldo' }, ...backs.map((b) => ({ value: b.id, label: b.name }))]} testId="mod-back" />
        <SelectInput label="Tapacanto" value={m.edgeBandId} onChange={(v) => set('edgeBandId', v)} options={DEFAULT_CATALOG.edgeBands.map((f) => ({ value: f.id, label: f.name }))} />
        <SelectInput label="Política de canto" value={m.edgePolicy} onChange={(v) => set('edgePolicy', v)} options={[{ value: 'front_visible_only', label: 'Sólo cantos frontales' }, { value: 'all_visible', label: 'Todos los visibles' }, { value: 'none', label: 'Sin canto' }]} />
        </div>
      </More>
      <More summary="Construcción y ajustes">
        <div className="grid grid-cols-2 gap-2">
          {!isDesk && <SelectInput label="Estrategia de caja" value={m.construction} onChange={(v) => set('construction', v)} options={[{ value: 'top_bottom_between_sides', label: 'Tapa/piso entre costados' }, { value: 'sides_between_top_bottom', label: 'Costados entre tapa/piso' }]} />}
          {!isDesk && <SelectInput label="Unión" value={m.joinery} onChange={(v) => set('joinery', v)} options={[{ value: 'cam', label: 'Excéntrico + taquete' }, { value: 'dowel', label: 'Taquete' }, { value: 'screw', label: 'Tornillo' }, { value: 'mixed', label: 'Mixta' }]} />}
          {!isDesk && <SelectInput label="Divisores" value={String(m.dividerCount ?? 'auto')} onChange={(v) => set('dividerCount', v === 'auto' ? null : Number(v))} options={[{ value: 'auto', label: 'Automático (por flecha calculada)' }, ...[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))]} />}
          {!isDesk && <SelectInput label="Carga en entrepaños" value={String(m.shelfLoadKgM2 ?? 'auto')} onChange={(v) => set('shelfLoadKgM2', v === 'auto' ? null : Number(v))} testId="mod-load"
options={[{ value: 'auto', label: `De la familia (${fam.defaults.shelfLoadKgM2} kg/m²)` }, { value: '15', label: 'Muy ligera · 15 kg/m²' }, { value: '25', label: 'Ligera (ropa, baño) · 25 kg/m²' }, { value: '40', label: 'Media (vajilla, despensa) · 40 kg/m²' }, { value: '80', label: 'Pesada (libros) · 80 kg/m²' }, { value: '120', label: 'Muy pesada (archivo, herramienta) · 120 kg/m²' },
...(m.shelfLoadKgM2 !== null && ![15, 25, 40, 80, 120].includes(m.shelfLoadKgM2) ? [{ value: String(m.shelfLoadKgM2), label: `${m.shelfLoadKgM2} kg/m²` }] : [])]}
hint="Se usa para calcular la flecha y los divisores automáticos" />}
          {!isDesk && m.front !== 'open' && <NumberInput label="Holgura perimetral" suffix="mm" value={m.revealMm} min={0} max={20} step={0.5} onChange={(v) => set('revealMm', v)} />}
          {!isDesk && m.front !== 'open' && <NumberInput label="Holgura entre frentes" suffix="mm" value={m.frontGapMm} min={0} max={20} step={0.5} onChange={(v) => set('frontGapMm', v)} />}
          {!isDesk && <SelectInput label="Montaje" value={m.mount} onChange={(v) => set('mount', v)} options={[{ value: 'floor', label: 'Piso' }, { value: 'wall', label: 'Colgado a muro' }]} />}
          {steelOn && <><SelectInput label="Perfil" value={m.steel.profileId} onChange={(v) => set('steel', { ...m.steel, profileId: v })} options={DEFAULT_CATALOG.steelProfiles.map((p) => ({ value: p.id, label: p.name }))} /><SelectInput label="Acabado metálico" value={m.steel.finish} onChange={(v) => set('steel', { ...m.steel, finish: v })} options={[{ value: 'powder_coating', label: 'Pintura electrostática' }, { value: 'primer', label: 'Primario anticorrosivo' }, { value: 'paint', label: 'Esmalte' }, { value: 'none', label: 'Sin acabado' }]} /></>}
        </div>
        <Button className="mt-2" variant="ghost" onClick={() => {
          const d = createModule(m.familyId, DEFAULT_CATALOG, m.id, m.label);
          onChange({ ...d, materialId: m.materialId, finishId: m.finishId, edgeBandId: m.edgeBandId });
        }}>↺ Valores por defecto de la familia</Button>
      </More>
    </div>
  );
}

