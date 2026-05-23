# Futura Nota — Estado migración

## Parte 3 (completada en código)

- `src/components/folders/` — Objects, Docs, Nodes con Cards + Forms + Modal
- `src/components/timeline/FuturaTimeline.jsx` — tiers + eventos demo
- `src/components/canvas/FuturaCanvas.jsx` — drag en store Zustand
- `src/lib/canvasHelpers.js`, `docHelpers.js`
- Estilos: `src/styles/parte3.css`

---

# Futura Nota — Parte 1 estructura

Ver `docs/futura-nota-architecture-v2.json` para el modelo de datos.

## Carpetas activas

| Ruta | Estado |
|------|--------|
| `src/stores/` | Zustand stores + middleware |
| `src/hooks/` | Hooks custom |
| `src/components/sidebar/` | Objects / Docs / Nodes folders |
| `src/types/` | JSDoc typedefs |
| `src/lib/` | ids, sync, dates, textToNode, canvasMath |
| `src/pages/` | Landing, CompanySelector (+ Dashboard stub) |

## Pendiente (Parte 3)

- Componentes `objects/`, `docs/`, `nodes/`, `canvas/`, `timeline/` completos
- `DashboardPage` extraído de `App.jsx`
- Timeline 3 tiers con `useTimelineStore`
- Canvas legacy (`canvas.jsx`) → `useCanvasStore`
