-- Campaign workspace: activation datetime + file-level completion.
-- Target Launch remains campaigns.launch_at. Schedule columns stay for Content folders only.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS activate_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_completed BOOLEAN DEFAULT false;

-- One-time backfill: existing campaign files without Activate At use Target Launch.
UPDATE public.campaigns
SET activate_at = launch_at
WHERE campaign_active = true
  AND activate_at IS NULL
  AND launch_at IS NOT NULL;
