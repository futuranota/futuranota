# Blueprint: Social Hype tone v2

## Architectural design

- **LLM** produces structured JSON (greeting, per-channel education, primary read, mix nuance).
- **`buildHypeReportBody`** assembles the doc: cordial intro → markdown **table** for distribution → educational blocks per network → *Mi lectura principal* (never "Tu canal preferido").
- **`channelNuance`** replaces imperative "Riesgos" with educational paragraphs (e.g. TikTok vs YouTube format differences).
- **MarketHypePanel** shows greeting snippet + primary reading instead of "recommended channel".

## Affected files

- `content/agents/social-hype-analyst.{es,en}.md` — new JSON schema + tone rules
- `server/agents/socialHypeAnalyst.js` — normalize new fields + educational fallbacks
- `server/agents/socialHypeAnalystContext.js` — prompt keys
- `src/lib/agents/buildHypeReportBody.js` — report template with table
- `src/lib/fetchSocialHypeAnalyst.js` — JSDoc types
- `src/components/intel/MarketHypePanel.jsx` — panel copy
- `src/i18n/messages.js` — labels
- `src/lib/agents/runSocialHypeAnalyst.js` — success message

## Edge cases

1. **Empty distribution** → table shows "—", channelInsights built from collector rows only.
2. **LLM missing channelInsights** → fallback per-platform hints from payload percentages.
3. **Panel without Groq** → fallbacks still cordial + educational, no forbidden headings in doc.
