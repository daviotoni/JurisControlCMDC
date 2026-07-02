// Regras de negócio espelhadas do sistema web (js/app.js): urgência de
// prazos, KPIs do dashboard, alertas inteligentes e notificações derivadas.
import { KPI_VENCENDO_COLOR } from '../theme/tokens';
import { diffDays, fmtBR, parseYMD, todayUTC } from './dates';
import { EventoCal, MainCfg, Processo } from './types';

const ativo = (p: Processo) => p.stat !== 'finalizado' && p.stat !== 'arquivado';

export interface PrazoInfo {
  dias: number | null;
  vencido: boolean;
  /** dias 0–5 (regra do detalhe/dashboard; a lista do web usa <3) */
  alerta: boolean;
  /** Rótulo curto: "Vencido" | "Hoje" | "N dias" | null */
  curto: string | null;
}

export function prazoInfo(p: Processo): PrazoInfo {
  const prazo = parseYMD(p.prazo);
  if (!prazo || !ativo(p)) return { dias: null, vencido: false, alerta: false, curto: null };
  const dias = diffDays(todayUTC(), prazo);
  return {
    dias,
    vencido: dias < 0,
    alerta: dias >= 0 && dias <= 5,
    curto: dias < 0 ? 'Vencido' : dias === 0 ? 'Hoje' : `${dias} dia${dias === 1 ? '' : 's'}`,
  };
}

/** Cor do texto de prazo conforme urgência. */
export function prazoColor(info: PrazoInfo, fallback: string): string {
  if (info.vencido) return '#b42323';
  if (info.alerta) return '#b25e09';
  return fallback;
}

export interface KpiData {
  pendentes: number;
  emAnalise: number;
  vencendo: number; // ≤5 dias, não vencidos
  finalizados: number;
  vencidos: number;
}

export function computeKpis(procs: Processo[]): KpiData {
  const hoje = todayUTC();
  let vencendo = 0;
  let vencidos = 0;
  for (const p of procs) {
    const d = parseYMD(p.prazo);
    if (d && ativo(p)) {
      const df = diffDays(hoje, d);
      if (df < 0) vencidos++;
      else if (df <= 5) vencendo++;
    }
  }
  return {
    pendentes: procs.filter((p) => p.stat === 'pendente').length,
    emAnalise: procs.filter((p) => p.stat === 'em-analise').length,
    vencendo,
    finalizados: procs.filter((p) => p.stat === 'finalizado').length,
    vencidos,
  };
}

export const KPI_COLORS = {
  pendentes: '#b42323',
  emAnalise: '#b25e09',
  vencendo: KPI_VENCENDO_COLOR,
  finalizados: '#2f855a',
};

export interface AlertaInteligente {
  tipo: 'vencido' | 'inativo';
  titulo: string;
  desc: string;
}

/** Alertas do dashboard (mesmas regras do web). */
export function computeAlertas(procs: Processo[]): AlertaInteligente[] {
  const hoje = todayUTC();
  const alertas: AlertaInteligente[] = [];
  procs
    .filter((p) => {
      const d = parseYMD(p.prazo);
      return d && ativo(p) && diffDays(hoje, d) < 0;
    })
    .forEach((p) =>
      alertas.push({ tipo: 'vencido', titulo: 'Prazo vencido', desc: `Processo ${p.num} está vencido.` })
    );
  const inativos = procs.filter((p) => {
    const ent = parseYMD(p.ent);
    return (p.stat === 'em-analise' || p.stat === 'pendente') && ent && diffDays(ent, hoje) > 20;
  });
  if (inativos.length > 0) {
    alertas.push({
      tipo: 'inativo',
      titulo: 'Sem movimentação',
      desc: `${inativos.length} processo${inativos.length === 1 ? '' : 's'} sem movimentação há mais de 20 dias.`,
    });
  }
  return alertas;
}

export type NotifType = 'prazo' | 'evento' | 'alerta';

export interface Notif {
  id: string;
  type: NotifType;
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  nav: { type: 'proc'; id: number } | { type: 'cal'; date: string };
}

/**
 * Notificações derivadas de processos + eventos (generateAllNotifications do
 * web): prazos vencidos/fatais viram 'alerta', prazos em ≤5 dias viram
 * 'prazo', eventos (exceto categoria 'p') dos próximos 7 dias viram 'evento'.
 */
export function generateNotifications(procs: Processo[], eventos: EventoCal[], cfg: MainCfg | null): Notif[] {
  const hoje = todayUTC();
  const notifications: Notif[] = [];
  for (const p of procs) {
    const prazoDate = parseYMD(p.prazo);
    if (!prazoDate || !ativo(p)) continue;
    const df = diffDays(hoje, prazoDate);
    if (df < 0) {
      notifications.push({
        id: `alert-vencido-${p.id}`, type: 'alerta', date: p.prazo!,
        title: `Processo ${p.num}`, subtitle: `Vencido há ${Math.abs(df)} dia(s)`,
        nav: { type: 'proc', id: p.id },
      });
    } else if (df === 0) {
      notifications.push({
        id: `alert-fatal-${p.id}`, type: 'alerta', date: p.prazo!,
        title: `Processo ${p.num}`, subtitle: 'Prazo fatal (hoje!)',
        nav: { type: 'proc', id: p.id },
      });
    } else if (df <= 5) {
      notifications.push({
        id: `proc-${p.id}`, type: 'prazo', date: p.prazo!,
        title: `Processo ${p.num}`, subtitle: `Prazo em ${df} dia(s)`,
        nav: { type: 'proc', id: p.id },
      });
    }
  }
  const limite = 7;
  for (const e of eventos) {
    if (e.cat === 'p') continue;
    const eventDate = parseYMD(e.data);
    if (!eventDate) continue;
    const df = diffDays(hoje, eventDate);
    if (df >= 0 && df <= limite) {
      notifications.push({
        id: `cal-${e.id}`, type: 'evento', date: e.data,
        title: e.desc, subtitle: `Dia ${fmtBR(e.data)}${e.hora ? ` às ${e.hora}` : ''}`,
        nav: { type: 'cal', date: e.data },
      });
    }
  }
  const dismissed = cfg?.dismissedNotifications ?? [];
  return notifications
    .filter((n) => !dismissed.includes(n.id))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const unreadCount = (notifs: Notif[], cfg: MainCfg | null): number => {
  const read = cfg?.readNotifications ?? [];
  return notifs.filter((n) => !read.includes(n.id)).length;
};

/** Banner do dashboard: prazos que vencem em até 7 dias + ação imediata. */
export function bannerPrazos(procs: Processo[]): { seteDias: number; imediatos: number } {
  const hoje = todayUTC();
  let seteDias = 0;
  let imediatos = 0;
  for (const p of procs) {
    const d = parseYMD(p.prazo);
    if (!d || !ativo(p)) continue;
    const df = diffDays(hoje, d);
    if (df >= 0 && df <= 7) seteDias++;
    if (df <= 0) imediatos++;
  }
  return { seteDias, imediatos };
}

export const saudacao = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
};
