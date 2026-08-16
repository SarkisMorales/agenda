import { useMemo, useState } from 'react';
import { DialogoEstado } from '../componentes/DialogoEstado';
import { Insignias } from '../componentes/Insignias';
import { repositorio } from '../datos/repositorio';
import { calcularEstancamiento } from '../dominio/tiempo';
import type { Ajustes, Estado, Evento, Proyecto } from '../dominio/tipos';

interface Props {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
}

const ORDEN_REVISION: Record<string, number> = { activo: 0, pausado: 1, evaluando: 2 };

/**
 * Wizard semanal: pasa proyecto por proyecto y obliga a decidir. Al final
 * guarda la fecha, que es lo que apaga el aviso de la pantalla Hoy.
 */
export function Revision({ proyectos, eventos, ajustes }: Props) {
  const cola = useMemo(
    () =>
      proyectos
        .filter((p) => p.estado in ORDEN_REVISION)
        .sort((a, b) => (ORDEN_REVISION[a.estado] ?? 9) - (ORDEN_REVISION[b.estado] ?? 9)),
    [proyectos],
  );

  const [indice, setIndice] = useState(0);
  const [accion, setAccion] = useState('');
  const [destino, setDestino] = useState<Estado | null>(null);
  const [balance, setBalance] = useState({ siguen: 0, pausados: 0, cerrados: 0 });
  const [terminada, setTerminada] = useState(false);

  const actual = cola[indice];
  const activos = proyectos.filter((p) => p.estado === 'activo');

  async function finalizar() {
    await repositorio.guardarAjustes({ ultimaRevision: new Date().toISOString() });
    setTerminada(true);
  }

  function avanzar() {
    setAccion('');
    setDestino(null);
    if (indice + 1 >= cola.length) finalizar();
    else setIndice(indice + 1);
  }

  if (cola.length === 0) {
    return (
      <div className="vacio">No hay nada abierto para revisar. Empezá capturando ideas arriba.</div>
    );
  }

  if (terminada) {
    const estancados = activos.filter((p) => calcularEstancamiento(p, eventos).nivel !== 'ok');
    return (
      <>
        <div className="titulo-pantalla">
          <h2>Revisión terminada</h2>
        </div>
        <div className="grilla-metricas">
          <Dato etiqueta="Siguen vivos" valor={balance.siguen} />
          <Dato etiqueta="Pausados" valor={balance.pausados} />
          <Dato etiqueta="Cerrados" valor={balance.cerrados} color="verde" />
          <Dato
            etiqueta="Todavía estancados"
            valor={estancados.length}
            color={estancados.length > 0 ? 'rojo' : 'verde'}
          />
        </div>
        {estancados.length > 0 && (
          <p className="aviso">
            Estos siguen sin moverse: {estancados.map((p) => p.titulo).join(', ')}. Si la semana que
            viene siguen igual, probablemente no los vayas a hacer.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="titulo-pantalla">
        <div>
          <h2>Revisión semanal</h2>
          <span className="subtitulo num">
            {indice + 1} de {cola.length}
          </span>
        </div>
      </div>

      <div className="progreso-revision">
        <div style={{ width: `${(indice / cola.length) * 100}%` }} />
      </div>

      {actual && (
        <div className="panel">
          <h3 style={{ fontSize: 19 }}>{actual.titulo}</h3>
          <div className="tarjeta-unidad">{actual.unidad}</div>
          <Insignias proyecto={actual} eventos={eventos} />

          <p style={{ marginTop: 16, marginBottom: 8 }}>¿Sigue vivo?</p>
          <div className="acciones-modal" style={{ justifyContent: 'stretch', marginTop: 0 }}>
            <button
              type="button"
              className="btn peligro"
              style={{ flex: 1 }}
              onClick={() => setDestino('descartado')}
            >
              Descartar
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              disabled={actual.estado === 'pausado'}
              onClick={async () => {
                await repositorio.cambiarEstado(actual.id, 'pausado');
                setBalance((b) => ({ ...b, pausados: b.pausados + 1 }));
                avanzar();
              }}
            >
              Pausar
            </button>
            <button
              type="button"
              className="btn principal"
              style={{ flex: 1 }}
              disabled={!accion.trim()}
              onClick={async () => {
                await repositorio.definirProximaAccion(actual.id, accion);
                setBalance((b) => ({ ...b, siguen: b.siguen + 1 }));
                avanzar();
              }}
            >
              Sigue
            </button>
          </div>

          <label className="campo" style={{ marginTop: 16 }}>
            <span>Si sigue, ¿cuál es la próxima acción concreta?</span>
            <input
              autoFocus
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              placeholder={actual.proximaAccion ?? 'Escribí el próximo paso'}
            />
          </label>
          {actual.proximaAccion && (
            <p className="aviso">La anterior era: “{actual.proximaAccion}”</p>
          )}
        </div>
      )}

      {actual && destino && (
        <DialogoEstado
          proyecto={actual}
          hasta={destino}
          activos={activos}
          onCerrar={() => {
            setBalance((b) => ({ ...b, cerrados: b.cerrados + 1 }));
            avanzar();
          }}
        />
      )}
    </>
  );
}

function Dato({
  etiqueta,
  valor,
  color = '',
}: {
  etiqueta: string;
  valor: number;
  color?: string;
}) {
  return (
    <div className="metrica">
      <div className="metrica-etiqueta">{etiqueta}</div>
      <div className={`metrica-valor ${color}`}>{valor}</div>
    </div>
  );
}
