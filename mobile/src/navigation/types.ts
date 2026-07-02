import { NavigatorScreenParams } from '@react-navigation/native';
import { StatusKey } from '../theme/tokens';

export type ProcFilterParam = { status?: StatusKey; prazo?: 'vencido' | 'alerta' } | undefined;

export type TabParamList = {
  Inicio: undefined;
  Processos: ProcFilterParam;
  Agenda: { date?: string } | undefined;
  Alertas: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ProcessoDetalhe: { id: number };
  ProcessoForm: { id?: number } | undefined;
  Documentos: undefined;
  Leis: undefined;
  Configuracoes: undefined;
};
