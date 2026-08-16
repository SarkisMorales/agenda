import { useEffect, useRef, useState } from 'react';
import { ErrorDeRegla, repositorio } from '../datos/repositorio';
import { LARGO_MINIMO_CIERRE, type Estado, type Proyecto } from '../dominio/tipos';
import type { Bloqueo } from '../dominio/maquinaEstados';
import { NOMBRE_ESTADO } from './Insignias';

interface Props {
  proyecto: Proyecto;
  hasta: Estado;
  activos: Proyecto[];
  onCerrar: () => void;
}

/**
 * Modal de cambio de estado. Pide exactamente lo que la regla exige para ese
 * destino, y si el WIP está lleno muestra los activos con un botón para pausar
 * uno ahí mismo: el bloqueo no es un callejón sin salida.
 */
export function DialogoEstado({ proyecto, hasta, activos, onCerrar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [proximaAccion, setProximaAccion] = useState(proyecto.proximaAccion ?? '');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [aprendizaje, setAprendizaje] = useState('');
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const otrosActivos = activos.filter((p) => p.id !== proyecto.id);
  const pideAccion = hasta === 'activo';
  const pideMotivo = hasta === 'descartado';
  const pideAprendizaje = hasta === 'terminado';

  const faltaTexto =
    (pideAccion && !proximaAccion.trim()) ||
    (pideMotivo && motivoCierre.trim().length < LARGO_MINIMO_CIERRE) ||
    (pideAprendizaje && aprendizaje.trim().length < LARGO_MINIMO_CIERRE);

  async function confirmar() {
    try {
      await repositorio.cambiarEstado(proyecto.id, hasta, {
        proximaAccion,
        motivoCierre,
        aprendizaje,
      });
      onCerrar();
    } catch (error) {
      if (error instanceof ErrorDeRegla) setBloqueos(error.bloqueos);
      else setBloqueos([{ codigo: 'transicion_invalida', mensaje: String(error) }]);
    }
  }

  async function pausar(id: string) {
    await repositorio.cambiarEstado(id, 'pausado');
    setBloqueos([]);
  }

  return (
    <dialog ref={ref} onClose={onCerrar} onCancel={onCerrar}>
      <h2>
        {proyecto.titulo} → {NOMBRE_ESTADO[hasta]}
      </h2>

      {pideAccion && (
        <label className="campo">
          <span>¿Cuál es la próxima acción concreta? *</span>
          <input
            autoFocus
            value={proximaAccion}
            onChange={(e) => setProximaAccion(e.target.value)}
            placeholder="Llamar a tres proveedores y pedir presupuesto"
          />
        </label>
      )}

      {pideMotivo && (
        <label className="campo">
          <span>¿Por qué lo descartás? *</span>
          <textarea
            autoFocus
            rows={3}
            value={motivoCierre}
            onChange={(e) => setMotivoCierre(e.target.value)}
            placeholder="No da el margen que necesito y me come el fin de semana"
          />
          <Contador texto={motivoCierre} />
        </label>
      )}

      {pideAprendizaje && (
        <label className="campo">
          <span>¿Qué aprendiste? *</span>
          <textarea
            autoFocus
            rows={3}
            value={aprendizaje}
            onChange={(e) => setAprendizaje(e.target.value)}
            placeholder="Los combos suben el ticket promedio más que bajar precios"
          />
          <Contador texto={aprendizaje} />
        </label>
      )}

      {bloqueos.length > 0 && (
        <div className="bloqueos">
          {bloqueos.map((b) => (
            <div key={b.codigo} className="bloqueo">
              {b.mensaje}
            </div>
          ))}
        </div>
      )}

      {bloqueos.some((b) => b.codigo === 'wip_lleno') && (
        <div className="panel">
          <h3>Elegí cuál pausar</h3>
          {otrosActivos.map((p) => (
            <div key={p.id} className="acciones-tarjeta" style={{ borderTop: 'none', paddingTop: 0 }}>
              <span style={{ flex: 1 }}>{p.titulo}</span>
              <button type="button" className="btn chico" onClick={() => pausar(p.id)}>
                Pausar este
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="acciones-modal">
        <button type="button" className="btn fantasma" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="btn principal" disabled={faltaTexto} onClick={confirmar}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
}

function Contador({ texto }: { texto: string }) {
  const faltan = LARGO_MINIMO_CIERRE - texto.trim().length;
  return (
    <span className={`contador-caracteres ${faltan > 0 ? 'falta' : ''}`}>
      {faltan > 0 ? `Faltan ${faltan} caracteres` : '✓'}
    </span>
  );
}
