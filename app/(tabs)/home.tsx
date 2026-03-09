import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Modal, TextInput, Alert, StatusBar } from 'react-native';
import { supabase } from '../../supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons'; 

export default function HomeScreen() {
    const [usuarioAtual, setUsuarioAtual] = useState(null);
    const [usuariosOnline, setUsuariosOnline] = useState([]);
    const [grupos, setGrupos] = useState([]);

    const [modalCriarVisivel, setModalCriarVisivel] = useState(false);
    const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
    const [modalDeletarVisivel, setModalDeletarVisivel] = useState(false);

    const [novoGrupoNome, setNovoGrupoNome] = useState('');
    const [novoGrupoSenha, setNovoGrupoSenha] = useState('');
    const [isPrivado, setIsPrivado] = useState(false);

    const [grupoSelecionado, setGrupoSelecionado] = useState(null);
    const [senhaDigitada, setSenhaDigitada] = useState('');

    // --- NOVO ESTADO: Rastreador de notificações ---
    const [mensagensNaoLidas, setMensagensNaoLidas] = useState({ grupos: {}, privados: {} });

    useEffect(() => {
        let canalPresence;
        let canalMensagensAlertas; // Canal para escutar notificações

        const iniciarApp = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const userMeta = session.user.user_metadata;
                const userId = session.user.id;
                setUsuarioAtual({ ...userMeta, id: userId });

                // 1. Escuta quem está online
                canalPresence = supabase.channel('usuarios-online');
                canalPresence
                    .on('presence', { event: 'sync' }, () => {
                        const estadoAtual = canalPresence.presenceState();
                        const listaUsuarios = [];
                        for (const chave in estadoAtual) {
                            if (estadoAtual[chave].length > 0) {
                                listaUsuarios.push(estadoAtual[chave][0]);
                            }
                        }
                        const apenasOutros = listaUsuarios.filter(u => u.id !== userId);
                        setUsuariosOnline(apenasOutros);
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            await canalPresence.track({
                                id: userId,
                                nome: userMeta.nome_normal || 'Usuário',
                                username: userMeta.nome_usuario,
                            });
                        }
                    });

                // 2. Escuta novas mensagens para gerar o ícone de notificação
                canalMensagensAlertas = supabase.channel('alertas-mensagens')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
                        const msg = payload.new;
                        
                        // Ignora se a mensagem foi enviada por mim mesmo
                        if (msg.usuario_id === userId) return;

                        setMensagensNaoLidas(prev => {
                            const novoEstado = { ...prev };
                            if (msg.grupo_id) {
                                // Notificação de grupo
                                novoEstado.grupos = { ...novoEstado.grupos, [msg.grupo_id]: true };
                            } else if (msg.receptor_id === userId) {
                                // Notificação de chat privado
                                novoEstado.privados = { ...novoEstado.privados, [msg.usuario_id]: true };
                            }
                            return novoEstado;
                        });
                    })
                    .subscribe();

                buscarGrupos();
            } else {
                router.replace('/');
            }
        };
        iniciarApp();

        const canalGrupos = supabase.channel('lista-groups')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'grupos' }, (payload) => {
                setGrupos((prev) => [payload.new, ...prev]);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'grupos' }, (payload) => {
                setGrupos((prev) => prev.filter(g => g.id !== payload.old.id));
            })
            .subscribe();

        return () => {
            if (canalPresence) supabase.removeChannel(canalPresence);
            if (canalMensagensAlertas) supabase.removeChannel(canalMensagensAlertas);
            supabase.removeChannel(canalGrupos);
        };
    }, []);

    const buscarGrupos = async () => {
        const { data } = await supabase.from('grupos').select('*').order('criado_em', { ascending: false });
        if (data) setGrupos(data);
    };

    const confirmarCriacaoGrupo = async () => {
        if (!novoGrupoNome) return;
        if (isPrivado && !novoGrupoSenha) {
            Alert.alert("Atenção", "Defina uma senha para o grupo privado.");
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from('grupos').insert([
            { 
                nome: novoGrupoNome, 
                senha: isPrivado ? novoGrupoSenha : null, 
                is_publico: !isPrivado, 
                criado_por: session.user.id 
            }
        ]);

        if (!error) {
            setModalCriarVisivel(false);
            setNovoGrupoNome('');
            setNovoGrupoSenha('');
            setIsPrivado(false);
        }
    };

    const abrirConfirmacaoDeletar = (grupo) => {
        setGrupoSelecionado(grupo);
        setModalDeletarVisivel(true);
    };

    const executarExclusao = async () => {
        if (!grupoSelecionado) return;
        const { error } = await supabase.from('grupos').delete().eq('id', grupoSelecionado.id);
        if (error) alert(error.message);
        setModalDeletarVisivel(false);
        setGrupoSelecionado(null);
    };

    const VerificarSenhaEEntrar = () => {
        if (senhaDigitada === grupoSelecionado.senha) {
            setModalSenhaVisivel(false);
            setSenhaDigitada('');
            irParaOChat(grupoSelecionado);
        } else {
            alert("Senha incorreta!");
        }
    };

    // --- FUNÇÕES DE NAVEGAÇÃO QUE LIMPAM AS NOTIFICAÇÕES ---
    const irParaOChat = (grupo) => {
        // Limpa a notificação daquele grupo ao entrar
        setMensagensNaoLidas(prev => ({ ...prev, grupos: { ...prev.grupos, [grupo.id]: false } }));
        router.push({ pathname: '/chat', params: { grupoId: grupo.id, nomeReceptor: grupo.nome } });
    };

    const abrirChatPrivado = (usuario) => {
        // Limpa a notificação daquele chat privado ao entrar
        setMensagensNaoLidas(prev => ({ ...prev, privados: { ...prev.privados, [usuario.id]: false } }));
        router.push({ pathname: '/chat', params: { receptorId: usuario.id, nomeReceptor: usuario.nome } });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#010409" />
            
            <View style={styles.headerPremium}>
                <Text style={styles.headerLogo}>SHChat</Text>
                <TouchableOpacity onPress={() => { supabase.auth.signOut(); router.replace('/'); }} style={styles.btnHeader}>
                    <MaterialIcons name="exit-to-app" size={22} color="#F05DCC" />
                    <Text style={[styles.txtHeader, {color: '#F05DCC'}]}>SAIR</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll}>
                <TouchableOpacity style={styles.perfilCard} onPress={() => router.push('/perfil')}>
                    <View style={styles.avatarGrande}>
                        <Text style={styles.avatarTexto}>{usuarioAtual?.nome_normal?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.infoUsuario}>
                        <Text style={styles.nomeUsuario}>Meu Perfil</Text>
                        <Text style={styles.username}>@{usuarioAtual?.nome_usuario}</Text>
                    </View>
                    <MaterialIcons name="settings" size={24} color="#C9D1D9" style={{opacity: 0.6}} />
                </TouchableOpacity>

                <View style={styles.secao}>
                    <Text style={styles.secaoTitulo}>MEMBROS ONLINE — {usuariosOnline.length}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.onlineScroll}>
                        {usuariosOnline.map((item) => (
                            <TouchableOpacity key={item.id} style={styles.onlineItem} onPress={() => abrirChatPrivado(item)}>
                                <View style={[styles.bordaOnline, { borderColor: '#F05DCC' }]}>
                                    <View style={styles.avatarInterno}>
                                        <Text style={styles.avatarTextoPequeno}>{item.nome.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    {/* --- ÍCONE DE NOTIFICAÇÃO PRIVADA --- */}
                                    {mensagensNaoLidas.privados[item.id] && (
                                        <View style={styles.badgeNotificacao}>
                                            <MaterialIcons name="notifications-active" size={12} color="#010409" />
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.onlineNome, {color: '#2FDAD3'}]} numberOfLines={1}>{item.nome.split(' ')[0]}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.secaoGrupos}>
                    <View style={styles.secaoHeader}>
                        <Text style={styles.secaoTitulo}>GRUPOS</Text>
                        <TouchableOpacity onPress={() => setModalCriarVisivel(true)} style={styles.btnNovoGrupo}>
                            <MaterialIcons name="add-circle-outline" size={18} color="#C9D1D9" style={{opacity: 0.8}} />
                            <Text style={styles.txtBtnNovo}>ADD</Text>
                        </TouchableOpacity>
                    </View>

                    {grupos.map((grupo) => (
                        <View key={grupo.id} style={styles.cardConversaWrapper}>
                            <TouchableOpacity 
                                style={styles.cardConversa} 
                                onPress={() => (grupo.is_publico ? irParaOChat(grupo) : (setGrupoSelecionado(grupo), setModalSenhaVisivel(true)))}
                            >
                                <View style={styles.avatarGrupo}>
                                    <MaterialIcons name="code" size={22} color="#F05DCC" />
                                    {/* --- ÍCONE DE NOTIFICAÇÃO GRUPO --- */}
                                    {mensagensNaoLidas.grupos[grupo.id] && (
                                        <View style={styles.badgeNotificacao}>
                                            <MaterialIcons name="notifications-active" size={12} color="#010409" />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.conversaInfo}>
                                    <Text style={styles.nomeGrupo}>{grupo.nome}</Text>
                                    <View style={styles.statusGrupo}>
                                        <MaterialIcons 
                                            name={grupo.is_publico ? "public" : "lock-outline"} 
                                            size={14} 
                                            color="#2FDAD3" 
                                            style={{marginRight: 4}}
                                        />
                                        <Text style={{fontSize: 12, color: '#2FDAD3'}}>{grupo.is_publico ? 'Público' : 'Trancado'}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                            {usuarioAtual && grupo.criado_por === usuarioAtual.id && (
                                <TouchableOpacity style={styles.btnLixeiraLuz} onPress={() => abrirConfirmacaoDeletar(grupo)}>
                                    <MaterialIcons name="delete-outline" size={22} color="#F05DCC" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* MODAL CRIAÇÃO COM CAIXINHA DE SELEÇÃO */}
            <Modal animationType="slide" transparent={true} visible={modalCriarVisivel}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentPremium}>
                        <Text style={styles.modalTitlePremium}>Novo Repositório</Text>
                        
                        <TextInput 
                            style={styles.inputPremium} 
                            placeholder="Nome do Grupo" 
                            placeholderTextColor="#666" 
                            value={novoGrupoNome} 
                            onChangeText={setNovoGrupoNome} 
                        />

                        <TouchableOpacity 
                            style={styles.checkboxContainer} 
                            onPress={() => setIsPrivado(!isPrivado)}
                        >
                            <MaterialIcons 
                                name={isPrivado ? "check-box" : "check-box-outline-blank"} 
                                size={24} 
                                color={isPrivado ? "#2FDAD3" : "#666"} 
                            />
                            <Text style={styles.checkboxLabel}>Grupo Privado (com senha)</Text>
                        </TouchableOpacity>

                        {isPrivado && (
                            <TextInput 
                                style={styles.inputPremium} 
                                placeholder="Defina a senha de acesso" 
                                placeholderTextColor="#666" 
                                secureTextEntry 
                                value={novoGrupoSenha} 
                                onChangeText={setNovoGrupoSenha} 
                            />
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => { setModalCriarVisivel(false); setIsPrivado(false); }} style={styles.btnModalSimple}>
                                <Text style={{color: '#F05DCC'}}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmarCriacaoGrupo}>
                                <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.btnModalGradient}>
                                    <Text style={{ color: '#010409', fontWeight: 'bold' }}>CRIAR AGORA</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL SENHA PARA ENTRAR */}
            <Modal animationType="fade" transparent={true} visible={modalSenhaVisivel}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentPremium}>
                        <Text style={styles.modalTitlePremium}>Acesso Restrito</Text>
                        <Text style={styles.modalSubTitle}>Digite a senha para "{grupoSelecionado?.nome}"</Text>
                        <TextInput 
                            style={styles.inputPremium} 
                            placeholder="Senha" 
                            placeholderTextColor="#666" 
                            secureTextEntry 
                            autoFocus
                            value={senhaDigitada} 
                            onChangeText={setSenhaDigitada} 
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalSenhaVisivel(false)} style={styles.btnModalSimple}>
                                <Text style={{color: '#F05DCC'}}>VOLTAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={VerificarSenhaEEntrar}>
                                <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.btnModalGradient}>
                                    <Text style={{ color: '#010409', fontWeight: 'bold' }}>ENTRAR</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL DELETAR */}
            <Modal animationType="fade" transparent={true} visible={modalDeletarVisivel}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentPremium, { borderTopWidth: 4, borderTopColor: '#F05DCC' }]}>
                        <Text style={styles.modalTitlePremium}>Apagar Grupo?</Text>
                        <Text style={styles.modalSubTitle}>Essa ação é permanente.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalDeletarVisivel(false)} style={styles.btnModalSimple}>
                                <Text style={{color: '#666'}}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={executarExclusao} style={styles.btnDeletarConfirm}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>EXCLUIR</Text>
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
    headerPremium: { height: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, borderBottomWidth: 1, borderColor: '#1a1a1a' },
    headerLogo: { fontSize: 20, fontWeight: '900', color: '#F05DCC', letterSpacing: 2, textTransform: 'uppercase' },
    btnHeader: { flexDirection: 'row', alignItems: 'center'},
    txtHeader: { fontWeight: 'bold', fontSize: 12, marginLeft: 6 },
    scroll: { flex: 1 },
    perfilCard: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#0D1117', margin: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1a1a1a' },
    avatarGrande: { width: 55, height: 55, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    avatarTexto: { fontSize: 22, fontWeight: 'bold', color: '#C9D1D9' },
    avatarTextoPequeno: { fontSize: 18, fontWeight: 'bold', color: '#C9D1D9' },
    infoUsuario: { flex: 1, marginLeft: 15 },
    nomeUsuario: { fontSize: 18, fontWeight: 'bold', color: '#C9D1D9' },
    username: { fontSize: 14, color: '#2FDAD3' },
    secao: { marginTop: 10, paddingHorizontal: 20 },
    secaoTitulo: { fontSize: 11, fontWeight: 'bold', color: '#C9D1D9', opacity: 0.6, marginBottom: 15, letterSpacing: 2, textTransform: 'uppercase' },
    onlineScroll: { flexDirection: 'row' },
    onlineItem: { alignItems: 'center', marginRight: 15, width: 60 },
    bordaOnline: { width: 54, height: 54, borderRadius: 27, padding: 2, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, position: 'relative' },
    avatarInterno: { width: '100%', height: '100%', borderRadius: 25, backgroundColor: '#010409', justifyContent: 'center', alignItems: 'center' },
    onlineNome: { fontSize: 10, marginTop: 6, fontWeight: 'bold' },
    secaoGrupos: { marginTop: 25 },
    secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
    btnNovoGrupo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a1a' },
    txtBtnNovo: { color: '#C9D1D9', fontWeight: 'bold', fontSize: 11, marginLeft: 5 },
    cardConversaWrapper: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#0D1117', borderRadius: 8, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#2FDAD3' },
    cardConversa: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12 },
    avatarGrupo: { width: 45, height: 45, borderRadius: 4, backgroundColor: '#010409', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a', position: 'relative' },
    conversaInfo: { marginLeft: 15, flex: 1 },
    nomeGrupo: { fontSize: 15, fontWeight: 'bold', color: '#C9D1D9' },
    statusGrupo: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    btnLixeiraLuz: { padding: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    modalContentPremium: { width: '85%', backgroundColor: '#0D1117', borderRadius: 8, padding: 25, borderWidth: 1, borderColor: '#333' },
    modalTitlePremium: { fontSize: 20, fontWeight: 'bold', color: '#C9D1D9', marginBottom: 15, textAlign: 'center', textTransform: 'uppercase' },
    modalSubTitle: { color: '#8B949E', fontSize: 14, marginBottom: 20, textAlign: 'center' },
    inputPremium: { backgroundColor: '#010409', borderRadius: 6, padding: 15, color: '#C9D1D9', marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
    checkboxLabel: { color: '#C9D1D9', marginLeft: 10, fontSize: 14 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    btnModalSimple: { padding: 10 },
    btnModalGradient: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 4 },
    btnDeletarConfirm: { backgroundColor: '#F05DCC', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 4 },
    
    // --- ESTILO DO ÍCONE DE NOTIFICAÇÃO ---
    badgeNotificacao: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#2FDAD3',
        borderRadius: 12,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#010409',
        zIndex: 10,
    }
});