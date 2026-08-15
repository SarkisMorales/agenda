# Agenda de Proyectos v2 — embudo con límite de WIP

App para **cerrar proyectos antes de abrir nuevos**. No es una lista de ideas:
es un embudo con reglas que la app hace cumplir.

Estado: **fase 1 completa** — modelo de datos, reglas de negocio y persistencia,
con tests. Las pantallas vienen en la fase 2.

La v1 (la lista simple con localStorage) quedó en la carpeta [`v1/`](v1/).

## Cómo correr los tests

```bash
npm install
npm test        # 24 tests sobre las reglas de negocio
npm run typecheck
```

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

## Pendiente (fase 2)

Pantallas (Hoy, Captura, Bandeja, Todos, Revisión semanal, Cementerio,
Métricas), atajos de teclado, PWA offline e identidad visual.
