// functions/normalizadores.js
// Funções PURAS que convertem as respostas cruas das fontes externas
// (LexML SRU/XML e Datajud CNJ/JSON) no formato único consumido pelo painel
// de jurisprudência do site:
//   { fonte, titulo, tribunal, classe, numero, data, ementa, url }
//
// Sem dependências e sem I/O — testadas em test/web/juris-normalizadores.test.js.
'use strict';

// ---------- LexML (SRU 1.1 / Dublin Core) ----------

// Extrai o texto de TODAS as ocorrências de uma tag XML (com ou sem prefixo de
// namespace), sem parser externo. Uso controlado: os documentos SRU do LexML
// têm estrutura rasa e previsível.
function extrairTags(xml, tag) {
  const re = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(decodificarXML(m[1].trim()));
  return out;
}

function decodificarXML(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

// Deduz o tribunal/órgão a partir da URN LexML (ex.: urn:lex:br:supremo.tribunal.federal:...).
function tribunalDaUrn(urn) {
  const mapa = {
    'supremo.tribunal.federal': 'STF',
    'superior.tribunal.justica': 'STJ',
    'tribunal.superior.trabalho': 'TST',
    'federal': 'Federal',
  };
  for (const [chave, sigla] of Object.entries(mapa)) {
    if (urn.includes(chave)) return sigla;
  }
  return '';
}

/**
 * Converte a resposta XML do SRU do LexML em resultados normalizados.
 * Nunca lança: entrada inesperada resulta em lista vazia.
 */
function normalizarLexml(xml) {
  if (typeof xml !== 'string' || !xml.includes('record')) return [];
  // Isola cada <srw:record>…</srw:record> para não misturar campos entre registros.
  const registros = xml.match(/<(?:[A-Za-z0-9_]+:)?record[\s>][\s\S]*?<\/(?:[A-Za-z0-9_]+:)?record>/g) || [];
  const out = [];
  for (const reg of registros) {
    const titulo = extrairTags(reg, 'title')[0] || '';
    if (!titulo) continue;
    const urn = extrairTags(reg, 'urn')[0] || extrairTags(reg, 'identifier')[0] || '';
    const data = extrairTags(reg, 'date')[0] || '';
    const descricao = extrairTags(reg, 'description')[0] || '';
    const tipo = extrairTags(reg, 'type')[0] || '';
    out.push({
      fonte: 'lexml',
      titulo,
      tribunal: tribunalDaUrn(urn),
      classe: tipo,
      numero: '',
      data,
      ementa: descricao,
      url: urn && urn.startsWith('urn:') ? `https://www.lexml.gov.br/urn/${urn}` : (urn || ''),
    });
  }
  return out;
}

// ---------- Datajud (CNJ / ElasticSearch JSON) ----------

const NOMES_TRIBUNAIS = {
  stf: 'STF', stj: 'STJ', tst: 'TST',
  trf1: 'TRF1', trf2: 'TRF2', trf3: 'TRF3', trf4: 'TRF4', trf5: 'TRF5', trf6: 'TRF6',
  tjrj: 'TJRJ', tjsp: 'TJSP', tjmg: 'TJMG', tjrs: 'TJRS', tjpr: 'TJPR', tjsc: 'TJSC',
  tjba: 'TJBA', tjce: 'TJCE', tjgo: 'TJGO', tjma: 'TJMA', tjmt: 'TJMT', tjpe: 'TJPE', tjdft: 'TJDFT',
};

function formatarNumeroCNJ(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length !== 20) return String(n || '');
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/**
 * Converte a resposta do endpoint público do Datajud (_search) em resultados
 * normalizados. Nunca lança: entrada inesperada resulta em lista vazia.
 */
function normalizarDatajud(json, tribunalId) {
  const hits = json && json.hits && Array.isArray(json.hits.hits) ? json.hits.hits : [];
  const out = [];
  for (const h of hits) {
    const s = h && h._source ? h._source : {};
    const numero = formatarNumeroCNJ(s.numeroProcesso);
    if (!numero) continue;
    const assuntos = Array.isArray(s.assuntos)
      ? s.assuntos.map((a) => a && a.nome).filter(Boolean).join('; ')
      : '';
    out.push({
      fonte: 'datajud',
      titulo: `${(s.classe && s.classe.nome) || 'Processo'} ${numero}`,
      tribunal: NOMES_TRIBUNAIS[tribunalId] || String(s.tribunal || tribunalId || '').toUpperCase(),
      classe: (s.classe && s.classe.nome) || '',
      numero,
      data: String(s.dataAjuizamento || '').slice(0, 10),
      ementa: assuntos ? `Assuntos: ${assuntos}` : '',
      url: '',
    });
  }
  return out;
}

module.exports = { normalizarLexml, normalizarDatajud, formatarNumeroCNJ, extrairTags, tribunalDaUrn };
