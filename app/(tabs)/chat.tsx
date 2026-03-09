import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, Modal, StatusBar, Alert } from 'react-native';
import { GiftedChat, Bubble, InputToolbar } from 'react-native-gifted-chat';
import { supabase } from '../../supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [modalOpcoesVisivel, setModalOpcoesVisivel] = useState(false);
    const [mensagemSelecionada, setMensagemSelecionada] = useState(null);

    const { receptorId, grupoId, nomeReceptor } = useLocalSearchParams();

    useEffect(() => {
        const inicializarChat = async () => {
            const user = await configurarUsuario();
            if (user && user.id) {
                buscarMensagens(user.id);
            }
        };
        inicializarChat();

        const canal = supabase
            .channel('chat_universal')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    if (pertenceAConversa(payload.new)) {
                        setMessages((prev) => GiftedChat.append(prev, [formatarMensagemSupabase(payload.new)]));
                    }
                } else if (payload.eventType === 'DELETE') {
                    setMessages((prev) => prev.filter((m) => m._id !== payload.old.id));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(canal); };
    }, [grupoId, receptorId]);

    const pertenceAConversa = (msg) => {
        if (grupoId) return msg.grupo_id === grupoId;
        if (receptorId) {
            return (msg.usuario_id === currentUser?.id && msg.receptor_id === receptorId) ||
                   (msg.usuario_id === receptorId && msg.receptor_id === currentUser?.id);
        }
        return !msg.receptor_id && !msg.grupo_id;
    };

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
            const userObj = { 
                id: session.user.id, 
                _id: session.user.id, 
                name: session.user.user_metadata.nome_normal || 'Alysson' 
            };
            setCurrentUser(userObj);
            return userObj;
        }
        router.replace('/');
        return null;
    };

    const buscarMensagens = async (myId) => {
        let query = supabase.from('mensagens').select('*');
        if (grupoId) query = query.eq('grupo_id', grupoId);
        else if (receptorId) query = query.or(`and(usuario_id.eq.${myId},receptor_id.eq.${receptorId}),and(usuario_id.eq.${receptorId},receptor_id.eq.${myId})`);
        else query = query.is('receptor_id', null).is('grupo_id', null);

        const { data } = await query.order('criado_em', { ascending: false });
        if (data) setMessages(data.map(formatarMensagemSupabase));
    };

    const onSend = async (novasMensagens = []) => {
        const msgTexto = novasMensagens[0].text;
        await supabase.from('mensagens').insert([{
            texto: msgTexto,
            usuario_id: currentUser.id,
            nome_usuario: currentUser.name,
            receptor_id: grupoId ? null : (receptorId || null),
            grupo_id: grupoId || null,
        }]);
    };

    const escolherImagem = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            base64: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
            await supabase.from('mensagens').insert([{
                texto: '',
                imagem_url: base64Image,
                usuario_id: currentUser.id,
                nome_usuario: currentUser.name,
                receptor_id: grupoId ? null : (receptorId || null),
                grupo_id: grupoId || null,
            }]);
        }
    };

    const deletarMensagem = async () => {
        await supabase.from('mensagens').delete().eq('id', mensagemSelecionada._id);
        setModalOpcoesVisivel(false);
    };

    const renderBubble = (props) => {
        const isMine = props.currentMessage.user._id === currentUser?.id;
        return (
            <View style={{ marginBottom: 5, width: '100%', paddingHorizontal: 5 }}> 
                <Text style={[styles.chatUsername, { color: isMine ? '#2FDAD3' : '#F05DCC', textAlign: isMine ? 'right' : 'left', marginHorizontal: 5 }]}>
                    {props.currentMessage.user.name}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start', width: '100%' }}>
                    {isMine && (
                        <TouchableOpacity
                            onPress={() => { setMensagemSelecionada(props.currentMessage); setModalOpcoesVisivel(true); }}
                            style={{ padding: 5 }}
                        >
                            <MaterialIcons name="more-vert" size={18} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                    )}
                    
                    <View style={{ flexShrink: 1, maxWidth: isMine ? '85%' : '95%' }}>
                        <Bubble
                            {...props}
                            wrapperStyle={{
                                right: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 15, padding: 2 },
                                left: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 15, padding: 2 },
                            }}
                            textStyle={{
                                right: { color: '#C9D1D9', lineHeight: 22 },
                                left: { color: '#C9D1D9', lineHeight: 22 },
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
                <Text style={{ color: '#2FDAD3', fontWeight: 'bold' }}>INICIALIZANDO REPOSITÓRIO...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <Modal animationType="fade" transparent={true} visible={modalOpcoesVisivel}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalOpcoesVisivel(false)}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.optionItem} onPress={deletarMensagem}>
                            <MaterialIcons name="delete-forever" size={24} color="#F05DCC" />
                            <Text style={styles.optionText}>{mensagemSelecionada?.image ? 'APAGAR FOTO' : 'APAGAR REGISTRO'}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/home')}><MaterialIcons name="arrow-back-ios" size={20} color="#F05DCC" /></TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{nomeReceptor || 'Chat Público'}</Text>
                    <Text style={styles.headerSub}>GRUPO ATIVO</Text>
                </View>
                <View style={{width: 20}} />
            </View>

            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{ _id: currentUser.id, name: currentUser.name }}
                renderBubble={renderBubble}
                renderActions={() => (
                    <TouchableOpacity style={styles.actionButton} onPress={escolherImagem}>
                        <MaterialIcons name="photo-camera" size={24} color="#F05DCC" />
                    </TouchableOpacity>
                )}
                placeholder="Desenvolver mensagem..."
                messagesContainerStyle={{ backgroundColor: '#010409' }}
                renderInputToolbar={(props) => (
                    <InputToolbar {...props} containerStyle={styles.inputToolbar} />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#010409' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', flexDirection: 'row', alignItems: 'center', backgroundColor: '#010409' },
    headerCenter: { alignItems: 'center', flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#C9D1D9', textTransform: 'uppercase' },
    headerSub: { fontSize: 9, color: '#2FDAD3', letterSpacing: 2, fontWeight: 'bold', marginTop: 2 },
    chatUsername: { fontSize: 10, fontWeight: '900', marginBottom: 2, textTransform: 'uppercase' },
    inputToolbar: { backgroundColor: '#0D1117', borderTopColor: '#1a1a1a', padding: 5 },
    actionButton: { marginLeft: 10, marginBottom: 10, justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '75%', backgroundColor: '#0D1117', padding: 25, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    optionText: { color: '#C9D1D9', marginLeft: 15, fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
});