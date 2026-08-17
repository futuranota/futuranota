# Folder library — product memory

Saved: 2026-08-15 (updated 2026-08-17: document sets `/i` `/o`). Scope: folder + document libraries.

## Problem Futura solves

Writers and teams lose context when files live on disk / Instagram / Downloads. The library keeps **fichas** (metadata + optional media) next to the project folder so texts and assets stay in one family — **fancy recall + visualization**, not only storage.

## Gina (norte transversal)

Anything we build in the library is also **signal for Gina**. She should be able to **remember and show** fichas / tips / previews **inside the same chat during the day** (LIVE CORPUS ONLY — never invent assets). UI library and Gina tools share one data model; do not design fichas that only exist in a closed overlay Gina cannot read.

## Scopes (vision)

```
Workspace (later: index view only)
  └── Folder library          ← live
        ├── fichas shared by all docs in the folder
        └── Document sub-library — live: Image + Attachments local to one doc
```

Folder overlay shows **Folder | Docs** only when at least one child document already has fichas. Docs view = subfolder per document (title + count). Create from the document editor (`NodeQueryModal` Library) or by opening that subfolder.

Document / folder `[+]` = Image + Attachments. Video create retired.

The folder **groups** document fichas; it does not copy them.

## Document sets (`/i` input · `/o` output) — live

Sets live **only on the document** (node), not on the folder.

- **`/i`** — action (does not insert a block): modal Name + Story → `createLibrarySet`.
- **`/o`** — action: list of this document’s sets (File.svg + title + count). Open a set → tabs **Folder | Images | Attachments**.
  - **Folder:** set story (copy). Empty → “No story yet.”
  - **Images / Attachments:** fichas with `item.setId === set.id`.
  - **Add from this document:** assign loose fichas (`setId` null) into the set.
- Loose fichas stay in the document **Library** button. The set is the pack.
- Unsaved document → same message as `-- --` capture (“save the document first”).
- Out of this slice: reuse folder→doc, `--script--` picker, `#` / moodboard, `element.set` in prose.

```
librarySets: [{ id, tag, description, createdAt, updatedAt }]
libraryItems[].setId  // null = loose
```

## [+] create menu (segment types)

`[+]` does **not** create a generic ficha into the current tab blindly. It opens a **type chooser**:

```
[ + ]
  ├── Attachments   → skill/pdf ficha — downloadable file
  └── Image         → image ficha — WebP preview
```

Each type has its own create fields and open behavior.

## Section tabs (filter the grid)

```
[ All | Images | Attachments ]
```

- **All** — every ficha
- **Images** — `category === image`
- **Attachments** — `category === skill` (and `pdf`)

Remember last tab per folder (`sessionStorage`). Video tab retired.

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
| **setId** | Document set this ficha belongs to (`null` = loose). Folder fichas stay unset. |

### Image (live)

- Create: tag + **Prompt** (copy) + optional upload **image → WebP**
- Open: detail — tag, Prompt \| Image switch, copy prompt, download WebP
- Capture from document body: `--prompt text--` → name modal → ficha without image
- Grid: real thumb or IMG badge

### Attachments (live; category `skill`)

- Create: **tag** + **description** + upload **attachment** (file, not image)
- Open: show tag + description + easy **Download** of the attachment
- Grid: FileCard-style format badge
- Bytes: same Storage pool `doc-images` — **no WebP conversion** for attachments

### Video (retired from create)

Legacy video fichas may still appear under All and open in detail. No new Video create.

## Image card UX (live)

- Edit on cell + detail header → `FolderLibraryElementModal`
- Detail: tag, Prompt \| Image, copy prompt, download WebP
- Placeholders EN/ES for prompt: describe the image you want to generate
- `--text--` in the document editor opens name + prompt capture (saved on the document library)

## Atelier / wall color (Image + Video live)

- Field `wallColor` (`#RRGGBB`) on the ficha — production wall behind the asset.
- **Edit:** hex + color picker + **Apply**; live behind upload preview.
- **Open Image/Video:** preview pane uses `resolveWallColor(wallColor)` (default `#151515`).
- Does not recolor the media pixels.
- FN does not generate images/video.

## Persistence

- Metadatos: `campaigns.library_items` jsonb (folder) · `nodes.library_items` jsonb (document) · `nodes.library_sets` jsonb (document sets)
- Bytes: `doc-images` (WebP for images; raw attachments for skills); `scopeId` = folderId or nodeId
- SQL ops: `supabase_campaign_library_items.sql`; `supabase_node_library_items.sql`; `supabase_node_library_sets.sql`

## Live today (code)

- Grid + type filter All / Images / Attachments
- Image create/open + wallColor; Attachments create/open
- Persist `campaigns.library_items` + `nodes.library_items`
- Document Library button in `NodeQueryModal`; Folder | Docs toggle + subfolders when docs have fichas
- Document sets: `/i` create · `/o` list/open · assign loose fichas from the same doc
- Video create retired from `[+]` / tabs

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
7. ~~Document sub-library (overlay + Folder/Docs toggle)~~
8. ~~Document sets `/i` `/o` (create + list + assign loose fichas)~~ · later: reuse main · `--script--` · `element.set` · mini strip · Atelier extras · Gina library tools · @tag  
