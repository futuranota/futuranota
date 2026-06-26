# Futura Nota — Memoria de trabajo

Documento vivo para registrar problemas, cambios pedidos y resoluciones.  
Cuando menciones algo en el chat, lo trato como el **problema más reciente** y actualizo esta memoria.

---

## Cómo usar este archivo

1. **Problema activo** — Lo último que quieres resolver. Incluye contexto y cambios concretos que pides.
2. **Resueltos** — Cuando confirmes que algo quedó bien, lo muevo aquí con fecha y resumen de lo aplicado.
3. **Referencia** — Visión del producto, flujos de datos y docs del repo.

---

## Visión del producto (Futura Nota)

Futura Nota es una webapp cuyo objetivo primordial es ayudar a **emprendedores jóvenes que empiezan de cero** a obtener su primer negocio — y en general a cualquier persona que ya tenga una habilidad (cantar, un instrumento, deportes, manualidades, pintura, cerámica, tejer, etc.) y conectarla con un **producto ya hecho** que Futura vende en su propio marketplace.

### El software (note-taker orientado a eventos)

- Combinación de **Obsidian + Notion**, con **Google Search API** integrada en el espacio de trabajo.
- Los **documentos son objetos**: un objeto puede contener documentos y nodos.
- Un documento puede ser el título padre (ej. `"marketing"`) de su objeto padre (ej. `"mi webapp"`). Dentro van preguntas, investigaciones y dudas del usuario; cada búsqueda puede crear un **nodo** y consultar el buscador interno.
- Enfoque exclusivo en **organizar eventos** en un **timeline** (pasado · presente · futuro).
- Cada nodo tiene `schedule` y `date`; **`schedule` tiene mayor autoridad** — representa el set de tiempo para completar algo.

### Librería y campañas

- La **Librería** entrega a los usuarios **campañas identificadas** por Futura.
- Meta del usuario: *"Ellos lanzan la campaña de su producto target; tú lanzas la taza"* — montarse en la ola del lanzamiento ajeno.
- Los documentos incluyen **fecha de anuncio** y **fecha de lanzamiento** para entender el **scope temporal** y planificar qué construir encima de ese producto.

### Pipeline admin → app

```
Horizon Scan / Campaign Detector  →  cola (signal_campaigns, status: pending)
        ↓ Publish to Signals
hero_signals (múltiples active OK)  →  Hero + Librería (selector)
        ↓ usuario elige campaña
Objeto corpus + cadence local      →  Launch Radar (datos curados primero, Groq fallback)
```

**Migración SQL requerida** (Supabase → SQL Editor, en orden):

0. **Error al guardar `announcement_date` / PGRST204** → [`supabase_signal_campaigns_repair.sql`](supabase_signal_campaigns_repair.sql) (solo ALTER columnas; 30 s)
1. [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql) — `signal_campaigns` + `hero_signals` (proyecto nuevo)
2. [`supabase_intel_columns.sql`](supabase_intel_columns.sql) — columnas intel
3. [`supabase_intel_scan_sources.sql`](supabase_intel_scan_sources.sql) — fuentes curadas (opcional)
4. [`supabase_plans.sql`](supabase_plans.sql) — tabla `profiles` (plan free/pro; sin esto: `PGRST205` en consola)

---

## Problema activo

### Campaign Detector — pipeline verificado 2-pass (implementado)

**Pass A:** Serper + Groq extract-only → `confirmed_campaign` (confidence ≥ 80).  
**Pass B:** si no hay campaña → búsqueda de cadencia histórica → `cadence_only` (≥ 70) + proyección JS desde hoy.  
**Estados cadencia:** `watch` (mantener pendiente, ≤4 meses o ≤ rangeDays/30) · `discard` (ventana larga) · `no_data`.

Archivos clave: [`server/brandCampaignIntel.js`](server/brandCampaignIntel.js), [`server/cadenceProjection.js`](server/cadenceProjection.js).  
Horizon Scan excluye `discard` de la lista principal; las muestra en `meta.cadenceDiscardedBrands`.

**Estado:** Implementado — probar con `SERPAPI_KEY` + `GROQ_API_KEY`.

### Fase A+B — Detector Groq + fuentes curadas (implementado)

**Fase A — Contexto Groq:** [`content/admin/detector-de-campanas.md`](content/admin/detector-de-campanas.md) (Matriz 1 innovación/look, Matriz 2 pain point/solución). Cada Horizon Scan inyecta ese texto en el prompt de usuario vía [`server/scanIntelContext.js`](server/scanIntelContext.js) → `buildGroqUserPrompt()`.

**Fase B — Fuentes curadas:** seed [`content/admin/scan-sources.json`](content/admin/scan-sources.json); tabla [`supabase_intel_scan_sources.sql`](supabase_intel_scan_sources.sql); dual pass Serper (`site:` + web abierta) en [`server/horizonScanHandler.js`](server/horizonScanHandler.js). Admin: pestaña **Scan Sources** en `/panel`; Horizon Scan envía fuentes activas en el POST.

**Estado:** Implementado — probar con `SERPAPI_KEY` + `GROQ_API_KEY`. Ejecutar SQL de scan sources si querés CRUD en Supabase (sin SQL usa el seed JSON).

### Horizon Scan — datos verificados (Fase 1+2)

- Serper obligatorio; sin INVENT/mock.
- `confirmed_campaign` confidence ≥ **80**; `cadence_only` ≥ **70**.
- Overview real del snippet; cadencia solo si no hay anuncio.
- SQL intel: [`supabase_intel_columns.sql`](supabase_intel_columns.sql)

**Estado:** Implementado — probar con SERPAPI_KEY + GROQ_API_KEY.

---

## Resueltos

### 2026-06-25 — Selector modelo Intel + créditos por consumo

**Feature:** Dropdown en Intel (Gemini Flash/Pro, Groq Llama 70B/8B). Costo 1–2 créditos/búsqueda; Pro `0/150`, Free `0/10`.

**Archivos:** [`server/intelModels.js`](server/intelModels.js), [`src/components/intel/IntelModelSelect.jsx`](src/components/intel/IntelModelSelect.jsx), [`server/intelOverviewHandler.js`](server/intelOverviewHandler.js), [`server/llmJson.js`](server/llmJson.js) (`completeJsonForProvider`).

### 2026-06-25 — Campaign Intel simplificado (plantillas + overview inline)

**Problema:** Campaign tab usaba pipeline deep (`campaign-detect`) → doc automático y panel vacío; search “no devolvía nada”.

**Solución:** Plantillas en [`content/admin/campaign-search-starters.json`](content/admin/campaign-search-starters.json) + mismo flujo que News (`runIntelSearch` → `/api/intel/overview`) → overview + sources **inline** en Campaign tab.

**Archivos:** [`src/lib/campaignSearchStarters.js`](src/lib/campaignSearchStarters.js), [`src/panels.jsx`](src/panels.jsx), blueprint [`campaign-search-simple.md`](.cursor/skills/architect-blueprint/references/campaign-search-simple.md). Deep scan (`runCampaignScanForCorpus`) queda para admin/legacy.

### 2026-06-25 — `/api/translate` 500 (Google Translation API bloqueada)

**Problema:** Al cambiar idioma a ES, `POST /api/translate` devolvía 500. Logs: Google HTTP **403** — `TranslateService.TranslateText are blocked` (Cloud Translation API no habilitada o key restringida en GCP).

**Cambios:**
- [`server/translateHandler.js`](server/translateHandler.js) — fallback **passthrough** (200 + texto original) si Google falla; sin fallback a `GEMINI_API_KEY`.
- [`api/translate.js`](api/translate.js) — función Vercel en la ruta que usa el cliente.
- [`api/analytics/translate.js`](api/analytics/translate.js) — re-export del handler canónico.

**Para traducción real:** en GCP → APIs & Services → habilitar **Cloud Translation API** → API key con acceso a esa API + billing activo.

### 2026-06-25 — Forecast Intel + planes (límites, anti-bot, OpenWeather)

Implementación completa del tab **Forecast** en Intel con límites Free/Pro, contador de nodos, anti-bot de ciudad silencioso, caché OpenWeather y UX de búsqueda/inserción en canvas.

#### Límites de producto (canónico — `src/lib/planConfig.js`)

| Recurso | Free | Pro | ¿Visible en UI? |
|---------|------|-----|-----------------|
| **Insert node** (canvas) | **2** lifetime (`weatherNodeActionsCap`) | **50** lifetime | Sí — footer `0/2` · `0/50` |
| **Cambio de ciudad** (input Enter/Set/geo) | **5** / día (`weatherCityChangesCap`) | **50** / día | No — anti-bot silencioso; mensaje solo al tope |
| **Ver panel** 5–6 días | Ilimitado | Ilimitado | — |
| **Search preview** (botón lupa) | Ilimitado | Ilimitado | — |

- Cooldown entre cambios de ciudad **distintos:** 3 s (`WEATHER_CITY_COOLDOWN_MS`).
- **Misma ciudad** re-aplicada: no cuenta ni cooldown ni revisión de panel (`locationRevision` no sube).
- Panel auto-refresh cada 45 min + medianoche ciudad (`fresh=1`) **no** consume contador de nodos ni de ciudad.

#### Qué cuenta como “call” de negocio vs coste OpenWeather

| Acción | Contador nodos | Anti-bot ciudad | OpenWeather real |
|--------|----------------|-----------------|------------------|
| Enter / Set / geo (ciudad nueva) | No | Sí (+1/día) | Sí si cache miss (~45 min/ciudad) |
| Ver panel / refresh | No | No | Reusa cache |
| Search forecast nodo | No | No | Reusa cache diaria del panel |
| **Insert node** | **Sí (+1)** | No | **No** (solo escribe payload en canvas) |

#### Archivos clave

| Área | Archivos |
|------|----------|
| Límites plan | `src/lib/planConfig.js` — `weatherNodeActionsCap`, `weatherCityChangesCap`, `getPlanFeatureRows()` |
| Ledger nodos | `src/stores/planStore.js` — `weatherActionsCount`, `incrementWeatherAction()`, `resetWeatherActions()` |
| Anti-bot ciudad (cliente) | `src/lib/weatherCityRateLimit.js` — daily localStorage + cooldown |
| Anti-bot ciudad (servidor) | `server/weather/locationRateLimit.js` — header `X-Futura-City-Apply: 1` |
| Ubicación | `src/stores/weatherLocationStore.js` — `setManualCity`, `setGeolocation` |
| Panel | `src/components/intel/ForecastPanel.jsx`, `src/lib/forecastPanel.js` |
| Search + insert | `src/components/intel/ForecastSearchFooter.jsx`, `src/lib/forecastSearch.js` |
| Picker ciudad | `src/components/intel/ForecastLocationPicker.jsx` |
| API + cache | `server/weatherHandler.js`, `server/weather/openWeather.js`, `server/weather/weatherCache.js` |
| Refresh panel | `src/lib/forecastRefresh.js` (45 min + medianoche TZ ciudad) |
| i18n | `src/i18n/messages.js` — `forecastSearchInstruction`, `weatherActionLimit*`, `weatherCityChange*` |
| SQL perfil | `supabase_weather_actions.sql` — columna `weather_actions_count` |
| SQL cache | `supabase_weather_cache.sql` |

#### UX implementada

- **Instrucción onboarding** (`forecastSearchInstruction`): solo si el usuario **nunca insertó** un nodo forecast (`futuranota-forecast-node-inserted` en localStorage). Tras primer Insert node desaparece.
- **Footer search:** botón deshabilitado hasta ciudad + panel ready + nodo en ventana; hint dinámico (loading, past, outOfRange, ready).
- **Contador nodos** siempre visible en footer (`formatWeatherActionCounter`).
- **Panel:** solo hora `as of H:MM AM/PM` — eliminado copy OpenWeather compare.
- **Límite nodos Pro:** mensaje inline, **sin** modal upgrade. Free: modal upgrade + mensaje.
- **Límite ciudad:** mensaje inline al tope diario; Free también puede ver modal upgrade vía `reasonWeather`.

#### Persistencia contador nodos

- Logueado: `profiles.weather_actions_count` (+ legacy `weather_used`).
- Anónimo / fallback: `localStorage` `futuranota-weather-actions-used`.
- Al `fetchProfile`: DB es source of truth; sync a localStorage (no merge max local→DB).

#### Dev / reset

```js
await window.__resetForecastUsage() // solo dev — limpia nodos + ciudad + reload
```

Definido en `src/router.jsx`; llama `planStore.resetWeatherActions()`.

#### Env servidor

- `OPENWEATHER_API_KEY` — obligatorio en dev real (sin key → `503 openweather_not_configured`).
- `FUTURA_SUPABASE_SERVICE_ROLE_KEY` — cache global Supabase 45 min (sin esto: cache in-memory por proceso).

#### Pendiente al unificar plan completo

- Alinear fila **Weather** en tabla “Límites objetivo” abajo (hoy dice “1 uso / ilimitado” — **obsoleto**).
- `weatherUsesAllowed` / `weather_used` legacy — conviven con `weather_actions_count`; considerar deprecar en copy Stripe/pricing.
- Rate limit servidor es in-memory por proceso — en multi-instancia Vercel usar Redis/Upstash si hace falta enforcement global.

---

### 2026-06-25 — Weather forecast: mock idéntico para todas las ciudades

- **Causa:** sin `OPENWEATHER_API_KEY` en el proceso del middleware, el servidor devolvía `source: "mock"` silenciosamente; Supabase podía cachear ese mock; el seed mock era débil por ciudad.
- **Fix:** error `503 openweather_not_configured` si falta key (mock solo con `WEATHER_ALLOW_MOCK=1`); no leer/escribir caché mock; cache keys `v3`; `vite.config` fuerza env desde `.env.local`; UI avisa si llega mock.
- **Verificar:** reiniciar `npm run dev`, Set ciudad (`Madrid,ES`), Network debe mostrar `source: "openweather"` y temps distintas por ciudad.

### 2026-06-25 — Launch Radar: inyección de campaña desde Librería

- Al seleccionar compañía en Librería, `ensureCompanyObject` inyecta `cadence` (launch, announce −90d, overview, category).
- Launch Radar en **modo campaña** compara **Today · Announce · Launch**, muestra overview y **días restantes** hasta launch / ventana de scope.
- Fallback: modo cadencia (intervalo) o Groq si no hay datos curados.
- SQL: columnas `overview` y `category` en `hero_signals` ([`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql)).

### 2026-06-25 — `/panel` Horizon Scan: Publish pipeline + fechas + Launch Radar

- **Problema 1:** Activate hacía toggle radio en cola; deseado: publicar a Signals y sacar de Horizon Scan.
- **Problema 2:** Fechas del scan no coincidían con el rango.
- **Problema 3:** Launch Radar ignoraba cadencia curada en admin.
- **Cambios aplicados:**
  - `promoteCampaignSignal()` → publica a `hero_signals` + `status: published` en cola.
  - Cola admin filtra `status = pending`; botón **Publish to Signals**.
  - Validación de fechas compartida en `server/horizonScanNormalize.js`.
  - `hero_signals` recibe `brand_name`, `launch_date`, `last_launch_date`, `average_interval_months`.
  - Librería → `ensureCompanyObject` guarda `cadence` en objeto → Launch Radar la usa antes de Groq.
  - Varias campañas pueden quedar `active` en `hero_signals`.
- **Estado:** Implementado en código; requiere SQL migration + prueba manual en `/panel`.

### 2026-06-25 — Verificación de Git (empty commit)

- Empty commit `70d35c7` — flujo Git verificado.

---

## Referencia

### Planes, costos y propuesta comercial

**Doc canónico:** [`docs/planes-costos-propuesta.md`](docs/planes-costos-propuesta.md) · CSV: [`docs/integraciones_futura_nota.csv`](docs/integraciones_futura_nota.csv)  
**Fuente:** [Gemini — Planes Futura Nota: Costos y Propuesta](https://share.gemini.google/UtadGr2vnMxI) (2026-06-25)  
**Estado:** **implementado en dashboard** (fases 0–8 del blueprint `.cursor/plans/dashboard_apis_roadmap_d7e54a9e.plan.md`) — **Stripe pendiente** (fase 10)

#### Implementado (2026-06-25)

- SQL: `supabase_plans_tokens.sql`, `supabase_campaign_studies.sql`, `supabase_weather_cache.sql` (ejecutar en Supabase SQL Editor)
- Token ledger: `planStore.js` + `planConfig.js` — debito servidor en `/api/analytics/campaign-study` y `/api/intel/overview`
- Pipeline usuario: DataForSEO PAA + Apify hype + Groq → `campaign_studies` cache; switch Librería = 0 tokens
- Intel: `POST /api/intel/overview` (Serper + Groq); Free = 10 searches, Pro = 1k tokens/search
- Weather: `GET /api/weather/forecast` + cache Supabase 45 min; **límites forecast** nodos 2/50 + ciudad 5/50 día (ver sección Resueltos)
- UI: `PlanUsagePanel` en sidebar + `/app/plans`; export JSON gated Pro
- Verificación integraciones: `npm run verify:apis` · `GET /api/health/integrations`

#### Pendiente

- Stripe checkout → `plan = pro` + reset `tokens_balance = 1_500_000`
- Precio Pro marketing (TBD en `pricingDefaults.js`)

#### Resumen ejecutivo

- **Moneda propuesta:** tokens — 1 estudio de campaña live = **10,000 tokens** (~$0.005 COGS).
- **Gratis (Gemini):** 10k tokens bienvenida = 1 campaña live; datos congelados; switch bloqueado.
- **Pro (Gemini):** **$15–19/mes**, **1.5M tokens/mes** ≈ 150 estudios live; switch Librería = 0 tokens.
- **COGS/usuario:** ~$0.08 (Gratis) · ~$0.93–1.30 (Pro muy activo) → margen >90% a $15–19.
- **APIs recomendadas:** Groq, Serper/DataForSEO, Apify, OpenWeather, Supabase. **No Brand24.**

#### Límites objetivo (fundador, conversación Gemini)

| Feature | Gratis (objetivo) | Pro (objetivo) |
|---------|-------------------|----------------|
| Objetos | 1 | Ilimitados |
| Storage | 1 GB (Gemini) / **54 MB** (código hoy) | **5 GB** |
| Búsquedas AI | 10 lifetime | 150 live/mes (unificado con overview) |
| Calendario | 1 uso | Avanzado + eventos corporativos |
| Weather | 2 nodos canvas + 5 cambios ciudad/día | 50 nodos + 50 cambios ciudad/día; panel ilimitado |
| Campaña Signar | 1 live run, frozen | Live + Social Hype + Search Intent |
| Tokens | 10k bienvenida | 1.5M/mes |

#### Delta vs código actual

| Tema | Objetivo | Repo hoy |
|------|----------|----------|
| Precio Pro | TBD ($15–19) | `pricingDefaults.js`: **TBD** (Stripe no conectado) |
| Storage Pro | 5 GB | **5 GB** en `planConfig.js` ✓ |
| Token ledger | 10k / 1.5M | **`profiles.tokens_balance`** + server debit ✓ |
| Weather forecast | 2 inserts + 5 city/day | 50 inserts + 50 city/day; panel/search ilimitados | **`planConfig` + anti-bot** ✓ |
| Campaña live | DataForSEO + Apify + Groq | **`/api/analytics/campaign-study`** ✓ |
| Billing | Stripe | **`setPlan` manual** — pendiente |

---

- Skill de arquitectura: [`.cursor/skills/architect-blueprint/SKILL.md`](.cursor/skills/architect-blueprint/SKILL.md)
- Migración pipeline: [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql)
- Backup técnico Intel: [`docs/memoria-intel-session-backup.md`](docs/memoria-intel-session-backup.md)
- Brief técnico: [`TECH_BRIEF.md`](TECH_BRIEF.md)
