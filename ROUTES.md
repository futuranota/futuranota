# Rutas — Futura Nota

Referencia de URLs del proyecto (marketing + app + Tina CMS).

**Base en desarrollo:** `http://localhost:5173`  
**Admin Tina:** `http://localhost:5173/admin/index.html`  
**Servidor Tina (dev local):** `http://localhost:4001` (`npm run dev:tina`)  
The public site reads Tina Cloud first, then local GraphQL, then `content/marketing/*.json`.

---

## Marketing (sitio público)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Home | Hero, directorio, **pricing** (`#pricing`), CTA final |
| `/#pricing` | Home (anchor) | Sección de planes Free / Pro |
| `/horizon` | Horizon | Oportunidades de negocio (cards con download / login) |
| `/how` | How it works | Walkthrough en 5 pasos |
| `/marketplace` | Marketplace | Kits descargables / importables |
| `/blogs` | Blogs | Listado de artículos por categoría |
| `/welcome` | Auth | Sign up (plan free por defecto) |
| `/welcome?plan=free` | Auth | Sign up — plan Free |
| `/welcome?plan=pro` | Auth | Sign up — plan Pro ($9.99) |
| `/welcome#signin` | Auth | Sign in (mismo destino que **Log in** en el nav; ignora `?plan`) |

### Redirecciones

| Ruta | Destino |
|------|---------|
| `/ensenanzas` | `/blogs` (301 interno, `replace`) |
| `/*` (cualquier otra) | `/` |

---

## Blog — artículos individuales

Patrón: `/blogs/{slug}`

| URL completa (dev) | Slug | Título |
|--------------------|------|--------|
| `http://localhost:5173/blogs/brand-voice-for-makers` | `brand-voice-for-makers` | Brand voice for makers: say less, ship more |
| `http://localhost:5173/blogs/coffee-and-cup-playbook` | `coffee-and-cup-playbook` | The coffee-and-cup playbook: companion products, explained |
| `http://localhost:5173/blogs/dtc-drops-worth-watching` | `dtc-drops-worth-watching` | DTC drops worth watching — and the gaps they leave open |
| `http://localhost:5173/blogs/how-to-read-a-launch-campaign` | `how-to-read-a-launch-campaign` | How to read a launch campaign before it lands |
| `http://localhost:5173/blogs/landing-pages-before-launch` | `landing-pages-before-launch` | Landing pages that convert before launch day |
| `http://localhost:5173/blogs/outbound-launch-calendar` | `outbound-launch-calendar` | Outbound that respects the launch calendar |
| `http://localhost:5173/blogs/physical-products-selling-out` | `physical-products-selling-out` | Physical products that are quietly selling out this quarter |
| `http://localhost:5173/blogs/pricing-companion-products` | `pricing-companion-products` | Pricing companion products when the window is short |

Nuevo artículo: el filename en Tina define la URL → `mi-post.json` → `/blogs/mi-post`

---

## App (producto)

| Ruta | Descripción |
|------|-------------|
| `/app` | Dashboard Futura Nota (selector → workspace) |
| `/app/*` | Rutas internas de la app (canvas, docs, etc.) |

---

## Tina CMS — colecciones y preview

| Colección Tina | Archivo JSON | Preview |
|----------------|--------------|---------|
| Site (nav & footer) | `content/marketing/site.json` | `/` |
| Home page | `content/marketing/home.json` | `/` |
| Horizon page | `content/marketing/horizon.json` | `/horizon` |
| How it works | `content/marketing/how.json` | `/how` |
| Marketplace | `content/marketing/marketplace.json` | `/marketplace` |
| Blogs page | `content/marketing/blogs-page.json` | `/blogs` |
| Blog articles | `content/marketing/blogs/*.json` | `/blogs/{slug}` |

**Admin:** `http://localhost:5173/admin/index.html`

---

## Enlaces especiales en Horizon (cards)

| Botón | Ruta |
|-------|------|
| Open in Futura | `/welcome#signin` |
| Download prototype | URL del ZIP subido en Tina (ej. `/uploads/prototypes/archivo.zip`) |

---

## Lista rápida (copiar/pegar)

```
http://localhost:5173/
http://localhost:5173/#pricing
http://localhost:5173/horizon
http://localhost:5173/how
http://localhost:5173/marketplace
http://localhost:5173/blogs
http://localhost:5173/welcome?plan=free
http://localhost:5173/welcome?plan=pro
http://localhost:5173/welcome#signin
http://localhost:5173/app
http://localhost:5173/admin/index.html

http://localhost:5173/blogs/brand-voice-for-makers
http://localhost:5173/blogs/coffee-and-cup-playbook
http://localhost:5173/blogs/dtc-drops-worth-watching
http://localhost:5173/blogs/how-to-read-a-launch-campaign
http://localhost:5173/blogs/landing-pages-before-launch
http://localhost:5173/blogs/outbound-launch-calendar
http://localhost:5173/blogs/physical-products-selling-out
http://localhost:5173/blogs/pricing-companion-products
```

---

## Código fuente

Definición de rutas: `src/router.jsx`  
Constantes: `src/marketing/lib/paths.js`  
Helper blog: `blogPostPath(slug)` → `/blogs/{slug}`  
Helper auth: `authPath('signin')` → `/welcome#signin`  
Helper auth: `authPath(undefined, { plan: 'pro' })` → `/welcome?plan=pro`
