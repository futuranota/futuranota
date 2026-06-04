# Futura Nota — Marketing site (Vite)

Sitio marketing migrado desde `futura-landing/` (HTML + Babel CDN) a React + Vite + React Router.

## Mapa de rutas

| URL | Página | Descripción |
|-----|--------|-------------|
| `/` | Home | Hero, directorio de secciones, CTA final |
| `/horizon` | Horizon | Oportunidades de negocio pre-modeladas |
| `/how` | How it works | Walkthrough en 5 pasos + video placeholder |
| `/marketplace` | Marketplace | Kits descargables / importables |
| `/blogs` | Blogs | Artículos Shark Tank, ecommerce, AI |
| `/ensenanzas` | Enseñanzas | Cursos cortos para makers |
| `/welcome` | Auth | Sign up / sign in (prototipo) |
| `/welcome#signin` | Auth | Tab sign in |
| `/app` | App | Dashboard Futura Nota (selector → workspace) |

## Flujo del usuario

```
/  (landing)
  ├── /horizon, /how, /marketplace, /blogs, /ensenanzas  (subpáginas)
  ├── /welcome  (crear cuenta / login)
  └── /app  (producto — selector de company → dashboard)
```

Tras auth exitoso, **Enter Futura** lleva a `/app` (no de vuelta a la landing).

## Estructura de archivos

```
src/marketing/
├── README.md                 ← este archivo
├── lib/
│   ├── paths.js              ← constantes de rutas (PATHS, authPath)
│   └── theme.js              ← acentos terracotta/green/violet, applyMarketingTheme
├── layout/
│   ├── MarketingLayout.jsx   ← Nav + Footer + canvas-bg (shell común)
│   └── SubpageLayout.jsx     ← link “Volver al inicio” + contenido
├── components/               ← piezas reutilizables de la landing
│   ├── Mark.jsx              ← logo SVG
│   ├── Wordmark.jsx
│   ├── Nav.jsx
│   ├── Hero.jsx              ← hero + feature cards 01–03
│   ├── SectionDirectory.jsx  ← grid de 5 ventanas
│   ├── FinalCTA.jsx
│   └── Footer.jsx
├── sections/                 ← contenido de cada subpágina
│   ├── Horizon.jsx
│   ├── HowItWorks.jsx
│   ├── Marketplace.jsx
│   └── Blogs.jsx             ← Blogs + Ensenanzas
├── pages/                    ← una página = layout + section
│   ├── HomePage.jsx          ← incluye TweaksPanel (accent, hero mode)
│   ├── HorizonPage.jsx
│   ├── HowPage.jsx
│   ├── MarketplacePage.jsx
│   ├── BlogsPage.jsx
│   ├── EnsenanzasPage.jsx
│   └── WelcomePage.jsx       ← layout propio (sin Nav/Footer)
└── styles/
    ├── marketing.css         ← design system (tokens, canvas, auth)
    └── sections.css          ← nav, hero, cards, grids
```

## Estructura de la página Home (`/`)

```
MarketingLayout
├── canvas-bg (dot grid + glow)
├── Nav
│   ├── Wordmark → /
│   ├── Horizon · Marketplace · Blogs · Enseñanzas
│   └── Log in · Sign up free
├── main
│   ├── Hero
│   │   ├── copy (eyebrow, h1, lead, CTAs)
│   │   ├── HeroFrame (mock producto LIVE)
│   │   └── FeatureCards (01 Objects · 02 Docs · 03 Canvas)
│   ├── SectionDirectory (5 cards → subpáginas)
│   └── FinalCTA (signup block)
└── Footer (newsletter + columnas)
```

## Subpáginas

Todas usan `MarketingLayout` + `SubpageLayout` + una `section/*`:

```
MarketingLayout
├── Nav
├── main
│   ├── SubpageLayout → “← Volver al inicio”
│   └── Horizon | HowItWorks | Marketplace | Blogs | Ensenanzas
└── Footer
```

## Auth (`/welcome`)

Layout split sin Nav global:

```
auth-wrap
├── auth-aside (valor de marca, bullet points)
└── auth-main
    └── auth-card (tabs signup/signin, OAuth, formulario email)
```

## App producto (`/app`)

Vive en `src/App.jsx` — selector de company y dashboard. La landing vieja (`src/pages/LandingPage.jsx`) ya no se usa; el marketing reemplaza esa entrada.

## Export Pack v2

Junto a **Export pack**, **Pack v2** genera un ZIP con carpetas legibles:

```
{nombre-marca}/
  Brand/object.json
  Products/{categoria}/{version}/doc.json + assets/*.webp
  Content/{titulo}/doc.json + assets/ + nodes/*.json
  Nodes/*.json
  manifest.json, model.json, README.txt
```

Import pack acepta v1 y v2.

## Carpeta legacy

`futura-landing/` en la raíz del repo es la versión HTML original. Puede eliminarse cuando confirmes que la migración Vite cubre todo.

## Dev

```bash
npm run dev
# http://localhost:5173/        → landing
# http://localhost:5173/app     → dashboard
```
