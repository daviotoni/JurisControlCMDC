// Testes dos seletores de design tokens (mobile/src/theme/tokens.ts).
// São puros e a UI depende do comportamento de FALLBACK deles (chave
// desconhecida → primeiro item), então vale travá-lo.
import { catByKey, statusByKey, STATUS, CATS } from '../../mobile/src/theme/tokens';

describe('statusByKey', () => {
  it('retorna o status correspondente à chave', () => {
    expect(statusByKey('finalizado').label).toBe('Finalizado');
    expect(statusByKey('em-analise').key).toBe('em-analise');
  });

  it('faz fallback para o primeiro status quando a chave é desconhecida', () => {
    expect(statusByKey('inexistente')).toBe(STATUS[0]);
    expect(statusByKey(undefined)).toBe(STATUS[0]);
  });
});

describe('catByKey', () => {
  it('retorna a categoria correspondente à chave', () => {
    expect(catByKey('a').label).toBe('Audiência');
    expect(catByKey('u').label).toBe('Urgente');
  });

  it('faz fallback para a primeira categoria quando a chave é desconhecida', () => {
    expect(catByKey('z')).toBe(CATS[0]);
    expect(catByKey(undefined)).toBe(CATS[0]);
  });
});

describe('integridade das tabelas', () => {
  it('as chaves de STATUS batem com a whitelist VALID_STATS do web', () => {
    // Mesmo conjunto usado em js/utils.js (safeCSSClass). Divergência aqui
    // significa desalinhamento entre mobile e web.
    expect(STATUS.map((s) => s.key).sort()).toEqual(
      ['aguardando-documentacao', 'arquivado', 'em-analise', 'em-diligencia', 'finalizado', 'pendente'],
    );
  });

  it('as chaves de CATS batem com a whitelist VALID_CAT do web', () => {
    expect(CATS.map((c) => c.key).sort()).toEqual(['a', 'e', 'g', 'o', 'p', 'r', 'u']);
  });
});
