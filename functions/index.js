// functions/index.js
// Cloud Function `juris` — proxy de busca de jurisprudência do JurisControl.
//
// Por que existe: o site é estático (GitHub Pages) e não pode chamar as APIs
// jurídicas direto do navegador (CORS + chaves). Esta função roda no Firebase,
// valida o usuário (ID token + perfil APROVADO em perfis/{uid}) e consulta:
//   - LexML (SRU, público):      busca por TEMA — jurisprudência STF/STJ e legislação
//   - Datajud/CNJ (chave pública): dados de um processo pelo NÚMERO CNJ
//
// Publicação (exige plano Blaze — ver DEPLOY.md):
//   firebase deploy --only functions --token "<TOKEN>" --project juriscontrolcmdc
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { normalizarLexml, normalizarDatajud, normalizarJurisai } = require('./normalizadores');

initializeApp();

// Espelha BOOTSTRAP_ADMINS de js/app.js e bootstrapAdmin() das firestore.rules.
const BOOTSTRAP_ADMINS = ['dosvleite@yahoo.com.br'];

const ORIGENS_PERMITIDAS = [
  'https://juriscontrolcmdc.com.br',
  'https://www.juriscontrolcmdc.com.br',
  'https://juriscontrolcmdc.web.app',
  'https://juriscontrolcmdc.firebaseapp.com',
];

// Chave PÚBLICA da API do Datajud, publicada pelo próprio CNJ na documentação
// (https://datajud-wiki.cnj.jus.br/api-publica/acesso). Se o CNJ rotacionar,
// atualize aqui e republique a função.
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const TRIBUNAIS_DATAJUD = new Set([
  'stf', 'stj', 'tst', 'trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6',
  'tjrj', 'tjsp', 'tjmg', 'tjrs', 'tjpr', 'tjsc', 'tjba', 'tjce', 'tjgo',
  'tjma', 'tjmt', 'tjpe', 'tjdft',
]);

// Bases indexadas pelo Jurisprudências.ai (GET /api/v1/courts confirma a lista).
const TRIBUNAIS_JURISAI = new Set([
  'stf', 'stj', 'tst', 'trf3', 'trf4', 'tjce', 'tjgo', 'tjma', 'tjmg',
  'tjmt', 'tjpr', 'tjrj', 'tjrs', 'tjsc', 'tjsp', 'carf',
]);

// Erro com status HTTP dedicado para o cliente (mensagem amigável no painel).
function erroCliente(status, msg) {
  const e = new Error(msg);
  e.statusCliente = status;
  return e;
}

function aplicarCors(req, res) {
  const origem = req.headers.origin || '';
  if (ORIGENS_PERMITIDAS.includes(origem)) {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Max-Age', '3600');
  }
}

// Valida o ID token e exige perfil aprovado (mesma política das firestore.rules).
async function usuarioAprovado(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const decoded = await getAuth().verifyIdToken(auth.slice(7));
  const email = (decoded.email || '').toLowerCase();
  if (BOOTSTRAP_ADMINS.includes(email)) return decoded;
  const perfil = await getFirestore().collection('perfis').doc(decoded.uid).get();
  if (perfil.exists && perfil.data().aprovado === true) return decoded;
  return null;
}

async function buscarLexml(tema) {
  const base = 'https://www.lexml.gov.br/busca/SRU';
  const consulta = (cql) => `${base}?operation=searchRetrieve&version=1.1&maximumRecords=10&query=${encodeURIComponent(cql)}`;
  const temaCql = `"${String(tema).replace(/"/g, ' ').trim()}"`;
  // 1ª tentativa restrita a jurisprudência; se vier vazio, tenta a base toda
  // (a sintaxe de índices do LexML tem variações entre versões do serviço).
  for (const cql of [`tipoDocumento = Jurisprudência and ${temaCql}`, temaCql]) {
    const resp = await fetch(consulta(cql), { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) continue;
    const resultados = normalizarLexml(await resp.text());
    if (resultados.length) return resultados;
  }
  return [];
}

// Token da conta Jurisprudências.ai: o admin cola em Configurações →
// "Integração Jurisprudências.ai", que grava em segredos/jurisai (coleção
// restrita a admin nas firestore.rules). O Admin SDK lê direto daqui.
async function buscarJurisai(q, tribunal) {
  const doc = await getFirestore().collection('segredos').doc('jurisai').get();
  const token = doc.exists ? String(doc.data().token || '').trim() : '';
  if (!token) {
    throw erroCliente(424, 'Token do Jurisprudências.ai não configurado. Um administrador precisa colá-lo em Configurações → Integração Jurisprudências.ai.');
  }
  const url = `https://jurisprudencias.ai/api/v1/courts/${tribunal}/decisions?q=${encodeURIComponent(q)}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (resp.status === 401) throw erroCliente(424, 'Token do Jurisprudências.ai inválido ou revogado. Gere um novo em jurisprudencias.ai/api-tokens e atualize em Configurações.');
  if (resp.status === 429) throw erroCliente(429, 'Limite diário de buscas do Jurisprudências.ai atingido. Tente amanhã ou use as fontes LexML/Datajud.');
  if (!resp.ok) throw new Error(`Jurisprudências.ai respondeu ${resp.status}`);
  return normalizarJurisai(await resp.json(), tribunal);
}

async function buscarDatajud(numero, tribunal) {
  const digitos = String(numero).replace(/\D/g, '');
  if (digitos.length < 7) return [];
  const resp = await fetch(`https://api-publica.datajud.cnj.br/api_publica_${tribunal}/_search`, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { match: { numeroProcesso: digitos } }, size: 5 }),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`Datajud respondeu ${resp.status}`);
  return normalizarDatajud(await resp.json(), tribunal);
}

exports.juris = onRequest(
  { region: 'us-central1', maxInstances: 2, timeoutSeconds: 30, memory: '256MiB' },
  async (req, res) => {
    aplicarCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'GET') { res.status(405).json({ erro: 'Use GET.' }); return; }

    try {
      const usuario = await usuarioAprovado(req);
      if (!usuario) { res.status(403).json({ erro: 'Acesso restrito a usuários aprovados do JurisControl.' }); return; }
    } catch (e) {
      console.warn('Token inválido:', e.message);
      res.status(401).json({ erro: 'Sessão inválida — entre novamente no sistema.' });
      return;
    }

    const fonte = String(req.query.fonte || 'lexml');
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (!q) { res.status(400).json({ erro: 'Informe o parâmetro q (tema ou nº do processo).' }); return; }

    try {
      let resultados;
      const tribunal = String(req.query.tribunal || 'tjrj').toLowerCase();
      if (fonte === 'jurisai') {
        if (!TRIBUNAIS_JURISAI.has(tribunal)) { res.status(400).json({ erro: `Tribunal não suportado pelo Jurisprudências.ai: ${tribunal}` }); return; }
        resultados = await buscarJurisai(q, tribunal);
      } else if (fonte === 'datajud') {
        if (!TRIBUNAIS_DATAJUD.has(tribunal)) { res.status(400).json({ erro: `Tribunal não suportado: ${tribunal}` }); return; }
        resultados = await buscarDatajud(q, tribunal);
      } else if (fonte === 'lexml') {
        resultados = await buscarLexml(q);
      } else {
        res.status(400).json({ erro: `Fonte desconhecida: ${fonte}` });
        return;
      }
      res.status(200).json({ resultados });
    } catch (e) {
      console.error(`Erro na busca (${fonte}):`, e);
      if (e.statusCliente) { res.status(e.statusCliente).json({ erro: e.message }); return; }
      res.status(502).json({ erro: 'A fonte externa não respondeu. Tente novamente em instantes.' });
    }
  }
);

// ===== Assistente de IA (Gemini) — apoio à redação de pareceres ===============
// Proxy para a API do Gemini (Google). A chave fica em segredos/gemini (coleção
// admin-only nas rules); o Admin SDK a lê direto. MODO GRATUITO recomendado:
// crie a chave num projeto SEM cobrança em aistudio.google.com — nesse tier o
// Google pode usar o conteúdo para treinar, então o app avisa para NÃO enviar
// dados sigilosos/pessoais de processos.
const GEMINI_MODELO = 'gemini-3.5-flash';
const IA_MAX_ENTRADA = 20000;      // trava de tamanho da entrada (caracteres)
const IA_MAX_SAIDA_TOKENS = 8192;  // resposta longa o bastante p/ não cortar frase
const IA_SISTEMA_PADRAO =
  'Você é um assistente de redação jurídica da Procuradoria-Geral da Câmara ' +
  'Municipal de Duque de Caxias (RJ). A sua saída é COLADA DIRETAMENTE no corpo de ' +
  'um parecer — portanto escreva APENAS o texto final, em prosa jurídica formal e ' +
  'contínua, pronto para uso. NÃO inclua preâmbulos, saudações nem meta-comentários ' +
  '(ex.: "apresento a proposta", "segue a redação", "sugestão de redação revisada", ' +
  '"na qualidade de assistente", "subsídio ao procurador"). NÃO rotule o texto como ' +
  '"modelo" ou "estrutura". Cite a legislação aplicável quando pertinente (com ' +
  'atenção à Lei 14.133/2021, à LC 101/2000 e à Lei Orgânica municipal quando ' +
  'cabível). NÃO invente jurisprudência, súmulas, números de processo, partes, ' +
  'valores ou datas; quando um dado indispensável não tiver sido fornecido, use um ' +
  'marcador curto como "[...]" — evite encher o texto de campos a preencher. Conclua ' +
  'todas as frases (não termine no meio). Use formatação simples (no máximo negrito ' +
  'em títulos de seção); evite tabelas. Este é um apoio à redação — a decisão e a ' +
  'responsabilidade final são do procurador.';

async function lerChaveGemini() {
  const doc = await getFirestore().collection('segredos').doc('gemini').get();
  const chave = doc.exists ? String((doc.data().token || doc.data().chave || '')).trim() : '';
  if (!chave) {
    throw erroCliente(424, 'Chave da API do Gemini não configurada. Um administrador precisa colá-la em Configurações → Assistente de IA (Gemini).');
  }
  return chave;
}

async function chamarGemini(sistema, prompt) {
  const chave = await lerChaveGemini();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${encodeURIComponent(chave)}`;
  const corpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: IA_MAX_SAIDA_TOKENS, temperature: 0.3 },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) {
    // Surface o erro REAL do Google (ex.: modelo descontinuado, chave inválida,
    // API desabilitada) em vez de uma mensagem genérica — facilita o diagnóstico.
    const errJson = await resp.json().catch(() => ({}));
    const detalhe = (errJson.error && errJson.error.message) || `HTTP ${resp.status}`;
    if (resp.status === 429) {
      throw erroCliente(429, 'Limite de uso gratuito do Gemini atingido por ora. Tente novamente em alguns minutos.');
    }
    if (resp.status === 400 || resp.status === 403) {
      throw erroCliente(424, `O Gemini recusou a requisição: ${detalhe}`);
    }
    throw erroCliente(502, `O Gemini respondeu ${resp.status}: ${detalhe}`);
  }
  const dados = await resp.json();
  const cand = dados.candidates && dados.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'BLOCKLIST') {
    throw erroCliente(422, 'A resposta foi bloqueada pelos filtros de segurança do Gemini. Reformule o pedido.');
  }
  const texto = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
  if (!texto) throw erroCliente(422, 'A IA retornou resposta vazia. Reformule o pedido e tente de novo.');
  return texto;
}

// ----- Modo COPILOTO: o assistente enxerga o parecer e devolve EDIÇÕES -------
// O front envia o texto atual do parecer (contexto) e o histórico da conversa;
// o Gemini pode chamar a ferramenta buscar_jurisprudencia (Jurisprudências.ai,
// com o token já configurado) e responde num JSON com { mensagem, edicoes[] }.
// As edições são aplicadas pelo front na seção certa do documento.
const IA_MAX_DOC = 10000; // trava do tamanho do documento enviado como contexto

const IA_SISTEMA_COPILOTO =
  'Você é o copiloto de redação da Procuradoria-Geral da Câmara Municipal de ' +
  'Duque de Caxias (RJ), acoplado ao editor de pareceres jurídicos. Você recebe ' +
  'o texto ATUAL do parecer (com os títulos das seções) e o pedido do procurador, ' +
  'e responde SEMPRE com um único JSON válido, sem cercas de código, no formato:\n' +
  '{"mensagem": "resposta curta ao procurador",\n' +
  ' "edicoes": [{"acao": "substituir_secao"|"inserir_na_secao"|"definir_ementa"|"inserir_final",\n' +
  '              "secao": "título EXATO da seção alvo (quando aplicável)",\n' +
  '              "conteudo": "texto a inserir"}]}\n' +
  'REGRAS: (1) "secao" deve copiar exatamente um dos títulos listados no contexto. ' +
  '(2) Use "substituir_secao" para reescrever o corpo de uma seção; "inserir_na_secao" ' +
  'para acrescentar ao final dela; "definir_ementa" (sem "secao") para propor a ementa ' +
  'em CAIXA ALTA; "inserir_final" para texto sem seção certa. (3) Se o pedido for só ' +
  'uma pergunta, devolva "edicoes": [] e responda em "mensagem". (4) O "conteudo" é ' +
  'prosa jurídica formal pronta para o documento — sem meta-comentários, sem se ' +
  'rotular como modelo, sem placeholders além de "[...]" quando faltar dado essencial. ' +
  'Pode usar **negrito** e listas simples. (5) NUNCA invente jurisprudência, súmulas ou ' +
  'números de processo: quando precisar de julgados reais, chame a ferramenta ' +
  'buscar_jurisprudencia e cite apenas o que ela retornar (tribunal, número, relator, ' +
  'data). Se a busca falhar ou nada for encontrado, diga isso em "mensagem" e NÃO cite ' +
  'julgados. (6) Não altere o que o procurador não pediu. A decisão final é dele.';

const IA_FERRAMENTAS = [{
  functionDeclarations: [{
    name: 'buscar_jurisprudencia',
    description: 'Busca decisões judiciais reais no acervo do Jurisprudências.ai. Use SEMPRE que precisar citar jurisprudência. Retorna título, tribunal, número, relator, órgão, data e ementa de cada decisão.',
    parameters: {
      type: 'object',
      properties: {
        termos: { type: 'string', description: 'Termos de busca (ex.: "prorrogação contrato serviço contínuo art. 107")' },
        tribunal: { type: 'string', description: 'Sigla do tribunal em minúsculas: tjrj (padrão), stj, stf, tjsp, tjmg, tjrs, tjpr, tjsc, tjce, tjgo, tjma, tjmt, trf3, trf4, tst ou carf' },
      },
      required: ['termos'],
    },
  }],
}];

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

// Executa a ferramenta pedida pelo modelo. Nunca lança: devolve { erro } para o
// modelo poder se explicar ao usuário (ex.: token não configurado, cota do dia).
async function executarFerramentaIA(nome, args, fontes) {
  if (nome !== 'buscar_jurisprudencia') return { erro: `Ferramenta desconhecida: ${nome}` };
  const termos = String((args && args.termos) || '').slice(0, 200);
  let tribunal = String((args && args.tribunal) || 'tjrj').toLowerCase();
  if (!TRIBUNAIS_JURISAI.has(tribunal)) tribunal = 'tjrj';
  if (!termos) return { erro: 'Informe os termos da busca.' };
  try {
    const resultados = (await buscarJurisai(termos, tribunal)).slice(0, 5);
    resultados.forEach(r => fontes.push(r));
    if (!resultados.length) return { resultados: [], aviso: 'Nenhuma decisão encontrada para esses termos.' };
    return { resultados };
  } catch (e) {
    console.warn('buscar_jurisprudencia falhou:', e.message);
    return { erro: `A busca de jurisprudência falhou: ${e.message}` };
  }
}

// Chamada bruta ao generateContent (reaproveitada pelo modo simples e pelo copiloto).
async function geminiGenerate(chave, corpo) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${encodeURIComponent(chave)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(50000),
  });
  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    const detalhe = (errJson.error && errJson.error.message) || `HTTP ${resp.status}`;
    if (resp.status === 429) {
      // O Google diz QUAL cota estourou (por minuto, por dia, tokens) e quanto
      // esperar — repassa isso em vez de uma mensagem genérica.
      const detalhes429 = JSON.stringify(errJson.error && errJson.error.details || []);
      const porDia = /PerDay|per day|daily/i.test(detalhes429 + detalhe);
      const espera = (detalhes429.match(/"retryDelay"\s*:\s*"(\d+)s"/) || [])[1];
      throw erroCliente(429,
        (porDia
          ? 'Cota DIÁRIA gratuita do Gemini esgotada — volta por volta das 4h da manhã (horário de Brasília).'
          : `Limite do Gemini atingido por ora${espera ? ` — aguarde ~${Math.ceil(espera / 60)} min` : ' — aguarde 1-2 minutos'}.`)
        + ` [detalhe: ${detalhe.slice(0, 200)}]`);
    }
    if (resp.status === 400 || resp.status === 403) throw erroCliente(424, `O Gemini recusou a requisição: ${detalhe}`);
    throw erroCliente(502, `O Gemini respondeu ${resp.status}: ${detalhe}`);
  }
  const dados = await resp.json();
  const cand = dados.candidates && dados.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'BLOCKLIST') {
    throw erroCliente(422, 'A resposta foi bloqueada pelos filtros de segurança do Gemini. Reformule o pedido.');
  }
  return cand;
}

// Loop do copiloto: envia contexto + conversa; se o modelo pedir a ferramenta,
// executa e devolve o resultado; no máximo 3 rodadas de ferramenta.
async function chamarCopiloto(contexto, historico, prompt) {
  const chave = await lerChaveGemini();
  const fontes = [];

  const secoes = (contexto.secoes || []).map(s => `- ${s}`).join('\n') || '(nenhuma seção identificada)';
  const contextoTxt =
    `CONTEXTO DO DOCUMENTO\n` +
    `Processo: ${contexto.processoNum || '(sem número)'}\n` +
    `Ementa atual: ${contexto.ementa || '(vazia)'}\n` +
    `Seções do parecer:\n${secoes}\n\n` +
    `TEXTO ATUAL DO PARECER:\n"""\n${String(contexto.texto || '').slice(0, IA_MAX_DOC)}\n"""`;

  const contents = [];
  (historico || []).slice(-8).forEach(m => {
    const papel = m.papel === 'ia' ? 'model' : 'user';
    const texto = String(m.texto || '').slice(0, 4000);
    if (texto) contents.push({ role: papel, parts: [{ text: texto }] });
  });
  contents.push({ role: 'user', parts: [{ text: `${contextoTxt}\n\nPEDIDO DO PROCURADOR:\n${prompt}` }] });

  let cand = null;
  for (let rodada = 0; rodada < 3; rodada++) {
    cand = await geminiGenerate(chave, {
      systemInstruction: { parts: [{ text: IA_SISTEMA_COPILOTO }] },
      contents,
      tools: IA_FERRAMENTAS,
      generationConfig: { maxOutputTokens: IA_MAX_SAIDA_TOKENS, temperature: 0.3 },
    });
    const parts = (cand.content && cand.content.parts) || [];
    const chamada = parts.find(p => p.functionCall);
    if (!chamada || rodada === 2) break;
    contents.push({ role: 'model', parts });
    const resultado = await executarFerramentaIA(chamada.functionCall.name, chamada.functionCall.args, fontes);
    contents.push({ role: 'user', parts: [{ functionResponse: { name: chamada.functionCall.name, response: resultado } }] });
  }

  const texto = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
  const json = extrairJsonDaResposta(texto);
  if (json && typeof json.mensagem === 'string') {
    const edicoes = Array.isArray(json.edicoes) ? json.edicoes.filter(e =>
      e && typeof e.conteudo === 'string' && e.conteudo.trim() &&
      ['substituir_secao', 'inserir_na_secao', 'definir_ementa', 'inserir_final'].includes(e.acao)
    ).slice(0, 8) : [];
    return { mensagem: json.mensagem, edicoes, fontes };
  }
  // Fallback: o modelo não devolveu o JSON esperado — trata tudo como resposta.
  if (!texto) throw erroCliente(422, 'A IA retornou resposta vazia. Reformule o pedido e tente de novo.');
  return { mensagem: texto, edicoes: [], fontes };
}

exports.assistente = onRequest(
  { region: 'us-central1', maxInstances: 2, timeoutSeconds: 120, memory: '256MiB' },
  async (req, res) => {
    aplicarCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ erro: 'Use POST.' }); return; }

    try {
      const usuario = await usuarioAprovado(req);
      if (!usuario) { res.status(403).json({ erro: 'Acesso restrito a usuários aprovados do JurisControl.' }); return; }
    } catch (e) {
      console.warn('Token inválido:', e.message);
      res.status(401).json({ erro: 'Sessão inválida — entre novamente no sistema.' });
      return;
    }

    const corpo = req.body || {};
    const prompt = String(corpo.prompt || '').trim();
    if (!prompt) { res.status(400).json({ erro: 'Informe o parâmetro prompt (o pedido para a IA).' }); return; }
    if (prompt.length > IA_MAX_ENTRADA) {
      res.status(413).json({ erro: `Pedido muito longo (máx. ${IA_MAX_ENTRADA} caracteres). Resuma o texto e tente de novo.` });
      return;
    }

    try {
      // Modo copiloto (novo): o front envia o contexto do documento e recebe
      // { mensagem, edicoes[], fontes[] }. Sem contexto, mantém o modo simples
      // (retrocompatível): { texto }.
      if (corpo.contexto && typeof corpo.contexto === 'object') {
        const resposta = await chamarCopiloto(corpo.contexto, corpo.historico, prompt);
        res.status(200).json(resposta);
        return;
      }
      const sistema = String(corpo.sistema || '').trim() || IA_SISTEMA_PADRAO;
      const texto = await chamarGemini(sistema, prompt);
      res.status(200).json({ texto });
    } catch (e) {
      console.error('Erro na IA:', e);
      if (e.statusCliente) { res.status(e.statusCliente).json({ erro: e.message }); return; }
      res.status(502).json({ erro: 'A IA não respondeu. Tente novamente em instantes.' });
    }
  }
);
