# Example — Futura Nota dark audit → light proposal

Snippet derived from `src/styles.css` tokens. Full file goes to `.cursor/saved/design-system/design-system-spec.json`.

## Invocation

```
@design-system-auditor audita /app con dark activo, propón light uniforme F1F1F1 texto 3D3B3B, overlays dark
```

## Sample JSON (abbreviated)

```json
{
  "meta": {
    "source": "codebase",
    "url": "http://localhost:5173/app",
    "theme": "dark",
    "audited_at": "2026-08-29T18:00:00Z",
    "project": "futura-nota"
  },
  "design_system": {
    "colors": {
      "background": { "base": "#07090c", "surface": "#151515", "elevated": "#14181e" },
      "text": { "primary": "#e6e9ee", "secondary": "#b1b6c0", "muted": "#757b87" },
      "accent": { "hud": "#8ee9a3", "brand_brush": "#f4a4be", "doc_mark": "#dcb2a6", "ai": "#c9b8ff" },
      "border": { "subtle": "rgba(255,255,255,0.06)", "strong": "rgba(255,255,255,0.16)" },
      "overlay": { "scrim": "rgba(0,0,0,0.72)", "shell": "#14181f" }
    },
    "typography": {
      "families": { "body": "Hanken Grotesk", "display": "Space Grotesk", "mono": "JetBrains Mono" },
      "scale": { "body": "13px", "doc": "14px", "label": "10.5px" }
    },
    "spacing": { "dash_gap": "10px", "panel_pad": "8px 10px" },
    "elevation": {
      "shadow_sm": "0 1px 2px rgba(0,0,0,0.18)",
      "modal": "0 28px 64px rgba(0,0,0,0.68)"
    },
    "radius": { "sm": "6px", "base": "10px", "lg": "14px" },
    "states": {
      "hover": { "folder_box": "rgba(42,46,56,0.72)" }
    }
  },
  "audit_findings": {
    "hardcoded_colors": [
      "left-panel.css: ~100 rgba(255,255,255,*) borders/hovers",
      "gina-chat.css: dark gradients on var(--surface-base)"
    ],
    "light_theme_gaps": [
      "White rgba borders invisible on #F1F1F1",
      "Doc marks #dcb2a6 washed on light surface",
      "Calendar .cal-event-canvas__title was #ffffff"
    ],
    "contrast_issues": [
      "Secondary labels #7A818B on #F1F1F1 may fail AA for small text"
    ]
  },
  "transformation_proposal": {
    "target_theme": "light",
    "new_palette": {
      "background": { "base": "#F1F1F1", "surface": "#F1F1F1", "elevated": "#F1F1F1" },
      "text": { "primary": "#3D3B3B", "secondary": "#5C5A5A", "muted": "#6E6C6C" },
      "border": { "subtle": "rgba(61,59,59,0.12)", "strong": "rgba(61,59,59,0.22)" },
      "hover": { "surface": "rgba(61,59,59,0.06)" },
      "elevation": { "modal": "0 24px 48px rgba(61,59,59,0.12)" },
      "accent": { "doc_mark": "#c48678", "doc_mark_bg": "rgba(196,134,120,0.22)" }
    },
    "rationale": "Uniform #F1F1F1 keeps sidebar, canvas, and docs aligned. Ink-based borders and hovers replace white rgba so drawn details remain visible. Stronger coral marks preserve brand highlights on light.",
    "changes_by_component": {
      "doc-new-modal": [
        "Add border 1px var(--border-subtle)",
        "Replace modal shadow with --shadow-elevated",
        "Retune #dcb2a6 marks to --accent-mark"
      ],
      "lp-click-folder-box": [
        "Replace rgba(255,255,255,*) hovers with --hover-surface",
        "Hover text var(--text-primary)"
      ],
      "cal-event-canvas": [
        "Title/hint use var(--text) and var(--text-2)"
      ]
    },
    "do_not_transform": [
      "url-table-page-overlay",
      "export-workspace-modal",
      "export-pack-modal",
      "ie-pack-chooser",
      "confirm-action-overlay"
    ]
  }
}
```

## Expected handoff

After user approves JSON:

```
@ui-system-transformer implementa .cursor/saved/design-system/design-system-spec.json scope: both
```
