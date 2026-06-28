# Analyst Strategic Output v2

> Doc template for Campaign Analyst — greeting, strategic sections, verified Trends, Launch Radar closing.

**See also:** [`brand-intelligence-agent.md`](brand-intelligence-agent.md)

## Doc template (ES)

```
Hey, {buenos días|buenas tardes|buenas noches}, aquí te dejo el reporte de lo que me pediste. Esto fue lo que pude encontrar.

{openingBrief — gancho estratégico}

## ¿Qué pasó recientemente?
{whatsNew}

## Lo que viene
{whatsComing — solo futuro}

## Mi recomendación
{strategicRecommendation}

{marketInterest — solo si DataForSEO respondió}

{launchRadarClosing — si launchDate futuro}

## Fuentes
— domain.com — Título (oficial|medio)
  https://url-completa
```

## Private (never render)

- `Intel — {brand} · {date} · ventana N días`
- `Revisé {brand} con foco en: {primaryQuestion}`
- `Confianza: … · Por qué: Groq no respondió…`
- Echo of canvas user query

## JSON fields

| Field | Role |
|-------|------|
| `openingBrief` | Strategic hook — no repeat user question |
| `whatsNew` | Recent facts + analyst read |
| `whatsComing` | Future launches only |
| `strategicRecommendation` | Actionable counsel without telling user what to sell |
| `marketContext` | Verified Tavily + `detection.marketInterest` only |
| `sources` | `{ url, tipo, label? }` |

## Good vs bad (Rockstar)

**Bad:** Internal header, query echo, confidence meta, numbered bare URLs, invented 340% without API.

**Good:** Greeting, countdown voice, sections with ##, recommendation block, Trends from DataForSEO, sources with domain + full URL, Launch Radar closing when `launchDate` is future.

## Renderer

- [`buildStrategicReportBody.js`](../../../src/lib/agents/buildStrategicReportBody.js)
- [`applyAnalystReportToDoc.js`](../../../src/lib/agents/applyAnalystReportToDoc.js)

## marketInterest (detection)

```json
{
  "keyword": "Rockstar Games",
  "interestChangePercent": 340,
  "topRegions": ["United States", "Brazil", "United Kingdom", "Mexico"],
  "source": "dataforseo"
}
```

LLM may cite % and regions **only** when `source === "dataforseo"`.
