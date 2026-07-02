// Camada de dados: espelha o acesso do web ao Firestore (js/firestoreHelper.js
// + js/app.js). Documentos gravados com doc id = String(rec.id) e o objeto
// completo, para manter compatibilidade total com o desktop.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auth, db } from '../lib/firebase';
import { generateNotifications, Notif, unreadCount } from '../lib/model';
import {
  Emissor,
  EventoCal,
  HistoricoEntry,
  Lei,
  MainCfg,
  Modelo,
  Parecer,
  Processo,
  Usuario,
} from '../lib/types';

interface DataValue {
  user: User | null;
  authReady: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  userName: string;

  processos: Processo[];
  eventos: EventoCal[];
  leis: Lei[];
  usuarios: Usuario[];
  emissores: Emissor[];
  modelos: Modelo[];
  pareceres: Parecer[];
  cfg: MainCfg | null;
  loading: boolean;

  notifications: Notif[];
  unread: number;
  markAllRead: () => Promise<void>;

  putRecord: <T extends { id: number | string }>(colecao: string, rec: T) => Promise<void>;
  deleteRecord: (colecao: string, id: number | string) => Promise<void>;
  saveProcesso: (rec: Processo, old: Processo | null) => Promise<void>;
  loadHistorico: (processoId: number | string) => Promise<HistoricoEntry[]>;
}

const DataContext = createContext<DataValue | null>(null);

// Campos rastreados no histórico de alterações (getChanges do web).
const TRACK_FIELDS: (keyof Processo)[] = [
  'num', 'int', 'tipo', 'obj', 'acao', 'stat', 'setorOrigem', 'dest', 'ent', 'prazo', 'saida',
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [eventos, setEventos] = useState<EventoCal[]>([]);
  const [leis, setLeis] = useState<Lei[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [emissores, setEmissores] = useState<Emissor[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [pareceres, setPareceres] = useState<Parecer[]>([]);
  const [cfg, setCfg] = useState<MainCfg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

  useEffect(() => {
    if (!user) {
      setProcessos([]); setEventos([]); setLeis([]); setUsuarios([]);
      setEmissores([]); setModelos([]); setPareceres([]); setCfg(null);
      setLoading(true);
      return;
    }
    const subs: (() => void)[] = [];
    const listen = <T,>(col: string, set: (rows: T[]) => void) => {
      subs.push(
        onSnapshot(
          collection(db, col),
          (snap) => set(snap.docs.map((d) => d.data() as T)),
          (err) => console.warn(`Erro ao escutar ${col}:`, err)
        )
      );
    };
    listen<Processo>('processos', (rows) => {
      setProcessos(rows.sort((a, b) => (b.id || 0) - (a.id || 0)));
      setLoading(false);
    });
    listen<EventoCal>('calendario', setEventos);
    listen<Lei>('leis', (rows) => setLeis(rows.sort((a, b) => (b.id || 0) - (a.id || 0))));
    listen<Usuario>('users', setUsuarios);
    listen<Emissor>('emissores', setEmissores);
    listen<Modelo>('modelos', setModelos);
    listen<Parecer>('pareceres', setPareceres);
    subs.push(
      onSnapshot(
        doc(db, 'config', 'main_cfg'),
        (snap) => setCfg(((snap.data() as { value?: MainCfg } | undefined)?.value) ?? {}),
        (err) => console.warn('Erro ao escutar config:', err)
      )
    );
    return () => subs.forEach((u) => u());
  }, [user]);

  const userName = useMemo(() => {
    if (!user) return '';
    return user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
  }, [user]);

  const login = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const putRecord = useCallback(async <T extends { id: number | string }>(colecao: string, rec: T) => {
    await setDoc(doc(db, colecao, String(rec.id)), rec as Record<string, unknown>);
  }, []);

  const deleteRecord = useCallback(async (colecao: string, id: number | string) => {
    await deleteDoc(doc(db, colecao, String(id)));
  }, []);

  const logHistorico = useCallback(
    async (processoId: number | string, processoNum: string, acao: HistoricoEntry['acao'], campos: HistoricoEntry['campos']) => {
      try {
        const entry: HistoricoEntry = {
          id: Date.now(),
          processoId: String(processoId),
          processoNum: processoNum || String(processoId),
          acao,
          usuario: userName,
          timestamp: new Date().toISOString(),
          campos,
        };
        await setDoc(doc(db, 'historico', String(entry.id)), entry);
      } catch (e) {
        console.warn('Erro ao registrar histórico:', e);
      }
    },
    [userName]
  );

  const saveProcesso = useCallback(
    async (rec: Processo, old: Processo | null) => {
      await putRecord('processos', rec);
      if (old) {
        const campos = TRACK_FIELDS.filter(
          (f) => String(old[f] ?? '') !== String(rec[f] ?? '')
        ).map((f) => ({ campo: f, de: String(old[f] ?? ''), para: String(rec[f] ?? '') }));
        await logHistorico(rec.id, rec.num, 'editado', campos);
      } else {
        await logHistorico(rec.id, rec.num, 'criado', []);
      }
    },
    [putRecord, logHistorico]
  );

  const loadHistorico = useCallback(async (processoId: number | string): Promise<HistoricoEntry[]> => {
    try {
      const snap = await getDocs(
        query(collection(db, 'historico'), where('processoId', '==', String(processoId)))
      );
      return snap.docs
        .map((d) => d.data() as HistoricoEntry)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (e) {
      console.warn('Erro ao carregar histórico:', e);
      return [];
    }
  }, []);

  const notifications = useMemo(
    () => generateNotifications(processos, eventos, cfg),
    [processos, eventos, cfg]
  );
  const unread = useMemo(() => unreadCount(notifications, cfg), [notifications, cfg]);

  const markAllRead = useCallback(async () => {
    const ids = notifications.map((n) => n.id);
    try {
      await updateDoc(doc(db, 'config', 'main_cfg'), { 'value.readNotifications': ids });
    } catch {
      // Documento pode não existir ainda — cria com merge preservando o shape do web.
      await setDoc(
        doc(db, 'config', 'main_cfg'),
        { key: 'main_cfg', value: { readNotifications: ids } },
        { merge: true }
      );
    }
  }, [notifications]);

  const value: DataValue = {
    user, authReady, login, logout, userName,
    processos, eventos, leis, usuarios, emissores, modelos, pareceres, cfg, loading,
    notifications, unread, markAllRead,
    putRecord, deleteRecord, saveProcesso, loadHistorico,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de DataProvider');
  return ctx;
}
