# Brand Intelligence Agent

> Spec for Campaign Analyst — natural analyst prose, Tavily parallel discovery, Groq temperature 0.7.

**Supersedes:** rigid SIGNAL REPORT template (`analyst-natural-narrative-output.md` merged here)  
**See also:** [`brand-intelligence-tavily-pipeline.md`](brand-intelligence-tavily-pipeline.md) — `@tavily/core` parallel search + Groq formatting.

## Architecture

- **Phase 1 (server):** `searchBrand()` in `brandIntelligenceSearch.js` — parallel queries via `@tavily/core`, **365-day lookback**, noise filter (`filterIntelSnippets`), dedupe, fallback if &lt;5 hits. Used by `runIntelPass1`.
- **Phases 2–6 (LLM):** System prompt in `content/agents/campaign-analyst.{es,en}.md`; user message includes `formatResultsForPrompt` corpus + horizon block + detection JSON.
- **Doc render:** `applyAnalystReportToDoc` — prose doc with `openingBrief`, optional sections omitted when empty, Referencias at end.

## Temporal horizon

| Scope | Rule |
|-------|------|
| Lookback | **365 days** (`DEFAULT_RANGE_DAYS`) for news, campaigns, recent launches |
| "Qué se viene" | **Future only** — launch date must be **after today** (`isFutureLaunchDate`, `filterForwardLaunchSignals`) |
| Undated rumors | Kept for analyst review; dated past launches excluded from forward signals |

## OUTPUT JSON schema

```json
{
  "openingBrief": "2–4 sentence analyst voice summary",
  "structuredFacts": [{ "hecho", "fecha", "fuente", "confianza", "categoria" }],
  "whatsNew": "",
  "whatsComing": "",
  "businessOpportunities": [],
  "customerMarkets": "",
  "launchCadence": "",
  "sources": [{ "url", "tipo" }],
  "overallConfidence": "Alta|Media|Baja",
  "confidenceReason": "",
  "marketContext": "",
  "toolGuide": "",
  "launchScenario": "A|B|C|none"
}
```

Empty strings / arrays → section omitted in doc (no placeholder filler).

## Good vs bad (Apple)

**Bad:** Five sections each saying "Sin datos confirmados"; rigid `━━━` headers; fallback text despite citations; past launches listed under "qué se viene".

**Good:** `openingBrief` reads like a senior analyst; only future launches in whatsComing; facts cite URLs; empty sections skipped; confidence explains evidence quality.

## Prohibited phrases

- "Sin datos confirmados" / "No confirmed data"
- "Informe generado desde fallback" / "Report generated from fallback"
- "No se pudo determinar…" / "Could not determine…"
- Vague counts without listing each fact

## Phase 6 trigger

| Scenario | Condition |
|----------|-----------|
| A | Confirmed upcoming launch |
| B | Expected or rumored launch |
| C | Launch in last 30 days |

If none → `toolGuide: ""`, omit tool block in doc.

## Tavily query priorities

1. Official: `site:newsroom.{brand}.com`, `site:{brand}.com/news`, press release
2. Recent: announced, just launched, released, reported
3. Future: upcoming, will launch, leak/rumor (with date hints)
4. Campaign: new campaign, new ad, commercial
5. Market (Phase 5): growth %, revenue by region, market share

## LLM settings

- Analyst call: `temperature: 0.7` via `completeJson(user, { system, temperature: 0.7 })`
- Smart fallback builds `openingBrief` from citations when Groq fails (no placeholder spam)
