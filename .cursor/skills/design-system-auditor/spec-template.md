# Design System Spec — {{project_name}}

**Audited:** {{audited_at}}  
**Source:** {{source}}  
**Theme active:** {{theme}}  
**URL:** {{url_or_repo}}

---

## Executive summary

{{executive_summary}}

---

## Color palette (current)

### Backgrounds & surfaces

| Token | Value | Usage |
|-------|-------|-------|
| {{row}} | | |

### Text

| Role | Value |
|------|-------|
| Primary | {{text_primary}} |
| Secondary | {{text_secondary}} |
| Muted | {{text_muted}} |

### Accents

| Role | Value |
|------|-------|
| Brand / brush | {{accent_brand}} |
| HUD / mint | {{accent_hud}} |
| Doc marks | {{accent_mark}} |

### Borders & overlays

| Role | Value |
|------|-------|
| Subtle border | {{border_subtle}} |
| Overlay scrim | {{overlay_scrim}} |

---

## Typography

| Role | Family | Size | Weight | Line-height |
|------|--------|------|--------|-------------|
| Body | {{font_body}} | | | |
| Display | {{font_display}} | | | |
| Mono | {{font_mono}} | | | |
| Label | | 10–11px | 500–600 | |

---

## Spacing scale

| Token | Value | Samples |
|-------|-------|---------|
| xs | | |
| sm | | |
| md | | |
| lg | | |
| xl | | |

---

## Elevation & radius

**Shadows:** {{shadows_summary}}

**Radius:** sm {{radius_sm}} · base {{radius}} · lg {{radius_lg}}

---

## States

| State | Background | Border | Text |
|-------|------------|--------|------|
| hover | | | |
| active | | | |
| disabled | | | |

---

## Audit findings

### Hardcoded colors

{{hardcoded_colors_list}}

### Light theme gaps

{{light_theme_gaps_list}}

### Contrast issues

{{contrast_issues_list}}

---

## Transformation proposal

**Target theme:** {{target_theme}}

### New palette

{{new_palette_table}}

### Rationale

{{rationale}}

### Changes by component

{{changes_by_component_sections}}

### Do not transform

{{do_not_transform_list}}

---

## Next step

Run `@ui-system-transformer` with `.cursor/saved/design-system/design-system-spec.json` and scope `app` | `marketing` | `both`.
