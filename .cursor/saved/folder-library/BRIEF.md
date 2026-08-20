# Folder library — product memory

Saved: 2026-08-15 (updated 2026-08-18: Attachments header, Prompt fijo). Scope: folder + document libraries.

## Problem Futura solves

Writers and teams lose context when files live on disk / Instagram / Downloads. The library keeps **fichas** (metadata + optional media) next to the project folder so texts and assets stay in one family — **fancy recall + visualization**, not only storage.

## Gina (norte transversal)

Anything we build in the library is also **signal for Gina**. She should be able to **remember and show** fichas / tips / previews **inside the same chat during the day** (LIVE CORPUS ONLY — never invent assets). UI library and Gina tools share one data model; do not design fichas that only exist in a closed overlay Gina cannot read.

## Scopes (vision)

```
Workspace (later: index view only)
  └── Folder library          ← live
        ├── fichas shared by all docs in the folder
        └── Document sub-library — live: Prompt + assets local to one doc
```

Folder overlay shows **Folder | Docs** only when at least one child document already has fichas. Docs view = subfolder per document (title + count). Create from the document editor (`NodeQueryModal` Library) or by opening that subfolder.

Document `[+]` = Prompt (or asset on Assets). Folder `[+]` = Prompt, or attachment when Attachments is open. Video create retired. Attachments live **only on the folder**.

The folder **groups** document fichas; it does not copy them.

## Document assets (`#i` input · `#o` output) — live

Assets live **only on the document** (node), not on the folder. Copy: **assets** (internal `librarySets` / `setId`). The **story** is the document body — not a field on the asset. Invoking `.asset-name` in prose clones a ficha into a document asset (`ficha.asset`); the story keeps only the Name.

- **`#i`** — Name + **Prompt**. Right pane = 4 static **IMG** SVG cards (no upload). Saves `createLibrarySet` only.
- Open an asset → modal layout read-only: **Name + Prompt** (copy) | adaptive **metadata grid** (tag + prompt per ficha, no thumb). **Download** = zip. Edit updates name/prompt. `[+]` while open adds a Prompt ficha into the set.
- **`#o`** — action: opens document Library on tab **Assets**.
- Document library: **Assets** + **Prompt** (fixed label + class chips). No Attachments. Internal category remains `image`.
- Folder library: header **Attachments** (`attachment.svg` + name) visualizes files; Prompt row is `Prompt [all] [classes] [+]`.
- Assets tab: `assets.svg` + “Assets”. Rows = assets with `Folders.svg` + name + count.
- Prompt = **loose** fichas (`setId` null). `[+]` on Assets creates an asset; `[+]` while the asset detail is open adds Prompt into it.
- Unsaved document → same message as `-- --` capture.
- Out of this slice: reuse folder→doc as a dedicated flow, `--script--`.
- **Name invoke (live):** typing a prefix of a Prompt ficha **Name** in the document body opens autocomplete; picking it inserts the canonical name as a slight bold reference (not a link). Does **not** append `.` or open asset assign — that is only `ficha.asset`. `#` stays reserved for `#i` / `#o`.
- **Dotted assign path (live):** `ficha.asset` in the document body. Enter opens the asset; prose keeps only the ficha **Name** bold. **Guardar** applies the insert. **Folder** fichas always **loop** (copy; source stays). **Document Prompts:** default = **move once** into that asset; **Loop** in the create/edit modal = copy and stay in Prompt. Autocomplete lists unique Names from loose Prompt + folder, not copies inside assets.

```
librarySets: [{ id, tag, description, createdAt, updatedAt }]  // UI: assets
libraryItems[].setId  // null = loose
```

Icons: scope `folder-main.svg` · `docs-main.svg` · tabs `assets.svg` · `img.svg` · `attachment.svg` · `FolderDashed.svg` (`#i`) · `Folders.svg` (`#o` rows).

## [+] create (contextual)

`[+]` creates for the active view — no type chooser:

```
Folder Prompt view        → Prompt ficha
Folder Attachments view   → attachment (skill/pdf)
Document Assets           → asset
Document Prompt / asset   → Prompt ficha
```

## Section chrome

```
Folder header:  [Attachments icon+name]  [+]
Folder row:     Prompt  [all]  [classes]  [+]
Document row:   [Assets]  Prompt  [all]  [classes]  [+]
```

- **Assets** — assets / subfolders created with `#i` (document only)
- **Prompt** — `category === image` (loose on the document). Fixed label; suffixes: **All** | user classes | **[+]**
- **Attachments** — folder only (`category === skill` / `pdf`). Header visualizes; `[+]` creates.

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
| **loop** | Create/edit modal toggle. Document Prompts: copy into assets instead of moving. Folder defaults on (assign from a folder source still clones). |
| **promptClass** | Optional classification from the objects toggle list in create/edit (`ambiente` plus named overlay classes). Overlay chips still filter. |

Owner-level **`promptClasses`**: named chips for the Prompt tab (`campaigns.prompt_classes` / `nodes.prompt_classes`). Empty classes persist until the user adds fichas.

### Prompt (live)

- Create/edit: tag + **Prompt** (copy) + optional reference image via bottom image button (not a side column) + Loop toggle + objects toggle (class chips). Grid / Docs files illustrate the prompt text.
- Open: detail — tag, Prompt \| Image switch, copy prompt, download WebP
- Capture from document body: `--prompt text--` → name modal → ficha without image
- Grid: real thumb or IMG badge; optional class label. Filter chips classify the same grid (not folders).

### Attachments (live; category `skill`)

- Create: **tag** + **description** + upload **attachment** (file, not image)
- Open: show tag + description + easy **Download** of the attachment
- Grid: FileCard-style format badge
- Bytes: same Storage pool `doc-images` — **no WebP conversion** for attachments

### Video (retired from create)

Legacy video fichas no longer appear in folder tabs (create/filter retired).

## Prompt card UX (live)

- Edit on cell + detail header → `FolderLibraryElementModal` (Loop on/off = RepeatOnce.svg; objects.svg opens class chips)
- Detail: tag, Prompt \| Image, copy prompt, download WebP
- Placeholders EN/ES for prompt: write the prompt you’ll take to the engine
- `--text--` in the document editor opens name + prompt capture. Destination group: **Prompt & Image** (loose prompt ficha) or **Asset** (double-click existing to insert without Name; **Insert new** reveals Name and `createLibrarySet`). Copy on the captured prompt. Save / double-click opens Prompt or Asset detail.

## Atelier / wall color (Image + Video live)

- Field `wallColor` (`#RRGGBB`) on the ficha — production wall behind the asset.
- **Create/edit:** hex + color picker + **Apply** sits **under the image** in the media column; live behind upload preview.
- **Open Image/Video:** preview pane uses `resolveWallColor(wallColor)` (default `#151515`).
- Does not recolor the media pixels.
- FN does not generate images/video.

## Persistence

- Metadatos: `campaigns.library_items` jsonb (folder) · `campaigns.prompt_classes` jsonb · `nodes.library_items` jsonb (document) · `nodes.library_sets` jsonb (document sets) · `nodes.prompt_classes` jsonb
- Bytes: `doc-images` (WebP for images; raw attachments for skills); `scopeId` = folderId or nodeId
- SQL ops: `supabase_campaign_library_items.sql`; `supabase_node_library_items.sql`; `supabase_node_library_sets.sql`; `supabase_prompt_classes.sql`

## Live today (code)

- Grid: folder Prompt row + header Attachments · document Assets + Prompt (no Attachments)
- Prompt class chips beside Prompt (`All` / user names / `[+]`) + Loop/class toggles in the create/edit modal
- Prompt create/open + wallColor; Attachments create/open
- Persist `campaigns.library_items` + `campaigns.prompt_classes` + `nodes.library_items` + `nodes.library_sets` + `nodes.prompt_classes`
- Document Library button in `NodeQueryModal`; Folder | Docs toggle + subfolders when docs have fichas
- Document assets: `#i` create (metadata + image queue) · `#o` opens Assets tab · Folders.svg rows
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
8. ~~Document sets `/i` `/o`~~ → **assets** + `#i` `#o` + Assets tab (create queue live)
9. later: reuse main · `--script--` · mini strip · Atelier extras · Gina library tools · @tag
   Name invoke in prose (bold + autocomplete of image Names) is live. Dotted `ficha.asset` assign is live.  
