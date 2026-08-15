import type { AgendaDB } from './db';
import { db as dbPorDefecto } from './db';
import {
  eventoDeTransicion,
  validarTransicion,
  type Bloqueo,
  type DatosTransicion,
} from '../dominio/maquinaEstados';
import { calcularScore } from '../dominio/score';
import {
  AJUSTES_POR_DEFECTO,
  SCORE_NEUTRO,
  type Ajustes,
  type Estado,
  type Evento,
  type Paso,
  type Proyecto,
  type TipoEvento,
} from '../dominio/tipos';

/** Error de regla de negocio. La UI lo muestra; no es un bug. */
export class ErrorDeRegla extends Error {
  constructor(public bloqueos: Bloqueo[]) {
    super(bloqueos.map((b) => b.mensaje).join(' '));
    this.name = 'ErrorDeRegla';
  }
}

export interface Reloj {
  ahora(): string;
  id(): string;
}

const relojReal: Reloj = {
  ahora: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
};

export class Repositorio {
  constructor(
    private db: AgendaDB = dbPorDefecto,
    private reloj: Reloj = relojReal,
  ) {}

  /* ---------- Ajustes ---------- */

  async ajustes(): Promise<Ajustes> {
    return (await this.db.ajustes.get('unico')) ?? AJUSTES_POR_DEFECTO;
  }

  async guardarAjustes(cambios: Partial<Omit<Ajustes, 'id'>>): Promise<Ajustes> {
    const actuales = await this.ajustes();
    const nuevos = { ...actuales, ...cambios, id: 'unico' as const };
    await this.db.ajustes.put(nuevos);
    return nuevos;
  }

  /* ---------- Lectura ---------- */

  proyecto(id: string): Promise<Proyecto | undefined> {
    return this.db.proyectos.get(id);
  }

  proyectos(): Promise<Proyecto[]> {
    return this.db.proyectos.toArray();
  }

  porEstado(estado: Estado): Promise<Proyecto[]> {
    return this.db.proyectos.where('estado').equals(estado).toArray();
  }

  /** Log global completo, incluidos eventos de proyectos ya borrados. */
  eventos(): Promise<Evento[]> {
    return this.db.eventos.orderBy('fecha').toArray();
  }

  eventosDe(proyectoId: string): Promise<Evento[]> {
    return this.db.eventos.where('proyectoId').equals(proyectoId).toArray();
  }

  /* ---------- Escritura ---------- */

  /** Captura rápida: sólo un título, score neutro, va a bandeja. */
  async capturar(titulo: string, unidad = 'Otro'): Promise<Proyecto> {
    const limpio = titulo.trim();
    if (!limpio) throw new Error('El título no puede estar vacío.');

    const ahora = this.reloj.ahora();
    const proyecto: Proyecto = {
      id: this.reloj.id(),
      titulo: limpio,
      estado: 'bandeja',
      unidad,
      etiquetas: [],
      ...SCORE_NEUTRO,
      moneda: 'ARS',
      pasos: [],
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    await this.db.transaction('rw', this.db.proyectos, this.db.eventos, async () => {
      await this.db.proyectos.add(proyecto);
      await this.registrar(proyecto.id, 'creado', `Capturado: "${limpio}"`);
    });

    return proyecto;
  }

  /**
   * Edición de campos que no son el estado (título, unidad, scoring, plata…).
   * No genera evento de progreso a propósito: renombrar algo no es avanzarlo.
   */
  async editar(
    id: string,
    cambios: Partial<Omit<Proyecto, 'id' | 'estado' | 'pasos' | 'creadoEn' | 'actualizadoEn'>>,
  ): Promise<Proyecto> {
    const proyecto = await this.exigirProyecto(id);
    const actualizado: Proyecto = { ...proyecto, ...cambios, actualizadoEn: this.reloj.ahora() };

    // Valida el scoring antes de guardar; tira si quedó fuera de 1-5.
    calcularScore(actualizado);

    // La cotización se congela: si ya tenía una, no se toca nunca más.
    if (proyecto.cotizacionAlCargar !== undefined) {
      actualizado.cotizacionAlCargar = proyecto.cotizacionAlCargar;
    }

    await this.db.proyectos.put(actualizado);
    return actualizado;
  }

  async definirProximaAccion(id: string, accion: string): Promise<Proyecto> {
    const limpio = accion.trim();
    if (!limpio) throw new Error('La próxima acción no puede estar vacía.');
    const proyecto = await this.exigirProyecto(id);

    const actualizado = { ...proyecto, proximaAccion: limpio, actualizadoEn: this.reloj.ahora() };
    await this.db.transaction('rw', this.db.proyectos, this.db.eventos, async () => {
      await this.db.proyectos.put(actualizado);
      await this.registrar(id, 'accion_definida', limpio);
    });
    return actualizado;
  }

  /**
   * Cambio de estado. Acá se hacen cumplir el límite de WIP, la próxima
   * acción obligatoria y los cierres con contexto. Todo dentro de una
   * transacción: si algo falla, no queda nada a medias.
   */
  async cambiarEstado(
    id: string,
    hasta: Estado,
    datos: DatosTransicion = {},
  ): Promise<Proyecto> {
    return this.db.transaction(
      'rw',
      this.db.proyectos,
      this.db.eventos,
      this.db.ajustes,
      async () => {
        const proyecto = await this.exigirProyecto(id);
        const { limiteWip } = await this.ajustes();
        const activos = await this.db.proyectos.where('estado').equals('activo').count();
        const activosSinContarEste = proyecto.estado === 'activo' ? activos - 1 : activos;

        const resultado = validarTransicion(proyecto, hasta, datos, {
          activosActuales: activosSinContarEste,
          limiteWip,
        });
        if (!resultado.ok) throw new ErrorDeRegla(resultado.bloqueos);

        const ahora = this.reloj.ahora();
        const desde = proyecto.estado;
        const actualizado: Proyecto = { ...proyecto, estado: hasta, actualizadoEn: ahora };

        if (datos.proximaAccion?.trim()) actualizado.proximaAccion = datos.proximaAccion.trim();
        if (datos.motivoCierre?.trim()) actualizado.motivoCierre = datos.motivoCierre.trim();
        if (datos.aprendizaje?.trim()) actualizado.aprendizaje = datos.aprendizaje.trim();

        if (hasta === 'activo' && !proyecto.activadoEn) actualizado.activadoEn = ahora;
        if (hasta === 'terminado' || hasta === 'descartado') actualizado.cerradoEn = ahora;
        if (hasta === 'bandeja') {
          // Revivir: vuelve a estar abierto, se limpia la marca de cierre.
          delete actualizado.cerradoEn;
        }

        await this.db.proyectos.put(actualizado);
        await this.registrar(
          id,
          eventoDeTransicion(desde, hasta),
          `${desde} → ${hasta}` +
            (actualizado.motivoCierre && hasta === 'descartado' ? `: ${actualizado.motivoCierre}` : '') +
            (actualizado.aprendizaje && hasta === 'terminado' ? `: ${actualizado.aprendizaje}` : ''),
          ahora,
          { desde, hasta },
        );

        return actualizado;
      },
    );
  }

  async agregarPaso(id: string, texto: string): Promise<Proyecto> {
    const limpio = texto.trim();
    if (!limpio) throw new Error('El paso no puede estar vacío.');
    const proyecto = await this.exigirProyecto(id);
    const ahora = this.reloj.ahora();

    const paso: Paso = { id: this.reloj.id(), texto: limpio, hecho: false, creadoEn: ahora };
    const actualizado = { ...proyecto, pasos: [...proyecto.pasos, paso], actualizadoEn: ahora };

    await this.db.transaction('rw', this.db.proyectos, this.db.eventos, async () => {
      await this.db.proyectos.put(actualizado);
      await this.registrar(id, 'paso_agregado', limpio, ahora);
    });
    return actualizado;
  }

  /** Marca o desmarca un paso. Sólo marcar cuenta como progreso. */
  async alternarPaso(id: string, pasoId: string): Promise<Proyecto> {
    const proyecto = await this.exigirProyecto(id);
    const paso = proyecto.pasos.find((p) => p.id === pasoId);
    if (!paso) throw new Error('Ese paso no existe en este proyecto.');

    const ahora = this.reloj.ahora();
    const hecho = !paso.hecho;
    const pasos = proyecto.pasos.map((p) =>
      p.id === pasoId
        ? { ...p, hecho, ...(hecho ? { completadoEn: ahora } : { completadoEn: undefined }) }
        : p,
    );
    const actualizado = { ...proyecto, pasos, actualizadoEn: ahora };

    await this.db.transaction('rw', this.db.proyectos, this.db.eventos, async () => {
      await this.db.proyectos.put(actualizado);
      if (hecho) await this.registrar(id, 'paso_completado', paso.texto, ahora);
    });
    return actualizado;
  }

  async quitarPaso(id: string, pasoId: string): Promise<Proyecto> {
    const proyecto = await this.exigirProyecto(id);
    const actualizado = {
      ...proyecto,
      pasos: proyecto.pasos.filter((p) => p.id !== pasoId),
      actualizadoEn: this.reloj.ahora(),
    };
    await this.db.proyectos.put(actualizado);
    return actualizado;
  }

  /**
   * Borrado real. Sólo se usa desde ajustes, con confirmación escrita.
   * Los eventos del proyecto NO se borran: el historial es del log, no del
   * proyecto.
   */
  async borrarDefinitivo(id: string): Promise<void> {
    await this.db.proyectos.delete(id);
  }

  /* ---------- Interno ---------- */

  private async exigirProyecto(id: string): Promise<Proyecto> {
    const proyecto = await this.db.proyectos.get(id);
    if (!proyecto) throw new Error(`No existe el proyecto ${id}.`);
    return proyecto;
  }

  private async registrar(
    proyectoId: string,
    tipo: TipoEvento,
    detalle: string,
    fecha = this.reloj.ahora(),
    estados?: { desde: Estado; hasta: Estado },
  ): Promise<void> {
    await this.db.eventos.add({
      id: this.reloj.id(),
      proyectoId,
      tipo,
      detalle,
      fecha,
      ...estados,
    });
  }
}

export const repositorio = new Repositorio();
