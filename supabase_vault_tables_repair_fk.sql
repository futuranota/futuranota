-- Repair: drop FK on object_id if you already ran the first migration.
-- Run once in Supabase SQL Editor if upserts fail with foreign key errors.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'url_table_entries'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'object_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.url_table_entries DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'password_table_entries'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'object_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.password_table_entries DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
