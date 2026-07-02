import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateField, SelectField, SheetModal } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import {
  Card,
  EmptyState,
  Fab,
  LoadingState,
  Pill,
  SecondaryButton,
  Segmented,
  StatusPill,
} from '../components/ui';
import { useData } from '../data/DataContext';
import { diffDays, fmtBRShort, parseYMD, todayUTC } from '../lib/dates';
import { Processo, SETORES } from '../lib/types';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts, STATUS, StatusKey, statusByKey } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<TabParamList, 'Processos'>;

interface Filtros {
  status: '' | StatusKey;
  setor: string;
  tipo: '' | 'administrativo' | 'judicial';
  emissorId: string;
  entradaDe?: string;
  entradaAte?: string;
  prazo?: 'vencido' | 'alerta';
}

const FILTROS_VAZIOS: Filtros = { status: '', setor: '', tipo: '', emissorId: '' };

/** Urgência para a LISTA (regra do web: alerta quando dias < 3). */
function urgenciaLista(p: Processo): { texto: string | null; cor: 'vencido' | 'alerta' | null } {
  const d = parseYMD(p.prazo);
  if (!d || p.stat === 'finalizado' || p.stat === 'arquivado') return { texto: null, cor: null };
  const dias = diffDays(todayUTC(), d);
  const texto = `Prazo ${fmtBRShort(p.prazo)} · ${dias < 0 ? `vencido há ${Math.abs(dias)} dia(s)` : `${dias} dia${dias === 1 ? '' : 's'}`}`;
  return { texto, cor: dias < 0 ? 'vencido' : dias < 3 ? 'alerta' : null };
}

export function ProcessosScreen() {
  const { colors, isDark } = useTheme();
  const { processos, emissores, loading, saveProcesso } = useData();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const [view, setView] = useState<'lista' | 'kanban'>('lista');
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [moverProc, setMoverProc] = useState<Processo | null>(null);

  // Filtros vindos do Dashboard (KPIs).
  useEffect(() => {
    if (route.params) {
      setFiltros({
        ...FILTROS_VAZIOS,
        status: route.params.status ?? '',
        prazo: route.params.prazo,
      });
      setView('lista');
      navigation.setParams(undefined as never);
    }
  }, [route.params]);

  const filtrados = useMemo(() => {
    let L = [...processos];
    const t = busca.trim().toLowerCase();
    if (t) {
      L = L.filter((p) =>
        [p.num, p.int, p.obj, p.setorOrigem, p.dest, p.acao, statusByKey(p.stat).label]
          .some((v) => String(v || '').toLowerCase().includes(t))
      );
    }
    if (filtros.status) L = L.filter((p) => p.stat === filtros.status);
    if (filtros.setor) L = L.filter((p) => p.setorOrigem === filtros.setor || p.dest === filtros.setor);
    if (filtros.tipo) L = L.filter((p) => p.tipo === filtros.tipo);
    if (filtros.emissorId) L = L.filter((p) => String(p.emissorId || '') === filtros.emissorId);
    if (filtros.entradaDe) L = L.filter((p) => p.ent && p.ent >= filtros.entradaDe!);
    if (filtros.entradaAte) L = L.filter((p) => p.ent && p.ent <= filtros.entradaAte!);
    if (filtros.prazo) {
      const hoje = todayUTC();
      L = L.filter((p) => {
        const d = parseYMD(p.prazo);
        if (!d || p.stat === 'finalizado' || p.stat === 'arquivado') return false;
        const df = diffDays(hoje, d);
        return filtros.prazo === 'vencido' ? df < 0 : df >= 0 && df <= 5;
      });
    }
    return L;
  }, [processos, busca, filtros]);

  const filtrosAtivos =
    !!(filtros.status || filtros.setor || filtros.tipo || filtros.emissorId || filtros.entradaDe || filtros.entradaAte || filtros.prazo);

  const moverStatus = async (stat: StatusKey) => {
    if (!moverProc) return;
    const old = { ...moverProc };
    setMoverProc(null);
    try {
      await saveProcesso({ ...moverProc, stat }, old);
    } catch (e) {
      console.warn('Erro ao mover processo:', e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Processos</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{processos.length}</Text>
          </View>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color="#a8c2df" />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nº, interessado…"
              placeholderTextColor="#a8c2df"
              style={styles.searchInput}
            />
          </View>
          <Pressable style={styles.filterBtn} onPress={() => setFiltrosOpen(true)}>
            <Feather name="filter" size={18} color="#fff" />
            {filtrosAtivos ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>
        <Segmented
          options={[
            { key: 'lista', label: 'Lista' },
            { key: 'kanban', label: 'Kanban' },
          ]}
          value={view}
          onChange={setView}
        />
      </NavyHeader>

      {loading ? (
        <LoadingState />
      ) : view === 'lista' ? (
        <FlatList
          data={filtrados}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 18, paddingBottom: 110, gap: 11 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="clipboard" text="Nenhum processo encontrado." />}
          renderItem={({ item: p }) => {
            const def = statusByKey(p.stat);
            const urg = urgenciaLista(p);
            const urgCor =
              urg.cor === 'vencido' ? (isDark ? '#e88b8b' : '#b42323')
              : urg.cor === 'alerta' ? (isDark ? '#e6a24a' : '#b25e09')
              : colors.muted;
            return (
              <Pressable onPress={() => navigation.navigate('ProcessoDetalhe', { id: p.id })}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: 4, backgroundColor: isDark ? def.colorDark : def.color }} />
                    <View style={{ flex: 1, padding: 13 }}>
                      <View style={styles.cardTop}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{p.num}</Text>
                        <StatusPill stat={p.stat} short />
                      </View>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: 5 }}>
                        {p.int}
                      </Text>
                      {p.obj ? (
                        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 }}>
                          {p.obj}
                        </Text>
                      ) : null}
                      {urg.texto || (p.anotacoes?.length ?? 0) > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                          {urg.texto ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Feather name="clock" size={12} color={urgCor} />
                              <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: urgCor }}>{urg.texto}</Text>
                            </View>
                          ) : null}
                          {(p.anotacoes?.length ?? 0) > 0 ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Feather name="message-square" size={11} color={colors.muted} />
                              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>
                                {p.anotacoes!.length}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: 110, gap: 12 }}
        >
          {STATUS.map((s) => {
            const cards = filtrados.filter((p) => p.stat === s.key);
            const apagada = s.key === 'finalizado' || s.key === 'arquivado';
            return (
              <View key={s.key} style={{ width: 168 }}>
                <View style={styles.kanbanHead}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? s.colorDark : s.color }} />
                  <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.text, flex: 1 }}>
                    {s.short}
                  </Text>
                  <View style={[styles.kanbanCount, { backgroundColor: colors.divider }]}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.muted }}>{cards.length}</Text>
                  </View>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                  {cards.length === 0 ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.mutedLight, textAlign: 'center', paddingVertical: 18 }}>
                      Sem processos
                    </Text>
                  ) : (
                    cards.map((p) => {
                      const urg = urgenciaLista(p);
                      const d = parseYMD(p.prazo);
                      const dias = d ? diffDays(todayUTC(), d) : null;
                      const curto =
                        dias === null || p.stat === 'finalizado' || p.stat === 'arquivado'
                          ? null
                          : dias < 0 ? 'Vencido' : `${dias} dia${dias === 1 ? '' : 's'}`;
                      const urgCor =
                        urg.cor === 'vencido' ? (isDark ? '#e88b8b' : '#b42323')
                        : dias !== null && dias <= 5 ? (isDark ? '#e6a24a' : '#b25e09')
                        : colors.muted;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => navigation.navigate('ProcessoDetalhe', { id: p.id })}
                          onLongPress={() => setMoverProc(p)}
                          delayLongPress={350}
                        >
                          <Card style={{ padding: 11, opacity: apagada ? 0.8 : 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{p.num}</Text>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginTop: 3 }}>
                              {p.int}
                            </Text>
                            {p.obj ? (
                              <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 15 }}>
                                {p.obj}
                              </Text>
                            ) : null}
                            {curto ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 }}>
                                <Feather name="clock" size={11} color={urgCor} />
                                <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: urgCor }}>{curto}</Text>
                              </View>
                            ) : null}
                          </Card>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Fab onPress={() => navigation.navigate('ProcessoForm')} />

      {/* Folha de filtros (mesmos filtros do web) */}
      <SheetModal visible={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtros">
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          <SelectField
            label="Status"
            value={filtros.status || undefined}
            options={[{ key: '' as const, label: 'Todos' }, ...STATUS.map((s) => ({ key: s.key as '' | StatusKey, label: s.label }))]}
            onChange={(v) => setFiltros((f) => ({ ...f, status: v as Filtros['status'] }))}
            placeholder="Todos"
            renderDot={(k) => (k ? (isDark ? statusByKey(k).colorDark : statusByKey(k).color) : null)}
          />
          <SelectField
            label="Setor"
            value={filtros.setor || undefined}
            options={[{ key: '', label: 'Todos' }, ...SETORES.map((s) => ({ key: s, label: s }))]}
            onChange={(v) => setFiltros((f) => ({ ...f, setor: v }))}
            placeholder="Todos"
          />
          <SelectField
            label="Tipo"
            value={filtros.tipo || undefined}
            options={[
              { key: '' as const, label: 'Todos' },
              { key: 'administrativo' as const, label: 'Administrativo' },
              { key: 'judicial' as const, label: 'Judicial' },
            ]}
            onChange={(v) => setFiltros((f) => ({ ...f, tipo: v as Filtros['tipo'] }))}
            placeholder="Todos"
          />
          <SelectField
            label="Emissor"
            value={filtros.emissorId || undefined}
            options={[{ key: '', label: 'Todos' }, ...emissores.map((e) => ({ key: String(e.id), label: e.name }))]}
            onChange={(v) => setFiltros((f) => ({ ...f, emissorId: v }))}
            placeholder="Todos"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField
              label="Entrada de"
              value={filtros.entradaDe}
              onChange={(v) => setFiltros((f) => ({ ...f, entradaDe: v }))}
              style={{ flex: 1 }}
            />
            <DateField
              label="Entrada até"
              value={filtros.entradaAte}
              onChange={(v) => setFiltros((f) => ({ ...f, entradaAte: v }))}
              style={{ flex: 1 }}
            />
          </View>
          {filtros.prazo ? (
            <Pill
              label={filtros.prazo === 'vencido' ? 'Filtro: prazos vencidos' : 'Filtro: vencendo em ≤5 dias'}
              color={isDark ? '#e88b8b' : '#b42323'}
              bg={isDark ? 'rgba(180,35,35,.2)' : '#fbe9e9'}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 }}>
            <SecondaryButton label="Limpar" onPress={() => { setFiltros(FILTROS_VAZIOS); setFiltrosOpen(false); }} style={{ flex: 1 }} />
            <Pressable
              onPress={() => setFiltrosOpen(false)}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: isDark ? '#1c5f9e' : '#0a3d73' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Aplicar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SheetModal>

      {/* Mover status (equivale ao arrastar do kanban no web) */}
      <SheetModal visible={!!moverProc} onClose={() => setMoverProc(null)} title={`Mover ${moverProc?.num ?? ''} para…`}>
        {STATUS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => moverStatus(s.key)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isDark ? s.colorDark : s.color }} />
            <Text
              style={{
                fontFamily: moverProc?.stat === s.key ? fonts.bold : fonts.medium,
                fontSize: 14.5,
                color: moverProc?.stat === s.key ? colors.primary : colors.text,
              }}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: '#fff', letterSpacing: -0.4 },
  countPill: {
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchBox: {
    flex: 1,
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
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0574f',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kanbanHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9, paddingHorizontal: 2 },
  kanbanCount: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
});
