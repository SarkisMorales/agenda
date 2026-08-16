import {
  balanceDelMes,
  diasPromedioHastaCerrar,
  distribucionPorUnidad,
  racha,
  tasaDeDescarte,
} from '../dominio/metricas';
import type { Evento, Proyecto } from '../dominio/tipos';

/** Todo lo de acá sale del log de eventos, no del estado actual. */
export function Metricas({ proyectos, eventos }: { proyectos: Proyecto[]; eventos: Evento[] }) {
  const balance = balanceDelMes(eventos);
  const promedio = diasPromedioHastaCerrar(eventos);
  const descarte = tasaDeDescarte(eventos);
  const unidades = distribucionPorUnidad(proyectos);
  const dias = racha(eventos);

  const maximoUnidad = Math.max(1, ...Object.values(unidades));
  const pausados = proyectos.filter((p) => p.estado === 'pausado').length;

  return (
    <>
      <div className="titulo-pantalla">
        <div>
          <h2>Métricas</h2>
          <span className="subtitulo">Del mes en curso, leídas del historial de eventos</span>
        </div>
      </div>

      <div className="grilla-metricas">
        <div className="metrica">
          <div className="metrica-etiqueta">Abiertas vs. cerradas</div>
          <div className={`metrica-valor ${balance.ratio >= 1 ? 'verde' : 'rojo'}`}>
            {balance.abiertas} / {balance.cerradas}
          </div>
          <div className="metrica-nota">
            {balance.ratio >= 1
              ? 'Estás cerrando al menos tanto como abrís.'
              : 'Abrís más rápido de lo que cerrás. Es el número que importa.'}
          </div>
        </div>

        <div className="metrica">
          <div className="metrica-etiqueta">Días hasta cerrar</div>
          <div className="metrica-valor">{promedio === null ? '—' : Math.round(promedio)}</div>
          <div className="metrica-nota">Promedio desde que se captura hasta que se cierra.</div>
        </div>

        <div className="metrica">
          <div className="metrica-etiqueta">Tasa de descarte</div>
          <div className="metrica-valor">
            {descarte === null ? '—' : `${Math.round(descarte * 100)}%`}
          </div>
          <div className="metrica-nota">Alta es buena señal: quiere decir que el filtro funciona.</div>
        </div>

        <div className="metrica">
          <div className="metrica-etiqueta">Racha</div>
          <div className={`metrica-valor ${dias > 0 ? 'verde' : ''}`}>{dias}</div>
          <div className="metrica-nota">Días seguidos completando al menos un paso.</div>
        </div>

        <div className="metrica">
          <div className="metrica-etiqueta">Pausados</div>
          <div className={`metrica-valor ${pausados > 5 ? 'rojo' : ''}`}>{pausados}</div>
          <div className="metrica-nota">
            El límite de activos no aplica acá. Si esto crece, la pila se te mudó de lugar.
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Por unidad de negocio</h3>
        {Object.entries(unidades).length === 0 ? (
          <p className="aviso">Todavía no hay proyectos.</p>
        ) : (
          Object.entries(unidades)
            .sort((a, b) => b[1] - a[1])
            .map(([unidad, cantidad]) => (
              <div key={unidad} className="barra-unidad">
                <span>{unidad}</span>
                <span className="riel">
                  <span
                    className="relleno"
                    style={{ width: `${(cantidad / maximoUnidad) * 100}%` }}
                  />
                </span>
                <span className="num">{cantidad}</span>
              </div>
            ))
        )}
      </div>
    </>
  );
}
