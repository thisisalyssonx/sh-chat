import { supabase } from '../libs/supabase';
import { Mensagem } from '../types';

export const buscarMensagensDaConversa = async (
  myId: string,
  grupoId?: string | string[] | null,
  receptorId?: string | string[] | null,
): Promise<Mensagem[] | null> => {
  let query = supabase.from('mensagens').select('*');
  if (grupoId) query = query.eq('grupo_id', grupoId);
  else if (receptorId) query = query.or(`and(usuario_id.eq.${myId},receptor_id.eq.${receptorId}),and(usuario_id.eq.${receptorId},receptor_id.eq.${myId})`);
  else query = query.is('receptor_id', null).is('grupo_id', null);
  const { data } = await query.order('criado_em', { ascending: false });
  return data;
};

export const inserirMensagem = async (dados: {
  texto: string;
  imagem_url?: string | null;
  usuario_id: string;
  nome_usuario: string;
  receptor_id: string | string[] | null;
  grupo_id: string | string[] | null;
}): Promise<void> => {
  await supabase.from('mensagens').insert([dados]);
};

export const deletarMensagem = async (mensagemId: string): Promise<void> => {
  await supabase.from('mensagens').delete().eq('id', mensagemId);
};

export const buscarUltimasMensagensPrivadas = async (
  meuId: string,
): Promise<{ usuario_id: string; receptor_id: string; criado_em: string }[] | null> => {
  const { data } = await supabase
    .from('mensagens')
    .select('usuario_id, receptor_id, criado_em')
    .is('grupo_id', null)
    .or(`usuario_id.eq.${meuId},receptor_id.eq.${meuId}`)
    .order('criado_em', { ascending: false });
  return data;
};

export const atualizarNomeNasMensagens = async (userId: string, nomeUsuario: string): Promise<void> => {
  await supabase.from('mensagens').update({ nome_usuario: nomeUsuario }).eq('usuario_id', userId);
};
