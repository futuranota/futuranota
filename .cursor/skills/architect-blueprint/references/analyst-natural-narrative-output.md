# Analyst natural narrative output

> **SUPERSEDED** by [`brand-intelligence-agent.md`](brand-intelligence-agent.md) — use SIGNAL REPORT format instead.

> Spec for Campaign Analyst doc rendering — narrativa continua + productInsights + Referencias.

## Malo vs bueno (Apple)

**Malo:** "Apple lanza más de 20 productos en 2026, incluyendo iPhone 18 Pro…" (conteo sin lista, specs inventadas, 15 subtítulos).

**Bueno:** Intro honesta + párrafo por producto citado + Referencias con URLs.

## Frases prohibidas (omitir, no escribir)

- "No se pudo determinar…"
- "No se encontraron señales…"
- "Informe compilado desde fuentes web para:"
- Conteos agregados ("20 productos") sin `productInsights[]` completo

## Plantilla oportunidad (solo con evidencia)

> La oportunidad para [producto] es [Alto|Medio|Bajo]: [razón accionable]. [marketSignal solo si hay dato en snippet]

## JSON schema (doc)

See `campaignAnalystContext.js` OUTPUT_BRIDGE.
