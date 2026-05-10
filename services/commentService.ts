import { supabase } from '../libs/supabase';
import { Comentario } from '../types';

export const buscarComentariosDoPost = async (postId: string): Promise<Comentario[] | null> => {
  const { data } = await supabase
    .from('comentarios')
    .select('*')
    .eq('post_id', postId)
    .order('criado_em', { ascending: true });
  return data;
};

export const buscarContagemTodosComentarios = async (): Promise<{ post_id: string }[] | null> => {
  const { data } = await supabase.from('comentarios').select('post_id');
  return data;
};

export const inserirComentario = async (dados: {
  post_id: string;
  usuario_id: string;
  nome_usuario: string;
  username: string;
  avatar_url: string | null;
  conteudo: string;
}): Promise<{ error: unknown }> => {
  const { error } = await supabase.from('comentarios').insert([dados]);
  return { error };
};

export const atualizarNomeNosComentarios = async (userId: string, nomeUsuario: string): Promise<void> => {
  await supabase.from('comentarios').update({ nome_usuario: nomeUsuario }).eq('usuario_id', userId);
};
