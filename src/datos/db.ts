import Dexie, { type EntityTable } from 'dexie';
import type { Ajustes, Evento, Proyecto } from '../dominio/tipos';

/**
 * Tres tablas separadas. La clave del diseño es que `eventos` es su propia
 * tabla, con `proyectoId` como referencia: cuando se borra un proyecto de
 * verdad, sus eventos siguen ahí. El log es la fuente de las métricas
 * históricas; los proyectos son sólo el estado actual.
 */
export class AgendaDB extends Dexie {
  proyectos!: EntityTable<Proyecto, 'id'>;
  eventos!: EntityTable<Evento, 'id'>;
  ajustes!: EntityTable<Ajustes, 'id'>;

  constructor(nombre = 'agenda-proyectos') {
    super(nombre);
    this.version(1).stores({
      // Los índices son sólo para buscar/ordenar; el resto de los campos
      // igual se guarda completo.
      proyectos: 'id, estado, unidad, actualizadoEn, creadoEn, fechaLimite, *etiquetas',
      eventos: 'id, proyectoId, tipo, fecha',
      ajustes: 'id',
    });
  }
}

export const db = new AgendaDB();

/**
 * Le pide al navegador que no borre la base cuando le falte espacio.
 * En Safari/iPhone es importante: sin esto, IndexedDB de un sitio que no se
 * usa hace un tiempo puede ser eliminado automáticamente.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
