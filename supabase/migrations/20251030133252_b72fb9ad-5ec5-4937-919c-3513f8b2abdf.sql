-- Fix critical security issue: Prevent public browsing of share links
-- Only allow viewing a specific share link when the exact token is provided

-- Drop the existing insecure policy
DROP POLICY IF EXISTS "Public can view active share links" ON share_links;

-- Create a secure policy that requires knowing the exact token
-- This prevents attackers from browsing all tokens
CREATE POLICY "Public can view share link by exact token match"
ON share_links
FOR SELECT
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_downloads IS NULL OR current_downloads < max_downloads)
  AND token = current_setting('request.jwt.claims', true)::json->>'share_token'
);

-- However, since we're using a public endpoint, we need a different approach
-- Drop the policy above and create one that only works with specific queries
DROP POLICY IF EXISTS "Public can view share link by exact token match" ON share_links;

-- The safest approach: Create a security definer function to get share link data
CREATE OR REPLACE FUNCTION public.get_share_link_by_token(link_token text)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  token text,
  expires_at timestamptz,
  max_downloads integer,
  current_downloads integer,
  is_active boolean,
  filename text,
  original_filename text,
  file_size bigint,
  storage_path text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sl.id,
    sl.file_id,
    sl.token,
    sl.expires_at,
    sl.max_downloads,
    sl.current_downloads,
    sl.is_active,
    f.filename,
    f.original_filename,
    f.file_size,
    f.storage_path
  FROM share_links sl
  JOIN files f ON f.id = sl.file_id
  WHERE sl.token = link_token
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
    AND (sl.max_downloads IS NULL OR sl.current_downloads < sl.max_downloads)
  LIMIT 1;
$$;

-- Remove public insert access to download_logs
DROP POLICY IF EXISTS "Public can create download logs" ON download_logs;

-- Create a security definer function for logging downloads
CREATE OR REPLACE FUNCTION public.log_download(
  link_token text,
  user_agent_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_id uuid;
  log_id uuid;
BEGIN
  -- Get the share link id
  SELECT id INTO link_id
  FROM share_links
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_downloads IS NULL OR current_downloads < max_downloads);
  
  IF link_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;
  
  -- Insert the download log
  INSERT INTO download_logs (share_link_id, user_agent)
  VALUES (link_id, user_agent_text)
  RETURNING id INTO log_id;
  
  -- Increment download counter
  UPDATE share_links
  SET current_downloads = current_downloads + 1
  WHERE id = link_id;
  
  RETURN log_id;
END;
$$;