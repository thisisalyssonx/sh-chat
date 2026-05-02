-- ============================================================
-- THE SH — SQL DE CORREÇÃO (execute se o setup completo deu erro)
-- ============================================================

-- Garante que as colunas novas existam em posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS nome_usuario TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Garante que conteudo seja nullable (para posts só com foto)
ALTER TABLE posts ALTER COLUMN conteudo DROP NOT NULL;

-- Garante colunas em comentarios
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS username TEXT;

-- Habilitar RLS (idempotente)
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

-- Policies de PERFIS
DROP POLICY IF EXISTS "Todos podem ver perfis" ON perfis;
DROP POLICY IF EXISTS "Dono insere perfil" ON perfis;
DROP POLICY IF EXISTS "Dono atualiza perfil" ON perfis;
CREATE POLICY "Todos podem ver perfis" ON perfis FOR SELECT USING (TRUE);
CREATE POLICY "Dono insere perfil" ON perfis FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Dono atualiza perfil" ON perfis FOR UPDATE USING (auth.uid() = id);

-- Policies de POSTS
DROP POLICY IF EXISTS "Todos podem ver posts" ON posts;
DROP POLICY IF EXISTS "Autenticados publicam" ON posts;
DROP POLICY IF EXISTS "Dono deleta post" ON posts;
CREATE POLICY "Todos podem ver posts" ON posts FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados publicam" ON posts FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Dono deleta post" ON posts FOR DELETE USING (auth.uid() = usuario_id);

-- Policies de CURTIDAS
DROP POLICY IF EXISTS "Todos veem curtidas" ON curtidas;
DROP POLICY IF EXISTS "Autenticados curtem" ON curtidas;
DROP POLICY IF EXISTS "Dono descurte" ON curtidas;
CREATE POLICY "Todos veem curtidas" ON curtidas FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados curtem" ON curtidas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Dono descurte" ON curtidas FOR DELETE USING (auth.uid() = usuario_id);

-- Policies de COMENTÁRIOS
DROP POLICY IF EXISTS "Todos veem comentários" ON comentarios;
DROP POLICY IF EXISTS "Autenticados comentam" ON comentarios;
CREATE POLICY "Todos veem comentários" ON comentarios FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados comentam" ON comentarios FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Trigger para criar perfil ao registrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis (id, username, nome)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nome_usuario',
    NEW.raw_user_meta_data->>'nome_normal'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Storage policies (só se os buckets já foram criados)
DROP POLICY IF EXISTS "Avatar upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Avatares públicos" ON storage.objects;
DROP POLICY IF EXISTS "Dono atualiza avatar" ON storage.objects;
CREATE POLICY "Avatar upload autenticado" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Avatares públicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Dono atualiza avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Post image upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Post images públicas" ON storage.objects;
CREATE POLICY "Post image upload autenticado" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');
CREATE POLICY "Post images públicas" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');
