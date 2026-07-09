// Testes das funções puras do web (js/utils.js): datas, sanitização e
// whitelists de classe CSS. utils.js é script clássico, mas expõe um
// `module.exports` guardado para ambientes de teste (ver o fim do arquivo).
import utils from '../../js/utils.js';

const { fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass, VALID_STATS, VALID_ACAO, VALID_CAT } = utils;

describe('datas (UTC-safe)', () => {
  describe('parse', () => {
    it('interpreta YYYY-MM-DD como meia-noite UTC (sem deslocar por fuso)', () => {
      const d = parse('2024-03-15');
      expect(d.getUTCFullYear()).toBe(2024);
      expect(d.getUTCMonth()).toBe(2); // março = índice 2
      expect(d.getUTCDate()).toBe(15);
      expect(d.getUTCHours()).toBe(0);
    });

    it('retorna null para entrada vazia/nula', () => {
      expect(parse('')).toBeNull();
      expect(parse(null)).toBeNull();
      expect(parse(undefined)).toBeNull();
    });

    it('lida com 29 de fevereiro em ano bissexto', () => {
      const d = parse('2024-02-29');
      expect(d.getUTCMonth()).toBe(1);
      expect(d.getUTCDate()).toBe(29);
    });
  });

  describe('fmtBR', () => {
    it('formata como dd/mm/aaaa', () => {
      expect(fmtBR('2024-03-15')).toBe('15/03/2024');
    });

    it('não desloca o dia por causa do fuso (bug clássico de YYYY-MM-DD)', () => {
      // Se fosse interpretado no fuso local a oeste de UTC, viraria 31/12.
      expect(fmtBR('2024-01-01')).toBe('01/01/2024');
    });

    it('retorna travessão para valor ausente', () => {
      expect(fmtBR('')).toBe('—');
      expect(fmtBR(null)).toBe('—');
    });
  });

  describe('diffDays', () => {
    it('conta dias inteiros entre duas datas', () => {
      expect(diffDays(parse('2024-03-10'), parse('2024-03-15'))).toBe(5);
    });

    it('é negativo quando a segunda data é anterior (prazo vencido)', () => {
      expect(diffDays(parse('2024-03-15'), parse('2024-03-10'))).toBe(-5);
    });

    it('é 0 para o mesmo dia', () => {
      expect(diffDays(parse('2024-03-15'), parse('2024-03-15'))).toBe(0);
    });
  });

  describe('ymd', () => {
    it('serializa um Date de volta para YYYY-MM-DD com zero à esquerda', () => {
      expect(ymd(new Date(2024, 2, 5))).toBe('2024-03-05');
    });
  });

  describe('todayUTC', () => {
    it('zera as horas (meia-noite UTC)', () => {
      const t = todayUTC();
      expect(t.getUTCHours()).toBe(0);
      expect(t.getUTCMinutes()).toBe(0);
      expect(t.getUTCSeconds()).toBe(0);
    });
  });
});

describe('sanitizeHTML (defesa contra injeção vinda do Firestore)', () => {
  it('escapa tags HTML em vez de deixá-las como markup', () => {
    const out = sanitizeHTML('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapa aspas/atributos perigosos', () => {
    const out = sanitizeHTML('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
  });

  it('retorna string vazia para valor falsy', () => {
    expect(sanitizeHTML('')).toBe('');
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
  });

  it('preserva texto comum sem alterar', () => {
    expect(sanitizeHTML('Processo 123/2024')).toBe('Processo 123/2024');
  });
});

describe('safeCSSClass + whitelists', () => {
  it('deixa passar valores válidos de status', () => {
    expect(safeCSSClass('em-analise', VALID_STATS)).toBe('em-analise');
    expect(safeCSSClass('finalizado', VALID_STATS)).toBe('finalizado');
  });

  it('bloqueia valor fora da whitelist (retorna string vazia)', () => {
    expect(safeCSSClass('em-analise" onclick="evil', VALID_STATS)).toBe('');
    expect(safeCSSClass('inexistente', VALID_STATS)).toBe('');
  });

  it('whitelist de ações cobre exatamente as ações de histórico esperadas', () => {
    ['criado', 'editado', 'excluido', 'parecer-criado', 'parecer-editado', 'parecer-emitido', 'parecer-reaberto']
      .forEach((a) => expect(VALID_ACAO.has(a)).toBe(true));
    expect(VALID_ACAO.has('deletado')).toBe(false);
  });

  it('whitelist de categorias de evento aceita só as chaves conhecidas', () => {
    ['g', 'a', 'r', 'p', 'u', 'e', 'o'].forEach((c) => expect(VALID_CAT.has(c)).toBe(true));
    expect(VALID_CAT.has('x')).toBe(false);
  });
});
