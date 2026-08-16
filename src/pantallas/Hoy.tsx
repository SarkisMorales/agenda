import { TarjetaProyecto } from '../componentes/TarjetaProyecto';
import { calcularEstancamiento, diasEntre, estaVencido, sinProximaAccion } from '../dominio/tiempo';
import { DIAS_ENTRE_REVISIONES, type Ajustes, type Evento, type Proyecto } from '../dominio/tipos';

interface Props {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
  irA: (pantalla: string) => void;
}

/**
 * Lo único que se ve al abrir: los activos y sus próximas acciones.
 * Sin gráficos ni resúmenes decorativos — eso está en Métricas, a un tecla.
 */
export function Hoy({ proyectos, eventos, ajustes, irA }: Props) {
  const activos = proyectos.filter((p) => p.estado === 'activo');
  const sinAccion = activos.filter(sinProximaAccion);
  const estancados = activos.filter((p) => calcularEstancamiento(p, eventos).nivel !== 'ok');
  const vencidos = proyectos.filter((p) => estaVencido(p));

  const diasSinRevisar = ajustes.ultimaRevision
    ? diasEntre(ajustes.ultimaRevision, new Date().toISOString())
    : null;
  const tocaRevisar = diasSinRevisar === null || diasSinRevisar >= DIAS_ENTRE_REVISIONES;

  return (
    <>
      <div className="titulo-pantalla">
        <h2>Hoy</h2>
        <span className="subtitulo num">
          {activos.length} de {ajustes.limiteWip} activos
        </span>
      </div>

      <div className="alertas">
        {sinAccion.length > 0 && (
          <div className="alerta roja">
            <span className="contador">{sinAccion.length}</span>
            <span>sin próximo paso definido</span>
          </div>
        )}
        {estancados.length > 0 && (
          <div className="alerta ambar">
            <span className="contador">{estancados.length}</span>
            <span>
              estancado{estancados.length === 1 ? '' : 's'} hace más de 10 días
            </span>
          </div>
        )}
        {vencidos.length > 0 && (
          <div className="alerta roja">
            <span className="contador">{vencidos.length}</span>
            <span>con la fecha límite vencida</span>
          </div>
        )}
        {tocaRevisar && proyectos.length > 0 && (
          <div className="alerta ambar">
            <span className="contador">!</span>
            <span style={{ flex: 1 }}>
              {diasSinRevisar === null
                ? 'Nunca hiciste una revisión semanal'
                : `Pasaron ${diasSinRevisar} días desde la última revisión`}
            </span>
            <button type="button" className="btn chico" onClick={() => irA('revision')}>
              Revisar ahora
            </button>
          </div>
        )}
      </div>

      {activos.length === 0 ? (
        <div className="vacio">
          No tenés nada activo. Andá a la Bandeja y activá lo que vas a hacer esta semana.
        </div>
      ) : (
        <div className="lista-tarjetas">
          {activos.map((p) => (
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
