import type { MaterialDefinition, Mm } from '../types';
import { r2 } from './helpers';

const G = 9.81;
/**
 * Fracción cuasi-permanente de la carga útil (contenido que permanece en el entrepaño).
 * Se aplica la fluencia (kdef) a esta fracción y al peso propio.
 */
export const QUASI_PERMANENT_FRACTION = 0.6;

export interface SagInput {
  /** Claro libre entre apoyos (mm). */
  spanMm: Mm;
  /** Fondo del entrepaño (mm): ancho de la sección resistente. */
  depthMm: Mm;
  thicknessMm: Mm;
  /** Carga útil uniformemente repartida (kg/m²). */
  loadKgM2: number;
  material: Pick<MaterialDefinition, 'densityKgM3' | 'elasticModulusMPa' | 'creepKdef'>;
  /** Criterio admisible: claro / N. */
  limitRatio: number;
}

export interface SagResult {
  /** Flecha instantánea con carga útil + peso propio (mm). */
  instantMm: number;
  /** Flecha final con fluencia a largo plazo (mm). */
  finalMm: number;
  /** Flecha admisible (mm). */
  limitMm: number;
  ok: boolean;
  /** Carga lineal total usada (N/mm). */
  lineLoadNmm: number;
}

/**
 * Flecha de un entrepaño como viga simplemente apoyada con carga uniforme:
 *   δ = 5·w·L⁴ / (384·E·I),  I = b·t³/12
 * Flecha final = δ_peso propio·(1+kdef) + δ_útil·(1 + kdef·ψ2), con ψ2 = QUASI_PERMANENT_FRACTION.
 * Supone apoyo en los extremos (soportes o uniones fijas) sin empotramiento: resultado conservador.
 * E y kdef son valores típicos: usar la ficha técnica del tablero para un cálculo definitivo.
 */
export function shelfSag(i: SagInput): SagResult | null {
  const E = i.material.elasticModulusMPa;
  if (!E || i.spanMm <= 0 || i.depthMm <= 0 || i.thicknessMm <= 0) return null;
  const I = (i.depthMm * i.thicknessMm ** 3) / 12; // mm⁴
  const b = i.depthMm / 1000; // m
  const selfKgM2 = (i.material.densityKgM3 * i.thicknessMm) / 1000; // kg/m²
  const wSelf = (selfKgM2 * G * b) / 1000; // N/mm
  const wLive = (i.loadKgM2 * G * b) / 1000; // N/mm
  const k = (5 * i.spanMm ** 4) / (384 * E * I);
  const dSelf = wSelf * k;
  const dLive = wLive * k;
  const finalMm = dSelf * (1 + i.material.creepKdef) + dLive * (1 + i.material.creepKdef * QUASI_PERMANENT_FRACTION);
  const limitMm = i.spanMm / i.limitRatio;
  return { instantMm: r2(dSelf + dLive), finalMm: r2(finalMm), limitMm: r2(limitMm), ok: finalMm <= limitMm, lineLoadNmm: wSelf + wLive };
}

/** Peso de un tablero (kg) a partir de sus medidas finales. */
export function panelWeightKg(lengthMm: Mm, widthMm: Mm, thicknessMm: Mm, densityKgM3: number): number {
  return (lengthMm * widthMm * thicknessMm * densityKgM3) / 1e9;
}
