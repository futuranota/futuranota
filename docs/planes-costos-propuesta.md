# Planes Futura Nota: Costos y Propuesta

**Fuente:** [Gemini — Planes Futura Nota: Costos y Propuesta](https://share.gemini.google/UtadGr2vnMxI)  
**Conversación publicada:** 2026-06-25  
**Estado en repo:** referencia de producto — **sin implementar en código** (ver [`memoria.md`](../memoria.md))

---

## Resumen ejecutivo

- **Moneda interna propuesta:** tokens (1 estudio de campaña en vivo = **10,000 tokens**).
- **Plan Gratis:** 10,000 tokens de bienvenida (1 campaña viva) + límites estrictos en storage y features.
- **Plan Pro:** **$15–19/mes**, **1.5M tokens/mes** (~150 estudios de campaña), switch entre campañas guardadas = **0 tokens**.
- **COGS estimado:** ~$0.08/usuario/mes (Gratis) · ~$0.93–1.30/usuario/mes (Pro activo).
- **APIs clave:** Groq, Serper/DataForSEO, Apify, OpenWeather, Supabase. **Descartar Brand24** como backend.

---

## 1. Tabla de costos de APIs (COGS por usuario/mes)

| Servicio / API | Proveedor | Costo base | Gratis / mes | Pro / mes |
|----------------|-----------|-----------|--------------|-----------|
| Orquestador e IA | Groq (Llama 3 70B) | $0.59/M in · $0.79/M out | ~$0.05 | ~$0.45 |
| Búsquedas & Overview | Serper.dev / Google CSE | ~$1 / 1,000 búsquedas | ~$0.02 (20 búsquedas) | ~$0.15 (150 búsquedas) |
| Storage & DB | Supabase | Gratis 1 GB · luego $0.05/GB | ~$0.00 (cap 1 GB) | ~$0.25 (media 5 GB) |
| Clima | OpenWeather | Gratis 1,000/día · luego $0.0012/llamada | ~$0.00 (cache) | ~$0.03 |
| Campañas & tendencias | Backend + scrapers | marginal | ~$0.01 | ~$0.05 |
| **TOTAL COGS** | | | **~$0.08** | **~$0.93** (+ Social Hype + Search Intent → **~$1.30**) |

### Supuestos Pro (consumo/mes)

- Groq: ~500k tokens in + 200k out (agentes).
- Serper: overview + investigación de mercado.
- OpenWeather: consultas geolocalizadas (cachear 30–45 min).

---

## 2. Costo por clic de «Estudio de Campaña»

| Componente | Proveedor | Costo/ejecución | Qué trae |
|------------|-----------|-----------------|----------|
| People Also Ask | DataForSEO (preferido vs SerpApi) | ~$0.0015 | Preguntas frecuentes de Google |
| Social Hype | Apify | ~$0.0030 | Volumen Twitter/Reddit reciente |
| Overview IA | Groq | ~$0.0005 | Nota + estado campaña |
| **Total** | | **~$0.005** | ~200 estudios ≈ $1.00 COGS |

**SerpApi (referencia, no recomendado SaaS):** Starter $25/1k búsquedas ($0.025/consulta). DataForSEO/SearchAPI: pay-as-you-go ~$0.001–0.002/consulta.

**Apify:** $5 crédito/mes gratis dev · ~$0.001–0.005/llamada scraper.

**Brand24:** $199+/mes, 3–7 keywords — **descartado** para backend multi-usuario.

---

## 3. Propuesta Gemini (primera iteración)

### Plan Gratis — The Explorer

| Feature | Límite Gemini |
|---------|---------------|
| Storage | 1 GB |
| Búsquedas Overview | 20/mes |
| Calendario | Completo (docs propios) |
| Weather | Solo clima actual |
| Campañas activas | 1 canal social |
| Tendencias | 5 keywords/mes |
| Agentes | IA básica, sin multi-agente |

### Plan Pro — The Competitive Alchemist ($15–19/mes)

| Feature | Límite Gemini |
|---------|---------------|
| Storage | 10 GB (Gemini) → usuario prefiere **5 GB** |
| Búsquedas Overview | Ilimitadas o soft-cap 500/mes |
| Calendario | Eventos corporativos globales + countdown canvas |
| Weather | Timeline integrado |
| Campañas | Hasta 3 canales |
| Tendencias | Profundas, tiempo real |
| Agentes | Escuadrón completo + Shopify |

---

## 4. Propuesta acordada con el fundador (implementación deseada)

### Plan Gratis (estado actual en código, parcial)

| Feature | Límite deseado |
|---------|----------------|
| Objetos | **1** |
| Búsquedas AI | **10** (lifetime) |
| Calendario | **1** llamada única |
| Weather | **1** uso (lifetime) |
| Import/export | MD/JSON básico (cambiar formato objeto) |
| Campaña | 1 activación desde **Signar** (Librería) — **1 live run**, datos congelados |
| Storage | 54 MB en código hoy · Gemini sugiere 1 GB |

### Plan Pro (objetivo)

| Feature | Límite deseado |
|---------|----------------|
| Objetos | Ilimitados |
| Storage | **5 GB** |
| Créditos/tokens | **150** ejecuciones vivas/mes (overview + búsqueda unificados) |
| Forecast | Ilimitado |
| Campaña activa | Parte de ejecución (Social Hype + Search Intent incluidos) |
| Switch Librería | **0 costo** — datos ya en Supabase |
| Precio | **$15–19/mes** (Gemini) · marketing repo hoy **$20/mo** |

---

## 5. Modelo de tokens (moneda interna)

| Regla | Valor |
|-------|-------|
| 1 estudio de campaña (live) | **10,000 tokens** |
| Costo real aprox. | ~$0.005 USD |
| Tokens Groq reales por campaña | ~4,500 (in+out) |
| Margen restante | Cubre DataForSEO + Apify |

| Plan | Bolsa | Equivalente campañas live |
|------|-------|---------------------------|
| Gratis | 10,000 tokens (no renovables) | **1** campaña |
| Pro | 1,500,000 tokens/mes | **150** campañas/mes |
| Switch entre campañas guardadas | 0 tokens | Ilimitado |

Chat con notas / agente arquitecto (solo Groq): ~500–1,000 tokens/consulta.

---

## 6. Tabla maestra de integraciones

Ver también: [`docs/integraciones_futura_nota.csv`](integraciones_futura_nota.csv)

| Módulo | API | Costo unitario | Gratis | Pro | Supabase |
|--------|-----|----------------|--------|-----|----------|
| Estudio de campaña | DataForSEO + Apify + Groq | ~$0.005/live | 1× (10k tokens) | 150/mes (10k c/u) | JSON histórico; switch 0 tokens |
| Búsquedas Overview/Queue | DataForSEO / Serper | ~$0.001 | 10 únicas | Pool 150 live | Cola de resultados |
| Search Intent | DataForSEO Keywords | ~$0.0006 | Bloqueado | En estudio Pro | Mapa intenciones canvas |
| Social Hype | Apify | ~$0.003 | Solo vía Signar | 1–3 canales | Métricas sentimiento |
| People Also Ask | DataForSEO PAA | ~$0.0015 | 1× inicial | En estudio Pro | Tarjetas PAA |
| Weather / Forecast | OpenWeather | ~$0.0012 | 1 uso estático | Ilimitado (cache 45 min) | Cache reduce a ~$0 |
| Storage | Supabase | $0.05/GB extra | 1 GB (Gemini) / 54 MB (código) | 5 GB | Notas, imágenes, nodos |
| Export/import | Frontend | ~$0 | MD + JSON | PDF, Shopify, webhooks | Interoperabilidad |

---

## 7. Flujo «Overview + Nota» (Estudio de campaña)

1. Usuario activa campaña (Signar / objeto).
2. Backend en paralelo: DataForSEO (PAA) + Apify (Social Hype) + Groq (overview).
3. Groq devuelve:
   - **Estado:** ACTIVA / INACTIVA / EMERGENTE
   - **Nota:** 3 líneas de resumen ejecutivo
   - **PAA:** tarjetas para documentar estrategia
4. Resultado persistido en Supabase; Gratis no puede «Actualizar»; Pro debita tokens.

---

## 8. Recomendaciones de arquitectura (Gemini)

- Comprimir imágenes antes de subir a Supabase (Gratis).
- Cache OpenWeather 30–45 min por ciudad.
- No usar Brand24 como API backend.
- Preferir DataForSEO sobre SerpApi para PAA (15× más barato en pay-as-you-go).
- Valor Pro = Timeline + cuenta regresiva + Launch Radar + librería switch.

---

## 9. Notas

- Precios API son estimaciones 2026; validar antes de billing.
- CSV original mencionado en Gemini: `integraciones_futura_nota.csv` — recreado en este repo desde la tabla maestra del chat.
