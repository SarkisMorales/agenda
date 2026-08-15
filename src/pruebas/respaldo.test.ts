import { describe, expect, it } from 'vitest';
import { nuevoEntorno } from './ayudas';
import { borrarTodo, exportar, importar } from '../datos/respaldo';
import { balanceDelMes, diasPromedioHastaCerrar, racha, tasaDeDescarte } from '../dominio/metricas';

const ACCION = { proximaAccion: 'Arrancar' };
const MOTIVO = { motivoCierre: 'No cierra por números' };

describe('criterio de aceptación 6 — exporto, borro todo, importo', () => {
  it('queda exactamente igual, eventos incluidos', async () => {
    const { db, repo } = nuevoEntorno();
    const a = await repo.capturar('Kiosco 24hs — heladera nueva', 'Kiosco');
    await repo.cambiarEstado(a.id, 'activo', ACCION);
    await repo.agregarPaso(a.id, 'Pedir presupuestos');
    const b = await repo.capturar('App de cupones', 'Crystal System');
    await repo.cambiarEstado(b.id, 'descartado', MOTIVO);

    const antes = await exportar(db);

    await borrarTodo(db);
    expect(await repo.proyectos()).toHaveLength(0);
    expect(await repo.eventos()).toHaveLength(0);

    const resumen = await importar(antes, db);
    const despues = await exportar(db);

    expect(resumen.proyectosNuevos).toBe(2);
    expect(despues.proyectos).toEqual(antes.proyectos);
    expect(despues.eventos).toEqual(antes.eventos);
  });
});

describe('import por merge', () => {
  it('no pisa trabajo más nuevo con un backup viejo', async () => {
    const { db, repo, reloj } = nuevoEntorno();
    const p = await repo.capturar('Rotisería — menú fijo');
    const backupViejo = await exportar(db);

    reloj.avanzarDias(3);
    await repo.editar(p.id, { titulo: 'Rotisería — menú fijo (revisado)' });

    const resumen = await importar(backupViejo, db);

    expect(resumen.proyectosIgnorados).toBe(1);
    expect((await repo.proyecto(p.id))!.titulo).toBe('Rotisería — menú fijo (revisado)');
  });

  it('importar dos veces no duplica eventos', async () => {
    const { db, repo } = nuevoEntorno();
    await repo.capturar('Algo');
    const respaldo = await exportar(db);

    await importar(respaldo, db);
    await importar(respaldo, db);

    expect(await repo.eventos()).toHaveLength(1);
  });

  it('rechaza un archivo que no es un respaldo', async () => {
    const { db } = nuevoEntorno();
    await expect(importar({ hola: 'mundo' }, db)).rejects.toThrow();
    await expect(importar(null, db)).rejects.toThrow();
  });
});

describe('criterio 5 — las métricas se leen del log', () => {
  it('siguen contando proyectos que ya fueron borrados', async () => {
    const { repo, reloj } = nuevoEntorno();
    reloj.fijar('2026-03-02T10:00:00.000Z');

    const a = await repo.capturar('Idea A');
    const b = await repo.capturar('Idea B');
    await repo.capturar('Idea C');

    reloj.avanzarDias(4);
    await repo.cambiarEstado(a.id, 'descartado', MOTIVO);
    await repo.cambiarEstado(b.id, 'activo', ACCION);
    await repo.cambiarEstado(b.id, 'terminado', { aprendizaje: 'Funcionó mejor de lo esperado' });

    await repo.borrarDefinitivo(a.id); // el borrado no debería mover los números

    const log = await repo.eventos();
    const balance = balanceDelMes(log, '2026-03');
    expect(balance.abiertas).toBe(3);
    expect(balance.cerradas).toBe(2);
    expect(await repo.proyectos()).toHaveLength(2);

    expect(diasPromedioHastaCerrar(log)).toBe(4);
    expect(tasaDeDescarte(log)).toBe(0.5);
  });

  it('la racha cuenta días seguidos con un paso completado', async () => {
    const { repo, reloj } = nuevoEntorno();
    reloj.fijar('2026-03-10T10:00:00.000Z');
    const p = await repo.capturar('Racha');
    await repo.cambiarEstado(p.id, 'activo', ACCION);

    for (let dia = 0; dia < 3; dia++) {
      const conPaso = await repo.agregarPaso(p.id, `Paso ${dia}`);
      await repo.alternarPaso(p.id, conPaso.pasos.at(-1)!.id);
      reloj.avanzarDias(1);
    }

    const log = await repo.eventos();
    expect(racha(log, '2026-03-12')).toBe(3);
    expect(racha(log, '2026-03-13')).toBe(3); // ayer contó, la racha sigue viva
    expect(racha(log, '2026-03-14')).toBe(0); // se cortó
  });
});
