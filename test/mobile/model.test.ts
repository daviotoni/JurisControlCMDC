// Testes das regras de negócio do mobile (mobile/src/lib/model.ts): urgência
// de prazos, KPIs, alertas e notificações. Estas regras são espelhadas do web
// (js/app.js), então travá-las aqui protege as duas implementações.
//
// Datas são sempre relativas a hoje (todayUTC) para os testes serem
// determinísticos, não importando o dia em que rodam.
import { afterEach, vi } from 'vitest';
import { addDays, todayUTC, ymd } from '../../mobile/src/lib/dates';
import {
  bannerPrazos,
  computeAlertas,
  computeKpis,
  generateNotifications,
  prazoColor,
  prazoInfo,
  saudacao,
  unreadCount,
} from '../../mobile/src/lib/model';
import type { EventoCal, Processo } from '../../mobile/src/lib/types';

// Deslocamento em dias a partir de hoje, já em YYYY-MM-DD.
const dia = (offset: number): string => ymd(addDays(todayUTC(), offset));

let seq = 0;
const proc = (over: Partial<Processo> = {}): Processo => ({
  id: ++seq,
  num: `P-${seq}`,
  int: 'Interessado',
  tipo: 'administrativo',
  obj: 'Objeto',
  stat: 'pendente',
  ...over,
});

describe('prazoInfo', () => {
  it('marca vencido quando o prazo já passou', () => {
    const info = prazoInfo(proc({ prazo: dia(-3) }));
    expect(info.vencido).toBe(true);
    expect(info.dias).toBe(-3);
    expect(info.curto).toBe('Vencido');
    expect(info.alerta).toBe(false);
  });

  it('marca alerta para prazo entre hoje e 5 dias', () => {
    const info = prazoInfo(proc({ prazo: dia(5) }));
    expect(info.alerta).toBe(true);
    expect(info.vencido).toBe(false);
    expect(info.curto).toBe('5 dias');
  });

  it('não marca alerta a partir de 6 dias', () => {
    expect(prazoInfo(proc({ prazo: dia(6) })).alerta).toBe(false);
  });

  it('rótulo "Hoje" quando vence hoje', () => {
    const info = prazoInfo(proc({ prazo: dia(0) }));
    expect(info.curto).toBe('Hoje');
    expect(info.alerta).toBe(true);
  });

  it('singular "1 dia" e plural "2 dias"', () => {
    expect(prazoInfo(proc({ prazo: dia(1) })).curto).toBe('1 dia');
    expect(prazoInfo(proc({ prazo: dia(2) })).curto).toBe('2 dias');
  });

  it('ignora processos finalizados/arquivados (sem prazo relevante)', () => {
    expect(prazoInfo(proc({ prazo: dia(-3), stat: 'finalizado' })).dias).toBeNull();
    expect(prazoInfo(proc({ prazo: dia(-3), stat: 'arquivado' })).vencido).toBe(false);
  });

  it('retorna vazio quando não há prazo', () => {
    const info = prazoInfo(proc({ prazo: undefined }));
    expect(info.dias).toBeNull();
    expect(info.curto).toBeNull();
  });
});

describe('prazoColor', () => {
  it('vermelho para vencido, laranja para alerta, fallback caso contrário', () => {
    expect(prazoColor(prazoInfo(proc({ prazo: dia(-1) })), '#000')).toBe('#b42323');
    expect(prazoColor(prazoInfo(proc({ prazo: dia(2) })), '#000')).toBe('#b25e09');
    expect(prazoColor(prazoInfo(proc({ prazo: dia(30) })), '#000')).toBe('#000');
  });
});

describe('computeKpis', () => {
  it('conta por status e classifica prazos (vencendo ≤5, vencidos <0)', () => {
    const k = computeKpis([
      proc({ stat: 'pendente', prazo: dia(3) }), // pendente + vencendo
      proc({ stat: 'pendente', prazo: dia(-2) }), // pendente + vencido
      proc({ stat: 'em-analise', prazo: dia(10) }), // em-analise, longe
      proc({ stat: 'finalizado', prazo: dia(-5) }), // finalizado não conta prazo
    ]);
    expect(k.pendentes).toBe(2);
    expect(k.emAnalise).toBe(1);
    expect(k.finalizados).toBe(1);
    expect(k.vencendo).toBe(1);
    expect(k.vencidos).toBe(1);
  });

  it('não conta prazo de processos inativos em vencendo/vencidos', () => {
    const k = computeKpis([proc({ stat: 'arquivado', prazo: dia(-1) })]);
    expect(k.vencidos).toBe(0);
    expect(k.vencendo).toBe(0);
  });
});

describe('computeAlertas', () => {
  it('gera um alerta "vencido" por processo com prazo passado', () => {
    const alertas = computeAlertas([
      proc({ prazo: dia(-1) }),
      proc({ prazo: dia(-2) }),
      proc({ prazo: dia(5) }),
    ]);
    const vencidos = alertas.filter((a) => a.tipo === 'vencido');
    expect(vencidos).toHaveLength(2);
  });

  it('agrega um único alerta de inatividade (>20 dias sem movimentação)', () => {
    const alertas = computeAlertas([
      proc({ stat: 'em-analise', ent: dia(-25) }),
      proc({ stat: 'pendente', ent: dia(-30) }),
    ]);
    const inativos = alertas.filter((a) => a.tipo === 'inativo');
    expect(inativos).toHaveLength(1);
    expect(inativos[0].desc).toContain('2 processos');
  });

  it('não sinaliza inatividade com exatamente 20 dias (regra é > 20)', () => {
    const alertas = computeAlertas([proc({ stat: 'pendente', ent: dia(-20) })]);
    expect(alertas.some((a) => a.tipo === 'inativo')).toBe(false);
  });
});

describe('generateNotifications', () => {
  it('classifica prazos: vencido/hoje viram "alerta", ≤5 dias viram "prazo"', () => {
    const notifs = generateNotifications(
      [
        proc({ num: 'A', prazo: dia(-1) }),
        proc({ num: 'B', prazo: dia(0) }),
        proc({ num: 'C', prazo: dia(4) }),
        proc({ num: 'D', prazo: dia(30) }), // fora de qualquer janela
      ],
      [],
      null,
    );
    expect(notifs.filter((n) => n.type === 'alerta')).toHaveLength(2);
    expect(notifs.filter((n) => n.type === 'prazo')).toHaveLength(1);
    expect(notifs.find((n) => n.subtitle.includes('fatal'))).toBeTruthy();
  });

  it('inclui eventos nos próximos 7 dias, mas ignora categoria "p" (término de prazo)', () => {
    const eventos: EventoCal[] = [
      { id: 'e1', data: dia(2), desc: 'Audiência', cat: 'a' },
      { id: 'e2', data: dia(2), desc: 'Fim de prazo', cat: 'p' }, // ignorado
      { id: 'e3', data: dia(9), desc: 'Longe demais', cat: 'a' }, // fora da janela
    ];
    const notifs = generateNotifications([], eventos, null);
    const eventNotifs = notifs.filter((n) => n.type === 'evento');
    expect(eventNotifs).toHaveLength(1);
    expect(eventNotifs[0].title).toBe('Audiência');
  });

  it('respeita dismissedNotifications', () => {
    const p = proc({ num: 'X', prazo: dia(2) });
    const semFiltro = generateNotifications([p], [], null);
    expect(semFiltro).toHaveLength(1);
    const comFiltro = generateNotifications([p], [], {
      dismissedNotifications: [semFiltro[0].id],
    });
    expect(comFiltro).toHaveLength(0);
  });

  it('ordena as notificações por data crescente', () => {
    const notifs = generateNotifications(
      [proc({ prazo: dia(4) }), proc({ prazo: dia(-1) }), proc({ prazo: dia(0) })],
      [],
      null,
    );
    const datas = notifs.map((n) => n.date);
    expect(datas).toEqual([...datas].sort());
  });
});

describe('unreadCount', () => {
  it('conta apenas as não marcadas como lidas', () => {
    const notifs = generateNotifications(
      [proc({ prazo: dia(2) }), proc({ prazo: dia(3) })],
      [],
      null,
    );
    expect(unreadCount(notifs, null)).toBe(2);
    expect(unreadCount(notifs, { readNotifications: [notifs[0].id] })).toBe(1);
  });
});

describe('saudacao (depende da hora local)', () => {
  afterEach(() => vi.useRealTimers());

  const emHora = (h: number) => {
    vi.useFakeTimers();
    // Data arbitrária, só a hora importa (getHours é local).
    vi.setSystemTime(new Date(2024, 6, 9, h, 0, 0));
  };

  it('"Bom dia," antes do meio-dia', () => {
    emHora(9);
    expect(saudacao()).toBe('Bom dia,');
  });

  it('"Boa tarde," entre 12h e 17h59', () => {
    emHora(15);
    expect(saudacao()).toBe('Boa tarde,');
  });

  it('"Boa noite," a partir das 18h', () => {
    emHora(21);
    expect(saudacao()).toBe('Boa noite,');
  });

  it('vira "Boa tarde," exatamente ao meio-dia (limite <12)', () => {
    emHora(12);
    expect(saudacao()).toBe('Boa tarde,');
  });
});

describe('bannerPrazos', () => {
  it('conta prazos em ≤7 dias e imediatos (hoje ou vencidos)', () => {
    const b = bannerPrazos([
      proc({ prazo: dia(7) }), // dentro de 7 dias
      proc({ prazo: dia(0) }), // hoje → 7dias + imediato
      proc({ prazo: dia(-3) }), // vencido → imediato
      proc({ prazo: dia(8) }), // fora
      proc({ prazo: dia(-1), stat: 'finalizado' }), // inativo não conta
    ]);
    expect(b.seteDias).toBe(2); // dia(7) e dia(0)
    expect(b.imediatos).toBe(2); // dia(0) e dia(-3)
  });
});
