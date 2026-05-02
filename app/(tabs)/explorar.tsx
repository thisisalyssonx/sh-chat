import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  ScrollView, TextInput, StatusBar, Image, Modal, Pressable,
  Dimensions,
} from 'react-native';
import { supabase } from '../../supabase';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import PostCard from '../../components/PostCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = Math.floor(SCREEN_WIDTH / 3) - 1;

export default function ExplorarScreen() {
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [perfilAtual, setPerfilAtual] = useState(null);
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [todosPosts, setTodosPosts] = useState([]);
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({});
  const [contagemCurtidas, setContagemCurtidas] = useState<Record<string, number>>({});
  const [contagemComentarios, setContagemComentarios] = useState<Record<string, number>>({});
  const [postModal, setPostModal] = useState(null);
  const [usuariosOnline, setUsuariosOnline] = useState<string[]>([]);

  useEffect(() => {
    let canalPresence;

    const iniciar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }

      const userId = session.user.id;
      const meta = session.user.user_metadata;
      setUsuarioAtual({ id: userId, ...meta });

      const { data: perfil } = await supabase.from('perfis').select('*').eq('id', userId).single();
      setPerfilAtual(perfil);

      await buscarTudos(userId);

      canalPresence = supabase.channel('explorar-presence');
      canalPresence
        .on('presence', { event: 'sync' }, () => {
          const estado = canalPresence.presenceState();
          const ids: string[] = [];
          for (const chave in estado) {
            if (estado[chave].length > 0) ids.push(estado[chave][0].id);
          }
          setUsuariosOnline(ids.filter(id => id !== userId));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await canalPresence.track({ id: userId, nome: perfil?.nome || meta.nome_normal });
          }
        });
    };

    iniciar();
    return () => { if (canalPresence) supabase.removeChannel(canalPresence); };
  }, []);

  const buscarTudos = async (myId: string) => {
    // Posts de todos exceto o próprio usuário (ou todos)
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .order('criado_em', { ascending: false });
    if (postsData) setTodosPosts(postsData);

    // Todos os perfis (exceto o próprio)
    const { data: perfisData } = await supabase
      .from('perfis')
      .select('*')
      .neq('id', myId)
      .order('criado_em', { ascending: false });
    if (perfisData) setUsuarios(perfisData);

    // Curtidas do usuário
    const { data: curtidasData } = await supabase.from('curtidas').select('post_id').eq('usuario_id', myId);
    if (curtidasData) {
      const mapa: Record<string, boolean> = {};
      curtidasData.forEach(c => { mapa[c.post_id] = true; });
      setCurtidas(mapa);
    }

    // Contagem de curtidas
    const { data: todasCurtidas } = await supabase.from('curtidas').select('post_id');
    if (todasCurtidas) {
      const contagem: Record<string, number> = {};
      todasCurtidas.forEach(c => { contagem[c.post_id] = (contagem[c.post_id] || 0) + 1; });
      setContagemCurtidas(contagem);
    }

    // Contagem de comentários
    const { data: todosComentarios } = await supabase.from('comentarios').select('post_id');
    if (todosComentarios) {
      const contagem: Record<string, number> = {};
      todosComentarios.forEach(c => { contagem[c.post_id] = (contagem[c.post_id] || 0) + 1; });
      setContagemComentarios(contagem);
    }
  };

  const toggleCurtida = async (postId: string) => {
    if (!usuarioAtual) return;
    const jaCurtiu = curtidas[postId];
    if (jaCurtiu) {
      await supabase.from('curtidas').delete().eq('post_id', postId).eq('usuario_id', usuarioAtual.id);
      setCurtidas(prev => ({ ...prev, [postId]: false }));
      setContagemCurtidas(prev => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }));
    } else {
      await supabase.from('curtidas').insert([{ post_id: postId, usuario_id: usuarioAtual.id }]);
      setCurtidas(prev => ({ ...prev, [postId]: true }));
      setContagemCurtidas(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
    // Atualiza no postModal se estiver aberto
    if (postModal && postModal.id === postId) {
      setPostModal(prev => ({ ...prev, _contagem_curtidas: jaCurtiu ? Math.max((prev._contagem_curtidas || 1) - 1, 0) : (prev._contagem_curtidas || 0) + 1 }));
    }
  };

  const formatarTempo = (dataStr: string) => {
    const agora = new Date();
    const data = new Date(dataStr);
    const diff = Math.floor((agora.getTime() - data.getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const iniciarDM = (usuario) => {
    router.push({ pathname: '/conversa', params: { receptorId: usuario.id, nomeReceptor: usuario.nome || usuario.username } });
  };

  const buscando = busca.trim().length > 0;
  const usuariosFiltrados = usuarios.filter(u => {
    const termo = busca.toLowerCase();
    return u.nome?.toLowerCase().includes(termo) || u.username?.toLowerCase().includes(termo);
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#555" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar pessoas..."
            placeholderTextColor="#444"
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
          />
          {buscando && (
            <TouchableOpacity onPress={() => setBusca('')}>
              <MaterialIcons name="close" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {buscando ? (
        /* ===== BUSCA: lista de usuários ===== */
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {usuariosFiltrados.length === 0 ? (
            <View style={styles.vazio}>
              <MaterialIcons name="person-search" size={48} color="#222" />
              <Text style={styles.vazioTxt}>Nenhum usuário encontrado</Text>
            </View>
          ) : (
            <>
              <Text style={styles.secaoLabel}>PESSOAS — {usuariosFiltrados.length}</Text>
              {usuariosFiltrados.map(usuario => {
                const estaOnline = usuariosOnline.includes(usuario.id);
                const inicial = (usuario.nome || usuario.username || 'U').charAt(0).toUpperCase();
                return (
                  <View key={usuario.id} style={styles.usuarioCard}>
                    <View style={styles.usuarioAvatarWrap}>
                      {usuario.avatar_url ? (
                        <Image source={{ uri: usuario.avatar_url }} style={styles.usuarioAvatarImg} />
                      ) : (
                        <View style={styles.usuarioAvatarFallback}>
                          <Text style={styles.usuarioAvatarLetra}>{inicial}</Text>
                        </View>
                      )}
                      {estaOnline && <View style={styles.onlineDot} />}
                    </View>
                    <View style={styles.usuarioInfo}>
                      <Text style={styles.usuarioUsername}>{usuario.username}</Text>
                      <Text style={styles.usuarioNome}>{usuario.nome}</Text>
                      {!!usuario.bio && <Text style={styles.usuarioBio} numberOfLines={1}>{usuario.bio}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => iniciarDM(usuario)} style={styles.btnDM}>
                      <MaterialIcons name="chat-bubble-outline" size={16} color="#F05DCC" />
                      <Text style={styles.btnDMTxt}>DM</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : (
        /* ===== GRID DE POSTS (estilo Instagram) ===== */
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {todosPosts.length === 0 ? (
            <View style={styles.vazio}>
              <MaterialIcons name="grid-off" size={48} color="#222" />
              <Text style={styles.vazioTxt}>Nenhum post ainda</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {todosPosts.map(post => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.gridItem}
                  onPress={() => setPostModal({ ...post, _contagem_curtidas: contagemCurtidas[post.id] || 0 })}
                  activeOpacity={0.85}
                >
                  {post.imagem_url ? (
                    <Image source={{ uri: post.imagem_url }} style={styles.gridImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.gridTextCard}>
                      <Text style={styles.gridTextContent} numberOfLines={5}>{post.conteudo}</Text>
                      <View style={styles.gridTextFooter}>
                        <Text style={styles.gridTextUsername}>@{post.username}</Text>
                      </View>
                    </View>
                  )}
                  {/* Overlay com ícone de curtidas */}
                  {(contagemCurtidas[post.id] || 0) > 0 && (
                    <View style={styles.gridOverlay}>
                      <MaterialIcons name="favorite" size={14} color="#FFF" />
                      <Text style={styles.gridOverlayTxt}>{contagemCurtidas[post.id]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* MODAL DO POST (ao clicar no grid) */}
      <Modal visible={!!postModal} animationType="slide" transparent onRequestClose={() => setPostModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPostModal(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {postModal && (
                <PostCard
                  post={postModal}
                  usuarioAtual={usuarioAtual}
                  curtido={!!curtidas[postModal.id]}
                  onLike={() => toggleCurtida(postModal.id)}
                  onComentarios={() => {}}
                  onDeletar={null}
                  formatarTempo={formatarTempo}
                  contagemComentarios={contagemComentarios[postModal.id] || 0}
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  header: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#0D1117' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderWidth: 1, borderColor: '#1a1a2e',
  },
  searchInput: { flex: 1, color: '#E6EDF3', fontSize: 15 },
  scroll: { flex: 1 },

  // GRID
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    backgroundColor: '#0D1117',
    position: 'relative',
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { width: '100%', height: '100%', padding: 8, justifyContent: 'space-between', backgroundColor: '#0D1117' },
  gridTextContent: { color: '#C9D1D9', fontSize: 11, lineHeight: 16, flex: 1 },
  gridTextFooter: {},
  gridTextUsername: { color: '#F05DCC', fontSize: 9, fontWeight: '700' },
  gridOverlay: {
    position: 'absolute', bottom: 4, left: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
  },
  gridOverlayTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // BUSCA — USUÁRIOS
  secaoLabel: { fontSize: 10, fontWeight: '700', color: '#555', letterSpacing: 2, marginHorizontal: 16, marginVertical: 12 },
  usuarioCard: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: '#0D1117', gap: 12,
  },
  usuarioAvatarWrap: { position: 'relative' },
  usuarioAvatarImg: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#1a1a2e' },
  usuarioAvatarFallback: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F05DCC22',
  },
  usuarioAvatarLetra: { fontSize: 20, fontWeight: 'bold', color: '#F05DCC' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#2FDAD3', borderWidth: 2, borderColor: '#010409' },
  usuarioInfo: { flex: 1 },
  usuarioUsername: { color: '#E6EDF3', fontWeight: '700', fontSize: 15 },
  usuarioNome: { color: '#555', fontSize: 13, marginTop: 1 },
  usuarioBio: { color: '#8B949E', fontSize: 12, marginTop: 3 },
  btnDM: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#F05DCC', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  btnDMTxt: { color: '#F05DCC', fontWeight: '700', fontSize: 12 },

  // VAZIO
  vazio: { alignItems: 'center', paddingTop: 80, gap: 14 },
  vazioTxt: { color: '#333', fontSize: 15 },

  // MODAL DO POST
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#010409', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingTop: 8 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
});
