// js/utils.js
// Funções utilitárias PURAS do JurisControl (datas, sanitização, whitelists de
// classes CSS). Não dependem de estado do app — só dos argumentos e de APIs do
// navegador (Date, document). Carregado como script clássico ANTES do app.js,
// então estas definições ficam visíveis para o app.js.

// ----- Datas -----
const fmtBR = (d) => { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); };
const parse = (d) => { if (!d) return null; const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, (dd || 1))); };
const todayUTC = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const diffDays = (a, b) => Math.ceil((b - a) / 86400000);
function ymd(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}`; }

// ----- Sanitização / segurança de UI -----
const sanitizeHTML = (str) => {
  if (!str) return '';
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
};

// Whitelists de valores válidos para classes CSS dinâmicas (evita injeção via Firestore).
const VALID_STATS = new Set(['pendente', 'em-analise', 'aguardando-documentacao', 'em-diligencia', 'finalizado', 'arquivado']);
const VALID_ACAO  = new Set(['criado', 'editado', 'excluido', 'parecer-criado', 'parecer-editado', 'parecer-emitido', 'parecer-reaberto', 'parecer-enviado-revisao', 'parecer-devolvido']);
// Estados do fluxo de revisão do parecer (whitelist p/ classe CSS do badge).
const VALID_PARECER_STATUS = new Set(['rascunho', 'em-revisao', 'emitido']);
const VALID_CAT   = new Set(['g', 'a', 'r', 'p', 'u', 'e', 'o']);
const safeCSSClass = (value, whitelist) => whitelist.has(value) ? value : '';

// ----- Histórico / diff de alterações -----
// Compara dois registros de processo e retorna os campos rastreados que
// mudaram (usado por logHistorico no app.js). Trata null/undefined/'' como
// equivalentes (coerção via String(x || '')). Função pura.
const TRACK_FIELDS = ['num', 'int', 'tipo', 'obj', 'acao', 'stat', 'setorOrigem', 'dest', 'ent', 'prazo', 'saida'];
function getChanges(oldRec, newRec) {
  return TRACK_FIELDS
    .filter(f => String(oldRec[f] || '') !== String(newRec[f] || ''))
    .map(f => ({ campo: f, de: oldRec[f] || '', para: newRec[f] || '' }));
}

// ----- Arquivos (download / MIME) -----
// Decodifica um dataURL base64 (ex.: "data:...;base64,XXXX") num ArrayBuffer.
// Em caso de erro (base64 inválido/sem vírgula) retorna um buffer vazio. Puro
// (depende só de window.atob). Usado pelo download de modelos/anexos.
function base64ToArrayBuffer(base64) {
  try {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
    return bytes.buffer;
  } catch (e) {
    console.error("Erro ao decodificar base64:", e);
    return new ArrayBuffer(0); // Retorna buffer vazio em caso de erro
  }
}

// MIME a partir da extensão do arquivo (fallback: .docx). Função pura.
function getMimeType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'doc': return 'application/msword';
    case 'pdf': return 'application/pdf';
    default: return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
}

// ----- Filtro e ordenação de processos -----
// Aplica busca textual, filtros e ordenação sobre uma lista de processos e
// devolve uma NOVA lista (não muta a original). Função pura — toda a entrada
// vem por `criterios`, incluindo o mapa de rótulos de status usado na busca.
//
// criterios = {
//   busca, initialFilter:{status,prazo:'alerta'|'vencido',month}, status, setor,
//   tipo, emissor, entradaDe, entradaAte, ordem:'prazo'|'status'|<entrada>, statusMap
// }
function filtrarOrdenarProcessos(lista, criterios = {}) {
  const {
    busca = '', initialFilter = null, status = '', setor = '', tipo = '',
    emissor = '', entradaDe = '', entradaAte = '', ordem = '', statusMap = {},
  } = criterios;
  let L = (lista || []).slice();
  const t = String(busca || '').toLowerCase().trim();
  if (t) L = L.filter(p => [p.num, p.int, p.obj, p.setorOrigem, p.dest, p.acao, statusMap[p.stat]].some(v => String(v || '').toLowerCase().includes(t)));
  if (initialFilter?.status) L = L.filter(p => p.stat === initialFilter.status);
  if (initialFilter?.prazo === 'alerta') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) <= 5 && diffDays(todayUTC(), parse(p.prazo)) >= 0);
  if (initialFilter?.prazo === 'vencido') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) < 0);
  if (initialFilter?.month !== undefined && initialFilter?.month !== null) L = L.filter(p => p.ent && parse(p.ent).getUTCMonth() === initialFilter.month);
  if (status) L = L.filter(p => p.stat === status);
  if (setor) L = L.filter(p => p.setorOrigem === setor || p.dest === setor);
  if (tipo) L = L.filter(p => p.tipo === tipo);
  if (emissor) L = L.filter(p => String(p.emissorId || '') === emissor);
  if (entradaDe) { const de = parse(entradaDe); L = L.filter(p => p.ent && parse(p.ent) >= de); }
  if (entradaAte) { const ate = parse(entradaAte); L = L.filter(p => p.ent && parse(p.ent) <= ate); }
  if (ordem === 'prazo') L.sort((a, b) => { const A = parse(a.prazo), B = parse(b.prazo); return (A ? A.getTime() : Infinity) - (B ? B.getTime() : Infinity); });
  else if (ordem === 'status') L.sort((a, b) => (a.stat || '').localeCompare(b.stat || ''));
  else L.sort((a, b) => { const A = parse(a.ent), B = parse(b.ent); return (B ? B.getTime() : 0) - (A ? A.getTime() : 0); });
  return L;
}

// ----- Pareceres e versões -----
// Lógica pura de derivação de pareceres/versões (os DB_* entram por argumento).
// Os acessores do app.js (getParecerInfo, getCurrentVersion, etc.) delegam aqui.

// Normaliza um item (parecer estruturado ou documento Word legado) para o
// formato da lista combinada de pareceres.
function normalizeParecerParaLista(item, tipo) {
  if (tipo === 'estruturado') {
    return {
      id: `pz-${item.id}`, tipo: 'estruturado',
      titulo: `Parecer — Processo ${item.processoNum || 's/ nº'}`,
      status: item.status, dataRef: item.atualizadoEm || item.criadoEm, ref: item,
    };
  }
  return { id: `doc-${item.id}`, tipo: 'legado', titulo: item.nomePrincipal, status: null, dataRef: item.criadoEm, ref: item };
}

// Junta pareceres legados (docs) + estruturados numa lista ordenada por data
// (mais recente primeiro).
function combinarPareceres(docs = [], pareceres = []) {
  const legado = docs.map(d => normalizeParecerParaLista(d, 'legado'));
  const estruturados = pareceres.map(pz => normalizeParecerParaLista(pz, 'estruturado'));
  return [...legado, ...estruturados].sort((a, b) => new Date(b.dataRef) - new Date(a.dataRef));
}

// Versões de um documento, da mais nova para a mais antiga.
function versoesDoDocumento(versoes = [], docId) {
  return versoes.filter(v => v.idDocumento === docId).sort((a, b) => b.versao - a.versao);
}

// Versão "atual" de um documento (a apontada por doc.idVersaoAtual).
function versaoAtual(docs = [], versoes = [], docId) {
  const doc = docs.find(d => d.id === docId);
  if (!doc) return null;
  return versoes.find(v => v.id === doc.idVersaoAtual);
}

// Versões de um parecer estruturado, da mais nova para a mais antiga.
function versoesDoParecer(parecerVersoes = [], parecerId) {
  return parecerVersoes.filter(v => String(v.parecerId) === String(parecerId)).sort((a, b) => b.versao - a.versao);
}

// Decide qual é o parecer de um processo: estruturado > Word legado > nenhum.
// Devolve dados normalizados (não HTML) ou null. 'legado-orfao' = docId aponta
// para um documento que não existe mais.
function inferirParecerInfo(processo, pareceres = [], docs = []) {
  const estruturado = pareceres.find(pz => String(pz.processoId) === String(processo.id));
  if (estruturado) {
    const status = estruturado.status || 'rascunho';
    const emitido = status === 'emitido';
    const LABELS = { rascunho: 'Rascunho', 'em-revisao': 'Em revisão', emitido: 'Emitido' };
    const label = LABELS[status] || 'Rascunho';
    return {
      tipo: 'estruturado', emitido, status, label,
      numero: estruturado.numero || null,
      dataRef: emitido ? estruturado.emitidoEm : (estruturado.atualizadoEm || estruturado.criadoEm),
      nomeDocumento: `Parecer redigido no sistema (${label})`,
      parecer: estruturado, docLegado: null,
    };
  }
  if (processo.docId) {
    const docLegado = docs.find(d => d.id === processo.docId);
    if (docLegado) {
      return { tipo: 'legado', emitido: null, label: null, dataRef: docLegado.criadoEm, nomeDocumento: docLegado.nomePrincipal, parecer: null, docLegado };
    }
    return { tipo: 'legado-orfao', emitido: null, label: null, dataRef: null, nomeDocumento: null, parecer: null, docLegado: null };
  }
  return null;
}

// Conectivos (artigos/preposições/contrações) que só adicionam ruído à busca
// lexical de jurisprudência (que faz "E" implícito entre as palavras). Removê-los
// relaxa a consulta sem alterar o sentido. NÃO inclui operadores (e/ou/não).
const JURIS_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas',
  'por', 'para', 'pra', 'pro', 'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'após',
  'num', 'numa', 'dum', 'duma',
]);

// Normaliza a consulta de jurisprudência antes de mandar para a API: colapsa
// espaços e remove conectivos, deixando só as palavras de conteúdo (a API já
// faz "E" implícito, então menos conectivos = menos restrição espúria). É uma
// etapa leve/segura; a expansão semântica de sinônimos é um passo à parte.
// Nunca esvazia a busca: se sobrariam menos de 2 palavras, devolve o texto original.
function normalizarConsultaJuris(texto) {
  const original = String(texto || '').trim().replace(/\s+/g, ' ');
  if (!original) return '';
  const mantidos = original.split(' ').filter((t) => !JURIS_STOPWORDS.has(t.toLowerCase()));
  return mantidos.length < 2 ? original : mantidos.join(' ');
}

function jurisSemAcento(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Dicionário cotidiano → jurídico para expandir a busca. Cada conceito tem
// `gatilhos` (palavras do dia a dia que o ativam, sem acento) e `termos` (frases
// técnicas equivalentes, combinadas com OR). Curado para os temas recorrentes de
// uma câmara/procuradoria municipal. Amplie à vontade — é só dado.
const JURIS_CONCEITOS = [
  { gatilhos: ['gravacao', 'gravacoes', 'gravar', 'gravado', 'filmagem', 'audio', 'escuta'],
    termos: ['gravação ambiental', 'gravação clandestina', 'prova ilícita'] },
  { gatilhos: ['camera', 'cameras', 'cftv', 'vigilancia', 'monitoramento', 'monitorar'],
    termos: ['monitoramento por câmeras', 'videomonitoramento', 'circuito interno de televisão'] },
  { gatilhos: ['escritorio', 'trabalho', 'emprego', 'empregado'],
    termos: ['ambiente de trabalho', 'local de trabalho', 'relação de emprego'] },
  { gatilhos: ['demissao', 'demitido', 'demitir', 'justa causa'],
    termos: ['dispensa por justa causa', 'rescisão do contrato de trabalho'] },
  { gatilhos: ['assedio'],
    termos: ['assédio moral', 'assédio'] },
  { gatilhos: ['licitacao', 'licitar', 'pregao', 'concorrencia publica'],
    termos: ['licitação', 'processo licitatório', 'pregão'] },
  { gatilhos: ['contrato administrativo', 'contratacao publica'],
    termos: ['contrato administrativo'] },
  { gatilhos: ['servidor', 'concursado', 'funcionario publico'],
    termos: ['servidor público', 'agente público'] },
  { gatilhos: ['aposentadoria', 'aposentar', 'aposentado'],
    termos: ['aposentadoria'] },
  { gatilhos: ['pensao', 'pensionista'],
    termos: ['pensão por morte'] },
  { gatilhos: ['prescricao', 'prescrito', 'decadencia'],
    termos: ['prescrição', 'decadência'] },
  { gatilhos: ['improbidade'],
    termos: ['improbidade administrativa'] },
  { gatilhos: ['nepotismo'],
    termos: ['nepotismo'] },
  { gatilhos: ['emenda', 'emendas'],
    termos: ['emenda parlamentar', 'processo legislativo'] },
  { gatilhos: ['veto', 'vetado'],
    termos: ['veto', 'processo legislativo'] },
  { gatilhos: ['horas extras', 'hora extra', 'sobreaviso'],
    termos: ['horas extras', 'jornada de trabalho'] },
  { gatilhos: ['lgpd', 'dados pessoais', 'privacidade'],
    termos: ['proteção de dados', 'dados pessoais'] },
];

// Expande a consulta com sinônimos jurídicos: para cada conceito reconhecido no
// texto, injeta um grupo ("termo1" OR "termo2" …); palavras do usuário que não
// caíram em nenhum conceito são mantidas (preserva especificidade). Se NADA for
// reconhecido, cai no comportamento seguro de normalizarConsultaJuris. Isso mapeia
// linguagem cotidiana para o jargão das ementas e reduz falsos negativos/positivos.
function expandirConsultaJuris(texto) {
  const base = normalizarConsultaJuris(texto);
  if (!base) return '';
  const alvo = jurisSemAcento(base.toLowerCase());
  const grupos = [];
  const consumidos = new Set();
  for (const c of JURIS_CONCEITOS) {
    if (!c.gatilhos.some((g) => alvo.includes(jurisSemAcento(g)))) continue;
    grupos.push('(' + c.termos.map((t) => `"${t}"`).join(' OR ') + ')');
    // Marca como consumidas as palavras dos gatilhos que casaram E dos próprios
    // termos técnicos — assim não repetimos, soltas, palavras já cobertas pelos grupos.
    c.gatilhos.forEach((g) => {
      const gn = jurisSemAcento(g);
      if (alvo.includes(gn)) gn.split(' ').forEach((w) => consumidos.add(w));
    });
    c.termos.forEach((t) => jurisSemAcento(t.toLowerCase()).split(' ').forEach((w) => consumidos.add(w)));
  }
  if (grupos.length === 0) return base;
  // Operadores nunca podem sobrar soltos (um "ou" pendurado quebraria a consulta).
  const OPERADORES = new Set(['e', 'ou', 'nao', 'and', 'or', 'not']);
  const soltas = base.split(' ').filter((w) => {
    const wn = jurisSemAcento(w.toLowerCase());
    return wn && !consumidos.has(wn) && !OPERADORES.has(wn);
  });
  return [...grupos, ...soltas].join(' ');
}

// Filtra e ordena a lista de resultados de jurisprudência já buscada (client-side,
// sobre o que veio da API). Filtros por tribunal e órgão julgador; ordenação por
// data (recentes/antigos) ou por tribunal. Pura e testável.
function filtrarOrdenarResultadosJuris(lista, opcoes = {}) {
  const { tribunal = '', orgao = '', ordem = 'recentes' } = opcoes;
  let out = Array.isArray(lista) ? lista.slice() : [];
  if (tribunal) out = out.filter((r) => (r.tribunal || '') === tribunal);
  if (orgao) out = out.filter((r) => (r.orgao || '') === orgao);
  const porData = (a, b, sinal) => sinal * String(a.data || '').localeCompare(String(b.data || ''));
  if (ordem === 'antigos') out.sort((a, b) => porData(a, b, 1));
  else if (ordem === 'tribunal') out.sort((a, b) => String(a.tribunal || '').localeCompare(String(b.tribunal || '')) || porData(a, b, -1));
  else out.sort((a, b) => porData(a, b, -1)); // recentes (padrão)
  return out;
}

// Exporta para ambientes de teste (Node/Vitest). No navegador `module` não
// existe, então este bloco é ignorado e NÃO afeta o carregamento via <script>.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass, getChanges, TRACK_FIELDS,
    base64ToArrayBuffer, getMimeType, filtrarOrdenarProcessos,
    normalizeParecerParaLista, combinarPareceres, versoesDoDocumento, versaoAtual, versoesDoParecer, inferirParecerInfo,
    normalizarConsultaJuris, expandirConsultaJuris, filtrarOrdenarResultadosJuris,
    VALID_STATS, VALID_ACAO, VALID_CAT, VALID_PARECER_STATUS,
  };
}
