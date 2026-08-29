# Transform Report — Frame 35 light (pass 3)

**Date:** 2026-08-29  
**Scope:** `both` (app; doc modal + dashboard controls)  
**Reference:** `public/uploads/Frame 35.svg`  
**Spec:** `.cursor/saved/design-system/design-system-spec.json`

## North star

Light theme with **dimension + warm color** — not flat pale gray. Raised controls use:

- Fill: `#FFF8D3` @ 20% (`--raised-fill`)
- Border: `rgba(0,0,0,0.06)` (`--raised-border`)
- Shadow: `0 3px 8px rgba(218,218,218,0.92)` (`--shadow-raised`)
- Radius: `4px` (`--raised-radius`)

## Tokens added (`:root[data-theme="light"]`)

| Token | Role |
|-------|------|
| `--raised-fill` / `--raised-fill-hover` | Warm cream chip fill |
| `--shadow-raised` / `--shadow-raised-lg` | Frame 35 elevation |
| `--elevated-surface` | Maps to raised fill (folders, toolbar, filters) |
| `--segment-track` / `--segment-thumb` | Intel tabs + 7d/15d/31d (white thumb + shadow) |
| `--meta-drawer-bg` | Doc meta Ajustes drawer |
| `--btn-primary-*` | Save = coral gradient + white text + shadow |
| `--marker-ink-default` | Stronger body highlights on light |

Dark `:root` keeps prior values; `--shadow-raised: none` on dark.

## Files changed

| File | Change |
|------|--------|
| `src/styles.css` | Frame 35 token block; segment/calendar shadow |
| `src/styles/left-panel.css` | Folder boxes, meta drawer, Save, Ajustes, markers |
| `src/styles/pack-wizard.css` | Toolbar raised + shadow |
| `src/styles/light-theme-overrides.css` | Doc modal icons, Aa, markers, canvas card |

## Surfaces updated

- Folder boxes (Documents / Departments / Assistance)
- Pack toolbar (STEP BY STEP, QLOOPS, TO DO)
- Department filter
- Intel folder tabs + forecast range switch
- Calendar search pill
- Canvas empty card
- **Doc modal:** meta drawer, Save, Ajustes, text markers, Aa/larger visibility
- Gina chat inner shadow

## QA (manual)

1. Toggle sun on `/app` — folder cards should show **warm tint + soft shadow**
2. Open doc (e.g. Marco's life) — Save coral visible; CREATED/CATEGORY values readable; Ajustes chip raised
3. Body highlights (marks) visible on white
4. Dark theme — no regression (shadows off on raised tokens)

## Pending

- `left-panel.css` deep doc-editor rules still have legacy `#d8d8d8` / white rgba in low-traffic paths
- Marketing pages — Frame 35 not yet applied to landing cards
- Browser sign-off pending
