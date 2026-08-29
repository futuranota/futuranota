---
name: design-system-auditor
description: >
  Audits a live page or codebase CSS to extract the design system (colors, typography,
  spacing, elevation, radius, states), detect semantic patterns, assess visual coherence,
  and propose theme transformations (dark to light or new palette). Delivers
  design-system-spec.json and design-system-spec.md. Use when the user asks to audit
  the design system, extract a palette, propose light theme, run a design system audit,
  or transform dark to light from URL or active theme. Invoke with @design-system-auditor.
disable-model-invocation: true
---

# Design System Auditor

Extrae el design system del producto (dark o light activo), detecta incoherencias, y propone una transformación lista para implementar con `ui-system-transformer`.

**No implementa CSS.** Solo audita y especifica.

## Diferenciación

| Skill | Scope |
|-------|-------|
| `ui-element-redesigner` | 1 componente + imagen de referencia |
| `visual-intent-brief` | Intención vaga, sin spec formal |
| **`design-system-auditor`** | Sistema completo: extrae + propone |
| `ui-system-transformer` | Implementa paleta desde JSON (Skill 2) |

## Inputs

**Requeridos (al menos uno):**
- URL accesible (ej. `http://localhost:5173/app`) con theme activo, **o**
- Repo local + indicación de theme (`dark` | `light`)

**Opcionales:**
- `target_theme`: `light` | `dark` | `custom` (default: opuesto al theme auditado, o lo que pida el user)
- Restricciones de producto (ej. base `#F1F1F1`, overlays dark)
- Screenshots adjuntos

Si falta URL y no hay repo → pedir URL o confirmar que audite solo codebase.

## Outputs (obligatorios)

Escribir siempre en:

```
.cursor/saved/design-system/design-system-spec.json
.cursor/saved/design-system/design-system-spec.md
```

- JSON: estructura en [output-schema.json](output-schema.json)
- Markdown: rellenar [spec-template.md](spec-template.md)

Informar al user las rutas al terminar.

---

## Workflow

Copiar checklist y marcar progreso:

```
Audit Progress:
- [ ] 1. Detect active theme
- [ ] 2. Collect data (browser → fallback codebase)
- [ ] 3. Extract tokens by category
- [ ] 4. Detect semantic color patterns
- [ ] 5. Coherence + contrast audit
- [ ] 6. Build transformation proposal
- [ ] 7. Write JSON + MD specs
```

### Step 1 — Detect active theme

**Browser (si disponible):**
```js
document.documentElement.getAttribute("data-theme") || "dark"
```

**Codebase fallback:**
- [`src/stores/themeStore.js`](../../../src/stores/themeStore.js) — `data-theme="light"` en `<html>`
- Presencia de `:root[data-theme="light"]` en CSS

Registrar en `meta.theme`.

### Step 2 — Collect data

**A) Browser first** (`cursor-ide-browser` MCP):

1. `browser_navigate` a la URL del user
2. `browser_snapshot` — dashboard shell
3. Si el user pide profundidad: abrir doc modal, panel Calendar, Gina
4. CDP `Runtime.evaluate` — `getComputedStyle` en selectores ancla:

| Selector | Qué capturar |
|----------|----------------|
| `body`, `.dash` | background, color, font |
| `.left-panel` | surface, borders |
| `.doc-new-modal` | modal bg, shadow, text |
| `.cal-event-canvas` | empty state text |
| `.canvas-stage` | grid / background |
| `.label`, `.dim` | secondary text |

5. Opcional: hover states si el user lo pide

**B) Fallback codebase** (browser falla, skip, o user pide solo código):

Leer [references/codebase-audit-map.md](references/codebase-audit-map.md) y:

1. Parsear `:root` y `:root[data-theme="light"]` en `src/styles.css`, marketing CSS
2. Grep hardcodes: `#151515`, `#fff`, `rgba(255, 255, 255`, `#dcb2a6`, `#f4a4be`
3. Contar `data-theme="light"` overrides vs hardcodes sin override
4. Listar archivos con más deuda light (típico: `left-panel.css`, `gina-chat.css`)

Set `meta.source`: `browser` | `codebase` | `hybrid`.

### Step 3 — Extract tokens by category

Poblar `design_system`:

| Category | Fields |
|----------|--------|
| **colors** | background, surface, elevated, text (primary/secondary/muted), accent (brand/hud/danger), border, overlay |
| **typography** | families, sizes (body, label, mono), weights, line-heights |
| **spacing** | scale (xs–xl), common padding/gaps from samples |
| **elevation** | shadow-sm, shadow, shadow-lg, modal shadow |
| **radius** | sm, base, lg, xl |
| **states** | hover, active, disabled (bg, border, color) |

Preferir valores de `:root` tokens; anotar computed solo donde difiera del token.

### Step 4 — Detect semantic patterns

Clasificar colores repetidos:

- **Primary text** — `--text`, `--text-primary`
- **Secondary** — `--text-2`, `--dim`, `--mute`
- **Surfaces** — `--bg`, `--surface-base`, `--panel-solid`, `--doc-focus-surface`
- **Accents** — `--hud`, `--brand-brush`, `#dcb2a6` (doc marks)
- **Borders** — `--hairline`, `--glass-border`, `rgba(255,255,255,…)` hardcodes
- **Overlays dark-only** — `.url-table-page-overlay`, export modals

### Step 5 — Coherence + contrast audit

Poblar `audit_findings`:

- **hardcoded_colors** — hex/rgba que no usan `var(--*)`
- **light_theme_gaps** — patrones dark-only (white rgba borders on light bg)
- **contrast_issues** — pares texto/fondo con ratio estimado bajo (WCAG AA ~4.5:1 body, 3:1 large)

Futura Nota defaults ya cerrados (usar si el user no contradice):

- Light base: `#F1F1F1`, text: `#3D3B3B`
- Uniform surface (sidebar = canvas = docs)
- Fullscreen overlays stay dark

### Step 6 — Transformation proposal

Poblar `transformation_proposal`:

- `target_theme`
- `new_palette` — tokens semánticos completos (no solo 2 hex)
- `rationale` — 1–3 párrafos
- `changes_by_component` — mapa componente → lista de cambios CSS
- `do_not_transform` — overlay roots, Gina popovers on dark cards, etc.

Derivar light palette cuando aplique:

```text
--border-subtle: rgba(61, 59, 59, 0.12)
--border-strong: rgba(61, 59, 59, 0.22)
--hover-surface: rgba(61, 59, 59, 0.06)
--shadow-elevated: 0 24px 48px rgba(61, 59, 59, 0.12)
--accent-mark: #c48678 (stronger coral on light)
--accent-mark-bg: rgba(196, 134, 120, 0.22)
```

### Step 7 — Write deliverables

1. Validar JSON contra [output-schema.json](output-schema.json)
2. Escribir `.cursor/saved/design-system/design-system-spec.json`
3. Rellenar [spec-template.md](spec-template.md) → `.cursor/saved/design-system/design-system-spec.md`
4. Resumir al user: theme auditado, gaps críticos, próximo paso → `@ui-system-transformer`

---

## Handoff to Skill 2

```
@ui-system-transformer implementa .cursor/saved/design-system/design-system-spec.json scope: both
```

---

## Additional resources

- JSON schema: [output-schema.json](output-schema.json)
- MD template: [spec-template.md](spec-template.md)
- Futura Nota example: [examples.md](examples.md)
- Codebase map: [references/codebase-audit-map.md](references/codebase-audit-map.md)
