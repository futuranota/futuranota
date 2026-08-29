# Futura Nota — component → file transform map

Use when `changes_by_component` keys need file targets or default implementation order.

## Priority order

1. Document shell
2. Left panel / folders
3. Right panel / calendar / intel
4. Canvas / blueprint
5. Timeline
6. Gina
7. Marketing

## Component keys → files

| Component key | Primary CSS | Selectors / notes |
|---------------|-------------|-------------------|
| `doc-new-modal` | `src/styles/left-panel.css` | `.lp-modal.doc-new-modal`, `.doc-new-inner`, `.doc-focus-top` |
| `doc-editor` | `src/styles/left-panel.css` | `.doc-new-content-box`, `.doc-new-body-field`, marks `#dcb2a6` |
| `doc-highlights` | `src/styles/left-panel.css` | `.doc-slash-*`, selection, `#dcb2a6`, `#ffb4a8` |
| `lp-click-folder-box` | `src/styles/left-panel.css` | `.lp-click-folder-box`, hover states |
| `lp-department-filter` | `src/styles/left-panel.css` | `.lp-department-filter__control` |
| `left-panel` | `src/styles/left-panel.css` | `.left-panel`, `.lp-selectors`, toolbar |
| `cal-event-canvas` | `src/styles.css` | `.cal-event-canvas__*` |
| `intel-panel` | `src/styles.css`, `intel-reference.css` | `.intel-*` |
| `canvas-stage` | `src/styles.css` | `.canvas-stage`, `.canvas-empty-card` |
| `canvas-toolbar` | `src/styles.css` | `.canvas-toolbar`, `.canvas-tool` |
| `tl-tactical` | `src/styles.css` | `.timeline.tl-tactical`, `.tl-tactical-view-toggle` |
| `gina-chat` | `src/styles/gina-chat.css` | `.gina-chat-*`, `.gina-viz__*` |
| `lazy-todos` | `src/styles/lazy-todos.css` | todo dashboard |
| `studio` | `src/styles/studio.css` | studio shell |
| `marketing-nav` | `src/marketing/styles/sections.css` | `.nav`, `.blog-nav-mega` |
| `marketing-canvas-bg` | `src/marketing/styles/marketing.css` | `.canvas-bg` |
| `marketing-cards` | `src/marketing/styles/marketing.css`, `sections.css` | `.card`, `.blogs__*` |

## Token write targets

| Scope | File | Block |
|-------|------|-------|
| app | `src/styles.css` | `:root`, `:root[data-theme="light"]` |
| app light overrides | `src/styles.css` | trailing `[data-theme="light"]` section |
| marketing | `src/marketing/styles/marketing.css` | `:root[data-theme="light"]` |

## do_not_transform — default list

| Key | File |
|-----|------|
| `url-table-page-overlay` | `src/styles/steps-runner.css` |
| `export-workspace-modal` | `src/styles/export-workspace-modal.css` |
| `export-pack-modal` | `src/styles/export-pack-modal.css` |
| `ie-pack-chooser` | `src/styles/ie-pack-chooser.css` |
| `confirm-action-overlay` | `src/styles/confirm-action.css` |

Pin pattern at end of `src/styles.css` or on each overlay root:

```css
--surface-base: #151515;
--text-primary: #fff;
```

## Systematic replacements (light scope)

Apply in mapped files after token write:

- `rgba(255, 255, 255, 0.0X)` border/bg → `var(--border-subtle)` / `var(--hover-surface)`
- `color: #fff` → `var(--text-primary)` except accents-on-solid
- `#151515` bg → `var(--surface-base)` except overlay pins

## Related rules

- `.cursor/rules/surface-base-color.mdc`
- `.cursor/rules/scroll-match-bg.mdc`
- `.cursor/rules/hover-consistency.mdc`
