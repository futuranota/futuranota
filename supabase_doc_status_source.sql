-- Macronode Status (completed) + Source
-- Stored in nodes.reference JSONB alongside anchorAt (no new columns required).
-- Optional: if you prefer dedicated columns later:
--   ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
--   ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS source_id VARCHAR(40);

COMMENT ON COLUMN public.nodes.reference IS
  'JSONB meta: anchorAt (schedule ISO), completed (bool), sourceId (doc source catalog id)';
