
INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Course images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-images');

CREATE POLICY "Admins upload course images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update course images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete course images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));
