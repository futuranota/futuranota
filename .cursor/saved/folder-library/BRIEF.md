# Folder library — product memory

Saved: 2026-08-15 (updated 2026-08-16: [+] type menu + Skill attachment + section tabs). Scope: folder-level library.

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

v1 = **folder only**.

## [+] create menu (segment types)

`[+]` does **not** create a generic ficha into the current tab blindly. It opens a **type chooser**:

```
[ + ]
  ├── Skills / PDF   → skill (or pdf) ficha — attachment downloadable
  ├── Image          → image ficha — WebP preview
  └── Video          → video ficha (later detail)
```

Each type has its own create fields and open behavior (define per type; Image + Skill first).

## Section tabs (filter the grid)

```
[ All | Images | Videos | AI skills ]
```

- **All** — every ficha (user requested; overrides earlier “no All in v1”).
- **Images** — `category === image`
- **Videos** — `category === video`
- **AI skills** — `category === skill` (and `pdf` until PDF has its own tab)

Remember last tab per folder (`sessionStorage`).

## Ficha model

| Field | Purpose |
|---|---|
| **tag / name** | Invoke name (book / Gina) |
| **description** | Tips / “qué hace?” / TXT-Placeholder for images |
| **mediaUrl** | Image WebP (image type) or future video preview |
| **mediaKind** | `image` \| `video` \| null |
| **attachmentUrl** | Downloadable skill/pdf payload (not WebP-converted) |
| **attachmentName** | Original filename for download |
| **attachmentKind** | Format badge (zip, md, pdf, code, …) — FileCard labels |

### Image (live)

- Create: tag + description (TXT-Placeholder copy) + upload **image → WebP**
- Open: detail — tag, TXT-Placeholder \| Image switch, copy, download WebP
- Grid: real thumb or IMG badge

### Skill / AI skills (building)

- Create: **tag** + **description** (“¿qué hace este skill?”) + upload **attachment** (file, not image)
- Open: show tag + description + easy **Download** of the attachment
- Grid: FileCard-style format badge ([`FileCard.original.tsx`](FileCard.original.tsx); shared format-tag grid ref from user — CODE / JSON / ZIP / MD / PDF, etc.)
- Bytes: same Storage pool `doc-images` with expanded MIME allow-list (or raw file path under user scope) — **no WebP conversion** for attachments

### Video / PDF open UX

Still to brief in detail. Video create type exists in `[+]`. PDF may share Skills/PDF entry or land as `pdf` category under AI skills tab for now.

## Image card UX (live)

- Edit on cell + detail header → `FolderLibraryElementModal`
- Detail: tag, TXT-Placeholder \| Image, copy description, download WebP
- Placeholders EN/ES for description: idea/concept of the image description

## Atelier (later)

Wall color + social hex after core types feel solid. FN does not generate images.

## Persistence

- Metadatos: `campaigns.library_items` jsonb
- Bytes: `doc-images` (WebP for images; raw attachments for skills)
- SQL ops: `supabase_campaign_library_items.sql`; expand bucket MIME for attachments when shipping skill upload

## Live today (code)

- Grid + type filter (migrating tabs toward All / Images / Videos / AI skills)
- Image detail + Edit + WebP upload
- Persist library_items
- Skill attachment fields + detail download + `[+]` chooser — in progress this session

## UI reference

- Gallery strip: [`LibraryTable.gallery.original.tsx`](LibraryTable.gallery.original.tsx)
- Format badges: [`FileCard.original.tsx`](FileCard.original.tsx) (TXT/DOC/PDF/CODE/IMG/VIDEO grid language)
- Surface `#151515`

## Build order

1. ~~Persist library_items~~
2. ~~Folder grid + Image detail~~
3. ~~Memory: [+] types + tabs All/Images/Videos/AI skills + Skill attachment~~
4. **Build:** `[+]` chooser + Skill create (tag, description, attachment) + skill open/download + AI skills tab
5. Video create/open brief + UI
6. PDF-specific polish / FileCard thumbs polish
7. Document mini strip · Atelier · Gina library tools · @tag
