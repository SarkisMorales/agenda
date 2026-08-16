import { calcularEstancamiento, estaVencido, sinProximaAccion } from '../dominio/tiempo';
import type { Estado, Evento, Proyecto } from '../dominio/tipos';

export const NOMBRE_ESTADO: Record<Estado, string> = {
  bandeja: 'Bandeja',
  evaluando: 'Evaluando',
  activo: 'Activo',
  pausado: 'Pausado',
  terminado: 'Terminado',
  descartado: 'Descartado',
};

const COLOR_ESTADO: Record<Estado, string> = {
  bandeja: 'gris',
  evaluando: 'turquesa',
  activo: 'verde',
  pausado: 'gris',
  terminado: 'verde',
  descartado: 'roja',
};

/** ¿Este proyecto necesita atención ahora? Define la banda roja de la tarjeta. */
export function tieneAlerta(proyecto: Proyecto, eventos: Evento[]): boolean {
  return (
    sinProximaAccion(proyecto) ||
    estaVencido(proyecto) ||
    calcularEstancamiento(proyecto, eventos).nivel === 'rojo'
  );
}

export function Insignias({ proyecto, eventos }: { proyecto: Proyecto; eventos: Evento[] }) {
  const estancamiento = calcularEstancamiento(proyecto, eventos);

  return (
    <div className="insignias">
      <span className={`insignia ${COLOR_ESTADO[proyecto.estado]}`}>
        {NOMBRE_ESTADO[proyecto.estado]}
      </span>

      {sinProximaAccion(proyecto) && <span className="insignia roja">Sin próximo paso</span>}

      {estancamiento.nivel !== 'ok' && (
        <span className={`insignia ${estancamiento.nivel === 'rojo' ? 'roja' : 'ambar'}`}>
          Estancado hace <span className="dias">{estancamiento.dias}</span> días
        </span>
      )}

      {estaVencido(proyecto) && <span className="insignia roja">Vencido</span>}

      {proyecto.etiquetas.map((e) => (
        <span key={e} className="insignia gris">
          #{e}
        </span>
      ))}
    </div>
  );
}
