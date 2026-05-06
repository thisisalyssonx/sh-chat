import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../../libs/supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PostCard from '../../components/PostCard';
import { formatarTempo } from '../../utils/formatTime';
import {
  buscarTodosPosts,
  inserirPost,
  deletarPost as deletarPostDB,
} from '../../services/postService';
import {
  buscarCurtidasDoUsuario,
  buscarTodasCurtidas,
  curtir,
  descurtir,
} from '../../services/likeService';
import {
  buscarComentariosDoPost,
  buscarContagemTodosComentarios,
  inserirComentario,
} from '../../services/commentService';
import { uploadImagemPost } from '../../services/storageService';

export default function FeedScreen() {
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [perfilAtual, setPerfilAtual] = useState(null);
  const [posts, setPosts] = useState([]);
  const [conteudoPost, setConteudoPost] = useState('');
  const [imagemPost, setImagemPost] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [curtidas, setCurtidas] = useState({});
  const [contagemComentarios, setContagemComentarios] = useState<Record<string, number>>({});

  // Estado para comentários
  const [modalComentarios, setModalComentarios] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  useEffect(() => {
    let canalPosts;
    let canalCurtidas;

    const iniciar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }

      const userId = session.user.id;
      const meta = session.user.user_metadata;
      setUsuarioAtual({ id: userId, ...meta });

      // Buscar perfil completo
      const { data: perfil } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();
      setPerfilAtual(perfil);

      await buscarPosts(userId);
      await buscarCurtidasUsuario(userId);

      // Realtime — novos posts
      canalPosts = supabase.channel('feed-posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
          setPosts(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
          setPosts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
        })
        .subscribe();

      // Realtime — curtidas
      canalCurtidas = supabase.channel('feed-curtidas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'curtidas' }, () => {
          buscarContagemCurtidas();
        })
        .subscribe();
    };

    iniciar();
    return () => {
      if (canalPosts) supabase.removeChannel(canalPosts);
      if (canalCurtidas) supabase.removeChannel(canalCurtidas);
    };
  }, []);

  const buscarPosts = async (userId?: string) => {
    const data = await buscarTodosPosts();
    if (data) setPosts(data);
    await buscarContagemCurtidas();
    await buscarContagemComentarios();
  };

  const buscarContagemComentarios = async () => {
    const data = await buscarContagemTodosComentarios();
    if (data) {
      const contagem: Record<string, number> = {};
      data.forEach(c => { contagem[c.post_id] = (contagem[c.post_id] || 0) + 1; });
      setContagemComentarios(contagem);
    }
  };

  const buscarCurtidasUsuario = async (userId: string) => {
    const data = await buscarCurtidasDoUsuario(userId);
    if (data) {
      const mapa = {};
      data.forEach(c => { mapa[c.post_id] = true; });
      setCurtidas(mapa);
    }
  };

  const buscarContagemCurtidas = async () => {
    const data = await buscarTodasCurtidas();
    if (data) {
      const contagem = {};
      data.forEach(c => {
        contagem[c.post_id] = (contagem[c.post_id] || 0) + 1;
      });
      setPosts(prev => prev.map(p => ({ ...p, _contagem_curtidas: contagem[p.id] || 0 })));
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await buscarPosts(usuarioAtual?.id);
    if (usuarioAtual?.id) await buscarCurtidasUsuario(usuarioAtual.id);
    setRefreshing(false);
  }, [usuarioAtual]);

  const escolherImagemPost = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setImagemPost(result.assets[0]);
    }
  };

  const publicarPost = async () => {
    if (!conteudoPost.trim() && !imagemPost) {
      Alert.alert('Atenção', 'Escreva algo ou escolha uma imagem para publicar!');
      return;
    }
    setEnviando(true);

    let imagemUrl = null;

    if (imagemPost?.base64) {
      try {
        const { publicUrl, error: uploadErr } = await uploadImagemPost(imagemPost.base64, usuarioAtual.id);
        if (uploadErr) {
          console.error('Erro upload Storage:', uploadErr);
          Alert.alert('Erro no upload da foto', uploadErr.message);
          setEnviando(false);
          return;
        }
        if (publicUrl) {
          imagemUrl = publicUrl;
        }
      } catch (e) {
        console.error('Erro upload imagem post:', e);
        Alert.alert('Erro', 'Falha ao processar a imagem.');
        setEnviando(false);
        return;
      }
    }

    // conteudo pode ser vazio em posts só com foto
    const conteudoFinal = conteudoPost.trim() || null;

    // Usar .select() para receber o post inserido de volta e adicionar ao feed imediatamente
    const { data: novoPost, error } = await inserirPost({
      usuario_id: usuarioAtual.id,
      nome_usuario: perfilAtual?.nome || usuarioAtual?.nome_normal || 'Usuário',
      username: perfilAtual?.username || usuarioAtual?.nome_usuario || 'user',
      avatar_url: perfilAtual?.avatar_url || null,
      conteudo: conteudoFinal,
      imagem_url: imagemUrl,
    });

    if (!error && novoPost) {
      // Adiciona o post no topo IMEDIATAMENTE sem esperar o Realtime
      setPosts(prev => {
        if (prev.some(p => p.id === novoPost.id)) return prev;
        return [{ ...novoPost, _contagem_curtidas: 0 }, ...prev];
      });
      setConteudoPost('');
      setImagemPost(null);
    } else if (error) {
      console.error('Erro ao publicar post:', error);
      Alert.alert('Erro ao publicar', error.message || 'Tente novamente.');
    }
    setEnviando(false);
  };

  const toggleCurtida = async (postId: string) => {
    if (!usuarioAtual) return;
    const jaCurtiu = curtidas[postId];

    if (jaCurtiu) {
      await descurtir(postId, usuarioAtual.id);
      setCurtidas(prev => ({ ...prev, [postId]: false }));
    } else {
      await curtir(postId, usuarioAtual.id);
      setCurtidas(prev => ({ ...prev, [postId]: true }));
    }
    await buscarContagemCurtidas();
  };

  const deletarPost = async (postId: string) => {
    const { error } = await deletarPostDB(postId);
    if (!error) {
      // Remove imediatamente do estado local
      setPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      Alert.alert('Erro', 'Não foi possível apagar o post.');
    }
  };

  const abrirComentarios = async (post) => {
    setPostSelecionado(post);
    setModalComentarios(true);
    const data = await buscarComentariosDoPost(post.id);
    setComentarios(data || []);
  };

  const enviarComentario = async () => {
    if (!novoComentario.trim()) return;
    setEnviandoComentario(true);
    const { error } = await inserirComentario({
      post_id: postSelecionado.id,
      usuario_id: usuarioAtual.id,
      nome_usuario: perfilAtual?.nome || usuarioAtual.nome_normal,
      username: perfilAtual?.username || usuarioAtual.nome_usuario,
      avatar_url: perfilAtual?.avatar_url || null,
      conteudo: novoComentario.trim(),
    });
    if (!error) {
      const data = await buscarComentariosDoPost(postSelecionado.id);
      setComentarios(data || []);
      setNovoComentario('');
      // Atualiza contagem localmente
      setContagemComentarios(prev => ({
        ...prev,
        [postSelecionado.id]: (prev[postSelecionado.id] || 0) + 1,
      }));
    }
    setEnviandoComentario(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.logoMini}>
            <MaterialIcons name="hub" size={18} color="#010409" />
          </LinearGradient>
          <Text style={styles.headerTitle}>The SH</Text>
        </View>
        <TouchableOpacity
          onPress={() => { supabase.auth.signOut(); router.replace('/'); }}
          style={styles.btnSair}
        >
          <MaterialIcons name="logout" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F05DCC" />}
      >
        {/* COMPOSE BOX */}
        <View style={styles.composeCard}>
          <View style={styles.composeTop}>
            <View style={styles.composeAvatar}>
              {perfilAtual?.avatar_url ? (
                <Image source={{ uri: perfilAtual.avatar_url }} style={styles.composeAvatarImg} />
              ) : (
                <Text style={styles.composeAvatarTxt}>
                  {(perfilAtual?.nome || usuarioAtual?.nome_normal || 'U').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="No que você está pensando?"
              placeholderTextColor="#444"
              multiline
              value={conteudoPost}
              onChangeText={setConteudoPost}
            />
          </View>

          {imagemPost && (
            <View style={styles.previewImageContainer}>
              <Image source={{ uri: imagemPost.uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removerImagem} onPress={() => setImagemPost(null)}>
                <MaterialIcons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composeActions}>
            <TouchableOpacity onPress={escolherImagemPost} style={styles.btnFoto}>
              <MaterialIcons name="add-photo-alternate" size={22} color="#2FDAD3" />
              <Text style={styles.btnFotoTxt}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={publicarPost} disabled={enviando} style={styles.btnPublicarWrapper}>
              <LinearGradient colors={['#F05DCC', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnPublicar}>
                <Text style={styles.btnPublicarTxt}>{enviando ? 'Publicando...' : 'Publicar'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* DIVISOR */}
        <View style={styles.divisor} />

        {/* LISTA DE POSTS */}
        {posts.length === 0 ? (
          <View style={styles.vazioContainer}>
            <MaterialIcons name="dynamic-feed" size={48} color="#222" />
            <Text style={styles.vazioTxt}>Nenhum post ainda.</Text>
            <Text style={styles.vazioSub}>Seja o primeiro a publicar!</Text>
          </View>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              usuarioAtual={usuarioAtual}
              curtido={!!curtidas[post.id]}
              onLike={() => toggleCurtida(post.id)}
              onComentarios={() => abrirComentarios(post)}
              onDeletar={post.usuario_id === usuarioAtual?.id ? () => deletarPost(post.id) : null}
              formatarTempo={formatarTempo}
              contagemComentarios={contagemComentarios[post.id] || 0}
            />
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* MODAL COMENTÁRIOS */}
      <Modal visible={modalComentarios} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comentários</Text>
              <TouchableOpacity onPress={() => { setModalComentarios(false); setComentarios([]); setPostSelecionado(null); }}>
                <MaterialIcons name="close" size={22} color="#8B949E" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.comentariosList} showsVerticalScrollIndicator={false}>
              {comentarios.length === 0 ? (
                <Text style={styles.semComentarios}>Nenhum comentário ainda. Seja o primeiro!</Text>
              ) : (
                comentarios.map(c => (
                  <View key={c.id} style={styles.comentarioItem}>
                    <View style={styles.comentarioAvatar}>
                      {c.avatar_url ? (
                        <Image source={{ uri: c.avatar_url }} style={styles.comentarioAvatarImg} />
                      ) : (
                        <Text style={styles.comentarioAvatarTxt}>
                          {(c.nome_usuario || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.comentarioConteudo}>
                      <Text style={styles.comentarioNome}>{c.nome_usuario || c.username}</Text>
                      <Text style={styles.comentarioTexto}>{c.conteudo}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.comentarioInput}>
              <TextInput
                style={styles.comentarioTextInput}
                placeholder="Adicionar comentário..."
                placeholderTextColor="#444"
                value={novoComentario}
                onChangeText={setNovoComentario}
                multiline
              />
              <TouchableOpacity
                onPress={enviarComentario}
                disabled={enviandoComentario || !novoComentario.trim()}
                style={[styles.btnEnviarComentario, (!novoComentario.trim()) && { opacity: 0.4 }]}
              >
                <MaterialIcons name="send" size={20} color="#F05DCC" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  header: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#1a1a2e',
    backgroundColor: '#010409',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  btnSair: { padding: 6 },
  scroll: { flex: 1 },

  // COMPOSE
  composeCard: {
    margin: 16,
    backgroundColor: '#0D1117',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  composeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  composeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  composeAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  composeAvatarTxt: { fontSize: 18, fontWeight: 'bold', color: '#F05DCC' },
  composeInput: {
    flex: 1,
    color: '#C9D1D9',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  previewImageContainer: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: { width: 120, height: 120, borderRadius: 8 },
  removerImagem: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F05DCC',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1a1a2e',
  },
  btnFoto: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnFotoTxt: { color: '#2FDAD3', fontWeight: '600', fontSize: 13 },
  btnPublicarWrapper: { borderRadius: 20, overflow: 'hidden' },
  btnPublicar: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  btnPublicarTxt: { color: '#010409', fontWeight: '800', fontSize: 13 },

  divisor: { height: 1, backgroundColor: '#0D1117', marginHorizontal: 0 },

  // VAZIO
  vazioContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, gap: 12 },
  vazioTxt: { color: '#333', fontSize: 18, fontWeight: 'bold' },
  vazioSub: { color: '#222', fontSize: 13 },

  // MODAL COMENTÁRIOS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0D1117',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1a1a2e',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#C9D1D9' },
  comentariosList: { flex: 1, maxHeight: 320 },
  semComentarios: { color: '#444', textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  comentarioItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  comentarioAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  comentarioAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  comentarioAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#2FDAD3' },
  comentarioConteudo: { flex: 1 },
  comentarioNome: { color: '#F05DCC', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  comentarioTexto: { color: '#C9D1D9', fontSize: 14, lineHeight: 20 },
  comentarioInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1a1a2e',
    marginTop: 8,
  },
  comentarioTextInput: {
    flex: 1,
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#C9D1D9',
    fontSize: 14,
    maxHeight: 80,
  },
  btnEnviarComentario: { padding: 8 },
});
