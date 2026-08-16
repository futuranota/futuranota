-- Expand `doc-images` MIME allow-list for library skill/PDF attachments (no WebP required).
-- Run in Supabase SQL Editor after supabase_storage_doc_images.sql.
-- Images stay WebP via app conversion; attachments upload as original bytes.

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800), -- 50 MB
  allowed_mime_types = ARRAY[
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/gzip',
    'application/x-tar',
    'application/json',
    'application/javascript',
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/css',
    'application/octet-stream',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
WHERE id = 'doc-images';

NOTIFY pgrst, 'reload schema';
