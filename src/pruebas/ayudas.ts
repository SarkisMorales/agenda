import { AgendaDB } from '../datos/db';
import { Repositorio, type Reloj } from '../datos/repositorio';

/** Reloj falso: avanza sólo cuando se lo pedimos, así los tests son estables. */
export class RelojFalso implements Reloj {
  private contador = 0;
  constructor(private fecha = new Date('2026-03-01T10:00:00.000Z')) {}

  ahora(): string {
    return this.fecha.toISOString();
  }

  id(): string {
    return `id-${++this.contador}`;
  }

  avanzarDias(dias: number): void {
    this.fecha = new Date(this.fecha.getTime() + dias * 86_400_000);
  }

  fijar(iso: string): void {
    this.fecha = new Date(iso);
  }
}

let n = 0;

export function nuevoEntorno(): { db: AgendaDB; repo: Repositorio; reloj: RelojFalso } {
  const db = new AgendaDB(`prueba-${++n}-${Math.random()}`);
  const reloj = new RelojFalso();
  return { db, repo: new Repositorio(db, reloj), reloj };
}
