# Gina AI Chat Card — reference for insert-from-doc

**Role:** UI shell opened when the user presses **Call Asistente / Gina** inside a document.

**Source:** Magic/demo `AIChatCard` (framer-motion chat card). Saved for adaptation — not dropped into production as-is.

## Files

| File | Purpose |
|---|---|
| `AIChatCard.original.tsx` | Exact paste from the user (TS + `"use client"` + `cn` + lucide) |
| `GinaChatCard.jsx` | Repo-oriented JSX draft (no `cn`, no lucide, surface `#151515`, Asistente/Gina copy) |
| `gina-chat-card.css` | Companion styles for the JSX draft |

## Insert contract

- Trigger: button inside open **document** (not timeline alarms).
- Mount: overlay / panel over the doc workspace (same spirit as other doc overlays).
- Identity: **Gina / Asistente** — replace “AI Assistant” / robot emoji demo copy.
- Base fill: `#151515` (see `surface-base-color` rule).
- Motion: keep framer-motion (already in `package.json`); do **not** add `lucide-react` or shadcn `cn` unless the project adopts them.
- Behavior later: wire messages to Gina tools (`get_today_tasks`, `create_todo`, …) — this save is **visual + interaction shell** only.
- Demo reply / fake timeout: remove when Claude + tools land.

## Do not

- Copy Next.js `"use client"` or `@/` aliases blindly.
- Assume Tailwind utility classnames match Magic MCP output 1:1 — prefer the CSS file or existing app patterns when integrating.
- Connect real AI until the Gina brief phase says so.

See also: `.cursor/rules/gina-assistant-system.mdc`, `assistant-single-card-roadmap.mdc`.
