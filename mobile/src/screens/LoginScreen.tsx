import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { useData } from '../data/DataContext';
import { auth } from '../lib/firebase';
import { fonts, light } from '../theme/tokens';

// A tela de Login permanece SEMPRE clara, independente do tema (regra do web).
const C = light;

export function LoginScreen() {
  const { login } = useData();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const entrar = async () => {
    setErro('');
    setInfo('');
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    setBusy(true);
    try {
      await login(email, senha);
    } catch {
      setErro('Login ou senha inválidos');
      setBusy(false);
    }
  };

  const esqueci = async () => {
    setErro('');
    setInfo('');
    if (!email.trim()) {
      setErro('Informe o e-mail para redefinir a senha.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Enviamos um link de redefinição para o seu e-mail.');
    } catch {
      setErro('Não foi possível enviar o e-mail de redefinição.');
    }
  };

  return (
    <LinearGradient colors={['#0b4a86', '#082f57']} start={{ x: 0, y: 0 }} end={{ x: 0.35, y: 1 }} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.brasaoCard}>
              <Image source={require('../../assets/brasao-shield.png')} style={styles.brasao} resizeMode="contain" />
            </View>
            <Text style={styles.camara}>CÂMARA MUNICIPAL DE DUQUE DE CAXIAS</Text>
            <Text style={styles.title}>JurisControl</Text>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
            <Text style={styles.formTitle}>Acessar o sistema</Text>
            <Text style={styles.formSub}>Use suas credenciais institucionais</Text>

            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Feather name="mail" size={16} color={C.muted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="nome@cmdc.rj.gov.br"
                placeholderTextColor={C.mutedLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color={C.muted} />
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••••"
                placeholderTextColor={C.mutedLight}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                style={styles.input}
                onSubmitEditing={entrar}
              />
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={17} color={C.muted} />
              </Pressable>
            </View>

            <View style={styles.rowBetween}>
              <Pressable style={styles.lembrarRow} onPress={() => setLembrar((v) => !v)} hitSlop={6}>
                <View style={[styles.checkbox, lembrar && styles.checkboxOn]}>
                  {lembrar ? <Feather name="check" size={11} color="#fff" /> : null}
                </View>
                <Text style={styles.lembrarText}>Lembrar-me</Text>
              </Pressable>
              <Pressable onPress={esqueci} hitSlop={6}>
                <Text style={styles.esqueci}>Esqueci a senha</Text>
              </Pressable>
            </View>

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}

            <PrimaryButton label="Entrar" onPress={entrar} loading={busy} style={{ marginTop: 6 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 30 },
  brasaoCard: {
    width: 94,
    height: 94,
    borderRadius: 27,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  brasao: { width: 62, height: 62 },
  camara: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: '#a8c2df',
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: -0.4,
    color: '#fff',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  formTitle: { fontFamily: fonts.bold, fontSize: 18, color: C.text, letterSpacing: -0.2 },
  formSub: { fontFamily: fonts.regular, fontSize: 13, color: C.muted, marginTop: 3, marginBottom: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#f5f7fb',
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    color: C.text,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 18,
  },
  lembrarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.mutedLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#0a3d73', borderColor: '#0a3d73' },
  lembrarText: { fontFamily: fonts.medium, fontSize: 13, color: C.textSecondary },
  esqueci: { fontFamily: fonts.semibold, fontSize: 13, color: '#0a3d73' },
  erro: { fontFamily: fonts.semibold, fontSize: 13, color: '#b42323', marginBottom: 10 },
  info: { fontFamily: fonts.semibold, fontSize: 13, color: '#2f855a', marginBottom: 10 },
});
