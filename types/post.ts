export interface Post {
  id: string;
  usuario_id: string;
  nome_usuario: string;
  username: string;
  avatar_url?: string | null;
  conteudo?: string | null;
  imagem_url?: string | null;
  criado_em: string;
  // Campo virtual calculado no cliente a partir da tabela curtidas
  _contagem_curtidas?: number;
}

export interface Curtida {
  post_id: string;
  usuario_id: string;
}

export interface Comentario {
  id: string;
  post_id: string;
  usuario_id: string;
  nome_usuario: string;
  username: string;
  avatar_url?: string | null;
  conteudo: string;
  criado_em: string;
}
