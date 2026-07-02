import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmSheet, Field, SelectField, SheetModal } from '../components/form';
import { NavyHeader } from '../components/NavyHeader';
import { Card, PrimaryButton, Pill, SecondaryButton } from '../components/ui';
import { useData } from '../data/DataContext';
import { db } from '../lib/firebase';
import { diffDays, fmtBR, parseYMD, todayUTC } from '../lib/dates';
import { readFileAsText, saveAndShare } from '../lib/files';
import { Emissor, Usuario } from '../lib/types';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { fonts, statusByKey } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mesmos stores do backup do web (js/app.js).
const STORES = [
  'users', 'processos', 'calendario', 'documentos', 'versoes',
  'modelos', 'emissores', 'leis', 'pareceres', 'parecerVersoes',
] as const;

async function getAll(col: string): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => d.data());
}

async function clearCollection(col: string): Promise<void> {
  const snap = await getDocs(collection(db, col));
  // Batches de até 400 operações (limite do Firestore é 500).
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
}

export function ConfiguracoesScreen() {
  const { colors, isDark } = useTheme();
  const { usuarios, emissores, processos, putRecord, deleteRecord } = useData();
  const navigation = useNavigation<Nav>();

  const [userForm, setUserForm] = useState<Partial<Usuario> | null>(null);
  const [emissorForm, setEmissorForm] = useState<Partial<Emissor> | null>(null);
  const [confirm, setConfirm] = useState<null | 'delUser' | 'delEmissor' | 'restore' | 'wipe' | 'wipe2'>(null);
  const [restoreData, setRestoreData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const salvarUsuario = async () => {
    if (!userForm?.name?.trim() || !userForm?.login?.trim()) return;
    const existente = usuarios.find((u) => u.id === userForm.id);
    const rec = {
      ...(existente ?? { salt: 'firebase-auth' }), // salt evita o reset de usuários legado do web
      id: userForm.id ?? Date.now(),
      name: userForm.name.trim(),
      login: userForm.login.trim(),
      role: userForm.role || 'user',
    };
    setUserForm(null);
    await putRecord('users', rec);
  };

  const salvarEmissor = async () => {
    if (!emissorForm?.name?.trim()) return;
    const rec = { id: emissorForm.id ?? Date.now(), name: emissorForm.name.trim() };
    setEmissorForm(null);
    await putRecord('emissores', rec);
  };

  const exportCSV = async () => {
    setMsg('');
    if (processos.length === 0) {
      setMsg('Nenhum processo para exportar.');
      return;
    }
    setBusy('csv');
    try {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const headers = ['Nº Processo', 'Tipo', 'Interessado', 'Objeto', 'Ação Tomada', 'Status', 'Setor de Origem', 'Setor Enviado', 'Data Entrada', 'Prazo Final', 'Data Saída', 'Dias Tramitação'];
      const rows = processos.map((p) =>
        [
          esc(p.num),
          esc(p.tipo ? p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1) : ''),
          esc(p.int),
          esc(p.obj),
          esc(p.acao),
          esc(statusByKey(p.stat).label),
          esc(p.setorOrigem),
          esc(p.dest),
          esc(p.ent ? fmtBR(p.ent) : ''),
          esc(p.prazo ? fmtBR(p.prazo) : ''),
          esc(p.saida ? fmtBR(p.saida) : ''),
          esc(
            p.ent && p.saida
              ? diffDays(parseYMD(p.ent)!, parseYMD(p.saida)!)
              : p.ent
                ? diffDays(parseYMD(p.ent)!, todayUTC())
                : ''
          ),
        ].join(',')
      );
      const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
      await saveAndShare(`processos_${new Date().toISOString().slice(0, 10)}.csv`, csv, { mimeType: 'text/csv' });
    } catch (e) {
      console.warn('Erro no CSV:', e);
      setMsg('Falha ao exportar CSV.');
    }
    setBusy('');
  };

  const baixarBackup = async () => {
    setMsg('');
    setBusy('backup');
    try {
      const backup: Record<string, unknown> = {};
      for (const s of STORES) backup[s] = await getAll(s);
      const cfgSnap = await getAll('config');
      const main = cfgSnap.find((c) => (c as { key?: string }).key === 'main_cfg') as { value?: unknown } | undefined;
      backup.config = main?.value;
      await saveAndShare(
        `juriscontrol_backup_${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        { mimeType: 'application/json' }
      );
    } catch (e) {
      console.warn('Erro no backup:', e);
      setMsg('Falha ao gerar o backup.');
    }
    setBusy('');
  };

  const escolherBackup = async () => {
    setMsg('');
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const text = await readFileAsText(res.assets[0].uri);
      const data = JSON.parse(text);
      if (!data.processos || !data.users) throw new Error('inválido');
      setRestoreData(data);
      setConfirm('restore');
    } catch {
      setMsg('Arquivo de backup inválido ou corrompido.');
    }
  };

  const restaurar = async () => {
    if (!restoreData) return;
    setBusy('restore');
    setMsg('');
    try {
      for (const store of STORES) {
        const items = restoreData[store] as { id?: number | string; key?: string }[] | undefined;
        if (!items) continue;
        await clearCollection(store);
        for (const item of items) {
          const id = item.id ?? item.key;
          if (id == null) continue;
          await setDoc(doc(db, store, String(id)), item);
        }
      }
      if (restoreData.config) {
        await setDoc(doc(db, 'config', 'main_cfg'), { key: 'main_cfg', value: restoreData.config });
      }
      setMsg('Backup restaurado com sucesso.');
    } catch (e) {
      console.warn('Erro ao restaurar:', e);
      setMsg('Erro ao restaurar o backup.');
    }
    setRestoreData(null);
    setBusy('');
  };

  const limparTudo = async () => {
    setBusy('wipe');
    setMsg('');
    try {
      for (const store of STORES) await clearCollection(store);
      await clearCollection('historico');
      setMsg('Todos os dados foram apagados.');
    } catch (e) {
      console.warn('Erro ao limpar dados:', e);
      setMsg('Erro ao limpar os dados.');
    }
    setBusy('');
  };

  const roleLabel = (r?: string) => (r === 'admin' ? 'Admin' : 'Editor');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavyHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Configurações</Text>
          <View style={{ width: 40 }} />
        </View>
      </NavyHeader>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {msg ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary, marginBottom: 12 }}>
            {msg}
          </Text>
        ) : null}

        {/* Usuários */}
        <Card>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Usuários</Text>
            <Pressable onPress={() => setUserForm({ role: 'user' })} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>+ Adicionar</Text>
            </Pressable>
          </View>
          {usuarios.length === 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted }}>
              Nenhum usuário cadastrado.
            </Text>
          ) : (
            usuarios.map((u, i) => (
              <Pressable
                key={String(u.id)}
                onPress={() => setUserForm({ ...u })}
                style={[styles.userRow, i < usuarios.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}
              >
                <View style={[styles.userAvatar, { backgroundColor: colors.iconSquare }]}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>
                    {(u.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>{u.name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 1 }}>
                    {u.login}
                  </Text>
                </View>
                <Pill
                  label={roleLabel(u.role)}
                  color={u.role === 'admin' ? colors.primary : colors.muted}
                  bg={u.role === 'admin' ? colors.iconSquare : (isDark ? 'rgba(255,255,255,.07)' : '#eef1f6')}
                />
              </Pressable>
            ))
          )}
        </Card>

        {/* Emissores */}
        <Card style={{ marginTop: 14 }}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Emissores</Text>
            <Pressable onPress={() => setEmissorForm({})} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>+ Adicionar</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {emissores.length === 0 ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted }}>
                Nenhum emissor cadastrado.
              </Text>
            ) : (
              emissores.map((e) => (
                <Pressable
                  key={String(e.id)}
                  onPress={() => setEmissorForm({ ...e })}
                  style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,.07)' : '#eef1f6' }]}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary }}>
                    {e.name}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </Card>

        {/* Backup e restauração */}
        <Card style={{ marginTop: 14 }}>
          <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>Backup e restauração</Text>
          <SecondaryButton
            label={busy === 'csv' ? 'Exportando…' : 'Exportar processos (CSV)'}
            onPress={exportCSV}
          />
          <View style={{ height: 10 }} />
          <SecondaryButton
            label={busy === 'backup' ? 'Gerando…' : 'Baixar backup (.json)'}
            onPress={baixarBackup}
          />
          <View style={{ height: 10 }} />
          <SecondaryButton
            label={busy === 'restore' ? 'Restaurando…' : 'Restaurar backup'}
            onPress={escolherBackup}
          />
        </Card>

        {/* Danger zone */}
        <View
          style={[
            styles.danger,
            { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
          ]}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>Ações avançadas</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 6, lineHeight: 18 }}>
            Apaga todos os processos, eventos, leis, documentos e configurações do sistema (o mesmo banco usado
            pelo desktop). Esta ação é irreversível — faça um backup antes.
          </Text>
          <Pressable
            onPress={() => setConfirm('wipe')}
            style={[styles.dangerBtn, { borderColor: colors.danger }]}
            disabled={busy === 'wipe'}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.danger }}>
              {busy === 'wipe' ? 'Limpando…' : 'Limpar dados do sistema'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Form usuário */}
      <SheetModal
        visible={!!userForm}
        onClose={() => setUserForm(null)}
        title={userForm?.id ? 'Editar usuário' : 'Adicionar usuário'}
      >
        <Field
          label="Nome completo"
          value={userForm?.name ?? ''}
          onChangeText={(v) => setUserForm((f) => ({ ...f, name: v }))}
        />
        <Field
          label="Login (e-mail)"
          value={userForm?.login ?? ''}
          onChangeText={(v) => setUserForm((f) => ({ ...f, login: v }))}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <SelectField
          label="Cargo"
          value={(userForm?.role as string) ?? 'user'}
          options={[
            { key: 'user', label: 'Usuário' },
            { key: 'admin', label: 'Admin' },
          ]}
          onChange={(v) => setUserForm((f) => ({ ...f, role: v }))}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          {userForm?.id ? (
            <SecondaryButton label="Excluir" danger onPress={() => setConfirm('delUser')} style={{ flex: 1 }} />
          ) : null}
          <PrimaryButton label="Salvar" onPress={salvarUsuario} style={{ flex: 1.5 }} />
        </View>
      </SheetModal>

      {/* Form emissor */}
      <SheetModal
        visible={!!emissorForm}
        onClose={() => setEmissorForm(null)}
        title={emissorForm?.id ? 'Editar emissor' : 'Adicionar emissor'}
      >
        <Field
          label="Nome do emissor"
          value={emissorForm?.name ?? ''}
          onChangeText={(v) => setEmissorForm((f) => ({ ...f, name: v }))}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          {emissorForm?.id ? (
            <SecondaryButton label="Excluir" danger onPress={() => setConfirm('delEmissor')} style={{ flex: 1 }} />
          ) : null}
          <PrimaryButton label="Salvar" onPress={salvarEmissor} style={{ flex: 1.5 }} />
        </View>
      </SheetModal>

      <ConfirmSheet
        visible={confirm === 'delUser'}
        onClose={() => setConfirm(null)}
        title="Excluir usuário"
        message={`O usuário "${userForm?.name ?? ''}" será removido da lista. (O acesso via Firebase Auth é gerenciado à parte.)`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          const id = userForm?.id;
          setUserForm(null);
          if (id != null) await deleteRecord('users', id);
        }}
      />
      <ConfirmSheet
        visible={confirm === 'delEmissor'}
        onClose={() => setConfirm(null)}
        title="Excluir emissor"
        message={`O emissor "${emissorForm?.name ?? ''}" será removido.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          const id = emissorForm?.id;
          setEmissorForm(null);
          if (id != null) await deleteRecord('emissores', id);
        }}
      />
      <ConfirmSheet
        visible={confirm === 'restore'}
        onClose={() => { setConfirm(null); setRestoreData(null); }}
        title="Restaurar backup"
        message="Restaurar um backup substituirá TODOS os dados atuais (inclusive os usados pelo desktop). Deseja continuar?"
        confirmLabel="Restaurar"
        onConfirm={restaurar}
      />
      <ConfirmSheet
        visible={confirm === 'wipe'}
        onClose={() => setConfirm(null)}
        title="Limpar dados do sistema"
        message="ATENÇÃO: todos os processos, eventos, leis, documentos, pareceres e usuários serão apagados do banco compartilhado com o desktop. Esta ação é IRREVERSÍVEL."
        confirmLabel="Continuar"
        onConfirm={() => setConfirm('wipe2')}
      />
      <ConfirmSheet
        visible={confirm === 'wipe2'}
        onClose={() => setConfirm(null)}
        title="Confirmar exclusão total"
        message="Última confirmação: apagar TODOS os dados do JurisControl agora?"
        confirmLabel="Apagar tudo"
        onConfirm={limparTudo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 19, color: '#fff', letterSpacing: -0.3 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  danger: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 14,
  },
});
