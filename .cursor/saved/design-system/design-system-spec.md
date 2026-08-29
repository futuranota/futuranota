# Design System Spec — Futura Nota

**Audited:** 2026-08-29T19:15:00Z  
**Source:** hybrid (browser + codebase)  
**Theme active:** dark  
**URL:** http://localhost:5173/app

---

## Executive summary

Auditoría híbrida de `/app` con **dark activo** (toggle ☾ pressed, `data-theme` ausente). El sistema dark **Lumen v0.5** es coherente: gradiente `#07090c`, superficies `#151515`, texto `#e6e9ee`, acentos mint + coral.

Los tokens light (`#F1F1F1` / `#3D3B3B`) ya existen en `:root[data-theme="light"]`, pero **~350 reglas** en CSS siguen usando bordes/hovers `rgba(255,255,255,…)` pensados para dark. En light eso deja la UI **plana e invisible** — el problema que reportaste.

**Propuesta:** light uniforme `#F1F1F1` con detalles dibujados en tinta `#3D3B3B` (bordes, hovers, sombras suaves, marks coral reforzados). Overlays fullscreen **siguen dark**.

**Próximo paso:** `@ui-system-transformer` con este JSON, scope `both`.

---

## Color palette (current — dark)

### Backgrounds & surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#07090c` | Body gradient base |
| `--bg-2` | `#0c1014` | Gradient stop |
| `--panel-solid` | `#14181e` | Solid panels |
| `--surface-base` | `#151515` | Docs, modals |
| `--doc-focus-surface` | `rgb(22, 26, 29)` | Editor focus |
| Folder box (computed) | `rgba(35, 39, 47, 0.56)` | `.lp-click-folder-box` |

### Text

| Role | Value |
|------|-------|
| Primary | `#e6e9ee` (computed `rgb(230, 233, 238)`) |
| Secondary | `#b1b6c0` |
| Dim | `#757b87` |
| Toolbar muted | `#7A818B` (hardcoded) |
| Calendar hint (computed) | `rgb(177, 182, 192)` |

### Accents

| Role | Value |
|------|-------|
| HUD / mint | `#8ee9a3` |
| Brand brush | `#f4a4be` |
| Doc marks | `#dcb2a6` |
| AI lavender | `#c9b8ff` |
| Danger | `#ff7a85` |

### Borders & overlays

| Role | Value |
|------|-------|
| Subtle border | `rgba(255,255,255,0.06)` — `--glass-border` |
| Hairline | `rgba(255,255,255,0.045)` |
| Overlay scrim | `rgba(0,0,0,0.72)` |
| URL table shell | `#0a0c10` → `#14181f` gradient |

---

## Typography

| Role | Family | Size | Weight | Line-height |
|------|--------|------|--------|-------------|
| Body | Hanken Grotesk | 13px | 400 | 1.5 |
| Display | Space Grotesk | — | — | — |
| Doc | Hanken Grotesk | 14px | 400 | 1.45 |
| Mono | JetBrains Mono | — | — | — |
| Label | Hanken Grotesk | 10.5px | 500 | uppercase 0.08em |

---

## Spacing scale

| Token | Value | Samples |
|-------|-------|---------|
| xs | 4px | Icon gaps |
| sm | 6px | Head gaps |
| md | 10px | `dash-main` gap/pad |
| lg | 16px | Modal sections |
| xl | 24px | Overlay pad |

**Layout:** dashboard grid `256px | 1fr | 328px`.

---

## Elevation & radius

**Shadows:** `--shadow-sm` → `--shadow-lg`; modal doc `0 28px 64px rgba(0,0,0,0.68)`.

**Radius:** sm 6px · base 10px · lg 14px · modal 14px.

---

## States (dark)

| State | Background | Border | Text |
|-------|------------|--------|------|
| hover folder | `rgba(42,46,56,0.72)` | — | `#e8dcc8` |
| hover toolbar | `rgba(255,255,255,0.08)` | lighter white | `#fff` |
| active theme | mint mix panel | — | `--text` |

---

## Audit findings

### Hardcoded colors

- `left-panel.css`: **100×** `rgba(255,255,255,…)`
- `gina-chat.css`: **101×** `rgba(255,255,255,…)`
- `steps-runner.css`: **100×** (mayoría URL table — mantener dark)
- `studio.css`: **74×** · `lazy-todos.css`: **44×**
- `#7A818B` toolbar · `#dcb2a6` marks sin token semántico

### Light theme gaps

- Tokens light en `:root` pero pocos overrides por componente en app
- Superficie uniforme sin capa de elevación (borde/sombra)
- Iconos `invert(1)` sin regla light
- Gina gradients aún orientados a dark

### Contrast issues (light target)

- `#7A818B` on `#F1F1F1` — fail AA small text → usar `#5C5A5A`
- Marks `#dcb2a6` on `#F1F1F1` — necesitan `--accent-mark-bg`

---

## Transformation proposal

**Target theme:** light

### New palette

| Token | Value |
|-------|-------|
| Background / surface | `#F1F1F1` (uniforme) |
| Text primary | `#3D3B3B` |
| Text secondary | `#5C5A5A` |
| Border subtle | `rgba(61,59,59,0.12)` |
| Border strong | `rgba(61,59,59,0.22)` |
| Hover surface | `rgba(61,59,59,0.06)` |
| Shadow elevated | `0 24px 48px rgba(61,59,59,0.12)` |
| Accent mark | `#c48678` |
| Accent mark bg | `rgba(196,134,120,0.22)` |
| HUD (light) | `#2a8a4a` |

### Rationale

Uniform `#F1F1F1` cumple tu restricción de producto. La profundidad en light viene de **tinta** (bordes, hovers, sombras), no de grises escalonados. Los overlays fullscreen permanecen dark para contraste operativo (URL table, export). Dark mode no se modifica.

### Changes by component

**doc-new-modal** — borde sutil, sombra light, marks coral reforzados  
**doc-editor** — texto/caret/selection con tokens ink  
**lp-click-folder-box** — fill/border/hover ink-based  
**lp-department-filter** — quitar glass dark  
**left-panel-toolbar** — hovers sin `#fff`  
**cal-event-canvas** — título/hint legibles  
**canvas-stage / toolbar** — grid y CTAs con contraste  
**tl-tactical** — toggle activo ink  
**gina-chat** — flat surface + bordes en light  
**lazy-todos / studio** — tokens semánticos  
**marketing** — alinear a `#F1F1F1` / `#3D3B3B`

### Do not transform

- `url-table-page-overlay`
- `export-workspace-modal`
- `export-pack-modal`
- `ie-pack-chooser`
- `confirm-action-overlay`

---

## Next step

```
@ui-system-transformer implementa .cursor/saved/design-system/design-system-spec.json scope: both
```

Revisa el JSON completo en `.cursor/saved/design-system/design-system-spec.json`.
