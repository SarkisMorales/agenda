import { useState } from 'react';
import { repositorio } from '../datos/repositorio';
import { calcularScore } from '../dominio/score';
import { sinProximaAccion } from '../dominio/tiempo';
import { ESTADOS_CERRADOS, type Estado, type Evento, type Proyecto } from '../dominio/tipos';
import { Insignias, NOMBRE_ESTADO, tieneAlerta } from './Insignias';
import { DialogoEstado } from './DialogoEstado';
import { DialogoEditar } from './DialogoEditar';
import type { Ajustes } from '../dominio/tipos';

interface Props {
  proyecto: Proyecto;
  eventos: Evento[];
  activos: Proyecto[];
  ajustes: Ajustes;
  /** Los destinos que se ofrecen como botones. */
  destinos?: Estado[];
  mostrarPasos?: boolean;
}

const DESTINOS_POR_ESTADO: Record<Estado, Estado[]> = {
  bandeja: ['activo', 'evaluando', 'descartado'],
  evaluando: ['activo', 'pausado', 'descartado'],
  activo: ['terminado', 'pausado', 'descartado'],
  pausado: ['activo', 'terminado', 'descartado'],
  terminado: ['bandeja'],
  descartado: ['bandeja'],
};

export function TarjetaProyecto({
  proyecto,
  eventos,
  activos,
  ajustes,
  destinos,
  mostrarPasos = true,
}: Props) {
  const [textoPaso, setTextoPaso] = useState('');
  const [cambioA, setCambioA] = useState<Estado | null>(null);
  const [editando, setEditando] = useState(false);

  const opciones = destinos ?? DESTINOS_POR_ESTADO[proyecto.estado];
  const hechos = proyecto.pasos.filter((p) => p.hecho).length;
  const abierto = !ESTADOS_CERRADOS.includes(proyecto.estado);

  async function agregarPaso(ev: React.FormEvent) {
    ev.preventDefault();
    if (!textoPaso.trim()) return;
    await repositorio.agregarPaso(proyecto.id, textoPaso);
    setTextoPaso('');
  }

  return (
    <article
      className="tarjeta"
      data-estado={proyecto.estado}
      data-alerta={tieneAlerta(proyecto, eventos)}
    >
      <div className="tarjeta-cabecera">
        <div>
          <h3>{proyecto.titulo}</h3>
          <div className="tarjeta-unidad">{proyecto.unidad}</div>
        </div>
        <span className="score" title="Impacto × confianza ÷ esfuerzo">
          {calcularScore(proyecto)}
        </span>
      </div>

      {proyecto.descripcion && (
        <p style={{ color: 'var(--texto-suave)', fontSize: 14, margin: '6px 0 0' }}>
          {proyecto.descripcion}
        </p>
      )}

      <Insignias proyecto={proyecto} eventos={eventos} />

      {proyecto.estado === 'activo' && (
        <div className={`proxima-accion ${sinProximaAccion(proyecto) ? 'falta' : ''}`}>
          <span className="etiqueta">Próxima acción</span>
          {proyecto.proximaAccion || 'Sin próximo paso — definilo ahora'}
        </div>
      )}

      {proyecto.estado === 'descartado' && proyecto.motivoCierre && (
        <p className="cementerio-motivo">“{proyecto.motivoCierre}”</p>
      )}
      {proyecto.estado === 'terminado' && proyecto.aprendizaje && (
        <p className="cementerio-motivo">Aprendizaje: “{proyecto.aprendizaje}”</p>
      )}

      {mostrarPasos && proyecto.pasos.length > 0 && (
        <ul className="pasos">
          {proyecto.pasos.map((paso) => (
            <li key={paso.id} className={paso.hecho ? 'hecho' : ''}>
              <input
                type="checkbox"
                checked={paso.hecho}
                aria-label={paso.texto}
                onChange={() => repositorio.alternarPaso(proyecto.id, paso.id)}
              />
              <span className="texto">{paso.texto}</span>
              <button
                type="button"
                className="quitar"
                aria-label={`Quitar ${paso.texto}`}
                onClick={() => repositorio.quitarPaso(proyecto.id, paso.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {mostrarPasos && proyecto.pasos.length > 0 && (
        <div className="aviso num">
          {hechos}/{proyecto.pasos.length} pasos
        </div>
      )}

      {mostrarPasos && abierto && (
        <form className="agregar-paso" onSubmit={agregarPaso}>
          <input
            value={textoPaso}
            onChange={(e) => setTextoPaso(e.target.value)}
            placeholder="Agregar paso…"
          />
          <button type="submit" className="btn chico">
            +
          </button>
        </form>
      )}

      <div className="acciones-tarjeta">
        {opciones.map((destino) => (
          <button
            key={destino}
            type="button"
            className={`btn chico ${destino === 'descartado' ? 'peligro' : ''}`}
            onClick={() => setCambioA(destino)}
          >
            {destino === 'bandeja' ? 'Revivir' : NOMBRE_ESTADO[destino]}
          </button>
        ))}
        <button type="button" className="btn chico fantasma" onClick={() => setEditando(true)}>
          Editar
        </button>
      </div>

      {cambioA && (
        <DialogoEstado
          proyecto={proyecto}
          hasta={cambioA}
          activos={activos}
          onCerrar={() => setCambioA(null)}
        />
      )}
      {editando && (
        <DialogoEditar proyecto={proyecto} ajustes={ajustes} onCerrar={() => setEditando(false)} />
      )}
    </article>
  );
}
