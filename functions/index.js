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
const { normalizarLexml, normalizarDatajud } = require('./normalizadores');

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

function aplicarCors(req, res) {
  const origem = req.headers.origin || '';
  if (ORIGENS_PERMITIDAS.includes(origem)) {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
      if (fonte === 'datajud') {
        const tribunal = String(req.query.tribunal || 'tjrj').toLowerCase();
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
      res.status(502).json({ erro: 'A fonte externa não respondeu. Tente novamente em instantes.' });
    }
  }
);
