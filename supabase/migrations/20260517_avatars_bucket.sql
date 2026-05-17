-- Bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Usuário faz upload apenas na própria pasta (user_id/)
CREATE POLICY "upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Usuário sobrescreve própria foto
CREATE POLICY "update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Leitura pública (fotos são públicas)
CREATE POLICY "public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id='avatars');
