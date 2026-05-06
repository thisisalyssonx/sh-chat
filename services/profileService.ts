import { supabase } from '../libs/supabase';
import { Perfil } from '../types';

export const buscarPerfil = async (userId: string): Promise<Perfil | null> => {
  const { data } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .single();
  return data ?? null;
};

export const criarPerfil = async (dados: {
  id: string;
  username: string;
  nome: string;
  bio: string;
  avatar_url: string | null;
}): Promise<void> => {
  await supabase.from('perfis').upsert(dados);
};

export const atualizarNomeBio = async (
  userId: string,
  nome: string,
  bio: string,
): Promise<{ error: unknown }> => {
  const { error } = await supabase
    .from('perfis')
    .update({ nome, bio })
    .eq('id', userId);
  return { error };
};
