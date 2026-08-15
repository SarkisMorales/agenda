/* Agenda de Proyectos — almacenamiento local, sin dependencias. */

const CLAVE = 'agenda-proyectos-v1';
const CLAVE_TEMA = 'agenda-tema';

const ESTADOS = {
  'idea': 'Idea',
  'en-curso': 'En curso',
  'pausado': 'Pausado',
  'terminado': 'Terminado',
};

const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

let proyectos = cargar();
let editandoId = null;

const $ = (sel) => document.querySelector(sel);

const lista = $('#lista');
const dialogo = $('#dialogo');
const formProyecto = $('#form-proyecto');
const buscar = $('#buscar');
const filtroEstado = $('#filtro-estado');
const orden = $('#orden');

/* ---------- Persistencia ---------- */

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.map(normalizar) : [];
  } catch (err) {
    console.warn('No se pudo leer la agenda guardada:', err);
    return [];
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(proyectos));
  } catch (err) {
    alert('No se pudo guardar en este navegador: ' + err.message);
  }
}

function normalizar(p) {
  return {
    id: p.id || nuevoId(),
    nombre: String(p.nombre || 'Sin nombre'),
    descripcion: String(p.descripcion || ''),
    estado: ESTADOS[p.estado] ? p.estado : 'idea',
    prioridad: PRIORIDADES[p.prioridad] ? p.prioridad : 'media',
    fecha: p.fecha || '',
    etiquetas: Array.isArray(p.etiquetas) ? p.etiquetas.map(String) : [],
    tareas: Array.isArray(p.tareas)
      ? p.tareas.map((t) => ({ id: t.id || nuevoId(), texto: String(t.texto || ''), hecha: !!t.hecha }))
      : [],
    creado: p.creado || new Date().toISOString(),
    actualizado: p.actualizado || p.creado || new Date().toISOString(),
  };
}

function nuevoId() {
  return (crypto.randomUUID?.() ?? String(Date.now() + Math.random()));
}

function tocar(proyecto) {
  proyecto.actualizado = new Date().toISOString();
  guardar();
  pintar();
}

/* ---------- Filtros y orden ---------- */

function visibles() {
  const texto = buscar.value.trim().toLowerCase();
  const estado = filtroEstado.value;

  const filtrados = proyectos.filter((p) => {
    if (estado && p.estado !== estado) return false;
    if (!texto) return true;
    const bolsa = [p.nombre, p.descripcion, ...p.etiquetas, ...p.tareas.map((t) => t.texto)]
      .join(' ')
      .toLowerCase();
    return bolsa.includes(texto);
  });

  const criterio = orden.value;
  return filtrados.sort((a, b) => {
    if (criterio === 'nombre') return a.nombre.localeCompare(b.nombre, 'es');
    if (criterio === 'prioridad') return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
    if (criterio === 'fecha') {
      // Los proyectos sin fecha van al final.
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha.localeCompare(b.fecha);
    }
    return b.actualizado.localeCompare(a.actualizado);
  });
}

/* ---------- Render ---------- */

function pintar() {
  const items = visibles();
  lista.textContent = '';

  if (items.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'vacio';
    vacio.textContent = proyectos.length === 0
      ? 'Todavía no anotaste ningún proyecto. Tocá "+ Nuevo proyecto" para empezar.'
      : 'Ningún proyecto coincide con el filtro.';
    lista.append(vacio);
  } else {
    items.forEach((p) => lista.append(tarjeta(p)));
  }

  pintarResumen();
}

function tarjeta(p) {
  const nodo = $('#tpl-proyecto').content.cloneNode(true);
  const art = nodo.querySelector('.proyecto');
  art.dataset.id = p.id;
  art.classList.toggle('terminado', p.estado === 'terminado');

  art.querySelector('.proyecto-nombre').textContent = p.nombre;

  const desc = art.querySelector('.proyecto-desc');
  desc.textContent = p.descripcion;
  desc.hidden = !p.descripcion;

  const badgeEstado = art.querySelector('.badge.estado');
  badgeEstado.textContent = ESTADOS[p.estado];

  const badgePrioridad = art.querySelector('.badge.prioridad');
  badgePrioridad.textContent = 'Prioridad ' + PRIORIDADES[p.prioridad].toLowerCase();
  badgePrioridad.classList.add('prioridad-' + p.prioridad);

  const metaFecha = art.querySelector('.meta-fecha');
  if (p.fecha) {
    metaFecha.textContent = '📅 ' + formatoFecha(p.fecha);
    if (vencida(p)) {
      metaFecha.classList.add('vencida');
      metaFecha.textContent += ' (vencida)';
    }
  } else {
    metaFecha.hidden = true;
  }

  const hechas = p.tareas.filter((t) => t.hecha).length;
  const metaProgreso = art.querySelector('.meta-progreso');
  metaProgreso.textContent = p.tareas.length
    ? `✅ ${hechas}/${p.tareas.length} pasos`
    : 'Sin pasos anotados';
  const pct = p.tareas.length ? Math.round((hechas / p.tareas.length) * 100) : 0;
  art.querySelector('.barra-relleno').style.width = pct + '%';

  const etiquetas = art.querySelector('.etiquetas');
  p.etiquetas.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = '#' + e;
    etiquetas.append(li);
  });

  const tareas = art.querySelector('.tareas');
  p.tareas.forEach((t) => tareas.append(filaTarea(p, t)));

  art.querySelector('.nueva-tarea').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = ev.target.elements.texto;
    const texto = input.value.trim();
    if (!texto) return;
    p.tareas.push({ id: nuevoId(), texto, hecha: false });
    input.value = '';
    tocar(p);
  });

  art.querySelector('[data-accion="editar"]').addEventListener('click', () => abrirDialogo(p));
  art.querySelector('[data-accion="duplicar"]').addEventListener('click', () => duplicar(p));
  art.querySelector('[data-accion="borrar"]').addEventListener('click', () => borrar(p));

  return nodo;
}

function filaTarea(proyecto, tarea) {
  const li = document.createElement('li');
  li.classList.toggle('hecha', tarea.hecha);

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = tarea.hecha;
  check.addEventListener('change', () => {
    tarea.hecha = check.checked;
    tocar(proyecto);
  });

  const texto = document.createElement('span');
  texto.className = 'texto';
  texto.textContent = tarea.texto;

  const quitar = document.createElement('button');
  quitar.type = 'button';
  quitar.className = 'quitar';
  quitar.title = 'Quitar paso';
  quitar.textContent = '×';
  quitar.addEventListener('click', () => {
    proyecto.tareas = proyecto.tareas.filter((t) => t.id !== tarea.id);
    tocar(proyecto);
  });

  li.append(check, texto, quitar);
  return li;
}

function pintarResumen() {
  const total = proyectos.length;
  const enCurso = proyectos.filter((p) => p.estado === 'en-curso').length;
  const terminados = proyectos.filter((p) => p.estado === 'terminado').length;
  const vencidos = proyectos.filter(vencida).length;

  $('#resumen').textContent = total === 0
    ? 'Sin proyectos todavía'
    : `${total} proyecto${total === 1 ? '' : 's'} · ${enCurso} en curso · ${terminados} terminado${terminados === 1 ? '' : 's'}`;

  const contadores = $('#contadores');
  contadores.textContent = '';
  const filas = [
    ['Total', total],
    ['En curso', enCurso],
    ['Terminados', terminados],
    ['Con fecha vencida', vencidos],
  ];
  filas.forEach(([etiqueta, valor]) => {
    const div = document.createElement('div');
    div.append(etiqueta + ': ');
    const b = document.createElement('b');
    b.textContent = valor;
    div.append(b);
    contadores.append(div);
  });
}

function vencida(p) {
  if (!p.fecha || p.estado === 'terminado') return false;
  return p.fecha < hoyISO();
}

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatoFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- Alta / edición ---------- */

function abrirDialogo(proyecto = null) {
  editandoId = proyecto?.id ?? null;
  $('#dialogo-titulo').textContent = proyecto ? 'Editar proyecto' : 'Nuevo proyecto';

  const f = formProyecto.elements;
  f.nombre.value = proyecto?.nombre ?? '';
  f.descripcion.value = proyecto?.descripcion ?? '';
  f.estado.value = proyecto?.estado ?? 'idea';
  f.prioridad.value = proyecto?.prioridad ?? 'media';
  f.fecha.value = proyecto?.fecha ?? '';
  f.etiquetas.value = (proyecto?.etiquetas ?? []).join(', ');

  dialogo.showModal();
  f.nombre.focus();
}

formProyecto.addEventListener('submit', (ev) => {
  if (ev.submitter?.value === 'cancelar') return;

  const f = formProyecto.elements;
  const nombre = f.nombre.value.trim();
  if (!nombre) {
    ev.preventDefault();
    return;
  }

  const datos = {
    nombre,
    descripcion: f.descripcion.value.trim(),
    estado: f.estado.value,
    prioridad: f.prioridad.value,
    fecha: f.fecha.value,
    etiquetas: f.etiquetas.value.split(',').map((e) => e.trim()).filter(Boolean),
  };

  const existente = proyectos.find((p) => p.id === editandoId);
  if (existente) {
    Object.assign(existente, datos);
    existente.actualizado = new Date().toISOString();
  } else {
    proyectos.push(normalizar(datos));
  }

  editandoId = null;
  guardar();
  pintar();
});

function duplicar(p) {
  const copia = normalizar({
    ...structuredClone(p),
    id: nuevoId(),
    nombre: p.nombre + ' (copia)',
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  });
  copia.tareas = copia.tareas.map((t) => ({ ...t, id: nuevoId() }));
  proyectos.push(copia);
  guardar();
  pintar();
}

function borrar(p) {
  if (!confirm(`¿Borrar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
  proyectos = proyectos.filter((x) => x.id !== p.id);
  guardar();
  pintar();
}

/* ---------- Importar / exportar ---------- */

$('#btn-exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(proyectos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agenda-proyectos-${hoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('#btn-importar').addEventListener('click', () => $('#input-importar').click());

$('#input-importar').addEventListener('change', async (ev) => {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  try {
    const datos = JSON.parse(await archivo.text());
    if (!Array.isArray(datos)) throw new Error('El archivo no contiene una lista de proyectos.');
    const modo = proyectos.length === 0 || confirm('¿Sumar los proyectos del archivo a los actuales?\nCancelar = reemplazar todo.');
    const nuevos = datos.map(normalizar);
    proyectos = modo ? proyectos.concat(nuevos) : nuevos;
    guardar();
    pintar();
  } catch (err) {
    alert('No se pudo importar: ' + err.message);
  } finally {
    ev.target.value = '';
  }
});

/* ---------- Tema ---------- */

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CLAVE_TEMA, tema);
}

$('#btn-tema').addEventListener('click', () => {
  aplicarTema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
});

aplicarTema(
  localStorage.getItem(CLAVE_TEMA) ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro')
);

/* ---------- Arranque ---------- */

$('#btn-nuevo').addEventListener('click', () => abrirDialogo());
[buscar, filtroEstado, orden].forEach((el) => el.addEventListener('input', pintar));

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'n' && (ev.metaKey || ev.ctrlKey)) {
    ev.preventDefault();
    abrirDialogo();
  }
});

pintar();
