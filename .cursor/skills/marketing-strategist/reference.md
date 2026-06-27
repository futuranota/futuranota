# Referencia — Futura Nota marketing

## Posicionamiento

**Categoría:** Campaign-aware workspace for makers (not generic note-taking, not pure CRM).

**Competidores implícitos (no nombrar en copy salvo comparación explícita):**

- Notion / Obsidian — organización, sin ventana de lanzamiento
- Google Alerts / manual research — señal sin timeline ni objetos
- Generic AI search — respuesta sin scope temporal ni nodo en canvas

**Moat a comunicar:** objetos + nodos con schedule + detección de campaña + ventana cerrable.

## Audiencias

### Maker (primaria)

- Tiene skill + producto físico o prototipo
- Pain: llega tarde al hype; no sabe cuándo lanzar companion
- Gancho: ventana concreta + kit/playbook
- Objeción: "otra herramienta más" → responder con free tier y una acción clara (10 searches)

### Founder / campaign watcher (secundaria)

- Estudia lanzamientos ajenos para oportunidad B2B o portfolio
- Pain: demasiadas fuentes, poca síntesis temporal
- Gancho: intel overview + cadence + hero signals

## Superficies marketing en repo

| Superficie | Archivo / ruta |
|------------|----------------|
| Home hero (maker/founder) | `content/marketing/home.json` → `hero` |
| Directory cards | `content/marketing/home.json` → `directory` |
| Pricing | `content/marketing/home.json` → `pricing` |
| Final CTA | `content/marketing/home.json` + `src/marketing/components/FinalCTA.jsx` |
| How it works | `content/marketing/how.json` |
| Horizon story | `content/marketing/horizon.json` |
| Blogs index | `content/marketing/blogs-page.json` |
| Blog posts | `content/marketing/blogs/*.json` |
| Site chrome | `content/marketing/site.json` |
| In-app upgrade reasons | `src/i18n/messages.js` → `upgrade.*` |
| Plan limits (copy hooks) | `src/lib/planConfig.js` |

## Hooks free → pro (para CTAs honestos)

- Free: 1 object, 10 AI searches, calendar one-shot, 2 forecast nodes / 5 city changes day
- Pro: unlimited objects, 150 searches/mo, unlimited calendar, 50 forecast nodes
- Usar en trust chips y upgrade copy sin exagerar

## Funnel sugerido

```
Awareness (blog, social, PH, communities)
    → Landing hero (claim + trust chip)
    → Directory / How (educate)
    → Signup
    → Activation: create object + first intel search OR import kit
    → Retention: timeline + campaign scan before next window
    → Pro: hit limit with clear upgrade reason
```

## Métricas north star (por etapa)

| Etapa | Métrica |
|-------|---------|
| Landing | CTR primary CTA, scroll depth to pricing |
| Signup | Conversion visit → account |
| Activation | % users with ≥1 intel search in 7d |
| Revenue | Free → Pro after limit hit |
| Content | Organic sessions → signup attributed |

## Secciones landing — objetivo por bloque

| Sección | Job to be done | CTA tipo |
|---------|----------------|----------|
| Hero | Entender propuesta en 5s | Primary: plans/signup; Secondary: demo |
| Marquee / frame | Prueba visual de "ventana" | Ninguno — soporte |
| Features 01–03 | Diferenciar modelo objetos/nodos | Scroll |
| Directory | Segmentar rutas (Horizon / How / Blog) | Card CTAs |
| Pricing | Comparar free vs pro sin sorpresa | Switch plan |
| Final CTA | Última oportunidad conversión | Primary signup |

## Ideas de adquisición (filtradas)

1. **SEO clusters** — companion product, launch window, campaign timeline (posts ya sembrados en blogs/)
2. **Horizon kits as lead magnet** — gated download → email → workspace
3. **Launch reactive content** — cuando admin publica hero_signal, post + social en 48h
4. **Maker communities** — aportar valor (ventana + checklist) antes de mencionar producto
5. **Product Hunt** — coordinar con ventana real o kit nuevo, no launch vacío
6. **Partnership** — co-marketing con marca detectada (companion, no competidor)

## Voz — palabras preferidas vs evitar

| Preferir | Evitar |
|----------|--------|
| window, ship, companion, signal, timeline | revolutionary, disruptive, synergy |
| maker, hand-made, prototype, drop | enterprise-grade (salvo founder mode) |
| detect, spot, move | AI-powered (como claim vacío) |
