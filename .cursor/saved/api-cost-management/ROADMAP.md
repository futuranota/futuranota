# API Cost Management — roadmap de fases

Fuente de verdad para margen real (Recent calls ↔ Users ↔ $).  
No confundir **créditos/tokens de plan** (cobro al user) con **uso real del provider** (costo infra).

## Tres capas (no mezclar)

1. **Cobro al user** — `credits_debited` / `tokens_debited` (plan; `CREDIT_TOKEN_UNIT = 10_000`)
2. **Costo real API** — Groq in/out × precio modelo; Apify CU × $/CU; Serper $/request; etc.
3. **Margen** — suscripción/créditos vs SUM(costo real de eventos)

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| **A** | Logging completo de rutas (Gina, weather, hype, Apify run, Resend, events, launch radar…) + uso real por provider + `$` dinámico en cada `api_usage_events` | **live** (2026-08) |
| **B** | Users: columna **API cost $** acumulado + filtro sin actividad 7/30 días | **live** (2026-08) |
| **C** | Recent calls: filtros (user, provider, endpoint, status, fecha) + export CSV | pendiente |
| **D** | Matriz créditos/endpoint visible + pie → barras / Top endpoints | pendiente |
| **E** | Success rate %, presupuestos/alertas, MRR − API cost, Apify storage (datasets / GB-h) + `GET /users/me` | pendiente |

**Nota producto:** storage + consumo API general importa a largo plazo → **E** (instrumentar Apify CU/dataset en **A** cuando haya run stats).

## Tarifas confirmadas (2026-08, cuenta Futura / Apify Billing + Groq)

### Groq (USD / 1M tokens)

| Modelo | Input | Output |
|---|---|---|
| `llama-3.1-8b-instant` | 0.75 | 1.50 |
| `llama-3.3-70b-versatile` | 1.05 | 2.10 |

Free tier (referencia): ~5M in + 5M out / mes sin costo (modelar como `billed: false` o cost 0 mientras aplique).

`cost = (input_tokens/1e6)*priceIn + (output_tokens/1e6)*priceOut`

### Apify

| Concepto | Valor |
|---|---|
| Compute unit | **$0.20 / CU** |
| Actor default FN | `apidojo~tweet-scraper` (Tweet Scraper V2) |
| Preferir en log | `usageTotalUsd` si existe; else `computeUnits * 0.20` |
| Evidence | Ago 2026: run(s) del actor con **$0.00** billed; RAM 0 MB / **16 GB = límite plan**, no consumo |
| Storage (fase E) | Dataset timed storage $1 / 1000 GB-h; etc. (Pricing tab) |

### Otros (placeholders hasta confirmar)

| Provider | Nota |
|---|---|
| Serper | $/request TBD |
| DataForSEO | por endpoint TBD |
| OpenWeather / Calendarific / Resend | free → $0 hasta pasar límite |

## Fase A — alcance técnico

1. Extender eventos (columnas o `meta`): `input_tokens`, `output_tokens`, `model`, `compute_units`, `usage_total_usd`, `item_count`, `billed`.
2. Calcular `estimated_cost_usd` **después** del uso real (no solo flat de `api_integrations`).
3. Wire log en: Gina, weather, social-hype (+ Apify run stats — hoy `run-sync-get-dataset-items` no trae CU), Resend, events/Calendarific, brand-cadence / Launch Radar; no dejar de loguear Intel/Campaign Study.
4. Catálogo flat (`estimated_cost_usd` en integrations) queda como fallback / display unit, no como verdad de margen.
5. **No** reutilizar `tokens_debited` para tokens del LLM.

### Apify implementación (A)

- Obtener objeto **run** (no solo dataset items).
- Persist async sin bloquear respuesta al user.
- Actor id en `endpoint` o `meta.actorId`.

### Checklist live (A)

- [x] `server/management/apiCostPricing.js` + `logApiUsage.js` dinámico
- [x] SQL `supabase_management_usage_v4.sql` (**correr en Supabase SQL Editor**)
- [x] Apify via `runs?waitForFinish` + CU/`usageTotalUsd`; mock `billed: false`
- [x] Gina / weather / events / Resend / brand-cadence / Intel / Campaign Study / social-hype / **Horizon Scan**
- [x] Recent calls: columnas Plan tok vs In/Out + badge mock
- [ ] User: ejecutar `supabase_management_usage_v4.sql` si aún no

**Estado A:** código live en repo — pendiente solo migración SQL en tu proyecto Supabase.

## Fase B — Users cost + inactivity

1. Sumar `estimated_cost_usd` por `user_id` (y fallback por `user_email` cuando falte id).
2. Excluir eventos `billed: false` del acumulado $.
3. Columna **API cost $** en Users table.
4. Filtros de actividad: All / Never called / Inactive 7d / Inactive 30d (por `lastCallAt`).

### Checklist live (B)

- [x] `loadUsageByUserId` → `costs` + `costsByEmail` + call stats por email
- [x] `apiCostUsd` en cada user row del overview
- [x] UI Users: columna API cost $ + chips de filtro
- [x] Contador `n / total` al filtrar

**Estado B:** live.

## Fuera de B

Filtros Recent calls, matriz créditos, alertas, MRR → C–E.

## Relacionado

- Panel: `src/admin/ManagementAdminPanel.jsx`
- Log: `server/management/logApiUsage.js`
- Schema: `supabase_management.sql` (+ v2/v3 integrations)
- Apify client: `server/discovery/apifySocialHype.js`
- Brief mirror: `.cursor/rules/api-cost-roadmap.mdc`
