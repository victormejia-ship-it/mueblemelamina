/**
 * Catálogo de equipo de taller para fabricar muebles de tablero (melamina, MDF, contrachapado)
 * y herrería ligera. Cada equipo describe su operación paso a paso, ajustes clave, seguridad y control.
 * Los valores numéricos de ajuste que dependen del fabricante (temperatura de cola, velocidad, etc.)
 * se remiten a la ficha técnica: no se inventan.
 */

export type StationId =
  | 'preparacion' | 'corte' | 'canteado' | 'mecanizado' | 'armado' | 'frentes' | 'herreria' | 'calidad' | 'empaque' | 'instalacion';

export type EquipmentCategory = 'medición' | 'corte' | 'canteado' | 'mecanizado' | 'armado' | 'herrajes' | 'herrería' | 'acabado' | 'instalación' | 'seguridad';

/** Equipo de protección personal (se muestra como íconos). */
export type PPE = 'gafas' | 'auditiva' | 'respirador' | 'guantes' | 'careta' | 'calzado';

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  station: StationId;
  /** Para qué sirve, en una línea. */
  purpose: string;
  /** Pasos de la operación (diagrama): 2–4 palabras cada uno; el detalle va en keySettings. */
  steps: string[];
  /** EPP obligatorio en este equipo. */
  ppe: PPE[];
  /** Ajustes y puntos críticos de la operación. */
  keySettings: string[];
  /** Riesgos y equipo de protección personal. */
  safety: string[];
  /** Qué se verifica al terminar en este equipo. */
  qualityChecks: string[];
  /** Alternativas para talleres sin este equipo. */
  alternatives: string[];
  /** Consumibles asociados. */
  consumables: string[];
}

export interface StationDefinition {
  id: StationId;
  name: string;
  /** Objetivo de la estación. */
  goal: string;
  /** Qué entra y qué sale. */
  input: string;
  output: string;
}

export const STATIONS: StationDefinition[] = [
  { id: 'preparacion', name: 'Preparación y medición', goal: 'Confirmar medidas de obra, espesores reales y material antes de cortar.', input: 'Proyecto aprobado y tableros', output: 'Medidas y espesores confirmados' },
  { id: 'corte', name: 'Corte de tableros', goal: 'Dimensionar cada pieza a su medida de corte siguiendo el mapa de corte y la veta.', input: 'Tableros completos', output: 'Piezas cortadas y etiquetadas' },
  { id: 'canteado', name: 'Canteado', goal: 'Aplicar tapacanto en las aristas indicadas (L1/L2/A1/A2) para llegar a la medida final.', input: 'Piezas cortadas', output: 'Piezas canteadas a medida final' },
  { id: 'mecanizado', name: 'Mecanizado (perforación)', goal: 'Perforar uniones, cazoletas y soportes SOLO con patrón validado por ficha técnica.', input: 'Piezas canteadas', output: 'Piezas perforadas' },
  { id: 'armado', name: 'Armado de caja', goal: 'Unir costados, tapa, piso y divisores a escuadra y fijar el respaldo.', input: 'Piezas perforadas', output: 'Cajas a escuadra' },
  { id: 'herreria', name: 'Herrería', goal: 'Fabricar bastidores de PTR según plan de barras y validar la estructura.', input: 'Barras de PTR', output: 'Bastidores soldados y pintados' },
  { id: 'frentes', name: 'Herrajes y frentes', goal: 'Montar bisagras, correderas, puertas, cajones y jaladeras y regular holguras.', input: 'Cajas armadas', output: 'Módulos funcionales' },
  { id: 'calidad', name: 'Control de calidad', goal: 'Comprobar medidas, diagonales, acabado y funcionamiento antes de liberar.', input: 'Módulos terminados', output: 'Módulos liberados con registro' },
  { id: 'empaque', name: 'Empaque y transporte', goal: 'Proteger aristas y frentes, etiquetar por módulo y planear la maniobra por peso.', input: 'Módulos liberados', output: 'Módulos listos para obra' },
  { id: 'instalacion', name: 'Instalación en obra', goal: 'Nivelar, unir y anclar los módulos de forma segura y entregar.', input: 'Módulos en obra', output: 'Mueble instalado y entregado' },
];

const EPP_POLVO = 'Respirador para polvo de madera/MDF (mínimo N95/P2) y extracción de polvo';

export const EQUIPMENT: EquipmentItem[] = [
  // --- Medición ---
  {
    id: 'flexometro', name: 'Flexómetro 5–8 m', category: 'medición', station: 'preparacion',
    purpose: 'Medir obra, tableros y piezas.',
    steps: ['Revisar cinta', 'Medir desde un mismo punto', 'Anotar en mm', 'Repetir lo crítico'],
    ppe: [],
    keySettings: ['Usar el mismo flexómetro en obra y taller (evita diferencias entre instrumentos)', 'Para medidas críticas usar regla metálica o calibrador'],
    safety: ['Sin riesgos relevantes'],
    qualityChecks: ['Medidas de obra registradas en el proyecto'],
    alternatives: ['Medidor láser para distancias de obra'],
    consumables: [],
  },
  {
    id: 'calibrador', name: 'Calibrador (vernier) digital', category: 'medición', station: 'preparacion',
    purpose: 'Medir el espesor REAL del tablero y del canto (el cálculo usa el espesor del proyecto).',
    steps: ['Poner en cero', 'Medir en 3 puntos', 'Comparar con proyecto', 'Medir el canto'],
    ppe: [],
    keySettings: ['Si el espesor real difiere más de 0.3 mm, actualizarlo en el módulo antes de cortar'],
    safety: ['Sin riesgos relevantes'],
    qualityChecks: ['Espesor real = espesor del proyecto (±0.3 mm)', 'Canto: ancho ≥ espesor + 1 mm'],
    alternatives: ['Micrómetro'],
    consumables: [],
  },
  {
    id: 'escuadra', name: 'Escuadra de precisión', category: 'medición', station: 'corte',
    purpose: 'Comprobar la escuadra de piezas, del corte y de la caja armada.',
    steps: ['Apoyar en la orilla', 'Buscar luz', 'Marcar si falla'],
    ppe: [],
    keySettings: ['Verificar la propia escuadra contra una de referencia periódicamente'],
    safety: ['Sin riesgos relevantes'],
    qualityChecks: ['Sin luz visible en 300 mm'],
    alternatives: ['Comprobar por diagonales'],
    consumables: [],
  },
  {
    id: 'medidor-diagonales', name: 'Medidor de diagonales / regla telescópica', category: 'medición', station: 'armado',
    purpose: 'Medir las dos diagonales de la caja y corregir la escuadra antes de fijar el respaldo.',
    steps: ['Medir diagonal 1', 'Medir diagonal 2', 'Comparar', 'Corregir con prensa', 'Fijar respaldo'],
    ppe: [],
    keySettings: ['Diagonal teórica = √(ancho² + alto²), calculada por el proyecto', 'Tolerancia de diferencia configurable en Calidad'],
    safety: ['Sin riesgos relevantes'],
    qualityChecks: ['Diferencia de diagonales ≤ tolerancia del proyecto'],
    alternatives: ['Flexómetro de 5 m con ayudante'],
    consumables: [],
  },
  // --- Corte ---
  {
    id: 'seccionadora', name: 'Seccionadora o escuadradora con incisor', category: 'corte', station: 'corte',
    purpose: 'Cortar tableros a medida de corte sin despostillar la melamina.',
    steps: ['Revisar disco e incisor', 'Refilar orilla', 'Cortar tiras', 'Cortar piezas', 'Etiquetar ID', 'Medir 1.ª pieza'],
    ppe: ['gafas', 'auditiva', 'respirador', 'calzado'],
    keySettings: ['Disco para melamina (dientes trapecio-plano) + incisor del mismo ancho de corte', 'Kerf del proyecto (ancho de corte del disco)', 'Escuadrado de orilla del proyecto', 'Respetar el sentido de veta del mapa de corte', 'Cortar a MEDIDA DE CORTE (ya descuenta el canto)'],
    safety: ['Gafas y protección auditiva', 'Guarda y cuchillo divisor instalados', 'Empujador para piezas angostas; nunca acercar las manos al disco', 'Guantes solo para manipular tableros, nunca al alimentar la sierra', EPP_POLVO],
    qualityChecks: ['Medida ±0.5 mm (tolerancia objetivo)', 'Sin despostillado en ninguna cara', 'Escuadra de pieza correcta'],
    alternatives: ['Servicio de dimensionado del proveedor (enviar CSV de despiece y mapa de corte)', 'Sierra de riel (track saw) con disco para melamina y cinta de sacrificio'],
    consumables: ['Disco para melamina', 'Disco incisor', 'Etiquetas para ID de pieza'],
  },
  // --- Canteado ---
  {
    id: 'canteadora', name: 'Canteadora (automática o semiautomática)', category: 'canteado', station: 'canteado',
    purpose: 'Pegar, refilar y acabar el tapacanto en las aristas indicadas.',
    steps: ['Revisar canto', 'Limpiar arista', 'Pre-fresar', 'Encolar y prensar', 'Refilar', 'Raspar', 'Limpiar', 'Medir'],
    ppe: ['gafas', 'guantes'],
    keySettings: ['Temperatura y tipo de cola según ficha del adhesivo', 'Si la máquina pre-fresa, capturar el repasado en Calidad (el corte se agranda)', 'Orden: primero aristas cortas (A1/A2), luego largas (L1/L2)'],
    safety: ['Superficies y cola caliente: guantes térmicos al recargar', 'Gafas', 'No retirar recortes con la máquina en movimiento'],
    qualityChecks: ['Adherencia en toda la arista', 'Sin cola visible ni juntas abiertas', 'Medida final = medida de diseño del proyecto'],
    alternatives: ['Canto precolado con plancha + refilador manual (lotes pequeños)', 'Servicio de enchapado del proveedor'],
    consumables: ['Tapacanto según proyecto', 'Cola hot-melt', 'Limpiador de melamina'],
  },
  {
    id: 'refilador-manual', name: 'Refilador manual de cantos', category: 'canteado', station: 'canteado',
    purpose: 'Recortar sobrante de canto en piezas pequeñas o reparaciones.',
    steps: ['Apoyar al ras', 'Recortar', 'Despuntar', 'Lijar filo'],
    ppe: ['guantes'],
    keySettings: ['Cuchilla afilada para no levantar el canto'],
    safety: ['Guantes anticorte'],
    qualityChecks: ['Canto al ras, sin rebaba'],
    alternatives: ['Cutter y lima de canto'],
    consumables: ['Cuchillas de repuesto', 'Lija fina'],
  },
  // --- Mecanizado ---
  {
    id: 'taladro-banco', name: 'Taladro de banco con tope de profundidad', category: 'mecanizado', station: 'mecanizado',
    purpose: 'Perforar cazoletas Ø35, excéntricos y taquetes con profundidad controlada.',
    steps: ['Cargar patrón', 'Fijar tope', 'Pieza de prueba', 'Revisar', 'Perforar serie', 'Revisar caras'],
    ppe: ['gafas', 'respirador'],
    keySettings: ['Broca Forstner Ø35 para cazoleta de bisagra', 'Profundidad según ficha (el motor valida que no atraviese el tablero)', 'Referenciar todas las piezas desde la misma orilla', 'NO perforar operaciones marcadas «pendiente de ficha»'],
    safety: ['Gafas', 'Sujetar la pieza con prensa o tope, nunca con la mano', 'Sin guantes ni ropa suelta cerca del husillo', EPP_POLVO],
    qualityChecks: ['Posición ±0.5 mm contra la plantilla', 'Profundidad sin salir por la cara opuesta', 'Herraje entra sin forzar'],
    alternatives: ['Plantilla (jig) de perforación + taladro inalámbrico con tope', 'Máquina insertadora de bisagras', 'Router CNC con programa validado'],
    consumables: ['Broca Forstner Ø35', 'Broca Ø15 para excéntrico', 'Broca Ø8 para taquete', 'Broca Ø5 para soporte de entrepaño'],
  },
  {
    id: 'plantilla-system32', name: 'Plantilla de líneas de perforación (sistema 32 mm)', category: 'mecanizado', station: 'mecanizado',
    purpose: 'Perforar en serie los barrenos para soportes de entrepaño y bases de herraje.',
    steps: ['Referenciar', 'Fijar', 'Perforar', 'Repetir costado'],
    ppe: ['gafas', 'respirador'],
    keySettings: ['Misma referencia (frontal e inferior) en ambos costados para que los entrepaños queden a nivel'],
    safety: ['Gafas', EPP_POLVO],
    qualityChecks: ['Entrepaño a nivel en sus cuatro soportes'],
    alternatives: ['Taladro múltiple', 'Router CNC'],
    consumables: ['Broca Ø5 con tope'],
  },
  {
    id: 'router', name: 'Router (rebajadora) con guía paralela y fresa recta', category: 'mecanizado', station: 'mecanizado',
    purpose: 'Fresar la ranura donde se empotra el perfil de aluminio de la tira LED y el canal del cable.',
    steps: ['Marcar ranura', 'Fijar guía', 'Pasadas de 3 mm', 'Canal de cable', 'Probar perfil'],
    ppe: ['gafas', 'auditiva', 'respirador'],
    keySettings: [
      'Ancho y profundidad de la ranura = medida del perfil comprado (el proyecto usa la del catálogo: confirmarla con calibrador)',
      'Fresa recta de carburo; si es más angosta que la ranura, dos pasadas contra la guía',
      'Profundidad final en pasadas de máximo 3 mm; deben quedar al menos 6 mm de tablero',
      'Fresar después de cortar y cantear, antes de armar; referenciar siempre desde el canto frontal',
      'Detener la ranura a 15 mm de cada extremo y unir con el canal de cable hacia el canto trasero',
    ],
    safety: ['Gafas y protección auditiva', 'Pieza sujeta con prensas; nunca sostenerla con la mano', 'Avanzar contra el giro de la fresa', EPP_POLVO],
    qualityChecks: ['El perfil entra a presión, al ras de la cara', 'Ranura recta y paralela al canto frontal', 'Sin astillado de la melamina en los bordes'],
    alternatives: ['Router CNC con programa validado', 'Perfil LED de sobreponer (sin ranura)', 'Sierra de mesa con disco de ranurar (sólo ranuras pasantes)'],
    consumables: ['Fresa recta de carburo 6–12 mm', 'Cinta de pintor para evitar astillado', 'Perfil de prueba'],
  },
  {
    id: 'sierra-copa', name: 'Broca sierra copa Ø60 mm (contactos y pasacables)', category: 'mecanizado', station: 'mecanizado',
    purpose: 'Perforar los barrenos pasados de contactos de mueble y pasacables.',
    steps: ['Marcar centro', 'Broca guía', 'Perforar mitad', 'Voltear y terminar'],
    ppe: ['gafas', 'respirador'],
    keySettings: ['Ø de la broca = Ø del contacto o pasacables comprado (normalmente 60 mm)', 'Perforar por las dos caras para no astillar la melamina', 'Barreno a 70 mm del canto trasero (deja paso al respaldo)'],
    safety: ['Gafas', 'Pieza sujeta con prensas', EPP_POLVO],
    qualityChecks: ['El contacto entra a presión y queda al ras', 'Sin astillado en ninguna cara'],
    alternatives: ['Router con plantilla circular', 'Caladora con disco guía'],
    consumables: ['Broca sierra copa Ø60 con broca guía'],
  },
  // --- Armado ---
  {
    id: 'atornillador', name: 'Taladro atornillador inalámbrico con embrague', category: 'armado', station: 'armado',
    purpose: 'Apretar excéntricos, tornillos de ensamble, respaldo y herrajes sin barrer la rosca.',
    steps: ['Elegir punta', 'Embrague bajo', 'Atornillar recto', 'Parar al asentar'],
    ppe: ['gafas'],
    keySettings: ['Embrague bajo: el aglomerado se barre con facilidad', 'Tornillo para aglomerado (rosca gruesa)'],
    safety: ['Gafas'],
    qualityChecks: ['Tornillos asentados, sin barrer ni sobresalir'],
    alternatives: ['Destornillador manual para herrajes de regulación'],
    consumables: ['Puntas PZ2/PH2', 'Tornillería del despiece de herrajes'],
  },
  {
    id: 'prensas', name: 'Prensas (sargentos) y escuadras de armado', category: 'armado', station: 'armado',
    purpose: 'Mantener la caja a escuadra mientras se une y se fija el respaldo.',
    steps: ['Presentar por ID', 'Poner taquetes', 'Unir caja', 'Prensar', 'Medir diagonales', 'Fijar respaldo'],
    ppe: ['guantes'],
    keySettings: ['Banco de armado plano y nivelado', 'Tacos de protección para no marcar la melamina'],
    safety: ['Cuidado con atrapamiento de dedos', 'Piezas grandes entre dos personas'],
    qualityChecks: ['Diagonales en tolerancia', 'Uniones al ras, sin escalón'],
    alternatives: ['Escuadras magnéticas de armado'],
    consumables: ['Taquetes', 'Excéntricos y pernos', 'Cola blanca (si la unión lo indica)'],
  },
  // --- Herrajes y frentes ---
  {
    id: 'plantillas-herrajes', name: 'Plantillas de montaje de bisagras, correderas y jaladeras', category: 'herrajes', station: 'frentes',
    purpose: 'Colocar herrajes en posición repetible y regular holguras.',
    steps: ['Montar bases', 'Colgar frentes', 'Regular 3 ejes', 'Igualar holguras', 'Jaladeras', 'Probar'],
    ppe: [],
    keySettings: ['Holgura perimetral y entre hojas del proyecto', 'Hojas que giran sobre divisor: bisagra de semi-solape', 'Correderas: holgura lateral según ficha (la caja de cajón ya la descuenta)'],
    safety: ['Cuidado con dedos al probar cierres suaves'],
    qualityChecks: ['Holguras uniformes', 'Apertura sin roces', 'Cierre completo y suave'],
    alternatives: ['Trazado con escuadra y punzón (más lento)'],
    consumables: ['Bisagras', 'Correderas', 'Jaladeras', 'Tornillos para herraje'],
  },
  // --- Herrería ---
  {
    id: 'tronzadora', name: 'Tronzadora o sierra cinta para metal', category: 'herrería', station: 'herreria',
    purpose: 'Cortar PTR según el plan de barras a la medida y ángulo indicados.',
    steps: ['Revisar plan', 'Sujetar barra', 'Cortar', 'Rebabar', 'Marcar pieza'],
    ppe: ['gafas', 'auditiva', 'guantes'],
    keySettings: ['Disco o cinta para acero', 'Tope de longitud para piezas repetidas'],
    safety: ['Careta o gafas + protección auditiva', 'Guantes de carnaza para manipular', 'Pieza sujeta en prensa, nunca a mano'],
    qualityChecks: ['Longitud ±1 mm', 'Corte a escuadra'],
    alternatives: ['Esmeriladora angular con disco de corte y guía', 'Corte por el proveedor de acero'],
    consumables: ['Disco de corte para acero', 'Lima / disco de desbaste'],
  },
  {
    id: 'soldadora', name: 'Soldadora (MIG o electrodo) con escuadras magnéticas', category: 'herrería', station: 'herreria',
    purpose: 'Unir el bastidor a escuadra y con cordones según diseño validado.',
    steps: ['Limpiar', 'Armar a escuadra', 'Puntear', 'Revisar diagonales', 'Soldar', 'Esmerilar'],
    ppe: ['careta', 'guantes', 'calzado'],
    keySettings: ['Parámetros según espesor del PTR y ficha del equipo', 'Soldar alternando para reducir deformación', 'El diseño estructural lo valida un responsable (bloqueo de liberación)'],
    safety: ['Careta de soldar con filtro adecuado', 'Guantes y mandil de carnaza, ropa de algodón', 'Ventilación y extintor a mano', 'Retirar polvo de madera y combustibles del área'],
    qualityChecks: ['Diagonales del bastidor', 'Cordones continuos sin poros', 'Bastidor apoyado plano'],
    alternatives: ['Herrero externo con plano y lista de piezas'],
    consumables: ['Microalambre o electrodos', 'Gas de protección (MIG)', 'Discos de desbaste'],
  },
  {
    id: 'pintura-metal', name: 'Preparación y pintura anticorrosiva', category: 'acabado', station: 'herreria',
    purpose: 'Proteger el bastidor: desengrase, primario y acabado (o pintura electrostática externa).',
    steps: ['Desengrasar', 'Lijar', 'Primario', 'Acabado', 'Curar'],
    ppe: ['respirador', 'guantes'],
    keySettings: ['Tiempos de secado y espesor según ficha de la pintura'],
    safety: ['Respirador para vapores orgánicos', 'Área ventilada, sin flama'],
    qualityChecks: ['Cobertura uniforme, sin escurrimientos', 'Sin óxido visible'],
    alternatives: ['Servicio de pintura electrostática'],
    consumables: ['Desengrasante', 'Primario anticorrosivo', 'Pintura de acabado'],
  },
  // --- Calidad ---
  {
    id: 'lampara-inspeccion', name: 'Lámpara de inspección (luz rasante)', category: 'medición', station: 'calidad',
    purpose: 'Revelar despostillado, rayones, cola visible y juntas de canto que no se ven con luz de techo.',
    steps: ['Luz rasante', 'Recorrer caras', 'Marcar defectos', 'Corregir', 'Registrar'],
    ppe: [],
    keySettings: ['Revisar frentes y cantos visibles con prioridad', 'Inspeccionar antes de empacar'],
    safety: ['Sin riesgos relevantes'],
    qualityChecks: ['Sin despostillado, rayones ni cola visible en caras vistas'],
    alternatives: ['Linterna potente sostenida en ángulo'],
    consumables: ['Cinta de enmascarar para marcar defectos'],
  },
  // --- Empaque e instalación ---
  {
    id: 'empaque', name: 'Material de empaque y etiquetado por módulo', category: 'acabado', station: 'empaque',
    purpose: 'Evitar golpes en aristas y frentes durante el transporte.',
    steps: ['Limpiar', 'Esquineros', 'Envolver frentes', 'Etiquetar', 'Planear carga'],
    ppe: ['guantes', 'calzado'],
    keySettings: ['Módulos de más de 25 kg: maniobra entre dos personas'],
    safety: ['Levantar con la espalda recta; usar faja o diablo para cargas pesadas'],
    qualityChecks: ['Etiqueta visible con ID y peso', 'Frentes y cantos protegidos'],
    alternatives: ['Mantas de mudanza'],
    consumables: ['Esquineros', 'Película estirable', 'Cartón', 'Etiquetas'],
  },
  {
    id: 'nivel', name: 'Nivel láser o de burbuja', category: 'instalación', station: 'instalacion',
    purpose: 'Instalar módulos a nivel y a plomo.',
    steps: ['Trazar nivel', 'Nivelar base', 'Revisar plomo', 'Alinear frentes'],
    ppe: [],
    keySettings: ['Tomar el punto más alto del piso como referencia'],
    safety: ['No mirar directo al láser'],
    qualityChecks: ['Módulos a nivel y a plomo', 'Frentes alineados entre módulos'],
    alternatives: ['Manguera de nivel'],
    consumables: [],
  },
  {
    id: 'probador-electrico', name: 'Probador de contactos y desarmadores aislados', category: 'instalación', station: 'instalacion',
    purpose: 'Comprobar polaridad y tierra de los contactos del mueble después de conectarlos.',
    steps: ['Cortar corriente', 'Conectar', 'Probar contacto', 'Probar luces'],
    ppe: ['gafas'],
    keySettings: ['Lo conecta un electricista a 127 V con tierra física', 'El cable no debe quedar tenso ni prensado por cajones o puertas'],
    safety: ['Trabajar sin corriente', 'Herramienta con mango aislado'],
    qualityChecks: ['Probador indica polaridad y tierra correctas', 'Luces y USB encienden'],
    alternatives: ['Multímetro'],
    consumables: ['Cinchos', 'Grapas para cable'],
  },
  {
    id: 'rotomartillo', name: 'Rotomartillo / taladro percutor y detector de instalaciones', category: 'instalación', station: 'instalacion',
    purpose: 'Perforar muro para colgadores y anclajes antivuelco sin dañar tuberías ni cables.',
    steps: ['Detectar instalaciones', 'Ver tipo de muro', 'Elegir taquete', 'Perforar', 'Anclar', 'Probar'],
    ppe: ['gafas', 'auditiva', 'respirador'],
    keySettings: ['Taquete según muro (concreto, block, tablaroca)', 'Capacidad del anclaje validada para el peso del módulo + contenido'],
    safety: ['Gafas y protección auditiva', 'Respirador para polvo de concreto', 'Escalera estable'],
    qualityChecks: ['Anclajes firmes, sin juego', 'Módulo no se inclina al abrir cajones'],
    alternatives: ['Taladro con percusión para muros blandos'],
    consumables: ['Brocas para concreto', 'Taquetes y pijas según muro', 'Anclajes antivuelco / colgadores'],
  },
  // --- Seguridad general ---
  {
    id: 'epp', name: 'Equipo de protección personal (EPP) y área de trabajo', category: 'seguridad', station: 'preparacion',
    purpose: 'Proteger a las personas en todas las estaciones.',
    steps: ['Revisar EPP', 'Extracción y orden', 'Botiquín y extintor', 'Bloquear al reparar'],
    ppe: ['gafas', 'auditiva', 'respirador', 'guantes', 'calzado'],
    keySettings: ['El polvo de madera y MDF es dañino: extracción en la fuente + respirador'],
    safety: ['Gafas de seguridad', 'Protección auditiva', 'Respirador N95/P2', 'Calzado de seguridad', 'Guantes según tarea', 'Botiquín y extintor'],
    qualityChecks: ['EPP completo antes de operar máquinas'],
    alternatives: [],
    consumables: ['Filtros de respirador', 'Tapones auditivos'],
  },
];

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  'medición': 'Medición', corte: 'Corte', canteado: 'Canteado', mecanizado: 'Mecanizado', armado: 'Armado', herrajes: 'Herrajes',
  'herrería': 'Herrería', acabado: 'Acabado y empaque', 'instalación': 'Instalación', seguridad: 'Seguridad',
};
