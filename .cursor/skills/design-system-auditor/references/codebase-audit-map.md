# Codebase audit map — Futura Nota

Use this map for **codebase fallback** when browser MCP is unavailable.

## Theme mechanism

| File | Role |
|------|------|
| `src/stores/themeStore.js` | Sets `data-theme="light"` on `<html>`; storage key `futuranota-theme` |
| `src/components/shared/ThemeToggle.jsx` | UI toggle |
| `src/App.jsx` | `applyTheme()` syncs accent typography with theme |

Dark = no `data-theme` attribute. Light = `data-theme="light"`.

## Token sources (read first)

| Area | Files |
|------|-------|
| App tokens | `src/styles.css` — `:root`, `:root[data-theme="light"]` |
| Docs / sidebar | `src/styles/left-panel.css` |
| Gina chat | `src/styles/gina-chat.css` |
| Canvas / timeline / dashboard | `src/styles.css` (lower sections) |
| Marketing | `src/marketing/styles/marketing.css`, `sections.css`, `landing-tweaks.css` |
| Agents / intel | `src/styles/agents.css`, `intel-reference.css`, `launch-predictor.css` |
| Todos / studio | `src/styles/lazy-todos.css`, `studio.css` |

## Grep patterns (debt indicators)

```bash
# Hardcoded dark surfaces
rg '#151515' src/styles --glob '*.css'

# Text that won't flip in light
rg 'color:\s*#fff' src/styles --glob '*.css'

# Invisible borders on light
rg 'rgba\(255,\s*255,\s*255' src/styles/left-panel.css

# Light overrides count
rg 'data-theme.*light' src --glob '*.css'

# Brand marks
rg '#dcb2a6|#f4a4be|#ffb4a8' src/styles --glob '*.css'
```

## Anchor selectors (browser computed style)

| Selector | Component |
|----------|-----------|
| `.dash` | Dashboard grid |
| `.left-panel` | Corpus sidebar |
| `.lp-click-folder-box` | Folder card |
| `.doc-new-modal` | Document modal |
| `.doc-new-inner--content-focus` | Expanded doc editor |
| `.cal-event-canvas` | Event calendar empty |
| `.canvas-stage` | Blueprint canvas |
| `.tl-tactical` | Timeline |
| `.gina-chat-overlay__panel` | Gina in-doc |
| `.theme-toggle` | Theme control |

## Overlays — do not propose light transform

Pin dark on these roots:

| Class / file | Backdrop |
|--------------|----------|
| `.url-table-page-overlay` | `src/styles/steps-runner.css` — `#0a0c10` |
| `.export-workspace-modal` | `src/styles/export-workspace-modal.css` |
| `.export-pack-modal` | `src/styles/export-pack-modal.css` |
| `.ie-pack-chooser` | `src/styles/ie-pack-chooser.css` |
| `.confirm-action-overlay` | `src/styles/confirm-action.css` |

## Product rules

- `.cursor/rules/surface-base-color.mdc` — `var(--surface-base)`; dark `#151515`, light `#F1F1F1`
- `.cursor/rules/scroll-match-bg.mdc` — `--scroll-bg` matches container
- `.cursor/rules/hover-consistency.mdc` — toolbar hover colors

## Known light debt (typical)

- `left-panel.css`: many `rgba(255,255,255,…)` borders/hovers
- `gina-chat.css`: surfaces tied to dark gradient
- Doc marks `#dcb2a6` need stronger mix on `#F1F1F1`
- Marketing has more `[data-theme="light"]` blocks than app workspace
