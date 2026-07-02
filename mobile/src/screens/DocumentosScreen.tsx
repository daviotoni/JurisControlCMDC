import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NavyHeader } from '../components/NavyHeader';
import { Card, EmptyState, GroupLabel, IconSquare, Segmented } from '../components/ui';
import { useData } from '../data/DataContext';
import { shareDataUrl } from '../lib/files';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function DocumentosScreen() {
  const { colors, isDark } = useTheme();
  const { modelos, pareceres, processos, putRecord } = useData();
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<'modelos' | 'pareceres'>('modelos');
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState('');

  const modelosOrdenados = useMemo(() => [...modelos].sort((a, b) => b.id - a.id), [modelos]);

  const pareceresFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const L = [...pareceres].sort((a, b) => b.id - a.id);
    if (!t) return L;
    return L.filter((p) =>
      [p.processoNum, p.ementa, p.textoBusca].some((v) => String(v || '').toLowerCase().includes(t))
    );
  }, [pareceres, busca]);

  const adicionarModelo = async () => {
    setMsg('');
    const res = await DocumentPicker.getDocumentAsync({ type: [DOCX_MIME, 'application/msword'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      // Mesmo formato do web: { id, name, data: dataURL }.
      await putRecord('modelos', { id: Date.now(), name: file.name, data: `data:${file.mimeType || DOCX_MIME};base64,${base64}` });
      setMsg('Modelo adicionado com sucesso.');
    } catch (e) {
      console.warn('Erro ao adicionar modelo:', e);
      setMsg('Erro ao adicionar o modelo.');
    }
  };

  const baixarModelo = async (name: string, data: string) => {
    try {
      await shareDataUrl(name, data);
    } catch (e) {
      console.warn('Erro ao baixar modelo:', e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Documentos</Text>
          <View style={{ width: 40 }} />
        </View>
        <Segmented
          options={[
            { key: 'modelos' as const, label: 'Modelos' },
            { key: 'pareceres' as const, label: 'Pareceres' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </NavyHeader>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tab === 'modelos' ? (
          <>
            <View style={styles.sectionRow}>
              <GroupLabel label="Modelos de documento" />
              <Pressable onPress={adicionarModelo} hitSlop={8}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>+ Adicionar</Text>
              </Pressable>
            </View>
            {msg ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                {msg}
              </Text>
            ) : null}
            {modelosOrdenados.length === 0 ? (
              <EmptyState icon="file" text="Nenhum modelo cadastrado." />
            ) : (
              <View style={{ gap: 10 }}>
                {modelosOrdenados.map((m) => (
                  <Card key={m.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <IconSquare icon="file" color={colors.primary} bg={colors.iconSquare} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>
                          {m.name.replace(/\.docx?$/i, '')}
                        </Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
                          .docx · adicionado {new Date(m.id).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                      <Pressable onPress={() => baixarModelo(m.name, m.data)} hitSlop={8}>
                        <Feather name="download" size={19} color={colors.muted} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={15} color={colors.muted} />
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar no conteúdo dos pareceres…"
                placeholderTextColor={colors.mutedLight}
                style={{ flex: 1, paddingVertical: 11, fontFamily: fonts.medium, fontSize: 13, color: colors.text }}
              />
            </View>
            <GroupLabel label="Pareceres emitidos" style={{ marginBottom: 10 }} />
            {pareceresFiltrados.length === 0 ? (
              <EmptyState icon="file-text" text="Nenhum parecer encontrado." />
            ) : (
              <View style={{ gap: 10 }}>
                {pareceresFiltrados.map((p) => {
                  const emitido = p.status === 'emitido';
                  const procExiste = processos.some((x) => String(x.id) === String(p.processoId));
                  return (
                    <Pressable
                      key={p.id}
                      disabled={!procExiste}
                      onPress={() => navigation.navigate('ProcessoDetalhe', { id: Number(p.processoId) })}
                    >
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <IconSquare
                            icon="file-text"
                            color={emitido ? (isDark ? '#5cbe86' : '#2f855a') : (isDark ? '#e6a24a' : '#b25e09')}
                            bg={emitido ? (isDark ? 'rgba(47,133,90,.2)' : '#e9f5ee') : colors.warnBg}
                          />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>
                              Parecer — Proc. {p.processoNum}
                            </Text>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
                              {emitido && p.emitidoEm
                                ? `Emitido em ${new Date(p.emitidoEm).toLocaleDateString('pt-BR')}`
                                : 'Rascunho'}
                              {p.ementa ? ` · ${p.ementa}` : ''}
                            </Text>
                          </View>
                          {procExiste ? <Feather name="chevron-right" size={17} color={colors.mutedLight} /> : null}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
});
