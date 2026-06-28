# Launch Radar Agent v1

> Active module: sync from Campaign Analyst doc or cadence-only scan.

**See also:** [`analyst-strategic-output-v2.md`](analyst-strategic-output-v2.md)

## Role

Launch Radar **projects launch dates** for the selected corpus brand:

| State | Report |
|-------|--------|
| **Campaign active** (future `launchDate`) | Today → Announce → Launch + days remaining |
| **Campaign inactive** | Average interval + months remaining + **mantener pendiente** |

It does **not** run the full Analyst report. It ingests structured date data.

## Ingestion paths

1. **Sync from Analyst** (0 tokens) — reads `launchRadarSnapshot` from the latest doc with `reportPresentation.kind === 'analyst-strategic-v2'` under the corpus.
2. **Scan cadence** (~1k tokens) — `POST /api/analytics/campaign-detect` with `mode: "radar"` (Serper Pass A + Pass B + heuristic, no Tavily deep report).

## Snapshot contract

Stored on doc as `launchRadarSnapshot` + mirrored in `data_properties` entry `launchRadar` (JSON string).

```js
{
  source: "analyst-doc" | "radar-scan",
  updatedAt, brandName,
  campaignActive, detectionMode, launchConfidence,
  launchDate, announcementDate,
  lastLaunchDate, averageIntervalMonths,
  monthsRemaining, estimatedLaunchDate,
  cadenceStatus, cadenceMessage, overview, category
}
```

## Post-Analyst write

After successful Campaign Analyst run:

1. `mapDetectionToCadence` → `object.cadence` on corpus
2. `buildLaunchRadarSnapshot` → `writeLaunchRadarToDoc(targetDocId)`

## UI

[`LaunchPredictor.jsx`](../../../src/components/analytics/LaunchPredictor.jsx):

- Toolbar: role copy + **Sync from Analyst** + **Scan cadence**
- Hydration order: `object.cadence` → doc snapshot → inline heuristic → idle + CTAs
- No Campaign Study as default empty state

## Client orchestrator

[`runLaunchRadar.js`](../../../src/lib/agents/runLaunchRadar.js):

- `syncLaunchRadarFromAnalystDoc`
- `scanLaunchRadarCadenceLive`
- `hydrateLaunchRadarFromCorpusDoc`
- `applyLaunchRadarResult`

## Server

[`detectBrandIntelRadar`](../../../server/brandCampaignIntel.js) — wraps non-deep detect + heuristic fallback; returns `mode: "radar"`.
