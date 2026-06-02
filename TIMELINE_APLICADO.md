# Futura Nota — Resumen de lo aplicado (Timeline táctico + Canvas)

Documento de referencia de todo lo implementado en esta iteración.  
Complementa `memoria.MD` §10 (visión de producto) con detalle técnico y de uso.

**Fecha de referencia:** junio 2026  
**Estado:** Bloque A completo · Bloque B (UI) en curso · Fase 2 inherit (UI) pendiente

---

## 1. Visión de producto (acordada)

### Fases

| Fase | Qué es | Estado |
|------|--------|--------|
| **0 — Canvas libre** | Conectar nodos para search / relaciones doc↔doc. **No** añade al timeline automáticamente. | Parcial (canvas ya existía; insert timeline separado) |
| **1 — Timeline intra-familia** | Por objeto: docs en eje temporal; click → hijos; doble click → drill-down. | **UI inicial montada** |
| **2 — Inherit obj → obj** | Familia secundaria enganchada al **timeframe** del primario; solo `doc↔doc` / `date↔date`. | Lógica en Bloque A; toggle UI pendiente |

### Reglas clave

- **El orden de creación de objetos no importa** para el timeline.
- Puedes tener **varios objetos** en el panel, cada uno con su fila `[obj name] — [doc] — [doc]…`.
- **Timeline = informar tiempo** (creación del doc o **schedule** de macronodos). No modifica contenido de documentos.
- **Primario vs secundario:** la familia secundaria **hereda timeframe** del set primario al conectar cross-family, no al revés.
- **Mismo tipo en cross-family:** `doc ↔ doc`, `date ↔ date` (no doc↔date).
- **Intra-familia en canvas:** cadena permitida `doc → doc → date → metric` + hijos bajo cada doc.

### Dos “modos” de canvas (concepto)

1. **Canvas libre** (default) — grafo abierto.
2. **Inherit obj → obj** (toggle futuro) — dos familias, nodo puente, carril inferior inherit.

---

## 2. Canvas — color por familia (solo tag)

**Alcance:** solo el recuadro `span.cnode-parent-tag` (“DOCUMENT Product”, etc.). **No** tinta toda la tarjeta `.cnode`.

| Objeto (orden de creación) | Color del tag |
|----------------------------|---------------|
| 1.º (corpus) | Azul por defecto (`var(--cool)`) |
| 2.º | Amarillo claro |
| 3.º+ | Lavanda, teal, rosa, melocotón, azul… (paleta) |

**Archivos:**

- `src/lib/objectColors.js` — `PARENT_TAG_FAMILY_STYLES`, `resolveParentTagFamilyStyle`, `resolveCanvasNodeObjectId`, `resolveCanvasNodeParentTagStyle`
- `src/canvas.jsx` — `CanvasNodeTags` recibe `tagFamily` con estilos inline
- `src/styles.css` — estilos base `.cnode-parent-tag` (sin cambiar fondo de `.cnode`)

---

## 3. Bloque A — Capa lógica (sin UI pesada)

### Archivos creados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/types/timelineTactical.js` | Tipos JSDoc: `CanvasMode`, `TimelineFocus`, `ConnectionKind`, `ClassifiedConnection`, `TimelineWireType` |
| `src/lib/timelineGraph.js` | Clasificar conexiones canvas; reglas mismo tipo; dedup cross-family |
| `src/lib/timelineAnchors.js` | Fechas efectivas, `buildTacticalWireAnchorMap`, herencia primario→secundario |
| `src/lib/timelinePrimary.js` | Resolver objeto **primario** del eje (no por orden de creación) |
| `src/hooks/useTacticalTimeline.js` | Hook: canvas + store → chains, grid, modo |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/stores/timelineStore.js` | Estado táctico (ver §4) |
| `src/lib/timelineChains.js` | Usa anchors tácticos; expone `classifiedConnections`, `crossFamilyDocPairKeys`, `primaryTimelineObjectId` |
| `src/temporal.js` | Sin cambios de reglas cross-family (base `buildWireAnchorMap`) |

### Clasificación de conexiones (`timelineGraph.js`)

| `ConnectionKind` | Significado |
|------------------|-------------|
| `intra-doc` | Hijos bajo el mismo documento |
| `intra-family-doc` | Doc ↔ doc misma familia |
| `intra-family-child` | Hijos misma familia |
| `cross-family-doc` | Doc ↔ doc otra familia (inherit permitido) |
| `cross-family-date` | Date ↔ date otra familia |
| `type-mismatch` | Cross-family tipos distintos (rechazado para inherit) |
| `ignored-for-timeline` | No relevante |

Funciones exportadas relevantes:

- `classifyCanvasConnection`, `buildClassifiedConnections`
- `resolveTimelineWireType`, `isAllowedCrossFamilyTimelineLink`
- `crossFamilyTimelinePairKey` — un solo wire por par (dedup)
- `listDocumentCanvasNodeIdsForObject`, `listChildCanvasNodeIdsForDoc`

### Fechas y herencia (`timelineAnchors.js`)

- `resolveTimelineAnchor` — fecha efectiva en el eje (propia o heredada).
- `buildTacticalWireAnchorMap` — envuelve `buildWireAnchorMap`; si `inheritObjMode`, aplica herencia cross-family.
- `inheritAnchorFromConnection` — con `primaryTimelineObjectId`: copia anchor **del primario al secundario**; sin primario, fallback simétrico (“quien tiene fecha gana”).
- `sortNodeIdsByTimelineAnchor` — pasado → futuro (ascendente).

### Objeto primario (`timelinePrimary.js`)

Resolución (en orden):

1. `primaryTimelineObjectId` explícito en store.
2. `parentObjectId` del **primer doc en `timelineDocQueue`**.
3. Objeto con `role: corpus`.

---

## 4. Estado en `timelineStore.js`

| Campo / acción | Uso |
|----------------|-----|
| `timelineQueueMode` | Modo Select en canvas |
| `timelineDocQueue` | Doc ids en el timeline táctico |
| `timelineDocQueueFocusByDocId` | Block id H1 opcional por doc |
| `inheritObjMode` | Fase 2 — herencia cross-family en anchors |
| `primaryTimelineObjectId` | Eje temporal de referencia |
| `timelineFocus` | `{ level, objectId?, docId?, canvasNodeId? }` |
| `expandedDocIds` | Docs con hijos visibles en timeline |
| `getEffectiveCanvasMode()` | `'free' \| 'queue' \| 'inherit-obj'` |
| `setInheritObjMode`, `toggleInheritObjMode` | |
| `setPrimaryTimelineObjectId` | |
| `setTimelineFocus`, `clearTimelineFocus` | |
| `toggleExpandedDocId`, `setExpandedDocIds` | |
| `enqueueTimelineDocsFromCanvasNodes` | Insert to timeline desde canvas |

**Mutua exclusión:** activar cola (`setTimelineQueueMode(true)`) apaga `inheritObjMode`.

---

## 5. Bloque B — UI timeline táctico

### Archivos creados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/tacticalTimelineView.js` | `buildTacticalObjectRows`, `resolveDocTimelineDate` — filas por objeto |
| `src/components/timeline/TacticalTimeline.jsx` | Panel inferior: grid, filas, chips, interacciones |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/panels.jsx` | `Timeline` delega en `<TacticalTimeline />` |
| `src/components/timeline/TimelineEventChip.jsx` | Soporte `onDoubleClick` |
| `src/App.jsx` | `handleInsertToTimeline` → `enqueueTimelineDocsFromCanvasNodes`; duplicados vs `timelineDocQueue` |
| `src/canvas.jsx` | Tooltip botón Insert to timeline |
| `src/styles.css` | `.tl-empty-hint`, `.is-inherit-layer`, `.is-child-row`, `.tl-track-label--static` |
| `src/hooks/index.js` | Export `useTacticalTimeline` |

### Flujo de usuario

```
Canvas: Select ON → clic nodos con doc → Insert to timeline
         ↓
timelineDocQueue (store)
         ↓
TacticalTimeline: una fila por objectId
         ↓
Chips document en eje pasado ← today → futuro
         ↓
Click chip     → toggle expandedDocIds + foco doc
Doble click    → foco children (macronodos en sub-fila ↳)
```

### Qué muestra cada fila

- **Fila objeto:** label = nombre del objeto; chips = nodos **document** (canvas o virtual desde cola + `launchAt`/`createdAt`).
- **Fila inherit** (`is-inherit-layer`): familia secundaria con cross-link si `inheritObjMode`.
- **Fila hijos** (`is-child-row`): nodos hijos del doc expandido (text, date, metric…) por schedule.

### Empty state

Si no hay cola ni filas: hint *“Enable Select → pick nodes → Insert to timeline”*.

---

## 6. Flujo de datos (diagrama)

```
App.jsx / canvas.jsx
    ↓ lee/escribe
timelineStore (modo, cola, foco, primario, inherit)
    ↓
tacticalTimelineView.buildTacticalObjectRows
    ↓ usa
timelineChains.buildTimelineChains
    ↓ usa
timelineAnchors.buildTacticalWireAnchorMap
    ↓ usa
timelineGraph.buildClassifiedConnections
    ↓ usa
objectColors.resolveCanvasNodeObjectId
timelineSelection.resolveParentDocIdForCanvasNode
temporal.resolveNodeAnchorDate / buildWireAnchorMap
    ↓
TacticalTimeline.jsx (render)
```

---

## 7. Limpieza previa (esta iteración)

Eliminados (timeline táctico roto, no integrado):

- `src/components/timeline/FuturaTimelineCanvas.tsx`
- `src/types/timelineCanvas.ts`

**No tocado:** `FuturaTimeline.jsx` (timeline tier objects/docs/nodes del panel lateral).

---

## 8. Pendiente (no implementado)

| Item | Bloque |
|------|--------|
| Toggle **Inherit obj → obj** en toolbar canvas | D |
| Nodo puente asimétrico cross-family | D |
| Validación visual al conectar tipos distintos en canvas | D |
| Insertar set timeline → canvas **con wires restaurados** | B/D |
| Persistir `timelineDocQueue` entre sesiones | E |
| Elegir primario explícito en UI | D |
| Tests unitarios (clasificación, herencia, ordenación) | E |
| Infografía del toggle inherit | E |

---

## 9. Cómo probar

1. Coloca documentos de uno o más objetos en el canvas (con fechas: launch, schedule o nodo date cableado).
2. Activa **Select** en la toolbar del canvas.
3. Selecciona nodos ligados a documentos.
4. Pulsa **Insert to timeline**.
5. Revisa el panel **Timeline** inferior: filas por objeto, docs en el eje.
6. Click / doble click en chips para expandir hijos.

**Nota:** si un doc no aparece posicionado, necesita fecha resoluble (`launchAt`, `createdAt`, wire a date, o nodo document en canvas con anchor).

---

## 10. Referencia en memoria

Detalle de fases 0/1/2, diagramas macro, §10.9 primario/secundario, §10.10 multi-objeto: **`memoria.MD` sección 10**.

---

## 11. Lista rápida de archivos tocados (git)

### Nuevos (untracked)

- `src/components/timeline/TacticalTimeline.jsx`
- `src/lib/tacticalTimelineView.js`
- `src/lib/timelinePrimary.js`

### Modificados

- `memoria.MD`
- `src/App.jsx`
- `src/canvas.jsx`
- `src/components/timeline/TimelineEventChip.jsx`
- `src/hooks/index.js`
- `src/hooks/useTacticalTimeline.js`
- `src/lib/timelineAnchors.js`
- `src/lib/timelineChains.js`
- `src/lib/timelineGraph.js`
- `src/lib/objectColors.js` *(tag por familia — puede estar en commit previo)*
- `src/panels.jsx`
- `src/stores/timelineStore.js`
- `src/styles.css`
- `src/types/timelineTactical.js`

### Creados en sesión anterior (Bloque A, ya en repo)

- `src/types/timelineTactical.js`
- `src/lib/timelineGraph.js`
- `src/lib/timelineAnchors.js`
- `src/hooks/useTacticalTimeline.js`
