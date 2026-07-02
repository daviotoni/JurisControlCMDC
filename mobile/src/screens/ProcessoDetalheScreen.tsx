import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmSheet, SheetModal } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { Card, GroupLabel, Pill, PrimaryButton, SecondaryButton, StatusPill } from '../components/ui';
import { useData } from '../data/DataContext';
import { db } from '../lib/firebase';
import { fmtBR } from '../lib/dates';
import { prazoInfo } from '../lib/model';
import { AcaoHistorico, HistoricoEntry } from '../lib/types';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProcessoDetalhe'>;

const ACAO_LABEL: Record<AcaoHistorico, string> = {
  criado: 'Processo criado',
  editado: 'Processo editado',
  excluido: 'Processo excluído',
  'parecer-criado': 'Parecer criado',
  'parecer-editado': 'Parecer editado',
  'parecer-emitido': 'Parecer emitido',
  'parecer-reaberto': 'Parecer reaberto para edição',
};

// Rótulos dos campos rastreados (fieldLabels do web).
const FIELD_LABELS: Record<string, string> = {
  num: 'Nº Processo', int: 'Interessado', tipo: 'Tipo', obj: 'Objeto', acao: 'Ação Tomada',
  stat: 'Status', setorOrigem: 'Setor de Origem', dest: 'Setor Enviado',
  ent: 'Data de Entrada', prazo: 'Prazo Final', saida: 'Data de Saída',
};

export function ProcessoDetalheScreen() {
  const { colors, isDark } = useTheme();
  const { processos, emissores, pareceres, userName, deleteRecord, loadHistorico, putRecord } = useData();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const p = processos.find((x) => x.id === route.params.id);
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [parecerOpen, setParecerOpen] = useState(false);

  useEffect(() => {
    if (p) loadHistorico(p.id).then(setHistorico);
  }, [p?.id]);

  const emissorNome = useMemo(() => {
    if (!p?.emissorId) return 'Usuário logado';
    return emissores.find((e) => String(e.id) === String(p.emissorId))?.name ?? '—';
  }, [p?.emissorId, emissores]);

  const parecer = useMemo(
    () => (p ? pareceres.find((z) => String(z.processoId) === String(p.id)) : undefined),
    [pareceres, p?.id]
  );

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavyHeader>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: 10 }}>
            Processo não encontrado
          </Text>
        </NavyHeader>
      </View>
    );
  }

  const info = prazoInfo(p);
  const bannerVermelho = info.vencido || info.alerta;

  const excluir = async () => {
    try {
      // Exclusão em cascata espelhando o web: pareceres + versões vinculados.
      const meusPareceres = pareceres.filter((z) => String(z.processoId) === String(p.id));
      for (const pz of meusPareceres) {
        const versoes = await getDocs(query(collection(db, 'parecerVersoes'), where('parecerId', '==', pz.id)));
        for (const v of versoes.docs) await deleteRecord('parecerVersoes', v.id);
        await deleteRecord('pareceres', pz.id);
      }
      await deleteRecord('processos', p.id);
      await putRecord('historico', {
        id: Date.now(),
        processoId: String(p.id),
        processoNum: p.num,
        acao: 'excluido',
        usuario: userName,
        timestamp: new Date().toISOString(),
        campos: [],
      } as HistoricoEntry & { id: number });
      navigation.goBack();
    } catch (e) {
      console.warn('Erro ao excluir processo:', e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.iconBtn}>
            <Feather name="more-vertical" size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.kicker}>
          Processo {p.tipo === 'judicial' ? 'judicial' : 'administrativo'}
        </Text>
        <Text style={styles.num}>Nº {p.num}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <StatusPill stat={p.stat} />
          <Pill
            label={p.tipo === 'judicial' ? 'Judicial' : 'Administrativo'}
            color="#e8f0fa"
            bg="rgba(255,255,255,.14)"
          />
        </View>
      </NavyHeader>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {p.prazo && info.dias !== null ? (
          <View
            style={[
              styles.prazoBanner,
              {
                backgroundColor: bannerVermelho
                  ? (isDark ? 'rgba(180,35,35,.18)' : '#fbe9e9')
                  : (isDark ? 'rgba(28,95,158,.2)' : '#e8f0fa'),
              },
            ]}
          >
            <Feather
              name="clock"
              size={19}
              color={bannerVermelho ? (isDark ? '#e88b8b' : '#b42323') : colors.primary}
            />
            <View>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 14.5,
                  color: bannerVermelho ? (isDark ? '#e88b8b' : '#b42323') : colors.primary,
                }}
              >
                {info.vencido
                  ? `Vencido há ${Math.abs(info.dias)} dia${Math.abs(info.dias) === 1 ? '' : 's'}`
                  : info.dias === 0
                    ? 'Prazo vence hoje'
                    : `Faltam ${info.dias} dia${info.dias === 1 ? '' : 's'}`}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                Prazo final: {fmtBR(p.prazo)}
              </Text>
            </View>
          </View>
        ) : null}

        <Card style={{ marginTop: 12 }}>
          <GroupLabel label="Interessado" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 4 }}>{p.int}</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.muted }]}>Setor de origem</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{p.setorOrigem || '—'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.muted }]}>Setor enviado</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{p.dest || '—'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.muted }]}>Entrada</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{fmtBR(p.ent)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.muted }]}>Emissor</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{emissorNome}</Text>
            </View>
            {p.saida ? (
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.muted }]}>Saída</Text>
                <Text style={[styles.gridValue, { color: colors.text }]}>{fmtBR(p.saida)}</Text>
              </View>
            ) : null}
          </View>

          <GroupLabel label="Objeto" style={{ marginTop: 14 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
            {p.obj || '—'}
          </Text>

          {p.acao ? (
            <>
              <GroupLabel label="Ação tomada" style={{ marginTop: 14 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
                {p.acao}
              </Text>
            </>
          ) : null}
        </Card>

        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 20, marginBottom: 10 }}>
          Histórico
        </Text>
        <Card>
          {historico.length === 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted }}>
              Sem registros de histórico.
            </Text>
          ) : (
            historico.map((h, i) => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  {i < historico.length - 1 ? (
                    <View style={[styles.timelineLine, { backgroundColor: colors.divider }]} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < historico.length - 1 ? 16 : 0 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.text }}>
                    {ACAO_LABEL[h.acao] ?? h.acao}
                  </Text>
                  {h.campos?.length ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                      {h.campos.map((c) => FIELD_LABELS[c.campo] ?? c.campo).join(', ')}
                    </Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    {new Date(h.timestamp).toLocaleString('pt-BR')} · {h.usuario}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <SecondaryButton
            label="Editar"
            onPress={() => navigation.navigate('ProcessoForm', { id: p.id })}
            style={{ flex: 1 }}
          />
          <PrimaryButton label="Emitir parecer" onPress={() => setParecerOpen(true)} style={{ flex: 1 }} />
        </View>
      </ScrollView>

      {/* Menu kebab */}
      <SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} title={`Processo ${p.num}`}>
        <Pressable
          onPress={() => { setMenuOpen(false); navigation.navigate('ProcessoForm', { id: p.id }); }}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
        >
          <Feather name="edit-2" size={17} color={colors.text} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.text }}>Editar processo</Text>
        </Pressable>
        <Pressable
          onPress={() => { setMenuOpen(false); setConfirmDel(true); }}
          style={[styles.menuRow, { borderBottomWidth: 0 }]}
        >
          <Feather name="trash-2" size={17} color={colors.danger} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.danger }}>Excluir processo</Text>
        </Pressable>
      </SheetModal>

      <ConfirmSheet
        visible={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Excluir processo"
        message={`O processo ${p.num} e os pareceres vinculados serão removidos permanentemente. Deseja continuar?`}
        confirmLabel="Excluir"
        onConfirm={excluir}
      />

      {/* Parecer: status/consulta (edição do texto é feita no sistema web) */}
      <SheetModal visible={parecerOpen} onClose={() => setParecerOpen(false)} title="Parecer jurídico">
        {parecer ? (
          <View style={{ paddingBottom: 6 }}>
            <Pill
              label={parecer.status === 'emitido' ? 'Emitido' : 'Rascunho'}
              color={parecer.status === 'emitido' ? '#2f855a' : '#b25e09'}
              bg={parecer.status === 'emitido' ? '#e9f5ee' : '#fdf0e4'}
            />
            {parecer.ementa ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, marginTop: 12, lineHeight: 19 }}>
                {parecer.ementa}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 10 }}>
              {parecer.status === 'emitido'
                ? `Emitido em ${new Date(parecer.emitidoEm!).toLocaleDateString('pt-BR')} por ${parecer.emitidoPor}`
                : `Criado em ${new Date(parecer.criadoEm).toLocaleDateString('pt-BR')} por ${parecer.criadoPor}`}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 17 }}>
              A redação e emissão do parecer são feitas no editor do sistema web (desktop).
            </Text>
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, lineHeight: 20, paddingBottom: 6 }}>
            Este processo ainda não possui parecer. A redação e emissão de pareceres são feitas no editor do
            sistema web (desktop); o parecer aparecerá aqui e em Documentos → Pareceres.
          </Text>
        )}
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { fontFamily: fonts.medium, fontSize: 12, color: '#a8c2df' },
  num: { fontFamily: fonts.bold, fontSize: 23, color: '#fff', letterSpacing: -0.4, marginTop: 3 },
  prazoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 12,
  },
  gridItem: { width: '50%', paddingRight: 8 },
  gridLabel: { fontFamily: fonts.regular, fontSize: 11.5 },
  gridValue: { fontFamily: fonts.semibold, fontSize: 13.5, marginTop: 2 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 3 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
});
