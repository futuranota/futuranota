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

{launchRadarClosing — si detectionMode confirmed_campaign o cadence_only}

## Fuentes
· domain.com · Título (oficial|medio)
  [domain.com](https://url-completa)
```

## Launch Radar injection (post-run)

Tras un run exitoso del analista:

1. `detectBrandIntelDeep` corre Pass B de cadencia si no hay `confirmed_campaign` con launch futuro.
2. `mapDetectionToCadence` escribe `object.cadence` con modo explícito:
   - **verified:** `detectionMode: confirmed_campaign`, `launchConfidence: verified`, fechas reales.
   - **estimated:** `detectionMode: cadence_only`, `launchConfidence: estimated`, `lastLaunchDate` + `averageIntervalMonths` (sin `launchDate`).
3. `runCampaignAnalyst` selecciona el corpus (`setSelectedObjectId`) para que el panel Launch Radar muestre la marca.
4. [`LaunchPredictor.jsx`](../../../src/components/analytics/LaunchPredictor.jsx) renderiza `CampaignWindowView` (verificado) o `CadenceEstimateView` (estimado).
5. **No** auto-timeline: el usuario usa **Track on timeline** desde Launch Radar.

## Presentación UX (post-run)

1. `applyAnalystReportToDoc` escribe el cuerpo y setea `reportPresentation: { kind: "analyst-strategic-v2", animateOnOpen: true }`.
2. Tras run exitoso, la app auto-expande el doc (`setExpandedDocId`).
3. Al abrir, `AnimatedReportText` reproduce el reporte con typewriter (Quicksand), headings `##` y links clicables en fuentes.
4. Al terminar la animación, el doc pasa a textarea editable con la misma tipografía; `animateOnOpen` queda en `false` para no re-animar.

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

**Good:** Greeting, countdown voice, sections with ##, recommendation block, Trends from DataForSEO, sources with `· domain · title` + markdown link, Launch Radar closing when `detectionMode` is `confirmed_campaign` or `cadence_only`.

## Renderer

- [`buildStrategicReportBody.js`](../../../src/lib/agents/buildStrategicReportBody.js)
- [`applyAnalystReportToDoc.js`](../../../src/lib/agents/applyAnalystReportToDoc.js)
- [`AnimatedReportText.jsx`](../../../src/components/intel/AnimatedReportText.jsx)

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
