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
const GEMINI_MODELO = 'gemini-2.5-flash';
const IA_MAX_ENTRADA = 20000;      // trava de tamanho da entrada (caracteres)
const IA_MAX_SAIDA_TOKENS = 2048;  // limita a resposta (custo/latência sob controle)
const IA_SISTEMA_PADRAO =
  'Você é um assistente jurídico da Procuradoria-Geral da Câmara Municipal de ' +
  'Duque de Caxias (RJ). Escreva em português formal, com boa técnica jurídica, ' +
  'e cite a legislação aplicável quando pertinente (com atenção à Lei 14.133/2021, ' +
  'à LC 101/2000 e à Lei Orgânica municipal quando cabível). Seja objetivo. NÃO ' +
  'invente jurisprudência, súmulas, números de processo ou fatos que não foram ' +
  'fornecidos; se faltar informação, diga o que seria necessário. Este é um apoio ' +
  'à redação — a responsabilidade final é do procurador.';

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
  if (resp.status === 400 || resp.status === 403) {
    throw erroCliente(424, 'Chave da API do Gemini inválida ou sem permissão. Gere uma nova em aistudio.google.com e atualize em Configurações.');
  }
  if (resp.status === 429) {
    throw erroCliente(429, 'Limite de uso gratuito do Gemini atingido por ora. Tente novamente em alguns minutos.');
  }
  if (!resp.ok) throw new Error(`Gemini respondeu ${resp.status}`);
  const dados = await resp.json();
  const cand = dados.candidates && dados.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'BLOCKLIST') {
    throw erroCliente(422, 'A resposta foi bloqueada pelos filtros de segurança do Gemini. Reformule o pedido.');
  }
  const texto = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
  if (!texto) throw erroCliente(422, 'A IA retornou resposta vazia. Reformule o pedido e tente de novo.');
  return texto;
}

exports.assistente = onRequest(
  { region: 'us-central1', maxInstances: 2, timeoutSeconds: 60, memory: '256MiB' },
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
    const sistema = String(corpo.sistema || '').trim() || IA_SISTEMA_PADRAO;
    if (!prompt) { res.status(400).json({ erro: 'Informe o parâmetro prompt (o pedido para a IA).' }); return; }
    if (prompt.length > IA_MAX_ENTRADA) {
      res.status(413).json({ erro: `Pedido muito longo (máx. ${IA_MAX_ENTRADA} caracteres). Resuma o texto e tente de novo.` });
      return;
    }

    try {
      const texto = await chamarGemini(sistema, prompt);
      res.status(200).json({ texto });
    } catch (e) {
      console.error('Erro na IA:', e);
      if (e.statusCliente) { res.status(e.statusCliente).json({ erro: e.message }); return; }
      res.status(502).json({ erro: 'A IA não respondeu. Tente novamente em instantes.' });
    }
  }
);
