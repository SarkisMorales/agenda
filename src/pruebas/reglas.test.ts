import { describe, expect, it } from 'vitest';
import { nuevoEntorno } from './ayudas';
import { ErrorDeRegla } from '../datos/repositorio';
import { calcularScore } from '../dominio/score';
import { calcularEstancamiento, sinProximaAccion } from '../dominio/tiempo';
import { transicionPermitida } from '../dominio/maquinaEstados';

const ACCION = { proximaAccion: 'Llamar al proveedor' };
const MOTIVO = { motivoCierre: 'No da el margen que esperaba' };
const APRENDIZAJE = { aprendizaje: 'Los combos suben el ticket promedio' };

describe('score', () => {
  it('da 100 en el mejor caso y 1 en el peor', () => {
    expect(calcularScore({ impacto: 5, confianza: 5, esfuerzo: 1 })).toBe(100);
    expect(calcularScore({ impacto: 1, confianza: 1, esfuerzo: 5 })).toBe(1);
  });

  it('nunca pasa de 100', () => {
    for (let i = 1; i <= 5; i++)
      for (let c = 1; c <= 5; c++)
        for (let e = 1; e <= 5; e++)
          expect(calcularScore({ impacto: i, confianza: c, esfuerzo: e })).toBeLessThanOrEqual(100);
  });

  it('rechaza valores fuera de 1 a 5', () => {
    expect(() => calcularScore({ impacto: 0, confianza: 3, esfuerzo: 3 })).toThrow();
    expect(() => calcularScore({ impacto: 3, confianza: 3, esfuerzo: 6 })).toThrow();
  });
});

describe('máquina de estados', () => {
  it('no deja saltar de bandeja a terminado', () => {
    expect(transicionPermitida('bandeja', 'terminado')).toBe(false);
    expect(transicionPermitida('bandeja', 'activo')).toBe(true);
  });

  it('los cerrados sólo pueden revivir a bandeja', () => {
    expect(transicionPermitida('descartado', 'bandeja')).toBe(true);
    expect(transicionPermitida('descartado', 'activo')).toBe(false);
  });
});

describe('regla 1 — límite de WIP', () => {
  it('bloquea el cuarto activo y dice qué falta', async () => {
    const { repo } = nuevoEntorno();
    for (const t of ['Uno', 'Dos', 'Tres']) {
      const p = await repo.capturar(t);
      await repo.cambiarEstado(p.id, 'activo', ACCION);
    }
    const cuarto = await repo.capturar('Cuatro');

    await expect(repo.cambiarEstado(cuarto.id, 'activo', ACCION)).rejects.toThrow(ErrorDeRegla);

    // Y sigue en bandeja: no quedó nada a medias.
    expect((await repo.proyecto(cuarto.id))!.estado).toBe('bandeja');
    expect(await repo.porEstado('activo')).toHaveLength(3);
  });

  it('deja activar el cuarto después de pausar uno', async () => {
    const { repo } = nuevoEntorno();
    const ids: string[] = [];
    for (const t of ['Uno', 'Dos', 'Tres']) {
      const p = await repo.capturar(t);
      await repo.cambiarEstado(p.id, 'activo', ACCION);
      ids.push(p.id);
    }
    const cuarto = await repo.capturar('Cuatro');

    await repo.cambiarEstado(ids[0]!, 'pausado');
    const activado = await repo.cambiarEstado(cuarto.id, 'activo', ACCION);

    expect(activado.estado).toBe('activo');
    expect(await repo.porEstado('activo')).toHaveLength(3);
  });

  it('el límite se puede configurar', async () => {
    const { repo } = nuevoEntorno();
    await repo.guardarAjustes({ limiteWip: 1 });
    const a = await repo.capturar('A');
    const b = await repo.capturar('B');
    await repo.cambiarEstado(a.id, 'activo', ACCION);
    await expect(repo.cambiarEstado(b.id, 'activo', ACCION)).rejects.toThrow(ErrorDeRegla);
  });
});

describe('regla 2 — próxima acción obligatoria', () => {
  it('no deja activar sin próxima acción', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Rediseñar la carta');

    await expect(repo.cambiarEstado(p.id, 'activo')).rejects.toMatchObject({
      bloqueos: [{ codigo: 'falta_proxima_accion' }],
    });
  });

  it('marca en rojo un activo que se quedó sin próxima acción', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Rediseñar la carta');
    await repo.cambiarEstado(p.id, 'activo', ACCION);

    expect(sinProximaAccion((await repo.proyecto(p.id))!)).toBe(false);
    const vaciado = await repo.editar(p.id, { proximaAccion: '' });
    expect(sinProximaAccion(vaciado)).toBe(true);
  });
});

describe('regla 3 — estancamiento', () => {
  it('pasa a ámbar a los 10 días y a rojo a los 21', async () => {
    const { repo, reloj } = nuevoEntorno();
    const p = await repo.capturar('Sistema de fidelidad');
    await repo.cambiarEstado(p.id, 'activo', ACCION);

    const medir = async () =>
      calcularEstancamiento((await repo.proyecto(p.id))!, await repo.eventos(), reloj.ahora());

    reloj.avanzarDias(5);
    expect((await medir()).nivel).toBe('ok');

    reloj.avanzarDias(6); // 11 días
    expect((await medir()).nivel).toBe('ambar');

    reloj.avanzarDias(11); // 22 días
    const rojo = await medir();
    expect(rojo.nivel).toBe('rojo');
    expect(rojo.dias).toBe(22);
  });

  it('completar un paso resetea el reloj, pero renombrar no', async () => {
    const { repo, reloj } = nuevoEntorno();
    const p = await repo.capturar('Delivery propio');
    await repo.cambiarEstado(p.id, 'activo', ACCION);
    const conPaso = await repo.agregarPaso(p.id, 'Cotizar motos');

    reloj.avanzarDias(15);
    await repo.editar(p.id, { titulo: 'Delivery propio v2' });
    let estado = calcularEstancamiento(
      (await repo.proyecto(p.id))!,
      await repo.eventos(),
      reloj.ahora(),
    );
    expect(estado.nivel).toBe('ambar'); // renombrar no cuenta como avanzar

    await repo.alternarPaso(p.id, conPaso.pasos[0]!.id);
    estado = calcularEstancamiento((await repo.proyecto(p.id))!, await repo.eventos(), reloj.ahora());
    expect(estado.nivel).toBe('ok');
  });

  it('un pausado nunca figura como estancado', async () => {
    const { repo, reloj } = nuevoEntorno();
    const p = await repo.capturar('Reventa de electrónica');
    await repo.cambiarEstado(p.id, 'activo', ACCION);
    await repo.cambiarEstado(p.id, 'pausado');

    reloj.avanzarDias(60);
    const estado = calcularEstancamiento(
      (await repo.proyecto(p.id))!,
      await repo.eventos(),
      reloj.ahora(),
    );
    expect(estado.nivel).toBe('ok');
  });
});

describe('regla 4 — cierre con contexto', () => {
  it('no deja descartar sin motivo de al menos 10 caracteres', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Vender café de especialidad');

    await expect(repo.cambiarEstado(p.id, 'descartado')).rejects.toMatchObject({
      bloqueos: [{ codigo: 'falta_motivo_cierre' }],
    });
    await expect(
      repo.cambiarEstado(p.id, 'descartado', { motivoCierre: 'nah' }),
    ).rejects.toThrow(ErrorDeRegla);

    const cerrado = await repo.cambiarEstado(p.id, 'descartado', MOTIVO);
    expect(cerrado.estado).toBe('descartado');
    expect(cerrado.cerradoEn).toBeTruthy();
  });

  it('no deja terminar sin aprendizaje', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Combo desayuno');
    await repo.cambiarEstado(p.id, 'activo', ACCION);

    await expect(repo.cambiarEstado(p.id, 'terminado')).rejects.toMatchObject({
      bloqueos: [{ codigo: 'falta_aprendizaje' }],
    });
    const listo = await repo.cambiarEstado(p.id, 'terminado', APRENDIZAJE);
    expect(listo.aprendizaje).toBe(APRENDIZAJE.aprendizaje);
  });

  it('junta todos los bloqueos, no sólo el primero', async () => {
    const { repo } = nuevoEntorno();
    await repo.guardarAjustes({ limiteWip: 0 });
    const p = await repo.capturar('Idea nueva');

    await expect(repo.cambiarEstado(p.id, 'activo')).rejects.toMatchObject({
      bloqueos: [{ codigo: 'wip_lleno' }, { codigo: 'falta_proxima_accion' }],
    });
  });
});

describe('regla 5 — nada se borra', () => {
  it('un descartado se puede revivir y vuelve a bandeja', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Máquina de café nueva');
    await repo.cambiarEstado(p.id, 'descartado', MOTIVO);

    const revivido = await repo.cambiarEstado(p.id, 'bandeja');
    expect(revivido.estado).toBe('bandeja');
    expect(revivido.cerradoEn).toBeUndefined();
    expect(revivido.motivoCierre).toBe(MOTIVO.motivoCierre); // queda el registro

    const tipos = (await repo.eventosDe(p.id)).map((e) => e.tipo);
    expect(tipos).toContain('revivido');
  });

  it('borrar de verdad un proyecto no borra sus eventos del log', async () => {
    const { repo } = nuevoEntorno();
    const p = await repo.capturar('Prueba');
    await repo.cambiarEstado(p.id, 'descartado', MOTIVO);

    await repo.borrarDefinitivo(p.id);

    expect(await repo.proyecto(p.id)).toBeUndefined();
    const log = await repo.eventos();
    expect(log.filter((e) => e.proyectoId === p.id)).toHaveLength(2); // creado + cerrado
  });
});
