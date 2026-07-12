-- Folder Schedule Start / Finish reservation fields on campaigns (documents/folders).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS schedule_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS schedule_finish_at TIMESTAMP WITH TIME ZONE;
