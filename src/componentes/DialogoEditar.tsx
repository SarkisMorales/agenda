import { useEffect, useRef, useState } from 'react';
import { repositorio } from '../datos/repositorio';
import { calcularScore } from '../dominio/score';
import type { Ajustes, Moneda, Proyecto } from '../dominio/tipos';
import { Escala } from './Escala';

interface Props {
  proyecto: Proyecto;
  ajustes: Ajustes;
  onCerrar: () => void;
}

export function DialogoEditar({ proyecto, ajustes, onCerrar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState({
    titulo: proyecto.titulo,
    descripcion: proyecto.descripcion ?? '',
    unidad: proyecto.unidad,
    etiquetas: proyecto.etiquetas.join(', '),
    impacto: proyecto.impacto,
    esfuerzo: proyecto.esfuerzo,
    confianza: proyecto.confianza,
    fechaLimite: proyecto.fechaLimite ?? '',
    proximaAccion: proyecto.proximaAccion ?? '',
    inversionEstimada: proyecto.inversionEstimada?.toString() ?? '',
    retornoMensualEstimado: proyecto.retornoMensualEstimado?.toString() ?? '',
    moneda: proyecto.moneda,
    cotizacion: (proyecto.cotizacionAlCargar ?? ajustes.cotizacionSugerida ?? '').toString(),
  });

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const cotizacionCongelada = proyecto.cotizacionAlCargar !== undefined;

  async function guardar() {
    const numero = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const cotizacion = numero(f.cotizacion);

    await repositorio.editar(proyecto.id, {
      titulo: f.titulo.trim() || proyecto.titulo,
      descripcion: f.descripcion.trim(),
      unidad: f.unidad,
      etiquetas: f.etiquetas.split(',').map((e) => e.trim()).filter(Boolean),
      impacto: f.impacto,
      esfuerzo: f.esfuerzo,
      confianza: f.confianza,
      fechaLimite: f.fechaLimite || undefined,
      proximaAccion: f.proximaAccion.trim() || undefined,
      inversionEstimada: numero(f.inversionEstimada),
      retornoMensualEstimado: numero(f.retornoMensualEstimado),
      moneda: f.moneda,
      cotizacionAlCargar: cotizacion,
    });

    // Recordamos la última cotización para proponerla la próxima vez.
    if (cotizacion) await repositorio.guardarAjustes({ cotizacionSugerida: cotizacion });
    onCerrar();
  }

  return (
    <dialog ref={ref} onClose={onCerrar} onCancel={onCerrar}>
      <h2>Editar proyecto</h2>

      <label className="campo">
        <span>Título</span>
        <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </label>

      <label className="campo">
        <span>Descripción</span>
        <textarea
          rows={2}
          value={f.descripcion}
          onChange={(e) => setF({ ...f, descripcion: e.target.value })}
        />
      </label>

      <div className="fila">
        <label className="campo">
          <span>Unidad</span>
          <select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>
            {ajustes.unidades.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Fecha límite</span>
          <input
            type="date"
            value={f.fechaLimite}
            onChange={(e) => setF({ ...f, fechaLimite: e.target.value })}
          />
        </label>
      </div>

      <label className="campo">
        <span>Etiquetas (separadas por coma)</span>
        <input value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} />
      </label>

      <label className="campo">
        <span>Próxima acción</span>
        <input
          value={f.proximaAccion}
          onChange={(e) => setF({ ...f, proximaAccion: e.target.value })}
        />
      </label>

      <div className="panel">
        <h3>
          Scoring — score <span className="score">{calcularScore(f)}</span>
        </h3>
        <Escala
          titulo="Impacto"
          ayuda="cuánto mueve la aguja"
          valor={f.impacto}
          onElegir={(n) => setF({ ...f, impacto: n })}
        />
        <Escala
          titulo="Esfuerzo"
          ayuda="cuánto trabajo cuesta"
          valor={f.esfuerzo}
          onElegir={(n) => setF({ ...f, esfuerzo: n })}
        />
        <Escala
          titulo="Confianza"
          ayuda="qué tan seguro estás"
          valor={f.confianza}
          onElegir={(n) => setF({ ...f, confianza: n })}
        />
      </div>

      <div className="panel">
        <h3>Plata (opcional)</h3>
        <div className="fila">
          <label className="campo">
            <span>Inversión estimada</span>
            <input
              inputMode="decimal"
              value={f.inversionEstimada}
              onChange={(e) => setF({ ...f, inversionEstimada: e.target.value })}
            />
          </label>
          <label className="campo">
            <span>Retorno mensual</span>
            <input
              inputMode="decimal"
              value={f.retornoMensualEstimado}
              onChange={(e) => setF({ ...f, retornoMensualEstimado: e.target.value })}
            />
          </label>
          <label className="campo">
            <span>Moneda</span>
            <select
              value={f.moneda}
              onChange={(e) => setF({ ...f, moneda: e.target.value as Moneda })}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <label className="campo">
          <span>Cotización del dólar al cargar</span>
          <input
            inputMode="decimal"
            value={f.cotizacion}
            disabled={cotizacionCongelada}
            onChange={(e) => setF({ ...f, cotizacion: e.target.value })}
          />
        </label>
        <p className="aviso">
          {cotizacionCongelada
            ? 'La cotización quedó congelada al cargar el proyecto y ya no se puede cambiar: así los números viejos siguen significando lo que significaban.'
            : 'Se guarda una sola vez y no se recalcula nunca más.'}
        </p>
      </div>

      <div className="acciones-modal">
        <button type="button" className="btn fantasma" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="btn principal" onClick={guardar}>
          Guardar
        </button>
      </div>
    </dialog>
  );
}
