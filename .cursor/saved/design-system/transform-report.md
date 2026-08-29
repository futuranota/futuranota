# Transform Report — Light theme pass 2 (solid tokens)

**Date:** 2026-08-29  
**Scope:** `both` (app + marketing)  
**Spec:** `.cursor/saved/design-system/design-system-spec.json`  
**Strategy:** Opción A — semantic tokens in base CSS (not override patches)

## Summary

Second pass migrates **base CSS** to shared semantic tokens so dark and light use the same selectors. Fixes the visible screenshot issues: black intel tabs, dark range switch, washed folder boxes, flat calendar pill.

## New semantic tokens (`:root` + `:root[data-theme="light"]`)

| Token | Purpose |
|-------|---------|
| `--segment-track` / `--segment-thumb` / `--segment-label-*` | Intel folder tabs, forecast 7d/15d/31d |
| `--elevated-surface` / `--elevated-surface-hover` | Folder boxes, toolbar chips, department filter |
| `--folder-box-border` / `--control-border` | Visible borders on light; transparent folder border on dark |
| `--cal-search-pill-bg` | Calendar date pill |
| `--shadow-card` / `--shadow-modal` | Canvas empty card, doc modal, studio |
| `--interactive-muted` / `--interactive-subtle` | Secondary UI text |
| `--gina-card-bg` | Flat surface on light; gradient on dark |

## Files changed (pass 2)

| File | Change |
|------|--------|
| `src/styles.css` | Token blocks + intel tabs + forecast switch + cal pill + canvas-empty shadow |
| `src/styles/left-panel.css` | `lp-click-folder-box`, department filter, `doc-new-modal` |
| `src/styles/pack-wizard.css` | Toolbar buttons → elevated tokens |
| `src/styles/gina-chat.css` | Mass migration white rgba → semantic tokens |
| `src/styles/studio.css` | Borders, text, shadows → tokens |
| `src/styles/light-theme-overrides.css` | **Trimmed** — icon filters, accent-mark, cal pill hover only |

## Components — pass 2 status

| Component | Status |
|-----------|--------|
| Intel folder tabs (Calendar…) | ✅ `--segment-*` tokens |
| Forecast range switch (7d/15d/31d) | ✅ same segment tokens |
| Calendar search pill | ✅ `--cal-search-pill-bg` + light hover override |
| Folder boxes (Documents…) | ✅ `--elevated-surface` + `--folder-box-border` |
| Department filter | ✅ `--control-border` |
| Pack toolbar | ✅ elevated tokens |
| Doc modal | ✅ border + `--shadow-modal` |
| Canvas empty card | ✅ `--shadow-card` |
| Gina chat shell | ✅ major white-rgba debt cleared |
| Studio panel | ✅ partial token migration |

## Remaining debt

- `left-panel.css`: ~90+ `rgba(255,255,255,*)` in doc editor / library / menus (lower traffic)
- `gina-chat.css`: ~60 remaining (viz edge cases, shimmer, typing dots)
- `lazy-todos.css`: dashboard overlay intentionally dark shell
- Browser QA not run this session — **toggle sun and re-check your dashboard screenshot**

## do_not_transform

Unchanged — URL table, export modals, ie-pack-chooser, confirm, pack-wizard pin.

## QA checklist

See [implementation-checklist.md](../../skills/ui-system-transformer/implementation-checklist.md)
