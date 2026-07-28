-- Departments taxonomy (company-scoped).
-- Category = department name (e.g. Marketing).
-- Subcategories = classification tags (e.g. Blogs, Social Media).
-- Folders (campaigns) link via department_id + category (= subcategory tag).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.departments (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id VARCHAR(50),
  category TEXT NOT NULL DEFAULT '',
  subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS departments_user_id_idx ON public.departments (user_id);
CREATE INDEX IF NOT EXISTS departments_object_id_idx ON public.departments (object_id);
CREATE INDEX IF NOT EXISTS departments_user_object_idx ON public.departments (user_id, object_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_owner_all" ON public.departments;
CREATE POLICY "departments_owner_all" ON public.departments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Link content folders to a department row
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS department_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS campaigns_department_id_idx
  ON public.campaigns (department_id);
