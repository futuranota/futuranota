# Marketing content (Phase 1)

JSON under `content/marketing/` is the source of truth for the public marketing site (`src/marketing/`). The app loads it via `src/marketing/lib/content.js`.

## Edit in Tina

1. Copy `.env.example` to `.env.local` if you use Tina Cloud (optional for local-only editing).
2. Run `npm run dev` (starts Vite + Tina).
3. Open **http://localhost:5173/admin/index.html** (served from `public/admin/` after `npm run build`, or via Tina when running `npm run dev`) to edit copy, nav, footer, blog posts, and page sections.

Changes are written back to the JSON files in this folder. Commit them like any other content.

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

For hosted editing and previews, create a project at [tina.io](https://tina.io) and set `TINA_PUBLIC_CLIENT_ID` and `TINA_TOKEN` in `.env.local`. Commit `tina/tina-lock.json` after running `npm run dev` locally once.
