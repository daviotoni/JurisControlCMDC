// Testes da lógica pura de pareceres e versões (js/utils.js): normalização e
// combinação da lista de pareceres, ordenação de versões e a decisão de qual
// parecer pertence a um processo (estruturado > legado > nenhum).
import utils from '../../js/utils.js';

const {
  normalizeParecerParaLista, combinarPareceres, versoesDoDocumento,
  versaoAtual, versoesDoParecer, inferirParecerInfo,
} = utils;

describe('normalizeParecerParaLista', () => {
  it('estruturado: id prefixado, título com nº do processo, usa atualizadoEm', () => {
    const r = normalizeParecerParaLista(
      { id: 7, processoNum: '123/2024', status: 'rascunho', atualizadoEm: '2024-05-01', criadoEm: '2024-04-01' },
      'estruturado',
    );
    expect(r).toMatchObject({ id: 'pz-7', tipo: 'estruturado', titulo: 'Parecer — Processo 123/2024', status: 'rascunho', dataRef: '2024-05-01' });
  });

  it('estruturado sem número mostra "s/ nº" e cai para criadoEm quando não há atualizadoEm', () => {
    const r = normalizeParecerParaLista({ id: 1, status: 'emitido', criadoEm: '2024-04-01' }, 'estruturado');
    expect(r.titulo).toBe('Parecer — Processo s/ nº');
    expect(r.dataRef).toBe('2024-04-01');
  });

  it('legado: id prefixado com doc-, título = nomePrincipal, status null', () => {
    const r = normalizeParecerParaLista({ id: 9, nomePrincipal: 'Parecer.docx', criadoEm: '2024-01-01' }, 'legado');
    expect(r).toMatchObject({ id: 'doc-9', tipo: 'legado', titulo: 'Parecer.docx', status: null, dataRef: '2024-01-01' });
  });
});

describe('combinarPareceres', () => {
  it('junta legados + estruturados e ordena por data (mais recente primeiro)', () => {
    const docs = [{ id: 1, nomePrincipal: 'A', criadoEm: '2024-01-01' }];
    const pareceres = [
      { id: 2, processoNum: 'X', status: 'emitido', criadoEm: '2024-06-01' },
      { id: 3, processoNum: 'Y', status: 'rascunho', criadoEm: '2024-03-01' },
    ];
    const r = combinarPareceres(docs, pareceres);
    expect(r.map((x) => x.id)).toEqual(['pz-2', 'pz-3', 'doc-1']);
  });

  it('funciona com listas vazias', () => {
    expect(combinarPareceres([], [])).toEqual([]);
    expect(combinarPareceres()).toEqual([]);
  });
});

describe('versoesDoDocumento / versoesDoParecer', () => {
  it('versoesDoDocumento filtra pelo documento e ordena da mais nova p/ mais antiga', () => {
    const versoes = [
      { id: 'a', idDocumento: 1, versao: 1 },
      { id: 'b', idDocumento: 1, versao: 3 },
      { id: 'c', idDocumento: 2, versao: 1 },
      { id: 'd', idDocumento: 1, versao: 2 },
    ];
    expect(versoesDoDocumento(versoes, 1).map((v) => v.versao)).toEqual([3, 2, 1]);
  });

  it('versoesDoParecer compara parecerId como string e ordena desc', () => {
    const vs = [
      { parecerId: 5, versao: 1 },
      { parecerId: '5', versao: 2 },
      { parecerId: 9, versao: 1 },
    ];
    expect(versoesDoParecer(vs, '5').map((v) => v.versao)).toEqual([2, 1]);
  });
});

describe('versaoAtual', () => {
  const docs = [{ id: 1, idVersaoAtual: 'v2' }];
  const versoes = [{ id: 'v1', versao: 1 }, { id: 'v2', versao: 2 }];

  it('retorna a versão apontada por idVersaoAtual', () => {
    expect(versaoAtual(docs, versoes, 1)).toMatchObject({ id: 'v2', versao: 2 });
  });

  it('retorna null se o documento não existe', () => {
    expect(versaoAtual(docs, versoes, 999)).toBeNull();
  });
});

describe('inferirParecerInfo (estruturado > legado > nenhum)', () => {
  it('parecer estruturado EMITIDO usa emitidoEm e rótulo "Emitido"', () => {
    const proc = { id: 10 };
    const pareceres = [{ id: 1, processoId: 10, status: 'emitido', emitidoEm: '2024-06-01', atualizadoEm: '2024-05-01', criadoEm: '2024-04-01' }];
    const r = inferirParecerInfo(proc, pareceres, []);
    expect(r).toMatchObject({ tipo: 'estruturado', emitido: true, label: 'Emitido', dataRef: '2024-06-01' });
  });

  it('parecer estruturado RASCUNHO usa atualizadoEm||criadoEm', () => {
    const r = inferirParecerInfo({ id: 10 }, [{ id: 1, processoId: '10', status: 'rascunho', atualizadoEm: '2024-05-01', criadoEm: '2024-04-01' }], []);
    expect(r).toMatchObject({ tipo: 'estruturado', emitido: false, label: 'Rascunho', dataRef: '2024-05-01' });
  });

  it('sem estruturado, cai para o documento Word legado', () => {
    const proc = { id: 10, docId: 77 };
    const docs = [{ id: 77, nomePrincipal: 'Parecer.docx', criadoEm: '2024-01-01' }];
    const r = inferirParecerInfo(proc, [], docs);
    expect(r).toMatchObject({ tipo: 'legado', nomeDocumento: 'Parecer.docx', dataRef: '2024-01-01' });
  });

  it('docId aponta para documento inexistente → "legado-orfao"', () => {
    const r = inferirParecerInfo({ id: 10, docId: 77 }, [], []);
    expect(r.tipo).toBe('legado-orfao');
  });

  it('sem parecer e sem docId → null', () => {
    expect(inferirParecerInfo({ id: 10 }, [], [])).toBeNull();
  });
});
