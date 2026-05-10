import { supabase } from '../libs/supabase';
import { Post } from '../types';

export const buscarTodosPosts = async (): Promise<Post[] | null> => {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('criado_em', { ascending: false });
  return data;
};

export const buscarPostsComImagem = async (): Promise<Post[] | null> => {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .not('imagem_url', 'is', null)
    .order('criado_em', { ascending: false });
  return data;
};

export const buscarPostsDoUsuario = async (userId: string): Promise<Post[] | null> => {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false });
  return data;
};

export const inserirPost = async (dados: {
  usuario_id: string;
  nome_usuario: string;
  username: string;
  avatar_url: string | null;
  conteudo: string | null;
  imagem_url: string | null;
}): Promise<{ data: Post | null; error: unknown }> => {
  const { data, error } = await supabase
    .from('posts')
    .insert([dados])
    .select()
    .single();
  return { data, error };
};

export const deletarPost = async (postId: string): Promise<{ error: unknown }> => {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  return { error };
};

export const atualizarNomeNoPosts = async (userId: string, nomeUsuario: string): Promise<void> => {
  await supabase.from('posts').update({ nome_usuario: nomeUsuario }).eq('usuario_id', userId);
};
