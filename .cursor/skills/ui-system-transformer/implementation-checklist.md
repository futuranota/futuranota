# UI System Transformer — QA checklist

Run after implementing from `design-system-spec.json`.

## Scope recorded

- [ ] Scope: `app` | `marketing` | `both`
- [ ] Spec path: `.cursor/saved/design-system/design-system-spec.json`
- [ ] `transform-report.md` written

## Dark mode (no regression)

- [ ] Default theme (no `data-theme`) unchanged visually on `/app`
- [ ] Document modal dark: readable text, marks, Save/Aa
- [ ] Overlays URL table / export / confirm still dark

## Light mode toggle

- [ ] Toggle sun → `html[data-theme="light"]`
- [ ] Body / dash background `#F1F1F1` (or spec base)
- [ ] Primary text `#3D3B3B` (or spec primary) on shell, sidebar, canvas

## App surfaces

- [ ] Left panel: folder cards, labels, search — borders visible
- [ ] Open document: modal not washed out; body text readable
- [ ] Doc highlights / marks visible (not pale coral)
- [ ] Right panel Calendar: title + hint readable
- [ ] Canvas grid / empty state readable
- [ ] Timeline toggle + dots
- [ ] Gina chat (if in scope): surfaces + text

## Marketing (if scope includes)

- [ ] Landing / blogs: background + text from spec
- [ ] Nav mega / cards aligned with new palette

## Overlays (must stay dark)

- [ ] URL table overlay: `#0a0c10` backdrop, light text on shell
- [ ] Export pack / workspace modal dark
- [ ] i/e pack chooser dark
- [ ] Confirm action overlay dark

## Technical

- [ ] No new hardcoded `#151515` outside overlay pins
- [ ] New surfaces use `var(--surface-base)` per surface-base-color rule
- [ ] Scrollbars match container (`--scroll-bg`)

## Sign-off

| Area | Pass | Notes |
|------|------|-------|
| Dark regression | | |
| Light dashboard | | |
| Light doc | | |
| Overlays dark | | |
| Marketing | | |
