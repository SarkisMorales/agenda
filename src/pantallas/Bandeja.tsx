import { useEffect, useState } from 'react';
import { TarjetaProyecto } from '../componentes/TarjetaProyecto';
import { Escala } from '../componentes/Escala';
import { DialogoEstado } from '../componentes/DialogoEstado';
import { repositorio } from '../datos/repositorio';
import { calcularScore } from '../dominio/score';
import type { Ajustes, Estado, Evento, Proyecto } from '../dominio/tipos';

interface Props {
  proyectos: Proyecto[];
  eventos: Evento[];
  ajustes: Ajustes;
}

export function Bandeja({ proyectos, eventos, ajustes }: Props) {
  const [triando, setTriando] = useState(false);
  const bandeja = [...proyectos.filter((p) => p.estado === 'bandeja')].sort((a, b) =>
    a.creadoEn.localeCompare(b.creadoEn),
  );
  const activos = proyectos.filter((p) => p.estado === 'activo');

  if (triando && bandeja.length > 0) {
    return (
      <Triage
        cola={bandeja}
        activos={activos}
        onSalir={() => setTriando(false)}
      />
    );
  }

  return (
    <>
      <div className="titulo-pantalla">
        <div>
          <h2>Bandeja</h2>
          <span className="subtitulo">Ideas sin evaluar, de la más vieja a la más nueva</span>
        </div>
        {bandeja.length > 0 && (
          <button type="button" className="btn principal" onClick={() => setTriando(true)}>
            Triage ({bandeja.length})
          </button>
        )}
      </div>

      {bandeja.length === 0 ? (
        <div className="vacio">Bandeja vacía. Capturá una idea arriba y aparece acá.</div>
      ) : (
        <div className="lista-tarjetas">
          {bandeja.map((p) => (
            <TarjetaProyecto
              key={p.id}
              proyecto={p}
              eventos={eventos}
              activos={activos}
              ajustes={ajustes}
              mostrarPasos={false}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Modo triage: una idea por vez, puntuás con los dedos o con las teclas 1-5,
 * y decidís. La idea es vaciar la bandeja rápido, no analizarla en profundidad.
 */
function Triage({
  cola,
  activos,
  onSalir,
}: {
  cola: Proyecto[];
  activos: Proyecto[];
  onSalir: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [valores, setValores] = useState({ impacto: 3, esfuerzo: 3, confianza: 3 });
  const [foco, setFoco] = useState<0 | 1 | 2>(0);
  const [destino, setDestino] = useState<Estado | null>(null);

  const actual = cola[indice];

  useEffect(() => {
    setValores({ impacto: 3, esfuerzo: 3, confianza: 3 });
    setFoco(0);
  }, [indice]);

  useEffect(() => {
    function alTeclado(ev: KeyboardEvent) {
      if (destino) return;
      if (ev.key >= '1' && ev.key <= '5') {
        const n = Number(ev.key);
        const campo = (['impacto', 'esfuerzo', 'confianza'] as const)[foco]!;
        setValores((v) => ({ ...v, [campo]: n }));
        setFoco((f) => (f < 2 ? ((f + 1) as 0 | 1 | 2) : f));
        ev.preventDefault();
      }
      if (ev.key === 'ArrowRight') setFoco((f) => (f < 2 ? ((f + 1) as 0 | 1 | 2) : f));
      if (ev.key === 'ArrowLeft') setFoco((f) => (f > 0 ? ((f - 1) as 0 | 1 | 2) : f));
    }
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [foco, destino]);

  if (!actual) {
    return (
      <div className="vacio">
        Vaciaste la bandeja.
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn principal" onClick={onSalir}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  async function guardarPuntaje() {
    await repositorio.editar(actual!.id, valores);
  }

  async function decidir(estado: Estado) {
    await guardarPuntaje();
    setDestino(estado);
  }

  function siguiente() {
    setDestino(null);
    setIndice((i) => i + 1);
  }

  return (
    <>
      <div className="titulo-pantalla">
        <div>
          <h2>Triage</h2>
          <span className="subtitulo num">
            {indice + 1} de {cola.length}
          </span>
        </div>
        <button type="button" className="btn fantasma" onClick={onSalir}>
          Salir
        </button>
      </div>

      <div className="progreso-revision">
        <div style={{ width: `${(indice / cola.length) * 100}%` }} />
      </div>

      <div className="panel">
        <h3 style={{ fontSize: 19 }}>{actual.titulo}</h3>
        <div className="tarjeta-unidad" style={{ marginBottom: 14 }}>
          {actual.unidad}
        </div>

        <Escala
          titulo="Impacto"
          ayuda="cuánto mueve la aguja"
          valor={valores.impacto}
          onElegir={(n) => setValores({ ...valores, impacto: n })}
        />
        <Escala
          titulo="Esfuerzo"
          ayuda="cuánto trabajo cuesta"
          valor={valores.esfuerzo}
          onElegir={(n) => setValores({ ...valores, esfuerzo: n })}
        />
        <Escala
          titulo="Confianza"
          ayuda="qué tan seguro estás"
          valor={valores.confianza}
          onElegir={(n) => setValores({ ...valores, confianza: n })}
        />

        <div style={{ textAlign: 'center', margin: '14px 0' }}>
          Score <span className="score">{calcularScore(valores)}</span>
        </div>

        <div className="acciones-modal" style={{ justifyContent: 'stretch' }}>
          <button
            type="button"
            className="btn peligro"
            style={{ flex: 1 }}
            onClick={() => decidir('descartado')}
          >
            Descartar
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            onClick={async () => {
              await guardarPuntaje();
              await repositorio.cambiarEstado(actual.id, 'evaluando');
              siguiente();
            }}
          >
            Evaluando
          </button>
          <button
            type="button"
            className="btn principal"
            style={{ flex: 1 }}
            onClick={() => decidir('activo')}
          >
            Activar
          </button>
        </div>
        <p className="aviso">Teclas 1-5 para puntuar, flechas para moverte entre las escalas.</p>
      </div>

      {destino && (
        <DialogoEstado
          proyecto={actual}
          hasta={destino}
          activos={activos}
          onCerrar={siguiente}
        />
      )}
    </>
  );
}
