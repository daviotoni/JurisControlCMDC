import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConfirmSheet, Field, SelectField, SheetModal } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { Card, EmptyState, Fab, Pill, PrimaryButton, SecondaryButton } from '../components/ui';
import { useData } from '../data/DataContext';
import { Lei, TIPOS_LEI } from '../lib/types';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Cores dos pills de tipo (handoff: Lei azul, Decreto roxo, Resolução verde).
const TIPO_PILL: Record<string, { color: string; bg: string }> = {
  'Lei Federal': { color: '#0a3d73', bg: '#e8f0fa' },
  'Lei Estadual': { color: '#0a3d73', bg: '#e8f0fa' },
  'Lei Municipal': { color: '#0a3d73', bg: '#e8f0fa' },
  Decreto: { color: '#7c3aad', bg: '#f5eefa' },
  Portaria: { color: '#2f855a', bg: '#e9f5ee' },
  Outro: { color: '#5a6b82', bg: '#eef1f6' },
};

export function LeisScreen() {
  const { colors, isDark } = useTheme();
  const { leis, putRecord, deleteRecord } = useData();
  const navigation = useNavigation<Nav>();
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<Partial<Lei> | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [erro, setErro] = useState('');

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return leis;
    return leis.filter((l) =>
      [l.tipo, l.numero, l.ano, l.ementa].some((v) => String(v || '').toLowerCase().includes(t))
    );
  }, [leis, busca]);

  const salvar = async () => {
    setErro('');
    if (!form?.numero?.trim() || !form?.ementa?.trim() || !String(form?.ano ?? '').trim()) {
      setErro('Tipo, número, ano e ementa são obrigatórios.');
      return;
    }
    const rec: Lei = {
      id: form.id ?? Date.now(),
      numero: form.numero.trim(),
      ano: String(form.ano).trim(),
      tipo: form.tipo || 'Lei Municipal',
      ementa: form.ementa.trim(),
      ...(form.arquivo ? { arquivo: form.arquivo } : {}),
    };
    setForm(null);
    try {
      await putRecord('leis', rec);
    } catch (e) {
      console.warn('Erro ao salvar lei:', e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Banco de Leis</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#a8c2df" />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por tipo, número, ano, ementa…"
            placeholderTextColor="#a8c2df"
            style={styles.searchInput}
          />
        </View>
      </NavyHeader>

      <FlatList
        data={filtradas}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ padding: 18, paddingBottom: 110, gap: 11 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="layers" text="Nenhuma lei encontrada." />}
        renderItem={({ item: l }) => {
          const pill = TIPO_PILL[l.tipo] ?? TIPO_PILL.Outro;
          return (
            <Pressable onPress={() => { setErro(''); setForm({ ...l }); }}>
              <Card>
                <View style={styles.cardTop}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary, flex: 1 }}>
                    {l.tipo.startsWith('Lei') ? 'Lei' : l.tipo} nº {l.numero}
                  </Text>
                  <Pill
                    label={String(l.ano)}
                    color={colors.muted}
                    bg={isDark ? 'rgba(255,255,255,.07)' : '#eef1f6'}
                  />
                </View>
                <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 5, lineHeight: 18 }}>
                  {l.ementa}
                </Text>
                <View style={{ marginTop: 9 }}>
                  <Pill
                    label={l.tipo}
                    color={isDark ? '#bcd3ee' : pill.color}
                    bg={isDark ? 'rgba(255,255,255,.07)' : pill.bg}
                  />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <Fab onPress={() => { setErro(''); setForm({ tipo: 'Lei Municipal' }); }} />

      <SheetModal
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar lei' : 'Adicionar lei'}
      >
        <SelectField
          label="Tipo"
          value={form?.tipo}
          options={TIPOS_LEI.map((t) => ({ key: t, label: t }))}
          onChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field
            label="Número"
            value={form?.numero ?? ''}
            onChangeText={(v) => setForm((f) => ({ ...f, numero: v }))}
            placeholder="2.845"
            style={{ flex: 1.4 }}
          />
          <Field
            label="Ano"
            value={String(form?.ano ?? '')}
            onChangeText={(v) => setForm((f) => ({ ...f, ano: v }))}
            placeholder="2024"
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
        </View>
        <Field
          label="Ementa/Descrição"
          value={form?.ementa ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, ementa: v }))}
          placeholder="Dispõe sobre…"
          multiline
        />
        {erro ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.danger, marginBottom: 10 }}>
            {erro}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          {form?.id ? (
            <SecondaryButton label="Excluir" danger onPress={() => setConfirmDel(true)} style={{ flex: 1 }} />
          ) : null}
          <PrimaryButton label="Salvar" onPress={salvar} style={{ flex: 1.5 }} />
        </View>
      </SheetModal>

      <ConfirmSheet
        visible={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Excluir lei"
        message="Esta lei será removida permanentemente do banco."
        confirmLabel="Excluir"
        onConfirm={async () => {
          const id = form?.id;
          setForm(null);
          if (id != null) {
            try {
              await deleteRecord('leis', id);
            } catch (e) {
              console.warn('Erro ao excluir lei:', e);
            }
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 19, color: '#fff', letterSpacing: -0.3 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 13,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: '#fff',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
