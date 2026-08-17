# Folder library — product memory

Saved: 2026-08-15 (updated 2026-08-17: document sub-library). Scope: folder + document libraries.

## Problem Futura solves

Writers and teams lose context when files live on disk / Instagram / Downloads. The library keeps **fichas** (metadata + optional media) next to the project folder so texts and assets stay in one family — **fancy recall + visualization**, not only storage.

## Gina (norte transversal)

Anything we build in the library is also **signal for Gina**. She should be able to **remember and show** fichas / tips / previews **inside the same chat during the day** (LIVE CORPUS ONLY — never invent assets). UI library and Gina tools share one data model; do not design fichas that only exist in a closed overlay Gina cannot read.

## Scopes (vision)

```
Workspace (later: index view only)
  └── Folder library          ← live
        ├── fichas shared by all docs in the folder
        └── Document sub-library — live: Image + Skills/PDF local to one doc
```

Folder overlay shows **Folder | Docs** only when at least one child document already has fichas. Docs view = subfolder per document (title + count). Create from the document editor (`NodeQueryModal` Library) or by opening that subfolder.

Document `[+]` = Image + Skills/PDF (script/file). Video stays folder-only.

The folder **groups** document fichas; it does not copy them.

## [+] create menu (segment types)

`[+]` does **not** create a generic ficha into the current tab blindly. It opens a **type chooser**:

```
[ + ]
  ├── Skills / PDF   → skill (or pdf) ficha — attachment downloadable
  ├── Image          → image ficha — WebP preview
  └── Video          → video ficha (upload mp4/webm/mov ≤2 min · ≤100 MB + detail)
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

### Video (live)

- Create: tag + description (TXT-Placeholder) + upload **MP4/WebM/MOV ≤ 2 min · ≤ 100 MB** + optional `wallColor`
- Open: detail — TXT-Placeholder | Video switch, play on wall-colored pane, download
- Grid: VIDEO badge

### Video / PDF open UX (PDF still later)

PDF may share Skills/PDF entry or land as `pdf` under AI skills tab.

## Image card UX (live)

- Edit on cell + detail header → `FolderLibraryElementModal`
- Detail: tag, TXT-Placeholder \| Image, copy description, download WebP
- Placeholders EN/ES for description: idea/concept of the image description

## Atelier / wall color (Image + Video live)

- Field `wallColor` (`#RRGGBB`) on the ficha — production wall behind the asset.
- **Edit:** hex + color picker + **Apply**; live behind upload preview.
- **Open Image/Video:** preview pane uses `resolveWallColor(wallColor)` (default `#151515`).
- Does not recolor the media pixels.
- FN does not generate images/video.

## Persistence

- Metadatos: `campaigns.library_items` jsonb (folder) · `nodes.library_items` jsonb (document)
- Bytes: `doc-images` (WebP for images; raw attachments for skills); `scopeId` = folderId or nodeId
- SQL ops: `supabase_campaign_library_items.sql`; `supabase_node_library_items.sql`

## Live today (code)

- Grid + type filter All / Images / Videos / AI skills
- Image + Video + Skill create/open + wallColor
- Persist `campaigns.library_items` + `nodes.library_items`
- Document Library button in `NodeQueryModal`; Folder | Docs toggle + subfolders when docs have fichas

## UI reference

- Gallery strip: [`LibraryTable.gallery.original.tsx`](LibraryTable.gallery.original.tsx)
- Format badges: [`FileCard.original.tsx`](FileCard.original.tsx) (TXT/DOC/PDF/CODE/IMG/VIDEO grid language)
- Surface `#151515`

## Build order

1. ~~Persist library_items~~
2. ~~Folder grid + Image detail~~
3. ~~Memory: [+] types + tabs All/Images/Videos/AI skills + Skill attachment~~
4. ~~`[+]` chooser + Skill create + skill open/download + AI skills tab~~
5. ~~Video create/open + wallColor~~
6. PDF-specific polish / FileCard thumbs polish
7. ~~Document sub-library (overlay + Folder/Docs toggle)~~ · later: mini strip · Atelier extras · Gina library tools · @tag  
