// Design tokens do handoff "Navy Hero" (design_handoff_mobile_app/README.md).
// Cores de status idênticas às do sistema web (js/app.js) — não alterar sem
// sincronizar com o desktop.

export const brand = {
  b50: '#eef4fb',
  b100: '#e8f0fa',
  b200: '#c7dbf0',
  b300: '#9db8d8',
  b500: '#1c5f9e',
  b600: '#0a3d73',
  b700: '#082f57',
};

export interface ThemeColors {
  bg: string;
  card: string;
  border: string;
  divider: string;
  input: string;
  inputBorder: string;
  text: string;
  textSecondary: string;
  muted: string;
  mutedLight: string;
  primary: string;
  /** Gradiente do cabeçalho navy [início, fim] */
  heroGradient: [string, string];
  navBar: string;
  navActive: string;
  navInactive: string;
  iconSquare: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warnBg: string;
}

export const light: ThemeColors = {
  bg: '#f2f5f9',
  card: '#ffffff',
  border: '#e3e9f1',
  divider: '#eef2f7',
  input: '#f5f7fb',
  inputBorder: '#e3e9f1',
  text: '#132a44',
  textSecondary: '#5a6b82',
  muted: '#8194ab',
  mutedLight: '#b4c0d0',
  primary: brand.b600,
  heroGradient: ['#0b4a86', '#082f57'],
  navBar: '#ffffff',
  navActive: brand.b600,
  navInactive: '#a0adbf',
  iconSquare: brand.b100,
  danger: '#b42323',
  dangerBg: '#fdf3f3',
  dangerBorder: '#f3cccc',
  warnBg: '#fdf0e4',
};

export const dark: ThemeColors = {
  bg: '#0f1826',
  card: '#16233a',
  border: '#26344c',
  divider: '#1d2c45',
  input: '#101b2c',
  inputBorder: '#26344c',
  text: '#eef2f8',
  textSecondary: '#a7b6cc',
  muted: '#7c8ba3',
  mutedLight: '#5a6b82',
  primary: '#bcd3ee',
  heroGradient: ['#0b3a6b', '#071f3c'],
  navBar: '#16233a',
  navActive: '#bcd3ee',
  navInactive: '#7c8ba3',
  iconSquare: 'rgba(188,211,238,.12)',
  danger: '#e88b8b',
  dangerBg: 'rgba(180,35,35,.16)',
  dangerBorder: 'rgba(180,35,35,.35)',
  warnBg: 'rgba(178,94,9,.16)',
};

export type StatusKey =
  | 'pendente'
  | 'em-analise'
  | 'aguardando-documentacao'
  | 'em-diligencia'
  | 'finalizado'
  | 'arquivado';

export interface StatusDef {
  key: StatusKey;
  label: string;
  /** Rótulo curto para o kanban/pills compactas */
  short: string;
  color: string;
  pillBg: string;
  colorDark: string;
  pillBgDark: string;
}

// Mesmos hex do js/app.js / handoff.
export const STATUS: StatusDef[] = [
  { key: 'pendente', label: 'Pendente', short: 'Pendente', color: '#b42323', pillBg: '#fbe9e9', colorDark: '#e88b8b', pillBgDark: 'rgba(180,35,35,.22)' },
  { key: 'em-analise', label: 'Em Análise', short: 'Em análise', color: '#b25e09', pillBg: '#fdf0e4', colorDark: '#e6a24a', pillBgDark: 'rgba(178,94,9,.22)' },
  { key: 'aguardando-documentacao', label: 'Aguardando Documentação', short: 'Aguard. Doc.', color: '#0a3d73', pillBg: '#e8f0fa', colorDark: '#bcd3ee', pillBgDark: 'rgba(28,95,158,.28)' },
  { key: 'em-diligencia', label: 'Em Diligência', short: 'Em diligência', color: '#7c3aad', pillBg: '#f5eefa', colorDark: '#c9a8e8', pillBgDark: 'rgba(124,58,173,.24)' },
  { key: 'finalizado', label: 'Finalizado', short: 'Finalizado', color: '#2f855a', pillBg: '#e9f5ee', colorDark: '#5cbe86', pillBgDark: 'rgba(47,133,90,.24)' },
  { key: 'arquivado', label: 'Arquivado', short: 'Arquivado', color: '#8194ab', pillBg: '#eef1f6', colorDark: '#7c8ba3', pillBgDark: 'rgba(129,148,171,.2)' },
];

export const statusByKey = (key: string | undefined): StatusDef =>
  STATUS.find((s) => s.key === key) ?? STATUS[0];

export type CatKey = 'g' | 'a' | 'e' | 'o' | 'r' | 'p' | 'u';

export interface CatDef {
  key: CatKey;
  label: string;
  color: string;
}

// Categorias de evento do calendário (VALID_CAT do js/app.js).
export const CATS: CatDef[] = [
  { key: 'g', label: 'Geral', color: '#1c5f9e' },
  { key: 'a', label: 'Audiência', color: '#2f855a' },
  { key: 'e', label: 'Escritório', color: '#0f766e' },
  { key: 'o', label: 'OAB', color: '#7c3aad' },
  { key: 'r', label: 'Reunião', color: '#1c5f9e' },
  { key: 'p', label: 'Término de prazo', color: '#b25e09' },
  { key: 'u', label: 'Urgente', color: '#b42323' },
];

export const catByKey = (key: string | undefined): CatDef =>
  CATS.find((c) => c.key === key) ?? CATS[0];

// KPI "Vencendo (≤5 dias)" usa este dourado (js/app.js).
export const KPI_VENCENDO_COLOR = '#c2a14d';

export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
};

export const shadow = {
  float: {
    shadowColor: '#0b2e55',
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  card: {
    shadowColor: '#0b2e55',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#0a3d73',
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
};
