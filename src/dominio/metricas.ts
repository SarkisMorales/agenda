/**
 * Todas las métricas se calculan leyendo el log de eventos, nunca el estado
 * actual de los proyectos. Por eso siguen siendo ciertas aunque después borres
 * el proyecto: el mes que cerraste seis ideas, cerraste seis ideas.
 */
import type { Evento, Proyecto } from './tipos';
import { hoy } from './tiempo';

export interface BalanceDelMes {
  mes: string;
  abiertas: number;
  cerradas: number;
  /** cerradas / abiertas. Arriba de 1 estás bajando la pila. */
  ratio: number;
}

/** `mes` en formato YYYY-MM. */
export function balanceDelMes(eventos: Evento[], mes: string = hoy().slice(0, 7)): BalanceDelMes {
  const delMes = eventos.filter((e) => e.fecha.slice(0, 7) === mes);
  const abiertas = delMes.filter((e) => e.tipo === 'creado').length;
  const cerradas = delMes.filter((e) => e.tipo === 'cerrado').length;
  return { mes, abiertas, cerradas, ratio: abiertas === 0 ? cerradas : cerradas / abiertas };
}

/** Días promedio entre `creado` y `cerrado`, sobre los que efectivamente cerraron. */
export function diasPromedioHastaCerrar(eventos: Evento[]): number | null {
  const creacion = new Map<string, string>();
  for (const e of eventos) {
    if (e.tipo === 'creado' && !creacion.has(e.proyectoId)) creacion.set(e.proyectoId, e.fecha);
  }

  const duraciones: number[] = [];
  const yaContados = new Set<string>();
  for (const e of eventos) {
    if (e.tipo !== 'cerrado' || yaContados.has(e.proyectoId)) continue;
    const inicio = creacion.get(e.proyectoId);
    if (!inicio) continue;
    duraciones.push((Date.parse(e.fecha) - Date.parse(inicio)) / 86_400_000);
    yaContados.add(e.proyectoId);
  }

  if (duraciones.length === 0) return null;
  return duraciones.reduce((a, b) => a + b, 0) / duraciones.length;
}

/**
 * De todo lo que cerraste, qué proporción fue descarte.
 * Un número alto no es fracaso: significa que el filtro funciona.
 */
export function tasaDeDescarte(eventos: Evento[]): number | null {
  const cierres = eventos.filter((e) => e.tipo === 'cerrado');
  if (cierres.length === 0) return null;
  return cierres.filter((e) => e.hasta === 'descartado').length / cierres.length;
}

export function distribucionPorUnidad(proyectos: Proyecto[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const p of proyectos) conteo[p.unidad] = (conteo[p.unidad] ?? 0) + 1;
  return conteo;
}

/**
 * Días consecutivos, contando hacia atrás desde hoy, con al menos un paso
 * completado. Si hoy todavía no completaste nada pero ayer sí, la racha sigue
 * viva: recién se corta cuando pasa un día entero sin nada.
 */
export function racha(eventos: Evento[], hoyISO: string = hoy()): number {
  const dias = new Set(
    eventos.filter((e) => e.tipo === 'paso_completado').map((e) => e.fecha.slice(0, 10)),
  );
  if (dias.size === 0) return 0;

  let cursor = new Date(hoyISO + 'T12:00:00');
  if (!dias.has(hoyISO)) cursor = new Date(cursor.getTime() - 86_400_000);

  let total = 0;
  while (dias.has(aISO(cursor))) {
    total++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return total;
}

function aISO(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}
