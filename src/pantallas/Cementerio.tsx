import { useState } from 'react';
import { TarjetaProyecto } from '../componentes/TarjetaProyecto';
import type { Ajustes, Evento, Proyecto } from '../dominio/tipos';

interface Props {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
}

/** No es un tacho: es el registro de todo lo que decidiste no hacer, y por qué. */
export function Cementerio({ proyectos, eventos, ajustes }: Props) {
  const [texto, setTexto] = useState('');

  const descartados = proyectos
    .filter((p) => p.estado === 'descartado')
    .filter((p) =>
      texto.trim()
        ? `${p.titulo} ${p.motivoCierre ?? ''}`.toLowerCase().includes(texto.trim().toLowerCase())
        : true,
    )
    .sort((a, b) => (b.cerradoEn ?? '').localeCompare(a.cerradoEn ?? ''));

  return (
    <>
      <div className="titulo-pantalla">
        <div>
          <h2>Cementerio</h2>
          <span className="subtitulo">
            Lo que decidiste no hacer. Es un activo: acá está por qué dijiste que no.
          </span>
        </div>
        <span className="subtitulo num">{descartados.length}</span>
      </div>

      <label className="campo">
        <span>Buscar entre los descartados</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="título o motivo"
        />
      </label>

      {descartados.length === 0 ? (
        <div className="vacio">Todavía no descartaste nada. Eso también dice algo.</div>
      ) : (
        <div className="lista-tarjetas">
          {descartados.map((p) => (
            <TarjetaProyecto
              key={p.id}
              proyecto={p}
              eventos={eventos}
              activos={proyectos.filter((x) => x.estado === 'activo')}
              ajustes={ajustes}
              mostrarPasos={false}
            />
          ))}
        </div>
      )}
    </>
  );
}
