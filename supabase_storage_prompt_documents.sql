-- Prompt desk documents → Supabase Storage
-- Bucket: public `prompt-images` (same bucket as prompt images)
-- Object path: {user_id}/{file_id}.pdf | .md | .txt
--
-- Run in the Supabase SQL Editor. Safe to re-run.
-- This is what lets Yes save a PDF, Markdown, or text file.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prompt-images',
  'prompt-images',
  true,
  26214400,
  ARRAY[
    'image/webp',
    'image/svg+xml',
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), EXCLUDED.file_size_limit),
  allowed_mime_types = CASE
    WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL
    ELSE (
      SELECT array_agg(DISTINCT mime)
      FROM unnest(storage.buckets.allowed_mime_types || EXCLUDED.allowed_mime_types) AS mime
    )
  END;

DROP POLICY IF EXISTS "prompt_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "prompt_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "prompt_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "prompt_images_authenticated_delete" ON storage.objects;

CREATE POLICY "prompt_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'prompt-images');

CREATE POLICY "prompt_images_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "prompt_images_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'prompt-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "prompt_images_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
