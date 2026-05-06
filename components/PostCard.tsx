import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Post } from '../types';

interface PostCardProps {
  post: Post;
  usuarioAtual: { id: string } | null;
  curtido: boolean;
  onLike: () => void;
  onComentarios: () => void;
  onDeletar?: (() => void) | null;
  formatarTempo: (data: string) => string;
  contagemComentarios?: number;
}

export default function PostCard({
  post, usuarioAtual, curtido, onLike, onComentarios, onDeletar, formatarTempo, contagemComentarios = 0,
}: PostCardProps) {
  const [menuVisivel, setMenuVisivel] = useState(false);
  const isProprioPost = usuarioAtual?.id === post.usuario_id;
  const inicial = (post.nome_usuario || post.username || 'U').charAt(0).toUpperCase();
  const contagemCurtidas = post._contagem_curtidas || 0;

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          {post.avatar_url ? (
            <Image source={{ uri: post.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetra}>{inicial}</Text>
            </View>
          )}
        </View>
        <View style={styles.userInfoCol}>
          <Text style={styles.usernameHeader}>{post.username || post.nome_usuario || 'user'}</Text>
          {post.nome_usuario && post.nome_usuario !== post.username && (
            <Text style={styles.nomeCompleto}>{post.nome_usuario}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setMenuVisivel(true)} style={styles.moreBtn}>
          <MaterialIcons name="more-horiz" size={22} color="#8B949E" />
        </TouchableOpacity>
      </View>

      {/* IMAGE */}
      {!!post.imagem_url && (
        <Image source={{ uri: post.imagem_url }} style={styles.postImage} resizeMode="contain" />
      )}

      {/* ACTIONS */}
      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={onLike} style={styles.actionBtn}>
          <MaterialIcons name={curtido ? 'favorite' : 'favorite-border'} size={26} color={curtido ? '#F05DCC' : '#E6EDF3'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onComentarios} style={styles.actionBtn}>
          <MaterialIcons name="chat-bubble-outline" size={24} color="#E6EDF3" />
        </TouchableOpacity>
      </View>

      {/* LIKE COUNT */}
      {contagemCurtidas > 0 && (
        <Text style={styles.likeCount}>{contagemCurtidas} {contagemCurtidas === 1 ? 'curtida' : 'curtidas'}</Text>
      )}

      {/* CAPTION */}
      {!!post.conteudo && post.conteudo.trim().length > 0 && (
        <Text style={styles.caption} numberOfLines={3}>
          <Text style={styles.captionUsername}>{post.username || post.nome_usuario} </Text>
          {post.conteudo}
        </Text>
      )}

      {/* COMMENT COUNT */}
      {contagemComentarios > 0 && (
        <TouchableOpacity onPress={onComentarios}>
          <Text style={styles.verComentarios}>
            Ver todos os {contagemComentarios} comentário{contagemComentarios !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* TIME */}
      <Text style={styles.tempo}>{formatarTempo(post.criado_em)}</Text>

      {/* MENU MODAL */}
      <Modal visible={menuVisivel} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisivel(false)}>
          <View style={styles.menuSheet}>
            {isProprioPost && onDeletar && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisivel(false); onDeletar(); }}>
                <MaterialIcons name="delete-outline" size={20} color="#F05DCC" />
                <Text style={[styles.menuItemTxt, { color: '#F05DCC' }]}>Apagar post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setMenuVisivel(false)}>
              <MaterialIcons name="close" size={20} color="#555" />
              <Text style={styles.menuItemTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#010409', marginBottom: 8, borderBottomWidth: 1, borderColor: '#0D1117' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  avatarRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#F05DCC', padding: 1, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 17 },
  avatarFallback: { width: '100%', height: '100%', borderRadius: 17, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  avatarLetra: { fontSize: 14, fontWeight: 'bold', color: '#F05DCC' },
  userInfoCol: { flex: 1 },
  usernameHeader: { color: '#E6EDF3', fontWeight: '700', fontSize: 14 },
  nomeCompleto: { color: '#555', fontSize: 11, marginTop: 1 },
  moreBtn: { padding: 4 },
  postImage: { width: '100%', height: 320, backgroundColor: '#0D1117' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4, gap: 6 },
  actionBtn: { padding: 4 },
  likeCount: { color: '#E6EDF3', fontWeight: '700', fontSize: 14, paddingHorizontal: 14, marginBottom: 4 },
  caption: { color: '#C9D1D9', fontSize: 14, lineHeight: 20, paddingHorizontal: 14, marginBottom: 4 },
  captionUsername: { fontWeight: '800', color: '#E6EDF3' },
  verComentarios: { color: '#555', fontSize: 14, paddingHorizontal: 14, marginBottom: 4 },
  tempo: { color: '#333', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 14, paddingBottom: 12, marginTop: 2 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#0D1117', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#1a1a2e' },
  menuItemTxt: { color: '#C9D1D9', fontSize: 15, fontWeight: '600' },
});
