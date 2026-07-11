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

// Exporta para ambientes de teste (Node/Vitest). No navegador `module` não
// existe, então este bloco é ignorado e NÃO afeta o carregamento via <script>.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass, getChanges, TRACK_FIELDS,
    base64ToArrayBuffer, getMimeType, filtrarOrdenarProcessos,
    normalizeParecerParaLista, combinarPareceres, versoesDoDocumento, versaoAtual, versoesDoParecer, inferirParecerInfo,
    normalizarConsultaJuris,
    VALID_STATS, VALID_ACAO, VALID_CAT, VALID_PARECER_STATUS,
  };
}
