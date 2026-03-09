import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, Modal, StatusBar, Alert } from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { supabase } from '../../supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // npx expo install expo-image-picker

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [modalOpcoesVisivel, setModalOpcoesVisivel] = useState(false);
    const [mensagemSelecionada, setMensagemSelecionada] = useState(null);
    
    // Estados para Edição
    const [editandoId, setEditandoId] = useState(null);
    const [textoEdicao, setTextoEdicao] = useState('');

    const { receptorId, grupoId, nomeReceptor } = useLocalSearchParams();

    useEffect(() => {
        const inicializarChat = async () => {
            const user = await configurarUsuario();
            if (user) buscarMensagens(user.id);
        };
        inicializarChat();

        const canal = supabase
            .channel('chat_universal')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const msg = payload.new;
                    if (pertenceAConversa(msg)) {
                        const novaMsg = formatarMensagemSupabase(msg);
                        setMessages((prev) => GiftedChat.append(prev, [novaMsg]));
                    }
                } else if (payload.eventType === 'DELETE') {
                    setMessages((prev) => prev.filter((m) => m._id !== payload.old.id));
                } else if (payload.eventType === 'UPDATE') {
                    setMessages((prev) => prev.map(m => m._id === payload.new.id ? formatarMensagemSupabase(payload.new) : m));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(canal); };
    }, [currentUser?.id, grupoId, receptorId]);

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
        image: msg.imagem_url, // Suporte para foto
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
        const msg = novasMensagens[0];

        // Se estiver editando, chama a função de update
        if (editandoId) {
            await supabase.from('mensagens').update({ texto: msg.text }).eq('id', editandoId);
            setEditandoId(null);
            return;
        }

        await supabase.from('mensagens').insert([{
            texto: msg.text,
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
            // Aqui você enviaria para o Supabase Storage. Para simplificar, vamos salvar a base64 no campo imagem_url
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

    const prepararEdicao = () => {
        setEditandoId(mensagemSelecionada._id);
        setTextoEdicao(mensagemSelecionada.text);
        setModalOpcoesVisivel(false);
        // O GiftedChat vai preencher o input automaticamente se você usar o prop text
    };

    const renderBubble = (props) => {
        const isMine = props.currentMessage.user._id === currentUser.id;
        return (
            <View style={{ maxWidth: '85%' }}> 
                <Text style={[styles.chatUsername, { color: isMine ? '#2FDAD3' : '#F05DCC', textAlign: isMine ? 'right' : 'left' }]}>
                    {props.currentMessage.user.name}
                </Text>
                <Bubble
                    {...props}
                    wrapperStyle={{
                        right: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#1a1a1a', padding: 5, borderRadius: 15 },
                        left: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', padding: 5, borderRadius: 15 },
                    }}
                    textStyle={{
                        right: { color: '#C9D1D9', lineHeight: 20 },
                        left: { color: '#C9D1D9', lineHeight: 20 },
                    }}
                />
                {isMine && (
                    <TouchableOpacity
                        onPress={() => { setMensagemSelecionada(props.currentMessage); setModalOpcoesVisivel(true); }}
                        style={styles.setinhaBotao}
                    >
                        <MaterialIcons name="more-vert" size={16} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderActions = () => (
        <TouchableOpacity style={styles.actionButton} onPress={escolherImagem}>
            <MaterialIcons name="photo-camera" size={24} color="#F05DCC" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* MODAL DE OPÇÕES (EDITAR/APAGAR) */}
            <Modal animationType="fade" transparent={true} visible={modalOpcoesVisivel}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.optionItem} onPress={prepararEdicao}>
                            <MaterialIcons name="edit" size={24} color="#2FDAD3" />
                            <Text style={styles.optionText}>EDITAR MENSAGEM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.optionItem, {marginTop: 20}]} onPress={deletarMensagem}>
                            <MaterialIcons name="delete-forever" size={24} color="#F05DCC" />
                            <Text style={styles.optionText}>APAGAR PARA TODOS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeModal} onPress={() => setModalOpcoesVisivel(false)}>
                            <Text style={{color: '#666'}}>FECHAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/home')}><MaterialIcons name="arrow-back-ios" size={20} color="#F05DCC" /></TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{nomeReceptor || 'Chat Público'}</Text>
                    <Text style={styles.headerSub}>REPOSITÓRIO ATIVO</Text>
                </View>
                <View style={{width: 20}} />
            </View>

            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{ _id: currentUser.id }}
                renderBubble={renderBubble}
                renderActions={renderActions}
                placeholder={editandoId ? "Editando mensagem..." : "Desenvolver mensagem..."}
                text={editandoId ? textoEdicao : undefined}
                onInputTextChanged={editandoId ? setTextoEdicao : undefined}
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
    headerSub: { fontSize: 9, color: '#2FDAD3', letterSpacing: 2 },
    setinhaBotao: { position: 'absolute', bottom: 5, right: -15 },
    chatUsername: { fontSize: 10, fontWeight: '900', marginBottom: 2, textTransform: 'uppercase' },
    inputToolbar: { backgroundColor: '#0D1117', borderTopColor: '#1a1a1a', padding: 5 },
    actionButton: { marginLeft: 10, marginBottom: 10, justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#0D1117', padding: 30, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    optionItem: { flexDirection: 'row', alignItems: 'center' },
    optionText: { color: '#C9D1D9', marginLeft: 15, fontWeight: 'bold', letterSpacing: 1 },
    closeModal: { marginTop: 30, alignItems: 'center' }
});