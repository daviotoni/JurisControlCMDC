// Testes da lógica pura de filtro/busca/ordenação de processos
// (filtrarOrdenarProcessos em js/utils.js), o coração da tela de processos.
import utils from '../../js/utils.js';

const { filtrarOrdenarProcessos } = utils;

// YYYY-MM-DD deslocado de hoje, em UTC (determinístico; não usa o ymd local).
const dia = (offset) => {
  const d = utils.todayUTC();
  d.setUTCDate(d.getUTCDate() + offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const statusMap = {
  pendente: 'Pendente', 'em-analise': 'Em Análise', finalizado: 'Finalizado', arquivado: 'Arquivado',
};

let seq = 0;
const proc = (over = {}) => ({
  id: ++seq, num: `P-${seq}`, int: 'Interessado', obj: 'Objeto', acao: '',
  setorOrigem: 'CPL', dest: '', stat: 'pendente', tipo: 'administrativo',
  emissorId: '', ent: '2024-03-10', prazo: '', ...over,
});

const nums = (lista) => lista.map((p) => p.num);

describe('busca textual', () => {
  it('encontra por número, interessado, objeto, setor e ação', () => {
    const db = [
      proc({ num: 'ABC-1', int: 'Maria' }),
      proc({ num: 'XYZ-2', obj: 'Contrato de obra' }),
      proc({ num: 'ZZZ-3', acao: 'Arquivamento' }),
    ];
    expect(nums(filtrarOrdenarProcessos(db, { busca: 'maria', statusMap }))).toEqual(['ABC-1']);
    expect(nums(filtrarOrdenarProcessos(db, { busca: 'obra', statusMap }))).toEqual(['XYZ-2']);
    expect(nums(filtrarOrdenarProcessos(db, { busca: 'arquiv', statusMap }))).toEqual(['ZZZ-3']);
  });

  it('busca pelo rótulo de status (statusMap), não só pela chave', () => {
    const db = [proc({ num: 'A', stat: 'em-analise' }), proc({ num: 'B', stat: 'pendente' })];
    expect(nums(filtrarOrdenarProcessos(db, { busca: 'análise', statusMap }))).toEqual(['A']);
  });

  it('é insensível a maiúsculas e ignora espaços nas pontas', () => {
    const db = [proc({ num: 'A', int: 'João Silva' })];
    expect(filtrarOrdenarProcessos(db, { busca: '  SILVA ', statusMap })).toHaveLength(1);
  });

  it('busca vazia devolve todos', () => {
    const db = [proc(), proc(), proc()];
    expect(filtrarOrdenarProcessos(db, { busca: '', statusMap })).toHaveLength(3);
  });
});

describe('filtros por campo', () => {
  it('status', () => {
    const db = [proc({ num: 'A', stat: 'pendente' }), proc({ num: 'B', stat: 'finalizado' })];
    expect(nums(filtrarOrdenarProcessos(db, { status: 'finalizado' }))).toEqual(['B']);
  });

  it('setor casa tanto origem quanto destino', () => {
    const db = [
      proc({ num: 'A', setorOrigem: 'CPL', dest: '' }),
      proc({ num: 'B', setorOrigem: 'RH', dest: 'CPL' }),
      proc({ num: 'C', setorOrigem: 'RH', dest: 'Presidência' }),
    ];
    expect(nums(filtrarOrdenarProcessos(db, { setor: 'CPL' })).sort()).toEqual(['A', 'B']);
  });

  it('tipo', () => {
    const db = [proc({ num: 'A', tipo: 'judicial' }), proc({ num: 'B', tipo: 'administrativo' })];
    expect(nums(filtrarOrdenarProcessos(db, { tipo: 'judicial' }))).toEqual(['A']);
  });

  it('emissor compara como string (aceita id numérico)', () => {
    const db = [proc({ num: 'A', emissorId: 5 }), proc({ num: 'B', emissorId: 9 })];
    expect(nums(filtrarOrdenarProcessos(db, { emissor: '5' }))).toEqual(['A']);
  });

  it('intervalo de data de entrada (de/até, inclusivo)', () => {
    const db = [
      proc({ num: 'A', ent: '2024-01-01' }),
      proc({ num: 'B', ent: '2024-03-15' }),
      proc({ num: 'C', ent: '2024-06-30' }),
    ];
    const r = filtrarOrdenarProcessos(db, { entradaDe: '2024-02-01', entradaAte: '2024-04-01' });
    expect(nums(r)).toEqual(['B']);
  });
});

describe('initialFilter (atalhos do dashboard)', () => {
  it('prazo "vencido": só ativos com prazo no passado', () => {
    const db = [
      proc({ num: 'V', prazo: dia(-2) }),
      proc({ num: 'F', prazo: dia(-2), stat: 'finalizado' }), // inativo, não conta
      proc({ num: 'OK', prazo: dia(5) }),
    ];
    expect(nums(filtrarOrdenarProcessos(db, { initialFilter: { prazo: 'vencido' } }))).toEqual(['V']);
  });

  it('prazo "alerta": ativos vencendo entre hoje e 5 dias', () => {
    const db = [
      proc({ num: 'A', prazo: dia(0) }),
      proc({ num: 'B', prazo: dia(5) }),
      proc({ num: 'C', prazo: dia(6) }), // fora
      proc({ num: 'D', prazo: dia(-1) }), // vencido, não é alerta
    ];
    expect(nums(filtrarOrdenarProcessos(db, { initialFilter: { prazo: 'alerta' } })).sort()).toEqual(['A', 'B']);
  });

  it('month filtra pelo mês (UTC) da data de entrada', () => {
    const db = [
      proc({ num: 'JAN', ent: '2024-01-20' }),
      proc({ num: 'MAR', ent: '2024-03-05' }),
    ];
    // month é 0-based; 2 = março.
    expect(nums(filtrarOrdenarProcessos(db, { initialFilter: { month: 2 } }))).toEqual(['MAR']);
  });
});

describe('ordenação', () => {
  it('por prazo crescente, sem-prazo por último', () => {
    const db = [
      proc({ num: 'SEM', prazo: '' }),
      proc({ num: 'TARDE', prazo: '2024-12-31' }),
      proc({ num: 'CEDO', prazo: '2024-01-01' }),
    ];
    expect(nums(filtrarOrdenarProcessos(db, { ordem: 'prazo' }))).toEqual(['CEDO', 'TARDE', 'SEM']);
  });

  it('por status (ordem alfabética da chave)', () => {
    const db = [proc({ num: 'P', stat: 'pendente' }), proc({ num: 'A', stat: 'arquivado' })];
    expect(nums(filtrarOrdenarProcessos(db, { ordem: 'status' }))).toEqual(['A', 'P']);
  });

  it('padrão: por entrada decrescente (mais recente primeiro)', () => {
    const db = [
      proc({ num: 'VELHO', ent: '2024-01-01' }),
      proc({ num: 'NOVO', ent: '2024-06-01' }),
    ];
    expect(nums(filtrarOrdenarProcessos(db, {}))).toEqual(['NOVO', 'VELHO']);
  });
});

describe('robustez', () => {
  it('não muta a lista original', () => {
    const db = [proc({ num: 'A', ent: '2024-01-01' }), proc({ num: 'B', ent: '2024-06-01' })];
    const antes = nums(db);
    filtrarOrdenarProcessos(db, { ordem: 'prazo' });
    expect(nums(db)).toEqual(antes);
  });

  it('combina busca + filtro + ordenação', () => {
    const db = [
      proc({ num: 'A', int: 'Obra X', stat: 'pendente', ent: '2024-02-01' }),
      proc({ num: 'B', int: 'Obra Y', stat: 'pendente', ent: '2024-05-01' }),
      proc({ num: 'C', int: 'Outro', stat: 'pendente', ent: '2024-03-01' }),
    ];
    const r = filtrarOrdenarProcessos(db, { busca: 'obra', status: 'pendente', ordem: 'entrada', statusMap });
    expect(nums(r)).toEqual(['B', 'A']); // só as "Obra", entrada desc
  });
});
