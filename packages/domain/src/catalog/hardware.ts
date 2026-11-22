import type { HardwareProduct, HingeRule, MachiningPattern } from '../types';

/**
 * Tabla ORIENTATIVA de bisagras por alto de puerta. No es dato de fabricante:
 * toda cantidad derivada queda en `pending_validation` hasta seleccionar un SKU con ficha.
 */
export const GENERIC_HINGE_RULES: HingeRule[] = [
  { maxDoorHeightMm: 900, hingesPerDoor: 2 },
  { maxDoorHeightMm: 1600, hingesPerDoor: 3 },
  { maxDoorHeightMm: 2000, hingesPerDoor: 4 },
  { maxDoorHeightMm: 2400, hingesPerDoor: 5 },
];

export const HARDWARE: HardwareProduct[] = [
  // Bisagras
  {
    id: 'hinge-generic-110', category: 'hinge', name: 'Bisagra cazoleta 35 mm 110° sobrepuesta (genérica)', manufacturer: null, sku: null,
    productKey: 'hw:hinge_overlay_110', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { hingeRules: GENERIC_HINGE_RULES, doorThicknessRangeMm: [15, 22] }, machiningPatternId: 'hinge-cup-35',
    notes: 'Seleccionar SKU con ficha técnica antes de perforar; distancia de cazoleta no se asume. Rango de espesor de puerta 15–22 mm: valor típico de bisagra de cazoleta Ø35, verificar.',
  },
  {
    id: 'hinge-generic-110-half', category: 'hinge', name: 'Bisagra cazoleta 35 mm 110° semi-solape / acodada (genérica)', manufacturer: null, sku: null,
    productKey: 'hw:hinge_half_overlay_110', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { hingeRules: GENERIC_HINGE_RULES, doorThicknessRangeMm: [15, 22] }, machiningPatternId: 'hinge-cup-35',
    notes: 'Para hojas que giran sobre un divisor compartido con otra hoja. Validar solape con la ficha del fabricante.',
  },
  {
    id: 'hinge-samet-master110', category: 'hinge', name: 'Bisagra Samet Master 110° cierre suave', manufacturer: 'Samet', sku: 'SAM1010041150',
    productKey: 'hw:samet:SAM1010041150', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { hingeRules: GENERIC_HINGE_RULES, doorThicknessRangeMm: [15, 22] }, machiningPatternId: 'hinge-cup-35',
    notes: 'Referencia tomada del prototipo; adjuntar ficha del fabricante para validar tabla de cantidad y mecanizado.',
  },
  // Correderas
  {
    id: 'slide-generic-telescopic', category: 'drawer_slide', name: 'Corredera telescópica lateral (genérica, valores típicos a confirmar)', manufacturer: null, sku: null,
    productKey: 'hw:slide_telescopic', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { sideClearancePerSideMm: 12.5, nominalLengthsMm: [250, 300, 350, 400, 450, 500, 550], drawerBoxThicknessMm: 15 },
    machiningPatternId: 'slide-mount',
    notes: 'Holgura de 12.5 mm/lado es valor típico NO verificado: confirmar con la ficha de la corredera comprada.',
  },
  {
    id: 'slide-samet-soclass-350', category: 'drawer_slide', name: 'Corredera Samet SO Class 350 mm', manufacturer: 'Samet', sku: 'SAM11662153004',
    productKey: 'hw:samet:SAM11662153004', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { nominalLengthsMm: [350] },
    notes: 'Falta holgura lateral en la ficha: la caja de cajón no se calcula hasta capturarla. Verificar si la presentación es pieza o juego.',
  },
  {
    id: 'slide-samet-smartslide-350', category: 'drawer_slide', name: 'Corredera oculta Samet SmartSlide 350 mm', manufacturer: 'Samet', sku: 'SAM127240533',
    productKey: 'hw:samet:SAM127240533', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { nominalLengthsMm: [350], drawerBoxThicknessMm: 16 },
    notes: 'Compatible sólo con caja de 16 mm según referencia del prototipo; despejes según ficha.',
  },
  // Uniones y soportes
  { id: 'cam-minifix15', category: 'cam_connector', name: 'Conector excéntrico tipo minifix 15 mm + perno (genérico)', manufacturer: null, sku: null, productKey: 'hw:cam_minifix15', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation', machiningPatternId: 'cam-minifix' },
  { id: 'dowel-8x35', category: 'dowel', name: 'Taquete de madera 8 × 35 mm', manufacturer: null, sku: null, productKey: 'hw:dowel8x35', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'screw-4x40', category: 'screw', name: 'Tornillo para aglomerado 4 × 40 mm', manufacturer: null, sku: null, productKey: 'hw:screw4x40', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'screw-spax-4x15', category: 'screw', name: 'Tornillo Spax 4 × 15 mm (herrajes/respaldo)', manufacturer: 'Spax', sku: 'SP044015', productKey: 'hw:spax:SP044015', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'shelf-pin-5', category: 'shelf_pin', name: 'Soporte de entrepaño Ø5 mm', manufacturer: null, sku: null, productKey: 'hw:shelf_pin5', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', machiningPatternId: 'shelf-pin-line-32' },
  { id: 'handle-generic', category: 'handle', name: 'Jaladera (modelo por definir)', manufacturer: null, sku: null, productKey: 'hw:handle_generic', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'leveler-100', category: 'leveler', name: 'Pata niveladora plástica 100–150 mm', manufacturer: null, sku: null, productKey: 'hw:leveler100', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { heightRangeMm: [100, 150] } },
  { id: 'plinth-clip', category: 'plinth_clip', name: 'Clip para zoclo', manufacturer: null, sku: null, productKey: 'hw:plinth_clip', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'wall-anchor-antitip', category: 'wall_anchor', name: 'Anclaje antivuelco a muro (taquete + escuadra/cable)', manufacturer: null, sku: null, productKey: 'hw:antitip_anchor', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation', notes: 'El taquete depende del tipo de muro (block, concreto, tablaroca). Validar en sitio.' },
  { id: 'cabinet-hanger', category: 'wall_anchor', name: 'Colgador regulable para gabinete aéreo', manufacturer: null, sku: null, productKey: 'hw:cabinet_hanger', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', notes: 'Capacidad de carga y mecanizado según fabricante; riel/taquete según muro.' },
  { id: 'hanging-rail-oval', category: 'hanging_rail', name: 'Tubo de colgar ovalado (aluminio/acero)', manufacturer: null, sku: null, productKey: 'hw:hanging_rail_oval', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'hanging-rail-support', category: 'hanging_rail_support', name: 'Soporte de tubo de colgar', manufacturer: null, sku: null, productKey: 'hw:hanging_rail_support', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  // Iluminación LED empotrada. La ranura de router sale del perfil elegido: confirmar con el perfil comprado.
  { id: 'led-strip-cob-12v', category: 'led_strip', name: 'Tira LED COB 12 V 10 W/m, luz cálida 3000 K', manufacturer: null, sku: null, productKey: 'hw:led_strip_cob12v', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { ledWattsPerM: 10 } },
  { id: 'led-strip-smd-12v', category: 'led_strip', name: 'Tira LED SMD 2835 12 V 4.8 W/m, luz neutra 4000 K', manufacturer: null, sku: null, productKey: 'hw:led_strip_smd12v', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { ledWattsPerM: 4.8 } },
  { id: 'led-profile-embed-17', category: 'led_profile', name: 'Perfil de aluminio para empotrar con difusor (ranura 17 × 8 mm)', manufacturer: null, sku: null, productKey: 'hw:led_profile_embed17', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { grooveWidthMm: 17, grooveDepthMm: 8 } },
  { id: 'led-profile-embed-12', category: 'led_profile', name: 'Perfil de aluminio delgado para empotrar (ranura 12 × 7 mm)', manufacturer: null, sku: null, productKey: 'hw:led_profile_embed12', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { grooveWidthMm: 12, grooveDepthMm: 7 } },
  ...[30, 60, 100, 150, 200].map((w): HardwareProduct => ({ id: `led-driver-12v-${w}`, category: 'led_driver', name: `Fuente para LED 12 V ${w} W`, manufacturer: null, sku: null, productKey: `hw:led_driver12v_${w}w`, unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', params: { driverWatts: w } })),
  { id: 'led-sensor-door', category: 'led_sensor', name: 'Sensor de apertura de puerta para LED 12 V', manufacturer: null, sku: null, productKey: 'hw:led_sensor_door', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'led-sensor-hand', category: 'led_sensor', name: 'Sensor de movimiento de mano (sin contacto) 12 V', manufacturer: null, sku: null, productKey: 'hw:led_sensor_hand', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'led-sensor-touch', category: 'led_sensor', name: 'Interruptor táctil con atenuador 12 V', manufacturer: null, sku: null, productKey: 'hw:led_sensor_touch', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  // Peinadores y conexión eléctrica
  { id: 'wood-leg', category: 'leg', name: 'Pata cónica de madera con placa de fijación', manufacturer: null, sku: null, productKey: 'hw:wood_leg', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'mirror-4mm', category: 'mirror', name: 'Espejo 4 mm con canto pulido (vidriería)', manufacturer: null, sku: null, productKey: 'hw:mirror4mm', unit: 'm²', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'mirror-fix', category: 'mirror', name: 'Grapas y adhesivo para espejo', manufacturer: null, sku: null, productKey: 'hw:mirror_fix', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'bulb-g45', category: 'mirror', name: 'Foco LED G45 4 W 127 V con socket', manufacturer: null, sku: null, productKey: 'hw:bulb_g45', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'power-switch', category: 'power', name: 'Apagador para mueble 127 V', manufacturer: null, sku: null, productKey: 'hw:power_switch', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'power-outlet', category: 'power', name: 'Contacto doble para mueble Ø60 mm, 127 V con tierra', manufacturer: null, sku: null, productKey: 'hw:power_outlet', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'power-outlet-usb', category: 'power', name: 'Contacto para mueble Ø60 mm con 2 USB, 127 V', manufacturer: null, sku: null, productKey: 'hw:power_outlet_usb', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'grommet-60', category: 'power', name: 'Pasacables Ø60 mm con tapa', manufacturer: null, sku: null, productKey: 'hw:grommet60', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'power-cable', category: 'power', name: 'Cable uso rudo 3 × 14 AWG con clavija', manufacturer: null, sku: null, productKey: 'hw:power_cable', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  // Frentes abatibles
  { id: 'fold-hinge', category: 'hinge', name: 'Bisagra para frente abatible (eje inferior)', manufacturer: null, sku: null, productKey: 'hw:fold_hinge', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'lid-stay', category: 'lift_system', name: 'Compás de soporte con freno para frente abatible', manufacturer: null, sku: null, productKey: 'hw:lid_stay', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'fold-bracket', category: 'lift_system', name: 'Escuadra abatible para mesa (par)', manufacturer: null, sku: null, productKey: 'hw:fold_bracket', unit: 'par', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'bed-mechanism', category: 'lift_system', name: 'Mecanismo de cama abatible con pistones (kit)', manufacturer: null, sku: null, productKey: 'hw:bed_mechanism', unit: 'kit', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'bed-leg', category: 'lift_system', name: 'Pata abatible para cama', manufacturer: null, sku: null, productKey: 'hw:bed_leg', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'mattress-strap', category: 'lift_system', name: 'Correa para sujetar colchón', manufacturer: null, sku: null, productKey: 'hw:mattress_strap', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'magnet-catch', category: 'handle', name: 'Cierre magnético', manufacturer: null, sku: null, productKey: 'hw:magnet_catch', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'led-cable-2x20', category: 'led_cable', name: 'Cable dúplex calibre 20 AWG + conectores', manufacturer: null, sku: null, productKey: 'hw:led_cable2x20', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
];

/**
 * Patrones de mecanizado. Ninguno trae coordenadas: se requieren fichas técnicas.
 * Un patrón con validationStatus 'verified' y `holes` capturados de la ficha sí genera coordenadas.
 */
export const MACHINING_PATTERNS: MachiningPattern[] = [
  { id: 'hinge-cup-35', name: 'Cazoleta de bisagra Ø35 + tornillos de base', hardwareCategory: 'hinge', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 3 },
  { id: 'cam-minifix', name: 'Excéntrico + perno + taquete', hardwareCategory: 'cam_connector', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 3 },
  { id: 'shelf-pin-line-32', name: 'Línea de barrenos para soporte de entrepaño', hardwareCategory: 'shelf_pin', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 4 },
  { id: 'slide-mount', name: 'Fijación de corredera a costado', hardwareCategory: 'drawer_slide', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 4 },
];
