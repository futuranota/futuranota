# Thumbnail Image Viewer

Archive paste (not live). Do not port until asked.

## Files

- `ThumbnailImageViewer.original.tsx` — gallery stage + thumb strip + prev/next
- `ThumbnailImageViewer.demo.tsx` — showcase timeline demo wrapper

## Shape

- Props: `images[]` (`src`, `alt`, `title`, `location?`, `credit?`), optional controlled `state.active`
- Stage 16/10, location badge, circular arrows, numbered thumbnails (tablist + keyboard)
- Original uses Tailwind + shadcn tokens (`bg-card`, `border-border`, etc.)

## Port notes (when building)

- JSX + CSS in the target surface (likely prompt Assets). No `lucide-react`, `cn`, or `@/` aliases.
- Surface = `var(--surface-base)` where it joins the document system.
- Map `images` from prompt assets (`assetDisplayUrl` / name); drop demo placeholders and “Collected / Vol. 01” chrome unless product wants it.
- Prefer existing Assets pager/copy/download behavior over duplicating chrome.
