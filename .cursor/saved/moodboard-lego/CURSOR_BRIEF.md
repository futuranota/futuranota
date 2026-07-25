# Futura Nota — Moodboard LEGO (brief vivo)

**Estado:** planificación (Studio diferido hasta terminar Moodboard).  
**Última actualización:** 2026-07-24  
**Refs visuales:** SVGs / mocks del usuario (frames L/M/S, @INFO + arrow, nota tape).

Este documento acumula la cultura de producto + decisiones de UX/técnica.  
El brief de Claude (Next.js 14 + grid 2×2) se toma como **insumo parcial**; abajo prevalece el stack real y el modelo LEGO acordado.

---

## Cultura de producto (contexto)

Futura Nota no es un note-taker común: busca ser **funcional, organizado y bonito**, y que el usuario se sienta conectado con lo que escribe.

Más que “guardar notas”, Futura ayuda a **predecir / planificar lo siguiente** (negocio, lanzamientos, decisiones). Marketing: nota de predicciones, no otra app de notas genérica.

El Moodboard es el **tablero de visión**: piezas (imágenes, notas, @info, files) cobran sentido antes de volverse plan/timeline.

---

## Scope

| En scope (Moodboard primero) | Fuera de scope hasta terminar Moodboard |
|---|---|
| Board ancho banner + grilla LEGO | **Studio** (otra sesión / superficie) |
| Frames L/M/S, nota tape, slots `+` | Reemplazar del todo el moodboard 2-imgs legacy sin puente |
| Attachments table + tags linkables | Drag libre tipo Figma |
| Imágenes: upload local (WebP / storage) | Drive como storage de imágenes |
| Files: Google Drive (link / file_id) | — |

**Legacy:** el moodboard actual (2 imágenes + caption) se **mantiene** por ahora (converts Image card ↔ Moodboard ↔ Banner). El board LEGO es el nuevo destino de producto.

---

## UX acordada — modelo 3 columnas × 3 recetas (IMPLEMENTADO v1, 2026-07-24)

### Layout (lo que quedó construido)
- Board **ancho banner** (100% del contenido), fondo `#F1F1F1`, grilla CSS de **3 columnas exactas** (gap 10px, padding 16px, franja inferior 60px para caption + acciones).
- Cada columna elige **una receta** (mezclables entre columnas, nunca se solapan):

| Receta (`recipe`) | Contenido | Nota |
|---|---|---|
| `large` | 1 imagen que llena la columna (⅓ del board) | |
| `medium_stack` | 2 imágenes medianas apiladas + **flecha hand-drawn + label @info** | Arrows 6 / 54 de `public/uploads/` |
| `semi_sticky` | 1 imagen semi grande + **sticky note** (`horizontal-note.svg`) | Sticky con textarea Pangolin |

- Combos: 3 grandes · 6 medianas · 2 grandes + semi+sticky · cualquier mezcla.
- Toolbar en modo edición: 3 botones de estructura aplicados a la **columna activa**; columnas vacías muestran picker inline "Pick a structure".
- Caption Pangolin rotado (−4°) en la franja inferior; body debajo del board (~9 líneas).
- Guardar requiere **≥1 imagen** (ya no ambas a+b).

### Estado del código
- Esquema: `columns[3]` en `docBlocks.js` (`MOODBOARD_RECIPES`, `createMoodboardColumn`, `countMoodboardSavedImages`, `firstMoodboardImage`); migración automática de `a`/`b` legacy → col0/col1 `large`.
- Vista: `MoodboardBlockView.jsx` reescrita; CSS `.doc-moodboard*` en `left-panel.css`.
- Converts Image card ↔ Moodboard ↔ Banner conservados (primera imagen ↔ col0 `large`).

### Interacción frame (futuro)
- **Drag** → mover el frame entre huecos válidos (v1.5; v1 = toolbar + insert estático, ya hecho).
- **Click** en frame → abre **tabla de attachments** → usuario llena → **Aceptar** → queda ligado al frame/tag (fase siguiente).

### Tags (@INFO + arrow)
- Tag pequeño arriba del frame (tipografía / arrow / color los aporta el usuario; refs SVG).
- El tag es un **link**: en textareas del doc/nodo se puede insertar; click → navega al moodboard (ideal: al frame concreto).
- En la tabla: copy de “cómo usar” el tag en la prosa.

### Imágenes vs files
| Tipo | Fuente | Qué se guarda |
|---|---|---|
| Image / frame | Upload local (como image-split WebP) | src / storage URL + dims + celda |
| Document / file | **Google Drive Picker** | `drive_file_id`, nombre, mime, `webViewLink`, icono |

UI file piece: **icono + título + descripción** → click abre Drive (`/view` MVP).

### Drive (MVP)
- Scope: `drive.readonly` + Google Picker.
- View: `https://drive.google.com/file/d/{FILE_ID}/view` (nueva pestaña). Embed/preview = fase posterior.
- No subir el archivo a Supabase Storage.

---

## Stack real (Futura Nota) — adaptar el brief Claude

El repo **no** es Next.js App Router. Usar:

| Brief Claude | Futura Nota real |
|---|---|
| Next.js 14 App Router | **Vite + React 18 + React Router** |
| `app/moodboards/...` | Componentes bajo `src/components/...` + stores Zustand existentes |
| Supabase + RLS | Ya en uso; nuevas tablas/RPC vía SQL del proyecto |
| `react-google-picker` | Evaluar; o Google Picker JS API + OAuth existente |
| Grid fijo 2×2 placeholders | **Grilla LEGO** (celdas + piezas), no solo 4 slots |
| Página `/moodboards/[id]` | Primero: **bloque en documento/nodo** (como banner); página dedicada opcional después |

Persistencia de escritura: alineada a `docBlocks` / `nodeInlineContent` + sync Supabase existente (`persistenceMiddleware`), no un silo Next separado.

---

## Modelo de datos

### Bloque moodboard (IMPLEMENTADO — `docBlocks.js`)
```js
{
  type: "moodboard",
  columns: [ // siempre 3
    {
      recipe: "large" | "medium_stack" | "semi_sticky" | null,
      images: [/* 1 slot (large/semi) o 2 (medium); { src, name, alt, width, height, imageSaved } */],
      stickyText: "",  // solo semi_sticky (máx 120)
      infoLabel: "",   // solo medium_stack (máx 28)
    },
  ],
  caption, body, bodyMode, todoItems, moodboardSaved,
}
```
Serializa como `::moodboard\n{JSON}` con `columns`; los docs viejos con `a`/`b` migran al leer.

### Attachments (tabla / store)
Compartido por imagen y file:

- `id`, `user_id`, `kind: 'image'|'drive_file'`
- image: `src`, `name`, `width`, `height`
- drive: `drive_file_id`, `drive_file_url`, `document_name`, `mime_type`, `icon_link`
- `tag_label` (texto del chip @INFO)
- `hashtags[]` (opcional)
- `board_block_id` / `frame_id` (vínculo a la pieza)
- timestamps

Tags en prosa: mismo espíritu que **@mentions** en `SlashAwareTextarea` (chip clickable → focus/scroll al board/frame).

---

## Insumo Claude (parcial) — qué reutilizar

Útil:
- Separación **images = storage** vs **documents = Drive file_id**.
- Flujo Picker → guardar id → View abre Drive.
- Checklist de permisos OAuth / env vars.
- Schema SQL como **punto de partida** (renombrar/adaptar a naming del repo y a piezas LEGO + `col/row/w/h`).

No copiar tal cual:
- Estructura `app/` Next.
- Solo 4 placeholders 2×2 como producto final.
- Timeline “2 weeks / 80h” sin re-estimar contra Vite + bloques doc.

---

## Orden de build

1. ~~Schema `columns[3]` recetas + board ancho banner + toolbar + 3 recetas~~ ✅ **hecho (2026-07-24)**  
2. Click frame → modal tabla attachments → Aceptar → tag.  
3. Insertar tag @INFO en textareas + click-through al board.  
4. Drive Picker + pieza file.  
5. Drag entre columnas (reposicionar recetas).  
6. Studio — **solo después**.

---

## Pendiente del usuario

- SVGs / tokens: font, weight, size, color, arrow del tag @INFO.  
- Copy final de la tabla (“cómo usar el tag”).  
- Confirmar si el slash `/moodboard` apunta al board nuevo o convive con legacy.
