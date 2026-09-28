// Design tokens — linguagem "tinta", a mesma do sistema web (bloco VISUAL NOVO
// do style.css, html.ui-v3): cabeçalho em azul-tinta liso, títulos e números
// em EB Garamond, superfícies em papel e branco, cor só no que pede atenção.
// Cores de status = paleta rebaixada do web (statusColorMapV3 no js/app.js e
// pontos de status do style.css) — sincronizar os dois ao mudar.

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
  bg: '#f6f5f2',
  card: '#ffffff',
  border: '#e8e5df',
  divider: '#efece6',
  input: '#faf9f7',
  inputBorder: '#e0dcd4',
  text: '#16191d',
  textSecondary: '#3a4048',
  muted: '#6c7178',
  mutedLight: '#b2afa8',
  primary: '#0b2e55',
  heroGradient: ['#0c1724', '#0c1724'],
  navBar: '#ffffff',
  navActive: '#16191d',
  navInactive: '#a3a19b',
  iconSquare: '#f1efea',
  danger: '#a33a2a',
  dangerBg: '#f8efec',
  dangerBorder: '#ecd3cc',
  warnBg: '#f6efe2',
};

export const dark: ThemeColors = {
  bg: '#121416',
  card: '#1a1d21',
  border: 'rgba(255,255,255,.08)',
  divider: 'rgba(255,255,255,.06)',
  input: '#16181b',
  inputBorder: 'rgba(255,255,255,.12)',
  text: '#ecebe7',
  textSecondary: '#c9c7c2',
  muted: '#9a9ca0',
  mutedLight: '#6b6e73',
  primary: '#dcd9d2',
  heroGradient: ['#0a0c0f', '#0a0c0f'],
  navBar: '#1a1d21',
  navActive: '#ecebe7',
  navInactive: '#75787d',
  iconSquare: 'rgba(255,255,255,.06)',
  danger: '#e0826f',
  dangerBg: 'rgba(163,58,42,.18)',
  dangerBorder: 'rgba(163,58,42,.35)',
  warnBg: 'rgba(154,100,21,.18)',
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

// Paleta rebaixada do web (statusColorMapV3): `color` é o ponto/marca da cor
// do status; o texto das etiquetas fica em tinta sobre papel (ver StatusPill).
export const STATUS: StatusDef[] = [
  { key: 'pendente', label: 'Pendente', short: 'Pendente', color: '#b3452f', pillBg: '#f1efea', colorDark: '#e0826f', pillBgDark: 'rgba(255,255,255,.06)' },
  { key: 'em-analise', label: 'Em Análise', short: 'Em análise', color: '#b7802f', pillBg: '#f1efea', colorDark: '#d9a45a', pillBgDark: 'rgba(255,255,255,.06)' },
  { key: 'aguardando-documentacao', label: 'Aguardando Documentação', short: 'Aguard. Doc.', color: '#5a7190', pillBg: '#f1efea', colorDark: '#9fb3cc', pillBgDark: 'rgba(255,255,255,.06)' },
  { key: 'em-diligencia', label: 'Em Diligência', short: 'Em diligência', color: '#8a74a3', pillBg: '#f1efea', colorDark: '#c0aad6', pillBgDark: 'rgba(255,255,255,.06)' },
  { key: 'finalizado', label: 'Finalizado', short: 'Finalizado', color: '#5b8a68', pillBg: '#f1efea', colorDark: '#8fc09d', pillBgDark: 'rgba(255,255,255,.06)' },
  { key: 'arquivado', label: 'Arquivado', short: 'Arquivado', color: '#b5afa3', pillBg: '#f1efea', colorDark: '#8e8a82', pillBgDark: 'rgba(255,255,255,.06)' },
];

export const statusByKey = (key: string | undefined): StatusDef =>
  STATUS.find((s) => s.key === key) ?? STATUS[0];

export type CatKey = 'g' | 'a' | 'e' | 'o' | 'r' | 'p' | 'u';

export interface CatDef {
  key: CatKey;
  label: string;
  color: string;
}

// Categorias de evento do calendário (VALID_CAT do js/app.js), em tons rebaixados.
export const CATS: CatDef[] = [
  { key: 'g', label: 'Geral', color: '#5a7190' },
  { key: 'a', label: 'Audiência', color: '#5b8a68' },
  { key: 'e', label: 'Escritório', color: '#8a8f96' },
  { key: 'o', label: 'OAB', color: '#b39448' },
  { key: 'r', label: 'Reunião', color: '#5a7190' },
  { key: 'p', label: 'Término de prazo', color: '#b7802f' },
  { key: 'u', label: 'Urgente', color: '#b3452f' },
];

export const catByKey = (key: string | undefined): CatDef =>
  CATS.find((c) => c.key === key) ?? CATS[0];

// KPI "Vencendo (≤5 dias)": o âmbar de atenção do web (--t-warning).
export const KPI_VENCENDO_COLOR = '#9a6415';

export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  /** EB Garamond — títulos de tela e números grandes (como no web). */
  serif: 'EBGaramond_500Medium',
  serifRegular: 'EBGaramond_400Regular',
};

export const shadow = {
  float: {
    shadowColor: '#0c1724',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  card: {
    shadowColor: '#0c1724',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#0c1724',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
};
