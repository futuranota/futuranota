---
name: ui-system-transformer
description: >
  Implements a design system transformation from design-system-spec.json (or minimal
  new_palette + changes_by_component). Writes CSS tokens and component overrides for
  app, marketing, or both. Delivers code changes and transform-report.md. Use when the
  user says implement the palette, transform to light with this JSON, or invokes
  @ui-system-transformer with an attached spec. Requires output from design-system-auditor
  or equivalent JSON.
disable-model-invocation: true
---

# UI System Transformer

Recibe la paleta JSON del Skill 1 (`design-system-auditor`) e **implementa** el cambio visual en el codebase. Entrega código + reporte.

**No re-audita.** Asume spec aprobada.

## Diferenciación

| Skill | Scope |
|-------|-------|
| `ui-element-redesigner` | 1 componente + imagen |
| `design-system-auditor` | Extrae + propone (JSON/MD) |
| **`ui-system-transformer`** | Implementa sistema desde JSON |

## Inputs

**Requeridos:**

1. **Spec JSON** — una de:
   - `.cursor/saved/design-system/design-system-spec.json` (completo), **o**
   - Adjunto con mínimo `transformation_proposal.new_palette` + `changes_by_component`
2. **Scope:** `app` | `marketing` | `both` — preguntar si falta

**Opcionales:**

- Screenshot “así debe verse” — usar para validar jerarquía visual, no para inventar hex fuera del JSON
- Restricciones extra del user (ej. no tocar Gina)

Validar contra [input-schema.json](input-schema.json) antes de editar archivos.

## Outputs

1. **Código** — diffs en CSS (y JSX solo si el spec lo exige)
2. **Report:** `.cursor/saved/design-system/transform-report.md`

---

## Workflow

```
Transform Progress:
- [ ] 1. Validate input JSON
- [ ] 2. Map new_palette → :root tokens
- [ ] 3. Apply changes_by_component (priority order)
- [ ] 4. Systematic pattern replacements (light)
- [ ] 5. Pin do_not_transform overlays
- [ ] 6. Write transform-report.md
- [ ] 7. QA checklist (user or browser)
```

### Step 1 — Validate input

- Leer JSON; confirmar `transformation_proposal.new_palette` y `changes_by_component`
- Si solo hay `new_palette`, inferir component list from [references/futuranota-transform-map.md](references/futuranota-transform-map.md)
- Abort with clear message if JSON invalid

### Step 2 — Map tokens

**App** — [`src/styles.css`](../../../src/styles.css):

Extend `:root[data-theme="light"]` with semantic tokens from spec:

```css
--surface-base: #F1F1F1;
--text-primary: #3D3B3B;
--border-subtle: rgba(61, 59, 59, 0.12);
--border-strong: rgba(61, 59, 59, 0.22);
--hover-surface: rgba(61, 59, 59, 0.06);
--shadow-elevated: 0 24px 48px rgba(61, 59, 59, 0.12);
--accent-mark: #c48678;
--accent-mark-bg: rgba(196, 134, 120, 0.22);
```

Dark `:root` — **no regress** unless spec targets dark too.

**Marketing** (if scope `marketing` or `both`):

- `src/marketing/styles/marketing.css` `:root[data-theme="light"]`
- Align `--bg`, `--surface`, `--text`, `--beige` with spec

Prefer `var(--token)` over new hardcoded hex in component rules.

### Step 3 — changes_by_component (priority order)

Default order if spec unsorted — see [references/futuranota-transform-map.md](references/futuranota-transform-map.md):

1. `doc-new-modal` / doc editor / highlights
2. `lp-click-folder-box` / left panel / department filter
3. `cal-event-canvas` / intel panels
4. `canvas-stage` / `canvas-empty-card`
5. `tl-tactical` / timeline
6. `gina-chat` / viz tables
7. Marketing sections (if scope includes)

For each entry in spec: apply listed CSS changes in the mapped file.

### Step 4 — Systematic light patterns

On files in scope, replace dark-only patterns when safe:

| Dark pattern | Light replacement |
|--------------|-------------------|
| `rgba(255,255,255,0.06–0.14)` borders | `var(--border-subtle)` or `var(--hairline)` |
| `rgba(255,255,255,0.08)` hover bg | `var(--hover-surface)` |
| `color: #fff` (non-accent) | `var(--text-primary)` |
| `#151515` backgrounds | `var(--surface-base)` |
| `filter: brightness(0) invert(1)` icons | light rule: `brightness(0)` only |

**Skip** inside `do_not_transform` roots and accent-on-solid buttons (mint CTAs, avatar gradients).

### Step 5 — do_not_transform

Pin on overlay roots (from spec or defaults):

```css
.url-table-page-overlay,
.export-workspace-modal,
.export-pack-modal,
.ie-pack-chooser,
.confirm-action-overlay {
  --surface-base: #151515;
  --text-primary: #fff;
  --text: #e8e4dc;
}
```

Do not replace `#0a0c10` / `#14181f` shells in these files.

### Step 6 — transform-report.md

Write `.cursor/saved/design-system/transform-report.md`:

- Scope (`app` / `marketing` / `both`)
- Files changed (list)
- Tokens added/updated
- Components touched vs spec
- Pending / manual QA items
- Link to [implementation-checklist.md](implementation-checklist.md)

### Step 7 — QA

Run checklist from [implementation-checklist.md](implementation-checklist.md). Browser verify if dev server available.

---

## Scope matrix

| Scope | Files |
|-------|-------|
| `app` | `src/styles.css`, `src/styles/left-panel.css`, `gina-chat.css`, `lazy-todos.css`, `studio.css`, intel CSS |
| `marketing` | `src/marketing/styles/*.css` |
| `both` | All above |

Never change overlay dark shells unless spec explicitly removes them from `do_not_transform`.

---

## Additional resources

- Input schema: [input-schema.json](input-schema.json)
- QA checklist: [implementation-checklist.md](implementation-checklist.md)
- Component → file map: [references/futuranota-transform-map.md](references/futuranota-transform-map.md)
- Auditor output: `.cursor/saved/design-system/design-system-spec.json`
