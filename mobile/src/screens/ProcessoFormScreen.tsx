import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DateField, Field, FieldLabel, SelectField } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { useData } from '../data/DataContext';
import { ymd, todayUTC } from '../lib/dates';
import { Processo, SETORES, TipoProcesso } from '../lib/types';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts, STATUS, StatusKey, statusByKey } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProcessoForm'>;

export function ProcessoFormScreen() {
  const { colors, isDark } = useTheme();
  const { processos, emissores, saveProcesso } = useData();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const existing = useMemo(
    () => processos.find((p) => p.id === route.params?.id) ?? null,
    [processos, route.params?.id]
  );

  const [num, setNum] = useState(existing?.num ?? '');
  const [int, setInt] = useState(existing?.int ?? '');
  const [tipo, setTipo] = useState<TipoProcesso>(existing?.tipo ?? 'administrativo');
  const [obj, setObj] = useState(existing?.obj ?? '');
  const [acao, setAcao] = useState(existing?.acao ?? '');
  const [setorOrigem, setSetorOrigem] = useState(existing?.setorOrigem ?? '');
  const [dest, setDest] = useState(existing?.dest ?? '');
  const [ent, setEnt] = useState(existing?.ent ?? ymd(todayUTC()));
  const [prazo, setPrazo] = useState(existing?.prazo ?? '');
  const [saida, setSaida] = useState(existing?.saida ?? '');
  const [emissorId, setEmissorId] = useState(existing?.emissorId ? String(existing.emissorId) : '');
  const [stat, setStat] = useState<StatusKey>(existing?.stat ?? 'pendente');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    setErro('');
    if (!num.trim() || !int.trim()) {
      setErro('Nº do processo e Interessado são obrigatórios.');
      return;
    }
    setBusy(true);
    const rec: Processo = {
      id: existing ? existing.id : Date.now(),
      num: num.trim(),
      int: int.trim(),
      tipo,
      obj: obj.trim(),
      acao: acao.trim(),
      stat,
      setorOrigem,
      dest,
      ent,
      prazo,
      saida,
      emissorId,
      docId: existing?.docId ?? null,
    };
    try {
      await saveProcesso(rec, existing);
      navigation.goBack();
    } catch (e) {
      console.warn('Erro ao salvar processo:', e);
      setErro('Erro ao salvar. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.title}>{existing ? 'Editar processo' : 'Novo processo'}</Text>
        <Text style={styles.sub}>
          {existing ? `Nº ${existing.num}` : 'Cadastre um processo administrativo ou judicial'}
        </Text>
      </NavyHeader>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Nº do processo" value={num} onChangeText={setNum} placeholder="2024/0000" />
          <Field label="Interessado" value={int} onChangeText={setInt} placeholder="Ex.: Secretaria Municipal de…" />

          <FieldLabel label="Tipo" />
          <View style={styles.tipoRow}>
            {(['administrativo', 'judicial'] as TipoProcesso[]).map((t) => {
              const active = tipo === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTipo(t)}
                  style={[
                    styles.tipoBtn,
                    {
                      backgroundColor: active ? (isDark ? '#1c5f9e' : '#0a3d73') : colors.card,
                      borderColor: active ? 'transparent' : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: active ? '#fff' : colors.textSecondary }}>
                    {t === 'administrativo' ? 'Administrativo' : 'Judicial'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Field label="Objeto" value={obj} onChangeText={setObj} placeholder="Descreva o objeto do processo…" multiline />
          <Field label="Ação tomada" value={acao} onChangeText={setAcao} placeholder="Opcional" multiline />

          <SelectField
            label="Setor de origem"
            value={setorOrigem || undefined}
            options={SETORES.map((s) => ({ key: s, label: s }))}
            onChange={setSetorOrigem}
          />
          <SelectField
            label="Setor enviado"
            value={dest || undefined}
            options={SETORES.map((s) => ({ key: s, label: s }))}
            onChange={setDest}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField label="Entrada" value={ent} onChange={setEnt} style={{ flex: 1 }} />
            <DateField label="Prazo final" value={prazo} onChange={setPrazo} style={{ flex: 1 }} />
          </View>
          {existing ? <DateField label="Saída" value={saida} onChange={setSaida} /> : null}

          <SelectField
            label="Emissor da ficha"
            value={emissorId || undefined}
            options={[{ key: '', label: 'Usuário logado' }, ...emissores.map((e) => ({ key: String(e.id), label: e.name }))]}
            onChange={setEmissorId}
            placeholder="Usuário logado"
          />

          <SelectField
            label="Status inicial"
            value={stat}
            options={STATUS.map((s) => ({ key: s.key, label: s.label }))}
            onChange={(v) => setStat(v)}
            renderDot={(k) => (isDark ? statusByKey(k).colorDark : statusByKey(k).color)}
          />

          {erro ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.danger, marginBottom: 12 }}>
              {erro}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <SecondaryButton label="Cancelar" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
            <PrimaryButton label="Salvar processo" onPress={salvar} loading={busy} style={{ flex: 1.4 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', marginBottom: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 22, color: '#fff', letterSpacing: -0.4 },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: '#a8c2df', marginTop: 3 },
  tipoRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tipoBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
