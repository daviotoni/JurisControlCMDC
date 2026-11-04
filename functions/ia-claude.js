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

// ===== Recursos fora do editor: só com o Claude ==============================

function erro422(msg) {
  const e = new Error(msg);
  e.statusCliente = 422;
  return e;
}

// Chamada única com saída estruturada (JSON garantido pelo esquema).
async function claudeEstruturado(client, modelo, { sistema, content, schema, esforco }) {
  const resposta = await client.beta.messages.stream({
    ...paramsBase(modelo),
    output_config: { effort: esforco, format: { type: 'json_schema', schema } },
    system: sistema,
    messages: [{ role: 'user', content }],
  }).finalMessage();
  checarRecusa(resposta);
  if (resposta.stop_reason === 'max_tokens') throw erro422('A resposta da IA foi cortada no meio. Tente de novo.');
  const json = extrairJsonDaResposta(textoDaResposta(resposta.content));
  if (!json) throw erro422('A IA não devolveu uma resposta válida. Tente de novo.');
  return json;
}

// ----- 1) Preencher o cadastro do processo a partir do documento -------------
const ARQ_MAX_BASE64 = 14 * 1024 * 1024; // ~10 MB de arquivo
const ARQ_MAX_TEXTO = 150000;            // caracteres (Word ou texto extraído)
const MIME_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];

const SISTEMA_EXTRACAO =
  'Você auxilia o cadastro de processos na Procuradoria-Geral da Câmara Municipal de ' +
  'Duque de Caxias (RJ). Recebe o documento que deu origem ao processo (ofício, ' +
  'requerimento, capa de processo, projeto de lei, intimação etc.) e extrai os dados ' +
  'do cadastro. Regras: (1) Copie o número do processo exatamente como aparece ' +
  '(ex.: "1305/2026" ou o número CNJ completo de um processo judicial). (2) tipo é ' +
  '"judicial" quando há processo em tribunal (número CNJ, vara, intimação judicial); ' +
  'senão "administrativo". (3) interessado é quem pede ou é parte principal (ex.: ' +
  '"Vereador Fulano de Tal", "Secretaria Geral"). (4) objeto é um resumo objetivo, de ' +
  'uma a duas frases, do que o processo trata. (5) setorOrigem deve ser UM dos ' +
  'setores da lista fornecida, copiado exatamente, ou "" se nenhum couber. (6) ' +
  'prazoDias só quando o documento fixar um prazo em dias para a resposta; senão 0. ' +
  'prazoContagem: "uteis" ou "corridos" conforme o documento, "" se não disser. (7) ' +
  'NUNCA invente: campo que não estiver no documento fica "" (ou 0). (8) Em ' +
  'observacao, diga em uma frase o que ficou incerto e precisa de conferência, ou "".';

const SCHEMA_EXTRACAO = {
  type: 'object',
  properties: {
    numero: { type: 'string' },
    tipo: { type: 'string', enum: ['administrativo', 'judicial'] },
    interessado: { type: 'string' },
    objeto: { type: 'string' },
    setorOrigem: { type: 'string' },
    prazoDias: { type: 'integer' },
    prazoContagem: { type: 'string', enum: ['uteis', 'corridos', ''] },
    observacao: { type: 'string' },
  },
  required: ['numero', 'tipo', 'interessado', 'objeto', 'setorOrigem', 'prazoDias', 'prazoContagem', 'observacao'],
  additionalProperties: false,
};

// Arquivo enviado pelo site -> blocos de conteúdo da API. Lança erro 400 em
// português se o arquivo não servir. Formatos: { tipo: 'pdf', dados } |
// { tipo: 'imagem', mime, dados } | { tipo: 'texto', texto } (Word já convertido no navegador).
function montarConteudoArquivo(arquivo) {
  const a = arquivo || {};
  const falha = (msg) => { const e = new Error(msg); e.statusCliente = 400; return e; };
  if (a.tipo === 'pdf' || a.tipo === 'imagem') {
    const dados = String(a.dados || '');
    if (!dados || !/^[A-Za-z0-9+/=\s]+$/.test(dados)) throw falha('Arquivo vazio ou corrompido.');
    if (dados.length > ARQ_MAX_BASE64) throw falha('Arquivo grande demais (máx. 10 MB). Envie só as páginas principais.');
    if (a.tipo === 'pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dados.replace(/\s/g, '') } };
    }
    if (!MIME_IMAGEM.includes(a.mime)) throw falha('Imagem em formato não aceito (use JPG, PNG ou WEBP).');
    return { type: 'image', source: { type: 'base64', media_type: a.mime, data: dados.replace(/\s/g, '') } };
  }
  if (a.tipo === 'texto') {
    const texto = String(a.texto || '').trim();
    if (!texto) throw falha('Não encontrei texto no arquivo.');
    return { type: 'text', text: `DOCUMENTO:\n"""\n${texto.slice(0, ARQ_MAX_TEXTO)}\n"""` };
  }
  throw falha('Formato de arquivo não aceito. Use PDF, Word (.docx), TXT ou imagem.');
}

// Limpa a resposta da extração: setor fora da lista vira "", prazo fora da faixa vira 0.
function normalizarExtracao(json, setores) {
  const j = json || {};
  const txt = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const lista = Array.isArray(setores) ? setores : [];
  const setor = txt(j.setorOrigem, 80);
  const dias = Number.isInteger(j.prazoDias) && j.prazoDias > 0 && j.prazoDias <= 3650 ? j.prazoDias : 0;
  return {
    numero: txt(j.numero, 60),
    tipo: j.tipo === 'judicial' ? 'judicial' : 'administrativo',
    interessado: txt(j.interessado, 200),
    objeto: txt(j.objeto, 1000),
    setorOrigem: lista.includes(setor) ? setor : '',
    prazoDias: dias,
    prazoContagem: dias && ['uteis', 'corridos'].includes(j.prazoContagem) ? j.prazoContagem : '',
    observacao: txt(j.observacao, 300),
  };
}

async function claudeExtrairProcesso(client, modelo, arquivo, setores) {
  const lista = (Array.isArray(setores) ? setores : []).map(s => String(s).slice(0, 60)).slice(0, 40);
  const json = await claudeEstruturado(client, modelo, {
    sistema: SISTEMA_EXTRACAO,
    esforco: 'medium',
    schema: SCHEMA_EXTRACAO,
    content: [
      montarConteudoArquivo(arquivo),
      { type: 'text', text: `Setores possíveis: ${lista.join('; ') || '(nenhum)'}\nExtraia os dados do cadastro deste documento.` },
    ],
  });
  return normalizarExtracao(json, lista);
}

// ----- 2) Revisão final do parecer -------------------------------------------
const SISTEMA_REVISAO =
  'Você é o revisor final dos pareceres da Procuradoria-Geral da Câmara Municipal de ' +
  'Duque de Caxias (RJ). Recebe o parecer pronto para emissão e aponta APENAS problemas ' +
  'concretos que o procurador deve corrigir antes de assinar. Verifique: (a) se a ' +
  'ementa corresponde à conclusão (ex.: ementa diz "possibilidade" e a conclusão opina ' +
  'pela inviabilidade); (b) seções vazias ou com marcadores a preencher ("[...]", ' +
  '"[dia]", "[Nome]"); (c) contradições entre a análise e a conclusão; (d) conclusão ' +
  'sem opinião clara (favorável, desfavorável ou com ressalvas); (e) citações de lei, ' +
  'súmula ou julgado com número, ano ou órgão aparentemente errados ou incompletos — ' +
  'nesse caso peça para CONFERIR, sem afirmar que está errado; (f) julgado citado sem ' +
  'tribunal e número; (g) erros de português que comprometam o sentido. Não reescreva o ' +
  'parecer, não opine sobre o mérito jurídico e não aponte questões de estilo. ' +
  'gravidade: "alta" impede a emissão, "media" deve ser corrigida, "baixa" é ' +
  'recomendação. No máximo 10 pontos, os mais importantes primeiro. Em "trecho", copie ' +
  'até 15 palavras do texto onde está o problema (ou "" se for algo que falta). Se não ' +
  'houver nada relevante, devolva "pontos": [] e diga isso no resumo.';

const SCHEMA_REVISAO = {
  type: 'object',
  properties: {
    resumo: { type: 'string' },
    pontos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          secao: { type: 'string' },
          trecho: { type: 'string' },
          problema: { type: 'string' },
          sugestao: { type: 'string' },
        },
        required: ['gravidade', 'secao', 'trecho', 'problema', 'sugestao'],
        additionalProperties: false,
      },
    },
  },
  required: ['resumo', 'pontos'],
  additionalProperties: false,
};

const ORDEM_GRAVIDADE = { alta: 0, media: 1, baixa: 2 };

function normalizarRevisao(json) {
  const j = json || {};
  const txt = (v, max) => String(v || '').trim().slice(0, max);
  const pontos = (Array.isArray(j.pontos) ? j.pontos : [])
    .filter(p => p && ORDEM_GRAVIDADE[p.gravidade] !== undefined && txt(p.problema, 10))
    .map(p => ({
      gravidade: p.gravidade,
      secao: txt(p.secao, 120),
      trecho: txt(p.trecho, 200),
      problema: txt(p.problema, 600),
      sugestao: txt(p.sugestao, 600),
    }))
    .sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade])
    .slice(0, 10);
  const resumo = txt(j.resumo, 600) || (pontos.length ? '' : 'Nenhum problema relevante encontrado.');
  return { resumo, pontos };
}

async function claudeRevisarParecer(client, modelo, contextoTxt) {
  const json = await claudeEstruturado(client, modelo, {
    sistema: SISTEMA_REVISAO,
    esforco: 'high',
    schema: SCHEMA_REVISAO,
    content: [{ type: 'text', text: `${contextoTxt}\n\nFaça a revisão final deste parecer.` }],
  });
  return normalizarRevisao(json);
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
  SCHEMA_EXTRACAO,
  SCHEMA_REVISAO,
  montarConteudoArquivo,
  normalizarExtracao,
  normalizarRevisao,
  claudeExtrairProcesso,
  claudeRevisarParecer,
};
