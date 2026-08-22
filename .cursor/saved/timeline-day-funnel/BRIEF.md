# Timeline Day Funnel — vista por documento + planificación progresiva

**Status:** Brief acordado (2026-08-22). No implementado.  
**Complementa:** `.cursor/rules/timeline-product-model.mdc`, `TIMELINE_APLICADO.md`, `.cursor/rules/gina-capability-roadmap.mdc`, `.cursor/rules/assistant-premium-scheduling.mdc`  
**Stack:** Timeline táctico (`TacticalTimeline`), canvas wires, `timelineDocQueue`, lazy todos, Gina Phase 1.5 viz.

---

## Por qué existe

En un día común **sin tasks ni horarios**, el usuario no empieza eligiendo horas en un picker. Empieza pintando **qué quiere hacer**. Después surgen ideas, files, conexiones en canvas — y recién entonces decide **qué entra al timeline** y **a qué hora**.

Hoy Futura Nota resuelve bien **vista por folder** (v1): “¿cómo va cada cajón?”. Falta el lente complementario **vista por documento** (v2): “¿en qué orden ejecuto mi día aunque crucen folders?” — más canvas como mesa de planificación y Gina como seguimiento al día siguiente.

**Principio rector:** compromiso progresivo. Lista → file → canvas visual → insert timeline → schedule hora. Nada obliga a saltar al reloj desde el minuto uno.

---

## Problema que resuelve

| Hoy | Fricción |
|---|---|
| Timeline = filas por folder | Difícil ver el **hilo de ejecución** entre docs de distintos cajones |
| Insert = opt-in desde canvas | Correcto, pero no hay superficie para “mi lista del día” antes del insert |
| Gina `schedule_sheet` | Lista verbal del día en chat, no rail espacial unificado |
| Schedule picker en documento | Compromiso total de entrada; no hay “solo visual en canvas” claro |

---

## Visión en una frase

**Un embudo:** pintar intenciones → convertir en files → verlos en canvas → insertar al timeline cuando cuenten → poner hora file por file — con **una sola fuente de verdad** (`anchorAt` / `anchorFinishAt` por document) y **dos lentes** (v1 folder / v2 doc wire) + Gina encima.

---

## Embudo del día (Day Funnel)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DAY LIST          Intención — sin horario, sin timeline   │
│    “research, notas, borrador, publicar”                     │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FILES / IDEAS     Cada ítem puede volverse document       │
│    Status: null | flexible | reserved (sin hora aún)         │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CANVAS (visual)   Docs sueltos + wires doc↔doc            │
│    Modo libre — NO auto-insert al timeline                   │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. INSERT TIMELINE   “Esto sí cuenta para mi día”            │
│    → timelineDocQueue (opt-in, regla actual)                 │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SCHEDULE (hora)   Compromiso concreto — opcional por file │
│    anchorAt → anchorFinishAt en el document                  │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. DOS VISTAS        Mismo dato, distinta pregunta           │
│    v2: wire de docs  |  v1: filas por folder                 │
└─────────────────────────────────────────────────────────────┘
```

### Compromiso por capa

| Capa | Compromiso | Tiene horario | En timeline |
|---|---|---|---|
| Day list (lazy todo / pipeline) | Intención | No | No |
| File sin insert | Contenido / idea | Opcional | No |
| Canvas visual + wires | Orden lógico | Implícito vía wire/fecha nodo | No |
| Insert timeline | “Cuenta para el día” | Opcional | Sí |
| Schedule hora | Bloque concreto | Sí | Sí (chip posicionado) |

---

## Timeline v1 vs v2 (toggle)

**v1 — Por folder (live, no se quita)**

- Una fila por object/folder.
- Pregunta: *“¿Cómo va cada clase de trabajo?”*
- Docs apilados dentro de su fila; gaps entre folders ≥1 día no colapsan.

**v2 — Por documento (nuevo toggle)**

- Un carril (o fila “Pipeline”) con docs de **distintos folders** en secuencia.
- Pregunta: *“¿En qué orden ejecuto hoy?”*
- Chip muestra path gris: `Marketing / Blogs / Research`.
- Orden de render:
  1. `anchorAt` (reloj manda cuando existe)
  2. Topología de wires canvas (`intra-family-doc`, `cross-family-doc`)
  3. Orden manual en `timelineDocQueue` / drag en sidebar

```
v1 (folders):                v2 (doc wire):

Marketing ─── Sales           [10h Research]──[14h Draft]──[16h Publish]
  [doc][doc]    [doc]              ↑ Blogs        ↑ Research    ↑ Blogs
```

**Regla de sincronía:** un solo `anchorAt` por document. v1 y v2 leen lo mismo; no duplicar horarios.

---

## Canvas ↔ Timeline ↔ Gina

### Canvas = mesa de planificación

| Acción canvas | Efecto |
|---|---|
| Drop docs sueltos | Visual; no timeline hasta Insert |
| Wire doc → doc | Orden lógico; anchors vía `buildTacticalWireAnchorMap` |
| Nodo fecha / launch entre docs | Tiempo implícito en el grafo |
| Select + Insert to timeline | `timelineDocQueue` + snapshots |

Modos canvas existentes (`timelineStore.getEffectiveCanvasMode`): `free` | `queue` | `inherit-obj`. El funnel usa **`free`** para planificar y **`queue`** solo al insertar.

### Timeline = reloj visual

- v2 muestra la secuencia de ejecución.
- Click chip → abrir document (live).
- Insert **sin hora** → chip en rail con status `flexible` / sin `anchorAt`; hora después.

### Gina = seguimiento + ajuste (fase posterior al funnel UI)

| Intención usuario | Gina hoy | Gina target |
|---|---|---|
| “Horarios de hoy” | `schedule_sheet` | Igual + opcional viz tipo timeline |
| “Seguime el horario” | Narración + recovery | Mismo corpus que v2 |
| “Organizame lo que tengo hoy” | Parcial (cascade preview) | Batch: queue + anchors + confirm |
| Conflictos / atraso | `get_schedule_conflicts`, recovery | Premium: proponer slots |

**Hard rules Gina:** LIVE CORPUS ONLY · mutaciones solo con confirm · no editar body · alarmas = Gina, no timeline.

---

## Tres “listas” (no confundir)

| Lista | Qué es | Horario | Owner |
|---|---|---|---|
| **Day list** | Intenciones del día (lazy todo o day pipeline) | No | Usuario → funnel |
| **To-do del document** | Plan fino *dentro* de un file (roadmap Gina) | No — viene del doc schedule | Gina futuro |
| **Timeline queue** | Docs insertados que cuentan para el día | Opcional hasta schedule | Usuario + timeline |

El funnel empieza en la primera; solo al insertar entra en la tercera.

---

## User stories

### US-1 — Pintar el día sin compromiso
**Como** usuario con día vacío  
**Quiero** anotar en una lista lo que quiero hacer (sin horas)  
**Para** externalizar intenciones antes de crear files.

**Criterio:** lista editable; ítems sin `anchorAt`; no aparecen en timeline.

---

### US-2 — Promover ítem → file
**Como** usuario con ítem en la day list  
**Quiero** convertirlo en document (en folder existente o suelto)  
**Para** empezar a escribir sin obligarme a schedule.

**Criterio:** file creado; opcional link list item ↔ doc id; status `flexible` o null.

---

### US-3 — Canvas visual sin timeline
**Como** usuario planificando  
**Quiero** ver mis files en canvas y conectarlos con wires  
**Para** pensar el orden antes de comprometerme con el reloj.

**Criterio:** canvas en modo `free`; wires visibles; timeline vacío hasta Insert.

---

### US-4 — Insert gradual al timeline
**Como** usuario  
**Quiero** insertar file 1 al timeline, después file 2, etc.  
**Para** ir construyendo el día a mi ritmo.

**Criterio:** cada Insert añade a `timelineDocQueue`; file sin hora aparece en v2 sin posición horaria estricta (o al final del rail).

---

### US-5 — Schedule file por file
**Como** usuario con doc ya en timeline  
**Quiero** asignar hora solo al segundo, tercero… cuando esté listo  
**Para** no bloquear el día entero de entrada.

**Criterio:** picker del doc; v1 y v2 reflejan el mismo anchor al guardar.

---

### US-6 — Toggle v1 / v2
**Como** usuario  
**Quiero** alternar entre vista por folder y vista por documento  
**Para** gestionar por clase o por ejecución.

**Criterio:** toggle persistente; mismos docs; placement rules del product model intactas.

---

### US-7 — Folders existentes → v1 al día
**Como** usuario con docs en folders  
**Quiero** que al poner hora a un doc, la fila de su folder muestre el mismo schedule  
**Para** no mantener dos relojes.

**Criterio:** un `anchorAt`; v1 fila del folder padre muestra el chip; sin sync manual.

---

### US-8 — Gina organiza el día (premium, fase 2)
**Como** usuario premium  
**Quiero** decir “organizame lo que tengo hoy”  
**Para** que Gina proponga orden + horas en el timeline de docs.

**Criterio:** preview (`schedule_slot_picker` / cascade); confirm explícito; aplica queue + anchors; v1/v2 actualizan.

---

## Flujo ejemplo (día común)

**Mañana, sin horarios**

1. Abro lazy todo / day list → escribo: research demanda, notas del día, primer borrador, pulir, alarma.
2. Creo file “Research demanda” (folder Research o suelto).
3. Lo dejo en canvas; wire opcional hacia “Notas”.
4. **Insert** file 1 → aparece en v2 sin hora.
5. Creo “Primer borrador” → canvas → **Insert** → asigno **10:00–11:00**.
6. Tercer file → mismo patrón a las 14:00.

**Vistas**

- **v2:** `[Research] — [Notas flexible] — [10h Borrador] — [14h …]`
- **v1:** Research: `[Research 10h]` · Blogs: `[Borrador 10h]` · etc.

**Día siguiente con Gina**

- “¿Qué tengo hoy?” → `schedule_sheet` + mismo corpus que v2.
- Si atraso → recovery / cascade (live).
- “Organizame” (premium) → preview → confirm → rail lleno.

---

## Arquitectura técnica (mapeo al repo)

### Ya existe (reutilizar)

| Pieza | Archivo / store |
|---|---|
| Cola opt-in | `timelineStore.timelineDocQueue` |
| Insert desde canvas | `enqueueTimelineDocsFromCanvasNodes`, `App.jsx` |
| Filas por folder | `buildTacticalObjectRows` en `tacticalTimelineView.js` |
| Wires doc↔doc | `timelineGraph.js`, `buildTacticalWireAnchorMap` |
| Modos canvas | `getEffectiveCanvasMode()` |
| Lazy todos | `lazyTodosStore`, `LazyTodoDashboardOverlay` |
| Gina schedule | `schedule_sheet`, `buildCascadeSchedulePreview`, `schedule_slot_picker` |
| Status sin hora | `flexible`, `reserved`, reglas en `assistant-status-roadmap.mdc` |

### Construir

| Pieza | Notas |
|---|---|
| `timelineViewMode: 'folders' \| 'doc-wire'` | Store + persistencia UI |
| `buildTacticalDocWireRow` | Flatten markers; orden híbrido fecha/wire/cola |
| Toggle UI en panel timeline | Junto a controles tácticos existentes |
| Day pipeline UX | Lazy todo ↔ promote to doc ↔ queue state (opcional `dayPipelineItemId`) |
| Chips v2 con folder path | Reutilizar patrón `GinaHierarchyPath` |
| Drop / picker hora en rail (manual) | Escribe `anchorAt`; fase 3 |
| Gina `organize_today` family | Preview + confirm + batch apply; premium gate |

### No tocar / no regresionar

- Placement chronology (`timeline-product-model.mdc`)
- Opt-in insert (canvas solo ≠ timeline)
- Folder schedule no mutado desde document schedule
- Document status gates del picker
- Tombstones sync

---

## Orden de build

| Fase | Entregable | Depende de |
|---|---|---|
| **A** | Toggle v1/v2 + `buildTacticalDocWireRow` + render un carril | Bloque B timeline live |
| **B** | Promote day list → doc; estado “en canvas / en queue / scheduled” | Lazy todos o day pipeline mínima |
| **C** | Orden por wire en v2; chips con path folder | A + canvas wires |
| **D** | Insert sin hora visible en v2 (`flexible` / reserved) | A + status rules |
| **E** | Asignar hora desde rail (manual) | D |
| **F** | Gina “organizame hoy” → preview → confirm → queue + anchors | A + premium scheduling brief |
| **G** | Gina viz tipo timeline en chat (opcional) | F + Phase 1.5 |

**Gate:** Fases A–D usable sin Gina. F no antes de que “horarios de hoy” + manual report se sientan bien (`gina-shift-daily-report.mdc`).

---

## Non-goals (hasta brief explícito)

- Reemplazar v1 por v2
- Auto-insert al timeline al dropear en canvas
- Alarmas en el timeline (Gina las maneja)
- Mutar folder schedule desde document o desde Gina sin confirm
- To-do dictado dentro del doc (capability roadmap separado)
- Migrar off Supabase / reescribir sync

---

## Criterios de aceptación (MVP = Fase A–D)

- [ ] Toggle **Por folder / Por documento** persiste en sesión.
- [ ] v2 muestra docs de `timelineDocQueue` en un solo carril, cross-folder.
- [ ] Mismo doc con `anchorAt` aparece en v1 (fila folder) y v2 (posición horaria).
- [ ] Doc insertado sin hora visible en v2; no rompe v1.
- [ ] Wires cross-family entre docs queued influyen en orden v2 cuando no hay fecha.
- [ ] Click chip v2 abre document (paridad con v1).
- [ ] Canvas modo libre no inserta sin acción explícita Insert.
- [ ] Reglas same-day / multi-day gaps intactas (tests `tacticalTimelineView.test.js` extendidos).

---

## Relación con Gina capability roadmap

| Orden roadmap | Este brief |
|---|---|
| Find + abrir | Chip v2 abre doc — alineado |
| To-do del doc | Distinto de day list — no mezclar |
| “¿Qué sigue?” del día | Se alimenta de v2 + schedule_sheet |
| GCal reminders | Después de funnel estable |

---

## Referencias

- `TIMELINE_APLICADO.md` — Bloque A/B, flujo Insert
- `.cursor/rules/timeline-product-model.mdc` — placement, folder vs doc
- `.cursor/rules/docs-folders-terminology.mdc` — Documents = folders en sidebar
- `.cursor/rules/assistant-premium-scheduling.mdc` — ocupación global = premium
- `.cursor/saved/gina-system/PHASE_1_5_DATA_VISUALIZATION.md` — viz en chat

---

## Modelo sugerido para este plan

- **Recomendado:** Grok (50%)
- **Alternativa:** Auto
- **Motivo:** Multi-archivo (timeline + store + UI + Gina hooks), reglas de placement fáciles de regresar; conviene seguimiento largo del plan.
