import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, Modal, StatusBar, TextInput } from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { supabase } from '../../supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [modalDeletarVisivel, setModalDeletarVisivel] = useState(false);
    const [mensagemParaDeletar, setMensagemParaDeletar] = useState(null);

    const { receptorId, grupoId, nomeReceptor } = useLocalSearchParams();

    useEffect(() => {
        const inicializarChat = async () => {
            const user = await configurarUsuario();
            if (user) buscarMensagens(user.id);
        };
        inicializarChat();

        const canal = supabase
            .channel('chat_universal')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
                const msg = payload.new;
                let pertenceAEstaConversa = false;
                if (grupoId) pertenceAEstaConversa = msg.grupo_id === grupoId;
                else if (receptorId) {
                    pertenceAEstaConversa = (msg.usuario_id === currentUser?.id && msg.receptor_id === receptorId) ||
                        (msg.usuario_id === receptorId && msg.receptor_id === currentUser?.id);
                } else pertenceAEstaConversa = !msg.receptor_id && !msg.grupo_id;

                if (pertenceAEstaConversa) {
                    const novaMsgFormatada = {
                        _id: msg.id,
                        text: msg.texto,
                        createdAt: new Date(msg.criado_em),
                        user: { _id: msg.usuario_id, name: msg.nome_usuario || 'Membro' },
                    };
                    setMessages((prev) => GiftedChat.append(prev, [novaMsgFormatada]));
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensagens' }, (payload) => {
                setMessages((prevMessages) => prevMessages.filter((m) => m._id !== payload.old.id));
            })
            .subscribe();

        return () => { supabase.removeChannel(canal); };
    }, [currentUser?.id, grupoId, receptorId]);

    const configurarUsuario = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const userObj = { 
                id: session.user.id, 
                _id: session.user.id, 
                name: session.user.user_metadata.nome_normal || session.user.user_metadata.nome_usuario || 'Alysson Rodrigues' 
            };
            setCurrentUser(userObj);
            return userObj;
        } else {
            router.replace('/');
            return null;
        }
    };

    const buscarMensagens = async (myId) => {
        let query = supabase.from('mensagens').select('*');
        if (grupoId) query = query.eq('grupo_id', grupoId);
        else if (receptorId) query = query.or(`and(usuario_id.eq.${myId},receptor_id.eq.${receptorId}),and(usuario_id.eq.${receptorId},receptor_id.eq.${myId})`);
        else query = query.is('receptor_id', null).is('grupo_id', null);

        const { data, error } = await query.order('criado_em', { ascending: false });
        if (!error && data) {
            const formatadas = data.map((msg) => ({
                _id: msg.id,
                text: msg.texto,
                createdAt: new Date(msg.criado_em),
                user: { _id: msg.usuario_id, name: msg.nome_usuario || 'Membro' },
            }));
            setMessages(formatadas);
        }
    };

    const onSend = async (novasMensagens = []) => {
        const textoDigitado = novasMensagens[0].text;
        await supabase.from('mensagens').insert([{
            texto: textoDigitado,
            usuario_id: currentUser.id,
            nome_usuario: currentUser.name,
            receptor_id: grupoId ? null : (receptorId || null),
            grupo_id: grupoId || null,
        }]);
    };

    const executarExclusao = async () => {
        if (mensagemParaDeletar) {
            await supabase.from('mensagens').delete().eq('id', mensagemParaDeletar);
            setModalDeletarVisivel(false);
            setMensagemParaDeletar(null);
        }
    };

    // CUSTOMIZANDO A BOLHA PARA INCLUIR O NOME
    const renderBubble = (props) => {
        const isMine = props.currentMessage.user._id === currentUser.id;
        return (
            <View>
                {/* NOME DO USUÁRIO ACIMA DA BOLHA */}
                <Text style={[styles.chatUsername, { color: isMine ? '#2FDAD3' : '#F05DCC', textAlign: isMine ? 'right' : 'left', marginRight: isMine ? 10 : 0, marginLeft: isMine ? 0 : 10 }]}>
                    {props.currentMessage.user.name}
                </Text>
                <Bubble
                    {...props}
                    wrapperStyle={{
                        right: { backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#1a1a1a', paddingRight: 5, borderRadius: 15 },
                        left: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 15 },
                    }}
                    textStyle={{
                        right: { color: '#C9D1D9' },
                        left: { color: '#C9D1D9' },
                    }}
                />
                {/* SETINHA DE DELETAR DENTRO DA BOLHA */}
                {isMine && (
                    <TouchableOpacity
                        onPress={() => {
                            setMensagemParaDeletar(props.currentMessage._id);
                            setModalDeletarVisivel(true);
                        }}
                        style={styles.setinhaBotao}
                    >
                        <MaterialIcons name="keyboard-arrow-down" size={16} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // CAMPO DE TEXTO ESTILIZADO (INPUT)
    const renderInputToolbar = (props) => (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
            primaryStyle={{ alignItems: 'center' }}
        />
    );

    const renderSend = (props) => (
        <Send {...props}>
            <View style={styles.sendButton}>
                <MaterialIcons name="send" size={24} color="#2FDAD3" />
            </View>
        </Send>
    );

    if (!currentUser) return <View style={styles.container} />;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#010409" />
            
            <Modal animationType="fade" transparent={true} visible={modalDeletarVisivel}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <MaterialIcons name="delete-sweep" size={40} color="#F05DCC" />
                        <Text style={styles.modalTitle}>Deletar registro?</Text>
                        <Text style={styles.modalSubTitle}>Essa ação removerá a mensagem do repositório.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.btnModal, { backgroundColor: '#161B22' }]} onPress={() => setModalDeletarVisivel(false)}>
                                <Text style={{color: '#C9D1D9'}}>VOLTAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={executarExclusao}>
                                <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.btnModalGradient}>
                                    <Text style={{ color: '#010409', fontWeight: 'bold' }}>APAGAR</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
                    <MaterialIcons name="arrow-back-ios" size={20} color="#F05DCC" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{nomeReceptor || 'Chat Público'}</Text>
                    <Text style={styles.headerSub}>{grupoId ? 'GRUPO ATIVO' : 'CHAT PRIVADO'}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <GiftedChat
                messages={messages}
                onSend={(msgs) => onSend(msgs)}
                user={{ _id: currentUser.id, name: currentUser.name }}
                renderBubble={renderBubble}
                renderInputToolbar={renderInputToolbar}
                renderSend={renderSend}
                placeholder="Desenvolver mensagem..."
                showUserAvatar={false}
                renderAvatar={null}
                messagesContainerStyle={{ backgroundColor: '#010409', paddingBottom: 10 }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#010409' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#010409' },
    headerCenter: { alignItems: 'center', flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#C9D1D9', textTransform: 'uppercase', letterSpacing: 1 },
    headerSub: { fontSize: 9, color: '#2FDAD3', letterSpacing: 2, marginTop: 2 },
    backButton: { padding: 5 },
    setinhaBotao: { position: 'absolute', bottom: 8, right: 8, zIndex: 999 },
    sendButton: { marginRight: 10, marginBottom: 5, padding: 5 },
    chatUsername: { fontSize: 10, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
    
    // ESTILO DO CAMPO DE MENSAGEM (FOOTER)
    inputToolbar: {
        backgroundColor: '#0D1117',
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#0D1117', borderRadius: 15, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#30363D' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#C9D1D9', marginTop: 15, marginBottom: 10 },
    modalSubTitle: { fontSize: 13, color: '#8B949E', marginBottom: 25, textAlign: 'center' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    btnModal: { flex: 0.45, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnModalGradient: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, minWidth: 100, alignItems: 'center' }
});