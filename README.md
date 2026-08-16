# Agenda de Proyectos v2 — embudo con límite de WIP

App para **cerrar proyectos antes de abrir nuevos**. No es una lista de ideas:
es un embudo con reglas que la app hace cumplir.

La v1 (la lista simple con localStorage) quedó en la carpeta [`v1/`](v1/).

## Cómo usarla

```bash
npm install
npm run dev      # abrí la dirección que imprime
```

Para la versión definitiva, instalable en el celular:

```bash
npm run build    # queda en dist/
npm run preview
```

Desde el iPhone, abrila en Safari y tocá Compartir → "Agregar a inicio". Ahí
queda como app: pantalla completa, funciona sin internet y el sistema es mucho
menos propenso a borrarte los datos.

```bash
npm test         # 24 tests sobre las reglas de negocio
npm run typecheck
```

## Las pantallas

| Tecla | Pantalla | Para qué |
| --- | --- | --- |
| — | Captura | Barra fija arriba, siempre con el foco. Escribís, Enter, sigue lista para la próxima. Tecla `C` desde cualquier lado. |
| `1` | Hoy | Sólo los activos y sus próximas acciones, con las alertas arriba. Nada más. |
| `2` | Bandeja | Ideas sin evaluar y el modo Triage: una por vez, puntuás con las teclas `1-5` y decidís. |
| `3` | Todos | Filtros combinables y orden, incluido "días estancado". `/` te trae acá con el buscador enfocado. |
| `4` | Revisión | El wizard semanal: proyecto por proyecto, ¿sigue vivo?, ¿cuál es el próximo paso? |
| `5` | Cementerio | Lo descartado con su motivo. Buscable, y se puede revivir. |
| `6` | Métricas | Abiertas vs. cerradas, días hasta cerrar, tasa de descarte, racha, pausados. |
| `7` | Ajustes | Límite de activos, unidades, tema, respaldo y borrado total. |

## Cómo está organizado

| Carpeta | Qué hay |
| --- | --- |
| `src/dominio/` | Las reglas puras: tipos, score, estados, estancamiento, métricas. No sabe nada de bases de datos ni de pantallas. |
| `src/datos/` | Dexie (IndexedDB): el esquema, el repositorio que escribe, export/import. |
| `src/pruebas/` | Los tests, corriendo contra el Dexie real sobre una IndexedDB en memoria. |

La separación importa por una razón práctica: las reglas se pueden probar y
cambiar sin tocar la interfaz, y la interfaz no puede saltearse una regla
porque no es ella quien las decide.

## Las reglas, y dónde vive cada una

| Regla | Dónde |
| --- | --- |
| Máx. 3 activos (configurable) | `maquinaEstados.ts` → `validarTransicion` |
| Próxima acción obligatoria al activar | idem |
| Descartar exige motivo (10+ caracteres) | idem |
| Terminar exige aprendizaje (10+ caracteres) | idem |
| Qué transición de estado es válida | `maquinaEstados.ts` → `TRANSICIONES` |
| Estancado a los 10 / 21 días | `tiempo.ts` → `calcularEstancamiento` |
| `score = ((impacto × confianza) / esfuerzo) × 4` | `score.ts` |
| Nada se borra: se descarta y se revive | `repositorio.ts` → `cambiarEstado` |

## Tres decisiones que cambian el spec

**1. Los eventos viven en su propia tabla, no adentro del proyecto.**
El spec los ponía como campo del proyecto (`Proyecto.eventos`) y a la vez pedía
que "si borro un proyecto, los eventos quedan igual en el log global". Las dos
cosas juntas no se pueden: si el historial es una propiedad del proyecto, borrar
el proyecto se lo lleva puesto. Ahora `eventos` es una tabla aparte con
`proyectoId` adentro, y el borrado real no la toca. Hay un test que lo verifica.

**2. Los eventos de cambio de estado guardan `desde` y `hasta` como datos.**
El spec sólo tenía un `detalle` de texto. Para calcular la tasa de descarte
habría que leer ese texto y adivinar, y cualquier cambio de redacción rompería
las métricas históricas para siempre. Ahora el estado va como dato aparte.

**3. No todo evento cuenta contra el estancamiento.**
Si cualquier modificación reseteara el reloj, renombrar un proyecto lo haría
verse "vivo" sin haber avanzado nada — es decir, te dejaría hacerte trampa solo.
Sólo cuentan cambio de estado, pasos agregados o completados, próxima acción
definida y cierres. Editar el título o las etiquetas no. Hay un test para esto.

## Formato del respaldo

El export incluye proyectos, eventos y ajustes. El import es por merge:

- **Proyectos**: se cruzan por `id`; gana el que tenga `actualizadoEn` más
  reciente. Importar un backup viejo no pisa trabajo nuevo.
- **Eventos**: unión por `id`. Como el log nunca se edita, dos eventos con el
  mismo id son el mismo evento — importar dos veces no duplica nada.
- **Ajustes**: sólo se toman si localmente no hay nada configurado.

## Identidad visual

Panel de control, no landing. El color se usa sólo como señal, nunca de adorno:

| | | |
| --- | --- | --- |
| Grafito | `#101319` | fondo |
| Pizarra | `#191E27` | superficie |
| Turquesa | `#3DDBD9` | acción / interactivo |
| Ámbar | `#FFB020` | atención (estancado) |
| Rojo | `#FF5C5C` | bloqueo (sin próximo paso, vencido) |
| Verde | `#2FBF71` | en marcha |

El elemento distintivo es la **banda de estado**: la franja vertical en el borde
izquierdo de cada tarjeta. Te dice cómo está el proyecto de un vistazo desde
lejos, sin leer una palabra — y se pone roja apenas algo necesita atención.

Tipografías del sistema, con roles separados: sans para el texto, monoespaciada
para todo lo que sea número (scores, días, contadores), así se comparan en
columna. No usamos fuentes de Google a propósito: bajarlas de internet rompería
el "funciona 100% offline".

## Qué está verificado

Los criterios de aceptación del spec, probados en un navegador real:

1. Capturar es lo primero que tiene el foco al abrir — escribir y Enter
2. El cuarto activo se bloquea y ofrece pausar uno ahí mismo
3. Un activo sin próxima acción se ve rojo en Hoy: alerta, banda y texto
4. Descartar sin motivo de 10+ caracteres queda deshabilitado
5. Las métricas se leen del log (test unitario, incluso tras borrar el proyecto)
6. Exportar → borrar todo → importar deja todo idéntico (test unitario)
7. Recarga sin red después de la primera carga: sigue andando
8. Los datos sobreviven a cerrar y reabrir
