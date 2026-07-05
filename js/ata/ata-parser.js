/* =============================================================================
 * ata-parser.js — porte para o navegador do converter.py (JurisControl / CMDC)
 *
 * Lê o TEXTO CORRIDO do Word cru da empresa (extraído via mammoth) e separa em
 * dados estruturados para o ata-render.js: meta, chamada, quórum, expediente
 * (vetos/projetos/indicações/requerimentos), Tribuna e Ordem do Dia.
 *
 * Como é texto livre, o resultado precisa de uma CONFERIDA humana — o parser
 * devolve `warnings` apontando onde teve de assumir um padrão.
 *
 * Uso:
 *   const { data, warnings } = AtaParser.parseFromText(rawTextoDoWord);
 *   renderAta(docPage, data, { minuta:false, mostrarFicha:true, mostrarQuadro:true });
 *
 * Fidelidade: tradução 1:1 do converter.py. Alguns trechos (quadro de votações
 * da sessão de 16/06, rótulo "Vetos e Pareceres") são específicos daquele
 * formato — servem de ponto de partida e são ajustados na conferida.
 * =========================================================================== */
(function (global) {
  'use strict';

  var CORPO_KW = 'instituindo|concedendo|solicitando|denominando|outorgando|consignando|' +
    'dispondo|que dispõe|autorizando|desafeta|criando|vedando|reconhecendo|' +
    'alterando|acrescentando|revogando|estabelecendo|proibindo|determinando';

  var MES = { 'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
    'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };

  var LABEL = { PL: 'Projeto de Lei', PDL: 'Decreto Legislativo', PR: 'Projeto de Resolução',
    IND: 'Indicação', REQ: 'Requerimento', VETO: 'Veto' };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  // Menor índice, a partir de `from`, entre vários marcadores possíveis (ou -1).
  function firstIndexOf(s, markers, from) {
    from = from || 0;
    var best = -1;
    for (var i = 0; i < markers.length; i++) {
      var idx = s.indexOf(markers[i], from);
      if (idx >= 0 && (best < 0 || idx < best)) best = idx;
    }
    return best;
  }

  // Limpa o nome capturado: tira o " e" final (junção de lista) e prefixos que
  // não são nome (ex.: "Os Vereadores ...", "e o Vereador ..."), comuns quando
  // um grupo de vereadores registra presença no meio da lista.
  function cleanNome(s) {
    s = norm(s).replace(/[ e]+$/, '');
    s = s.replace(/^(?:e\s+)?[Oo]s?\s+Vereador(?:es|as|a)?\s+/, '');
    return s.trim();
  }

  // "Nome (Apelido), Nome (Apelido) e Nome (Apelido)" -> [{nome, apelido}]
  function splitPeople(segment) {
    var out = [];
    // tolera vírgula solta antes do parêntese ("Nome Sobrenome, (Apelido)")
    var re = /([A-ZÀ-Ú][^(,]+?)\s*,?\s*\(([^)]+)\)/g, m;
    while ((m = re.exec(segment))) {
      out.push({ nome: cleanNome(m[1]), apelido: norm(m[2]) });
    }
    return out;
  }

  function splitAutorCorpo(rest) {
    rest = String(rest || '').trim().replace(/^,/, '').trim();
    // autor = Executivo
    if (/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Prefeito/.test(rest)) {
      var rest2 = rest.replace(/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Prefeito[,]?\s*/, '');
      return ['Chefe do Poder Executivo', norm(rest2)];
    }
    // autor = Vereador(a) NOME
    var mv = rest.match(/^d[oa]s?\s+Ex[mM][ºoª]?\.?\s+Sr[ª]?\.?\s+Vereador[a]?\s+([\s\S]+)/);
    if (mv) {
      var tail = mv[1];
      var m = tail.match(new RegExp('\\b(' + CORPO_KW + ')\\b'));
      if (m) {
        return [norm(tail.slice(0, m.index).replace(/[ ,]+$/, '')), norm(tail.slice(m.index))];
      }
      var idx = tail.indexOf(',');
      if (idx >= 0) return [norm(tail.slice(0, idx)), norm(tail.slice(idx + 1))];
      return [norm(tail), ''];
    }
    // sem autor explícito
    return ['', norm(rest)];
  }

  // Quebra a fala de um orador em segmentos, reconhecendo apartes e retomadas:
  //   "Vereador NOME (Apelido) aparteia: ..."  -> segmento de aparte
  //   "Orador(a) retoma a palavra: ..."         -> segmento de retomada
  // Sem esses marcadores, devolve a fala inteira como um único segmento.
  function parseSegmentos(fala) {
    fala = String(fala || '');
    var marks = [], m;
    var apRe = /Vereador[a]?\s+([A-ZÀ-Ú][^:(.?!]{1,59}?)\s*\(([^)]+)\)\s*aparteia:\s*/g;
    while ((m = apRe.exec(fala))) {
      marks.push({ kind: 'aparte', nome: norm(m[1]), apelido: norm(m[2]),
        start: m.index, end: m.index + m[0].length });
    }
    var reRe = /[Oo]rador[a]?\s+retoma a palavra:\s*/g;
    while ((m = reRe.exec(fala))) {
      marks.push({ kind: 'retoma', start: m.index, end: m.index + m[0].length });
    }
    if (!marks.length) return [{ tipo: 'fala', texto: norm(fala) }];
    marks.sort(function (a, b) { return a.start - b.start; });

    var segs = [];
    var head = norm(fala.slice(0, marks[0].start));
    if (head) segs.push({ tipo: 'fala', texto: head });
    for (var i = 0; i < marks.length; i++) {
      var mk = marks[i];
      var txt = norm(fala.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : fala.length));
      if (mk.kind === 'aparte') {
        segs.push({ tipo: 'aparte', nome: mk.nome, apelido: mk.apelido, texto: txt });
      } else if (txt) {
        segs.push({ tipo: 'retoma', texto: txt });
      }
    }
    return segs.length ? segs : [{ tipo: 'fala', texto: norm(fala) }];
  }

  // "Mensagem nº 16/GP/2026, encaminhando Projeto de Lei nº 14/2026" -> "Mensagem nº 16/GP/2026 (PL 14/2026)"
  function cleanMateria(s) {
    s = norm(s);
    var enc = s.match(/(Mensagem n[ºo]\.?\s*[\dGP\/]+)[\s\S]*?Projeto de Lei n[ºo]\.?\s*([\d\/]+)/);
    if (enc) return norm(enc[1]) + ' (PL ' + enc[2] + ')';
    return s;
  }

  // Normaliza o desfecho da votação para uma frase curta.
  function cleanDesfecho(s) {
    s = norm(s);
    var mv = s.match(/(Aprovad[ao]s?|Rejeitad[ao]s?)\s+por\s+(\d+)\s+votos?\s+a favor e\s+(\d+)\s+contr/i);
    if (mv) return mv[1] + ' — ' + mv[2] + ' a favor, ' + mv[3] + ' contra';
    var mu = s.match(/(Aprovad[ao]s?|Rejeitad[ao]s?)\s+por unanimidade/i);
    if (mu) return norm(mu[0]);
    var mm = s.match(/(Aprovad[ao]s?|Rejeitad[ao]s?)/i);
    return mm ? mm[1] : s;
  }

  // Fase de discussão/votação da Ordem do Dia: cada matéria "..., em Discussão
  // [e Votação]." abre um bloco com falas ("... discute a matéria: ...") e um
  // desfecho ("Aprovado por unanimidade" / "por N votos a favor e M contrários").
  function parseODDebates(od) {
    var debates = [], votacoes = [];
    var vi = od.search(/Feita a leitura[^.]*\./);
    var seg = vi >= 0 ? od.slice(vi) : od;
    var ef = seg.search(/EXPEDIENTE FINAL/i);
    if (ef >= 0) seg = seg.slice(0, ef);

    var matRe = /((?:Mensagem|Projeto de Lei|Projeto de Decreto Legislativo|Projeto de Resolu[çc][ãa]o)\s+n[ºo]\.?\s*\d+\/(?:GP\/)?\d+(?:\s*,?\s*encaminhando(?:\s+o)?\s+Projeto de Lei\s+n[ºo]\.?\s*[\d\/]+)?)\s*,?\s*em Discuss[ãa]o(?:\s+e Vota[çc][ãa]o)?/g;
    var hits = [], m;
    while ((m = matRe.exec(seg))) hits.push({ label: m[1], start: m.index, end: m.index + m[0].length });

    for (var i = 0; i < hits.length; i++) {
      var block = seg.slice(hits[i].end, i + 1 < hits.length ? hits[i + 1].start : seg.length);
      var materia = cleanMateria(hits[i].label);
      // Marcadores de fala ("... discute a matéria:") — fatiar entre eles é mais
      // robusto que lookahead (um discurso pode citar "Vereador" à vontade).
      var falas = [];
      var fRe = /Vereador[a]?\s*,?\s*(L[íi]der de Governo\s*,?\s*)?([A-ZÀ-Ú][^:(.?!]{1,59}?)\s*\(([^)]+)\)\s*discute a mat[ée]ria:\s*/g;
      var fmarks = [], f;
      while ((f = fRe.exec(block))) {
        fmarks.push({ lider: !!f[1], nome: norm(f[2]), apelido: norm(f[3]),
          start: f.index, end: f.index + f[0].length });
      }
      for (var j = 0; j < fmarks.length; j++) {
        var ftxt = block.slice(fmarks[j].end, j + 1 < fmarks.length ? fmarks[j + 1].start : block.length);
        var cut = firstIndexOf(ftxt, ['Não havendo', 'O Presidente submete', 'O Presidente acata'], 0);
        if (cut >= 0) ftxt = ftxt.slice(0, cut);
        falas.push({ nome: fmarks[j].nome, apelido: fmarks[j].apelido,
          papel: fmarks[j].lider ? 'Líder de Governo' : '', texto: norm(ftxt) });
      }
      var des = block.match(/(Aprovad[ao]s?|Rejeitad[ao]s?)(?:\s+por unanimidade|\s+por\s+\d+\s+votos?\s+a favor e\s+\d+\s+contr[áa]rios?)?/i);
      var desfecho = des ? cleanDesfecho(des[0]) : '';
      if (falas.length) debates.push({ materia: materia, falas: falas, desfecho: desfecho });
      votacoes.push({ materia: materia, tipo: 'Discussão e Votação', resultado: desfecho || '—' });
    }
    return { debates: debates, votacoes: votacoes };
  }

  function classify(a) {
    if (a.indexOf('Mensagem') === 0) return 'VETO';
    if (a.indexOf('Projeto de Lei') === 0) return 'PL';
    if (a.indexOf('Projeto de Decreto') === 0) return 'PDL';
    if (a.indexOf('Projeto de Resolução') === 0) return 'PR';
    if (a.indexOf('Indicação') === 0) return 'IND';
    return 'REQ';
  }

  // Localiza as "âncoras" (Mensagem/Projeto/Indicação/Requerimento nº …) e monta
  // uma linha por matéria a partir do trecho entre âncoras.
  function itemsFrom(text, vetoOnly) {
    var anchor = /(Mensagem n[ºo]\.?\s*\d+\/GP\/\d+|Projeto de Lei n[ºo]\.?\s*[\d.\/]+|Projeto de Decreto Legislativo n[ºo]\.?\s*[\d.\/]+|Projeto de Resolução n[ºo]\.?\s*[\d.\/]+|Indicação n[ºo]\.?\s*[\d.\/]+|Requerimento n[ºo]\.?\s*[\d.\/]+)/g;
    var hits = [], m;
    while ((m = anchor.exec(text))) {
      hits.push({ t: m[1], start: m.index, end: m.index + m[0].length });
    }
    // um "Projeto de Lei nº X" logo após "encaminhando"/"ao" é objeto de uma Mensagem, não item próprio
    hits = hits.filter(function (h) {
      if (h.t.indexOf('Projeto de Lei') === 0) {
        var before = text.slice(Math.max(0, h.start - 16), h.start);
        if (/(encaminhando|ao)\s*$/.test(before)) return false;
      }
      return true;
    });
    if (vetoOnly) hits = hits.filter(function (h) { return h.t.indexOf('Mensagem') === 0; });

    var rows = [];
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var seg = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length);
      var kind = classify(h.t);
      var numM = h.t.match(/([\d]+\/\d{4}|\d+\/GP\/\d+)/);
      var num = numM ? numM[1] : '';
      // "Mensagem" sem a palavra VETO = mensagem do Executivo encaminhando projeto (não é veto)
      var isVeto = kind === 'VETO' && /VETO/i.test(seg);
      if (kind === 'VETO' && !isVeto) {
        var pl = seg.match(/Projeto de Lei n[ºo]\.?\s*([\d\/]+)/);
        var que = seg.match(/\bque\b[\s\S]*/);
        rows.push({ tag: 'PL', label: 'Projeto de Lei (Executivo)',
          num: pl ? pl[1] : num,
          autor: 'Chefe do Poder Executivo (Mensagem ' + num + ')',
          corpo: que ? norm(que[0]) : norm(seg) });
        continue;
      }
      var ac = splitAutorCorpo(seg);
      var row = { tag: kind, label: LABEL[kind], num: num, autor: ac[0], corpo: ac[1] };
      if (isVeto) {
        var vt = seg.match(/VETO (TOTAL|PARCIAL)/i);
        var cap = vt ? (vt[1].charAt(0).toUpperCase() + vt[1].slice(1).toLowerCase()) : 'Total';
        row.label = 'Veto ' + cap;
        row.autor = 'Chefe do Poder Executivo';
      }
      rows.push(row);
    }
    return rows;
  }

  // Recebe a LISTA de parágrafos (não-vazios, já aparados) do Word.
  function parse(paras) {
    paras = (paras || []).map(function (p) { return String(p); });
    var header = paras.slice(0, 9);
    // O corpo costuma estar em paras[2], mas a discussão/votação da Ordem do Dia
    // pode transbordar para parágrafos seguintes. Junta de paras[2] até o bloco
    // de assinatura — detectado pela primeira linha isolada "(Apelido)".
    var sigStart = paras.length;
    for (var bi = 3; bi < paras.length - 1; bi++) {
      if (/^\(.+\)$/.test(paras[bi + 1].trim()) && paras[bi].trim().length < 60) { sigStart = bi; break; }
    }
    var body = paras.length > 2 ? norm(paras.slice(2, sigStart).join(' ')) : norm(paras.join(' '));
    var warn = [];
    var data = {};

    // ---- meta ----
    var reuniao = header.length
      ? norm(header[0]).replace(/\.+$/, '').replace(/^Ata\s+d[ao]\s+/, '')
      : '';
    var m = body.match(/(Aos [\s\S]+? de dois mil e vinte e [A-Za-zÀ-ÿ]+),?\s*reuni/);
    var dpe = m ? m[1] : '';
    var hj = header.join(' ');
    m = hj.match(/Realizada no dia ([\s\S]+?)\./);
    var dataExt = m ? norm(m[1]) : '';
    m = body.match(/Presidência do Vereador ([\s\S]+?)\s*\(([\s\S]+?)\)\s*e secretariando os trabalhos (o|a) Vereador[a]?\s+([\s\S]+?)\s*\(([\s\S]+?)\)\./);
    var pres = {}, sec = {}, fem = false, emEx = false;
    if (m) {
      pres = { nome: norm(m[1]), apelido: norm(m[2]) };
      sec = { nome: norm(m[4]), apelido: norm(m[5]) };
      fem = m[3] === 'a';
      var endp = m.index + m[0].length;
      emEx = body.slice(endp, endp + 30).toLowerCase().indexOf('em exercício') >= 0;
    }
    var dc = '';
    var md = dataExt.match(/(\d{1,2}) de ([A-Za-zÀ-ÿ]+) de (\d{4})/);
    if (md) {
      var dd = ('0' + parseInt(md[1], 10)).slice(-2);
      dc = dd + '.' + (MES[md[2].toLowerCase()] || '00') + '.' + md[3];
    }
    data.meta = {
      reuniao: reuniao, legislatura: 'Vigésima Legislatura (20ª)',
      dataExtenso: dataExt, dataCurta: dc, dataPorExtenso: norm(dpe),
      odResumo: 'Vetos e Pareceres',
      secretarioCargo: (fem ? 'Secretária' : 'Secretário') + (emEx ? ' em exercício' : ''),
      secretarioArtigo: (fem ? 'a Vereadora' : 'o Vereador'),
      secretarioEmExercicio: emEx,
      presidente: pres, secretario: sec,
      redator: { nome: 'Davi Otoni da Silva Viana Leite', matricula: '9363696' }
    };
    warn.push('Redator veio EM BRANCO no Word da empresa — preenchido com o padrão (Davi Otoni). REVISAR.');

    // ---- chamada ----
    m = body.match(/os seguintes Vereadores:([\s\S]+?)Havendo número legal/);
    data.chamada = m ? splitPeople(m[1]) : [];

    // ---- expediente ----
    var sExp = body.indexOf('Expediente:');
    var eExp = body.indexOf('Terminada a leitura do Expediente');
    var exp = body.slice(sExp < 0 ? 0 : sExp, eExp < 0 ? body.length : eExp);
    var expRows = itemsFrom(exp, false);
    data.vetos = expRows.filter(function (r) { return r.tag === 'VETO'; });
    data.projetos = expRows.filter(function (r) { return r.tag === 'PL' || r.tag === 'PDL' || r.tag === 'PR'; });
    data.indicacoes = expRows.filter(function (r) { return r.tag === 'IND'; })
      .map(function (r) { return { num: r.num, autor: r.autor, corpo: r.corpo }; });
    data.requerimentos = expRows.filter(function (r) { return r.tag === 'REQ'; })
      .map(function (r) { return { num: r.num, autor: r.autor, corpo: r.corpo }; });

    // ---- tribuna ----
    // A Tribuna termina onde começa a Ordem do Dia OU o Expediente Final OU o
    // encerramento — nem toda sessão tem "ORDEM DO DIA" (ex.: só Expediente +
    // Tribuna). Usa o marcador que aparecer primeiro após o início da Tribuna.
    var sT = body.indexOf('franqueou a Tribuna');
    var eT = firstIndexOf(body, ['ORDEM DO DIA', 'EXPEDIENTE FINAL',
      'Não havendo Vereador inscrito', 'Não havendo mais Vereador'], sT < 0 ? 0 : sT + 1);
    var trib = body.slice(sT < 0 ? 0 : sT, eT < 0 ? body.length : eT);
    // O nome do orador é curto: limitá-lo (2..60 caracteres, sem "(" nem ":")
    // impede que a regex "engula" o discurso inteiro quando o próprio orador
    // menciona "Vereador(a)" no meio da fala.
    var speaker = /Vereador[a]?\s+([A-ZÀ-Ú][^:(.?!]{1,59}?)\s*\(([^)]+)\):\s*/g;
    var marks = [], mk;
    while ((mk = speaker.exec(trib))) {
      marks.push({ nome: mk[1], apelido: mk[2], head: mk[0], start: mk.index, end: mk.index + mk[0].length });
    }
    var tribuna = [];
    for (var i = 0; i < marks.length; i++) {
      var fala = trib.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : trib.length);
      fala = fala.replace(/(?:Por ordem de inscri[çc][ãa]o|Líder de Governo)[,]?\s*$/, '').trim();
      // O papel ("Por ordem de inscrição" / "Líder de Governo") é anunciado
      // ANTES do "Vereador ..." — olha a janela imediatamente anterior.
      var antes = trib.slice(Math.max(0, marks[i].start - 45), marks[i].start);
      var papel = /Líder de Governo/.test(antes) ? 'Líder de Governo' : 'Por ordem de inscrição';
      tribuna.push({ n: i + 1, nome: norm(marks[i].nome), apelido: norm(marks[i].apelido),
        papel: papel, segmentos: parseSegmentos(fala) });
    }
    data.tribuna = tribuna;

    // ---- ordem do dia ----
    // Se a sessão não tem Ordem do Dia formal, `od` fica vazio e as seções de
    // quórum/grupos/debates/votações saem vazias (não inventamos a partir do
    // Expediente).
    var sOd = body.indexOf('ORDEM DO DIA');
    var od = sOd < 0 ? '' : body.slice(sOd);
    m = od.match(/Registrou-se um total de\s+(\d+)\s+Vereadores presentes[^:]*:([\s\S]+?)(?:A Secretári|O Secretári)/);
    data.quorum = m ? splitPeople(m[2]) : [];

    // leitura da Ordem do Dia -> itens (matérias lidas)
    var lei = od.match(/leitura da Ordem do Dia:?([\s\S]+?)Feita a leitura/);
    data.odItems = lei ? itemsFrom(lei[1], false) : [];
    data.odGrupos = [];

    // rótulo da OD (ex.: "Primeira Discussão dos Pareceres")
    var odLabel = od.match(/\(([^)]*Discuss[ãa]o[^)]*)\)/);
    if (odLabel) data.meta.odResumo = norm(odLabel[1]);

    // debates e votações da fase de discussão/votação
    var dv = parseODDebates(od);
    data.debates = dv.debates;
    data.votacoes = dv.votacoes;

    // Segunda Discussão e Votação Extraordinária (quando houver)
    var seg2 = od.match(/Segunda Discuss[ãa]o e Vota[çc][ãa]o Extraordin[áa]ria\.?\s*(Aprovad[ao]s?[^.]*\.?)/i);
    if (seg2) {
      data.votacoes.push({ materia: 'Matérias em bloco', tipo: '2ª Discussão (Extraordinária)',
        resultado: cleanDesfecho(seg2[1]) });
    }

    // avisos de conferida (além do redator)
    if (!pres.nome) warn.push('Não identifiquei a Presidência/Secretaria no preâmbulo — CONFERIR.');
    if (!data.chamada.length) warn.push('Chamada regimental veio vazia — CONFERIR o Word.');
    if (!data.quorum.length) warn.push('Quórum da Ordem do Dia veio vazio — CONFERIR.');
    if (!dataExt) warn.push('Data por extenso da sessão não foi encontrada — CONFERIR.');

    return { data: data, warnings: warn };
  }

  // Quebra o texto cru (mammoth.extractRawText) em parágrafos não-vazios.
  function paragraphsFromText(raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function parseFromText(raw) {
    return parse(paragraphsFromText(raw));
  }

  global.AtaParser = {
    parse: parse,
    parseFromText: parseFromText,
    paragraphsFromText: paragraphsFromText
  };
})(typeof window !== 'undefined' ? window : this);
