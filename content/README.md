# Marketing content (Phase 1)

JSON under `content/marketing/` is the source of truth for the public marketing site (`src/marketing/`). The app loads it via `src/marketing/lib/content.js`.

## Edit in Tina

1. Copy `.env.example` to `.env.local` (Client ID, `TINA_TOKEN`, `TINA_SEARCH_TOKEN`, optional `TINA_PREVIEW_URL`).
2. Run **`npm run dev:tina`** — starts **Tina** (port **4001**) and **Vite** (port **5173**). `npm run dev` is Vite only; `/admin` then talks to **Tina Cloud**, not these JSON files.
3. Wait for **TinaCMS Dev Server is active** in the terminal.
4. Open **http://localhost:5173/admin/index.html**.

The public site (`/blogs/...`) reads Tina Cloud (or local GraphQL) first, then falls back to these JSON files. Cloud Save does **not** rewrite the JSON until you pull the GitHub commit Tina made — or save while `dev:tina` is writing to disk.

## Visual preview (editor + your site side by side)

The collection list and form-only view (e.g. `site.json` with Nav/Footer fields) is **not** the preview. The split layout appears **inside a document** after you enable Preview.

### Step by step

1. Stop old dev servers (if needed):
   ```bash
   lsof -ti:5173,5174,4001,9000 | xargs kill -9
   ```
2. `npm run dev:tina`
3. Confirm Tina is up: `curl -I http://localhost:4001/src/main.tsx` → **200**
4. Open **http://localhost:5173/admin/index.html**
5. In the left sidebar, choose **Home page** (best first test — not Site).
6. Open **`home.json`**
7. In the **top toolbar of the document editor** (not the collections sidebar), click **Preview** (split-panel / external-preview icon in Tina 3.9).
8. Your landing loads in the panel beside the form (`http://localhost:5173/`).
9. Edit a field (e.g. hero **lead**) → the iframe updates live.
10. Click text in the preview → the form focuses that field (quick edit).

### Collection → preview URL

| Tina collection | JSON file | Preview shows |
|-----------------|-----------|---------------|
| Site (nav & footer) | `site.json` | `/` |
| Home page | `home.json` | `/` |
| Horizon page | `horizon.json` | `/horizon` |
| How it works | `how.json` | `/how` |
| Marketplace | `marketplace.json` | `/marketplace` |
| Blogs page | `blogs-page.json` | `/blogs` |
| Blog articles | `blogs/*.json` | `/blogs/{slug}` (ej. `/blogs/how-to-read-a-launch-campaign`) |

Override the preview origin if Vite uses another host/port:

```env
TINA_PREVIEW_URL=http://localhost:5173
```

### What is already wired in code

- `useTina` + `tinaField` on marketing pages (visual editing in the preview iframe).
- Blog posts: open `blogs/your-slug.json` in admin → Preview opens `/blogs/your-slug` → click title, excerpt, or body in the iframe to edit inline.
- `ui.previewUrl` and `ui.router` in `tina/config.ts`.
- Tina GraphQL client loads **only in dev**; production uses static JSON.

You do **not** need Next.js routes like `/api/preview/enter` or `onLogin` redirects — those do not apply to this Vite setup.

## “Failed loading TinaCMS assets”

The admin UI could not reach Tina’s dev server on **http://localhost:4001**.

| Cause | Fix |
|--------|-----|
| Only `vite` / `npm run preview` running | Stop it; run `npm run dev:tina` |
| Port 5173 taken | Kill processes on 5173/5174/4001, then `npm run dev` |
| Tina dev never started | Check terminal errors; confirm `.env.local` has `TINA_PUBLIC_CLIENT_ID` and `TINA_TOKEN` |

## Files

| File | Purpose |
|------|---------|
| `site.json` | Nav links, footer, blog mega-menu |
| `home.json` | Home hero, directory, final CTA |
| `horizon.json` | Horizon page |
| `how.json` | How it works |
| `marketplace.json` | Marketplace kits |
| `blogs-page.json` | Blogs wall + category filters |
| `blogs/*.json` | Individual articles |

## Tina Cloud (optional)

For hosted editing and previews, create a project at [tina.io](https://tina.io):

1. **Client ID** (UUID) → `TINA_PUBLIC_CLIENT_ID`
2. **Content** (read-only) → `TINA_TOKEN`
3. **Search** (indexer) → `TINA_SEARCH_TOKEN`

All three go in `.env.local` (exact names). Required for `npm run build:tina`. Commit `tina/tina-lock.json` after running `npm run dev:tina` once with credentials set.
