import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../datos/db';
import { repositorio } from '../datos/repositorio';
import { AJUSTES_POR_DEFECTO, type Ajustes, type Evento, type Proyecto } from '../dominio/tipos';

/**
 * Un solo lugar del que la UI lee. `useLiveQuery` vuelve a consultar Dexie
 * solo cuando los datos cambian, así que después de guardar algo no hay que
 * refrescar nada a mano.
 */
export function useAgenda(): {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
  cargando: boolean;
  repo: typeof repositorio;
} {
  const proyectos = useLiveQuery(() => db.proyectos.toArray(), [], undefined);
  const eventos = useLiveQuery(() => db.eventos.toArray(), [], undefined);
  const ajustes = useLiveQuery(() => db.ajustes.get('unico'), [], undefined);

  return {
    proyectos: proyectos ?? [],
    eventos: eventos ?? [],
    ajustes: ajustes ?? AJUSTES_POR_DEFECTO,
    cargando: proyectos === undefined,
    repo: repositorio,
  };
}
