-- Per-folder Story / Quick document presentation preference.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'story';

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_view_mode_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_view_mode_check
  CHECK (view_mode IN ('story', 'quick'));

NOTIFY pgrst, 'reload schema';
