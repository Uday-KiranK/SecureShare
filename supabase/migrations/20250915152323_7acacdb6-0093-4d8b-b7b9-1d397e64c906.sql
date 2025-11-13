-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create files table for file metadata
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Create share_links table for managing file sharing
CREATE TABLE public.share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_downloads INTEGER,
  current_downloads INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on share_links
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Create download_logs table for analytics
CREATE TABLE public.download_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_link_id UUID NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on download_logs
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('secure-files', 'secure-files', false);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for files
CREATE POLICY "Users can view their own files" ON public.files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own files" ON public.files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files" ON public.files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON public.files
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for share_links
CREATE POLICY "Users can view share links for their files" ON public.share_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.files 
      WHERE files.id = share_links.file_id 
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create share links for their files" ON public.share_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files 
      WHERE files.id = share_links.file_id 
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update share links for their files" ON public.share_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.files 
      WHERE files.id = share_links.file_id 
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete share links for their files" ON public.share_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.files 
      WHERE files.id = share_links.file_id 
      AND files.user_id = auth.uid()
    )
  );

-- Public access for valid share links (for downloading)
CREATE POLICY "Public can view active share links" ON public.share_links
  FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_downloads IS NULL OR current_downloads < max_downloads)
  );

-- RLS Policies for download_logs
CREATE POLICY "Users can view download logs for their files" ON public.download_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.share_links sl
      JOIN public.files f ON f.id = sl.file_id
      WHERE sl.id = download_logs.share_link_id
      AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can create download logs" ON public.download_logs
  FOR INSERT WITH CHECK (true);

-- Storage policies for secure-files bucket
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'secure-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'secure-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'secure-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'secure-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_share_links_updated_at
  BEFORE UPDATE ON public.share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();