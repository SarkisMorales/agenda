import { useMemo, useState } from 'react';
import { TarjetaProyecto } from '../componentes/TarjetaProyecto';
import { NOMBRE_ESTADO } from '../componentes/Insignias';
import { calcularScore } from '../dominio/score';
import { calcularEstancamiento } from '../dominio/tiempo';
import { ESTADOS, type Ajustes, type Estado, type Evento, type Proyecto } from '../dominio/tipos';

interface Props {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
  busqueda: string;
  setBusqueda: (v: string) => void;
}

export function Todos({ proyectos, eventos, ajustes, busqueda, setBusqueda }: Props) {
  const [estado, setEstado] = useState<Estado | ''>('');
  const [unidad, setUnidad] = useState('');
  const [scoreMinimo, setScoreMinimo] = useState(0);
  const [orden, setOrden] = useState<'score' | 'edicion' | 'fecha' | 'estancamiento'>('score');

  const activos = proyectos.filter((p) => p.estado === 'activo');

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = proyectos.filter((p) => {
      if (estado && p.estado !== estado) return false;
      if (unidad && p.unidad !== unidad) return false;
      if (calcularScore(p) < scoreMinimo) return false;
      if (!texto) return true;
      return [p.titulo, p.descripcion ?? '', ...p.etiquetas, ...p.pasos.map((s) => s.texto)]
        .join(' ')
        .toLowerCase()
        .includes(texto);
    });

    return filtrados.sort((a, b) => {
      if (orden === 'score') return calcularScore(b) - calcularScore(a);
      if (orden === 'edicion') return b.actualizadoEn.localeCompare(a.actualizadoEn);
      if (orden === 'fecha') {
        if (!a.fechaLimite) return 1;
        if (!b.fechaLimite) return -1;
        return a.fechaLimite.localeCompare(b.fechaLimite);
      }
      return (
        calcularEstancamiento(b, eventos).dias - calcularEstancamiento(a, eventos).dias
      );
    });
  }, [proyectos, eventos, busqueda, estado, unidad, scoreMinimo, orden]);

  return (
    <>
      <div className="titulo-pantalla">
        <h2>Todos</h2>
        <span className="subtitulo num">
          {visibles.length} de {proyectos.length}
        </span>
      </div>

      <div className="filtros">
        <label className="campo">
          <span>Buscar</span>
          <input
            id="campo-busqueda"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="título, nota, etiqueta"
          />
        </label>
        <label className="campo">
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value as Estado | '')}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Unidad</span>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            <option value="">Todas</option>
            {ajustes.unidades.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Score mínimo: {scoreMinimo}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={scoreMinimo}
            onChange={(e) => setScoreMinimo(Number(e.target.value))}
          />
        </label>
        <label className="campo">
          <span>Orden</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
            <option value="score">Score</option>
            <option value="edicion">Última edición</option>
            <option value="fecha">Fecha límite</option>
            <option value="estancamiento">Días estancado</option>
          </select>
        </label>
      </div>

      {visibles.length === 0 ? (
        <div className="vacio">Ningún proyecto coincide con estos filtros.</div>
      ) : (
        <div className="lista-tarjetas">
          {visibles.map((p) => (
            <TarjetaProyecto
              key={p.id}
              proyecto={p}
              eventos={eventos}
              activos={activos}
              ajustes={ajustes}
            />
          ))}
        </div>
      )}
    </>
  );
}
