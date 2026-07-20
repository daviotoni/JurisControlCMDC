// Testes das funções puras do web (js/utils.js): datas, sanitização e
// whitelists de classe CSS. utils.js é script clássico, mas expõe um
// `module.exports` guardado para ambientes de teste (ver o fim do arquivo).
import utils from '../../js/utils.js';

const { fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass, getChanges, normalizarConsultaJuris, jurisSemAcento, expandirConsultaJuris, filtrarOrdenarResultadosJuris, VALID_STATS, VALID_ACAO, VALID_CAT } = utils;

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

describe('getChanges (diff do histórico de processos)', () => {
  const base = {
    num: '001', int: 'Fulano', tipo: 'administrativo', obj: 'Objeto',
    acao: '', stat: 'pendente', setorOrigem: 'CPL', dest: '', ent: '2024-01-01', prazo: '2024-02-01', saida: '',
  };

  it('não detecta mudança quando os registros são iguais', () => {
    expect(getChanges(base, { ...base })).toEqual([]);
  });

  it('detecta um campo alterado e reporta de/para', () => {
    const changes = getChanges(base, { ...base, stat: 'finalizado' });
    expect(changes).toEqual([{ campo: 'stat', de: 'pendente', para: 'finalizado' }]);
  });

  it('detecta múltiplos campos alterados', () => {
    const changes = getChanges(base, { ...base, int: 'Ciclano', prazo: '2024-03-01' });
    expect(changes.map((c) => c.campo).sort()).toEqual(['int', 'prazo']);
  });

  it('trata null/undefined/"" como equivalentes (não gera falso positivo)', () => {
    expect(getChanges({ ...base, dest: '' }, { ...base, dest: undefined })).toEqual([]);
    expect(getChanges({ ...base, dest: null }, { ...base, dest: '' })).toEqual([]);
  });

  it('detecta preenchimento de um campo antes vazio', () => {
    const changes = getChanges({ ...base, dest: '' }, { ...base, dest: 'Presidência' });
    expect(changes).toEqual([{ campo: 'dest', de: '', para: 'Presidência' }]);
  });

  it('ignora campos fora da lista rastreada (ex.: id, anotacoes)', () => {
    const changes = getChanges({ ...base, id: 1 }, { ...base, id: 999 });
    expect(changes).toEqual([]);
  });
});

describe('jurisSemAcento (URL do SCON/STJ, legado ISO-8859-1)', () => {
  it('remove diacríticos de termos jurídicos comuns', () => {
    expect(jurisSemAcento('licitação')).toBe('licitacao');
    expect(jurisSemAcento('improbidade administrativa é sanção')).toBe('improbidade administrativa e sancao');
    expect(jurisSemAcento('câmara municipal — prescrição')).toBe('camara municipal — prescricao');
  });

  it('preserva texto sem acento, maiúsculas e pontuação', () => {
    expect(jurisSemAcento('Lei 14.133/2021, art. 75')).toBe('Lei 14.133/2021, art. 75');
  });

  it('não quebra com entrada não-string (coerção via String)', () => {
    expect(jurisSemAcento(null)).toBe('null');
    expect(jurisSemAcento(123)).toBe('123');
  });
});

describe('normalizarConsultaJuris', () => {
  it('remove conectivos (preposições/artigos), mantendo as palavras de conteúdo', () => {
    expect(normalizarConsultaJuris('dispensa de licitação em câmara municipal'))
      .toBe('dispensa licitação câmara municipal');
  });

  it('colapsa espaços e apara as bordas', () => {
    expect(normalizarConsultaJuris('  prescrição   da   pensão  por morte '))
      .toBe('prescrição pensão morte');
  });

  it('preserva operadores (e/ou/não) — não são conectivos removíveis', () => {
    expect(normalizarConsultaJuris('gravação ambiental ou clandestina'))
      .toBe('gravação ambiental ou clandestina');
  });

  it('não esvazia a busca: query de 1 palavra fica intacta', () => {
    expect(normalizarConsultaJuris('licitação')).toBe('licitação');
  });

  it('se sobrariam menos de 2 palavras, devolve o texto original', () => {
    expect(normalizarConsultaJuris('em no da')).toBe('em no da');
  });

  it('preserva número de processo (não são conectivos)', () => {
    expect(normalizarConsultaJuris('0002934-98.2018.8.19.0064'))
      .toBe('0002934-98.2018.8.19.0064');
  });

  it('lida com entrada vazia/nula sem quebrar', () => {
    expect(normalizarConsultaJuris('')).toBe('');
    expect(normalizarConsultaJuris(null)).toBe('');
    expect(normalizarConsultaJuris(undefined)).toBe('');
  });
});

describe('expandirConsultaJuris', () => {
  it('expande conceitos reconhecidos em grupos OR de sinônimos técnicos', () => {
    const r = expandirConsultaJuris('gravações em escritório ou ambiente de trabalho');
    expect(r).toBe('("gravação ambiental" OR "gravação clandestina" OR "prova ilícita") ("ambiente de trabalho" OR "local de trabalho" OR "relação de emprego")');
  });

  it('não deixa operadores (ou) soltos no fim da consulta', () => {
    expect(expandirConsultaJuris('gravações ou câmeras'))
      .not.toMatch(/\bou\s*$/);
  });

  it('preserva palavras específicas do usuário fora dos conceitos (ex.: local)', () => {
    const r = expandirConsultaJuris('licitação prefeitura são paulo');
    expect(r).toContain('"licitação"');
    expect(r).toContain('prefeitura');
    expect(r).toContain('são');
    expect(r).toContain('paulo');
  });

  it('não repete, soltas, palavras já cobertas pelos grupos', () => {
    const r = expandirConsultaJuris('prescrição pensão por morte');
    // "morte" já está dentro de "pensão por morte" — não deve sobrar solto
    expect(r).toBe('("pensão por morte") ("prescrição" OR "decadência")');
  });

  it('cai no comportamento seguro (normalização) quando nada é reconhecido', () => {
    expect(expandirConsultaJuris('assunto genérico qualquer')).toBe('assunto genérico qualquer');
  });

  it('ignora acentos e caixa ao reconhecer conceitos', () => {
    expect(expandirConsultaJuris('IMPROBIDADE')).toBe('("improbidade administrativa")');
  });

  it('entrada vazia/nula devolve string vazia', () => {
    expect(expandirConsultaJuris('')).toBe('');
    expect(expandirConsultaJuris(null)).toBe('');
  });
});

describe('filtrarOrdenarResultadosJuris', () => {
  const lista = [
    { tribunal: 'TJRJ', orgao: 'Câmara Cível', data: '2024-01-10', titulo: 'A' },
    { tribunal: 'STJ', orgao: 'Primeira Turma', data: '2026-05-01', titulo: 'B' },
    { tribunal: 'TJRJ', orgao: 'Câmara Cível', data: '2025-03-20', titulo: 'C' },
    { tribunal: 'STF', orgao: '', data: '', titulo: 'D' },
  ];

  it('ordena por mais recentes por padrão (sem data vai para o fim)', () => {
    const r = filtrarOrdenarResultadosJuris(lista);
    expect(r.map((x) => x.titulo)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('ordena por mais antigos', () => {
    const r = filtrarOrdenarResultadosJuris(lista, { ordem: 'antigos' });
    expect(r.map((x) => x.titulo)).toEqual(['D', 'A', 'C', 'B']);
  });

  it('filtra por tribunal', () => {
    const r = filtrarOrdenarResultadosJuris(lista, { tribunal: 'TJRJ' });
    expect(r.map((x) => x.titulo)).toEqual(['C', 'A']);
  });

  it('filtra por órgão julgador', () => {
    const r = filtrarOrdenarResultadosJuris(lista, { orgao: 'Primeira Turma' });
    expect(r.map((x) => x.titulo)).toEqual(['B']);
  });

  it('combina filtro de tribunal com ordenação por antigos', () => {
    const r = filtrarOrdenarResultadosJuris(lista, { tribunal: 'TJRJ', ordem: 'antigos' });
    expect(r.map((x) => x.titulo)).toEqual(['A', 'C']);
  });

  it('não muta a lista original', () => {
    const copia = lista.slice();
    filtrarOrdenarResultadosJuris(lista, { ordem: 'antigos' });
    expect(lista).toEqual(copia);
  });

  it('entrada não-array devolve lista vazia', () => {
    expect(filtrarOrdenarResultadosJuris(null)).toEqual([]);
    expect(filtrarOrdenarResultadosJuris(undefined)).toEqual([]);
  });
});
