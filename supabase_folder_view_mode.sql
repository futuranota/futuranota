-- Per-folder Story / Quick document presentation preference.
-- New rows default to Quick (Title + Direct Link). Existing rows keep their value
-- unless you run an explicit UPDATE (not included here).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'quick';

-- If the column already existed with DEFAULT 'story', re-point the default for new inserts.
ALTER TABLE public.campaigns
  ALTER COLUMN view_mode SET DEFAULT 'quick';

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_view_mode_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_view_mode_check
  CHECK (view_mode IN ('story', 'quick'));

NOTIFY pgrst, 'reload schema';
