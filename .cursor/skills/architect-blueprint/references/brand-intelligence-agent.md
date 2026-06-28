# Brand Intelligence Agent

> Spec for Campaign Analyst — strategic output v2, Tavily discovery, optional DataForSEO Trends.

**See also:**
- [`analyst-strategic-output-v2.md`](analyst-strategic-output-v2.md) — doc template, private fields
- [`brand-intelligence-tavily-pipeline.md`](brand-intelligence-tavily-pipeline.md)

## Architecture

- **Phase 1 (server):** `searchBrand()` + optional `fetchDataForSeoTrends()` in `detectBrandIntelDeep`.
- **Phases 2–6 (LLM):** `content/agents/campaign-analyst.{es,en}.md`; corpus + `marketInterest` in user payload.
- **Doc render:** `buildStrategicReportBody` → `applyAnalystReportToDoc` (greeting, ## sections, Fuentes with URLs).

## Temporal horizon

| Scope | Rule |
|-------|------|
| Lookback | **90 days** (`DEFAULT_RANGE_DAYS`) |
| "Qué se viene" | **Future only** (`isFutureLaunchDate`, `filterForwardLaunchSignals`) |

## OUTPUT JSON schema

```json
{
  "openingBrief": "strategic hook — no user query echo",
  "whatsNew": "",
  "whatsComing": "",
  "strategicRecommendation": "",
  "marketContext": "verified only",
  "sources": [{ "url", "tipo", "label" }],
  "launchScenario": "A|B|C|none"
}
```

**Private in doc:** `primaryQuestion`, `overallConfidence`, `confidenceReason`, `Intel —` header.

## Prohibited in visible doc

- Query echo / "Revisé … con foco en"
- Groq/fallback/confidence meta
- Invented Trends % without `marketInterest.source === "dataforseo"`

## LLM settings

- Analyst: `temperature: 0.7` when LLM runs; skip when `detection-corpus` path has strong detection.
