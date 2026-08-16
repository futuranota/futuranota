-- Expand `doc-images` for library skill attachments + videos.
-- Run in Supabase SQL Editor after supabase_storage_doc_images.sql.
-- Images stay WebP via app conversion; attachments/videos upload as original bytes.

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 104857600), -- 100 MB
  allowed_mime_types = ARRAY[
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
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
