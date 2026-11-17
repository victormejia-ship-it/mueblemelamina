/**
 * Textos visibles en español. Los códigos internos de pieza (SIDE, DRAWER_FRONT…) no cambian —el motor y los
 * archivos JSON los usan—; aquí sólo se traducen para mostrar y exportar. 'en' deja los códigos técnicos.
 */
export type CodeLang = 'es' | 'en';

export const PART_CODE_ES: Record<string, string> = {
  SIDE: 'COSTADO',
  HORIZONTAL: 'TAPA_PISO',
  BACK: 'RESPALDO',
  SHELF: 'ENTREPAÑO',
  DIVIDER: 'DIVISOR',
  DOOR: 'PUERTA',
  DRAWER_FRONT: 'FRENTE_CAJON',
  DRAWER_SIDE: 'COSTADO_CAJON',
  DRAWER_FB: 'TESTERO_CAJON',
  DRAWER_BOTTOM: 'FONDO_CAJON',
  DRAWER_RAIL: 'TRAVESAÑO',
  PLINTH_RAIL: 'ZOCLO',
  PLINTH_CROSS: 'ZOCLO_TRAVESAÑO',
  DESK_TOP: 'CUBIERTA',
  DESK_SIDE: 'COSTADO_ESCRITORIO',
  DESK_MODESTY: 'FALDON',
  BOTTOM_LED: 'PISO_LED',
  TOP_LED: 'TAPA_LED',
};

// Códigos más largos primero para que DRAWER_SIDE gane sobre SIDE.
const KEYS = Object.keys(PART_CODE_ES).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(?<![A-Z_])(${KEYS.join('|')})(_\\d+)?(?![A-Za-z_])`, 'g');

/** Código de pieza visible (p. ej. DRAWER_FRONT_2 → FRENTE_CAJON_2). */
export function partCodeLabel(code: string, lang: CodeLang = 'es'): string {
  if (lang === 'en') return code;
  return code.replace(RE, (_m, base: string, n?: string) => `${PART_CODE_ES[base]}${n ?? ''}`);
}

/** Traduce los códigos de pieza dentro de cualquier texto (IDs como M01-DRAWER_SIDE, mensajes, CSV, SVG). */
/** Términos técnicos internos que aparecen en notas. */
const TERMS_ES: [RegExp, string][] = [
  [/\blayout_factible\b/g, 'acomodo factible'],
  [/\bestimacion_area_no_validada\b/g, 'estimación por área (no validada)'],
  [/\bSIN_MEDICION\b/g, 'Sin medición'],
  [/\bNO_PASA\b/g, 'No pasa'],
];

export function localizeIds(text: string, lang: CodeLang = 'es'): string {
  if (lang === 'en') return text;
  let out = text.replace(RE, (_m, base: string, n?: string) => `${PART_CODE_ES[base]}${n ?? ''}`);
  for (const [re, v] of TERMS_ES) out = out.replace(re, v);
  return out;
}

export const PATTERN_LABEL_ES: Record<string, string> = {
  'hinge-cup-35': 'Cazoleta de bisagra Ø35',
  'cam-minifix': 'Excéntrico (minifix)',
  'shelf-pin-line-32': 'Línea de soportes (32 mm)',
  'slide-mount': 'Fijación de corredera',
  'led-groove-router': 'Ranura LED (router)',
  'led-cable-channel': 'Canal de cable LED',
};
export const patternLabel = (id: string, lang: CodeLang = 'es') => (lang === 'en' ? id : PATTERN_LABEL_ES[id] ?? id);

export const QUOTE_LINE_STATUS_ES: Record<string, string> = {
  PRICED: 'Con precio', PENDING: 'Pendiente', ESTIMATED: 'Estimado', TAX_UNKNOWN: 'IVA sin definir', EXPIRED_SELECTED: 'Oferta vencida', NOT_APPLICABLE: 'No aplica',
};
export const QUOTE_COMPLETENESS_ES: Record<string, string> = { COMPLETO: 'Completo', INCOMPLETO: 'Incompleto', SIMULACION: 'Simulación' };
export const STEEL_FINISH_ES: Record<string, string> = { primer: 'Primario anticorrosivo', powder_coating: 'Pintura electrostática', paint: 'Esmalte', none: 'Sin acabado' };

export const HW_CATEGORY_ES: Record<string, string> = {
  hinge: 'Bisagra', drawer_slide: 'Corredera', cam_connector: 'Excéntrico', dowel: 'Taquete', shelf_pin: 'Soporte de entrepaño', handle: 'Jaladera',
  leveler: 'Pata niveladora', screw: 'Tornillo', wall_anchor: 'Anclaje a muro', hanging_rail: 'Tubo de colgar', hanging_rail_support: 'Soporte de tubo',
  soft_close: 'Cierre suave', lift_system: 'Sistema abatible', plinth_clip: 'Clip de zoclo', adhesive: 'Adhesivo',
  led_strip: 'Tira LED', led_profile: 'Perfil LED', led_driver: 'Fuente LED', led_sensor: 'Sensor LED', led_cable: 'Cable LED',
};
export const hwCategoryLabel = (c: string, lang: CodeLang = 'es') => (lang === 'en' ? c : HW_CATEGORY_ES[c] ?? c);
export const VALIDATION_ES: Record<string, string> = { verified: 'Verificado', pending_validation: 'Pendiente de validación', blocked: 'Bloqueado' };
export const QUOTE_CATEGORY_ES: Record<string, string> = { board: 'Tablero', edge: 'Canto', hardware: 'Herraje', steel: 'Herrería', service: 'Servicio' };
export const CHECK_CATEGORY_ES: Record<string, string> = { cierre: 'cierre', contacto: 'contacto', frentes: 'frentes', herraje: 'herraje', flecha: 'flecha', canto: 'canto', medida: 'medida', espesor: 'espesor', peso: 'peso' };
/** Traductor de valores enumerados para tablas y CSV. */
export const enumLabel = (map: Record<string, string>, v: string, lang: CodeLang = 'es') => (lang === 'en' ? v : map[v] ?? v);
export const ROLE_ES: Record<string, string> = { carcass: 'Caja', front: 'Frente', back: 'Respaldo', shelf: 'Entrepaño', divider: 'Divisor', drawer_box: 'Caja de cajón', plinth: 'Zoclo', desk: 'Escritorio' };
export const GRAIN_ES: Record<string, string> = { length: 'Largo', width: 'Ancho', none: 'Sin veta' };
