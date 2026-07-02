import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavyHeader } from '../components/NavyHeader';
import { Card, EmptyState, GroupLabel, IconSquare } from '../components/ui';
import { useData } from '../data/DataContext';
import { diffDays, parseYMD, todayUTC, ymd } from '../lib/dates';
import { Notif, NotifType } from '../lib/model';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filtro = 'all' | NotifType;

const CHIPS: { key: Filtro; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'prazo', label: 'Prazos' },
  { key: 'evento', label: 'Eventos' },
  { key: 'alerta', label: 'Alertas' },
];

const TYPE_STYLE: Record<NotifType, { icon: 'clock' | 'calendar' | 'alert-triangle'; color: string; bg: string; colorDark: string; bgDark: string }> = {
  prazo: { icon: 'clock', color: '#b42323', bg: '#fbe9e9', colorDark: '#e88b8b', bgDark: 'rgba(180,35,35,.2)' },
  evento: { icon: 'calendar', color: '#1c5f9e', bg: '#e8f0fa', colorDark: '#bcd3ee', bgDark: 'rgba(28,95,158,.25)' },
  alerta: { icon: 'alert-triangle', color: '#b25e09', bg: '#fdf0e4', colorDark: '#e6a24a', bgDark: 'rgba(178,94,9,.2)' },
};

export function NotificacoesScreen() {
  const { colors, isDark } = useTheme();
  const { notifications, cfg, markAllRead } = useData();
  const navigation = useNavigation<Nav>();
  const [filtro, setFiltro] = useState<Filtro>('all');

  const read = cfg?.readNotifications ?? [];

  const grupos = useMemo(() => {
    const list = filtro === 'all' ? notifications : notifications.filter((n) => n.type === filtro);
    const hoje = ymd(todayUTC());
    const atrasadas = list.filter((n) => n.date < hoje);
    const deHoje = list.filter((n) => n.date === hoje);
    const proximas = list.filter((n) => n.date > hoje);
    return [
      { label: 'Atrasadas', items: atrasadas },
      { label: 'Hoje', items: deHoje },
      { label: 'Próximas', items: proximas },
    ].filter((g) => g.items.length > 0);
  }, [notifications, filtro]);

  const abrir = (n: Notif) => {
    if (n.nav.type === 'proc') navigation.navigate('ProcessoDetalhe', { id: n.nav.id });
    else navigation.navigate('Tabs', { screen: 'Agenda', params: { date: n.nav.date } });
  };

  const tempoRelativo = (n: Notif): string => {
    const d = parseYMD(n.date);
    if (!d) return '';
    const df = diffDays(todayUTC(), d);
    if (df === 0) return 'hoje';
    if (df === 1) return 'amanhã';
    if (df === -1) return 'ontem';
    return df < 0 ? `há ${Math.abs(df)} dias` : `em ${df} dias`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notificações</Text>
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.marcar}>Marcar lidas</Text>
          </Pressable>
        </View>
        <View style={styles.chipsRow}>
          {CHIPS.map((c) => {
            const active = filtro === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFiltro(c.key)}
                style={[styles.chip, { backgroundColor: active ? '#fff' : 'rgba(255,255,255,.14)' }]}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: active ? '#0a3d73' : 'rgba(255,255,255,.85)' }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </NavyHeader>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {grupos.length === 0 ? (
          <EmptyState icon="bell" text="Nenhuma notificação por aqui." />
        ) : (
          grupos.map((g) => (
            <View key={g.label} style={{ marginBottom: 18 }}>
              <GroupLabel label={g.label} style={{ marginBottom: 10 }} />
              <View style={{ gap: 9 }}>
                {g.items.map((n) => {
                  const st = TYPE_STYLE[n.type];
                  const unread = !read.includes(n.id);
                  return (
                    <Pressable key={n.id} onPress={() => abrir(n)}>
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <IconSquare
                            icon={st.icon}
                            color={isDark ? st.colorDark : st.color}
                            bg={isDark ? st.bgDark : st.bg}
                          />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, lineHeight: 18 }}>
                              {n.title} — {n.subtitle}
                            </Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 3 }}>
                              {tempoRelativo(n)}
                            </Text>
                          </View>
                          {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: '#fff', letterSpacing: -0.4 },
  marcar: { fontFamily: fonts.semibold, fontSize: 13, color: '#a8c2df' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
