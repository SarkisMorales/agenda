import { useRef, useState } from 'react';
import { db } from '../datos/db';
import { repositorio } from '../datos/repositorio';
import { borrarTodo, importar } from '../datos/respaldo';
import { descargarRespaldo } from '../datos/backupAutomatico';
import type { Ajustes as TipoAjustes, Proyecto } from '../dominio/tipos';

interface Props {
  ajustes: TipoAjustes;
  proyectos: Proyecto[];
}

export function Ajustes({ ajustes, proyectos }: Props) {
  const archivoRef = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [unidadNueva, setUnidadNueva] = useState('');

  async function alImportar(ev: React.ChangeEvent<HTMLInputElement>) {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    try {
      const resumen = await importar(JSON.parse(await archivo.text()), db);
      setMensaje(
        `Importado: ${resumen.proyectosNuevos} proyectos nuevos, ` +
          `${resumen.proyectosActualizados} actualizados, ${resumen.proyectosIgnorados} ignorados ` +
          `por ser más viejos, y ${resumen.eventosNuevos} eventos.`,
      );
    } catch (error) {
      setMensaje(`No se pudo importar: ${(error as Error).message}`);
    } finally {
      ev.target.value = '';
    }
  }

  const activos = proyectos.filter((p) => p.estado === 'activo').length;

  return (
    <>
      <div className="titulo-pantalla">
        <h2>Ajustes</h2>
      </div>

      <div className="panel">
        <h3>Límite de proyectos activos</h3>
        <label className="campo">
          <span>Máximo simultáneo (ahora tenés {activos})</span>
          <input
            type="number"
            min={1}
            max={10}
            value={ajustes.limiteWip}
            onChange={(e) => repositorio.guardarAjustes({ limiteWip: Number(e.target.value) })}
          />
        </label>
        <p className="aviso">
          Subirlo es la forma más fácil de romper el sistema. Si te está apretando, probablemente
          esté funcionando.
        </p>
      </div>

      <div className="panel">
        <h3>Unidades de negocio</h3>
        <div className="insignias" style={{ marginBottom: 12 }}>
          {ajustes.unidades.map((u) => (
            <span key={u} className="insignia gris">
              {u}
            </span>
          ))}
        </div>
        <div className="agregar-paso">
          <input
            value={unidadNueva}
            onChange={(e) => setUnidadNueva(e.target.value)}
            placeholder="Agregar unidad"
          />
          <button
            type="button"
            className="btn chico"
            onClick={async () => {
              const limpia = unidadNueva.trim();
              if (!limpia || ajustes.unidades.includes(limpia)) return;
              await repositorio.guardarAjustes({ unidades: [...ajustes.unidades, limpia] });
              setUnidadNueva('');
            }}
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Tema</h3>
        <label className="campo">
          <select
            value={ajustes.tema}
            onChange={(e) =>
              repositorio.guardarAjustes({ tema: e.target.value as TipoAjustes['tema'] })
            }
          >
            <option value="sistema">Según el sistema</option>
            <option value="oscuro">Oscuro</option>
            <option value="claro">Claro</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <h3>Respaldo</h3>
        <div className="acciones-tarjeta" style={{ borderTop: 'none', paddingTop: 0 }}>
          <button type="button" className="btn" onClick={() => descargarRespaldo()}>
            Exportar ahora
          </button>
          <button type="button" className="btn" onClick={() => archivoRef.current?.click()}>
            Importar archivo
          </button>
          <input ref={archivoRef} type="file" accept="application/json" hidden onChange={alImportar} />
        </div>
        <p className="aviso">
          El import es por merge: cruza por id y sólo pisa lo que sea más viejo. Importar dos veces
          el mismo archivo no duplica nada.
        </p>
        <p className="aviso">
          {ajustes.ultimoBackup
            ? `Último backup automático: ${new Date(ajustes.ultimoBackup).toLocaleDateString('es')}.`
            : 'Todavía no se hizo el backup automático semanal.'}
        </p>
      </div>

      <div className="panel" style={{ borderColor: 'var(--rojo)' }}>
        <h3>Borrar todo</h3>
        <p className="aviso">
          Borra proyectos, eventos y ajustes de este navegador. No se puede deshacer. Exportá antes.
        </p>
        <label className="campo">
          <span>Escribí BORRAR para habilitar</span>
          <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn peligro"
          disabled={confirmacion !== 'BORRAR'}
          onClick={async () => {
            await borrarTodo(db);
            setConfirmacion('');
            setMensaje('Se borró todo.');
          }}
        >
          Borrar definitivamente
        </button>
      </div>

      {mensaje && (
        <div className="panel">
          <p>{mensaje}</p>
        </div>
      )}

      <p className="aviso">
        Los datos viven en este navegador (IndexedDB). Si lo instalás como app desde el navegador,
        el sistema es mucho menos propenso a borrarlos para liberar espacio.
      </p>
    </>
  );
}
