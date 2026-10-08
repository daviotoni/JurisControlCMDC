// Testes do relatório mensal (relatorioMensal em js/utils.js).
import utils from '../../js/utils.js';

const { relatorioMensal } = utils;
const statusMap = { pendente: 'Pendente', 'em-analise': 'Em Análise', finalizado: 'Finalizado', arquivado: 'Arquivado' };
const hoje = new Date(Date.UTC(2026, 9, 20)); // 20/10/2026

const processos = [
  { num: 'A', tipo: 'administrativo', setorOrigem: 'Mesa', ent: '2026-10-02', saida: '2026-10-12', prazo: '2026-10-15', stat: 'finalizado', docId: 9 },
  { num: 'B', tipo: 'judicial', setorOrigem: 'Mesa', ent: '2026-10-05', prazo: '2026-10-10', saida: '2026-10-14', stat: 'finalizado' },
  { num: 'C', tipo: 'administrativo', setorOrigem: 'Saúde', ent: '2026-09-28', prazo: '2026-10-18', stat: 'pendente' },
  { num: 'D', tipo: 'administrativo', ent: '2026-10-07', prazo: '2026-10-30', stat: 'em-analise' },
  { num: 'E', tipo: 'administrativo', ent: '2025-10-07', prazo: '2025-10-30', stat: 'arquivado' }, // outro ano
];
const pareceres = [{ status: 'emitido', emitidoEm: '2026-10-11T15:00:00Z' }, { status: 'rascunho', emitidoEm: '2026-10-11T15:00:00Z' }];

describe('relatorioMensal', () => {
  const r = relatorioMensal({ processos, pareceres, ano: 2026, mes: 9, hoje, statusMap });

  it('conta entradas do mês, por tipo e por setor', () => {
    expect(r.entradas).toMatchObject({ total: 3, administrativo: 2, judicial: 1 });
    expect(r.entradas.porSetor[0]).toEqual({ setor: 'Mesa', n: 2 });
  });

  it('conta saídas, pareceres emitidos e tempo de tramitação', () => {
    expect(r.saidas).toBe(2);
    expect(r.pareceresEmitidos).toBe(2); // A (docId + saída no mês) + 1 estruturado emitido
    expect(r.tramitacao).toEqual({ media: 10, mediana: 10, n: 2 }); // 10 e 9 dias
  });

  it('classifica os prazos do mês', () => {
    expect(r.prazos).toMatchObject({ total: 4, 'no-prazo': 1, 'fora-do-prazo': 1, vencido: 1, 'a-vencer': 1 });
    expect(r.prazos.atencao.map((x) => x.num)).toEqual(['B', 'C']);
  });

  it('mostra a carteira atual por status', () => {
    expect(r.emAberto).toBe(2);
    expect(r.situacaoAtual.find((s) => s.stat === 'arquivado').n).toBe(1);
  });
});
