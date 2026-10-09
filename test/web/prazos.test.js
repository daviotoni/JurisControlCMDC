// Testes da contagem de prazos (js/prazos.js): feriados nacionais, do RJ e de
// Duque de Caxias, dias úteis × corridos e recesso forense.
import Prazos from '../../js/prazos.js';

const { pascoa, feriadosDoAno, calcularPrazo } = Prazos;
const iso = (d) => d.toISOString().slice(0, 10);
const datas = (lista) => lista.map((f) => f.data);

describe('pascoa', () => {
  it('acerta anos conhecidos', () => {
    expect(iso(pascoa(2024))).toBe('2024-03-31');
    expect(iso(pascoa(2025))).toBe('2025-04-20');
    expect(iso(pascoa(2026))).toBe('2026-04-05');
    expect(iso(pascoa(2027))).toBe('2027-03-28');
  });
});

describe('feriadosDoAno', () => {
  const f2026 = feriadosDoAno(2026);
  const nomeEm = (data) => f2026.find((f) => f.data === data)?.nome;

  it('inclui os móveis: terça de Carnaval (RJ) e Sexta-feira Santa', () => {
    expect(nomeEm('2026-02-17')).toBe('Terça-feira de Carnaval');
    expect(nomeEm('2026-04-03')).toBe('Sexta-feira Santa');
  });

  it('inclui São Jorge (RJ), Santo Antônio (Duque de Caxias) e Consciência Negra', () => {
    expect(nomeEm('2026-04-23')).toBe('São Jorge');
    expect(nomeEm('2026-06-13')).toBe('Santo Antônio (padroeiro)');
    expect(nomeEm('2026-11-20')).toBe('Dia da Consciência Negra');
  });

  it('pontos facultativos só entram quando ligados', () => {
    expect(datas(f2026)).not.toContain('2026-02-16'); // segunda de Carnaval
    expect(datas(f2026)).not.toContain('2026-06-04'); // Corpus Christi
    const comPontos = datas(feriadosDoAno(2026, { pontos: { carnavalSegunda: true, cinzas: true, corpusChristi: true } }));
    expect(comPontos).toEqual(expect.arrayContaining(['2026-02-16', '2026-02-18', '2026-06-04']));
  });

  it('datas cadastradas valem só no próprio ano', () => {
    const extras = [{ data: '2026-08-25', desc: 'Ponto facultativo municipal' }, { data: '2027-08-25', desc: 'Outro ano' }];
    const lista = feriadosDoAno(2026, { extras });
    expect(lista.find((f) => f.data === '2026-08-25')?.nome).toBe('Ponto facultativo municipal');
    expect(datas(lista)).not.toContain('2027-08-25');
  });
});

describe('calcularPrazo — dias úteis', () => {
  it('exclui o dia do começo, pula fim de semana e feriado', () => {
    // Sexta 09/10/2026 + 5 úteis: pula sáb/dom e 12/10 (N. Sra. Aparecida).
    const r = calcularPrazo('2026-10-09', 5, 'uteis');
    expect(r.vencimento).toBe('2026-10-19');
    expect(r.pulados.map((p) => p.motivo)).toContain('Nossa Senhora Aparecida');
  });

  it('com recesso forense, suspende de 20/12 a 20/01', () => {
    // Sexta 18/12/2026 + 3 úteis, judicial: volta a contar em 21/01/2027.
    expect(calcularPrazo('2026-12-18', 3, 'uteis', { recesso: true }).vencimento).toBe('2027-01-25');
    // Sem recesso (administrativo): só pula fim de semana e Natal.
    expect(calcularPrazo('2026-12-18', 3, 'uteis').vencimento).toBe('2026-12-23');
  });

  it('respeita ponto facultativo ligado', () => {
    // Sexta 13/02/2026 + 1 útil: segunda 16/02 (ponto) e terça 17/02 (Carnaval RJ).
    expect(calcularPrazo('2026-02-13', 1, 'uteis').vencimento).toBe('2026-02-16');
    expect(calcularPrazo('2026-02-13', 1, 'uteis', { pontos: { carnavalSegunda: true } }).vencimento).toBe('2026-02-18');
  });
});

describe('calcularPrazo — dias corridos', () => {
  it('soma os dias e prorroga se o último cair sem expediente', () => {
    const r = calcularPrazo('2026-10-09', 3, 'corridos'); // 12/10 é feriado
    expect(r.vencimento).toBe('2026-10-13');
    expect(r.prorrogado).toBe(true);
  });

  it('não prorroga quando o último dia é útil', () => {
    const r = calcularPrazo('2026-10-01', 5, 'corridos');
    expect(r.vencimento).toBe('2026-10-06');
    expect(r.prorrogado).toBe(false);
  });
});

describe('calcularPrazo — entradas inválidas', () => {
  it('devolve null sem data ou com dias inválidos', () => {
    expect(calcularPrazo('', 5)).toBeNull();
    expect(calcularPrazo('2026-10-01', 0)).toBeNull();
    expect(calcularPrazo('2026-10-01', 'abc')).toBeNull();
  });
});
