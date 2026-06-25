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

**Migración SQL requerida:** ejecutar [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql) en Supabase (crea tablas + columnas + RLS). Si ves `relation "signal_campaigns" does not exist`, usa ese archivo completo — no solo ALTERs.

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

- Skill de arquitectura: [`.cursor/skills/architect-blueprint/SKILL.md`](.cursor/skills/architect-blueprint/SKILL.md)
- Migración pipeline: [`supabase_campaign_pipeline.sql`](supabase_campaign_pipeline.sql)
- Backup técnico Intel: [`docs/memoria-intel-session-backup.md`](docs/memoria-intel-session-backup.md)
- Brief técnico: [`TECH_BRIEF.md`](TECH_BRIEF.md)
