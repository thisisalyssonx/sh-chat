export interface Mensagem {
  id: string;
  texto?: string | null;
  imagem_url?: string | null;
  usuario_id: string;
  nome_usuario: string;
  receptor_id?: string | null;
  grupo_id?: string | null;
  criado_em: string;
}

// Formato usado pelo GiftedChat (após transformação via formatarMensagemSupabase)
export interface MensagemFormatada {
  _id: string;
  text?: string;
  image?: string;
  createdAt: Date;
  user: {
    _id: string;
    name: string;
    avatar?: string | null;
  };
}

export interface Grupo {
  id: string;
  nome: string;
  senha?: string | null;
  is_publico: boolean;
  criado_por: string;
  criado_em: string;
}

// Tipo derivado: perfil do outro participante + timestamp da última mensagem
export interface ConversaPrivada {
  id: string;
  nome: string;
  username: string;
  avatar_url?: string | null;
  ultima: string;
}
