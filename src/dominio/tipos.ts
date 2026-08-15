/**
 * Tipos del dominio.
 *
 * Nota importante respecto del spec original: `eventos` NO vive adentro del
 * proyecto. Vive en su propia tabla global (ver `src/datos/db.ts`). Si los
 * eventos fueran un campo del proyecto, borrar el proyecto se llevaría puesto
 * su historial, y el spec pide justo lo contrario: el log sobrevive al borrado.
 */

export type Estado =
  | 'bandeja'
  | 'evaluando'
  | 'activo'
  | 'pausado'
  | 'terminado'
  | 'descartado';

export const ESTADOS: readonly Estado[] = [
  'bandeja',
  'evaluando',
  'activo',
  'pausado',
  'terminado',
  'descartado',
] as const;

/** Estados que cuentan como "cerrado": ya no consumen atención. */
export const ESTADOS_CERRADOS: readonly Estado[] = ['terminado', 'descartado'] as const;

export type Moneda = 'ARS' | 'USD';

export type TipoEvento =
  | 'creado'
  | 'cambio_estado'
  | 'paso_agregado'
  | 'paso_completado'
  | 'accion_definida'
  | 'cerrado'
  | 'revivido';

/**
 * Eventos que cuentan como movimiento real del proyecto para medir
 * estancamiento. Renombrar un proyecto o cambiarle una etiqueta no es avanzar,
 * así que esos cambios no resetean el reloj.
 */
export const EVENTOS_DE_PROGRESO: readonly TipoEvento[] = [
  'cambio_estado',
  'paso_agregado',
  'paso_completado',
  'accion_definida',
  'cerrado',
  'revivido',
] as const;

export interface Evento {
  id: string;
  proyectoId: string;
  tipo: TipoEvento;
  detalle: string;
  /** ISO 8601. */
  fecha: string;
  /**
   * Agregado al spec: en los cambios de estado guardamos desde/hasta como
   * datos, no sólo dentro del texto de `detalle`. Sin esto las métricas
   * tendrían que adivinar leyendo el texto, y el log dejaría de ser una
   * fuente confiable en cuanto cambiemos una palabra del mensaje.
   */
  desde?: Estado;
  hasta?: Estado;
}

export interface Paso {
  id: string;
  texto: string;
  hecho: boolean;
  creadoEn: string;
  completadoEn?: string;
}

export interface Proyecto {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: Estado;
  /** Unidad de negocio. Texto libre para poder agregar unidades nuevas. */
  unidad: string;
  etiquetas: string[];

  /** Scoring, 1 a 5 cada uno. */
  impacto: number;
  esfuerzo: number;
  confianza: number;

  /** Plata (opcional). */
  inversionEstimada?: number;
  retornoMensualEstimado?: number;
  moneda: Moneda;
  /** Se congela al guardar. Nunca se recalcula. */
  cotizacionAlCargar?: number;

  /** Ejecución. */
  proximaAccion?: string;
  fechaLimite?: string;
  pasos: Paso[];

  /** Cierre. */
  motivoCierre?: string;
  aprendizaje?: string;

  /** Meta. */
  creadoEn: string;
  actualizadoEn: string;
  activadoEn?: string;
  cerradoEn?: string;
}

export interface Ajustes {
  id: 'unico';
  limiteWip: number;
  ultimaRevision?: string;
  ultimoBackup?: string;
  tema: 'claro' | 'oscuro' | 'sistema';
  unidades: string[];
  /** Última cotización usada, para proponerla por defecto al cargar plata. */
  cotizacionSugerida?: number;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 'unico',
  limiteWip: 3,
  tema: 'sistema',
  unidades: ['La Mordida', 'Kiosco', 'Crystal System', 'Top Papas', 'Personal', 'Otro'],
};

/** Valores neutros para una captura rápida sin fricción. */
export const SCORE_NEUTRO = { impacto: 3, esfuerzo: 3, confianza: 3 } as const;

export const LARGO_MINIMO_CIERRE = 10;
export const DIAS_ESTANCADO_AMBAR = 10;
export const DIAS_ESTANCADO_ROJO = 21;
export const DIAS_ENTRE_REVISIONES = 7;
