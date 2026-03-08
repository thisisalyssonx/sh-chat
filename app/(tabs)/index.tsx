import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, SafeAreaView, StatusBar } from 'react-native';
import { supabase } from '../../supabase'; 
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons'; 

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true); 
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [nomeNormal, setNomeNormal] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const verificarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/home');
      }
    };
    verificarSessao();
  }, []);

  const handleAuth = async () => {
    if (!nomeUsuario || !senha) {
      Alert.alert('Atenção', 'Preencha o usuário e a senha!');
      return;
    }

    setLoading(true);
    const emailFalso = `${nomeUsuario.toLowerCase().trim()}@shchat.com`;

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailFalso,
        password: senha,
      });

      if (error) {
        Alert.alert('Erro', 'Usuário ou senha incorretos.');
      } else {
        router.replace('/home');
      }
    } else {
      if (!nomeNormal) {
        Alert.alert('Atenção', 'Preencha o seu nome normal!');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: emailFalso,
        password: senha,
        options: {
          data: {
            nome_normal: nomeNormal,
            nome_usuario: nomeUsuario,
          }
        }
      });

      if (error) {
        Alert.alert('Erro no Cadastro', error.message);
      } else {
        Alert.alert('Sucesso!', 'Conta criada. Agora você pode fazer o login.');
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010409" />
      
      <View style={styles.content}>
        {/* LOGO SIMBOLIZADA */}
        <View style={styles.logoContainer}>
             <MaterialIcons name="code" size={60} color="#F05DCC" />
             <Text style={styles.headerLogo}>SHCHAT</Text>
             <Text style={styles.tagline}>Software House Connect</Text>
        </View>

        <View style={styles.form}>
            {!isLogin && (
              <View style={styles.inputContainer}>
                <MaterialIcons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Nome Completo"
                    placeholderTextColor="#666"
                    value={nomeNormal}
                    onChangeText={setNomeNormal}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
                <MaterialIcons name="alternate-email" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Nome de Usuário"
                    placeholderTextColor="#666"
                    value={nomeUsuario}
                    onChangeText={setNomeUsuario}
                    autoCapitalize="none"
                />
            </View>

            <View style={styles.inputContainer}>
                <MaterialIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    placeholderTextColor="#666"
                    secureTextEntry
                    value={senha}
                    onChangeText={setSenha}
                />
            </View>

            <TouchableOpacity onPress={handleAuth} disabled={loading} style={styles.buttonWrapper}>
                <LinearGradient 
                    colors={['#F05DCC', '#2FDAD3']} 
                    start={{x: 0, y: 0}} 
                    end={{x: 1, y: 0}} 
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'PROCESSANDO...' : (isLogin ? 'CONECTAR' : 'CRIAR CONTA')}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
              <Text style={styles.switchText}>
                {isLogin ? 'Novo por aqui? ' : 'Já possui acesso? '}
                <Text style={styles.switchTextBold}>
                    {isLogin ? 'Crie seu perfil' : 'Faça login'}
                </Text>
              </Text>
            </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010409',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  headerLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 4,
    marginTop: 10,
  },
  tagline: {
    color: '#2FDAD3',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 5,
    opacity: 0.8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: '#C9D1D9',
    fontSize: 16,
  },
  buttonWrapper: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    padding: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#010409',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  switchButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  switchText: {
    color: '#C9D1D9',
    fontSize: 14,
    opacity: 0.7,
  },
  switchTextBold: {
    color: '#2FDAD3',
    fontWeight: 'bold',
  }
});