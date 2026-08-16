# Folder library — product memory

Saved: 2026-08-15 (updated 2026-08-16: library table / grid + type filter). Scope: folder-level library (no workspace index yet).

## Problem Futura solves

Writers and teams lose context when files live on disk / Instagram / Downloads. The library keeps **fichas** (metadata + optional media) next to the project folder so texts and assets stay in one family — **fancy recall + visualization**, not only storage.

## Gina (norte transversal)

Anything we build in the library is also **signal for Gina**. She should be able to **remember and show** fichas / tips / previews **inside the same chat during the day** (LIVE CORPUS ONLY — never invent assets). UI library and Gina tools share one data model; do not design fichas that only exist in a closed overlay Gina cannot read.

## Scopes (vision)

```
Workspace (later: index view only)
  └── Folder library          ← v1 live / building
        ├── fichas shared by all docs in the folder
        └── Document sub-library (later) — local to one doc + inherits folder fichas
```

v1 = **folder only**. Workspace catalog and document-scope inheritance = later.

## Ficha model (product — all optional except useful Save)

Everything is optional in spirit; UX still needs a **name/tag** to Save today.

| Field | Purpose |
|---|---|
| **tag / name** | Anchor for mention / find (e.g. `car_sheet`, skill name) |
| **tips / description** | Reminds what it is for |
| **attachment** | Downloadable file (PDF, zip, skill pack, md, …) |
| **preview** | Trailer **video** *or* sample **image(s)** — visualization, not the main download |

Upload UX by intent:

- Preview image(s) → upload image  
- Trailer → upload video  
- Downloadable payload → attachment file  

PDF / heavy docs: optional **trailer ≤ ~1 min** as teaser. User may only read tips, only download, or watch trailer — their choice.

User should feel comfortable: tips + optional preview + optional downloadable file.

## Library table / grid (home de fichas)

This is where folder fichas **live** in the UI — not a dump of mixed files.

```
[ + ]
[ file type: img | pdf | … ]
[thumb] [thumb] [thumb]
```

### Folder vs document UI (agreed)

| Surface | UI |
|---|---|
| **Folder library** | Full **table**: `[+]` + type tabs + thumb grid (`FolderLibraryOverlay`) |
| **Document** (later) | **Minimal / small** strip — FileCard-style compact thumbs (`FileCard.original.tsx`), not the full table |

Document sub-library inherits folder fichas later; keep doc chrome tiny.

### Segmentation (agreed)

- **Do not mix by default.** Tabs/chips by type: Image / PDF / Skill / Auto — one active type at a time.
- **No “All” view in v1** (avoids chaos).
- Empty for that type → short empty state + `[+]` (never pad with other types).
- `[+]` creates a ficha in the **current filter type**; the name the user types = ficha `tag` / name.
- Remember last filter type **per folder** (`sessionStorage`; Gina still reads full `libraryItems`).

### UI ref (table only)

- Pattern: Magic “Recent Generations” thumb grid (`grid-cols-4` aspect-square) + mode tabs → in FN = **file-type tabs**, not generation modes.
- Saved strip: [`LibraryTable.gallery.original.tsx`](LibraryTable.gallery.original.tsx)
- Also: [`FileCard.original.tsx`](FileCard.original.tsx) for format-badge thumbs when no real preview (and for future doc mini strip).

### Explicitly omit from the Magic AI Multi-Modal demo

Do **not** port into Futura Nota:

- AI image/video/avatar generation  
- Prompts / negative prompts / suggestions / Wand  
- Models, resolution, style, lighting, pose, seed, steps  
- Loading progress / generate CTA / download-from-gen  
- Generation history search / “AI Multi-Modal Generation” chrome  

Only the **table**: `[+]` + type toggle + thumb grid of real library fichas.

## Atelier (ficha space / “subfolder” of preview)

Opening or creating an image (or its preview/trailer) opens a **preview atelier** for that ficha:

- Change **wall / background color** (side wall where the asset lives).
- Paste a **social network hex** (or presets) to see how image/video reads against that brand color.
- Human iterates toward the “perfect” asset for that context (story / feed / cover). **Futura does not generate the image** — craft is the user’s.

This is presentation preview on the same ficha, not a new Empresa→Folder hierarchy.

```
Library (type filter → grid)
  └── open ficha
        ├── tips / metadatos
        ├── trailer / muestras
        ├── download attachment
        └── atelier: preview + wall color / social hex
```

## Persistence (agreed direction)

- Metadatos: `campaigns.library_items` jsonb (wire upsert/hydrate — not only local).
- Bytes: Supabase Storage bucket **`doc-images`** (project 100GB pool). Non-WebP video/files may need path conventions or sibling bucket later; prefer same project Storage.
- No separate library table for v1 — fichas hang on the folder doc.
- Same persisted fichas = what Gina can narrate / surface in chat.

## Live today (code)

- `libraryItems` on folder doc + CRUD: `src/lib/folderLibrary.js`, `folderLibraryNormalize.js`
- UI: `FolderLibraryOverlay.jsx`, `FolderLibraryElementModal.jsx`, Library button on content folder head
- Image upload via `convertAndUploadDocImage` → `doc-images`
- **Persist:** `campaigns.library_items` jsonb — SQL `supabase_campaign_library_items.sql`; upsert/hydrate in `persistenceMiddleware.js`
- **Ops:** run that SQL in Supabase SQL Editor before relying on cloud sync (upsert fails if column missing)
- Still later: atelier / Gina library tools / document mini FileCard strip
- **Live UI:** type-filter thumb grid on `FolderLibraryOverlay` (`+`, tabs Image/PDF/Skill/Auto, no All)

## Out of scope until scheduled

- Workspace-wide library UI  
- Document-scoped sub-library + inheritance  
- `@tag` bold rosa zapote (`#D6B4A7`) without link  
- Insert-from-editor → library picker  
- Type-filter thumb grid + FileCard thumbs + atelier wall / social hex  
- Document mini library strip (FileCard)  
- Gina tools that list/open library fichas in chat  
- Adapt FileCard / gallery into FN CSS (no Tailwind/`cn` / lucide Magic stack) — gallery grid **done** on folder overlay; FileCard still pending for docs  
- Any AI generation pipeline from Magic demos  

## UI reference

- Gallery / table strip: [`LibraryTable.gallery.original.tsx`](LibraryTable.gallery.original.tsx)  
- FileCard format thumbs: [`FileCard.original.tsx`](FileCard.original.tsx)  
- Adapt to Futura Nota: JSX + CSS, surface `#151515`.

## Build order (next)

1. ~~Persist `library_items` column + persistenceMiddleware read/write~~  
2. ~~Memory: library table / type filter / omit AI gen~~  
3. ~~Folder overlay: type tabs + `[+]` + thumb grid~~  
4. Expand ficha: attachment + preview image/video (all optional; trailer time cap)  
5. Document mini FileCard strip (later)  
6. Atelier: wall color + social hex presets  
7. Gina: read fichas in day chat (remember / show)  
8. Document scope + @tag highlight + insert picker  
