import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateField, Field, SelectField, SheetModal } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { Card, Pill, PrimaryButton, SecondaryButton, Segmented } from '../components/ui';
import { useData } from '../data/DataContext';
import {
  addDays,
  DIAS_CURTO,
  fmtDiaLongo,
  MESES,
  MESES_CURTO,
  parseYMD,
  startOfWeek,
  todayUTC,
  ymd,
} from '../lib/dates';
import { EventoCal } from '../lib/types';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { catByKey, CatKey, CATS, fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<TabParamList, 'Agenda'>;
type CalView = 'month' | 'week' | 'day';

const ROW_H = 46;

export function AgendaScreen() {
  const { colors, isDark } = useTheme();
  const { eventos, processos, putRecord, deleteRecord } = useData();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const [view, setView] = useState<CalView>('month');
  const [cursor, setCursor] = useState<Date>(todayUTC());
  const [form, setForm] = useState<Partial<EventoCal> | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (route.params?.date) {
      const d = parseYMD(route.params.date);
      if (d) {
        setCursor(d);
        setView('day');
      }
      navigation.setParams({ date: undefined } as never);
    }
  }, [route.params?.date]);

  // Eventos reais + prazos de processos ativos (eventos derivados "pr-" do web).
  const lista = useMemo(() => {
    const derivados: EventoCal[] = processos
      .filter((p) => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado')
      .map((p) => ({ id: `pr-${p.id}`, data: p.prazo!, hora: '', desc: `Prazo: ${p.num}`, cat: 'p' as CatKey }));
    return [...eventos, ...derivados];
  }, [eventos, processos]);

  const doDia = (d: Date) => lista.filter((e) => e.data === ymd(d)).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  const shift = (delta: number) => {
    if (view === 'month') {
      const d = new Date(cursor.getTime());
      d.setUTCMonth(d.getUTCMonth() + delta);
      setCursor(d);
    } else if (view === 'week') {
      setCursor(addDays(cursor, 7 * delta));
    } else {
      setCursor(addDays(cursor, delta));
    }
  };

  const abrirEvt = (e: EventoCal) => {
    if (String(e.id).startsWith('pr-')) {
      const id = Number(String(e.id).replace('pr-', ''));
      navigation.navigate('ProcessoDetalhe', { id });
      return;
    }
    setForm({ ...e });
  };

  const salvarEvt = async () => {
    if (!form?.data || !form?.desc?.trim()) return;
    const rec: EventoCal = {
      id: form.id ?? Date.now(),
      data: form.data,
      hora: (form.hora || '').trim(),
      desc: form.desc.trim(),
      cat: (form.cat as CatKey) || 'g',
    };
    setForm(null);
    try {
      await putRecord('calendario', rec);
    } catch (e) {
      console.warn('Erro ao salvar evento:', e);
    }
  };

  const excluirEvt = async () => {
    if (!form?.id) return;
    const id = form.id;
    setForm(null);
    try {
      await deleteRecord('calendario', id);
    } catch (e) {
      console.warn('Erro ao excluir evento:', e);
    }
  };

  const hoje = todayUTC();
  const weekStart = startOfWeek(cursor);

  const headerTitle = () => {
    if (view === 'month') return `${MESES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
    if (view === 'week') {
      const fim = addDays(weekStart, 6);
      return `${String(weekStart.getUTCDate()).padStart(2, '0')} ${MESES_CURTO[weekStart.getUTCMonth()]} – ${String(fim.getUTCDate()).padStart(2, '0')} ${MESES_CURTO[fim.getUTCMonth()]}`;
    }
    return `${MESES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
  };

  // ===== Visão MÊS =====
  const renderMonth = () => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const offset = (first.getUTCDay() + 6) % 7; // semana começa na SEG
    const start = addDays(first, -offset);
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
    }
    const eventosDia = doDia(cursor);
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 12 }}>
          <View style={styles.weekHeadRow}>
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <Text key={i} style={[styles.weekHeadCell, { color: colors.muted }]}>{d}</Text>
            ))}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d) => {
                const outro = d.getUTCMonth() !== cursor.getUTCMonth();
                const selected = ymd(d) === ymd(cursor);
                const isToday = ymd(d) === ymd(hoje);
                const evts = doDia(d);
                return (
                  <Pressable key={ymd(d)} style={styles.dayCell} onPress={() => setCursor(d)}>
                    <View
                      style={[
                        styles.dayInner,
                        selected && { backgroundColor: isDark ? '#1c5f9e' : '#0a3d73' },
                        !selected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: selected ? fonts.bold : fonts.semibold,
                          fontSize: 13,
                          color: selected ? '#fff' : outro ? colors.mutedLight : colors.text,
                        }}
                      >
                        {d.getUTCDate()}
                      </Text>
                      <View style={styles.dotsRow}>
                        {evts.slice(0, 2).map((e, i) => (
                          <View
                            key={i}
                            style={[styles.evtDot, { backgroundColor: selected ? '#fff' : catByKey(e.cat).color }]}
                          />
                        ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 18, marginBottom: 10 }}>
          {fmtDiaLongo(cursor)}
        </Text>
        <Card style={{ padding: 6 }}>
          {eventosDia.length === 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, padding: 10 }}>
              Nenhum compromisso neste dia.
            </Text>
          ) : (
            eventosDia.map((e, i) => (
              <Pressable
                key={String(e.id)}
                onPress={() => abrirEvt(e)}
                style={[styles.evtRow, i < eventosDia.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}
              >
                <View style={[styles.evtDotLg, { backgroundColor: catByKey(e.cat).color }]} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, width: 46 }}>
                  {e.hora || '—'}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  {e.desc}
                </Text>
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    );
  };

  // ===== Visão SEMANA =====
  const renderWeek = () => {
    const dias = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const evtsSemana = dias.flatMap((d) => doDia(d));
    const horas = evtsSemana
      .map((e) => parseInt((e.hora || '').split(':')[0], 10))
      .filter((h) => !Number.isNaN(h));
    const hIni = Math.min(9, ...(horas.length ? horas : [9]));
    const hFim = Math.max(15, ...(horas.length ? horas.map((h) => h + 1) : [15]));
    const range = Array.from({ length: hFim - hIni + 1 }, (_, i) => hIni + i);
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={{ width: 34 }} />
            {dias.map((d) => {
              const isToday = ymd(d) === ymd(hoje);
              return (
                <Pressable key={ymd(d)} style={{ flex: 1, alignItems: 'center' }} onPress={() => { setCursor(d); setView('day'); }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.muted, letterSpacing: 0.5 }}>
                    {DIAS_CURTO[d.getUTCDay()]}
                  </Text>
                  <View
                    style={[
                      { marginTop: 3, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
                      isToday && { backgroundColor: isDark ? '#1c5f9e' : '#0a3d73' },
                    ]}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: isToday ? '#fff' : colors.text }}>
                      {d.getUTCDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 34 }}>
              {range.map((h) => (
                <Text key={h} style={{ height: ROW_H, fontFamily: fonts.medium, fontSize: 10, color: colors.muted }}>
                  {String(h).padStart(2, '0')}h
                </Text>
              ))}
            </View>
            {dias.map((d) => {
              const evts = doDia(d);
              return (
                <View
                  key={ymd(d)}
                  style={{ flex: 1, height: range.length * ROW_H, borderLeftWidth: 1, borderLeftColor: colors.divider }}
                >
                  {range.map((h) => (
                    <View key={h} style={{ height: ROW_H, borderBottomWidth: 1, borderBottomColor: colors.divider }} />
                  ))}
                  {evts.map((e) => {
                    const h = parseInt((e.hora || '').split(':')[0], 10);
                    const m = parseInt((e.hora || '').split(':')[1] || '0', 10);
                    const top = Number.isNaN(h) ? 2 : (h - hIni) * ROW_H + (m / 60) * ROW_H;
                    const cat = catByKey(e.cat);
                    return (
                      <Pressable
                        key={String(e.id)}
                        onPress={() => abrirEvt(e)}
                        style={[
                          styles.weekEvt,
                          {
                            top,
                            backgroundColor: isDark ? 'rgba(255,255,255,.06)' : `${cat.color}18`,
                            borderLeftColor: cat.color,
                          },
                        ]}
                      >
                        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 8.5, color: isDark ? colors.textSecondary : cat.color }}>
                          {e.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </Card>
        <View style={styles.legend}>
          {CATS.filter((c) => ['r', 'a', 'o', 'p'].includes(c.key)).map((c) => (
            <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }}>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ===== Visão DIA =====
  const renderDay = () => {
    const dias = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const evts = doDia(cursor);
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 12 }}>
          {fmtDiaLongo(cursor)}
        </Text>
        {evts.length === 0 ? (
          <Card>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted }}>
              Nenhum compromisso neste dia.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {evts.map((e) => {
              const cat = catByKey(e.cat);
              return (
                <View key={String(e.id)} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted, width: 44, marginTop: 14 }}>
                    {e.hora || '—'}
                  </Text>
                  <Pressable style={{ flex: 1 }} onPress={() => abrirEvt(e)}>
                    <Card style={{ borderLeftWidth: 4, borderLeftColor: cat.color }}>
                      <Pill label={cat.label.toUpperCase()} color={cat.color} bg={isDark ? 'rgba(255,255,255,.07)' : `${cat.color}16`} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginTop: 8 }}>
                        {e.desc}
                      </Text>
                    </Card>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const isPr = form?.id != null && String(form.id).startsWith('pr-');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Pressable onPress={() => shift(-1)} hitSlop={8} style={styles.navBtn}>
              <Feather name="chevron-left" size={19} color="#fff" />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{headerTitle()}</Text>
            <Pressable onPress={() => shift(1)} hitSlop={8} style={styles.navBtn}>
              <Feather name="chevron-right" size={19} color="#fff" />
            </Pressable>
          </View>
          <Pressable
            style={styles.novoBtn}
            onPress={() => setForm({ data: ymd(cursor), hora: '', desc: '', cat: 'g' })}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#0a3d73' }}>+ Novo</Text>
          </Pressable>
        </View>
        {view === 'day' ? (
          <View style={styles.dayStrip}>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
              const selected = ymd(d) === ymd(cursor);
              return (
                <Pressable key={ymd(d)} style={{ alignItems: 'center', flex: 1 }} onPress={() => setCursor(d)}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: '#a8c2df', letterSpacing: 0.5 }}>
                    {DIAS_CURTO[d.getUTCDay()]}
                  </Text>
                  <View
                    style={[
                      { marginTop: 4, width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
                      selected && { backgroundColor: '#fff' },
                    ]}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: selected ? '#0a3d73' : '#fff' }}>
                      {String(d.getUTCDate()).padStart(2, '0')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Segmented
          options={[
            { key: 'month' as CalView, label: 'Mês' },
            { key: 'week' as CalView, label: 'Semana' },
            { key: 'day' as CalView, label: 'Dia' },
          ]}
          value={view}
          onChange={setView}
        />
      </NavyHeader>

      {view === 'month' ? renderMonth() : view === 'week' ? renderWeek() : renderDay()}

      {/* Formulário de compromisso */}
      <SheetModal
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar compromisso' : 'Novo compromisso'}
      >
        <DateField label="Data" value={form?.data} onChange={(v) => setForm((f) => ({ ...f, data: v }))} />
        <Field
          label="Hora"
          value={form?.hora ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, hora: v }))}
          placeholder="HH:MM (opcional)"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Descrição"
          value={form?.desc ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, desc: v }))}
          placeholder="Ex.: Reunião da Comissão de Justiça"
        />
        <SelectField
          label="Categoria"
          value={(form?.cat as CatKey) ?? 'g'}
          options={CATS.map((c) => ({ key: c.key, label: c.label }))}
          onChange={(v) => setForm((f) => ({ ...f, cat: v }))}
          renderDot={(k) => catByKey(k).color}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 6 }}>
          {form?.id && !isPr ? (
            <SecondaryButton label="Excluir" danger onPress={() => setConfirmDel(true)} style={{ flex: 1 }} />
          ) : null}
          <PrimaryButton label="Salvar" onPress={salvarEvt} style={{ flex: 1.5 }} />
        </View>
      </SheetModal>

      <SheetModal visible={confirmDel} onClose={() => setConfirmDel(false)} title="Excluir compromisso">
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
          Este compromisso será removido permanentemente.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          <SecondaryButton label="Cancelar" onPress={() => setConfirmDel(false)} style={{ flex: 1 }} />
          <Pressable
            onPress={() => { setConfirmDel(false); excluirEvt(); }}
            style={{ flex: 1, borderRadius: 13, paddingVertical: 14, alignItems: 'center', backgroundColor: '#b42323' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }}>Excluir</Text>
          </Pressable>
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: '#fff', letterSpacing: -0.3, flexShrink: 1 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBtn: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  dayStrip: { flexDirection: 'row', marginBottom: 12 },
  weekHeadRow: { flexDirection: 'row', marginBottom: 6 },
  weekHeadCell: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11 },
  dayCell: { flex: 1, aspectRatio: 0.95, padding: 2 },
  dayInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 3, height: 5, marginTop: 3 },
  evtDot: { width: 4.5, height: 4.5, borderRadius: 3 },
  evtDotLg: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  evtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8 },
  weekEvt: {
    position: 'absolute',
    left: 2,
    right: 2,
    minHeight: 34,
    borderRadius: 6,
    borderLeftWidth: 3,
    padding: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
    paddingHorizontal: 4,
  },
});
