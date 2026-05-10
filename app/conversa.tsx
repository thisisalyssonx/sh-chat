import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, Modal, StatusBar, Alert, Image } from 'react-native';
import { GiftedChat, Bubble, InputToolbar } from 'react-native-gifted-chat';
import { supabase } from '../libs/supabase';
import {
  buscarMensagensDaConversa,
  inserirMensagem,
  deletarMensagem as deletarMensagemDB,
} from '../services/messageService';
import { uploadImagemMensagem } from '../services/storageService';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function ConversaScreen() {
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [modalOpcoesVisivel, setModalOpcoesVisivel] = useState(false);
  const [mensagemSelecionada, setMensagemSelecionada] = useState(null);

  const { receptorId, grupoId, nomeReceptor } = useLocalSearchParams();

  useEffect(() => {
    let canal;

    const inicializarChat = async () => {
      const user = await configurarUsuario();

      if (user && user.id) {
        buscarMensagens(user.id);

        canal = supabase
          .channel('conversa_universal')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, (payload) => {
            if (payload.eventType === 'INSERT') {
              const msg = payload.new;
              let pertence = false;
              if (grupoId) {
                pertence = msg.grupo_id === grupoId;
              } else if (receptorId) {
                pertence = (msg.usuario_id === user.id && msg.receptor_id === receptorId) ||
                  (msg.usuario_id === receptorId && msg.receptor_id === user.id);
              } else {
                pertence = !msg.receptor_id && !msg.grupo_id;
              }

              if (pertence) {
                setMessages((prev) => {
                  if (prev.some((m) => m._id === msg.id)) return prev;
                  return GiftedChat.append(prev, [formatarMensagemSupabase(msg)]);
                });
              }
            } else if (payload.eventType === 'DELETE') {
              setMessages((prev) => prev.filter((m) => m._id !== payload.old.id));
            }
          })
          .subscribe();
      }
    };

    inicializarChat();
    return () => { if (canal) supabase.removeChannel(canal); };
  }, [grupoId, receptorId]);

  const formatarMensagemSupabase = (msg) => ({
    _id: msg.id,
    text: msg.texto,
    image: msg.imagem_url,
    createdAt: new Date(msg.criado_em),
    user: { _id: msg.usuario_id, name: msg.nome_usuario || 'Membro' },
  });

  const configurarUsuario = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Buscar perfil para ter avatar
      const { data: perfil } = await supabase.from('perfis').select('*').eq('id', session.user.id).single();
      const userObj = {
        id: session.user.id,
        _id: session.user.id,
        name: perfil?.nome || session.user.user_metadata.nome_normal || 'Usuário',
        avatar: perfil?.avatar_url || null,
      };
      setCurrentUser(userObj);
      return userObj;
    }
    router.replace('/');
    return null;
  };

  const buscarMensagens = async (myId) => {
    const data = await buscarMensagensDaConversa(myId, grupoId, receptorId);
    if (data) setMessages(data.map(formatarMensagemSupabase));
  };

  const onSend = async (novasMensagens = []) => {
    const msgTexto = novasMensagens[0].text;
    await inserirMensagem({
      texto: msgTexto,
      usuario_id: currentUser.id,
      nome_usuario: currentUser.name,
      receptor_id: grupoId ? null : (receptorId || null),
      grupo_id: grupoId || null,
    });
  };

  const escolherImagem = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Data = result.assets[0].base64;
      const { publicUrl, error } = await uploadImagemMensagem(base64Data, currentUser.id);
      if (!error && publicUrl) {
        await inserirMensagem({
          texto: '',
          imagem_url: publicUrl,
          usuario_id: currentUser.id,
          nome_usuario: currentUser.name,
          receptor_id: grupoId ? null : (receptorId || null),
          grupo_id: grupoId || null,
        });
      }
    }
  };

  const deletarMensagem = async () => {
    await deletarMensagemDB(mensagemSelecionada._id);
    setModalOpcoesVisivel(false);
  };

  const renderBubble = (props) => {
    const isMine = props.currentMessage.user._id === currentUser?.id;
    return (
      <View style={{ marginBottom: 4, width: '100%', paddingHorizontal: 4 }}>
        <Text style={[styles.chatUsername, { color: isMine ? '#2FDAD3' : '#F05DCC', textAlign: isMine ? 'right' : 'left', marginHorizontal: 6 }]}>
          {props.currentMessage.user.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start', width: '100%' }}>
          {isMine && (
            <TouchableOpacity onPress={() => { setMensagemSelecionada(props.currentMessage); setModalOpcoesVisivel(true); }} style={{ padding: 4 }}>
              <MaterialIcons name="more-vert" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
          <View style={{ flexShrink: 1, maxWidth: '85%' }}>
            <Bubble
              {...props}
              wrapperStyle={{
                right: { backgroundColor: '#1a0428', borderWidth: 1, borderColor: '#F05DCC33', borderRadius: 16, padding: 2 },
                left: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 16, padding: 2 },
              }}
              textStyle={{
                right: { color: '#E6EDF3', lineHeight: 22 },
                left: { color: '#E6EDF3', lineHeight: 22 },
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  if (!currentUser || !currentUser.id) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#2FDAD3', fontWeight: 'bold' }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Modal animationType="fade" transparent visible={modalOpcoesVisivel}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalOpcoesVisivel(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.optionItem} onPress={deletarMensagem}>
              <MaterialIcons name="delete-forever" size={22} color="#F05DCC" />
              <Text style={styles.optionText}>{mensagemSelecionada?.image ? 'APAGAR IMAGEM' : 'APAGAR MENSAGEM'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color="#F05DCC" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{nomeReceptor || 'Chat'}</Text>
          <Text style={styles.headerSub}>{grupoId ? 'SALA PÚBLICA' : 'MENSAGEM PRIVADA'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }}
        renderBubble={renderBubble}
        renderActions={() => (
          <TouchableOpacity style={styles.actionButton} onPress={escolherImagem}>
            <MaterialIcons name="add-photo-alternate" size={24} color="#F05DCC" />
          </TouchableOpacity>
        )}
        placeholder="Mensagem..."
        messagesContainerStyle={{ backgroundColor: '#010409' }}
        renderInputToolbar={(props) => (
          <InputToolbar {...props} containerStyle={styles.inputToolbar} />
        )}
        alwaysShowSend
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  header: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010409',
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#E6EDF3' },
  headerSub: { fontSize: 9, color: '#2FDAD3', letterSpacing: 2, fontWeight: '700', marginTop: 1 },
  chatUsername: { fontSize: 10, fontWeight: '900', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputToolbar: { backgroundColor: '#0D1117', borderTopColor: '#1a1a2e', padding: 4 },
  actionButton: { marginLeft: 8, marginBottom: 8, justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '75%', backgroundColor: '#0D1117', padding: 24, borderRadius: 14, borderWidth: 1, borderColor: '#1a1a2e' },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  optionText: { color: '#C9D1D9', marginLeft: 14, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
});
