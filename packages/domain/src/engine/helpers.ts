import type {
  Box3, EdgeName, HardwareRequirement, Issue, MachiningOperation, MachiningPattern, ManufacturingSettings, Mm, PanelPart, PartRole, ValidationStatus,
} from '../types';

/** Redondeo a centésimas de mm para evitar ruido de coma flotante en medidas de corte. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export const box = (x0: Mm, x1: Mm, y0: Mm, y1: Mm, z0: Mm, z1: Mm): Box3 => ({
  x0: r2(x0), x1: r2(x1), y0: r2(y0), y1: r2(y1), z0: r2(z0), z1: r2(z1),
});

/**
 * Medida de corte a partir de la medida final (de diseño).
 * L1/L2 son aristas a lo largo del largo: su canto reduce el ANCHO. A1/A2 reducen el LARGO.
 * Con compensación: corte = final − Σ espesor de canto + Σ repasado de la canteadora (por arista canteada).
 */
export function cutDimensions(
  lengthMm: Mm, widthMm: Mm, banded: EdgeName[], bandThicknessMm: Mm,
  settings: Pick<ManufacturingSettings, 'edgeCompensation' | 'premillMm'>,
): { cutLengthMm: Mm; cutWidthMm: Mm } {
  if (!settings.edgeCompensation || banded.length === 0) return { cutLengthMm: r2(lengthMm), cutWidthMm: r2(widthMm) };
  const per = settings.premillMm - bandThicknessMm;
  const onLength = banded.filter((e) => e === 'A1' || e === 'A2').length;
  const onWidth = banded.filter((e) => e === 'L1' || e === 'L2').length;
  return { cutLengthMm: r2(lengthMm + onLength * per), cutWidthMm: r2(widthMm + onWidth * per) };
}

export interface PartInit {
  code: string;
  name: string;
  role: PartRole;
  lengthMm: Mm;
  widthMm: Mm;
  thicknessMm: Mm;
  grainAxis: PanelPart['grainAxis'];
  edges: EdgeName[];
  materialId: string;
  placements: Box3[];
  notes?: string[];
  validationStatus?: ValidationStatus;
}

export class ModuleBuilder {
  readonly parts: PanelPart[] = [];
  readonly hardware: HardwareRequirement[] = [];
  readonly machining: MachiningOperation[] = [];
  readonly issues: Issue[] = [];

  constructor(
    readonly moduleId: string,
    readonly finishId: string,
    readonly edgeBandId: string | null,
    /** Espesor del tapacanto (mm) para compensar la medida de corte. */
    readonly edgeBandThicknessMm: Mm = 0,
    readonly settings: Pick<ManufacturingSettings, 'edgeCompensation' | 'premillMm'> = { edgeCompensation: false, premillMm: 0 },
  ) {}

  part(p: PartInit): PanelPart {
    const id = `${this.moduleId}-${p.code}`;
    if (this.parts.some((x) => x.id === id)) throw new Error(`ID de pieza duplicado: ${id}`);
    const edgeBand: PanelPart['edgeBand'] = {};
    if (this.edgeBandId) for (const e of p.edges) edgeBand[e] = this.edgeBandId;
    const { cutLengthMm, cutWidthMm } = cutDimensions(p.lengthMm, p.widthMm, Object.keys(edgeBand) as EdgeName[], this.edgeBandThicknessMm, this.settings);
    const part: PanelPart = {
      id,
      moduleId: this.moduleId,
      code: p.code,
      name: p.name,
      role: p.role,
      quantity: p.placements.length,
      lengthMm: r2(p.lengthMm),
      widthMm: r2(p.widthMm),
      thicknessMm: p.thicknessMm,
      cutLengthMm,
      cutWidthMm,
      grainAxis: p.grainAxis,
      edgeBand,
      materialId: p.materialId,
      finishId: this.finishId,
      notes: p.notes ?? [],
      placements: p.placements,
      machiningOperationIds: [],
      validationStatus: p.validationStatus ?? 'verified',
    };
    this.parts.push(part);
    return part;
  }

  hw(r: Omit<HardwareRequirement, 'id' | 'moduleId'>): void {
    if (r.quantity <= 0) return;
    const existing = this.hardware.find((h) => h.productKey === r.productKey && h.category === r.category);
    if (existing) {
      existing.quantity += r.quantity;
      existing.basis = `${existing.basis}; ${r.basis}`;
      return;
    }
    this.hardware.push({ ...r, id: `${this.moduleId}-HW-${this.hardware.length + 1}`, moduleId: this.moduleId });
  }

  issue(i: Omit<Issue, 'moduleId'>): void {
    this.issues.push({ ...i, moduleId: this.moduleId });
  }

  /**
   * Genera operaciones de mecanizado desde un patrón. Si el patrón no está verificado con ficha,
   * las coordenadas quedan en null (estado pending_validation): nunca se inventan cotas.
   */
  machine(pattern: MachiningPattern, part: PanelPart, unitsPerPart: number, description: string, hardwareProductId?: string): void {
    if (unitsPerPart <= 0) return;
    const verified = pattern.validationStatus === 'verified' && pattern.holes.length > 0;
    const start = this.machining.length;
    if (!verified) {
      for (let k = 0; k < unitsPerPart; k++) {
        this.pushOp({
          partId: part.id, patternId: pattern.id, hardwareProductId,
          xMm: null, yMm: null, zMm: null, diameterMm: null, depthMm: null,
          technicalDatasheetUrl: pattern.technicalDatasheetUrl, validationStatus: pattern.validationStatus === 'blocked' ? 'blocked' : 'pending_validation',
          description: `${description} (${k + 1}/${unitsPerPart}) — coordenadas pendientes de ficha técnica`,
        }, part);
      }
    } else {
      const firstU = Math.min(...pattern.holes.map((h) => h.uMm));
      const pitch = unitsPerPart > 1 ? (part.lengthMm - 2 * firstU) / (unitsPerPart - 1) : 0;
      for (let k = 0; k < unitsPerPart; k++) {
        for (const h of pattern.holes) {
          const offset = k * pitch;
          const u = h.reference === 'from_start' ? h.uMm + offset : part.lengthMm - h.uMm - offset;
          this.pushOp({
            partId: part.id, patternId: pattern.id, hardwareProductId,
            xMm: r2(u), yMm: r2(h.vMm), zMm: h.face === 'B' ? part.thicknessMm : 0,
            diameterMm: h.diameterMm, depthMm: h.depthMm,
            technicalDatasheetUrl: pattern.technicalDatasheetUrl, validationStatus: 'verified',
            description: `${description} (${k + 1}/${unitsPerPart}) Ø${h.diameterMm}×${h.depthMm} cara ${h.face}`,
          }, part);
          if (h.face !== 'edge' && h.depthMm > part.thicknessMm - pattern.minRemainingMm) {
            this.issue({
              code: 'MACHINING_DEPTH_EXCEEDS', severity: 'error', partId: part.id,
              message: `${part.id}: barreno Ø${h.diameterMm} a ${h.depthMm} mm deja menos de ${pattern.minRemainingMm} mm en tablero de ${part.thicknessMm} mm (salida de broca).`,
            });
          }
          if (u < 0 || u > part.lengthMm || h.vMm < 0 || h.vMm > part.widthMm) {
            this.issue({ code: 'MACHINING_OUTSIDE_PART', severity: 'error', partId: part.id, message: `${part.id}: barreno fuera de la pieza (u=${r2(u)}, v=${h.vMm}).` });
          }
        }
      }
      this.checkHoleCollisions(part, start);
    }
  }

  private pushOp(op: Omit<MachiningOperation, 'id'>, part: PanelPart) {
    const id = `${part.id}-M${String(part.machiningOperationIds.length + 1).padStart(3, '0')}`;
    this.machining.push({ ...op, id });
    part.machiningOperationIds.push(id);
  }

  private checkHoleCollisions(part: PanelPart, fromIndex: number) {
    const ops = this.machining.filter((o) => o.partId === part.id && o.xMm !== null);
    const fresh = new Set(this.machining.slice(fromIndex).map((o) => o.id));
    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        const a = ops[i]!, b = ops[j]!;
        if (!fresh.has(a.id) && !fresh.has(b.id)) continue;
        if (a.zMm !== b.zMm) continue;
        const dist = Math.hypot((a.xMm ?? 0) - (b.xMm ?? 0), (a.yMm ?? 0) - (b.yMm ?? 0));
        if (dist < ((a.diameterMm ?? 0) + (b.diameterMm ?? 0)) / 2) {
          this.issue({ code: 'MACHINING_HOLE_COLLISION', severity: 'error', partId: part.id, message: `${part.id}: los barrenos ${a.id} y ${b.id} se traslapan (${r2(dist)} mm entre centros).` });
        }
      }
    }
  }
}

export function overlapVolume(a: Box3, b: Box3): number {
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  const dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return dx > 0.01 && dy > 0.01 && dz > 0.01 ? dx * dy * dz : 0;
}
