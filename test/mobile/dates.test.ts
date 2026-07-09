// Testes das funções puras de data do mobile (mobile/src/lib/dates.ts).
import {
  addDays,
  diffDays,
  fmtBR,
  fmtBRShort,
  fmtDiaLongo,
  parseYMD,
  startOfWeek,
  todayUTC,
  ymd,
} from '../../mobile/src/lib/dates';

describe('parseYMD', () => {
  it('interpreta YYYY-MM-DD como meia-noite UTC', () => {
    const d = parseYMD('2024-07-09')!;
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(6); // julho
    expect(d.getUTCDate()).toBe(9);
    expect(d.getUTCHours()).toBe(0);
  });

  it('retorna null para vazio/nulo', () => {
    expect(parseYMD('')).toBeNull();
    expect(parseYMD(null)).toBeNull();
    expect(parseYMD(undefined)).toBeNull();
  });
});

describe('fmtBR / fmtBRShort', () => {
  it('fmtBR gera dd/mm/aaaa', () => {
    expect(fmtBR('2024-07-09')).toBe('09/07/2024');
  });

  it('fmtBRShort gera dd/mm', () => {
    expect(fmtBRShort('2024-07-09')).toBe('09/07');
  });

  it('ambos retornam travessão para ausente', () => {
    expect(fmtBR(null)).toBe('—');
    expect(fmtBRShort(undefined)).toBe('—');
  });

  it('não desloca dia por fuso', () => {
    expect(fmtBR('2024-01-01')).toBe('01/01/2024');
  });
});

describe('diffDays', () => {
  it('conta dias entre datas', () => {
    expect(diffDays(parseYMD('2024-07-01')!, parseYMD('2024-07-09')!)).toBe(8);
  });
  it('negativo para prazo passado', () => {
    expect(diffDays(parseYMD('2024-07-09')!, parseYMD('2024-07-01')!)).toBe(-8);
  });
});

describe('ymd', () => {
  it('serializa em UTC com zero à esquerda', () => {
    expect(ymd(new Date(Date.UTC(2024, 6, 5)))).toBe('2024-07-05');
  });
  it('ida e volta com parseYMD é estável', () => {
    expect(ymd(parseYMD('2024-12-31')!)).toBe('2024-12-31');
  });
});

describe('addDays', () => {
  it('avança dias atravessando a virada de mês', () => {
    expect(ymd(addDays(parseYMD('2024-07-30')!, 5))).toBe('2024-08-04');
  });
  it('retrocede com valor negativo', () => {
    expect(ymd(addDays(parseYMD('2024-07-01')!, -1))).toBe('2024-06-30');
  });
  it('não muta o Date original', () => {
    const base = parseYMD('2024-07-09')!;
    addDays(base, 10);
    expect(ymd(base)).toBe('2024-07-09');
  });
});

describe('startOfWeek (semana Seg→Dom)', () => {
  it('numa quarta retorna a segunda anterior', () => {
    // 2024-07-10 é uma quarta-feira.
    expect(ymd(startOfWeek(parseYMD('2024-07-10')!))).toBe('2024-07-08');
  });
  it('numa segunda retorna a própria segunda', () => {
    expect(ymd(startOfWeek(parseYMD('2024-07-08')!))).toBe('2024-07-08');
  });
  it('num domingo retorna a segunda 6 dias antes (não a do dia seguinte)', () => {
    // 2024-07-14 é domingo; a semana Seg→Dom começa em 08/07.
    expect(ymd(startOfWeek(parseYMD('2024-07-14')!))).toBe('2024-07-08');
  });
});

describe('fmtDiaLongo', () => {
  it('formata "DiaSemana, dd de mês" em pt-br', () => {
    // 2024-07-09 é terça-feira.
    expect(fmtDiaLongo(parseYMD('2024-07-09')!)).toBe('Terça, 09 de julho');
  });
});

describe('todayUTC', () => {
  it('está zerado à meia-noite UTC', () => {
    const t = todayUTC();
    expect(t.getUTCHours()).toBe(0);
    expect(t.getUTCMinutes()).toBe(0);
  });
});
