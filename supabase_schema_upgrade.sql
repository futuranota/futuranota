-- SCRIPT DE ACTUALIZACIÓN / CREACIÓN DE TABLAS EN SUPABASE

-- Habilitar extensión UUID si no está activada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: companies (Organizaciones/Marcas)
CREATE TABLE IF NOT EXISTS public.companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sector VARCHAR(100),
    campaigns_count INT DEFAULT 0,
    signal_strength INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'STANDBY', 'QUIET')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar columnas adicionales de la app a la tabla companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS role VARCHAR(20);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. TABLA: campaigns (Campañas de Inteligencia / Documentos)
CREATE TABLE IF NOT EXISTS public.campaigns (
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

-- Agregar columnas adicionales de la app a la tabla campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS blocks JSONB;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS data_properties JSONB;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS doc_kind VARCHAR(50) DEFAULT 'standard';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_kind VARCHAR(50);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS subcategory_doc_ids JSONB;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS version VARCHAR(20);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS launch_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS node_link_color VARCHAR(20);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS knowledge_import JSONB;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. TABLA: nodes (Entidades / Datos extraídos de Documentos)
CREATE TABLE IF NOT EXISTS public.nodes (
    id VARCHAR(50) PRIMARY KEY,
    parent_doc_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    content JSONB,
    source_query TEXT,
    reference JSONB,
    linked_to_canvas BOOLEAN DEFAULT FALSE,
    canvas_node_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: canvas_nodes (Nodos colocados en el Canvas)
CREATE TABLE IF NOT EXISTS public.canvas_nodes (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('text', 'date', 'metric', 'checkbox', 'video')),
    content JSONB NOT NULL,
    x_pos DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    y_pos DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    color_theme VARCHAR(20) DEFAULT 'mint',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar columnas adicionales de la app a la tabla canvas_nodes
ALTER TABLE public.canvas_nodes ADD COLUMN IF NOT EXISTS node_id VARCHAR(50);
ALTER TABLE public.canvas_nodes ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE public.canvas_nodes ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT FALSE;
ALTER TABLE public.canvas_nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. TABLA: canvas_connections (Líneas de conexión entre nodos)
CREATE TABLE IF NOT EXISTS public.canvas_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    source_id VARCHAR(50) REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
    target_id VARCHAR(50) REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
    label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar columnas adicionales de la app a la tabla canvas_connections
ALTER TABLE public.canvas_connections ADD COLUMN IF NOT EXISTS from_canvas_node_id VARCHAR(50);
ALTER TABLE public.canvas_connections ADD COLUMN IF NOT EXISTS to_canvas_node_id VARCHAR(50);
ALTER TABLE public.canvas_connections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 6. TABLA: groupings (Grupos de nodos en el canvas)
CREATE TABLE IF NOT EXISTS public.groupings (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    canvas_node_ids JSONB NOT NULL,
    parent_doc_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLA: timelines (Hitos de Lanzamiento en la línea de tiempo)
CREATE TABLE IF NOT EXISTS public.timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    target_date DATE NOT NULL,
    tier VARCHAR(20) DEFAULT 'primary' CHECK (tier IN ('primary', 'tactical', 'strategic', 'nodes')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Agregar columnas adicionales de la app a la tabla timelines
ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS entries JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 8. TABLA: intel_signals (Señales de Inteligencia/Leaks de la sección Feed)
CREATE TABLE IF NOT EXISTS public.intel_signals (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'news',
    confidence INT DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groupings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_signals ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS (Lectura pública / Escritura permitida para todos de forma temporal para desarrollo rápido)
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.companies;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.campaigns;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.nodes;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.canvas_nodes;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.canvas_connections;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.groupings;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.timelines;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.intel_signals;

CREATE POLICY "Permitir todo a todos" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.canvas_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.canvas_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.groupings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.timelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos" ON public.intel_signals FOR ALL USING (true) WITH CHECK (true);
