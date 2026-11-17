/**
 * Contrato de tipos del dominio Modular Studio.
 *
 * Convenciones (ver docs/REGLAS_MOTOR.md):
 *  - Todas las longitudes en milímetros (Mm). Moneda MXN en centavos enteros (Cents).
 *  - Ejes del módulo: X = ancho (izq→der), Y = profundidad (frente→fondo), Z = altura.
 *    Origen en la esquina frontal-inferior-izquierda del módulo.
 *  - Medidas de corte nominales, SIN compensación de tapacanto salvo política explícita.
 */

export type Mm = number;
/** Centavos MXN, siempre enteros. */
export type Cents = number;

export const CALC_VERSION = '1.0.0';
export const SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type FamilyCategory = 'kitchen' | 'bedroom' | 'office' | 'living' | 'bath' | 'service' | 'commercial' | 'custom';
export type GeometryStrategy = 'box' | 'wardrobe' | 'desk' | 'composite';
/**
 * verified_vertical: implementación constructiva cubierta por pruebas (gabinete, clóset, escritorio).
 * configurable_base_template: usa el motor de caja genérico; reglas específicas pendientes.
 * template_requires_engine_validation: aproximación con caja genérica; requiere motor propio.
 */
export type FamilyStatus = 'verified_vertical' | 'configurable_base_template' | 'template_requires_engine_validation';

/** drawer_doors: cajón(es) pequeños arriba y puertas abajo (base de cocina típica). */
export type FrontType = 'open' | 'doors' | 'drawers' | 'drawer_doors';
/** equal: frentes iguales; graduated: más chicos arriba y más altos abajo. */
export type DrawerLayout = 'equal' | 'graduated';
export type ConstructionStrategy = 'top_bottom_between_sides' | 'sides_between_top_bottom';
export type BaseType = 'none' | 'plinth' | 'levelers' | 'steel_frame';
export type Joinery = 'cam' | 'dowel' | 'screw' | 'mixed';
export type EdgePolicy = 'front_visible_only' | 'all_visible' | 'none';
export type MountType = 'floor' | 'wall';

export interface FamilyDefaults {
  widthMm: Mm;
  heightMm: Mm;
  depthMm: Mm;
  front: FrontType;
  doorCount: number | null;
  drawerCount: number;
  drawerLayout?: DrawerLayout;
  shelvesPerBay: number;
  baseType: BaseType;
  baseHeightMm: Mm;
  mount: MountType;
  /** Carga de diseño sobre entrepaños/cubierta (kg/m²) para el cálculo de flecha. */
  shelfLoadKgM2: number;
}

export interface FamilyDefinition {
  id: string;
  name: string;
  category: FamilyCategory;
  geometryStrategy: GeometryStrategy;
  status: FamilyStatus;
  description: string;
  defaults: FamilyDefaults;
  /** Notas de reglas específicas pendientes; se muestran como advertencias. */
  pendingRules: string[];
}

export type MaterialKind = 'board' | 'solidwood' | 'back_panel';

export interface MaterialDefinition {
  id: string;
  name: string;
  kind: MaterialKind;
  thicknessMm: Mm;
  sheet: { lengthMm: Mm; widthMm: Mm } | null;
  /** Clave de producto para emparejar ofertas de proveedores. */
  productKey: string;
  /** Densidad típica (kg/m³) para peso de piezas. Verificar con ficha del tablero. */
  densityKgM3: number;
  /** Módulo de elasticidad típico en flexión (MPa); null = no estructural (respaldos). */
  elasticModulusMPa: number | null;
  /** Factor de fluencia kdef (deformación diferida bajo carga permanente; referencia Eurocódigo 5, clase de servicio 1). */
  creepKdef: number;
  notes?: string;
}

export interface FinishDefinition {
  id: string;
  name: string;
  hasGrain: boolean;
  colors: { top: string; front: string; side: string };
}

export interface EdgeBandDefinition {
  id: string;
  name: string;
  widthMm: Mm;
  thicknessMm: Mm;
  productKey: string;
}

export type ValidationStatus = 'verified' | 'pending_validation' | 'blocked';

export type HardwareCategory =
  | 'hinge' | 'drawer_slide' | 'cam_connector' | 'dowel' | 'shelf_pin' | 'handle' | 'leveler'
  | 'screw' | 'wall_anchor' | 'hanging_rail' | 'hanging_rail_support' | 'soft_close' | 'lift_system'
  | 'plinth_clip' | 'adhesive'
  | 'led_strip' | 'led_profile' | 'led_driver' | 'led_sensor' | 'led_cable';

export interface HingeRule { maxDoorHeightMm: Mm; hingesPerDoor: number }

/** Producto de herraje (genérico o por SKU). Las cotas de mecanizado sólo provienen de una ficha técnica. */
export interface HardwareProduct {
  id: string;
  category: HardwareCategory;
  name: string;
  manufacturer: string | null;
  sku: string | null;
  productKey: string;
  unit: string;
  technicalDatasheetUrl: string | null;
  validationStatus: ValidationStatus;
  /** Parámetros declarados por la ficha (o capturados). Nunca valores universales. */
  params?: {
    /** Correderas: holgura lateral total por lado entre caja de cajón y costado. */
    sideClearancePerSideMm?: Mm;
    nominalLengthsMm?: Mm[];
    drawerBoxThicknessMm?: Mm;
    maxLoadKg?: number;
    /** LED: potencia de la tira (W por metro). */
    ledWattsPerM?: number;
    /** LED: ranura de router que pide el perfil para empotrar (ancho × profundidad). */
    grooveWidthMm?: Mm;
    grooveDepthMm?: Mm;
    /** LED: potencia nominal de la fuente (W). */
    driverWatts?: number;
    /** Bisagras: tabla de cantidad por alto de puerta (fabricante). */
    hingeRules?: HingeRule[];
    /** Bisagras: espesor de puerta admitido [mín, máx] en mm. */
    doorThicknessRangeMm?: [Mm, Mm];
    /** Bisagras: peso máximo de puerta por bisagra (kg), según tabla del fabricante. */
    maxDoorWeightKgPerHinge?: number;
    /** Patas niveladoras / colgadores: rango de altura de ajuste [mín, máx] en mm. */
    heightRangeMm?: [Mm, Mm];
    /** Patas / colgadores: capacidad por pieza (kg). */
    maxLoadKgEach?: number;
  };
  machiningPatternId?: string;
  notes?: string;
}

export interface MachiningHoleTemplate {
  /** Coordenadas relativas a la pieza: u a lo largo del largo, v a lo largo del ancho. */
  reference: 'from_start' | 'from_end';
  uMm: Mm;
  vMm: Mm;
  diameterMm: Mm;
  depthMm: Mm;
  face: 'A' | 'B' | 'edge';
}

export interface MachiningPattern {
  id: string;
  name: string;
  hardwareCategory: HardwareCategory;
  technicalDatasheetUrl: string | null;
  validationStatus: ValidationStatus;
  /** Sólo con validationStatus 'verified' se generan coordenadas. */
  holes: MachiningHoleTemplate[];
  /** Material remanente mínimo bajo un barreno ciego. */
  minRemainingMm: Mm;
}

export interface SteelProfile {
  id: string;
  name: string;
  shape: 'PTR' | 'ANGLE' | 'PLATE' | 'PROFILE' | 'OTHER';
  sectionSpec: string;
  barLengthMm: Mm;
  /** kg/m sólo si proviene de ficha; null => cotizar por m o barra. */
  kgPerM: number | null;
  productKey: string;
}

// ---------------------------------------------------------------------------
// Proyecto
// ---------------------------------------------------------------------------

export interface SteelFrameSpec {
  enabled: boolean;
  profileId: string;
  legHeightMm: Mm;
  finish: 'primer' | 'powder_coating' | 'paint' | 'none';
}

/** Dónde va la tira LED dentro del módulo. */
export type LedPlacement = 'none' | 'under_cabinet' | 'shelves' | 'sides' | 'top_inside';
export type LedSensor = 'none' | 'door' | 'hand' | 'touch';

export interface LedSpec {
  placement: LedPlacement;
  stripProductId: string;
  profileProductId: string;
  sensor: LedSensor;
}

export interface ModuleSpec {
  id: string;
  label: string;
  familyId: string;
  widthMm: Mm;
  heightMm: Mm;
  depthMm: Mm;
  thicknessMm: Mm;
  materialId: string;
  backMaterialId: string | null; // null = sin respaldo
  finishId: string;
  edgeBandId: string;
  edgePolicy: EdgePolicy;
  construction: ConstructionStrategy;
  front: FrontType;
  /** null = automático según ancho máximo de hoja. */
  doorCount: number | null;
  drawerCount: number;
  drawerLayout: DrawerLayout;
  shelvesPerBay: number;
  /** null = automático (luz libre del material). */
  dividerCount: number | null;
  baseType: BaseType;
  baseHeightMm: Mm;
  mount: MountType;
  /** Carga de diseño en entrepaños (kg/m²); null = la de la familia. */
  shelfLoadKgM2: number | null;
  joinery: Joinery;
  hingeProductId: string | null;
  slideProductId: string | null;
  handleProductId: string | null;
  steel: SteelFrameSpec;
  /** Holguras de frentes. */
  revealMm: Mm;
  frontGapMm: Mm;
  /** Iluminación LED empotrada (ranura de router + perfil de aluminio). */
  led: LedSpec;
}

export type ProjectStatus = 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING' | 'RELEASED_WITH_APPROVAL';

export type PricingMode = 'margin' | 'markup';

export interface ManualCost {
  key: string;
  label: string;
  applies: boolean;
  /** null = pendiente; nunca se convierte en $0. */
  amountCents: Cents | null;
  taxIncluded: boolean;
  notes?: string;
}

export interface PricingSettings {
  mode: PricingMode;
  marginPct: number;
  markupPct: number;
  taxRatePct: number;
  /** Merma de rollo de canto (%). */
  edgeWastePct: number;
  /** Margen por tramo de canto (mm). */
  edgeAllowancePerSegmentMm: Mm;
  /** Merma de herrería (%), además de kerf. */
  steelWastePct: number;
  allowEstimatedPrices: boolean;
  /** productKey -> offerId */
  selectedOffers: Record<string, string>;
  manualCosts: ManualCost[];
  /** Costeo y precio de venta con referencias de mercado (Monterrey). */
  market: import('./pricing/market').MarketSettings;
}

/** Parámetros de taller que afectan medidas de corte y validaciones (editables por proyecto). */
export interface ManufacturingSettings {
  /** Restar el espesor del tapacanto a la medida de corte (medida final = medida de diseño). */
  edgeCompensation: boolean;
  /** Repasado/pre-fresado de la canteadora por arista canteada (mm que se agregan al corte). */
  premillMm: Mm;
  /** Criterio de flecha admisible: claro / N (p. ej. 200 = 0.5 % del claro). */
  sagLimitRatio: number;
  /** Ancho mínimo de pieza que el taller corta con seguridad. */
  minPartWidthMm: Mm;
  /** Dimensión mínima transversal para pasar una pieza por la canteadora. */
  minEdgebandWidthMm: Mm;
  /** Largo mínimo de una arista para cantearla en máquina. */
  minEdgebandLengthMm: Mm;
  /** Tolerancia para considerar que dos piezas se tocan (verificación de apoyos). */
  contactToleranceMm: Mm;
}

export interface CutSettings {
  kerfMm: Mm;
  trimMarginMm: Mm;
}

export interface InspectionRecord {
  checklist: Record<string, boolean>;
  /** moduleId -> diagonales medidas */
  diagonals: Record<string, { d1Mm: number | null; d2Mm: number | null }>;
  diagonalToleranceMm: Mm;
  notes: string;
}

export interface Approval {
  approvedBy: string;
  approvedAt: string;
  validationEvidence: string;
}

export interface Project {
  schemaVersion: string;
  id: string;
  name: string;
  customer: string;
  site: string;
  currency: 'MXN';
  unit: 'mm';
  createdAt: string;
  updatedAt: string;
  modules: ModuleSpec[];
  pricing: PricingSettings;
  cut: CutSettings;
  manufacturing: ManufacturingSettings;
  inspection: InspectionRecord;
  approval: Approval | null;
  status: ProjectStatus;
}

// ---------------------------------------------------------------------------
// Resultados de cálculo
// ---------------------------------------------------------------------------

export type EdgeName = 'L1' | 'L2' | 'A1' | 'A2';
export type PartRole = 'carcass' | 'back' | 'shelf' | 'divider' | 'front' | 'drawer_box' | 'plinth' | 'desk';

export interface Box3 { x0: Mm; x1: Mm; y0: Mm; y1: Mm; z0: Mm; z1: Mm }

export interface PanelPart {
  /** ID estable: <moduleId>-<código>[-n]. */
  id: string;
  moduleId: string;
  code: string;
  name: string;
  role: PartRole;
  quantity: number;
  /** Medida final (de diseño), con tapacanto incluido. Es la que ocupa la pieza armada. */
  lengthMm: Mm;
  widthMm: Mm;
  thicknessMm: Mm;
  /** Medida de corte: final − espesor de canto en aristas canteadas + repasado (si la compensación está activa). */
  cutLengthMm: Mm;
  cutWidthMm: Mm;
  grainAxis: 'length' | 'width' | 'none';
  edgeBand: Partial<Record<EdgeName, string>>;
  materialId: string;
  finishId: string;
  notes: string[];
  /** Posición de cada instancia en coordenadas del módulo (una por unidad de quantity). */
  placements: Box3[];
  machiningOperationIds: string[];
  validationStatus: ValidationStatus;
}

export interface MachiningOperation {
  id: string;
  partId: string;
  patternId: string;
  hardwareProductId?: string;
  /** null cuando el patrón no está verificado: no se afirman coordenadas sin ficha. */
  xMm: Mm | null;
  yMm: Mm | null;
  zMm: Mm | null;
  diameterMm: Mm | null;
  depthMm: Mm | null;
  technicalDatasheetUrl: string | null;
  validationStatus: ValidationStatus;
  description: string;
  /** Ranura de router (para perfiles LED): largo, ancho y profundidad. */
  groove?: { lengthMm: Mm; widthMm: Mm };
}

/** Tramo de LED empotrado: ranura de router en una pieza, con su posición en el módulo (mm). */
export interface LedRun {
  id: string;
  moduleId: string;
  partId: string;
  /** Eje de la ranura, en coordenadas del módulo (x ancho, y fondo desde el frente, z alto). */
  a: [Mm, Mm, Mm];
  b: [Mm, Mm, Mm];
  lengthMm: Mm;
  grooveWidthMm: Mm;
  grooveDepthMm: Mm;
  /** Cara de la pieza donde se fresa, en palabras de taller. */
  face: string;
  /** Hacia dónde apunta la luz (para el render): eje y signo. */
  lightDir: [number, number, number];
}

export interface HardwareRequirement {
  id: string;
  moduleId: string;
  category: HardwareCategory;
  productId: string | null;
  productKey: string;
  description: string;
  quantity: number;
  unit: string;
  /** Explicación de la regla aplicada. */
  basis: string;
  validationStatus: ValidationStatus;
}

export interface SteelPiece { id: string; label: string; lengthMm: Mm; count: number }

export interface SteelRequirement {
  id: string;
  moduleId: string;
  profileId: string;
  shape: SteelProfile['shape'];
  sectionSpec: string;
  pieces: SteelPiece[];
  finish: SteelFrameSpec['finish'];
  loadValidationRequired: boolean;
}

export type IssueSeverity = 'error' | 'blocker' | 'warning' | 'info';

export interface Issue {
  code: string;
  severity: IssueSeverity;
  message: string;
  moduleId?: string;
  partId?: string;
}

export type CheckCategory = 'cierre' | 'apoyo' | 'canto' | 'espesor' | 'herraje' | 'flecha' | 'tamaño' | 'frentes' | 'peso';
export type CheckStatus = 'ok' | 'info' | 'warning' | 'error';

/** Resultado de una verificación dimensional (esperado vs. calculado). */
export interface DimensionCheck {
  id: string;
  moduleId: string;
  category: CheckCategory;
  label: string;
  expected: string;
  actual: string;
  status: CheckStatus;
  partId?: string;
}

export interface ModuleResult {
  moduleId: string;
  /** Desplazamiento del módulo en el conjunto (X). */
  offsetXMm: Mm;
  /** Desplazamiento en Y para alinear respaldos contra muro. */
  offsetYMm: Mm;
  fabricable: boolean;
  parts: PanelPart[];
  hardware: HardwareRequirement[];
  machining: MachiningOperation[];
  steel: SteelRequirement[];
  issues: Issue[];
  /** Diagonales teóricas de la cara frontal de la caja. */
  theoreticalDiagonalMm: Mm | null;
  carcassDepthMm: Mm | null;
  overallHeightMm: Mm;
  /** Verificaciones dimensionales del módulo. */
  checks: DimensionCheck[];
  /** Peso estimado de tableros (kg), con densidades típicas. */
  weightKg: number;
  /** Tramos de LED empotrado (ranuras de router). */
  ledRuns: LedRun[];
}

export interface EdgeBandTotal {
  edgeBandId: string;
  productKey: string;
  netLengthMm: Mm;
  segments: number;
  /** Incluye margen por tramo y merma de rollo. */
  purchaseLengthMm: Mm;
}

export type ReleaseStatus = 'NO_FABRICABLE' | 'PENDIENTE_VALIDACION' | 'LISTO_PARA_APROBACION' | 'LIBERADO_CON_APROBACION';

export interface ProjectCalculation {
  calcVersion: string;
  projectId: string;
  modules: ModuleResult[];
  parts: PanelPart[];
  hardware: HardwareRequirement[];
  machining: MachiningOperation[];
  steel: SteelRequirement[];
  edgeBands: EdgeBandTotal[];
  issues: Issue[];
  releaseStatus: ReleaseStatus;
  /** Tramos LED de todo el proyecto (coordenadas del módulo; sumar offsetXMm/offsetYMm del módulo). */
  ledRuns: LedRun[];
  totals: { panelCount: number; partModels: number; panelAreaM2: number };
}

// ---------------------------------------------------------------------------
// Proveedores, ofertas y cotización
// ---------------------------------------------------------------------------

export type PriceStatus = 'PUBLICADO_VERIFICADO' | 'COTIZADO' | 'CAPTURADO_MANUAL' | 'ESTIMADO' | 'PENDIENTE' | 'VENCIDO';

export interface Supplier {
  id: string;
  name: string;
  categories: string[];
  officialUrl: string | null;
  catalogUrl: string | null;
  /** URL mencionada en material previo, aún sin verificar como dominio oficial. */
  candidateUrl: string | null;
  verification: 'URL_PENDIENTE_VERIFICACION' | 'PUBLIC_CATALOG' | 'VERIFIED';
  priceMode: 'QUOTE_OR_AUTHORIZED_IMPORT' | 'AUTHORIZED_API';
  notes: string;
}

export interface SupplierOffer {
  id: string;
  supplierId: string;
  /** Clave del requerimiento que esta oferta puede cubrir (p. ej. board:mel18). */
  productKey: string;
  sku: string;
  description: string;
  /** Unidades de requerimiento por presentación comercial (p. ej. bolsa de 2 bisagras => 2). */
  packQuantity: number;
  purchaseUnit: string;
  currency: 'MXN';
  priceCents: Cents | null;
  taxIncluded: boolean | null;
  taxRatePct: number | null;
  priceStatus: PriceStatus;
  verifiedAt: string | null;
  validUntil: string | null;
  sourceUrl: string | null;
  quoteReference: string | null;
  available: boolean | null;
  reliability: 'alta' | 'media' | 'baja';
  capturedBy: string | null;
  notes: string;
}

export type QuoteLineCategory = 'board' | 'edge' | 'hardware' | 'steel' | 'service';
export type QuoteLineStatus = 'PRICED' | 'PENDING' | 'TAX_UNKNOWN' | 'EXPIRED_SELECTED' | 'ESTIMATED' | 'NOT_APPLICABLE';

export interface QuoteLine {
  key: string;
  category: QuoteLineCategory;
  description: string;
  requiredQuantity: number;
  requiredUnit: string;
  purchaseQuantity: number | null;
  purchaseUnit: string | null;
  offerId: string | null;
  supplierId: string | null;
  sku: string | null;
  unitNetCents: Cents | null;
  lineNetCents: Cents | null;
  priceStatus: PriceStatus | null;
  verifiedAt: string | null;
  sourceUrl: string | null;
  status: QuoteLineStatus;
  required: boolean;
  notes: string[];
  alternatives: number;
}

export type QuoteCompleteness = 'COMPLETO' | 'INCOMPLETO' | 'SIMULACION';

export interface Quote {
  calcVersion: string;
  projectId: string;
  generatedAt: string;
  currency: 'MXN';
  lines: QuoteLine[];
  /** Suma de líneas con precio; null si ninguna tiene precio. Parcial si completeness = INCOMPLETO. */
  directCostNetCents: Cents | null;
  mode: PricingMode;
  marginPct: number;
  markupPct: number;
  sellBeforeTaxCents: Cents | null;
  taxRatePct: number;
  taxCents: Cents | null;
  totalCents: Cents | null;
  completeness: QuoteCompleteness;
  missingLines: string[];
  warnings: string[];
  boardMethod: 'layout_factible' | 'estimacion_area_no_validada';
}
