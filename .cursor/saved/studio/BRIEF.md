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
                              └── opens Studio overlay
```

- **Real estate:** large overlay (`#151515`), dominant stage.
- **Paste** Vimeo URL / embed → play in iframe (reuse `videoEmbed` Vimeo parse; reject YouTube).
- **Wall color:** same atelier model as folder library (`wallColor` hex + Apply behind the frame).
- **One frame**, selectable aspect: `16:9` | `9:16` | `1:1` (CSS `aspect-ratio`; letterbox on wall).
- **CTA:** button **Vimeo** → official join/signup relink (`https://vimeo.com/join`) for users without an account.
- **No credits** in v1. No notes. Session-local draft (sessionStorage) — not a corpus document yet.

## Data (v1 session)

```js
{
  rawInput: string,
  embedSrc: string,
  videoId: string,
  wallColor: string | null,  // #RRGGBB
  aspectRatio: "16:9" | "9:16" | "1:1",
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
