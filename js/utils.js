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
const VALID_ACAO  = new Set(['criado', 'editado', 'excluido', 'parecer-criado', 'parecer-editado', 'parecer-emitido', 'parecer-reaberto']);
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

// Exporta para ambientes de teste (Node/Vitest). No navegador `module` não
// existe, então este bloco é ignorado e NÃO afeta o carregamento via <script>.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass, getChanges, TRACK_FIELDS, VALID_STATS, VALID_ACAO, VALID_CAT };
}
