import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavyHeader } from '../components/NavyHeader';
import { Card, IconSquare, SectionTitle, StatusPill } from '../components/ui';
import { useData } from '../data/DataContext';
import {
  bannerPrazos,
  computeAlertas,
  computeKpis,
  KPI_COLORS,
  prazoColor,
  prazoInfo,
  saudacao,
} from '../lib/model';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { processos, userName, unread } = useData();
  const navigation = useNavigation<Nav>();

  const kpis = useMemo(() => computeKpis(processos), [processos]);
  const banner = useMemo(() => bannerPrazos(processos), [processos]);
  const alertas = useMemo(() => computeAlertas(processos), [processos]);

  const proximos = useMemo(() => {
    return processos
      .map((p) => ({ p, info: prazoInfo(p) }))
      .filter((x) => x.info.dias !== null)
      .sort((a, b) => (a.info.dias! - b.info.dias!))
      .slice(0, 4);
  }, [processos]);

  const goProcessos = (filter?: { status?: any; prazo?: 'vencido' | 'alerta' }) =>
    navigation.navigate('Tabs', { screen: 'Processos', params: filter });

  const kpiCards = [
    { label: 'Pendentes', value: kpis.pendentes, color: KPI_COLORS.pendentes, onPress: () => goProcessos({ status: 'pendente' }) },
    { label: 'Em Análise', value: kpis.emAnalise, color: KPI_COLORS.emAnalise, onPress: () => goProcessos({ status: 'em-analise' }) },
    { label: 'Vencendo (≤5 dias)', value: kpis.vencendo, color: KPI_COLORS.vencendo, onPress: () => goProcessos({ prazo: 'alerta' }) },
    { label: 'Finalizados', value: kpis.finalizados, color: KPI_COLORS.finalizados, onPress: () => goProcessos({ status: 'finalizado' }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.saudacao}>{saudacao()}</Text>
            <Text style={styles.nome} numberOfLines={2}>{userName}</Text>
          </View>
          <Pressable
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Tabs', { screen: 'Alertas' })}
          >
            <Feather name="bell" size={20} color="#fff" />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable style={styles.banner} onPress={() => navigation.navigate('Tabs', { screen: 'Alertas' })}>
          <View style={styles.bannerIcon}>
            <Feather name="clock" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {banner.seteDias} prazo{banner.seteDias === 1 ? ' vence' : 's vencem'} em 7 dias
            </Text>
            <Text style={styles.bannerSub}>
              {banner.imediatos} {banner.imediatos === 1 ? 'exige' : 'exigem'} ação imediata
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#a8c2df" />
        </Pressable>
      </NavyHeader>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiGrid}>
          {kpiCards.map((k) => (
            <Pressable key={k.label} style={{ width: '48.2%' }} onPress={k.onPress}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 3, backgroundColor: k.color }} />
                  <View style={{ padding: 13, flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                      {k.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 27, color: k.color, marginTop: 2, letterSpacing: -0.4 }}>
                      {k.value}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <SectionTitle
          title="Próximos prazos"
          action="Ver tudo"
          onAction={() => goProcessos()}
          style={{ marginTop: 22 }}
        />
        <Card style={{ padding: 4 }}>
          {proximos.length === 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, padding: 14 }}>
              Nenhum prazo em aberto.
            </Text>
          ) : (
            proximos.map(({ p, info }, i) => {
              const cor = prazoColor(info, colors.primary);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => navigation.navigate('ProcessoDetalhe', { id: p.id })}
                  style={[
                    styles.prazoRow,
                    i < proximos.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                  ]}
                >
                  <View style={styles.diasCol}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: cor, letterSpacing: -0.4 }}>
                      {info.vencido ? Math.abs(info.dias!) : info.dias}
                    </Text>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.muted, letterSpacing: 0.5 }}>
                      {info.vencido ? 'VENC.' : 'DIAS'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>
                      {p.obj || p.int}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
                      Proc. {p.num} · {p.int}
                    </Text>
                  </View>
                  <StatusPill stat={p.stat} short />
                </Pressable>
              );
            })
          )}
        </Card>

        <SectionTitle title="Alertas inteligentes" style={{ marginTop: 22 }} />
        {alertas.length === 0 ? (
          <Card>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>
              Nenhum alerta no momento.
            </Text>
          </Card>
        ) : (
          alertas.map((a, i) => (
            <Card key={i} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconSquare
                  icon={a.tipo === 'vencido' ? 'alert-triangle' : 'clock'}
                  color={a.tipo === 'vencido' ? (isDark ? '#e88b8b' : '#b42323') : (isDark ? '#e6a24a' : '#b25e09')}
                  bg={a.tipo === 'vencido' ? (isDark ? 'rgba(180,35,35,.2)' : '#fbe9e9') : colors.warnBg}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.text }}>{a.titulo}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {a.desc}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  saudacao: { fontFamily: fonts.regular, fontSize: 13, color: '#a8c2df' },
  nome: { fontFamily: fonts.bold, fontSize: 23, color: '#fff', letterSpacing: -0.4, marginTop: 2 },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#e0574f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,.1)',
    borderRadius: 16,
    padding: 12,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#fff' },
  bannerSub: { fontFamily: fonts.regular, fontSize: 11.5, color: '#a8c2df', marginTop: 1 },
  body: { padding: 20, paddingBottom: 110 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  prazoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  diasCol: { width: 46, alignItems: 'center', marginRight: 10 },
});
