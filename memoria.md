# Futura Nota — Memoria de trabajo

Documento vivo para registrar problemas, cambios pedidos y resoluciones.  
Cuando menciones algo en el chat, lo trato como el **problema más reciente** y actualizo esta memoria.

---

## Cómo usar este archivo

1. **Problema activo** — Lo último que quieres resolver. Incluye contexto y cambios concretos que pides.
2. **Resueltos** — Cuando confirmes que algo quedó bien, lo muevo aquí con fecha y resumen de lo aplicado.
3. **Referencia** — Visión del producto, flujos de datos y docs del repo.

---

## Visión del producto (Futura Nota)

Futura Nota es una webapp cuyo objetivo primordial es ayudar a **emprendedores jóvenes que empiezan de cero** a obtener su primer negocio — y en general a cualquier persona que ya tenga una habilidad (cantar, un instrumento, deportes, manualidades, pintura, cerámica, tejer, etc.) y conectarla con un **producto ya hecho** que Futura vende en su propio marketplace.

### Terminología UI (no confundir en refs)

| Dicen / UI | Significa | Antes se llamaba |
|---|---|---|
| **Documento** | Unidad con schedule en canvas / timeline / editor | **Macronodo** |
| **Documents** (sidebar) | **Folders** — cajas/categorías que contienen documentos | Panel “documents” mal leído como lista de docs |
| **Folder** / caja / box | Contenedor en el sidebar Documents | — |

Regla: **macronodos = documentos**; **Documents (panel) = folders**. Regla Cursor: `.cursor/rules/docs-folders-terminology.mdc`.

### El software (note-taker orientado a eventos)

- Combinación de **Obsidian + Notion**, con **Google Search API** integrada en el espacio de trabajo.
- **Folder** = categoría/clase; **documento** = unidad de contenido dentro del folder (puede ir al timeline si tiene schedule).
- Un folder puede agrupar documentos; los documentos viven en canvas y, si están scheduleados, en el timeline con día + hora.
- Enfoque: **organizar trabajo en el tiempo** cuando el usuario quiere — sin forzar prisa.

### WHY — Schedule (producto)

Schedule **no es obligatorio**. Existe para cuando el usuario quiere **trackear proyectos en el timeline**: sentir organización, un límite de trabajo y un orden por folders (clases) + horarios.

| Estado | Qué siente el usuario |
|---|---|
| **Sin schedule** en el folder | Escribe sin rush, sin proyecto acotado — aprende, anota, toma su tiempo. |
| **Con schedule** en el folder | Reservó un rango de fechas (x → y). Los documentos **pueden** elegir día + hora **solo dentro de ese rango**. |
| **Más adelante** | Al insertar en el timeline puede activar recordatorio/alarma. |

**Reglas duras:**

1. Schedule se **reserva en el folder** (`scheduleStartAt` / `scheduleFinishAt`) — no se dispara suelto ni se inventa desde otros campos.
2. Sin reserva en el folder → no hay gate de fecha/hora en documentos; Save libre.
3. Con reserva → date/time del documento es **opcional**; si el usuario la pone, debe caer en el rango x–y.
4. `launchAt` de campañas / metadata **no es** Schedule de folder. No rellenar Schedule “a ciegas” desde `launchAt`.

### Librería y campañas

- La **Librería** entrega a los usuarios **campañas identificadas** por Futura.
- Meta del usuario: *"Ellos lanzan la campaña de su producto target; tú lanzas la taza"* — montarse en la ola del lanzamiento ajeno.
- Los documentos incluyen **fecha de anuncio** y **fecha de lanzamiento** para entender el **scope temporal** y planificar qué construir encima de ese producto.

### Pipeline admin → app

```
Horizon Scan / Campaign Detector  →  cola (signal_campaigns, status: pending)
        ↓ Publish to Signals
hero_signals (múltiples active OK)  →  Hero + Librería (selector)
        ↓ usuario elige campaña
Objeto corpus + cadence local      →  Launch Radar (datos curados primero, Groq fallback)
```

**Migración SQL requerida** (Supabase → SQL Editor, en orden):

0. **Error al guardar `announcement_date` / PGRST204** → [`supabase_signal_campaigns_repair.sql`](supabase_signal_campaigns_repair.sql) (solo ALTER columnas; 30 s)
1. [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql) — `signal_campaigns` + `hero_signals` (proyecto nuevo)
2. [`supabase_intel_columns.sql`](supabase_intel_columns.sql) — columnas intel
3. [`supabase_intel_scan_sources.sql`](supabase_intel_scan_sources.sql) — fuentes curadas (opcional)
4. [`supabase_plans.sql`](supabase_plans.sql) — tabla `profiles` (plan free/pro; sin esto: `PGRST205` en consola)

---

## Problema activo

**Próximo Gina:** Phase 1.5 viz + polish scope (live corpus / tiempo) — **hecho en código**. Canon: [`06_TIME_SCOPE_AND_LIVE_CORPUS.md`](public/Assistance-context/06_TIME_SCOPE_AND_LIVE_CORPUS.md). Google Calendar = después.

**Gina narración visual:** path UI `/` gris; mensaje verbal; solo departamentos del inventario.

**Moodboard LEGO — brief acumulando (2026-07-24)** — Visión board (frames L/M/S, nota, files Drive, tags linkables) antes de Studio. No implementar a ciegas desde el CURSOR_BRIEF de Claude (asume Next.js).

- Brief canónico: [`.cursor/saved/moodboard-lego/CURSOR_BRIEF.md`](.cursor/saved/moodboard-lego/CURSOR_BRIEF.md)
- Regla Cursor: `.cursor/rules/moodboard-lego-brief.mdc`
- Producto: Futura = predicción / planificación de lo siguiente; Moodboard = tablero de visión (no note-taker genérico).
- Mantener moodboard legacy 2-imgs; Studio **después** de Moodboard.
- Imágenes = upload local; documents/files = Google Drive `file_id` + abrir `/view` (MVP).
- Pendiente usuario: SVGs/tokens del tag @INFO, copy tabla, confirmar slash `/moodboard` vs legacy.

**Menciones @tag en text area: índice no abría + caret/gap roto (2026-07-20)** — Al escribir `@blogs` en el área de escritura de un documento, el menú de tags (índice) no aparecía; con una mención insertada el texto no seguía alineado en la misma línea y el text area se veía con un gap enorme.

- Causas:
  1. `SlashAwareTextarea` interno leía `textareaRef.current`, pero `NodeWritingBlockStack` pasa `inputRef` como **callback ref** (sin `.current`) → `syncMentionQuery`/`syncHeight`/ghost no encontraban el textarea y el menú `@` nunca abría en documentos.
  2. Estado React `focused` quedaba stale cuando el campo se enfoca programáticamente (focusBlockById, remounts) → menú bloqueado aunque el usuario escribía.
  3. `.doc-slash-field__mention { font-weight: 600 }` — el bold cambia el ancho de los glifos en el mirror pero el texto invisible del textarea sigue normal → el texto tras la mención se desalinea, el wrap difiere entre capas y el caret “se rompe” (gap visual).
- Fix: ref dual (interno + forward a callback/objeto); `syncMentionQuery` deriva focus del DOM (`document.activeElement`) y auto-corrige `focused`; chip de mención sin bold (color + fondo suave, mismas métricas); la mención guarda snapshot de `url` y el hover card muestra el link clickeable (click en el chip con el campo sin foco abre la URL).
- Archivos: `SlashAwareTextarea.jsx`, `docMentions.js`, `DocMentionHoverCard.jsx`, `left-panel.css`.
- Nota producto: `@tag` = mención inline de una entrada del URL table de la compañía (chip rosado en la misma línea, texto sigue fluyendo). `/link` sigue siendo el bloque LINK_VAULT (card grande) — para links inline usar `@`.

**Seguimiento menciones: hover, Enter/merge y scope folders vs documentos (2026-07-20)**

- Hover card con el campo enfocado: el mirror es `pointer-events: none` mientras se escribe, así que el hover se resuelve con hit-test de los rects de los chips en `mousemove` del wrap (funciona enfocado y sin foco). El card muestra description + link siempre.
- Enter / Backspace ya no “deshabilitan” el `@`: `insertNewlineAtCaret` desplaza los rangos de mención con `applyTextEditToMentions`, y el merge de celdas (Backspace al inicio) usa `mergeMentionBlocks` — antes el texto se movía sin los rangos y `normalizeMentions` descartaba la mención (quedaba texto plano).
- **Scope (regla de producto)**: los **folders** solo lidian con links / crear-linkear macronodos (`FOLDER_SLASH_COMMANDS`); los **documentos** tienen el toggle completo de comandos (h1, slash, `@`). Por eso `DocBlockStack` solo expone candidatos `@` si su surface de slash incluye `/tag` (`insertTagMention`) — en folder boxes el `@` queda como texto plano y el menú no abre. El área de escritura de documentos (`NodeWritingBlockStack`) mantiene `@` completo.
- Archivos: `SlashAwareTextarea.jsx`, `NodeWritingBlockStack.jsx`, `DocBlockStack.jsx`.
- Click en el chip `@tag` (**funciona con el campo enfocado o sin foco**) → abre el dashboard del URL table dueño de la entrada (`sourceEntryId`, fallback por tag) con el tag ya pegado en el search bar (filtro en vivo, se ejecuta solo). Ya **no** abre la URL externa. Plomería: `setUrlTableOpenCallback`/`requestUrlTableOpen` en `urlTableSession.js` (App lo registra y setea `session.initialSearch`), helper `openUrlTableForMention` en `lib/docMentionActions.js`, overlay lee `initialSearch` al abrir.
- Detalle técnico del click: el mirror es `pointer-events: none` con el campo enfocado, así que el `onMouseDown` en el span nunca disparaba enfocado (el click "hacía otra función": colocar el caret). Ahora el `mousedown` del wrap hace hit-test de los rects de los chips (`findMentionSpanAtPoint`, mismo helper que el hover) y si cae en un chip abre la tabla en vez de mover el caret. Click en texto normal sigue colocando el caret.
- Comportamiento de link (decisión usuario 2026-07-21): el chip **no** lleva raya baja por defecto — solo en hover aparece el subrayado (`.doc-slash-field__mention--hovered`) + cursor pointer (`.doc-slash-field--chip-hover .doc-slash-field__input`), como un link normal. Click = abre la tabla.
- Hover card simplificado: solo icono Info (aclarado con `filter: brightness(0) invert(0.85)`) + "Description" + tag + descripción. Sin link de URL ni botón de tabla (decisión del usuario 2026-07-20). Delay-close ~220ms para que el card no parpadee.

**Canvas inventaba schedule desde Created (2026-07-20)** — Al insertar un documento sin Schedule, el chip mostraba `schedule: mm/dd/yyyy | 12:00 PM` (Created a mediodía).

- Causa: `resolveBlockAnchorFields` usaba Created como fallback de date; `isoFromAnchorFields` default time `12:00`; canvas leía `entity.anchorAt` sin chequear reserva del folder.
- Fix: Created ≠ Schedule. Sin reserva en folder → no date/time en save, strip al insertar, canvas solo muestra schedule explícito con folder reservado.
- Archivos: `nodeAnchor.js`, `temporal.js`, `canvas.jsx`, `App.jsx`, `StandaloneNodeModal.jsx`, `DocExpandedView.jsx`.

**Schedule a ciegas + gate obligatorio (2026-07-20)** — El producto trataba `launchAt` como reserva de folder y bloqueaba Save de documentos sin fecha/hora.

- **Why real:** Schedule solo cuando el usuario reserva x→y en el folder; sin eso = escritura libre. Docs eligen date/time opcional dentro del rango; recordatorios después en timeline.
- **Por qué se insertaba a ciegas:**
  1. `resolveFolderScheduleRange` hacía fallback `scheduleStartAt \|\| launchAt`.
  2. Al crear folder: `scheduleStartAt: data.scheduleStartAt ?? data.launchAt` (y finish igual).
  3. Al abrir folder: draft de Schedule se rellenaba desde `launchAt`.
  4. Con “reserva” falsa → `confirmChildScheduleOrDiscard` obligaba date+time al guardar docs.
- Fix: reserva = solo `scheduleStartAt`/`scheduleFinishAt`; quitar fallbacks a `launchAt`; Save de docs sin forzar schedule.
- Archivos: `folderScheduleReservation.js`, `LeftPanel.jsx`, `DocExpandedView.jsx`, `StandaloneNodeModal.jsx`, `NodeQueryModal.jsx`.

**Documentos en folders no se guardan / no aparecen en sidebar (2026-07-20)** — Al crear documentos (links/hijos) dentro de un folder, a veces desaparecían del sidebar tras hydrate/reload.

- Causa: `mergeEntityMapsPreferNewer` solo conservaba local-only si `createdAt > lastSyncedAt`, pero Created usa `isoFromDateInput` (mediodía) y `lastSyncedAt` es wall-clock → los docs nuevos del día se descartaban. Además el create de documento no hacía flush inmediato (los folders sí).
- Fix: merge usa `max(updatedAt, createdAt)`; `StandaloneNodeModal` hace `flushPersistenceSync()` tras create.
- Archivos: `persistenceMiddleware.js`, `StandaloneNodeModal.jsx`.

**Campaign docs → timeline source (2026-07-18)** — En Campaigns, el folder es contenedor; cada documento (node) tiene `active|inactive` + `launchAt` + window. Timeline row 1 = folder + launch del **source** active; micro-iniciales bajo el folder; expand = switch de source (solo active). Insert canvas de un doc active lo setea como source.

Archivos clave: `campaignDocSource.js`, `nodesStore`, `timelineStore`, `tacticalTimelineView`, `canvasDocSync`, `StandaloneNodeModal`, `TacticalTimeline`.

**Campaign folders = regular folders + Created date (2026-07-17)** — Sección Campaign (parcialmente supersedido por source launch):

1. Expand de hijos (macronodos) igual que folders de Content.
2. Fallback de fecha del chip = `createdAt` si no hay source active con launch.

Archivos: `LeftPanel.jsx`, `timelineGraph.js`, `timelineDocSnapshot.js`, `tacticalTimelineView.js`, `campaignTimelineRail.js`.

**Document expand width 980px (2026-07-13)** — Al expandir un documento (ex-macronodo), objetivo final 980px; verificación en **920px** (mismo footprint que folder).

- Runtime: toggle `contentFocusMode` sí dispara (logs hyp A); `embedded=false`.
- CSS de overlay `--content-focus` sí está servido por Vite (`min(920px,…)`).
- Fix defensivo: width/max-width en `.lp-modal.node-query-modal.node-query-modal--content-focus` (como folder) + `flex: 0 1 auto` (antes `flex:1` + `width:100%` podían pelear con el cap).
- Archivo: `src/styles/left-panel.css`. Instrumentación sigue en `NodeQueryModal.jsx`.

**Macronode title ↔ folder H1 sync (2026-07-13)** — El título del nodo de color y el del documento/H1 divergían (ej. chip `( modified)` vs doc sin ese sufijo).

- Causa: rename en canvas/Standalone actualizaba `nodesStore` pero no llamaba `syncNodeToParentDoc`; abrir desde H1 leía el block stale; content-focus ocultaba Save.
- Fix: sync en canvas + live title en Standalone; H1/TODO/DATE/METRIC en folder empujan al nodo; al abrir folder se reconcilián títulos desde el nodo (`reconcileLinkedBlockTitlesFromNodes`); modal desde H1 prefiere título del nodo.
- Archivos: `App.jsx`, `StandaloneNodeModal.jsx`, `DocExpandedView.jsx`, `DocBlockStack.jsx`, `docNodeSync.js`.

**Folder title → left panel sync (2026-07-13)** — Renombrar un Folder no actualizaba el label del Documents sidebar.

- Causa: el título solo vivía en draft hasta Save; el left panel lee `docsStore.doc.title`. En content-focus Save está oculto.
- Fix: `persistFolderTitleToStore` en content mode (title+category → `updateDoc` en vivo, como Schedule) + snapshot sync para no marcar unsaved; fallback `title || category` en `resolveProductDocDisplayTitle`.
- Archivos: `DocExpandedView.jsx`, `templateDoc.js`.

**Folder boxes UX (2026-07-09)** — Reorganizar sidebar para reducir estiramiento del canvas:

- Panel **Documents** → **Folder**; cajas con icono `box-closed.svg`; collapse muestra documents (ex-nodes).
- `[+] new` en Folder → crea **box** (doc). Dentro de caja / Loose → **create document** + auto-insert nodo de color en siguiente celda del canvas.
- Panel **Nodes** → **Loose documents** (solo huérfanos).
- Meta: `n documents` · ↳ compañía.

---

### Management panel `/panel` (implementado 2026-06-26)

Tab **Management** en Admin: catálogo APIs (estado env), KPIs, pie charts (Recharts), tabla usuarios (fase 1: cuenta admin Futura Nota), recent calls desde `api_usage_events`. SQL: [`supabase_management.sql`](supabase_management.sql). Seed: `npm run seed:management`. Instrumentación: Intel overview + campaign study.

**Pendiente:** créditos sidebar 0/150 sin descuento visible (problema aparte).

### Campaign Detector — pipeline verificado 2-pass (implementado)

**Pass A:** Serper + Groq extract-only → `confirmed_campaign` (confidence ≥ 80).  
**Pass B:** si no hay campaña → búsqueda de cadencia histórica → `cadence_only` (≥ 70) + proyección JS desde hoy.  
**Estados cadencia:** `watch` (mantener pendiente, ≤4 meses o ≤ rangeDays/30) · `discard` (ventana larga) · `no_data`.

Archivos clave: [`server/brandCampaignIntel.js`](server/brandCampaignIntel.js), [`server/cadenceProjection.js`](server/cadenceProjection.js).  
Horizon Scan excluye `discard` de la lista principal; las muestra en `meta.cadenceDiscardedBrands`.

**Estado:** Implementado — probar con `SERPAPI_KEY` + `GROQ_API_KEY`.

### Fase A+B — Detector Groq + fuentes curadas (implementado)

**Fase A — Contexto Groq:** [`content/admin/detector-de-campanas.md`](content/admin/detector-de-campanas.md) (Matriz 1 innovación/look, Matriz 2 pain point/solución). Cada Horizon Scan inyecta ese texto en el prompt de usuario vía [`server/scanIntelContext.js`](server/scanIntelContext.js) → `buildGroqUserPrompt()`.

**Fase B — Fuentes curadas:** seed [`content/admin/scan-sources.json`](content/admin/scan-sources.json); tabla [`supabase_intel_scan_sources.sql`](supabase_intel_scan_sources.sql); dual pass Serper (`site:` + web abierta) en [`server/horizonScanHandler.js`](server/horizonScanHandler.js). Admin: pestaña **Scan Sources** en `/panel`; Horizon Scan envía fuentes activas en el POST.

**Estado:** Implementado — probar con `SERPAPI_KEY` + `GROQ_API_KEY`. Ejecutar SQL de scan sources si querés CRUD en Supabase (sin SQL usa el seed JSON).

### Horizon Scan — datos verificados (Fase 1+2)

- Serper obligatorio; sin INVENT/mock.
- `confirmed_campaign` confidence ≥ **80**; `cadence_only` ≥ **70**.
- Overview real del snippet; cadencia solo si no hay anuncio.
- SQL intel: [`supabase_intel_columns.sql`](supabase_intel_columns.sql)

**Estado:** Implementado — probar con SERPAPI_KEY + GROQ_API_KEY.

---

## Resueltos

### 2026-07-05 — Cmd+A documentos: patrón Notion/Obsidian + selección in-place

**Problema:** Cmd+A seleccionaba TODOs o abría un textarea overlay separado; no se podía copiar H1+body al portapapeles de forma natural.

**Comportamiento final (Fase 2):**

| Acción | Resultado |
|--------|-----------|
| 1× Cmd+A en H1 o TEXT | Nativo: solo ese campo |
| 2× Cmd+A (campo ya seleccionado) | Todo el doc copiable, **highlight en los mismos bloques** (sin overlay/tab) |
| Cmd+A en TODO | Nativo: solo ese ítem |
| Cmd+C en modo selección doc | `collectCopyableDocPlainText` (H1 + body; sin TODOs ni macro-answer oculto) |

**Incluye en copia:** títulos H1 (también vinculados — solo texto, sin handle verde).  
**Excluye:** TODOs, `macro-answer` oculto, embeds.

**Implementación técnica:**
- `src/lib/docSelectAll.js` — `tryDocSelectAllKeyDown`, `activateDocInPlaceSelectAll`, `clearDocInPlaceSelectAll`
- Espejos tipográficos (`doc-inplace-select-mirror`) sobre cada textarea; texto del campo transparente; `::selection` en foco
- `src/lib/docProseUnified.js` — `isCopyableDocTextBlock`, `collectCopyableDocPlainText`
- `DocBlockStack.jsx` — Cmd+A solo en H1 (`handleLinkableBlockKeyDown`) y TEXT; **no** en TODO
- CSS: `.doc-inplace-select-*` en `left-panel.css`

**Fase 1 (editor unificado `UnifiedProseBlockView` en docs):** implementada y **revertida** — rompía Enter multilínea H1 (`memoria.md` 2026-06-26), links de color y partía título en vertical. Se mantienen `docProseUnified.js` + `UnifiedProseBlockView.jsx` en repo para fase futura; render actual = H1 + TEXT por bloque.

**Tests:** `docSelectAll.test.js`, `docProseUnified.test.js`.

### 2026-07-05 — Agente Content Creator: duplicaba link/título en doc padre (Fase 3)

**Problema:** Al activar un agente en un macronodo vinculado y pedirle que llene el documento, el contenido se integraba en el nodo pero **duplicaba el link verde + título** al final del documento padre en lugar de **sobrescribir** el macronodo existente.

**Causas:**
1. `syncNodeToParentDoc` — sin `sourceBlockId` en la entidad, hacía **append** de H1+TEXT nuevos.
2. `applyBlogToMacroNode` — inyectaba `createInlineH1Block(headline)` aunque el título canónico ya está en el H1 del doc.

**Fix:** [`nodesStore.js`](src/stores/nodesStore.js) resuelve bloque por `nodeId`; [`applyBlogToMacroNode.js`](src/lib/agents/applyBlogToMacroNode.js) macro vinculado = solo body en nodo, headline → `sourceQuery`, overwrite tras `/agent`.

**Tests:** `applyBlogToMacroNode.test.js`.

### 2026-07-05 — Agente Content Creator: API 500 en cuentas free (Vercel)

**Síntoma:** `/api/agents/content-creator` → `500 FUNCTION_INVOCATION_FAILED` en cuenta free de prueba; cuenta personal OK.

**Causas probables:**
- Crash del serverless (Groq timeout, prompt grande, body JSON mal parseado) sin fallback.
- Tabla `profiles` ausente → créditos en memoria default pero débito fallaba post-API.

**Fix:**
- `runContentCreator` (server) — try/catch total; siempre devuelve plan (Groq o fallback).
- Handler Vercel — `parseJsonBody`; en error extremo responde **200 + fallback**, no 500.
- `llmJson` — timeout Groq 22s (bajo límite Vercel 30s).
- `vercel.json` — `includeFiles: content/agents/**` para prompts.
- `planStore.debitCredits` — si falta tabla `profiles`, débito local en memoria.

**Verificar en cuenta free:** ≥3 créditos (cada agente cuesta 3); ejecutar SQL `supabase_plans.sql` + `supabase_plans_tokens.sql` si créditos no persisten.

---

### 2026-06-26 — Enter en bloque H1: multilínea dentro del título (sin pasar a body)

**Problema:** Al pulsar Enter en un H1 (`/title`), el comportamiento era incorrecto en cadena:
1. Placeholder H1 vacío visible mientras el texto quedaba en body abajo.
2. Enter partía el título y lo **movía al bloque TEXT** (pierde estilo H1).
3. Enter solo **bajaba el cursor** al body; el texto del H1 no se movía ni se partía en la misma celda.

**Comportamiento deseado (confirmado por usuario):** Enter debe actuar **dentro del H1** — insertar salto de línea en `block.title`, partiendo o bajando el texto en la misma celda multilínea. El título **no** debe convertirse en body text.

| Posición del cursor | Resultado |
|---------------------|-----------|
| Inicio del título | Línea vacía arriba; el texto **baja** a la segunda línea del H1 |
| Medio del título (línea con texto) | Parte en dos líneas **dentro del H1** (ej. `Nuevo ` / `doc`) |
| **Final del título** o **línea vacía** dentro del H1 | El título **permanece en H1**; el foco baja al párrafo **TEXT regular** de abajo |
| H1 vacío + Enter | Baja al párrafo TEXT de abajo; elimina H1 vacío (salvo `nodeId` o par `/embedvideo`) |

**Archivo principal:** [`src/components/docs/blocks/DocBlockStack.jsx`](src/components/docs/blocks/DocBlockStack.jsx)

#### Pasos implementados en código

1. **`insertNewlineAtCaret(blockIndex, e, field)`** (ya existía, ~L660):
   - Inserta `\n` en la posición del caret.
   - Con `field: "title"` actualiza `block.title` vía `updateBlockAt` + `setBlocks`.
   - **No** llama `syncAnswerBelowH1` (solo aplica a `field === "text"`).
   - Reposiciona el caret en la nueva línea con `focusBlockCaret` + `scrollCaretAfterNewline`.

2. **`removeEmptyH1AndFocusBody(h1Index)`** (~L823):
   - Caso excepcional: H1 sin texto + Enter.
   - Si tiene `nodeId` o hermano `VIDEO_EMBED` → `insertTextAfter(h1Index, "")` (foco al body sin borrar H1).
   - Si no → `removeBlockAt(h1Index)`, asegura cola TEXT writable, foco al párrafo de abajo.

3. **`handleLinkableBlockKeyDown` — rama H1 + Enter** (~L873–900):
   - Eliminada la lógica anterior de split `head`/`tail` → body y `handleH1Enter` / `demoteH1TailToBody` / `focusBodyBelowH1`.
   - **`handleH1EnterKey`** decide entre partitura interna vs salida al body:
     - `shouldExitH1ToBodyOnEnter(title, caret)` → `true` si el caret está al **final del string** o en una **línea vacía** del título → `exitH1ToBodyBelow` (guarda título en H1, foco en TEXT abajo).
     - Si no → `insertNewlineAtCaret(index, e, "title")` (parte dentro del H1).
   - **H1 vacío:** `removeEmptyH1AndFocusBody(index)`.
   - **H1 + VIDEO_EMBED:** si el video no está guardado → foco al input URL; si está listo → misma lógica `handleH1EnterKey`.

4. **Helpers añadidos** (~L679–715):
   - `isCaretOnEmptyH1Line` — detecta línea vacía en título multilínea.
   - `shouldExitH1ToBodyOnEnter` — final del string o línea vacía.
   - `exitH1ToBodyBelow` — persiste título (sin `\n` finales) + `insertTextAfter(h1Index, "")`.

5. **UI H1 multilínea:** [`H1BlockView.jsx`](src/components/docs/blocks/H1BlockView.jsx) ya usa `SlashAwareTextarea` con `multiline` en `DocQueryHandleRow` — los `\n` en `title` se renderizan en el mismo bloque H1.

#### Qué se descartó (iteraciones previas en la misma sesión)

- Enter → `insertTextAfter` con tail en TEXT (convertía H1 en body).
- Enter → solo foco al body manteniendo título estático (cursor bajaba, texto no).
- Blueprint Fase 1 (`pruneEmptyBlocks`, Enter estilo Notion en TEXT) — **revertido** a petición del usuario; no forma parte de esta resolución.

#### Verificación manual

1. `/title` → escribir `Nuevo doc` → Enter al inicio → texto baja una línea, sigue en H1.
2. Cursor antes de `doc` → Enter → `Nuevo ` arriba, `doc` abajo, ambos H1.
3. `Nuevo doc` → Enter **al final** → título queda en H1; cursor en celda TEXT regular abajo.
4. H1 vacío → Enter → foco en body, sin placeholder H1 huérfano (sin nodo vinculado).

**Blueprint de referencia (auditoría más amplia, no aplicada):** [`.cursor/plans/notes_block_architecture_fix_053c776f.plan.md`](.cursor/plans/notes_block_architecture_fix_053c776f.plan.md)

### 2026-06-25 — Selector modelo Intel + créditos por consumo

**Feature:** Dropdown en Intel (Gemini Flash/Pro, Groq Llama 70B/8B). Costo 1–2 créditos/búsqueda; Pro `0/150`, Free `0/10`.

**Archivos:** [`server/intelModels.js`](server/intelModels.js), [`src/components/intel/IntelModelSelect.jsx`](src/components/intel/IntelModelSelect.jsx), [`server/intelOverviewHandler.js`](server/intelOverviewHandler.js), [`server/llmJson.js`](server/llmJson.js) (`completeJsonForProvider`).

### 2026-06-25 — Campaign Intel simplificado (plantillas + overview inline)

**Problema:** Campaign tab usaba pipeline deep (`campaign-detect`) → doc automático y panel vacío; search “no devolvía nada”.

**Solución:** Plantillas en [`content/admin/campaign-search-starters.json`](content/admin/campaign-search-starters.json) + mismo flujo que News (`runIntelSearch` → `/api/intel/overview`) → overview + sources **inline** en Campaign tab.

**Archivos:** [`src/lib/campaignSearchStarters.js`](src/lib/campaignSearchStarters.js), [`src/panels.jsx`](src/panels.jsx), blueprint [`campaign-search-simple.md`](.cursor/skills/architect-blueprint/references/campaign-search-simple.md). Deep scan (`runCampaignScanForCorpus`) queda para admin/legacy.

### 2026-06-25 — `/api/translate` 500 (Google Translation API bloqueada)

**Problema:** Al cambiar idioma a ES, `POST /api/translate` devolvía 500. Logs: Google HTTP **403** — `TranslateService.TranslateText are blocked` (Cloud Translation API no habilitada o key restringida en GCP).

**Cambios:**
- [`server/translateHandler.js`](server/translateHandler.js) — fallback **passthrough** (200 + texto original) si Google falla; sin fallback a `GEMINI_API_KEY`.
- [`api/translate.js`](api/translate.js) — función Vercel en la ruta que usa el cliente.
- [`api/analytics/translate.js`](api/analytics/translate.js) — re-export del handler canónico.

**Para traducción real:** en GCP → APIs & Services → habilitar **Cloud Translation API** → API key con acceso a esa API + billing activo.

### 2026-06-25 — Forecast Intel + planes (límites, anti-bot, OpenWeather)

Implementación completa del tab **Forecast** en Intel con límites Free/Pro, contador de nodos, anti-bot de ciudad silencioso, caché OpenWeather y UX de búsqueda/inserción en canvas.

#### Límites de producto (canónico — `src/lib/planConfig.js`)

| Recurso | Free | Pro | ¿Visible en UI? |
|---------|------|-----|-----------------|
| **Insert node** (canvas) | **2** lifetime (`weatherNodeActionsCap`) | **50** lifetime | Sí — footer `0/2` · `0/50` |
| **Cambio de ciudad** (input Enter/Set/geo) | **5** / día (`weatherCityChangesCap`) | **50** / día | No — anti-bot silencioso; mensaje solo al tope |
| **Ver panel** 5–6 días | Ilimitado | Ilimitado | — |
| **Search preview** (botón lupa) | Ilimitado | Ilimitado | — |

- Cooldown entre cambios de ciudad **distintos:** 3 s (`WEATHER_CITY_COOLDOWN_MS`).
- **Misma ciudad** re-aplicada: no cuenta ni cooldown ni revisión de panel (`locationRevision` no sube).
- Panel auto-refresh cada 45 min + medianoche ciudad (`fresh=1`) **no** consume contador de nodos ni de ciudad.

#### Qué cuenta como “call” de negocio vs coste OpenWeather

| Acción | Contador nodos | Anti-bot ciudad | OpenWeather real |
|--------|----------------|-----------------|------------------|
| Enter / Set / geo (ciudad nueva) | No | Sí (+1/día) | Sí si cache miss (~45 min/ciudad) |
| Ver panel / refresh | No | No | Reusa cache |
| Search forecast nodo | No | No | Reusa cache diaria del panel |
| **Insert node** | **Sí (+1)** | No | **No** (solo escribe payload en canvas) |

#### Archivos clave

| Área | Archivos |
|------|----------|
| Límites plan | `src/lib/planConfig.js` — `weatherNodeActionsCap`, `weatherCityChangesCap`, `getPlanFeatureRows()` |
| Ledger nodos | `src/stores/planStore.js` — `weatherActionsCount`, `incrementWeatherAction()`, `resetWeatherActions()` |
| Anti-bot ciudad (cliente) | `src/lib/weatherCityRateLimit.js` — daily localStorage + cooldown |
| Anti-bot ciudad (servidor) | `server/weather/locationRateLimit.js` — header `X-Futura-City-Apply: 1` |
| Ubicación | `src/stores/weatherLocationStore.js` — `setManualCity`, `setGeolocation` |
| Panel | `src/components/intel/ForecastPanel.jsx`, `src/lib/forecastPanel.js` |
| Search + insert | `src/components/intel/ForecastSearchFooter.jsx`, `src/lib/forecastSearch.js` |
| Picker ciudad | `src/components/intel/ForecastLocationPicker.jsx` |
| API + cache | `server/weatherHandler.js`, `server/weather/openWeather.js`, `server/weather/weatherCache.js` |
| Refresh panel | `src/lib/forecastRefresh.js` (45 min + medianoche TZ ciudad) |
| i18n | `src/i18n/messages.js` — `forecastSearchInstruction`, `weatherActionLimit*`, `weatherCityChange*` |
| SQL perfil | `supabase_weather_actions.sql` — columna `weather_actions_count` |
| SQL cache | `supabase_weather_cache.sql` |

#### UX implementada

- **Instrucción onboarding** (`forecastSearchInstruction`): solo si el usuario **nunca insertó** un nodo forecast (`futuranota-forecast-node-inserted` en localStorage). Tras primer Insert node desaparece.
- **Footer search:** botón deshabilitado hasta ciudad + panel ready + nodo en ventana; hint dinámico (loading, past, outOfRange, ready).
- **Contador nodos** siempre visible en footer (`formatWeatherActionCounter`).
- **Panel:** solo hora `as of H:MM AM/PM` — eliminado copy OpenWeather compare.
- **Límite nodos Pro:** mensaje inline, **sin** modal upgrade. Free: modal upgrade + mensaje.
- **Límite ciudad:** mensaje inline al tope diario; Free también puede ver modal upgrade vía `reasonWeather`.

#### Persistencia contador nodos

- Logueado: `profiles.weather_actions_count` (+ legacy `weather_used`).
- Anónimo / fallback: `localStorage` `futuranota-weather-actions-used`.
- Al `fetchProfile`: DB es source of truth; sync a localStorage (no merge max local→DB).

#### Dev / reset

```js
await window.__resetForecastUsage() // solo dev — limpia nodos + ciudad + reload
```

Definido en `src/router.jsx`; llama `planStore.resetWeatherActions()`.

#### Env servidor

- `OPENWEATHER_API_KEY` — obligatorio en dev real (sin key → `503 openweather_not_configured`).
- `FUTURA_SUPABASE_SERVICE_ROLE_KEY` — cache global Supabase 45 min (sin esto: cache in-memory por proceso).

#### Pendiente al unificar plan completo

- Alinear fila **Weather** en tabla “Límites objetivo” abajo (hoy dice “1 uso / ilimitado” — **obsoleto**).
- `weatherUsesAllowed` / `weather_used` legacy — conviven con `weather_actions_count`; considerar deprecar en copy Stripe/pricing.
- Rate limit servidor es in-memory por proceso — en multi-instancia Vercel usar Redis/Upstash si hace falta enforcement global.

---

### 2026-06-25 — Weather forecast: mock idéntico para todas las ciudades

- **Causa:** sin `OPENWEATHER_API_KEY` en el proceso del middleware, el servidor devolvía `source: "mock"` silenciosamente; Supabase podía cachear ese mock; el seed mock era débil por ciudad.
- **Fix:** error `503 openweather_not_configured` si falta key (mock solo con `WEATHER_ALLOW_MOCK=1`); no leer/escribir caché mock; cache keys `v3`; `vite.config` fuerza env desde `.env.local`; UI avisa si llega mock.
- **Verificar:** reiniciar `npm run dev`, Set ciudad (`Madrid,ES`), Network debe mostrar `source: "openweather"` y temps distintas por ciudad.

### 2026-06-25 — Launch Radar: inyección de campaña desde Librería

- Al seleccionar compañía en Librería, `ensureCompanyObject` inyecta `cadence` (launch, announce −90d, overview, category).
- Launch Radar en **modo campaña** compara **Today · Announce · Launch**, muestra overview y **días restantes** hasta launch / ventana de scope.
- Fallback: modo cadencia (intervalo) o Groq si no hay datos curados.
- SQL: columnas `overview` y `category` en `hero_signals` ([`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql)).

### 2026-06-25 — `/panel` Horizon Scan: Publish pipeline + fechas + Launch Radar

- **Problema 1:** Activate hacía toggle radio en cola; deseado: publicar a Signals y sacar de Horizon Scan.
- **Problema 2:** Fechas del scan no coincidían con el rango.
- **Problema 3:** Launch Radar ignoraba cadencia curada en admin.
- **Cambios aplicados:**
  - `promoteCampaignSignal()` → publica a `hero_signals` + `status: published` en cola.
  - Cola admin filtra `status = pending`; botón **Publish to Signals**.
  - Validación de fechas compartida en `server/horizonScanNormalize.js`.
  - `hero_signals` recibe `brand_name`, `launch_date`, `last_launch_date`, `average_interval_months`.
  - Librería → `ensureCompanyObject` guarda `cadence` en objeto → Launch Radar la usa antes de Groq.
  - Varias campañas pueden quedar `active` en `hero_signals`.
- **Estado:** Implementado en código; requiere SQL migration + prueba manual en `/panel`.

### 2026-06-25 — Verificación de Git (empty commit)

- Empty commit `70d35c7` — flujo Git verificado.

---

## Referencia

### Moodboard LEGO

- Brief vivo: [`.cursor/saved/moodboard-lego/CURSOR_BRIEF.md`](.cursor/saved/moodboard-lego/CURSOR_BRIEF.md)
- Insumo parcial Claude (Drive Picker, schema images vs docs): ya fusionado ahí; **stack real = Vite**, no Next App Router.
- Studio fuera de scope hasta cerrar Moodboard v1.

### Planes, costos y propuesta comercial

**Doc canónico:** [`docs/planes-costos-propuesta.md`](docs/planes-costos-propuesta.md) · CSV: [`docs/integraciones_futura_nota.csv`](docs/integraciones_futura_nota.csv)  
**Fuente:** [Gemini — Planes Futura Nota: Costos y Propuesta](https://share.gemini.google/UtadGr2vnMxI) (2026-06-25)  
**Estado:** **implementado en dashboard** (fases 0–8 del blueprint `.cursor/plans/dashboard_apis_roadmap_d7e54a9e.plan.md`) — **Stripe pendiente** (fase 10)

#### Implementado (2026-06-25)

- SQL: `supabase_plans_tokens.sql`, `supabase_campaign_studies.sql`, `supabase_weather_cache.sql` (ejecutar en Supabase SQL Editor)
- Token ledger: `planStore.js` + `planConfig.js` — debito servidor en `/api/analytics/campaign-study` y `/api/intel/overview`
- Pipeline usuario: DataForSEO PAA + Apify hype + Groq → `campaign_studies` cache; switch Librería = 0 tokens
- Intel: `POST /api/intel/overview` (Serper + Groq); Free = 10 searches, Pro = 1k tokens/search
- Weather: `GET /api/weather/forecast` + cache Supabase 45 min; **límites forecast** nodos 2/50 + ciudad 5/50 día (ver sección Resueltos)
- UI: `PlanUsagePanel` en sidebar + `/app/plans`; export JSON gated Pro
- Verificación integraciones: `npm run verify:apis` · `GET /api/health/integrations`

#### Pendiente

- Stripe checkout → `plan = pro` + reset `tokens_balance = 1_500_000`
- Precio Pro marketing (TBD en `pricingDefaults.js`)

#### Resumen ejecutivo

- **Moneda propuesta:** tokens — 1 estudio de campaña live = **10,000 tokens** (~$0.005 COGS).
- **Gratis (Gemini):** 10k tokens bienvenida = 1 campaña live; datos congelados; switch bloqueado.
- **Pro (Gemini):** **$15–19/mes**, **1.5M tokens/mes** ≈ 150 estudios live; switch Librería = 0 tokens.
- **COGS/usuario:** ~$0.08 (Gratis) · ~$0.93–1.30 (Pro muy activo) → margen >90% a $15–19.
- **APIs recomendadas:** Groq, Serper/DataForSEO, Apify, OpenWeather, Supabase. **No Brand24.**

#### Límites objetivo (fundador, conversación Gemini)

| Feature | Gratis (objetivo) | Pro (objetivo) |
|---------|-------------------|----------------|
| Objetos | 1 | Ilimitados |
| Storage | 1 GB (Gemini) / **54 MB** (código hoy) | **5 GB** |
| Búsquedas AI | 10 lifetime | 150 live/mes (unificado con overview) |
| Calendario | 1 uso | Avanzado + eventos corporativos |
| Weather | 2 nodos canvas + 5 cambios ciudad/día | 50 nodos + 50 cambios ciudad/día; panel ilimitado |
| Campaña Signar | 1 live run, frozen | Live + Social Hype + Search Intent |
| Tokens | 10k bienvenida | 1.5M/mes |

#### Delta vs código actual

| Tema | Objetivo | Repo hoy |
|------|----------|----------|
| Precio Pro | TBD ($15–19) | `pricingDefaults.js`: **TBD** (Stripe no conectado) |
| Storage Pro | 5 GB | **5 GB** en `planConfig.js` ✓ |
| Token ledger | 10k / 1.5M | **`profiles.tokens_balance`** + server debit ✓ |
| Weather forecast | 2 inserts + 5 city/day | 50 inserts + 50 city/day; panel/search ilimitados | **`planConfig` + anti-bot** ✓ |
| Campaña live | DataForSEO + Apify + Groq | **`/api/analytics/campaign-study`** ✓ |
| Billing | Stripe | **`setPlan` manual** — pendiente |

---

- Skill de arquitectura: [`.cursor/skills/architect-blueprint/SKILL.md`](.cursor/skills/architect-blueprint/SKILL.md)
- Migración pipeline: [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql)
- Backup técnico Intel: [`docs/memoria-intel-session-backup.md`](docs/memoria-intel-session-backup.md)
- Brief técnico: [`TECH_BRIEF.md`](TECH_BRIEF.md)
