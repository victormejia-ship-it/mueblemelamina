'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CATALOG, type Project, type ProjectCalculation } from '@ms/domain';
import { renderModel, type RenderBox, type RenderModel } from '@ms/geometry';
import { Camera, DoorOpen, Lightbulb, RotateCcw } from 'lucide-react';
import type * as THREE_NS from 'three';

type Three = typeof THREE_NS;
const S = 0.001; // mm → m
const DOOR_KEY = /(^|[-_])DOOR(_\d+)?#\d+$/;
const FOLD_KEY = /-FOLD_LEAF#\d+$/;

/** Textura procedural de veta: franjas suaves con ondulación y poro, en escala de grises para teñir con el color del acabado. */
function grainCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  const img = g.createImageData(512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: 6 }, () => ({ f: 2 + rnd() * 9, a: 2 + rnd() * 10, p: rnd() * 6.28 }));
  const pores = new Float32Array(512).map(() => rnd());
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      // La veta corre a lo largo de x (u); varía con y (v).
      let w = y;
      for (const k of waves) w += Math.sin((x / 512) * Math.PI * 2 * k.f * 0.25 + k.p) * k.a * 0.35;
      const ring = 0.5 + 0.5 * Math.sin(w * 0.075 + Math.sin(w * 0.017) * 2.2);
      const fine = 0.5 + 0.5 * Math.sin(w * 1.3);
      const pore = pores[(y + Math.floor(x / 37)) % 512]! > 0.985 ? -0.12 : 0;
      const v = 0.86 + ring * 0.1 + fine * 0.03 + pore;
      const i = (y * 512 + x) * 4;
      const n = Math.max(0, Math.min(255, Math.round(v * 255)));
      img.data[i] = n; img.data[i + 1] = n; img.data[i + 2] = n; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Caja con UV en metros: en cada cara, u sigue la veta cuando la veta está en esa cara. */
function boxGeometry(T: Three, r: RenderBox): THREE_NS.BufferGeometry {
  const { b } = r;
  // Mundo three: X = x, Y = z (alto), Z = −y (el frente mira a la cámara)
  const X = [b.x0 * S, b.x1 * S], Y = [b.z0 * S, b.z1 * S], Z = [-b.y1 * S, -b.y0 * S];
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const grain = r.grainDir === 'x' ? 0 : r.grainDir === 'z' ? 1 : r.grainDir === 'y' ? 2 : -1; // eje three
  const face = (axis: 0 | 1 | 2, side: 0 | 1) => {
    const others = ([0, 1, 2] as const).filter((a) => a !== axis);
    let [ua, va] = others as [0 | 1 | 2, 0 | 1 | 2];
    if (grain === va) [ua, va] = [va, ua];
    const R = [X, Y, Z];
    const base = pos.length / 3;
    for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const p = [0, 0, 0];
      p[axis] = R[axis]![side]!; p[ua] = R[ua]![i]!; p[va] = R[va]![j]!;
      pos.push(p[0]!, p[1]!, p[2]!);
      const n = [0, 0, 0]; n[axis] = side ? 1 : -1;
      nor.push(n[0]!, n[1]!, n[2]!);
      uv.push(p[ua]! / 0.9, p[va]! / 0.9);
    }
    // Orientación de los triángulos según la normal
    const cross = (() => { const a = [0, 0, 0], c = [0, 0, 0]; a[ua] = 1; c[va] = 1; return [a[1]! * c[2]! - a[2]! * c[1]!, a[2]! * c[0]! - a[0]! * c[2]!, a[0]! * c[1]! - a[1]! * c[0]!][axis]!; })();
    const out = (side ? 1 : -1) * cross > 0;
    if (out) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  for (const a of [0, 1, 2] as const) { face(a, 0); face(a, 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

interface Ctx { T: Three; renderer: THREE_NS.WebGLRenderer; scene: THREE_NS.Scene; camera: THREE_NS.PerspectiveCamera; controls: { target: THREE_NS.Vector3; update: () => void; reset: () => void; saveState: () => void }; model: THREE_NS.Group; room: THREE_NS.Group; grain: THREE_NS.CanvasTexture }

function disposeGroup(g: THREE_NS.Group) {
  g.traverse((o) => {
    const m = o as THREE_NS.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
  g.clear();
}

/** Arma el mueble y el cuarto; abre las puertas girándolas sobre su lado de bisagra. */
function buildModel(ctx: Ctx, rm: RenderModel, doorsOpen: boolean, fresh: boolean, ledOn: boolean) {
  const { T, model, room, grain } = ctx;
  disposeGroup(model); disposeGroup(room);
  const mats = new Map<string, THREE_NS.Material>();
  const matFor = (r: RenderBox) => {
    const key = `${r.material.kind}|${r.material.color}|${r.material.grain}`;
    let m = mats.get(key);
    if (!m) {
      const color = new T.Color(r.material.color);
      m = r.material.kind === 'mirror' ? new T.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.07, emissive: new T.Color('#3c5058'), emissiveIntensity: 0.35 })
        : r.material.kind === 'led' ? new T.MeshStandardMaterial({ color, roughness: 0.3, emissive: new T.Color('#ffc978'), emissiveIntensity: ledOn ? 4 : 0.02 })
        : r.material.kind === 'handle' ? new T.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.28 })
        : r.material.kind === 'steel' ? new T.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.45 })
        : new T.MeshStandardMaterial({ color, roughness: r.material.grain ? 0.62 : 0.5, metalness: 0, map: r.material.grain ? grain : null });
      mats.set(key, m);
    }
    return m;
  };
  const edgeMat = new T.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
  // Pivotes de puertas
  const doorPivot = new Map<string, { pivot: THREE_NS.Group; sign: number; base?: number }>();
  let ledLights = 0;
  for (const r of rm.boxes) {
    const mesh = new T.Mesh(boxGeometry(T, r), matFor(r));
    const isLed = r.material.kind === 'led';
    mesh.castShadow = !isLed; mesh.receiveShadow = !isLed;
    if (isLed && ledOn && r.lightDir && ledLights < 16) {
      // Luz de la tira: foco suave hacia donde apunta (coordenadas three: X = x, Y = z, Z = −y).
      ledLights++;
      const [dx, dy, dz] = r.lightDir;
      const c = new T.Vector3(((r.b.x0 + r.b.x1) / 2) * S, ((r.b.z0 + r.b.z1) / 2) * S, -((r.b.y0 + r.b.y1) / 2) * S);
      const dir = new T.Vector3(dx, dz, -dy);
      const lenM = Math.max(r.b.x1 - r.b.x0, r.b.z1 - r.b.z0) * S;
      const spot = new T.SpotLight(0xffd29a, 2.2 + lenM * 2.5, 3, Math.PI * 0.42, 1, 1.6);
      spot.position.copy(c).addScaledVector(dir, 0.01);
      spot.target.position.copy(c).addScaledVector(dir, 1);
      model.add(spot, spot.target);
    }
    mesh.name = r.key;
    if (!isLed) mesh.add(new T.LineSegments(new T.EdgesGeometry(mesh.geometry), edgeMat));
    const doorKey = r.key.replace(/-jaladera$/, '');
    const isDoor = DOOR_KEY.test(doorKey);
    const isFold = FOLD_KEY.test(doorKey);
    if (doorsOpen && isFold) {
      // Frente abatible: gira sobre su canto inferior hasta quedar horizontal (hacia el frente).
      let d = doorPivot.get(doorKey);
      if (!d) {
        const host = rm.boxes.find((x) => x.key === doorKey)!;
        const pivot = new T.Group();
        pivot.position.set(0, host.b.z0 * S, -host.b.y0 * S);
        pivot.rotation.x = Math.PI / 2;
        model.add(pivot);
        // Cama: la base queda a la altura del mecanismo y lleva colchón.
        const bed = host.fold?.kind === 'bed';
        d = { pivot, sign: 1, base: pivot.position.y };
        doorPivot.set(doorKey, d);
        if (bed) {
          const mattress = new T.Mesh(boxGeometry(T, { ...host, key: `${doorKey}-colchon`, grainDir: null, b: { x0: host.b.x0 + 15, x1: host.b.x1 - 15, y0: host.b.y0 - 200, y1: host.b.y0, z0: host.b.z0 + 20, z1: host.b.z1 - 20 } }), new T.MeshStandardMaterial({ color: new T.Color('#dfe6ec'), roughness: 0.9 }));
          mattress.castShadow = true; mattress.receiveShadow = true;
          mattress.position.set(0, -pivot.position.y, -pivot.position.z);
          pivot.add(mattress);
          pivot.position.y = Math.max(pivot.position.y, (host.fold!.surfaceMm - 18) * S);
        }
      }
      mesh.position.set(0, -d.base!, -d.pivot.position.z);
      d.pivot.add(mesh);
    } else if (doorsOpen && isDoor) {
      let d = doorPivot.get(doorKey);
      if (!d) {
        const host = rm.boxes.find((x) => x.key === doorKey)!;
        const handle = rm.boxes.find((x) => x.key === `${doorKey}-jaladera`);
        const cx = (host.b.x0 + host.b.x1) / 2;
        const handleRight = handle ? (handle.b.x0 + handle.b.x1) / 2 > cx : true;
        const hingeX = (handleRight ? host.b.x0 : host.b.x1) * S;
        const pivot = new T.Group();
        pivot.position.set(hingeX, 0, -host.b.y0 * S);
        pivot.rotation.y = (handleRight ? -1 : 1) * (Math.PI * 0.55);
        model.add(pivot);
        d = { pivot, sign: handleRight ? -1 : 1 };
        doorPivot.set(doorKey, d);
      }
      mesh.position.set(-d.pivot.position.x, 0, -d.pivot.position.z);
      d.pivot.add(mesh);
    } else model.add(mesh);
  }
  // Cuarto: piso y muro detrás del mueble
  const B = rm.bounds;
  const w = (B.x1 - B.x0) * S, cx = ((B.x0 + B.x1) / 2) * S;
  const floor = new T.Mesh(new T.PlaneGeometry(Math.max(30, w * 6), 30), new T.MeshStandardMaterial({ color: 0xcfc8bd, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, -B.y1 * S + 15 - 0.001); floor.receiveShadow = true;
  const wallH = Math.max(8, B.z1 * S + 4);
  const wall = new T.Mesh(new T.PlaneGeometry(Math.max(30, w * 6), wallH), new T.MeshStandardMaterial({ color: 0xeeebe5, roughness: 0.95 }));
  wall.position.set(cx, wallH / 2, -B.y1 * S - 0.002); wall.receiveShadow = true;
  room.add(floor, wall);
  if (fresh) frame(ctx, rm);
}

/** Encuadre de 3/4 desde el frente, a la altura de los ojos. */
function frame(ctx: Ctx, rm: RenderModel) {
  const B = rm.bounds;
  const size = Math.max((B.x1 - B.x0), (B.z1 - B.z0), (B.y1 - B.y0)) * S;
  const c = new ctx.T.Vector3(((B.x0 + B.x1) / 2) * S, ((B.z0 + B.z1) / 2) * S, -((B.y0 + B.y1) / 2) * S);
  const dist = size / (2 * Math.tan((ctx.camera.fov * Math.PI) / 360)) * 1.55;
  ctx.camera.position.set(c.x + dist * 0.45, c.y + size * 0.3, c.z + dist * 0.9);
  ctx.camera.near = 0.01; ctx.camera.far = 60; ctx.camera.updateProjectionMatrix();
  ctx.controls.target.copy(c);
  ctx.controls.update();
  ctx.controls.saveState();
  const sun = ctx.scene.getObjectByName('sun') as THREE_NS.DirectionalLight;
  sun.position.set(c.x - size * 1.2, c.y + size * 2.2, c.z + size * 1.8);
  sun.target.position.copy(c);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -size * 3; cam.right = cam.top = size * 3; cam.near = 0.05; cam.far = size * 10; cam.updateProjectionMatrix();
}

export default function RenderView({ project, calc }: { project: Project; calc: ProjectCalculation }) {
  const host = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [finish, setFinish] = useState<string>('');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const rm = useMemo(() => renderModel(project, calc, DEFAULT_CATALOG, finish || undefined), [project, calc, finish]);
  const hasDoors = useMemo(() => rm.boxes.some((b) => DOOR_KEY.test(b.key) || FOLD_KEY.test(b.key)), [rm]);
  const hasLed = useMemo(() => rm.boxes.some((b) => b.material.kind === 'led'), [rm]);
  const framedFor = useRef<string>('');

  // Inicializa three una sola vez (se carga sólo cuando se abre el render)
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const T = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
        if (disposed || !host.current) return;
        const el = host.current;
        const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.setAttribute('data-testid', 'render-canvas');
        el.appendChild(renderer.domElement);
        const scene = new T.Scene();
        scene.background = new T.Color(0xe9e6e0);
        const pmrem = new T.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.75;
        const sun = new T.DirectionalLight(0xfff3e2, 1.7);
        sun.name = 'sun'; sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
        scene.add(sun, sun.target, Object.assign(new T.HemisphereLight(0xffffff, 0xb9ad9c, 0.35), { name: 'sky' }));
        const camera = new T.PerspectiveCamera(35, 1, 0.01, 60);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.52; controls.minDistance = 0.4; controls.maxDistance = 14;
        const tex = new T.CanvasTexture(grainCanvas());
        tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
        const model = new T.Group(), room = new T.Group();
        scene.add(model, room);
        ctxRef.current = { T, renderer, scene, camera, controls, model, room, grain: tex };
        const resize = () => {
          const w = el.clientWidth, h = Math.max(300, Math.min(620, Math.round(w * 0.68)));
          renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize); ro.observe(el);
        renderer.setAnimationLoop(() => { if (document.hidden) return; controls.update(); renderer.render(scene, camera); });
        cleanup = () => {
          ro.disconnect(); renderer.setAnimationLoop(null); controls.dispose();
          disposeGroup(model); disposeGroup(room); tex.dispose(); pmrem.dispose(); scene.environment?.dispose();
          renderer.dispose(); renderer.domElement.remove(); ctxRef.current = null;
        };
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ready || !ctx) return;
    // Reencuadra sólo cuando cambian las medidas, no al cambiar acabado o abrir puertas
    const sig = JSON.stringify(rm.bounds);
    buildModel(ctx, rm, doorsOpen, framedFor.current !== sig, ledOn && hasLed);
    // Escena de noche para que se aprecie la luz LED
    const night = ledOn && hasLed;
    ctx.scene.environmentIntensity = night ? 0.22 : 0.75;
    (ctx.scene.getObjectByName('sun') as THREE_NS.DirectionalLight).intensity = night ? 0.12 : 1.7;
    (ctx.scene.getObjectByName('sky') as THREE_NS.HemisphereLight).intensity = night ? 0.06 : 0.35;
    (ctx.scene.background as THREE_NS.Color).set(night ? 0x1b1d22 : 0xe9e6e0);
    framedFor.current = sig;
  }, [ready, rm, doorsOpen, ledOn, hasLed]);

  function snapshot() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.renderer.render(ctx.scene, ctx.camera);
    const a = document.createElement('a');
    a.href = ctx.renderer.domElement.toDataURL('image/png');
    a.download = `${project.id}-render.png`;
    a.click();
  }

  if (failed) return <p className="rounded-xl bg-warn-bg p-4 text-[13px] text-warn" data-testid="render-unavailable">Este dispositivo no permite el render 3D. Usa las vistas de dibujo.</p>;

  return (
    <div className="grid gap-2" data-testid="render-view">
      <div className="flex flex-wrap items-center gap-1.5 no-print">
        <div role="radiogroup" aria-label="Probar acabado" className="flex flex-wrap items-center gap-1.5">
          <button type="button" role="radio" aria-checked={!finish} onClick={() => setFinish('')}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${!finish ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}>Del proyecto</button>
          {DEFAULT_CATALOG.finishes.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={finish === f.id} onClick={() => setFinish(f.id)} title={f.name} aria-label={f.name}
              className={`h-7 w-7 rounded-full border-2 ${finish === f.id ? 'border-accent ring-2 ring-accent/40' : 'border-[#3c6074]'}`}
              style={{ background: `linear-gradient(135deg, ${f.colors.top}, ${f.colors.front} 55%, ${f.colors.side})` }} />
          ))}
        </div>
        <span className="flex-1" />
        {hasLed && (
          <button type="button" aria-pressed={ledOn} onClick={() => setLedOn(!ledOn)} data-testid="render-led"
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${ledOn ? 'bg-[#ffd84d] text-[#2a2200]' : 'bg-[#253541]'}`}><Lightbulb aria-hidden className="h-4 w-4" />{ledOn ? 'Apagar LED' : 'Encender LED'}</button>
        )}
        {hasDoors && (
          <button type="button" aria-pressed={doorsOpen} onClick={() => setDoorsOpen(!doorsOpen)} data-testid="render-doors"
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${doorsOpen ? 'bg-accent text-accent-ink' : 'bg-[#253541]'}`}><DoorOpen aria-hidden className="h-4 w-4" />{rm.boxes.some((b) => DOOR_KEY.test(b.key)) ? (doorsOpen ? 'Cerrar puertas' : 'Abrir puertas') : (doorsOpen ? 'Cerrar' : 'Abrir')}</button>
        )}
        <button type="button" onClick={() => ctxRef.current?.controls.reset()} title="Volver al encuadre" aria-label="Volver al encuadre" className="flex h-8 items-center rounded-lg bg-[#253541] px-2"><RotateCcw aria-hidden className="h-4 w-4" /></button>
        <button type="button" onClick={snapshot} data-testid="render-snapshot" className="flex h-8 items-center gap-1 rounded-lg bg-[#253541] px-2 text-[12px] font-semibold"><Camera aria-hidden className="h-4 w-4" />Imagen</button>
      </div>
      <div ref={host} className="relative min-h-[300px] overflow-hidden rounded-xl bg-[#e9e6e0]">
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#55636f]">Preparando render…</div>}
      </div>
      <p className="text-[12px] text-muted">Arrastra para girar · pellizca o rueda para acercar. {finish ? 'El acabado de prueba no cambia el proyecto.' : ''} Jaladeras ilustrativas.{rm.wallMounted ? ' Muebles a muro a su altura capturada o de referencia.' : ''}</p>
    </div>
  );
}
