import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TextInput, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { supabase } from '../../supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function PerfilScreen() {
  const [nomeNormal, setNomeNormal] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setNomeNormal(session.user.user_metadata.nome_normal || '');
  };

  const atualizarPerfil = async () => {
    setLoading(true);
    
    // Atualiza o nome no metadata
    const { error: errorMeta } = await supabase.auth.updateUser({
      data: { nome_normal: nomeNormal }
    });

    // Atualiza a senha se o campo não estiver vazio
    if (novaSenha.length > 0) {
      if (novaSenha.length < 6) {
        Alert.alert("Erro", "A senha deve ter pelo menos 6 caracteres.");
        setLoading(false);
        return;
      }
      const { error: errorPass } = await supabase.auth.updateUser({ password: novaSenha });
      if (errorPass) Alert.alert("Erro Senha", errorPass.message);
    }

    if (!errorMeta) {
      Alert.alert("Sucesso", "Perfil atualizado!");
      router.replace('/home'); 
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace('/home')} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color="#F05DCC" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MEU PERFIL</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
            <LinearGradient colors={['#F05DCC', '#2FDAD3']} style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                    {nomeNormal ? nomeNormal.charAt(0).toUpperCase() : '?'}
                </Text>
            </LinearGradient>
            {/* AGORA O NOME ABAIXO DO CÍRCULO É DINÂMICO */}
            <Text style={styles.avatarSubtext}>{nomeNormal || 'Usuário Tech'}</Text>
        </View>

        <View style={styles.form}>
            <Text style={styles.label}>NOME DE EXIBIÇÃO</Text>
            <View style={styles.inputContainer}>
                <MaterialIcons name="badge" size={20} color="#666" style={styles.inputIcon} />
                <TextInput 
                    style={styles.input} 
                    value={nomeNormal} 
                    onChangeText={setNomeNormal} 
                    placeholder="Seu nome tech" 
                    placeholderTextColor="#444"
                />
            </View>

            <Text style={styles.label}>SEGURANÇA (NOVA SENHA)</Text>
            <View style={styles.inputContainer}>
                <MaterialIcons name="lock-reset" size={20} color="#666" style={styles.inputIcon} />
                <TextInput 
                    style={styles.input} 
                    value={novaSenha} 
                    onChangeText={setNovaSenha} 
                    placeholder="Mínimo 6 caracteres" 
                    placeholderTextColor="#444"
                    secureTextEntry 
                />
            </View>

            <TouchableOpacity style={styles.buttonWrapper} onPress={atualizarPerfil} disabled={loading}>
                <LinearGradient 
                    colors={['#F05DCC', '#2FDAD3']} 
                    start={{x: 0, y: 0}} 
                    end={{x: 1, y: 0}} 
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>{loading ? 'SALVANDO...' : 'ATUALIZAR DADOS'}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#1a1a1a', alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#F05DCC', fontSize: 16, marginLeft: 5 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#C9D1D9', letterSpacing: 2 },
  content: { padding: 30 },
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  avatarLetter: { fontSize: 40, fontWeight: 'bold', color: '#010409' },
  avatarSubtext: { color: '#2FDAD3', marginTop: 15, fontSize: 12, letterSpacing: 2, fontWeight: 'bold', textTransform: 'uppercase' },
  form: { width: '100%' },
  label: { fontSize: 11, color: '#C9D1D9', opacity: 0.5, marginBottom: 10, letterSpacing: 1.5, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 12, marginBottom: 25, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, color: '#C9D1D9', fontSize: 16 },
  buttonWrapper: { marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  button: { padding: 18, alignItems: 'center' },
  buttonText: { color: '#010409', fontSize: 14, fontWeight: '900', letterSpacing: 2 }
});