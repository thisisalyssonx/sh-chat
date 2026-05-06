import { supabase } from '../libs/supabase';

export const buscarCurtidasDoUsuario = async (
  userId: string,
): Promise<{ post_id: string }[] | null> => {
  const { data } = await supabase
    .from('curtidas')
    .select('post_id')
    .eq('usuario_id', userId);
  return data;
};

export const buscarTodasCurtidas = async (): Promise<{ post_id: string }[] | null> => {
  const { data } = await supabase.from('curtidas').select('post_id');
  return data;
};

export const curtir = async (postId: string, userId: string): Promise<void> => {
  await supabase.from('curtidas').insert([{ post_id: postId, usuario_id: userId }]);
};

export const descurtir = async (postId: string, userId: string): Promise<void> => {
  await supabase
    .from('curtidas')
    .delete()
    .eq('post_id', postId)
    .eq('usuario_id', userId);
};
