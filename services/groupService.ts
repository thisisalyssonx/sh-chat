import { supabase } from '../libs/supabase';
import { Grupo } from '../types';

export const buscarGrupos = async (): Promise<Grupo[] | null> => {
  const { data } = await supabase.from('grupos').select('*').order('criado_em', { ascending: false });
  return data;
};

export const inserirGrupo = async (dados: {
  nome: string;
  senha: string | null;
  is_publico: boolean;
  criado_por: string;
}): Promise<{ error: unknown }> => {
  const { error } = await supabase.from('grupos').insert([dados]);
  return { error };
};

export const deletarGrupo = async (grupoId: string): Promise<void> => {
  await supabase.from('grupos').delete().eq('id', grupoId);
};
