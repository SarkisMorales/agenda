import { useEffect, useRef, useState } from 'react';
import { useAgenda } from './estado/useAgenda';
import { repositorio } from './datos/repositorio';
import { pedirAlmacenamientoPersistente } from './datos/db';
import { hacerBackupSemanal, tocaBackup } from './datos/backupAutomatico';
import { Hoy } from './pantallas/Hoy';
import { Bandeja } from './pantallas/Bandeja';
import { Todos } from './pantallas/Todos';
import { Revision } from './pantallas/Revision';
import { Cementerio } from './pantallas/Cementerio';
import { Metricas } from './pantallas/Metricas';
import { Ajustes } from './pantallas/Ajustes';

const PANTALLAS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'bandeja', nombre: 'Bandeja' },
  { id: 'todos', nombre: 'Todos' },
  { id: 'revision', nombre: 'Revisión' },
  { id: 'cementerio', nombre: 'Cementerio' },
  { id: 'metricas', nombre: 'Métricas' },
  { id: 'ajustes', nombre: 'Ajustes' },
] as const;

type IdPantalla = (typeof PANTALLAS)[number]['id'];

export function App() {
  const { proyectos, eventos, ajustes, cargando } = useAgenda();
  const [pantalla, setPantalla] = useState<IdPantalla>('hoy');
  const [captura, setCaptura] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ofrecerBackup, setOfrecerBackup] = useState(false);
  const capturaRef = useRef<HTMLInputElement>(null);

  /* Tema. */
  useEffect(() => {
    const oscuroDelSistema = matchMedia('(prefers-color-scheme: dark)').matches;
    const tema =
      ajustes.tema === 'sistema' ? (oscuroDelSistema ? 'oscuro' : 'claro') : ajustes.tema;
    document.documentElement.dataset.tema = tema;
  }, [ajustes.tema]);

  /* Pedirle al navegador que no borre la base, y ver si toca backup. */
  useEffect(() => {
    pedirAlmacenamientoPersistente();
    tocaBackup().then(setOfrecerBackup);
  }, [proyectos.length]);

  /* Atajos globales. */
  useEffect(() => {
    function alTeclado(ev: KeyboardEvent) {
      const enCampo =
        ev.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(ev.target.tagName);

      if (ev.key === 'Escape' && enCampo) {
        (ev.target as HTMLElement).blur();
        return;
      }
      if (enCampo || ev.metaKey || ev.ctrlKey || ev.altKey) return;

      if (ev.key === 'c' || ev.key === 'C') {
        ev.preventDefault();
        capturaRef.current?.focus();
      } else if (ev.key === '/') {
        ev.preventDefault();
        setPantalla('todos');
        setTimeout(() => document.getElementById('campo-busqueda')?.focus(), 0);
      } else if (ev.key >= '1' && ev.key <= '7') {
        setPantalla(PANTALLAS[Number(ev.key) - 1]!.id);
      }
    }
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, []);

  async function capturar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!captura.trim()) return;
    await repositorio.capturar(captura);
    setCaptura('');
    capturaRef.current?.focus(); // queda listo para la siguiente
  }

  return (
    <div className="app">
      <header className="cabecera">
        <form className="captura" onSubmit={capturar}>
          <input
            ref={capturaRef}
            autoFocus
            value={captura}
            onChange={(e) => setCaptura(e.target.value)}
            placeholder="Capturar idea…  (tecla C)"
            aria-label="Capturar una idea nueva"
          />
          <button type="submit" className="btn principal" disabled={!captura.trim()}>
            Capturar
          </button>
        </form>

        <nav className="nav">
          {PANTALLAS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-current={pantalla === p.id ? 'page' : undefined}
              onClick={() => setPantalla(p.id)}
            >
              {p.nombre}
              <span className="tecla">{i + 1}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="contenido">
        {ofrecerBackup && pantalla === 'hoy' && (
          <div className="alerta ambar" style={{ marginBottom: 14 }}>
            <span style={{ flex: 1 }}>Pasó una semana sin respaldo.</span>
            <button
              type="button"
              className="btn chico"
              onClick={async () => {
                await hacerBackupSemanal();
                setOfrecerBackup(false);
              }}
            >
              Descargar backup
            </button>
          </div>
        )}

        {cargando ? (
          <div className="vacio">Cargando…</div>
        ) : pantalla === 'hoy' ? (
          <Hoy
            proyectos={proyectos}
            eventos={eventos}
            ajustes={ajustes}
            irA={(p) => setPantalla(p as IdPantalla)}
          />
        ) : pantalla === 'bandeja' ? (
          <Bandeja proyectos={proyectos} eventos={eventos} ajustes={ajustes} />
        ) : pantalla === 'todos' ? (
          <Todos
            proyectos={proyectos}
            eventos={eventos}
            ajustes={ajustes}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
          />
        ) : pantalla === 'revision' ? (
          <Revision proyectos={proyectos} eventos={eventos} ajustes={ajustes} />
        ) : pantalla === 'cementerio' ? (
          <Cementerio proyectos={proyectos} eventos={eventos} ajustes={ajustes} />
        ) : pantalla === 'metricas' ? (
          <Metricas proyectos={proyectos} eventos={eventos} />
        ) : (
          <Ajustes ajustes={ajustes} proyectos={proyectos} />
        )}
      </main>
    </div>
  );
}
