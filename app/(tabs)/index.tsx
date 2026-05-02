import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../supabase';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [nomeNormal, setNomeNormal] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const verificarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/feed');
    };
    verificarSessao();
  }, []);

  const handleAuth = async () => {
    if (!nomeUsuario || !senha) {
      Alert.alert('Atenção', 'Preencha o usuário e a senha!');
      return;
    }

    setLoading(true);
    const emailFalso = `${nomeUsuario.toLowerCase().trim()}@thesh.social`;

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailFalso,
        password: senha,
      });

      if (error) {
        Alert.alert(
          'Acesso Negado',
          'Usuário não encontrado ou senha incorreta. Deseja criar uma conta?',
          [
            { text: 'Tentar novamente', style: 'cancel' },
            { text: 'Criar Conta', onPress: () => setIsLogin(false) },
          ]
        );
      } else {
        router.replace('/feed');
      }
    } else {
      if (senha.length < 6) {
        Alert.alert('Senha Fraca', 'Sua senha deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }
      if (!nomeNormal) {
        Alert.alert('Atenção', 'Preencha o seu nome de exibição!');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailFalso,
        password: senha,
        options: {
          data: {
            nome_normal: nomeNormal,
            nome_usuario: nomeUsuario.toLowerCase().trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Erro no Cadastro', error.message);
      } else {
        // Criar perfil na tabela perfis
        if (data.user) {
          await supabase.from('perfis').upsert({
            id: data.user.id,
            username: nomeUsuario.toLowerCase().trim(),
            nome: nomeNormal,
            bio: '',
            avatar_url: null,
          });
        }
        Alert.alert('Bem-vindo ao The SH!', 'Conta criada com sucesso. Agora faça login!');
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#F05DCC', '#2FDAD3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoIcon}
          >
            <MaterialIcons name="hub" size={40} color="#010409" />
          </LinearGradient>
          <Text style={styles.headerLogo}>The SH</Text>
          <Text style={styles.tagline}>Sua rede. Sua voz.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isLogin ? 'Entrar' : 'Criar Conta'}</Text>

          {!isLogin && (
            <View style={styles.inputContainer}>
              <MaterialIcons name="person-outline" size={20} color="#555" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nome de exibição (ex: Alysson)"
                placeholderTextColor="#444"
                value={nomeNormal}
                onChangeText={setNomeNormal}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <MaterialIcons name="alternate-email" size={20} color="#555" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nome de usuário"
              placeholderTextColor="#444"
              value={nomeUsuario}
              onChangeText={setNomeUsuario}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock-outline" size={20} color="#555" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#444"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>

          <TouchableOpacity onPress={handleAuth} disabled={loading} style={styles.buttonWrapper}>
            <LinearGradient
              colors={['#F05DCC', '#2FDAD3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Aguarde...' : isLogin ? 'ENTRAR' : 'CRIAR PERFIL'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
            <Text style={styles.switchText}>
              {isLogin ? 'Ainda não tem conta? ' : 'Já tem conta? '}
              <Text style={styles.switchTextBold}>
                {isLogin ? 'Criar conta' : 'Fazer login'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010409' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLogo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  tagline: {
    color: '#2FDAD3',
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.8,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0D1117',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C9D1D9',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: '#C9D1D9', fontSize: 15 },
  buttonWrapper: { marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  button: { padding: 16, alignItems: 'center' },
  buttonText: { color: '#010409', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#8B949E', fontSize: 14 },
  switchTextBold: { color: '#F05DCC', fontWeight: 'bold' },
});