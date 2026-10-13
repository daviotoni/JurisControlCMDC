// Testes dos Termos de Concordância (js/termos.js): numeração e agrupamento
// das guias de remessa, sugestão do vereador, correções com rastro e os
// números do topo da aba.
import Termos from '../../js/termos.js';

const {
  diasEntre, situacao, envioAtivo, proximaGuia, itensDaGuia, guiaReaproveitavel,
  sugerirVereador, sugerirStatusDevolucao, aplicarCorrecoes, resumo, filtrarEnvios, listarEnvios,
} = Termos;

const envio = (extra = {}) => ({
  id: 1, desfecho: 'arquivamento', vereadorId: 'v1', vereadorNome: 'Saulo', dataEnvio: '2026-10-01',
  registradoEm: '2026-10-01T14:00:00.000Z', registradoPor: 'Ana', cobrancas: [], devolucao: null,
  cancelamento: null, alteracoes: [], ...extra,
});

describe('situacao e envioAtivo', () => {
  it('classifica aguardando, devolvido e cancelado', () => {
    expect(situacao(envio())).toBe('aguardando');
    expect(situacao(envio({ devolucao: { data: '2026-10-05', resposta: 'concorda' } }))).toBe('devolvido');
    expect(situacao(envio({ cancelamento: { motivo: 'engano' } }))).toBe('cancelado');
  });

  it('o envio ativo é o mais recente não cancelado', () => {
    const proc = { termos: [envio({ id: 1 }), envio({ id: 2, cancelamento: { motivo: 'x' } })] };
    expect(envioAtivo(proc).id).toBe(1);
    expect(envioAtivo({ termos: [envio({ cancelamento: { motivo: 'x' } })] })).toBeNull();
    expect(envioAtivo({})).toBeNull();
  });
});

describe('diasEntre', () => {
  it('conta dias corridos e atravessa meses', () => {
    expect(diasEntre('2026-09-28', '2026-10-13')).toBe(15);
    expect(diasEntre('2026-10-13', '2026-10-13')).toBe(0);
    expect(diasEntre('', '2026-10-13')).toBeNull();
  });
});

describe('guias de remessa', () => {
  const procs = [
    { id: 1, termos: [envio({ guiaNumero: '0001/2026', guiaSeq: 1, guiaAno: 2026 })] },
    { id: 2, termos: [envio({ guiaNumero: '0002/2026', guiaSeq: 2, guiaAno: 2026, vereadorId: 'v2', cancelamento: { motivo: 'x' } })] },
    { id: 3, termos: [envio({ guiaNumero: '0007/2025', guiaSeq: 7, guiaAno: 2025, dataEnvio: '2025-11-03' })] },
  ];

  it('numera por ano, com quatro dígitos, a partir do maior já usado', () => {
    expect(proximaGuia(procs, 2026)).toEqual({ seq: 3, ano: 2026, numero: '0003/2026' });
    expect(proximaGuia(procs, 2027).numero).toBe('0001/2027');
    expect(proximaGuia([], 2026).numero).toBe('0001/2026');
  });

  it('reaproveita a guia do mesmo gabinete no mesmo dia', () => {
    expect(guiaReaproveitavel(procs, 'v1', '2026-10-01')).toEqual({ seq: 1, ano: 2026, numero: '0001/2026' });
    expect(guiaReaproveitavel(procs, 'v1', '2026-10-02')).toBeNull();
    expect(guiaReaproveitavel(procs, 'v9', '2026-10-01')).toBeNull();
  });

  it('não reaproveita guia já impressa nem de envio cancelado', () => {
    const impressa = [{ id: 1, termos: [envio({ guiaNumero: '0001/2026', guiaSeq: 1, guiaAno: 2026, guiaImpressaEm: '2026-10-01T15:00:00Z' })] }];
    expect(guiaReaproveitavel(impressa, 'v1', '2026-10-01')).toBeNull();
    expect(guiaReaproveitavel(procs, 'v2', '2026-10-01')).toBeNull();
  });

  it('itensDaGuia ignora os cancelados', () => {
    expect(itensDaGuia(procs, '0001/2026').map(({ proc }) => proc.id)).toEqual([1]);
    expect(itensDaGuia(procs, '0002/2026')).toEqual([]);
  });
});

describe('sugerirVereador', () => {
  const vereadores = [
    { id: 'v1', nome: 'Saulo Henrique da Silva de Paula' },
    { id: 'v2', nome: 'Alex Freitas Marques' },
    { id: 'v3', nome: 'Alex Souza', ativo: false },
  ];

  it('casa o interessado com tratamento e sem acento', () => {
    expect(sugerirVereador('Exmo. Vereador Saulo Henrique da Silva de Paula', vereadores).id).toBe('v1');
    expect(sugerirVereador('Ver. ALEX FREITAS MARQUES', vereadores).id).toBe('v2');
  });

  it('casa nome parcial contido no cadastro', () => {
    expect(sugerirVereador('Vereador Alex Marques', vereadores).id).toBe('v2');
  });

  it('não sugere inativos nem nomes que não batem', () => {
    expect(sugerirVereador('Alex Souza', vereadores)).toBeNull();
    expect(sugerirVereador('Prefeitura Municipal', vereadores)).toBeNull();
    expect(sugerirVereador('', vereadores)).toBeNull();
  });
});

describe('sugerirStatusDevolucao', () => {
  it('concorda com arquivamento → arquivado; com conversão → finalizado; não concorda → em análise', () => {
    expect(sugerirStatusDevolucao('arquivamento', 'concorda')).toBe('arquivado');
    expect(sugerirStatusDevolucao('conversao', 'concorda')).toBe('finalizado');
    expect(sugerirStatusDevolucao('arquivamento', 'nao-concorda')).toBe('em-analise');
  });
});

describe('aplicarCorrecoes', () => {
  it('guarda de/para, quem e quando, só para campos que mudaram', () => {
    const e = envio({ obs: '', devolucao: { data: '2026-10-05', resposta: 'concorda', obs: '' } });
    const feitas = aplicarCorrecoes(e, { dataEnvio: '2026-10-02', obs: '', 'devolucao.resposta': 'nao-concorda' }, 'Ana', '2026-10-13T10:00:00Z');
    expect(feitas).toEqual([
      { em: '2026-10-13T10:00:00Z', por: 'Ana', campo: 'dataEnvio', de: '2026-10-01', para: '2026-10-02' },
      { em: '2026-10-13T10:00:00Z', por: 'Ana', campo: 'devolucao.resposta', de: 'concorda', para: 'nao-concorda' },
    ]);
    expect(e.dataEnvio).toBe('2026-10-02');
    expect(e.devolucao.resposta).toBe('nao-concorda');
    expect(e.alteracoes).toHaveLength(2);
  });

  it('nunca altera o carimbo de registro nem campos da devolução inexistente', () => {
    const e = envio();
    const feitas = aplicarCorrecoes(e, { registradoEm: 'x', registradoPor: 'y', 'devolucao.data': '2026-10-09' }, 'Ana', 'agora');
    expect(feitas).toEqual([]);
    expect(e.registradoEm).toBe('2026-10-01T14:00:00.000Z');
    expect(e.devolucao).toBeNull();
  });
});

describe('resumo e filtrarEnvios', () => {
  const procs = [
    { id: 1, num: '100/2026', int: 'Saulo', termos: [envio({ id: 1, dataEnvio: '2026-09-20' })] },
    { id: 2, num: '200/2026', int: 'Alex', termos: [envio({ id: 2, vereadorId: 'v2', vereadorNome: 'Alex', dataEnvio: '2026-10-10' })] },
    { id: 3, num: '300/2026', int: 'Alex', termos: [envio({ id: 3, vereadorId: 'v2', vereadorNome: 'Alex', dataEnvio: '2026-10-01', devolucao: { data: '2026-10-08', resposta: 'concorda' } })] },
    { id: 4, num: '400/2026', int: 'Alex', termos: [envio({ id: 4, dataEnvio: '2026-08-01', devolucao: { data: '2026-09-01', resposta: 'concorda' } })] },
    { id: 5, num: '500/2026', int: 'Alex', termos: [envio({ id: 5, cancelamento: { motivo: 'engano' } })] },
  ];

  it('conta aguardando, devolvidos no mês e o pendente mais antigo', () => {
    const r = resumo(procs, '2026-10-13');
    expect(r.aguardando).toBe(2);
    expect(r.devolvidosMes).toBe(1);
    expect(r.maisAntigo.dias).toBe(23);
    expect(r.maisAntigo.proc.num).toBe('100/2026');
  });

  it('lista pendentes do mais antigo para o mais novo, depois os devolvidos; esconde cancelados', () => {
    const L = filtrarEnvios(listarEnvios(procs));
    expect(L.map(({ proc }) => proc.num)).toEqual(['100/2026', '200/2026', '300/2026', '400/2026']);
  });

  it('filtra por situação, vereador e texto', () => {
    const itens = listarEnvios(procs);
    expect(filtrarEnvios(itens, { situacao: 'cancelado' }).map(({ proc }) => proc.id)).toEqual([5]);
    expect(filtrarEnvios(itens, { vereadorId: 'v2' }).map(({ proc }) => proc.id)).toEqual([2, 3]);
    expect(filtrarEnvios(itens, { busca: '300/2026' }).map(({ proc }) => proc.id)).toEqual([3]);
  });
});
