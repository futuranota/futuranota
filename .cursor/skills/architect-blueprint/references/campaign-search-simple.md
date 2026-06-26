# Blueprint: Campaign search simplificado (plantillas + overview inline)

> **Estado:** implementado  
> **Fecha:** 2026-06-25

## Resumen

Intel tab **Campaign** usa el mismo pipeline que **News** (`POST /api/intel/overview`): Serper scrape + Groq overview + citations inline en el panel.

Las plantillas de búsqueda viven en `content/admin/campaign-search-starters.json` (`{brand}` placeholder).

## Flujo

1. Usuario selecciona chip Campaign → seed desde plantilla default + marca corpus.
2. Lupa → `runIntelSearch({ query })`.
3. Panel muestra overview + sources (mismo bloque que News).

## Fuera de scope (usuario Campaign)

- `runCampaignScanForCorpus` / `mode=deep` / doc automático `Campaña · {marca}`.

Admin Horizon / Campaign Detector sigue en `campaign-detect`.

## Archivos

| Archivo | Rol |
|---------|-----|
| `content/admin/campaign-search-starters.json` | Plantillas editables |
| `src/lib/campaignSearchStarters.js` | Loader + format |
| `src/panels.jsx` | Submit + UI inline |
| `src/lib/intelCampaignScan.js` | Deep scan legacy (admin); seed re-export |
