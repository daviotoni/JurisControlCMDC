import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ConfirmSheet } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { Avatar, Card, FeatherName, GroupLabel, IconSquare } from '../components/ui';
import { useData } from '../data/DataContext';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PerfilScreen() {
  const { colors, isDark, toggleDark } = useTheme();
  const { user, userName, usuarios, logout } = useData();
  const navigation = useNavigation<Nav>();
  const [confirmSair, setConfirmSair] = useState(false);

  const cargo = useMemo(() => {
    const u = usuarios.find((x) => (x.login || '').toLowerCase() === (user?.email || '').toLowerCase());
    const papel = u?.role === 'admin' ? 'Administrador' : 'Usuário';
    return `${papel} · Procuradoria Jurídica`;
  }, [usuarios, user?.email]);

  const modulos: { icon: FeatherName; titulo: string; desc: string; to: keyof RootStackParamList }[] = [
    { icon: 'file-text', titulo: 'Documentos', desc: 'Modelos e pareceres emitidos', to: 'Documentos' },
    { icon: 'layers', titulo: 'Banco de Leis', desc: 'Legislação municipal indexada', to: 'Leis' },
    { icon: 'settings', titulo: 'Configurações', desc: 'Usuários, emissores e backup', to: 'Configuracoes' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader style={{ paddingBottom: 26 }}>
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <Avatar name={userName} size={74} />
          <Text style={styles.nome}>{userName}</Text>
          <Text style={styles.cargo}>{cargo}</Text>
        </View>
      </NavyHeader>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <GroupLabel label="Módulos" style={{ marginBottom: 10 }} />
        <Card style={{ padding: 4 }}>
          {modulos.map((m, i) => (
            <Pressable
              key={m.to}
              onPress={() => navigation.navigate(m.to as never)}
              style={[styles.row, i < modulos.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}
            >
              <IconSquare icon={m.icon} color={colors.primary} bg={colors.iconSquare} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>{m.titulo}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {m.desc}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedLight} />
            </Pressable>
          ))}
        </Card>

        <Card style={{ padding: 4, marginTop: 14 }}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
            <IconSquare icon="moon" color={colors.primary} bg={colors.iconSquare} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text, flex: 1 }}>Tema escuro</Text>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: '#d3dce8', true: '#1c5f9e' }}
              thumbColor="#fff"
            />
          </View>
          <Pressable style={styles.row} onPress={() => setConfirmSair(true)}>
            <IconSquare
              icon="log-out"
              color={isDark ? '#e88b8b' : '#b42323'}
              bg={isDark ? 'rgba(180,35,35,.2)' : '#fbe9e9'}
            />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger, flex: 1 }}>Sair</Text>
          </Pressable>
        </Card>
      </ScrollView>

      <ConfirmSheet
        visible={confirmSair}
        onClose={() => setConfirmSair(false)}
        title="Sair do sistema"
        message="Você precisará entrar novamente com suas credenciais."
        confirmLabel="Sair"
        onConfirm={() => logout()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nome: { fontFamily: fonts.bold, fontSize: 19, color: '#fff', letterSpacing: -0.3, marginTop: 12 },
  cargo: { fontFamily: fonts.medium, fontSize: 12.5, color: '#a8c2df', marginTop: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
});
