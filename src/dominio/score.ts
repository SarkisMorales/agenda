import type { Proyecto } from './tipos';

/** Los tres factores del score van de 1 a 5. */
export function factorValido(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * score = ((impacto * confianza) / esfuerzo) * 4, redondeado, tope 100.
 *
 * Con impacto=5, confianza=5, esfuerzo=1 da exactamente 100.
 * Con impacto=1, confianza=1, esfuerzo=5 da 1.
 * Ojo: la escala no es lineal — como el esfuerzo divide, la mayoría de las
 * combinaciones caen abajo de 40. Eso es intencional: sirve para ordenar la
 * bandeja, no para leerlo como un porcentaje.
 */
export function calcularScore(p: Pick<Proyecto, 'impacto' | 'esfuerzo' | 'confianza'>): number {
  if (!factorValido(p.impacto) || !factorValido(p.esfuerzo) || !factorValido(p.confianza)) {
    throw new Error('Impacto, esfuerzo y confianza tienen que ser enteros del 1 al 5.');
  }
  return Math.min(100, Math.round(((p.impacto * p.confianza) / p.esfuerzo) * 4));
}
