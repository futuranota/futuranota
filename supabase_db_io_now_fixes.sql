-- Futura Nota — DB IO now fixes (idempotent)
-- Run in Supabase → SQL Editor → Run.
-- Then run supabase_db_io_now_vacuum.sql separately (VACUUM cannot run in a txn).

-- ── A. Campaigns columns the app already upserts ─────────────────────────────
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
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS launch_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS schedule_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS schedule_finish_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS node_link_color VARCHAR(20);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS knowledge_import JSONB;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- ── B. Indexes for hydrate/sync filters (WHERE user_id = …) ───────────────────
CREATE INDEX IF NOT EXISTS companies_user_id_idx ON public.companies (user_id);
CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS nodes_user_id_idx ON public.nodes (user_id);
CREATE INDEX IF NOT EXISTS canvas_nodes_user_id_idx ON public.canvas_nodes (user_id);
CREATE INDEX IF NOT EXISTS canvas_connections_user_id_idx ON public.canvas_connections (user_id);
CREATE INDEX IF NOT EXISTS groupings_user_id_idx ON public.groupings (user_id);
CREATE INDEX IF NOT EXISTS timelines_user_id_idx ON public.timelines (user_id);

-- Verify indexes (expect one row per table above)
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'companies_user_id_idx',
    'campaigns_user_id_idx',
    'nodes_user_id_idx',
    'canvas_nodes_user_id_idx',
    'canvas_connections_user_id_idx',
    'groupings_user_id_idx',
    'timelines_user_id_idx'
  )
ORDER BY tablename, indexname;
