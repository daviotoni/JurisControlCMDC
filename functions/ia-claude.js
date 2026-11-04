// functions/ia-claude.js
// Fornecedor Claude (API da Anthropic) do Assistente de IA do JurisControl.
//
// Usado pela Cloud Function `assistente` (functions/index.js) nos dois modos:
//   - simples:  ({ prompt, sistema })              -> { texto }
//   - copiloto: ({ contexto, historico, prompt })  -> { mensagem, edicoes[], fontes[] }
// As saídas são as MESMAS do Gemini, para o front não mudar.
//
// A chave fica em segredos/claude (campo token) e a escolha do fornecedor e do
// modelo em segredos/ia ({ provedor, modelo }) — ambos admin-only nas rules.
//
// As funções puras (montagem de mensagens, esquema, filtro de edições, eco do
// fallback, mapeamento de erros) são exportadas e testadas em
// test/web/ia-claude.test.js. As chamadas de rede recebem o cliente como
// parâmetro, o que permite testar o laço do copiloto com um cliente falso.
'use strict';

// Modelos oferecidos em Configurações. Opus 5.5 = melhor qualidade;
// Sonnet 5.5 = metade do preço por token.
const MODELOS_CLAUDE = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
};
const MODELO_CLAUDE_PADRAO = 'claude-opus-5-5';

// Esforço de raciocínio. No Opus 5.5 o padrão da API é "medium"; pareceres
// pedem análise cuidadosa, então fixamos "high" explicitamente nos dois modos.
const CLAUDE_ESFORCO = 'high';
// Teto de saída (inclui o raciocínio). Com streaming não há risco de estourar
// o tempo da requisição HTTP; o custo é pelo que de fato for gerado.
const CLAUDE_MAX_TOKENS = 32000;
const CLAUDE_MAX_RODADAS_FERRAMENTA = 3;
// Recusa pelos filtros de segurança: a API tenta de novo, no próprio servidor,
// no modelo que a Anthropic recomenda para aquela categoria.
const CLAUDE_BETAS = ['server-side-fallback-2026-07-01'];

const ACOES_EDICAO = ['substituir_secao', 'inserir_na_secao', 'definir_ementa', 'inserir_final'];

// Esquema da resposta do copiloto (structured outputs): a API garante JSON
// válido nesse formato, sem precisar raspar texto.
const SCHEMA_COPILOTO = {
  type: 'object',
  properties: {
    mensagem: { type: 'string', description: 'Resposta curta ao procurador.' },
    edicoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          acao: { type: 'string', enum: ACOES_EDICAO },
          secao: { type: 'string', description: 'Título EXATO da seção alvo; omitir em definir_ementa e inserir_final.' },
          conteudo: { type: 'string', description: 'Texto a inserir no documento.' },
        },
        required: ['acao', 'conteudo'],
        additionalProperties: false,
      },
    },
  },
  required: ['mensagem', 'edicoes'],
  additionalProperties: false,
};

const TRIBUNAIS_FERRAMENTA = ['tjrj', 'stj', 'stf', 'tjsp', 'tjmg', 'tjrs', 'tjpr', 'tjsc', 'tjce', 'tjgo', 'tjma', 'tjmt', 'trf3', 'trf4', 'tst', 'carf'];

// A mesma ferramenta do Gemini, no formato de tool use do Claude.
const FERRAMENTA_JURIS_CLAUDE = {
  name: 'buscar_jurisprudencia',
  description: 'Busca decisões judiciais reais no acervo do Jurisprudências.ai. Use SEMPRE que precisar citar jurisprudência. Retorna título, tribunal, número, relator, órgão, data e ementa de cada decisão.',
  // Entrada transmitida aos poucos (streaming): a API não valida o esquema,
  // então executarFerramentaIA (index.js) valida termos e tribunal.
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      termos: { type: 'string', description: 'Termos de busca (ex.: "prorrogação contrato serviço contínuo art. 107")' },
      tribunal: { type: 'string', enum: TRIBUNAIS_FERRAMENTA, description: 'Sigla do tribunal em minúsculas; tjrj é o padrão.' },
    },
    required: ['termos'],
    additionalProperties: false,
  },
};

// Decide quem responde. Regra: a escolha salva pelo admin em segredos/ia vale;
// sem escolha (ou "auto"), usa o Claude se houver chave, senão o Gemini.
function escolherProvedor(cfg, temChaveClaude) {
  const c = cfg || {};
  const modelo = MODELOS_CLAUDE[c.modelo] ? c.modelo : MODELO_CLAUDE_PADRAO;
  if (c.provedor === 'gemini') return { provedor: 'gemini', modelo: null };
  if (c.provedor === 'claude') return { provedor: 'claude', modelo };
  return temChaveClaude ? { provedor: 'claude', modelo } : { provedor: 'gemini', modelo: null };
}

// Texto de contexto do documento (o mesmo para Claude e Gemini).
function montarContextoCopiloto(contexto, maxDoc) {
  const ctx = contexto || {};
  const secoes = (ctx.secoes || []).map(s => `- ${s}`).join('\n') || '(nenhuma seção identificada)';
  return `CONTEXTO DO DOCUMENTO\n` +
    `Processo: ${ctx.processoNum || '(sem número)'}\n` +
    `Ementa atual: ${ctx.ementa || '(vazia)'}\n` +
    `Seções do parecer:\n${secoes}\n\n` +
    `TEXTO ATUAL DO PARECER:\n"""\n${String(ctx.texto || '').slice(0, maxDoc)}\n"""`;
}

// Histórico do painel ({ papel: 'usuario'|'ia', texto }) -> mensagens da API.
// A conversa precisa começar pelo usuário; turnos vazios são descartados.
function montarMensagensClaude(contextoTxt, historico, prompt) {
  const mensagens = [];
  (historico || []).slice(-8).forEach(m => {
    const texto = String((m && m.texto) || '').slice(0, 4000).trim();
    if (!texto) return;
    const role = m.papel === 'ia' ? 'assistant' : 'user';
    if (!mensagens.length && role === 'assistant') return;
    mensagens.push({ role, content: texto });
  });
  mensagens.push({ role: 'user', content: `${contextoTxt}\n\nPEDIDO DO PROCURADOR:\n${prompt}` });
  return mensagens;
}

function textoDaResposta(content) {
  return (content || []).filter(b => b && b.type === 'text').map(b => b.text || '').join('').trim();
}

// Extrai o primeiro objeto JSON de um texto (tolerante a cercas ```json ... ```).
function extrairJsonDaResposta(texto) {
  const limpo = String(texto).replace(/```json/gi, '```').replace(/```/g, '').trim();
  try { return JSON.parse(limpo); } catch (e) { /* tenta pelo recorte abaixo */ }
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch (e) { /* cai no fallback */ }
  }
  return null;
}

function filtrarEdicoes(edicoes) {
  if (!Array.isArray(edicoes)) return [];
  return edicoes.filter(e =>
    e && typeof e.conteudo === 'string' && e.conteudo.trim() && ACOES_EDICAO.includes(e.acao)
  ).slice(0, 8);
}

// Resposta final do copiloto -> { mensagem, edicoes }. Se por algum motivo o
// texto não vier no JSON esperado, trata tudo como mensagem (sem edições).
function interpretarRespostaCopiloto(texto) {
  const json = extrairJsonDaResposta(texto);
  if (json && typeof json.mensagem === 'string') {
    return { mensagem: json.mensagem, edicoes: filtrarEdicoes(json.edicoes) };
  }
  return { mensagem: String(texto || '').trim(), edicoes: [] };
}

// Ao devolver à API um turno em que houve troca de modelo no meio da resposta
// (bloco "fallback"), os blocos internos ANTERIORES à última troca (raciocínio,
// chamadas de ferramenta) não podem ser repetidos; o texto pode.
function limparConteudoParaEco(content) {
  const blocos = content || [];
  let ultimo = -1;
  blocos.forEach((b, i) => { if (b && b.type === 'fallback') ultimo = i; });
  if (ultimo < 0) return blocos;
  return blocos.filter((b, i) => i > ultimo || (i < ultimo && b.type === 'text'));
}

// Erro da API -> { status, msg } em português para o painel. Usa o status HTTP
// tipado dos erros do SDK (APIConnectionError não tem status).
function mapearErroClaude(e) {
  const status = e && typeof e.status === 'number' ? e.status : null;
  const detalhe = String((e && e.message) || '').slice(0, 300);
  const semCredito = status === 402 || (status === 400 && /credit balance/i.test(detalhe));
  if (semCredito) {
    return { status: 402, msg: 'Os créditos de API do Claude acabaram ou o limite de gasto do workspace foi atingido. Um administrador pode conferir em platform.claude.com → Billing.' };
  }
  if (status === 401) {
    return { status: 424, msg: 'Chave da API do Claude inválida ou revogada. Gere uma nova em platform.claude.com → API Keys e cole em Configurações → Assistente de IA (Claude).' };
  }
  if (status === 403) {
    return { status: 424, msg: 'A chave do Claude não tem permissão para usar este modelo ou workspace. Confira a chave em platform.claude.com.' };
  }
  if (status === 404) {
    return { status: 424, msg: `O modelo escolhido não está disponível para esta chave. Troque o modelo em Configurações. [detalhe: ${detalhe}]` };
  }
  if (status === 429) {
    return { status: 429, msg: 'Limite de uso da API do Claude atingido por ora. Aguarde um ou dois minutos e tente de novo.' };
  }
  if (status === 400 || status === 413) {
    return { status: 424, msg: `O Claude recusou a requisição: ${detalhe}` };
  }
  return { status: 502, msg: 'A IA não respondeu. Tente novamente em instantes.' };
}

function criarClienteClaude(chave) {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  // 1 nova tentativa automática (429/5xx/conexão) e até 4 min por chamada.
  return new Anthropic({ apiKey: chave, maxRetries: 1, timeout: 240000 });
}

// Parâmetros comuns a todas as chamadas.
function paramsBase(modelo) {
  return {
    model: modelo,
    max_tokens: CLAUDE_MAX_TOKENS,
    betas: CLAUDE_BETAS,
    fallbacks: 'default',
  };
}

function checarRecusa(resposta) {
  if (resposta.stop_reason === 'refusal') {
    const e = new Error('O Claude recusou o pedido pelos filtros de segurança. Reformule o pedido e tente de novo.');
    e.statusCliente = 422;
    throw e;
  }
}

// Modo simples: um pedido, um texto.
async function claudeSimples(client, modelo, sistema, prompt) {
  const resposta = await client.beta.messages.stream({
    ...paramsBase(modelo),
    output_config: { effort: CLAUDE_ESFORCO },
    system: sistema,
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();
  checarRecusa(resposta);
  const texto = textoDaResposta(resposta.content);
  if (!texto) {
    const e = new Error('A IA retornou resposta vazia. Reformule o pedido e tente de novo.');
    e.statusCliente = 422;
    throw e;
  }
  return texto;
}

// Modo copiloto: até 3 rodadas de ferramenta; na última chamada as ferramentas
// ficam desligadas (tool_choice "none") para obrigar a resposta final.
// `executarFerramenta(nome, args, fontes)` nunca lança: devolve { erro } ou o resultado.
async function claudeCopiloto(client, modelo, sistema, contextoTxt, historico, prompt, executarFerramenta) {
  const fontes = [];
  const messages = montarMensagensClaude(contextoTxt, historico, prompt);
  let resposta = null;

  for (let rodada = 0; rodada <= CLAUDE_MAX_RODADAS_FERRAMENTA; rodada++) {
    const ultima = rodada === CLAUDE_MAX_RODADAS_FERRAMENTA;
    resposta = await client.beta.messages.stream({
      ...paramsBase(modelo),
      // Cache automático: entre as rodadas de ferramenta o prefixo (sistema +
      // documento) se repete e passa a custar ~10% do preço de entrada.
      cache_control: { type: 'ephemeral' },
      output_config: { effort: CLAUDE_ESFORCO, format: { type: 'json_schema', schema: SCHEMA_COPILOTO } },
      system: sistema,
      tools: [FERRAMENTA_JURIS_CLAUDE],
      tool_choice: { type: ultima ? 'none' : 'auto' },
      messages,
    }).finalMessage();
    checarRecusa(resposta);

    const chamadas = (resposta.content || []).filter(b => b.type === 'tool_use');
    if (resposta.stop_reason === 'max_tokens' && chamadas.length) {
      // A chamada de ferramenta veio cortada: não executa entrada incompleta.
      const e = new Error('A resposta da IA foi cortada no meio. Tente um pedido mais curto.');
      e.statusCliente = 422;
      throw e;
    }
    if (resposta.stop_reason !== 'tool_use' || !chamadas.length) break;

    messages.push({ role: 'assistant', content: limparConteudoParaEco(resposta.content) });
    // Todas as chamadas da rodada são respondidas numa única mensagem.
    const resultados = [];
    for (const chamada of chamadas) {
      const args = chamada.input && typeof chamada.input === 'object' ? chamada.input : {};
      const r = await executarFerramenta(chamada.name, args, fontes);
      resultados.push({
        type: 'tool_result',
        tool_use_id: chamada.id,
        content: JSON.stringify(r),
        ...(r && r.erro ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: resultados });
  }

  const texto = textoDaResposta(resposta.content);
  if (!texto) {
    const e = new Error('A IA retornou resposta vazia. Reformule o pedido e tente de novo.');
    e.statusCliente = 422;
    throw e;
  }
  return { ...interpretarRespostaCopiloto(texto), fontes };
}

module.exports = {
  MODELOS_CLAUDE,
  MODELO_CLAUDE_PADRAO,
  CLAUDE_ESFORCO,
  SCHEMA_COPILOTO,
  FERRAMENTA_JURIS_CLAUDE,
  escolherProvedor,
  montarContextoCopiloto,
  montarMensagensClaude,
  textoDaResposta,
  extrairJsonDaResposta,
  filtrarEdicoes,
  interpretarRespostaCopiloto,
  limparConteudoParaEco,
  mapearErroClaude,
  criarClienteClaude,
  claudeSimples,
  claudeCopiloto,
};
