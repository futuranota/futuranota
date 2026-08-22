-- Optional one-shot: reset ONLY the latest share row to requested
-- (use if the overlay still shows Share/copy instead of Requested).
-- Run in Supabase SQL Editor.

UPDATE public.step_playbook_shares
SET
  status = 'requested',
  requested_at = timezone('utc'::text, now()),
  reviewed_at = NULL,
  reviewed_by = NULL,
  updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT id
  FROM public.step_playbook_shares
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
);
