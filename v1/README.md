# 📓 Agenda de Proyectos

Agenda personal para anotar y seguir tus proyectos. Es una página web de un solo
archivo abierto: no necesita servidor, ni instalación, ni cuenta. Todo se guarda
en el navegador (`localStorage`).

## Cómo usarla

Abrí `index.html` con doble clic en tu navegador. Listo.

Si preferís servirla localmente:

```bash
python3 -m http.server 8000
# luego abrí http://localhost:8000
```

## Qué podés hacer

- **Anotar proyectos** con nombre, descripción, estado (Idea / En curso /
  Pausado / Terminado), prioridad, fecha límite y etiquetas.
- **Agregar pasos o notas** dentro de cada proyecto y tildarlos; la barra de
  progreso se actualiza sola.
- **Buscar** por nombre, nota o etiqueta, y filtrar por estado.
- **Ordenar** por última edición, prioridad, fecha límite o nombre.
- **Ver de un vistazo** cuántos proyectos tenés, cuántos en curso, terminados y
  cuáles pasaron su fecha límite (se marcan en rojo).
- **Duplicar** un proyecto para reusarlo como plantilla.
- **Exportar / importar** todo a un archivo JSON, para hacer copia de seguridad o
  llevarlo a otra computadora.
- **Tema claro y oscuro** (arranca según la preferencia de tu sistema).

Atajo: `Ctrl/Cmd + N` abre el formulario de proyecto nuevo.

## Dónde quedan los datos

En el `localStorage` del navegador, bajo la clave `agenda-proyectos-v1`. Eso
significa que los datos son de ese navegador y esa computadora: si borrás los
datos de navegación, se van. Usá **Exportar** cada tanto para tener un respaldo.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Estructura de la página y plantillas |
| `styles.css` | Estilos, incluido el tema oscuro |
| `app.js` | Toda la lógica: guardado, filtros, render |
