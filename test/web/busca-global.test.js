// Testes da busca global (buscarGlobal em js/utils.js).
import utils from '../../js/utils.js';

const { buscarGlobal } = utils;
const itens = [
  { grupo: 'Processos', titulo: 'Processo 1234/2026', sub: 'Secretaria de Saúde', campos: ['Pedido de informação'] },
  { grupo: 'Processos', titulo: 'Processo 5678/2025', sub: 'Mesa Diretora', campos: ['Licitação de obras'] },
  { grupo: 'Leis', titulo: 'Lei nº 1.234/2001', sub: 'Dispõe sobre a saúde pública' },
  { grupo: 'Telas', titulo: 'Processos' },
];
const titulos = (r) => r.map((x) => x.titulo);

describe('buscarGlobal', () => {
  it('ignora acento e maiúsculas', () => {
    expect(titulos(buscarGlobal(itens, 'SAUDE'))).toEqual(['Processo 1234/2026', 'Lei nº 1.234/2001']);
  });

  it('exige todos os termos', () => {
    expect(titulos(buscarGlobal(itens, 'processo obras'))).toEqual(['Processo 5678/2025']);
  });

  it('respeita a ordem dos grupos e prioriza o título', () => {
    const r = buscarGlobal(itens, 'processo', { ordemGrupos: ['Telas', 'Processos'] });
    expect(r[0].titulo).toBe('Processos');
    expect(r.map((x) => x.grupo)).toEqual(['Telas', 'Processos', 'Processos']);
  });

  it('limita por grupo e devolve vazio sem consulta', () => {
    expect(buscarGlobal(itens, 'processo', { porGrupo: 1 }).filter((x) => x.grupo === 'Processos')).toHaveLength(1);
    expect(buscarGlobal(itens, '   ')).toEqual([]);
  });
});
