export interface Perfil {
  id: string;
  nome: string;
  username: string;
  bio?: string;
  avatar_url?: string | null;
  criado_em?: string;
}

export interface UsuarioOnline {
  id: string;
  nome: string;
  username?: string;
  avatar_url?: string | null;
}
