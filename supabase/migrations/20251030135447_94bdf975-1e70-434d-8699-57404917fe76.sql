-- Add unique constraint to share_links token to prevent collisions
ALTER TABLE share_links ADD CONSTRAINT share_links_token_unique UNIQUE (token);

-- Create rate limiting table for download attempts
CREATE TABLE IF NOT EXISTS public.download_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  token text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Enable RLS on download_attempts
ALTER TABLE public.download_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow viewing own download attempts (for admins in future)
CREATE POLICY "Service role can manage download attempts"
ON public.download_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for efficient rate limit queries
CREATE INDEX idx_download_attempts_ip_time ON public.download_attempts(ip_address, attempted_at);
CREATE INDEX idx_download_attempts_token_time ON public.download_attempts(token, attempted_at);

-- Update log_download function to include rate limiting
CREATE OR REPLACE FUNCTION public.log_download(link_token text, user_agent_text text, ip_addr inet)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link_id uuid;
  log_id uuid;
  recent_attempts integer;
  recent_failures integer;
BEGIN
  -- Check IP-based rate limit (max 20 attempts per hour)
  SELECT COUNT(*) INTO recent_attempts
  FROM download_attempts
  WHERE ip_address = ip_addr
    AND attempted_at > now() - interval '1 hour';
  
  IF recent_attempts >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Too many download attempts from this IP address.';
  END IF;
  
  -- Check token-based rate limit (max 10 failed attempts per hour)
  SELECT COUNT(*) INTO recent_failures
  FROM download_attempts
  WHERE token = link_token
    AND success = false
    AND attempted_at > now() - interval '1 hour';
  
  IF recent_failures >= 10 THEN
    RAISE EXCEPTION 'Too many failed attempts for this link. Please try again later.';
  END IF;
  
  -- Get the share link id
  SELECT id INTO link_id
  FROM share_links
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_downloads IS NULL OR current_downloads < max_downloads);
  
  IF link_id IS NULL THEN
    -- Log failed attempt
    INSERT INTO download_attempts (ip_address, token, success)
    VALUES (ip_addr, link_token, false);
    
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;
  
  -- Log successful attempt
  INSERT INTO download_attempts (ip_address, token, success)
  VALUES (ip_addr, link_token, true);
  
  -- Insert the download log
  INSERT INTO download_logs (share_link_id, user_agent, ip_address)
  VALUES (link_id, user_agent_text, ip_addr)
  RETURNING id INTO log_id;
  
  -- Increment download counter
  UPDATE share_links
  SET current_downloads = current_downloads + 1
  WHERE id = link_id;
  
  RETURN log_id;
END;
$function$;