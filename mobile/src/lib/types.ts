// Tipos que espelham o modelo de dados do sistema web (js/app.js).
// Documentos são gravados no Firestore com doc id = String(rec.id)
// (compatível com o dbHelper.put do web em js/firestoreHelper.js).
import { CatKey, StatusKey } from '../theme/tokens';

export type TipoProcesso = 'administrativo' | 'judicial';

export interface Processo {
  id: number;
  num: string;
  int: string; // interessado
  tipo: TipoProcesso;
  obj: string; // objeto
  acao?: string; // ação tomada
  stat: StatusKey;
  setorOrigem?: string;
  dest?: string; // setor enviado
  ent?: string; // entrada YYYY-MM-DD
  prazo?: string; // prazo final YYYY-MM-DD
  saida?: string; // YYYY-MM-DD
  emissorId?: string;
  docId?: number | null;
  anotacoes?: Anotacao[];
}

/** Anotação/pendência de um processo (mesmo formato do web: id, usuario, dt, texto). */
export interface Anotacao {
  id: number;
  usuario: string;
  dt: string; // ISO
  texto: string;
}

export interface EventoCal {
  id: number | string; // eventos derivados de prazo usam prefixo "pr-" no web
  data: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  desc: string;
  cat: CatKey;
}

export interface Lei {
  id: number;
  numero: string;
  ano: string | number;
  tipo: string; // Lei Federal | Lei Estadual | Lei Municipal | Decreto | Portaria | Outro
  ementa: string;
  arquivo?: { name: string; data: string } | null;
}

export interface Usuario {
  id: number | string;
  name: string;
  login: string;
  role: string; // 'admin' | 'user'
}

export interface Emissor {
  id: number | string;
  name: string;
}

export interface Modelo {
  id: number;
  name: string;
  data: string; // dataURL base64 (.docx)
}

export interface Parecer {
  id: number;
  processoId: number | string;
  processoNum: string;
  status: 'rascunho' | 'emitido';
  ementa: string;
  delta: unknown;
  textoBusca: string;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string | null;
  emitidoEm: string | null;
  emitidoPor: string | null;
  reabertoEm?: string | null;
  reabertoPor?: string | null;
}

export type AcaoHistorico =
  | 'criado'
  | 'editado'
  | 'excluido'
  | 'parecer-criado'
  | 'parecer-editado'
  | 'parecer-emitido'
  | 'parecer-reaberto';

export interface HistoricoEntry {
  id: number;
  processoId: string;
  processoNum: string;
  acao: AcaoHistorico;
  usuario: string;
  timestamp: string; // ISO
  campos: { campo: string; de: string; para: string }[];
}

/** Documento config/main_cfg do web ({ key: 'main_cfg', value: {...} }). */
export interface MainCfg {
  readNotifications?: string[];
  dismissedNotifications?: string[];
  [k: string]: unknown;
}

// Mesma lista fixa do web (js/app.js, const SETORES) já ordenada.
export const SETORES = [
  'Comissões',
  'Controladoria',
  'CPL',
  'Depto. Financeiro',
  'Diretoria Geral',
  'Gabinete Vereador',
  'Presidência',
  'Recursos Humanos',
  'Secretaria Geral',
  'Outros',
].sort();

export const TIPOS_LEI = ['Lei Federal', 'Lei Estadual', 'Lei Municipal', 'Decreto', 'Portaria', 'Outro'];
