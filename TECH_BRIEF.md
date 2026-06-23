# Futura Nota — Tech Brief

> Stack completo, arquitectura de base de datos en Supabase, despliegue en Vercel, configuración de dominio y arquitectura de integración para WordPress.

---

## Stack

| Capa | Tecnología | Versión | Propósito |
|---|---|---|---|
| **Frontend** | React + Vite | React 18.x, Vite 6.x | Aplicación web e interfaz de usuario interactiva (Single Page App). |
| **Estilos** | CSS Vanilla + TailwindCSS | Tailwind v4 (integrado vía `@tailwindcss/vite`) | Estética minimalista futurista y componentes adaptables. |
| **Estado Local** | Zustand | v5.x | Gestión de estado reactivo bidireccional entre lienzo (Canvas), nodos y líneas de tiempo. |
| **Base de Datos** | Supabase (PostgreSQL) | Postgres 15 | Persistencia en la nube de campañas, inteligencias, nodos de canvas y tableros. |
| **Autenticación** | Supabase Auth | - | Control de acceso y sesiones de usuario por organización. |
| **CMS (Marketing)** | Tina CMS / WordPress | Tina v3 / WP 6.x (REST API) | Gestión de contenidos estáticos y artículos del blog de forma dinámica. |
| **Despliegue** | Vercel | - | Alojamiento en la nube con CD (Continuous Delivery) e importación de dominio público. |

---

## Arquitectura de Servidores e Infraestructura

### 1. Servidor Frontend & Servidores Serverless (Vercel)
* **Qué corre aquí:** Compilado SPA de React (Vite) y Serverless Functions para los middlewares de la API de analíticas (ej. `brandCadenceHandler` y `translateHandler`).
* **Por qué aquí:** Despliegue inmediato sincronizado con Git, distribución global por CDN y soporte nativo para proxies de APIs (ej. proxy `/jina` o endpoints de traducción).
* **Límites relevantes:** 10s de ejecución en Serverless Functions (plan gratuito/Hobby).

### 2. Base de Datos & Backend-as-a-Service (Supabase)
* **Qué corre aquí:** Instancia administrada de PostgreSQL, almacenamiento de archivos para uploads, WebSocket para tiempo real y motor de API REST autogenerado mediante PostgREST.
* **Por qué aquí:** Sincronización instantánea en tiempo real para el lienzo interactivo colaborativo y políticas de seguridad granulares (RLS).

### 3. CMS de Blogs (WordPress Headless)
* **Qué corre aquí:** Servidor externo de WordPress.
* **Por qué aquí:** Facilidad para redactores de contenido de gestionar publicaciones del blog sin interactuar con el código frontend.
* **Comunicación:** La aplicación Vite consume la API REST de WordPress en `/wp-json/wp/v2/posts` desde las páginas de blog en el frontend.

---

## APIs y Servicios Externos

| Servicio | Propósito | Tipo | Costo | Notas |
|---|---|---|---|---|
| **WordPress REST API** | Ingesta de artículos, categorías y metadatos del blog | API REST pública | Gratis (autoalojado o WP.com) | Consumido en `/blogs` y `/blogs/:slug`. |
| **Supabase PostgREST API** | Operaciones CRUD automáticas sobre el esquema de datos | API REST / WebSocket | Gratis (Tier gratuito) | Utiliza `supabase-js` para operaciones en tiempo real. |
| **Google Translate API** | Traducción dinámica de notas e inteligencia | API REST | $20 por millón de caracteres | Opcional, configurado mediante variable `GOOGLE_TRANSLATE_API_KEY`. |
| **Jina Reader** | Extracción del contenido de enlaces de noticias compartidos | API REST Proxy `/jina` | Gratis / Prepago | Usado para resumir URLs en tarjetas del lienzo. |

---

## Schema de Base de Datos (Supabase SQL)

Para sustituir el almacenamiento de `localStorage` (`futura-nota-v1`), se define el siguiente esquema relacional en Supabase con Row Level Security (RLS) habilitado.

```sql
-- Habilitar extensión UUID si no está activada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: companies (Organizaciones/Marcas)
CREATE TABLE public.companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sector VARCHAR(100),
    campaigns_count INT DEFAULT 0,
    signal_strength INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'STANDBY', 'QUIET')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: campaigns (Campañas de Inteligencia)
CREATE TABLE public.campaigns (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    source TEXT,
    verification_score INT DEFAULT 0 CHECK (verification_score BETWEEN 0 AND 100),
    announcement_date DATE,
    launch_date DATE,
    market_gap TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: intel_signals (Señales de Inteligencia/Leaks)
CREATE TABLE public.intel_signals (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'news',
    confidence INT DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: canvas_nodes (Nodos del Lienzo)
CREATE TABLE public.canvas_nodes (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('text', 'date', 'metric')),
    content JSONB NOT NULL, -- Contiene estructura flexible de la nota (ej. {value: 82, unit: 'kWh'} o {text: '...' })
    x_pos DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    y_pos DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    color_theme VARCHAR(20) DEFAULT 'mint',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA: canvas_connections (Líneas de conexión entre nodos)
CREATE TABLE public.canvas_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    source_id VARCHAR(50) REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
    target_id VARCHAR(50) REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
    label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA: timelines (Hitos de Lanzamiento)
CREATE TABLE public.timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    target_date DATE NOT NULL,
    tier VARCHAR(20) DEFAULT 'primary' CHECK (tier IN ('primary', 'tactical', 'strategic')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS (Lectura pública / Escritura autenticada por defecto)
CREATE POLICY "Permitir lectura a todo el mundo" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Permitir lectura a todo el mundo" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Permitir lectura a todo el mundo" ON public.intel_signals FOR SELECT USING (true);
CREATE POLICY "Permitir lectura a todo el mundo" ON public.canvas_nodes FOR SELECT USING (true);
CREATE POLICY "Permitir lectura a todo el mundo" ON public.canvas_connections FOR SELECT USING (true);
CREATE POLICY "Permitir lectura a todo el mundo" ON public.timelines FOR SELECT USING (true);

-- Escritura solo para usuarios autenticados
CREATE POLICY "Permitir inserción a autenticados" ON public.companies FOR ALL TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir inserción a autenticados" ON public.campaigns FOR ALL TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir inserción a autenticados" ON public.intel_signals FOR ALL TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir inserción a autenticados" ON public.canvas_nodes FOR ALL TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir inserción a autenticados" ON public.canvas_connections FOR ALL TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir inserción a autenticados" ON public.timelines FOR ALL TO authenticated WITH CHECK (true);
```

---

## Integración Paso a Paso con WordPress (Sección Blogs)

Para consumir las publicaciones de tu WordPress en lugar de usar los JSONs estáticos locales, se reemplazará la ingesta de archivos en la ruta de marketing:

### 1. Configuración de API en el Cliente Frontend
Crea un archivo de integración para WordPress en `src/marketing/lib/wordpress.js`:

```javascript
const WP_API_URL = "https://tu-dominio-wordpress.com/wp-json/wp/v2";

/** Obtener la lista de posts del Blog */
export async function fetchWpPosts() {
  const res = await fetch(`${WP_API_URL}/posts?_embed=true`);
  if (!res.ok) throw new Error("Error fetching posts from WordPress");
  const posts = await res.json();
  
  // Mapear el formato de WordPress al formato esperado por el componente Blogs.jsx
  return posts.map(post => ({
    id: post.id,
    title: post.title.rendered,
    description: post.excerpt.rendered.replace(/<[^>]+>/g, ''), // Limpiar HTML
    slug: post.slug,
    date: new Date(post.date).toLocaleDateString(),
    image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || "/uploads/placeholder.jpg",
    content: post.content.rendered,
  }));
}

/** Obtener un artículo individual usando el Slug */
export async function fetchWpPostBySlug(slug) {
  const res = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed=true`);
  if (!res.ok) throw new Error("Error fetching post details from WordPress");
  const posts = await res.json();
  if (posts.length === 0) return null;
  
  const post = posts[0];
  return {
    id: post.id,
    title: post.title.rendered,
    content: post.content.rendered,
    date: new Date(post.date).toLocaleDateString(),
    image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || "/uploads/placeholder.jpg",
  };
}
```

### 2. Modificaciones en Páginas del Frontend
* En [BlogsPage.jsx](file:///Users/r/Downloads/futuranota/src/marketing/pages/BlogsPage.jsx): Usar un hook `useEffect` para cargar los posts usando `fetchWpPosts()` y guardarlos en el estado local en vez de cargarlos estáticamente desde `site.json` y `blogs-page.json`.
* En [BlogPostPage.jsx](file:///Users/r/Downloads/futuranota/src/marketing/pages/BlogPostPage.jsx): Cargar de manera asíncrona la información detallada del post mediante `fetchWpPostBySlug(slug)` basándose en el parámetro de la URL.

---

## Guía de Despliegue en Vercel

Sigue estos pasos para desplegar tu aplicación en Vercel:

### Paso 1: Inicializar y Conectar Repositorio
1. Asegúrate de tener tu código subido a una rama de Git (GitHub, GitLab o Bitbucket).
2. Entra a tu panel de **Vercel** y haz clic en **Add New** > **Project**.
3. Importa el repositorio de `futuranota`.

### Paso 2: Configurar Parámetros del Proyecto
En la configuración del despliegue en Vercel, ajusta los siguientes valores:
* **Framework Preset:** `Vite` (Vercel lo detecta automáticamente).
* **Root Directory:** `./` (o la raíz del proyecto).
* **Build Command:** `npm run build`
* **Output Directory:** `dist`

### Paso 3: Configurar Variables de Entorno (.env)
Agrega las siguientes variables en la sección de **Environment Variables** en Vercel:

```env
TINA_PUBLIC_CLIENT_ID=e044d197-ab35-4cfd-a4de-a5f5afdf8cdf
TINA_TOKEN=252728cc28bf43a963e858d0582e5028af7acb22
TINA_SEARCH_TOKEN=c9bddb586d11ca20c1a26b13b5531da38beaf1c4
TINA_BRANCH=main
TINA_PREVIEW_URL=https://tu-dominio-produccion.com
GOOGLE_TRANSLATE_API_KEY=AIzaSyCrxUQFuyt1gcBW1LUdGu3HGpZ1_Fpmggc
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_PROJECT_URL=https://ywmejzmvchuqptktxdps.supabase.co
```

*Haz clic en **Deploy**.*

---

## Configuración de Dominio Público en Vercel

Para apuntar tu propio dominio público (ej. `mi-dominio.com` o `futuranota.com`) a tu aplicación alojada en Vercel:

### Paso 1: Añadir Dominio en Vercel
1. Ve a tu proyecto en Vercel, navega a **Settings** > **Domains**.
2. Escribe tu dominio (ej. `www.futuranota.com` o `futuranota.com`) y haz clic en **Add**.
3. Vercel te dará los registros DNS recomendados.

### Paso 2: Configurar los registros en tu Proveedor de Dominio (Namecheap, GoDaddy, Cloudflare, etc.)
Ve a la consola de administración de tu dominio y crea los siguientes registros:

* **Para el dominio raíz (`midominio.com`):**
  * **Tipo:** `A`
  * **Nombre:** `@`
  * **Valor (IP de Vercel):** `76.76.21.21`

* **Para el subdominio (`www.midominio.com` o subdominios alternativos):**
  * **Tipo:** `CNAME`
  * **Nombre:** `www`
  * **Valor:** `cname.vercel-dns.com.`

*Vercel validará la configuración DNS de forma automática y generará un certificado SSL gratuito (Let's Encrypt) en unos minutos.*

---

## Estructura de Páginas y Enrutamiento actual

El enrutador actual está definido en [router.jsx](file:///Users/r/Downloads/futuranota/src/router.jsx):

```mermaid
graph TD
    A[Ruta Raíz /] --> B{Enrutador principal}
    B -->|index| C[HomePage - Web corporativa]
    B -->|/horizon| D[HorizonPage - Portafolio y Radar]
    B -->|/how| E[HowPage - Explicación metodológica]
    B -->|/blogs| F[BlogsPage - Listado de posts]
    B -->|/blogs/:slug| G[BlogPostPage - Detalle del post]
    B -->|/welcome| H[WelcomePage - Onboarding de usuario]
    B -->|/app/*| I[App - Dashboard interactivo y Canvas del cliente]
```

### Secciones claves:
1. **Layout de Marketing ([MarketingLayout.jsx](file:///Users/r/Downloads/futuranota/src/marketing/layout/MarketingLayout.jsx)):** Envuelve todas las páginas corporativas (`/`, `/horizon`, `/how`, `/blogs`), compartiendo cabecera (Nav) y pie de página (Footer) con estética minimalista.
2. **Dashboard de Aplicación ([App.jsx](file:///Users/r/Downloads/futuranota/src/App.jsx)):** La experiencia del lienzo interactivo y herramientas analíticas se monta en la ruta `/app`, protegida mediante la sesión de usuario de Supabase.

---

## Próximo Paso Concreto
> [!IMPORTANT]
> **Paso Inicial:** Configura las tablas en Supabase usando el script SQL provisto arriba desde el editor SQL de Supabase (SQL Editor). Posteriormente, instalaremos `@supabase/supabase-js` para iniciar el desarrollo del middleware de persistencia en la base de datos real.
