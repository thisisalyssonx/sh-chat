import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { supabase } from '../../supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function ChatScreen() {
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [perfilAtual, setPerfilAtual] = useState(null);
  const [usuariosOnline, setUsuariosOnline] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [conversasPrivadas, setConversasPrivadas] = useState([]);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState({ grupos: {}, privados: {} });

  const [modalCriarVisivel, setModalCriarVisivel] = useState(false);
  const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
  const [modalDeletarVisivel, setModalDeletarVisivel] = useState(false);

  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [novoGrupoSenha, setNovoGrupoSenha] = useState('');
  const [isPrivado, setIsPrivado] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [senhaDigitada, setSenhaDigitada] = useState('');

  useEffect(() => {
    let canalPresence;
    let canalAlertas;

    const iniciar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }

      const userId = session.user.id;
      const meta = session.user.user_metadata;
      setUsuarioAtual({ id: userId, ...meta });

      const { data: perfil } = await supabase.from('perfis').select('*').eq('id', userId).single();
      setPerfilAtual(perfil);

      // Presença online
      canalPresence = supabase.channel('chat-presence');
      canalPresence
        .on('presence', { event: 'sync' }, () => {
          const estado = canalPresence.presenceState();
          const lista = [];
          for (const chave in estado) {
            if (estado[chave].length > 0) lista.push(estado[chave][0]);
          }
          setUsuariosOnline(lista.filter(u => u.id !== userId));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await canalPresence.track({
              id: userId,
              nome: perfil?.nome || meta.nome_normal || 'Usuário',
              username: perfil?.username || meta.nome_usuario,
              avatar_url: perfil?.avatar_url || null,
            });
          }
        });

      // Notificações de novas mensagens
      canalAlertas = supabase.channel('chat-alertas')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
          const msg = payload.new;
          if (msg.usuario_id === userId) return;
          setMensagensNaoLidas(prev => {
            const novo = { ...prev };
            if (msg.grupo_id) novo.grupos = { ...novo.grupos, [msg.grupo_id]: true };
            else if (msg.receptor_id === userId) {
              novo.privados = { ...novo.privados, [msg.usuario_id]: true };
              // Recarregar conversas para colocar no topo ou exibir nova se for o caso
              buscarConversasPrivadas(userId);
            }
            return novo;
          });
        })
        .subscribe();

      buscarGrupos();
      buscarConversasPrivadas(userId);
    };

    iniciar();

    const canalGrupos = supabase.channel('chat-grupos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'grupos' }, (p) => {
        setGrupos(prev => [p.new, ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'grupos' }, (p) => {
        setGrupos(prev => prev.filter(g => g.id !== p.old.id));
      })
      .subscribe();

    return () => {
      if (canalPresence) supabase.removeChannel(canalPresence);
      if (canalAlertas) supabase.removeChannel(canalAlertas);
      supabase.removeChannel(canalGrupos);
    };
  }, []);

  const buscarGrupos = async () => {
    const { data } = await supabase.from('grupos').select('*').order('criado_em', { ascending: false });
    if (data) setGrupos(data);
  };

  const buscarConversasPrivadas = async (meuId) => {
    const { data: mensagens } = await supabase
      .from('mensagens')
      .select('usuario_id, receptor_id, criado_em')
      .is('grupo_id', null)
      .or(`usuario_id.eq.${meuId},receptor_id.eq.${meuId}`)
      .order('criado_em', { ascending: false });

    if (mensagens && mensagens.length > 0) {
      const mapConversas = {};
      mensagens.forEach(msg => {
        const outroId = msg.usuario_id === meuId ? msg.receptor_id : msg.usuario_id;
        if (!outroId) return;
        if (!mapConversas[outroId]) {
          mapConversas[outroId] = msg.criado_em;
        }
      });
      const ids = Object.keys(mapConversas);
      if (ids.length > 0) {
        const { data: perfis } = await supabase.from('perfis').select('id, nome, username, avatar_url').in('id', ids);
        if (perfis) {
          const formatados = perfis.map(p => ({
            ...p,
            ultima: mapConversas[p.id]
          })).sort((a, b) => new Date(b.ultima).getTime() - new Date(a.ultima).getTime());
          setConversasPrivadas(formatados);
        }
      }
    }
  };

  const criarGrupo = async () => {
    if (!novoGrupoNome) return;
    if (isPrivado && !novoGrupoSenha) { Alert.alert('Atenção', 'Defina uma senha.'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('grupos').insert([{
      nome: novoGrupoNome,
      senha: isPrivado ? novoGrupoSenha : null,
      is_publico: !isPrivado,
      criado_por: session.user.id,
    }]);
    if (!error) {
      setModalCriarVisivel(false);
      setNovoGrupoNome(''); setNovoGrupoSenha(''); setIsPrivado(false);
    }
  };

  const irParaConversa = (grupo) => {
    setMensagensNaoLidas(prev => ({ ...prev, grupos: { ...prev.grupos, [grupo.id]: false } }));
    router.push({ pathname: '/conversa', params: { grupoId: grupo.id, nomeReceptor: grupo.nome } });
  };

  const abrirChatPrivado = (usuario) => {
    setMensagensNaoLidas(prev => ({ ...prev, privados: { ...prev.privados, [usuario.id]: false } }));
    router.push({ pathname: '/conversa', params: { receptorId: usuario.id, nomeReceptor: usuario.nome } });
  };

  const verificarSenhaEntrar = () => {
    if (senhaDigitada === grupoSelecionado.senha) {
      setModalSenhaVisivel(false); setSenhaDigitada('');
      irParaConversa(grupoSelecionado);
    } else alert('Senha incorreta!');
  };

  const deletarGrupo = async () => {
    if (!grupoSelecionado) return;
    await supabase.from('grupos').delete().eq('id', grupoSelecionado.id);
    setModalDeletarVisivel(false); setGrupoSelecionado(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensagens</Text>
        <Text style={styles.headerSub}>Chats e grupos</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ONLINE AGORA */}
        {usuariosOnline.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoLabel}>ONLINE AGORA — {usuariosOnline.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.onlineScroll}>
              {usuariosOnline.map(u => {
                const inicial = (u.nome || 'U').charAt(0).toUpperCase();
                return (
                  <TouchableOpacity key={u.id} style={styles.onlineItem} onPress={() => abrirChatPrivado(u)}>
                    <View style={styles.onlineBorda}>
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.onlineAvatarImg} />
                      ) : (
                        <View style={styles.onlineAvatarFallback}>
                          <Text style={styles.onlineAvatarLetra}>{inicial}</Text>
                        </View>
                      )}
                      {mensagensNaoLidas.privados[u.id] && (
                        <View style={styles.badge}><MaterialIcons name="notifications-active" size={10} color="#010409" /></View>
                      )}
                    </View>
                    <Text style={styles.onlineNome} numberOfLines={1}>{(u.nome || 'User').split(' ')[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* CHATS PRIVADOS (DMs) */}
        {conversasPrivadas.length > 0 && (
          <View style={styles.secaoGrupos}>
            <Text style={[styles.secaoLabel, { paddingHorizontal: 16, marginBottom: 10 }]}>DMs RECENTES</Text>
            {conversasPrivadas.map(usuario => (
              <View key={usuario.id} style={styles.grupoCard}>
                <TouchableOpacity
                  style={styles.grupoTouchable}
                  onPress={() => abrirChatPrivado(usuario)}
                >
                  <View style={styles.grupoIcone}>
                    {usuario.avatar_url ? (
                      <Image source={{ uri: usuario.avatar_url }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                    ) : (
                      <Text style={{ fontSize: 18, color: '#F05DCC', fontWeight: 'bold' }}>{(usuario.nome || 'U').charAt(0).toUpperCase()}</Text>
                    )}
                    {mensagensNaoLidas.privados[usuario.id] && <View style={styles.badge} />}
                  </View>
                  <View style={styles.grupoInfo}>
                    <Text style={styles.grupoNome}>{usuario.nome}</Text>
                    <Text style={styles.grupoStatus}>@{usuario.username}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#333" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* GRUPOS */}
        <View style={styles.secaoGrupos}>
          <View style={styles.secaoHeaderRow}>
            <Text style={styles.secaoLabel}>SALAS DE CHAT</Text>
            <TouchableOpacity onPress={() => setModalCriarVisivel(true)} style={styles.btnNovoGrupo}>
              <MaterialIcons name="add" size={16} color="#2FDAD3" />
              <Text style={styles.btnNovoTxt}>Nova Sala</Text>
            </TouchableOpacity>
          </View>

          {grupos.length === 0 ? (
            <View style={styles.vazioContainer}>
              <MaterialIcons name="forum" size={40} color="#222" />
              <Text style={styles.vazioTxt}>Nenhuma sala criada ainda</Text>
            </View>
          ) : (
            grupos.map(grupo => (
              <View key={grupo.id} style={styles.grupoCard}>
                <TouchableOpacity
                  style={styles.grupoTouchable}
                  onPress={() => grupo.is_publico ? irParaConversa(grupo) : (() => { setGrupoSelecionado(grupo); setModalSenhaVisivel(true); })()}
                >
                  <View style={styles.grupoIcone}>
                    <MaterialIcons name={grupo.is_publico ? 'forum' : 'lock'} size={20} color="#F05DCC" />
                    {mensagensNaoLidas.grupos[grupo.id] && <View style={styles.badge} />}
                  </View>
                  <View style={styles.grupoInfo}>
                    <Text style={styles.grupoNome}>{grupo.nome}</Text>
                    <Text style={styles.grupoStatus}>{grupo.is_publico ? '🌐 Público' : '🔒 Privado'}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#333" />
                </TouchableOpacity>
                {usuarioAtual && grupo.criado_por === usuarioAtual.id && (
                  <TouchableOpacity style={styles.btnDeletar} onPress={() => { setGrupoSelecionado(grupo); setModalDeletarVisivel(true); }}>
                    <MaterialIcons name="delete-outline" size={18} color="#444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* MODAL CRIAR SALA */}
      <Modal animationType="slide" transparent visible={modalCriarVisivel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Nova Sala de Chat</Text>
            <TextInput style={styles.modalInput} placeholder="Nome da sala" placeholderTextColor="#555" value={novoGrupoNome} onChangeText={setNovoGrupoNome} />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsPrivado(!isPrivado)}>
              <MaterialIcons name={isPrivado ? 'check-box' : 'check-box-outline-blank'} size={22} color={isPrivado ? '#2FDAD3' : '#555'} />
              <Text style={styles.checkboxLabel}>Sala privada (com senha)</Text>
            </TouchableOpacity>
            {isPrivado && (
              <TextInput style={styles.modalInput} placeholder="Senha de acesso" placeholderTextColor="#555" secureTextEntry value={novoGrupoSenha} onChangeText={setNovoGrupoSenha} />
            )}
            <View style={styles.modalBotoes}>
              <TouchableOpacity onPress={() => { setModalCriarVisivel(false); setIsPrivado(false); }} style={styles.btnCancelar}>
                <Text style={{ color: '#F05DCC', fontWeight: '700' }}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={criarGrupo} style={styles.btnConfirmarWrapper}>
                <LinearGradient colors={['#F05DCC', '#2FDAD3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnConfirmar}>
                  <Text style={{ color: '#010409', fontWeight: '900' }}>CRIAR</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL SENHA */}
      <Modal animationType="fade" transparent visible={modalSenhaVisivel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Sala Privada</Text>
            <Text style={styles.modalSub}>Senha para "{grupoSelecionado?.nome}"</Text>
            <TextInput style={styles.modalInput} placeholder="Senha" placeholderTextColor="#555" secureTextEntry autoFocus value={senhaDigitada} onChangeText={setSenhaDigitada} />
            <View style={styles.modalBotoes}>
              <TouchableOpacity onPress={() => setModalSenhaVisivel(false)} style={styles.btnCancelar}>
                <Text style={{ color: '#555', fontWeight: '700' }}>VOLTAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={verificarSenhaEntrar} style={styles.btnConfirmarWrapper}>
                <LinearGradient colors={['#F05DCC', '#2FDAD3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnConfirmar}>
                  <Text style={{ color: '#010409', fontWeight: '900' }}>ENTRAR</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DELETAR */}
      <Modal animationType="fade" transparent visible={modalDeletarVisivel}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderTopWidth: 3, borderTopColor: '#F05DCC' }]}>
            <Text style={styles.modalTitulo}>Apagar Sala?</Text>
            <Text style={styles.modalSub}>Essa ação é permanente e remove todas as mensagens.</Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity onPress={() => setModalDeletarVisivel(false)} style={styles.btnCancelar}>
                <Text style={{ color: '#555', fontWeight: '700' }}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deletarGrupo} style={[styles.btnConfirmarWrapper, { backgroundColor: '#F05DCC', borderRadius: 8, overflow: 'hidden' }]}>
                <View style={[styles.btnConfirmar, { backgroundColor: '#F05DCC' }]}>
                  <Text style={{ color: '#010409', fontWeight: '900' }}>EXCLUIR</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1a1a2e',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#E6EDF3' },
  headerSub: { fontSize: 13, color: '#555', marginTop: 2 },
  scroll: { flex: 1 },
  secao: { paddingHorizontal: 16, paddingTop: 16 },
  secaoLabel: { fontSize: 10, fontWeight: '700', color: '#555', letterSpacing: 2, marginBottom: 12 },
  onlineScroll: { flexDirection: 'row', marginBottom: 8 },
  onlineItem: { alignItems: 'center', marginRight: 16, width: 62 },
  onlineBorda: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2, borderColor: '#F05DCC',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  onlineAvatarImg: { width: 50, height: 50, borderRadius: 25 },
  onlineAvatarFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  onlineAvatarLetra: { fontSize: 20, fontWeight: 'bold', color: '#F05DCC' },
  onlineNome: { fontSize: 10, marginTop: 6, fontWeight: '700', color: '#2FDAD3' },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#2FDAD3', borderRadius: 10,
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#010409', zIndex: 10,
  },
  secaoGrupos: { marginTop: 20 },
  secaoHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  btnNovoGrupo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0D1117', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#1a1a2e',
  },
  btnNovoTxt: { color: '#2FDAD3', fontWeight: '700', fontSize: 12 },
  grupoCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, backgroundColor: '#0D1117',
    borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a2e',
  },
  grupoTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  grupoIcone: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#010409', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#1a1a2e', position: 'relative',
  },
  grupoInfo: { flex: 1 },
  grupoNome: { color: '#E6EDF3', fontWeight: '700', fontSize: 15 },
  grupoStatus: { color: '#555', fontSize: 12, marginTop: 2 },
  btnDeletar: { padding: 12 },
  vazioContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  vazioTxt: { color: '#333', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', backgroundColor: '#0D1117', borderRadius: 14, padding: 24, borderWidth: 1, borderColor: '#1a1a2e' },
  modalTitulo: { fontSize: 20, fontWeight: '800', color: '#E6EDF3', marginBottom: 16, textAlign: 'center' },
  modalSub: { color: '#8B949E', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#010409', borderRadius: 8, padding: 14,
    color: '#C9D1D9', marginBottom: 14, borderWidth: 1, borderColor: '#1a1a2e', fontSize: 15,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  checkboxLabel: { color: '#C9D1D9', fontSize: 14 },
  modalBotoes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  btnCancelar: { padding: 10 },
  btnConfirmarWrapper: { borderRadius: 8, overflow: 'hidden' },
  btnConfirmar: { paddingVertical: 12, paddingHorizontal: 24 },
});