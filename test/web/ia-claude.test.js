// Testes do fornecedor Claude do Assistente de IA (functions/ia-claude.js).
// Cobrem a lógica pura e o laço do copiloto com um cliente FALSO — nenhum teste
// chama a API de verdade (não gasta crédito).
import { describe, expect, it } from 'vitest';
import {
  FERRAMENTA_JURIS_CLAUDE,
  MODELO_CLAUDE_PADRAO,
  SCHEMA_COPILOTO,
  claudeCopiloto,
  claudeSimples,
  escolherProvedor,
  filtrarEdicoes,
  interpretarRespostaCopiloto,
  limparConteudoParaEco,
  mapearErroClaude,
  montarContextoCopiloto,
  montarMensagensClaude,
  textoDaResposta,
} from '../../functions/ia-claude.js';

// Cliente falso: devolve as respostas da fila, na ordem, e guarda os pedidos.
function clienteFalso(respostas) {
  const pedidos = [];
  return {
    pedidos,
    beta: {
      messages: {
        stream(params) {
          pedidos.push(JSON.parse(JSON.stringify(params)));
          const r = respostas.shift();
          return { finalMessage: async () => r };
        },
      },
    },
  };
}

const texto = (t) => ({ type: 'text', text: t });

describe('escolherProvedor', () => {
  it('sem configuração: Claude (Opus 5.5) se houver chave, senão Gemini', () => {
    expect(escolherProvedor({}, true)).toEqual({ provedor: 'claude', modelo: MODELO_CLAUDE_PADRAO });
    expect(escolherProvedor(undefined, false)).toEqual({ provedor: 'gemini', modelo: null });
  });
  it('respeita a escolha do admin', () => {
    expect(escolherProvedor({ provedor: 'gemini' }, true).provedor).toBe('gemini');
    expect(escolherProvedor({ provedor: 'claude', modelo: 'claude-sonnet-5-5' }, false))
      .toEqual({ provedor: 'claude', modelo: 'claude-sonnet-5-5' });
  });
  it('modelo desconhecido cai no padrão', () => {
    expect(escolherProvedor({ provedor: 'auto', modelo: 'gpt-x' }, true).modelo).toBe(MODELO_CLAUDE_PADRAO);
  });
});

describe('montagem das mensagens', () => {
  it('contexto lista as seções e corta o texto no limite', () => {
    const t = montarContextoCopiloto({ processoNum: '12/2026', secoes: ['I. RELATÓRIO'], texto: 'abcdef' }, 3);
    expect(t).toContain('Processo: 12/2026');
    expect(t).toContain('- I. RELATÓRIO');
    expect(t).toContain('"""\nabc\n"""');
    expect(montarContextoCopiloto({}, 10)).toContain('(nenhuma seção identificada)');
  });
  it('histórico vira user/assistant, sem começar pela IA e sem turnos vazios', () => {
    const msgs = montarMensagensClaude('CTX', [
      { papel: 'ia', texto: 'resposta solta' },
      { papel: 'usuario', texto: 'pergunta 1' },
      { papel: 'ia', texto: '' },
      { papel: 'ia', texto: 'resposta 1' },
    ], 'pedido novo');
    expect(msgs.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[0].content).toBe('pergunta 1');
    expect(msgs[2].content).toBe('CTX\n\nPEDIDO DO PROCURADOR:\npedido novo');
  });
});

describe('ferramenta e esquema', () => {
  it('a ferramenta tem o mesmo nome da do Gemini e exige termos', () => {
    expect(FERRAMENTA_JURIS_CLAUDE.name).toBe('buscar_jurisprudencia');
    expect(FERRAMENTA_JURIS_CLAUDE.input_schema.required).toEqual(['termos']);
    expect(FERRAMENTA_JURIS_CLAUDE.input_schema.additionalProperties).toBe(false);
  });
  it('o esquema fecha todos os objetos (exigência dos structured outputs)', () => {
    expect(SCHEMA_COPILOTO.additionalProperties).toBe(false);
    expect(SCHEMA_COPILOTO.properties.edicoes.items.additionalProperties).toBe(false);
  });
});

describe('interpretação da resposta', () => {
  it('lê o JSON e filtra edições inválidas', () => {
    const r = interpretarRespostaCopiloto(JSON.stringify({
      mensagem: 'Feito.',
      edicoes: [
        { acao: 'definir_ementa', conteudo: 'CONTRATO. PRORROGAÇÃO.' },
        { acao: 'apagar_tudo', conteudo: 'x' },
        { acao: 'inserir_final', conteudo: '   ' },
      ],
    }));
    expect(r.mensagem).toBe('Feito.');
    expect(r.edicoes).toEqual([{ acao: 'definir_ementa', conteudo: 'CONTRATO. PRORROGAÇÃO.' }]);
  });
  it('texto fora do formato vira só mensagem', () => {
    expect(interpretarRespostaCopiloto('Só uma resposta.')).toEqual({ mensagem: 'Só uma resposta.', edicoes: [] });
  });
  it('limita a 8 edições', () => {
    const muitas = Array.from({ length: 12 }, () => ({ acao: 'inserir_final', conteudo: 'a' }));
    expect(filtrarEdicoes(muitas)).toHaveLength(8);
    expect(filtrarEdicoes(null)).toEqual([]);
  });
  it('junta só os blocos de texto', () => {
    expect(textoDaResposta([{ type: 'thinking', thinking: '' }, texto('a'), texto('b')])).toBe('ab');
  });
});

describe('limparConteudoParaEco (troca de modelo no meio da resposta)', () => {
  it('sem troca, devolve igual', () => {
    const c = [{ type: 'thinking' }, { type: 'tool_use', id: '1' }];
    expect(limparConteudoParaEco(c)).toBe(c);
  });
  it('antes da última troca só fica texto; depois dela, tudo', () => {
    const c = [
      { type: 'thinking' }, texto('parcial'), { type: 'tool_use', id: 'a' },
      { type: 'fallback' },
      { type: 'thinking' }, { type: 'tool_use', id: 'b' },
    ];
    expect(limparConteudoParaEco(c).map(b => b.type + (b.id || ''))).toEqual(['text', 'thinking', 'tool_useb']);
  });
});

describe('mapearErroClaude', () => {
  it('traduz os erros mais comuns', () => {
    expect(mapearErroClaude({ status: 401 }).status).toBe(424);
    expect(mapearErroClaude({ status: 401 }).msg).toMatch(/inválida/);
    expect(mapearErroClaude({ status: 429 }).status).toBe(429);
    expect(mapearErroClaude({ status: 402 }).msg).toMatch(/créditos/);
    expect(mapearErroClaude({ status: 400, message: 'Your credit balance is too low to access the Anthropic API.' }).status).toBe(402);
    expect(mapearErroClaude({ status: 400, message: 'max_tokens: invalid' }).msg).toMatch(/recusou a requisição/);
  });
  it('5xx, sobrecarga e falha de conexão: "A IA não respondeu"', () => {
    expect(mapearErroClaude({ status: 529 }).msg).toMatch(/não respondeu/);
    expect(mapearErroClaude({ status: 500 }).status).toBe(502);
    expect(mapearErroClaude(new Error('Connection error.')).status).toBe(502);
  });
});

describe('claudeSimples', () => {
  it('envia esforço, fallback e sistema; devolve o texto', async () => {
    const c = clienteFalso([{ stop_reason: 'end_turn', content: [texto('Texto do parecer.')] }]);
    expect(await claudeSimples(c, 'claude-opus-5-5', 'SISTEMA', 'pedido')).toBe('Texto do parecer.');
    const p = c.pedidos[0];
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.output_config.effort).toBe('high');
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.system).toBe('SISTEMA');
    expect(p.thinking).toBeUndefined();
  });
  it('recusa vira erro 422 em português', async () => {
    const c = clienteFalso([{ stop_reason: 'refusal', content: [] }]);
    await expect(claudeSimples(c, 'claude-opus-5-5', 'S', 'p')).rejects.toMatchObject({ statusCliente: 422 });
  });
});

describe('claudeCopiloto', () => {
  const final = { stop_reason: 'end_turn', content: [texto(JSON.stringify({ mensagem: 'Pronto.', edicoes: [] }))] };

  it('executa a ferramenta, devolve tool_result e junta as fontes', async () => {
    const c = clienteFalso([
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'buscar_jurisprudencia', input: { termos: 'licitação' } }] },
      final,
    ]);
    const chamadas = [];
    const exec = async (nome, args, fontes) => { chamadas.push([nome, args]); fontes.push({ numero: '123' }); return { resultados: [{ numero: '123' }] }; };
    const r = await claudeCopiloto(c, 'claude-opus-5-5', 'SIS', 'CTX', [], 'busque', exec);
    expect(r).toEqual({ mensagem: 'Pronto.', edicoes: [], fontes: [{ numero: '123' }] });
    expect(chamadas).toEqual([['buscar_jurisprudencia', { termos: 'licitação' }]]);
    const segundo = c.pedidos[1];
    const ultimaMsg = segundo.messages[segundo.messages.length - 1];
    expect(ultimaMsg.role).toBe('user');
    expect(ultimaMsg.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    expect(ultimaMsg.content[0].is_error).toBeUndefined();
    expect(segundo.output_config.format.type).toBe('json_schema');
  });

  it('erro da ferramenta vai com is_error', async () => {
    const c = clienteFalso([
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'buscar_jurisprudencia', input: { termos: 'x' } }] },
      final,
    ]);
    await claudeCopiloto(c, 'm', 'S', 'C', [], 'p', async () => ({ erro: 'cota do dia' }));
    const res = c.pedidos[1].messages.at(-1).content[0];
    expect(res.is_error).toBe(true);
    expect(res.content).toContain('cota do dia');
  });

  it('no máximo 3 rodadas de ferramenta; a 4ª chamada desliga as ferramentas', async () => {
    const pedeFerramenta = () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'buscar_jurisprudencia', input: { termos: 'a' } }] });
    const c = clienteFalso([pedeFerramenta(), pedeFerramenta(), pedeFerramenta(), final]);
    let n = 0;
    await claudeCopiloto(c, 'm', 'S', 'C', [], 'p', async () => { n++; return { resultados: [] }; });
    expect(n).toBe(3);
    expect(c.pedidos).toHaveLength(4);
    expect(c.pedidos.map(p => p.tool_choice.type)).toEqual(['auto', 'auto', 'auto', 'none']);
  });

  it('não executa chamada de ferramenta cortada por max_tokens', async () => {
    const c = clienteFalso([{ stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 't', name: 'buscar_jurisprudencia', input: {} }] }]);
    let executou = false;
    await expect(claudeCopiloto(c, 'm', 'S', 'C', [], 'p', async () => { executou = true; return {}; }))
      .rejects.toMatchObject({ statusCliente: 422 });
    expect(executou).toBe(false);
  });
});
