import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  ScrollView, TextInput, Alert, StatusBar, Image,
  ActivityIndicator, Modal, Pressable, Dimensions,
} from 'react-native';
import { supabase } from '../../supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PostCard from '../../components/PostCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = Math.floor(SCREEN_WIDTH / 3) - 1;

export default function PerfilScreen() {
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [perfil, setPerfil] = useState({ nome: '', username: '', bio: '', avatar_url: null });
  const [novaSenha, setNovaSenha] = useState('');
  const [meusPosts, setMeusPosts] = useState([]);
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({});
  const [contagemCurtidas, setContagemCurtidas] = useState<Record<string, number>>({});
  const [contagemComentarios, setContagemComentarios] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [postModal, setPostModal] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const userId = session.user.id;
    setUsuarioAtual({ id: userId, ...session.user.user_metadata });

    const { data: perfilData } = await supabase.from('perfis').select('*').eq('id', userId).single();
    if (perfilData) {
      setPerfil(perfilData);
    } else {
      const meta = session.user.user_metadata;
      const novoPerfil = { id: userId, username: meta.nome_usuario || 'user', nome: meta.nome_normal || 'Usuário', bio: '', avatar_url: null };
      await supabase.from('perfis').insert([novoPerfil]);
      setPerfil(novoPerfil);
    }

    await buscarMeusPosts(userId);
  };

  const buscarMeusPosts = async (userId: string) => {
    const { data } = await supabase.from('posts').select('*').eq('usuario_id', userId).order('criado_em', { ascending: false });

    if (data) {
      setMeusPosts(data);

      // Curtidas do usuário
      const { data: minhasCurtidas } = await supabase.from('curtidas').select('post_id').eq('usuario_id', userId);
      const curtidasMap: Record<string, boolean> = {};
      if (minhasCurtidas) minhasCurtidas.forEach(c => { curtidasMap[c.post_id] = true; });
      setCurtidas(curtidasMap);

      // Contagem de curtidas
      const { data: todasCurtidas } = await supabase.from('curtidas').select('post_id');
      const contagemMap: Record<string, number> = {};
      if (todasCurtidas) todasCurtidas.forEach(c => { contagemMap[c.post_id] = (contagemMap[c.post_id] || 0) + 1; });
      setContagemCurtidas(contagemMap);

      // Contagem de comentários
      const { data: todosComentarios } = await supabase.from('comentarios').select('post_id');
      const comentariosMap: Record<string, number> = {};
      if (todosComentarios) todosComentarios.forEach(c => { comentariosMap[c.post_id] = (comentariosMap[c.post_id] || 0) + 1; });
      setContagemComentarios(comentariosMap);
    }
  };

  const uploadAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setUploadingAvatar(true);
    try {
      const base64Data = result.assets[0].base64;
      const byteChars = atob(base64Data);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
      const fileName = `${usuarioAtual.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) { Alert.alert('Erro no upload', uploadError.message); return; }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('perfis').update({ avatar_url: avatarUrl }).eq('id', usuarioAtual.id);
      setPerfil(prev => ({ ...prev, avatar_url: avatarUrl }));
      Alert.alert('Sucesso!', 'Foto de perfil atualizada!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível fazer o upload.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const salvarPerfil = async () => {
    setLoading(true);
    await supabase.from('perfis').update({ nome: perfil.nome, bio: perfil.bio }).eq('id', usuarioAtual.id);
    await supabase.auth.updateUser({ data: { nome_normal: perfil.nome } });
    if (novaSenha.length > 0) {
      if (novaSenha.length < 6) { Alert.alert('Senha Fraca', 'Mínimo 6 caracteres.'); setLoading(false); return; }
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) Alert.alert('Erro', error.message);
    }
    Alert.alert('Salvo!', 'Perfil atualizado.');
    setNovaSenha(''); setEditando(false);
    setLoading(false);
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
    if (postModal && postModal.id === postId) {
      setPostModal(prev => ({ ...prev, _contagem_curtidas: jaCurtiu ? Math.max((prev._contagem_curtidas || 1) - 1, 0) : (prev._contagem_curtidas || 0) + 1 }));
    }
  };

  const deletarPost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setMeusPosts(prev => prev.filter(p => p.id !== postId));
      setPostModal(null);
    } else {
      Alert.alert('Erro', 'Não foi possível apagar o post.');
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

  const inicial = (perfil.nome || 'U').charAt(0).toUpperCase();
  const totalCurtidas = Object.values(contagemCurtidas).reduce((acc, v) => acc + v, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* BANNER */}
        <LinearGradient colors={['#1a0428', '#0a0a14', '#010409']} style={styles.banner} />

        {/* AVATAR + INFOS */}
        <View style={styles.perfilHeader}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={uploadAvatar} activeOpacity={0.85} style={styles.avatarTouchable}>
              {uploadingAvatar ? (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <ActivityIndicator color="#F05DCC" size="large" />
                </View>
              ) : perfil.avatar_url ? (
                <Image source={{ uri: perfil.avatar_url }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.avatar}>
                  <Text style={styles.avatarLetra}>{inicial}</Text>
                </LinearGradient>
              )}
              <View style={styles.editAvatarBadge}>
                <MaterialIcons name="photo-camera" size={13} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* STATS ROW */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{meusPosts.length}</Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{totalCurtidas}</Text>
              <Text style={styles.statLabel}>curtidas</Text>
            </View>
          </View>
        </View>

        {/* NOME, USERNAME, BIO */}
        <View style={styles.bioSection}>
          <View style={styles.bioHeader}>
            <View>
              <Text style={styles.perfilNome}>{perfil.nome || 'Usuário'}</Text>
              <Text style={styles.perfilUsername}>@{perfil.username}</Text>
            </View>
            <TouchableOpacity onPress={() => setEditando(!editando)} style={styles.btnEditar}>
              <MaterialIcons name={editando ? 'close' : 'edit'} size={15} color="#F05DCC" />
              <Text style={styles.btnEditarTxt}>{editando ? 'Cancelar' : 'Editar perfil'}</Text>
            </TouchableOpacity>
          </View>
          {!!perfil.bio && !editando && (
            <Text style={styles.perfilBio}>{perfil.bio}</Text>
          )}
        </View>

        {/* FORM DE EDIÇÃO */}
        {editando && (
          <View style={styles.formEdicao}>
            <Text style={styles.formLabel}>NOME</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="badge" size={16} color="#555" style={styles.inputIcon} />
              <TextInput style={styles.input} value={perfil.nome} onChangeText={v => setPerfil(prev => ({ ...prev, nome: v }))} placeholder="Seu nome" placeholderTextColor="#333" />
            </View>

            <Text style={styles.formLabel}>BIO</Text>
            <View style={[styles.inputContainer, { alignItems: 'flex-start', paddingTop: 10 }]}>
              <MaterialIcons name="info-outline" size={16} color="#555" style={[styles.inputIcon, { marginTop: 2 }]} />
              <TextInput style={[styles.input, { minHeight: 60 }]} value={perfil.bio} onChangeText={v => setPerfil(prev => ({ ...prev, bio: v }))} placeholder="Fale sobre você..." placeholderTextColor="#333" multiline textAlignVertical="top" />
            </View>

            <Text style={styles.formLabel}>NOVA SENHA (OPCIONAL)</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock-outline" size={16} color="#555" style={styles.inputIcon} />
              <TextInput style={styles.input} value={novaSenha} onChangeText={setNovaSenha} placeholder="Mínimo 6 caracteres" placeholderTextColor="#333" secureTextEntry />
            </View>

            <TouchableOpacity onPress={salvarPerfil} disabled={loading} style={styles.btnSalvarWrapper}>
              <LinearGradient colors={['#F05DCC', '#2FDAD3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnSalvar}>
                <Text style={styles.btnSalvarTxt}>{loading ? 'SALVANDO...' : 'SALVAR'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* DIVISOR DE TABS (como Instagram) */}
        <View style={styles.tabBar}>
          <View style={styles.tabAtivo}>
            <MaterialIcons name="grid-on" size={20} color="#F05DCC" />
          </View>
        </View>

        {/* GRID DE POSTS */}
        {meusPosts.length === 0 ? (
          <View style={styles.vazio}>
            <MaterialIcons name="photo-camera" size={48} color="#1a1a2e" />
            <Text style={styles.vazioTitulo}>Sem publicações</Text>
            <Text style={styles.vazioSub}>Quando você publicar, aparecerá aqui.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {meusPosts.map(post => (
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
                  </View>
                )}
                {/* Mini overlay com curtidas */}
                {(contagemCurtidas[post.id] || 0) > 0 && (
                  <View style={styles.gridOverlay}>
                    <MaterialIcons name="favorite" size={12} color="#FFF" />
                    <Text style={styles.gridOverlayTxt}>{contagemCurtidas[post.id]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* MODAL DO POST */}
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
                  onDeletar={() => deletarPost(postModal.id)}
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
  banner: { height: 100 },

  // AVATAR
  perfilHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: -40, marginBottom: 12, gap: 20 },
  avatarWrapper: {},
  avatarTouchable: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#010409', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarFallback: { backgroundColor: '#1a1a2e' },
  avatarLetra: { fontSize: 34, fontWeight: 'bold', color: '#010409' },
  editAvatarBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#F05DCC', borderRadius: 11, width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#010409' },

  // STATS
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  stat: { alignItems: 'center' },
  statNum: { color: '#E6EDF3', fontWeight: '800', fontSize: 20 },
  statLabel: { color: '#555', fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: '#1a1a2e' },

  // BIO
  bioSection: { paddingHorizontal: 16, marginBottom: 12 },
  bioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  perfilNome: { fontSize: 18, fontWeight: '800', color: '#E6EDF3' },
  perfilUsername: { fontSize: 13, color: '#555', marginTop: 2 },
  perfilBio: { color: '#8B949E', fontSize: 14, lineHeight: 20 },
  btnEditar: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0D1117' },
  btnEditarTxt: { color: '#C9D1D9', fontWeight: '600', fontSize: 12 },

  // FORM
  formEdicao: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#0D1117', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  formLabel: { fontSize: 10, color: '#555', letterSpacing: 2, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#010409', borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, marginBottom: 8, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 11, color: '#C9D1D9', fontSize: 14 },
  btnSalvarWrapper: { marginTop: 8, borderRadius: 8, overflow: 'hidden' },
  btnSalvar: { padding: 13, alignItems: 'center' },
  btnSalvarTxt: { color: '#010409', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // TAB BAR (só grid por enquanto)
  tabBar: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a2e', flexDirection: 'row', marginBottom: 2 },
  tabAtivo: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#F05DCC' },

  // GRID
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, backgroundColor: '#0D1117', position: 'relative', overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { width: '100%', height: '100%', padding: 8, justifyContent: 'center', backgroundColor: '#0D1117' },
  gridTextContent: { color: '#C9D1D9', fontSize: 11, lineHeight: 16 },
  gridOverlay: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
  gridOverlayTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // VAZIO
  vazio: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, gap: 12 },
  vazioTitulo: { color: '#E6EDF3', fontSize: 18, fontWeight: '800' },
  vazioSub: { color: '#444', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#010409', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingTop: 8 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
});