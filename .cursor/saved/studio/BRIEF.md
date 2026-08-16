# Studio — product memory

Saved: 2026-08-16. Scope: brand video **visualization** (Vimeo), not Intel notes.

## Norte

People should generate / host brand-meaningful video (ads, promo, campaign motion) and **see it on a production wall** inside Futura Nota — ideally later as part of the whole dashboard. Studio is that stage. Folder-library **file uploads** for video are a stopgap; Studio (external host) is the destination.

## Why Vimeo (not notes)

| Surface | Job |
|---|---|
| **YouTube** (Intel, temporary) | Embed + **take notes** |
| **Studio** | Embed **Vimeo only** + **visualize** (wall + frame ratio). No NoteTaker. |

Intel panel will shrink later; YouTube embed stays as a sibling until notes move/retire. Studio is the long-term brand stage.

## v1 (this build)

```
Intel tabs:  News | YouTube | Studio | Campaign | …
                              └── opens Studio overlay (wizard)
```

### Wizard (setup → visualize)

```
1. Embed     → paste Vimeo URL (library-style drop + Continuar)
2. Frame     → ratio picker: 2:3 Alto · 3:2 Ancho · 1:1 · 9:16 · 16:9
3. Wall      → hex / swatch + mini frame preview → Visualizar
4. View      → immersive stage (wall + frame + video); Edit / ← back to setup
```

- **Real estate:** large overlay (`#151515`); view phase widens.
- **Vimeo only** (reject YouTube — that stays on YouTube tab + notes).
- **CTA:** button **Vimeo** → `https://vimeo.com/join`.
- **No credits.** No notes. Session draft includes `phase`.
- Later: low-def social chrome around the frame (Stories / Feed sim).

## Data (v1 session)

```js
{
  rawInput: string,
  embedSrc: string,
  videoId: string,
  wallColor: string | null,  // #RRGGBB
  aspectRatio: "2:3" | "3:2" | "1:1" | "9:16" | "16:9",
  phase: "embed" | "aspect" | "wall" | "view",
}
```

Resolution in pixels is **not** stored in v1 — ratio + Vimeo source is enough. Pixel specs matter at export/generate time later.

## Later (not v1)

- Persist Studio per folder / company corpus.
- Multi-frame dashboard (several ratios at once).
- Replace folder-library video **uploads** with “open in Studio / link Vimeo”.
- Gina: remember & show Studio links (LIVE CORPUS ONLY) in day chat.
- Retire Intel shell; keep YouTube notes path only if still needed.

## Hard rules

- LIVE CORPUS ONLY when Gina reads Studio — never invent embeds.
- Do not mix NoteTaker into Studio.
- Surface base `#151515`.
- Vimeo-only in Studio (YouTube stays on the YouTube tab).
