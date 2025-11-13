-- Add storage policies to allow public downloads via valid share links
CREATE POLICY "Public can download files via valid share links"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'secure-files' 
  AND EXISTS (
    SELECT 1 
    FROM public.share_links sl
    JOIN public.files f ON f.id = sl.file_id
    WHERE f.storage_path = storage.objects.name
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
      AND (sl.max_downloads IS NULL OR sl.current_downloads < sl.max_downloads)
  )
);