import {
  LARGO_MINIMO_CIERRE,
  type Estado,
  type Proyecto,
  type TipoEvento,
} from './tipos';

/**
 * Transiciones permitidas. Lo que no está acá, no se puede hacer: la UI no
 * decide qué es válido, lo decide esta tabla.
 */
const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  bandeja: ['evaluando', 'activo', 'descartado'],
  evaluando: ['bandeja', 'activo', 'pausado', 'descartado'],
  activo: ['pausado', 'terminado', 'descartado'],
  pausado: ['activo', 'terminado', 'descartado'],
  // Revivir: vuelven a bandeja, para que pasen otra vez por el filtro.
  terminado: ['bandeja'],
  descartado: ['bandeja'],
};

export type CodigoBloqueo =
  | 'transicion_invalida'
  | 'wip_lleno'
  | 'falta_proxima_accion'
  | 'falta_motivo_cierre'
  | 'falta_aprendizaje';

export interface Bloqueo {
  codigo: CodigoBloqueo;
  mensaje: string;
}

export type Resultado =
  | { ok: true }
  | { ok: false; bloqueos: Bloqueo[] };

/** Datos que la transición puede aportar en el mismo movimiento. */
export interface DatosTransicion {
  proximaAccion?: string;
  motivoCierre?: string;
  aprendizaje?: string;
}

export interface ContextoTransicion {
  /** Cuántos proyectos están en `activo` ahora mismo, sin contar este. */
  activosActuales: number;
  limiteWip: number;
}

export function transicionPermitida(desde: Estado, hasta: Estado): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

function texto(...candidatos: (string | undefined)[]): string {
  return (candidatos.find((c) => c?.trim()) ?? '').trim();
}

/**
 * Valida un cambio de estado. Devuelve TODOS los bloqueos juntos, no el
 * primero, así el formulario puede marcar todo lo que falta de una.
 */
export function validarTransicion(
  proyecto: Proyecto,
  hasta: Estado,
  datos: DatosTransicion,
  contexto: ContextoTransicion,
): Resultado {
  const bloqueos: Bloqueo[] = [];

  if (proyecto.estado === hasta) {
    return {
      ok: false,
      bloqueos: [{ codigo: 'transicion_invalida', mensaje: `El proyecto ya está en "${hasta}".` }],
    };
  }

  if (!transicionPermitida(proyecto.estado, hasta)) {
    return {
      ok: false,
      bloqueos: [
        {
          codigo: 'transicion_invalida',
          mensaje: `No se puede pasar de "${proyecto.estado}" a "${hasta}".`,
        },
      ],
    };
  }

  if (hasta === 'activo') {
    if (contexto.activosActuales >= contexto.limiteWip) {
      bloqueos.push({
        codigo: 'wip_lleno',
        mensaje:
          `Ya tenés ${contexto.activosActuales} proyectos activos (el límite es ${contexto.limiteWip}). ` +
          'Pausá uno antes de activar este.',
      });
    }
    if (!texto(datos.proximaAccion, proyecto.proximaAccion)) {
      bloqueos.push({
        codigo: 'falta_proxima_accion',
        mensaje: 'Para activarlo tenés que escribir cuál es la próxima acción concreta.',
      });
    }
  }

  if (hasta === 'descartado') {
    if (texto(datos.motivoCierre, proyecto.motivoCierre).length < LARGO_MINIMO_CIERRE) {
      bloqueos.push({
        codigo: 'falta_motivo_cierre',
        mensaje: `Escribí por qué lo descartás (mínimo ${LARGO_MINIMO_CIERRE} caracteres).`,
      });
    }
  }

  if (hasta === 'terminado') {
    if (texto(datos.aprendizaje, proyecto.aprendizaje).length < LARGO_MINIMO_CIERRE) {
      bloqueos.push({
        codigo: 'falta_aprendizaje',
        mensaje: `Escribí qué aprendiste (mínimo ${LARGO_MINIMO_CIERRE} caracteres).`,
      });
    }
  }

  return bloqueos.length === 0 ? { ok: true } : { ok: false, bloqueos };
}

/** Qué tipo de evento corresponde registrar por esta transición. */
export function eventoDeTransicion(desde: Estado, hasta: Estado): TipoEvento {
  if (hasta === 'terminado' || hasta === 'descartado') return 'cerrado';
  if (desde === 'terminado' || desde === 'descartado') return 'revivido';
  return 'cambio_estado';
}
