# Studio — product memory

Saved: 2026-08-16 (updated: X feed identity + Wall inspector). Scope: brand video **visualization** (Vimeo), not Intel notes.

## Norte

People should generate / host brand-meaningful video (ads, promo, campaign motion) and **see it on a production wall** inside Futura Nota — ideally later as part of the whole dashboard. Studio is that stage. Folder-library **file uploads** for video are a stopgap; Studio (external host) is the destination.

## Why Vimeo (not notes)

| Surface | Job |
|---|---|
| **YouTube** (Intel, temporary) | Embed + **take notes** |
| **Studio** | Embed **Vimeo only** + **visualize** (wall + frame ratio + optional mockup chrome). No NoteTaker. |

Intel panel will shrink later; YouTube embed stays as a sibling until notes move/retire. Studio is the long-term brand stage.

## v1 (this build)

```
Intel tabs:  News | YouTube | Studio | Campaign | …
                              └── opens Studio overlay (wizard)
```

### Wizard (setup → visualize)

```
1. Embed     → paste Vimeo URL (library-style drop + Continuar)
2. Frame     → ratio picker: 2:3 · 3:2 · 1:1 · 9:16 · 16:9 (user chooses; mockup does NOT force ratio)
3. Mockup    → gallery thumbs only [Plano | X feed | X zoom]; selecting applies default wall + stroke
4. Wall      → inspector colors (no mini wall strip) + identity for X / X zoom (session only)
5. View      → full stage. X feed: logo + name + Ad + desc + video. X zoom by ratio: portrait = video-only; landscape = post.
```

- Mockup chrome (nav / rail / actions) = **shapes**. **No tabs** on X feed. Post identity = session text.
- **Visualize never scrolls:** stage + mockup use `overflow: hidden`; frames must fit in view.
- Defaults: Plano wall `#151515`; X wall `#000000`, video stroke `#191A1C` (editable).
- **CTA:** button **Vimeo** → `https://vimeo.com/join`.
- **No credits.** No notes. Session draft includes `phase`, `mockupId`, `frameStroke`, identity + text color.
- Later: mockup **position** step; more networks; low-def social chrome variants.

## Data (v1 session)

```js
{
  rawInput: string,
  embedSrc: string,
  videoId: string,
  wallColor: string | null,
  frameStroke: string | null,
  mockupId: "none" | "x" | "x-zoom",
  aspectRatio: "2:3" | "3:2" | "1:1" | "9:16" | "16:9",
  phase: "embed" | "aspect" | "mockup" | "wall" | "view",
  draftLogoDataUrl: string | null, // session only
  draftDisplayName: string,        // session only
  draftDescription: string,        // session only
  draftTextColor: string | null,   // session; name/caption color
}
```

## Later (not v1)

- Persist Studio per folder / company corpus.
- Multi-frame dashboard; Instagram / TikTok / Threads mockups.
- Mockup position picker.
- Replace folder-library video **uploads** with “open in Studio / link Vimeo”.
- Gina: remember & show Studio links (LIVE CORPUS ONLY).

## Hard rules

- LIVE CORPUS ONLY when Gina reads Studio — never invent embeds.
- Do not mix NoteTaker into Studio.
- Surface base `#151515` (panel); mockup walls use their defaults.
- Vimeo-only in Studio (YouTube stays on the YouTube tab).
- Shell chrome: shapes only; identity fields are session text on the post, not chrome copy.
- **No scrolling in Visualize** — any frame/mockup must stay fully visible (`overflow: hidden`).
