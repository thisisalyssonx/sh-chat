-- ============================================================
-- THE SH — SQL PARA O SUPABASE (executar no SQL Editor)
-- ============================================================

-- 1. TABELA: perfis
CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  nome TEXT,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA: posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_usuario TEXT,
  username TEXT,
  avatar_url TEXT,
  conteudo TEXT NOT NULL,
  imagem_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: curtidas
CREATE TABLE IF NOT EXISTS curtidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, usuario_id)
);

-- 4. TABELA: comentarios
CREATE TABLE IF NOT EXISTS comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_usuario TEXT,
  username TEXT,
  avatar_url TEXT,
  conteudo TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

-- PERFIS
DROP POLICY IF EXISTS "Todos podem ver perfis" ON perfis;
DROP POLICY IF EXISTS "Dono insere perfil" ON perfis;
DROP POLICY IF EXISTS "Dono atualiza perfil" ON perfis;
CREATE POLICY "Todos podem ver perfis" ON perfis FOR SELECT USING (TRUE);
CREATE POLICY "Dono insere perfil" ON perfis FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Dono atualiza perfil" ON perfis FOR UPDATE USING (auth.uid() = id);

-- POSTS
DROP POLICY IF EXISTS "Todos podem ver posts" ON posts;
DROP POLICY IF EXISTS "Autenticados publicam" ON posts;
DROP POLICY IF EXISTS "Dono deleta post" ON posts;
CREATE POLICY "Todos podem ver posts" ON posts FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados publicam" ON posts FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Dono deleta post" ON posts FOR DELETE USING (auth.uid() = usuario_id);

-- CURTIDAS
DROP POLICY IF EXISTS "Todos veem curtidas" ON curtidas;
DROP POLICY IF EXISTS "Autenticados curtem" ON curtidas;
DROP POLICY IF EXISTS "Dono descurte" ON curtidas;
CREATE POLICY "Todos veem curtidas" ON curtidas FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados curtem" ON curtidas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Dono descurte" ON curtidas FOR DELETE USING (auth.uid() = usuario_id);

-- COMENTÁRIOS
DROP POLICY IF EXISTS "Todos veem comentários" ON comentarios;
DROP POLICY IF EXISTS "Autenticados comentam" ON comentarios;
CREATE POLICY "Todos veem comentários" ON comentarios FOR SELECT USING (TRUE);
CREATE POLICY "Autenticados comentam" ON comentarios FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- ============================================================
-- TRIGGER: Criar perfil automaticamente ao registrar
-- ============================================================

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

-- ============================================================
-- STORAGE BUCKETS (criar manualmente no painel ou via SQL)
-- ============================================================
-- No painel do Supabase > Storage > Create Bucket:
--   Nome: avatars     | Public: SIM
--   Nome: post-images | Public: SIM

-- Ou via SQL (requer extensão storage):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', TRUE) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', TRUE) ON CONFLICT DO NOTHING;

-- Policy para upload de avatares
DROP POLICY IF EXISTS "Avatar upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Avatares públicos" ON storage.objects;
DROP POLICY IF EXISTS "Dono atualiza avatar" ON storage.objects;
CREATE POLICY "Avatar upload autenticado" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Avatares públicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Dono atualiza avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy para imagens de posts
DROP POLICY IF EXISTS "Post image upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Post images públicas" ON storage.objects;
CREATE POLICY "Post image upload autenticado" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');
CREATE POLICY "Post images públicas" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');
