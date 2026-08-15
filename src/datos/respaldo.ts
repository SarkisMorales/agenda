import type { AgendaDB } from './db';
import { db as dbPorDefecto } from './db';
import type { Ajustes, Evento, Proyecto } from '../dominio/tipos';

export const VERSION_RESPALDO = 1;

export interface Respaldo {
  version: number;
  exportadoEn: string;
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes | null;
}

export interface ResumenImportacion {
  proyectosNuevos: number;
  proyectosActualizados: number;
  proyectosIgnorados: number;
  eventosNuevos: number;
}

export async function exportar(db: AgendaDB = dbPorDefecto): Promise<Respaldo> {
  const [proyectos, eventos, ajustes] = await Promise.all([
    db.proyectos.toArray(),
    db.eventos.toArray(),
    db.ajustes.get('unico'),
  ]);
  return {
    version: VERSION_RESPALDO,
    exportadoEn: new Date().toISOString(),
    proyectos,
    eventos,
    ajustes: ajustes ?? null,
  };
}

/**
 * Import por merge, no destructivo:
 *
 * - Proyectos: se cruzan por `id`. Si el que viene en el archivo fue editado
 *   más recientemente, pisa al local; si no, se ignora. Así podés importar un
 *   backup viejo sin perder trabajo nuevo.
 * - Eventos: unión por `id`. Como el log es append-only, dos eventos con el
 *   mismo id son literalmente el mismo evento y nunca hay conflicto que
 *   resolver.
 * - Ajustes: sólo se toman si localmente no hay nada configurado.
 */
export async function importar(
  datos: unknown,
  db: AgendaDB = dbPorDefecto,
): Promise<ResumenImportacion> {
  const respaldo = validarRespaldo(datos);
  const resumen: ResumenImportacion = {
    proyectosNuevos: 0,
    proyectosActualizados: 0,
    proyectosIgnorados: 0,
    eventosNuevos: 0,
  };

  await db.transaction('rw', db.proyectos, db.eventos, db.ajustes, async () => {
    for (const entrante of respaldo.proyectos) {
      const local = await db.proyectos.get(entrante.id);
      if (!local) {
        await db.proyectos.add(entrante);
        resumen.proyectosNuevos++;
      } else if (entrante.actualizadoEn > local.actualizadoEn) {
        await db.proyectos.put(entrante);
        resumen.proyectosActualizados++;
      } else {
        resumen.proyectosIgnorados++;
      }
    }

    const idsLocales = new Set(await db.eventos.toCollection().primaryKeys());
    const nuevos = respaldo.eventos.filter((e) => !idsLocales.has(e.id));
    if (nuevos.length) await db.eventos.bulkAdd(nuevos);
    resumen.eventosNuevos = nuevos.length;

    if (respaldo.ajustes && !(await db.ajustes.get('unico'))) {
      await db.ajustes.put(respaldo.ajustes);
    }
  });

  return resumen;
}

function validarRespaldo(datos: unknown): Respaldo {
  if (typeof datos !== 'object' || datos === null) {
    throw new Error('El archivo no tiene el formato esperado.');
  }
  const r = datos as Partial<Respaldo>;
  if (!Array.isArray(r.proyectos) || !Array.isArray(r.eventos)) {
    throw new Error('El archivo no contiene proyectos y eventos.');
  }
  if (typeof r.version !== 'number' || r.version > VERSION_RESPALDO) {
    throw new Error('El archivo viene de una versión más nueva de la app.');
  }
  return {
    version: r.version,
    exportadoEn: r.exportadoEn ?? new Date().toISOString(),
    proyectos: r.proyectos,
    eventos: r.eventos,
    ajustes: r.ajustes ?? null,
  };
}

/** Borra todo. Sólo desde ajustes, con confirmación escrita. */
export async function borrarTodo(db: AgendaDB = dbPorDefecto): Promise<void> {
  await db.transaction('rw', db.proyectos, db.eventos, db.ajustes, async () => {
    await Promise.all([db.proyectos.clear(), db.eventos.clear(), db.ajustes.clear()]);
  });
}
