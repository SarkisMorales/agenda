import { db } from './db';
import { repositorio } from './repositorio';
import { exportar } from './respaldo';
import { diasEntre } from '../dominio/tiempo';

/** Descarga el respaldo completo como archivo JSON. */
export async function descargarRespaldo(): Promise<void> {
  const datos = await exportar(db);
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agenda-${datos.exportadoEn.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Backup semanal. No se dispara solo sin avisar — el navegador bloquea las
 * descargas que el usuario no pidió, y una descarga sorpresa es molesta.
 * Devuelve true si toca hacer backup, y la app lo ofrece con un botón.
 */
export async function tocaBackup(): Promise<boolean> {
  const ahora = new Date().toISOString();
  const { ultimoBackup } = await repositorio.ajustes();
  if (ultimoBackup) return diasEntre(ultimoBackup, ahora) >= 7;

  // Nunca hubo backup: recién avisamos cuando hay una semana de trabajo
  // acumulado. Molestar el primer día, sin nada que perder, es ruido.
  const masViejo = await db.proyectos.orderBy('creadoEn').first();
  return masViejo !== undefined && diasEntre(masViejo.creadoEn, ahora) >= 7;
}

export async function hacerBackupSemanal(): Promise<void> {
  await descargarRespaldo();
  await repositorio.guardarAjustes({ ultimoBackup: new Date().toISOString() });
}
