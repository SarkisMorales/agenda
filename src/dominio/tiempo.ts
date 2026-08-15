import {
  DIAS_ESTANCADO_AMBAR,
  DIAS_ESTANCADO_ROJO,
  EVENTOS_DE_PROGRESO,
  type Evento,
  type Proyecto,
} from './tipos';

export type NivelEstancamiento = 'ok' | 'ambar' | 'rojo';

export interface Estancamiento {
  nivel: NivelEstancamiento;
  dias: number;
}

const MS_POR_DIA = 86_400_000;

export function diasEntre(desdeISO: string, hastaISO: string): number {
  return Math.floor((Date.parse(hastaISO) - Date.parse(desdeISO)) / MS_POR_DIA);
}

/** Fecha del último movimiento real; si nunca hubo, la fecha de creación. */
export function ultimoMovimiento(proyecto: Proyecto, eventos: Evento[]): string {
  const progreso = eventos
    .filter((e) => e.proyectoId === proyecto.id && EVENTOS_DE_PROGRESO.includes(e.tipo))
    .map((e) => e.fecha)
    .sort();
  return progreso.at(-1) ?? proyecto.creadoEn;
}

/**
 * Sólo los proyectos activos se consideran estancados: un pausado está
 * detenido a propósito y no tiene sentido retarlo por eso.
 */
export function calcularEstancamiento(
  proyecto: Proyecto,
  eventos: Evento[],
  ahoraISO: string = new Date().toISOString(),
): Estancamiento {
  if (proyecto.estado !== 'activo') return { nivel: 'ok', dias: 0 };

  const dias = Math.max(0, diasEntre(ultimoMovimiento(proyecto, eventos), ahoraISO));
  if (dias > DIAS_ESTANCADO_ROJO) return { nivel: 'rojo', dias };
  if (dias > DIAS_ESTANCADO_AMBAR) return { nivel: 'ambar', dias };
  return { nivel: 'ok', dias };
}

/** Un activo sin próxima acción definida: la alerta más importante de la app. */
export function sinProximaAccion(proyecto: Proyecto): boolean {
  return proyecto.estado === 'activo' && !proyecto.proximaAccion?.trim();
}

export function estaVencido(proyecto: Proyecto, hoyISO: string = hoy()): boolean {
  if (!proyecto.fechaLimite) return false;
  if (proyecto.estado === 'terminado' || proyecto.estado === 'descartado') return false;
  return proyecto.fechaLimite < hoyISO;
}

/** Fecha local en formato YYYY-MM-DD (no UTC: importa el día del usuario). */
export function hoy(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
