# Brand Intelligence Agent — Tavily parallel pipeline

> Spec for Campaign Analyst — SIGNAL REPORT (Phases 1–6), `@tavily/core` SDK, Groq temperature 0.3.

**Supersedes:** `analyst-natural-narrative-output.md`

## Pipeline flow

```
"Apple"
  ↓
6 queries paralelas a Tavily (365 días) via @tavily/core
  ↓
Deduplica por URL
  ↓
Si < 5 resultados → fallback `{brand} news {year}` con 180 días
  ↓
formatResultsForPrompt() → bloque de texto para Groq
  ↓
Groq (system prompt Brand Intelligence Agent, temperature 0.3)
  ↓
JSON → SIGNAL REPORT en doc (6 secciones)
```

## Code map

| Module | Role |
|--------|------|
| [`server/discovery/brandIntelligenceSearch.js`](../../../server/discovery/brandIntelligenceSearch.js) | `buildBrandParallelQueries`, `searchBrand`, `formatResultsForPrompt` |
| [`server/discovery/tavilySearch.js`](../../../server/discovery/tavilySearch.js) | `@tavily/core` client, `searchTavily`, `searchTavilyParallel` |
| [`server/brandCampaignIntel.js`](../../../server/brandCampaignIntel.js) | `runIntelPass1` → `searchBrand`; detection returns `searchCorpus`, `sourceCount` |
| [`server/agents/campaignAnalystContext.js`](../../../server/agents/campaignAnalystContext.js) | User message: "Tienes N fuentes disponibles" + formatted corpus |
| [`content/agents/campaign-analyst.es.md`](../../../content/agents/campaign-analyst.es.md) | System prompt Fases 1–6 |

## Parallel queries (6 intents)

1. `{brand} newsroom announcement {year}`
2. `site:{slug}.com news` (or `site:{officialDomain}/news`)
3. `"{brand}" launched OR announced OR released {year}`
4. `"{brand}" upcoming OR "will launch" OR "next release" {year}`
5. `"{brand}" new campaign OR commercial OR ad {year}`
6. `"{brand}" market share OR sales report OR revenue {prevYear} {year}`

Tavily options per query: `searchDepth: "advanced"`, `maxResults: 5`, `days: 90`.

## Env vars

```bash
TAVILY_API_KEY=tvly-xxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxx
```

Works in **local** (`npm run dev` via Vite middleware) and **Vercel Functions** (`api/analytics/campaign-detect.js` → `detectBrandIntel`).

## OUTPUT JSON schema

```json
{
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

## LLM settings

- Analyst: `temperature: 0.3`
- Default elsewhere: `0.2`

## Good vs bad (Apple)

**Bad:** vague counts, invented specs, filler sections.

**Good:** dated facts from sources only; CONFIRMED vs RUMOR; Phase 6 only for launch scenarios A/B/C.
