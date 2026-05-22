-- Add audio_url column to program_modules
ALTER TABLE public.program_modules
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Create public bucket for course materials and audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "course-materials public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-materials');

-- Admin or teacher can upload to their folder (userId is first path segment)
CREATE POLICY "course-materials authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'docente'))
);

CREATE POLICY "course-materials authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "course-materials authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
