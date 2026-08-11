-- Document images → Supabase Storage (Paso 1)
-- Bucket: public `doc-images`
-- Object path: {user_id}/{scopeId}/{fileId}.webp
--
-- Run in Supabase SQL Editor after (or instead of) creating the bucket in Dashboard.
-- Idempotent: safe to re-run.

-- 1) Bucket (public read so <img src={publicUrl}> works without signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doc-images',
  'doc-images',
  true,
  10485760, -- 10 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit);

-- 2) Policies — first path segment must equal auth.uid()
DROP POLICY IF EXISTS "doc_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "doc_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "doc_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "doc_images_authenticated_delete" ON storage.objects;

CREATE POLICY "doc_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'doc-images');

CREATE POLICY "doc_images_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'doc-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "doc_images_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'doc-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'doc-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "doc_images_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'doc-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
