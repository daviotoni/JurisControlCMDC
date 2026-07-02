// Utilitários de data espelhando o js/app.js do web (UTC para evitar
// deslocamento de fuso em datas YYYY-MM-DD).

export const parseYMD = (d?: string | null): Date | null => {
  if (!d) return null;
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, dd || 1));
};

export const todayUTC = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const diffDays = (a: Date, b: Date): number => Math.ceil((b.getTime() - a.getTime()) / 86400000);

export const ymd = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/** dd/mm/aaaa */
export const fmtBR = (d?: string | null): string => {
  const dt = parseYMD(d);
  if (!dt) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
};

/** dd/mm */
export const fmtBRShort = (d?: string | null): string => {
  const dt = parseYMD(d);
  if (!dt) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Ex.: "Quinta, 03 de julho" */
export const fmtDiaLongo = (d: Date): string =>
  `${DIAS_SEMANA[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()].toLowerCase()}`;

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

/** Segunda-feira da semana do dia informado (semana SEG→DOM, como no design). */
export const startOfWeek = (d: Date): Date => {
  const dow = d.getUTCDay(); // 0=dom
  return addDays(d, dow === 0 ? -6 : 1 - dow);
};
